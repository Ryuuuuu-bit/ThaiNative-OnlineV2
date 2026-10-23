import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { WebSocket } from '../server/node_modules/ws/wrapper.mjs';
import { once } from 'node:events';

const base = new URL(process.env.CF_PREVIEW_URL || '');
assert.ok(
  (base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)) ||
  (base.protocol === 'https:' && /^the-beginning-online-preview\.[a-z0-9-]+\.workers\.dev$/.test(base.hostname)),
  'Smoke tests create accounts: use the isolated preview Worker or localhost'
);
let cookie = '';
const call = async (path, body, origin = base.origin) => {
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(30_000),
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const nextCookie = response.headers.get('set-cookie');
  if (nextCookie) cookie = nextCookie.split(';')[0];
  return response;
};
assert.equal((await call('/healthz')).status, 200);
const build = await (await call('/build.json')).json();
assert.equal(typeof build.build, 'string');
assert.equal((await (await call('/api/config')).json()).build, build.build);
if (process.env.CF_EXPECTED_BUILD) assert.equal(build.build, process.env.CF_EXPECTED_BUILD);
for (const page of ['/', '/login.html', '/characters.html', '/play.html']) {
  const response = await call(page);
  assert.equal(response.status, 200, page);
  const html = await response.text();
  const script = html.match(/src="(\/assets\/[^" ]+\.js)"/);
  assert.ok(script, 'Missing built JavaScript on ' + page);
  assert.equal((await call(script[1])).status, 200);
}
assert.equal((await call('/api/guest', {}, 'https://evil.example')).status, 403);
const guest = await call('/api/guest', {});
assert.equal(guest.status, 201);
assert.match(guest.headers.get('set-cookie'), /HttpOnly/i);
assert.match(guest.headers.get('set-cookie'), /Secure/i);
const suffix = randomBytes(4).toString('hex'), username = 'Cf_' + suffix, password = randomBytes(16).toString('hex');
assert.equal((await call('/api/register', { username, password, confirmPassword: password })).status, 201);
const created = await call('/api/characters', { name: 'Cf' + suffix, jobId: 'swordsman' });
assert.equal(created.status, 201);
const character = (await created.json()).character;
assert.equal((await call(`/api/characters/${character.id}/select`, {})).status, 200);
assert.equal((await call('/api/logout', {})).status, 200);
assert.equal((await call('/api/login', { username, password })).status, 200);
assert.equal((await call(`/api/characters/${character.id}/select`, {})).status, 200);
const sockets = [];
function connect(origin) {
  const url = new URL('/api/ws', base);
  url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  url.search = new URLSearchParams({ v: build.build, area: 'meadow-01' }).toString();
  const ws = new WebSocket(url, { handshakeTimeout: 30_000, headers: { Cookie: cookie, Origin: origin } });
  ws.messages = [];
  const timeout = setTimeout(() => ws.terminate(), 30_000);
  ws.closed = new Promise(resolve => ws.once('close', code => { clearTimeout(timeout); resolve(code); }));
  ws.on('error', () => {});
  ws.on('message', raw => ws.messages.push(JSON.parse(raw.toString())));
  sockets.push(ws);
  return ws;
}
async function until(ws, type) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const found = ws.messages.find(message => message.t === type);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('Missing game message: ' + type);
}
try {
  const denied = connect('https://evil.example');
  assert.equal(await denied.closed, 4403);
  const ws = connect(base.origin);
  await once(ws, 'open');
  await until(ws, 'welcome');
  ws.send(JSON.stringify({ t: 'spawnReady' }));
  await until(ws, 'snap');
  ws.close();
  await ws.closed;
  const reconnected = connect(base.origin);
  await until(reconnected, 'welcome');
  assert.equal((await call(`/api/characters/${character.id}/progress`, { gold: 999999 })).status, 410);
  assert.equal((await call(`/api/characters/${character.id}`)).status, 200);
  assert.equal((await call('/api/logout', {})).status, 200);
  console.log(JSON.stringify({ ok: true, build: build.build, checks: ['health', 'assets', 'register', 'login', 'secure-cookie', 'origin', 'websocket', 'snapshots', 'reconnect', 'progress-authority'] }));
} finally {
  for (const ws of sockets) ws.terminate();
}
