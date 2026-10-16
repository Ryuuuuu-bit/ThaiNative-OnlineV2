import{spawnSync}from'node:child_process';import{resolve}from'node:path';import{writeFileSync,readFileSync,readdirSync}from'node:fs';
const build=process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||new Date().toISOString().slice(0,10);
const result=spawnSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build','meadow-3d'],{stdio:'inherit',env:{...process.env,VITE_BUILD_ID:build}});
if(result.status!==0)process.exit(result.status||1);writeFileSync('meadow-3d/dist/build.json',JSON.stringify({build})+'\n');
// Social crawlers require absolute artwork URLs; Railway supplies its public domain.
const origin=process.env.PUBLIC_SITE_URL||(process.env.RAILWAY_PUBLIC_DOMAIN?'https://'+process.env.RAILWAY_PUBLIC_DOMAIN:'');
if(origin){const base=new URL(origin).origin;for(const file of readdirSync('meadow-3d/dist').filter(f=>f.endsWith('.html'))){const path=resolve('meadow-3d/dist',file);writeFileSync(path,readFileSync(path,'utf8').replaceAll('content="/assets/brand/og-image-v1.jpg"','content="'+base+'/assets/brand/og-image-v1.jpg"'));}}
