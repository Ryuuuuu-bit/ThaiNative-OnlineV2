import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';
import { createApp } from '../server/src/app.ts';
import { MemoryStore } from '../server/src/store/memory.ts';
import { PostgresStore } from '../server/src/store/postgres.ts';
import { mountRealtime } from '../server/src/realtime/index.ts';

const secret = 'cloudflare-test-secret-at-least-32-characters';
const source = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
async function worker() {
  const context = createContext({ Request, Response, Headers, URL, AbortSignal, scheduler: { wait: async () => {} } });
  const builtin = new SyntheticModule(['DurableObject'], function () {
    this.setExport('DurableObject', class { constructor(ctx, env) { this.ctx = ctx; this.env = env; } });
  }, { context });
  const module = new SourceTextModule(source, { context });
  await module.link(name => { assert.equal(name, 'cloudflare:workers'); return builtin; });
  await module.evaluate();
  return module.namespace;
}
async function fixture({ fetcher = async () => new Response('ok'), env = {} } = {}) {
  const { GameServer, default: handler } = await worker();
  const starts = [], requests = [], timeouts = [];
  const container = {
    running: false,
    start(options) { starts.push(options); this.running = true; },
    async setInactivityTimeout(value) { timeouts.push(value); },
    getTcpPort(port) { assert.equal(port, 8787); return { fetch: async (...args) => { requests.push(args[0]); return fetcher(...args); } }; }
  };
  const server = new GameServer({ container }, { DATABASE_URL: 'postgres://test@localhost/test', SESSION_SECRET: secret, ...env });
  return { server, handler, container, starts, requests, timeouts };
}

test('all requests use the same game process', async () => {
  const { default: handler } = await worker(), names = [];
  const expected = new Response('game');
  const env = { GAME: { getByName(name) { names.push(name); return { fetch: async () => expected }; } } };
  assert.equal(await handler.fetch(new Request('https://preview.example/'), env), expected);
  assert.equal(await handler.fetch(new Request('https://preview.example/api/ws'), env), expected);
  assert.deepEqual(names, ['game', 'game']);
});

test('concurrent requests start once, wait for health, then reuse the process', async () => {
  const f = await fixture({ env: { SHARED_ROOMS: '1', UNRELATED_SECRET: 'never-forward' } });
  await Promise.all([f.server.fetch(new Request('https://preview.example/')), f.server.fetch(new Request('https://preview.example/api/me'))]);
  await f.server.fetch(new Request('https://preview.example/assets/test.webp'));
  assert.equal(f.starts.length, 1);
  assert.equal(f.requests.filter(r => typeof r === 'string').length, 1);
  assert.equal(f.starts[0].enableInternet, true);
  assert.equal(f.starts[0].env.NODE_ENV, 'production');
  assert.equal(f.starts[0].env.SHARED_ROOMS, '1');
  assert.equal(f.starts[0].env.UNRELATED_SECRET, undefined);
  assert.ok(f.timeouts[0] > 60_000);
  f.container.running = false;
  await f.server.fetch(new Request('https://preview.example/'));
  assert.equal(f.starts.length, 2);
});

test('proxy preserves body, cookies and public origin while replacing spoofed proxy headers', async () => {
  const f = await fixture();
  await f.server.fetch(new Request('https://preview.example:8443/api/guest?test=1', {
    method: 'POST', body: '{}', headers: {
      Origin: 'https://preview.example:8443', Cookie: 'tn_session=test', 'CF-Connecting-IP': '203.0.113.5',
      Host: 'evil.example', 'X-Forwarded-For': 'spoof, spoof', 'X-Forwarded-Proto': 'http',
      'X-Forwarded-Host': 'evil.example', Forwarded: 'for=spoof'
    }
  }));
  const request = f.requests.at(-1);
  assert.equal(request.url, 'http://container/api/guest?test=1');
  assert.equal(request.headers.get('Host'), 'preview.example:8443');
  assert.equal(request.headers.get('X-Forwarded-Host'), 'preview.example:8443');
  assert.equal(request.headers.get('X-Forwarded-Proto'), 'https');
  assert.equal(request.headers.get('X-Forwarded-For'), '203.0.113.5');
  assert.equal(request.headers.get('Forwarded'), null);
  assert.equal(request.headers.get('Origin'), 'https://preview.example:8443');
  assert.equal(request.headers.get('Cookie'), 'tn_session=test');
  assert.equal(await request.text(), '{}');
});

test('WebSocket upgrade response and headers pass through unchanged', async () => {
  const upgraded = { status: 101, webSocket: {} };
  const f = await fixture({ fetcher: async request => typeof request === 'string' ? new Response('ok') : upgraded });
  const response = await f.server.fetch(new Request('https://preview.example/api/ws?v=test', { headers: { Upgrade: 'websocket', Cookie: 'tn_session=test' } }));
  assert.equal(response, upgraded);
  assert.equal(f.requests.at(-1).headers.get('Upgrade'), 'websocket');
});

test('missing secrets and unhealthy startup fail closed, and a later request can retry', async () => {
  for (const env of [{ DATABASE_URL: '' }, { SESSION_SECRET: 'short' }]) {
    const f = await fixture({ env });
    assert.equal((await f.server.fetch(new Request('https://preview.example/'))).status, 503);
    assert.equal(f.starts.length, 0);
  }
  let healthy = false;
  const f = await fixture({ fetcher: async () => new Response('health', { status: healthy ? 200 : 503 }) });
  const response = await f.server.fetch(new Request('https://preview.example/api/register', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(f.requests.length, 50);
  assert.ok(f.requests.every(r => typeof r === 'string'));
  healthy = true;
  assert.equal((await f.server.fetch(new Request('https://preview.example/'))).status, 200);
});

test('a failed POST is never replayed automatically', async () => {
  let writes = 0;
  const f = await fixture({ fetcher: async request => {
    if (typeof request === 'string') return new Response('ok');
    writes++;
    throw Error('upstream failed');
  } });
  const response = await f.server.fetch(new Request('https://preview.example/api/register', { method: 'POST', body: '{}' }));
  assert.equal(response.status, 503);
  assert.equal(writes, 1);
  assert.equal(f.server.ready, false);
});

for (const database of ['memory', ...(process.env.PG_TEST_URL ? ['postgres'] : [])]) {
  test(`proxy integrates with production cookies, origin checks and game WebSocket (${database})`, async t => {
    const store = database === 'postgres' ? new PostgresStore(process.env.PG_TEST_URL) : new MemoryStore();
    await store.init();
    const app = createApp({ store, secret, production: true, build: 'cf-test' });
    const http = app.listen(0, '127.0.0.1');
    await once(http, 'listening');
    const realtime = mountRealtime(http, { store, secret, production: true, build: 'cf-test' });
    const base = `http://127.0.0.1:${http.address().port}`, sockets = [];
    t.after(async () => {
      for (const ws of sockets) ws.terminate();
      await realtime.close();
      http.closeAllConnections();
      await new Promise(resolve => http.close(resolve));
      await store.close();
    });
    const f = await fixture({ fetcher: async request => {
      if (typeof request === 'string') return fetch(base + '/healthz');
      const path = new URL(request.url), headers = Object.fromEntries(request.headers);
      if (headers.upgrade === 'websocket') {
        const ws = new WebSocket(base.replace('http:', 'ws:') + path.pathname + path.search, { headers });
        ws.messages = [];
        ws.on('message', raw => ws.messages.push(JSON.parse(raw.toString())));
        sockets.push(ws);
        await once(ws, 'open');
        return { status: 101, webSocket: ws };
      }
      const body = request.body ? Buffer.from(await request.arrayBuffer()) : undefined;
      return new Promise((resolve, reject) => {
        const outgoing = httpRequest(base + path.pathname + path.search, { method: request.method, headers }, incoming => {
          const chunks = [];
          incoming.on('data', chunk => chunks.push(chunk));
          incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), {
            status: incoming.statusCode,
            headers: Object.fromEntries(Object.entries(incoming.headers).filter(([, value]) => value !== undefined).map(([name, value]) => [name, Array.isArray(value) ? value.join(', ') : value]))
          })));
          incoming.on('error', reject);
        });
        outgoing.on('error', reject);
        outgoing.end(body);
      });
    } });
    const call = (path, body, cookie = '', origin = 'https://preview.example') => f.server.fetch(new Request('https://preview.example' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.5' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    }));
    const guest = await call('/api/guest', {});
    assert.equal(guest.status, 201);
    assert.match(guest.headers.get('set-cookie'), /Secure/);
    const accountId = (await guest.json()).account.id;
    const cookie = guest.headers.get('set-cookie').split(';')[0];
    const response = await call('/api/characters', { name: 'Cf' + Date.now().toString(36), jobId: 'swordsman' }, cookie);
    assert.equal(response.status, 201);
    const character = (await response.json()).character;
    assert.equal((await call(`/api/characters/${character.id}/select`, {}, cookie)).status, 200);
    assert.equal((await call('/api/me', undefined, cookie)).status, 200);
    assert.equal((await call('/api/guest', {}, cookie, 'https://evil.example')).status, 403);
    const connect = async origin => {
      const result = await f.server.fetch(new Request('https://preview.example/api/ws?v=cf-test&area=meadow-01', { headers: {
        Upgrade: 'websocket', Cookie: cookie, Origin: origin, 'CF-Connecting-IP': '203.0.113.5'
      } }));
      assert.equal(result.status, 101);
      return result.webSocket;
    };
    const until = async (ws, type) => {
      for (let i = 0; i < 100; i++) {
        const message = ws.messages.find(m => m.t === type);
        if (message) return message;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw Error('Missing WebSocket message: ' + type);
    };
    const denied = await connect('https://evil.example');
    assert.equal((await once(denied, 'close'))[0], 4403);
    const ws = await connect('https://preview.example');
    await until(ws, 'welcome');
    ws.send(JSON.stringify({ t: 'spawnReady' }));
    await until(ws, 'snap');
    ws.close();
    await once(ws, 'close');
    const reconnected = await connect('https://preview.example');
    await until(reconnected, 'welcome');
    assert.equal((await call(`/api/characters/${character.id}/progress`, { gold: 999999 }, cookie)).status, 410);
    assert.equal((await store.character(accountId, character.id)).gold, character.gold);
  });
}
