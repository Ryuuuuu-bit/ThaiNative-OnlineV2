// Local, disposable fixture: uses the real HTTP/WebSocket server and MemoryStore only.
import express from 'express';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createApp} from '../src/app.js';
import {MemoryStore} from '../src/store/memory.js';
import {sessions} from '../src/session.js';
import {mountRealtime} from '../src/realtime/index.js';
import {installShutdown} from '../src/shutdown.js';
import {loadGameData,MASTERY_SCHOOLS,validateHotbar} from '@the-beginning-online/shared';

assert(!process.env.RAILWAY_ENVIRONMENT_ID&&process.env.NODE_ENV!=='production','Local trial only');
const staticDir=resolve(process.env.STATIC_DIR||'meadow-3d/dist');
const {build}=JSON.parse(await readFile(resolve(staticDir,'build.json'),'utf8'));
const data=loadGameData(),store=new MemoryStore();await store.init();
const session=sessions(store,{}),app=express();let realtime:ReturnType<typeof mountRealtime>;
app.get('/trial',async(req,res,next)=>{try{
 const a=await store.createGuest(randomUUID()),tag=randomUUID().slice(0,6);
 const gender=req.query.gender==='female'?'female':'male';
 const c=await store.createCharacter(a.id,'เงาทดลอง'+tag,'shadow-'+tag,'swordsman',gender);
 Object.assign(c,{level:12,mapId:'meadow',posX:0,posZ:4,autoAllocate:false,skillPoints:0,baseStats:{str:10,agi:10,vit:8,int:25,dex:20,luk:1}});
 c.masteries=Object.fromEntries(MASTERY_SCHOOLS.map(s=>[s,75])) as typeof c.masteries;
 c.skills={basic:1,dodge:1,potion:1,archer_01:1,mage_01:1,mage_04:1,healer_01:1,healer_03:1,shield_bash:1,endure:1};
 c.hotbar=c.hotbar!.map((s,i)=>({...s,skill:['basic','archer_01','mage_01','healer_01','shield_bash','endure','dodge','potion','mage_04','healer_03'][i],...(i>=8?{mode:'autoSpell' as const}:{})}));
 validateHotbar(c as any,c.hotbar,data);await store.saveProgress(a.id,c.id,c);
 await store.inventory(a.id,c.id);
 // Seed disposable inventory once; later swaps use the normal validated inventory messages.
 const inv=(store as any).inventories.get(c.id);
 for(const template of ['bamboo_bow','wood_shield']){
  assert(data.items.items.some(i=>i.id===template));
  inv.items.push({id:randomUUID(),template,qty:1,location:template==='wood_shield'?'equip':'bag',slot:template==='wood_shield'?'shield':null,refine:0,cards:[],bound:false,source:'local-shadow-trial'});
 }
 await session.issue(req,res,a.id,c.id);res.redirect('/play.html');
}catch(e){next(e);}});
app.use(createApp({store,build,staticDir,realtimeHealthy:()=>realtime?.healthy()??false}));
const server=app.listen(5202,'localhost',()=>console.log('Shadow combat trial: http://localhost:5202/trial'));
realtime=mountRealtime(server,{store,build});
installShutdown(process,async()=>{await realtime.close();await new Promise<void>(r=>server.close(()=>r()));await store.close();});
