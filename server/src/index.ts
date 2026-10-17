import {installShutdown} from './shutdown.js';
import {mountRealtime} from './realtime/index.js';
import{createApp}from'./app.js';import{MemoryStore}from'./store/memory.js';import{PostgresStore}from'./store/postgres.js';
import{readFile}from'node:fs/promises';import{resolve}from'node:path';
// Any Railway environment counts as production: Secure cookies, a required strong SESSION_SECRET, no MemoryStore.
const production=process.env.NODE_ENV==='production'||!!(process.env.RAILWAY_ENVIRONMENT_ID||process.env.RAILWAY_PROJECT_ID||process.env.RAILWAY_SERVICE_ID);
if(production&&!process.env.SESSION_SECRET)throw Error('SESSION_SECRET required in production');if(production&&process.env.SESSION_SECRET!.length<32)throw Error('SESSION_SECRET must be at least 32 characters in production');
if(production&&!process.env.DATABASE_URL&&process.env.ALLOW_MEMORY_STORE!=='1')throw Error('DATABASE_URL required in production (MemoryStore loses every account on restart; set ALLOW_MEMORY_STORE=1 to override)');
const store=process.env.DATABASE_URL?new PostgresStore(process.env.DATABASE_URL):new MemoryStore();
await store.init();const port=Number(process.env.PORT||8787),staticDir=process.env.STATIC_DIR||'meadow-3d/dist';let built='dev';try{built=JSON.parse(await readFile(resolve(staticDir,'build.json'),'utf8')).build;}catch{}
let realtime:ReturnType<typeof mountRealtime>;const adminIds=(process.env.ADMIN_IDS||'').split(',').filter(Boolean);const build=process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||built;
const app=createApp({store,adminIds,realtimeHealthy:()=>realtime?.healthy()??false,realtimeMetrics:()=>realtime?.metrics(),googleClientId:process.env.GOOGLE_CLIENT_ID,secret:process.env.SESSION_SECRET,production,build:process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||built,staticDir});
const server=app.listen(port,'0.0.0.0',()=>console.log(`ThaiNative on :${port} · ${process.env.DATABASE_URL?'Postgres':'memory (temporary)'}`));
realtime=mountRealtime(server,{store,build,secret:process.env.SESSION_SECRET,sharedRooms:process.env.SHARED_ROOMS==='1',production,devJobExpMultiplier:Number(process.env.UAT_JOB_EXP_MULTIPLIER||1),adminIds});
installShutdown(process,async()=>{await realtime.close();await new Promise<void>(r=>server.close(()=>r()));await store.close();});
