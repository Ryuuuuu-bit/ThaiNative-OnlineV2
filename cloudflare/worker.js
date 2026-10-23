import { DurableObject } from 'cloudflare:workers';

export class GameServer extends DurableObject {
  ready = false;
  starting;

  async startAndWait() {
    const container = this.ctx.container;
    if (!container.running) {
      if (!this.env.DATABASE_URL || (this.env.SESSION_SECRET?.length ?? 0) < 32) {
        throw new Error('Configure preview DATABASE_URL and SESSION_SECRET before starting');
      }
      const env = { NODE_ENV: 'production', DATABASE_URL: this.env.DATABASE_URL, SESSION_SECRET: this.env.SESSION_SECRET };
      for (const name of ['GOOGLE_CLIENT_ID', 'ADMIN_IDS', 'SHARED_ROOMS', 'UAT_JOB_EXP_MULTIPLIER']) {
        if (this.env[name] !== undefined) env[name] = this.env[name];
      }
      container.start({ enableInternet: true, env });
    }
    // Longer than the server's 60-second disconnected-room retention window.
    await container.setInactivityTimeout(15 * 60 * 1000);
    const port = container.getTcpPort(8787);
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await port.fetch('http://container/healthz', { signal: AbortSignal.timeout(1000) });
        await response.body?.cancel();
        if (response.ok) { this.ready = true; return; }
      } catch {}
      await scheduler.wait(200);
    }
    throw new Error('Game server did not become healthy');
  }

  async fetch(request) {
    try {
      if (!this.ready || !this.ctx.container.running) {
        this.starting ??= this.startAndWait().finally(() => { this.starting = undefined; });
        await this.starting;
      }
      const url = new URL(request.url), headers = new Headers(request.headers);
      // Node trusts one proxy hop; replace client-supplied forwarding headers.
      headers.set('Host', url.host);
      headers.set('X-Forwarded-Host', url.host);
      headers.set('X-Forwarded-Proto', url.protocol.slice(0, -1));
      headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || 'unknown');
      headers.delete('Forwarded');
      url.protocol = 'http:';
      url.port = '';
      url.host = 'container';
      const forwarded = new Request(url, request);
      const response = await this.ctx.container.getTcpPort(8787).fetch(new Request(forwarded, { headers }));
      return response;
    } catch {
      this.ready = false;
      return new Response('Game server temporarily unavailable', {
        status: 503, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' }
      });
    }
  }
}

export default {
  fetch(request, env) {
    // One Node process owns rooms, parties and trades, matching the existing server.
    return env.GAME.getByName('game').fetch(request);
  }
};
