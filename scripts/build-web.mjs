import{spawnSync}from'node:child_process';import{resolve}from'node:path';import{writeFileSync}from'node:fs';
const build=process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||new Date().toISOString().slice(0,10);
const result=spawnSync(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build','meadow-3d'],{stdio:'inherit',env:{...process.env,VITE_BUILD_ID:build}});
if(result.status!==0)process.exit(result.status||1);writeFileSync('meadow-3d/dist/build.json',JSON.stringify({build})+'\n');
