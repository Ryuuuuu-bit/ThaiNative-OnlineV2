import{spawnSync}from'node:child_process';import{resolve}from'node:path';import{writeFileSync,readFileSync,readdirSync}from'node:fs';
import{gzipSync,brotliCompressSync,constants}from'node:zlib';
const build=process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||new Date().toISOString().slice(0,10);
const result=spawnSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build','meadow-3d'],{stdio:'inherit',env:{...process.env,VITE_BUILD_ID:build}});
if(result.status!==0)process.exit(result.status||1);
// Reject accidental reintroduction of the retired 3D client before publishing.
const assets='meadow-3d/dist/assets',js=readdirSync(assets).filter(f=>f.endsWith('.js'));
const gameMain=js.find(f=>/^main-[\w-]+\.js$/.test(f));
if(!gameMain||!readFileSync(assets+'/'+gameMain,'utf8').includes("renderer:\"Canvas2D\""))throw Error('Release requires the Canvas2D game entry');
if(js.some(f=>readFileSync(assets+'/'+f,'utf8').includes('WebGLRenderer')))throw Error('Retired WebGL renderer detected in release');
writeFileSync('meadow-3d/dist/build.json',JSON.stringify({build})+'\n');
// Social crawlers require absolute artwork URLs; Railway supplies its public domain.
const origin=process.env.PUBLIC_SITE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
if(origin){const base=new URL(origin).origin;for(const file of readdirSync('meadow-3d/dist').filter(f=>f.endsWith('.html'))){const path=resolve('meadow-3d/dist',file);writeFileSync(path,readFileSync(path,'utf8').replaceAll('content="/assets/brand/og-image-v1.jpg"','content="'+base+'/assets/brand/og-image-v1.jpg"'));}}
const main=readdirSync('meadow-3d/dist/assets').find(f=>/^main-[\w-]+\.js$/.test(f));if(main){const path='meadow-3d/dist/play.html';writeFileSync(path,readFileSync(path,'utf8').replace('</head>',`<link rel="modulepreload" href="/assets/${main}"></head>`));}
function compressTree(dir){for(const file of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,file.name);if(file.isDirectory())compressTree(path);else if(/\.(?:html|js|css|json|wasm)$/.test(file.name)){const input=readFileSync(path);writeFileSync(path+'.gz',gzipSync(input,{level:9}));writeFileSync(path+'.br',brotliCompressSync(input,{params:{[constants.BROTLI_PARAM_QUALITY]:9}}));}}}compressTree('meadow-3d/dist');
