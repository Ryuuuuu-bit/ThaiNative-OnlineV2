import {mountRealtime} from './realtime/index.js';
import{createApp}from'./app.js';import{MemoryStore}from'./store/memory.js';import{PostgresStore}from'./store/postgres.js';
import{readFile}from'node:fs/promises';import{resolve}from'node:path';
const store=process.env.DATABASE_URL?new PostgresStore(process.env.DATABASE_URL):new MemoryStore();
await store.init();const port=Number(process.env.PORT||8787),staticDir=process.env.STATIC_DIR||'meadow-3d/dist';let built='dev';try{built=JSON.parse(await readFile(resolve(staticDir,'build.json'),'utf8')).build;}catch{}
let realtime:ReturnType<typeof mountRealtime>;const adminIds=(process.env.ADMIN_IDS||'').split(',').filter(Boolean);const build=process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||built;
const app=createApp({store,adminIds,realtimeMetrics:()=>realtime?.metrics(),googleClientId:process.env.GOOGLE_CLIENT_ID,secret:process.env.SESSION_SECRET,production:process.env.NODE_ENV==='production',build:process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0,8)||process.env.VITE_BUILD_ID||built,staticDir});
const server=app.listen(port,'0.0.0.0',()=>console.log(`ThaiNative on :${port} · ${process.env.DATABASE_URL?'Postgres':'memory (temporary)'}`));
realtime=mountRealtime(server,{store,build,secret:process.env.SESSION_SECRET,sharedRooms:process.env.SHARED_ROOMS==='1',adminIds});
for(const signal of ['SIGTERM','SIGINT'] as const)process.once(signal,()=>{void realtime.close().then(()=>server.close(()=>{void store.close().then(()=>process.exit(0));}));setTimeout(()=>process.exit(1),10000).unref();});
