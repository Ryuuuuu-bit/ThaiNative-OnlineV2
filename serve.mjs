// Minimal static server for the built meadow-3d demo (Railway UAT). No dependencies.
import {createServer} from 'node:http';
import {createReadStream, statSync} from 'node:fs';
import {join, extname, normalize, resolve} from 'node:path';

const ROOT = resolve(process.env.STATIC_DIR || 'meadow-3d/dist');
const PORT = Number(process.env.PORT || 8080);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm', '.map': 'application/json', '.txt': 'text/plain; charset=utf-8',
};

function send(res, path, status = 200) {
  const ext = extname(path).toLowerCase();
  const immutable = path.includes(`${join('assets')}`) && /-[A-Za-z0-9_]{6,}\.[a-z0-9]+$/.test(path);
  res.writeHead(status, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  createReadStream(path).pipe(res);
}

createServer((req, res) => {
  if (req.url === '/healthz') { res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('ok'); return; }
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = normalize(join(ROOT, urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  try {
    const st = statSync(file);
    if (st.isDirectory()) { send(res, join(file, 'index.html')); return; }
    send(res, file);
  } catch {
    // Unknown route: serve the game page so deep links still open the demo.
    try { send(res, join(ROOT, 'index.html'), 200); } catch { res.writeHead(404); res.end('not found'); }
  }
}).listen(PORT, '0.0.0.0', () => console.log(`meadow-3d static server on :${PORT} serving ${ROOT}`));
