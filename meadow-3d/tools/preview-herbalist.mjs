import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
const root=fileURLToPath(new URL('../art/herbalist-v1/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp'};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/preview.html':path));if(!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}if(!(await stat(file)).isFile())throw Error('Not a file');res.writeHead(200,{'content-type':types[extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('Not found');}}).listen(8894,'127.0.0.1',()=>console.log('Herbalist preview: http://localhost:8894/'));
