import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,setAuto,step,loadGameData,MAP_IDS,MAP_ENTRY,LAYOUTS,huntList,DEFAULT_AUTO,AutoSettingsSchema,isField} from '../src/index.node.js';

const data=loadGameData();
for(const map of MAP_IDS.filter(isField)){
 if(LAYOUTS[map].exploration)continue;
 for(const selected of [false,true])test(`${map}: AUTO hunts native monsters from the entrance with ${selected?'a selected species':'default settings'}`,()=>{
  const g=createGame(23,{...data.stats.defaultBuild,level:100},'auto-map-test',data,map);
  // Freeze enemy movement and prevent death: pursuit must work without enemies coming to the player.
  Object.assign(g.p,MAP_ENTRY[map],{god:true,skills:{basic:1},hotbar:[]});
  Object.assign(g.p.stats,{hit:1e6,atk:10000});
  const species=g.enemies.find(e=>!e.boss)!.dataId;
  const list=huntList(map,data);
  assert.ok(list.some(m=>m.id===species),'native species is available in AUTO settings');
  if(selected){
   g.p.autoCfg={...DEFAULT_AUTO,attackers:false,mobs:{[map]:[species]}};
   assert.ok(AutoSettingsSchema.safeParse(g.p.autoCfg).success);
  }
  const frozen=g.enemies.map(e=>({e,x:e.x,z:e.z}));
  setAuto(g,true);assert.equal(g.p.auto,true);
  let hit=false;
  for(let tick=0;tick<900&&!hit;tick++){
   for(const {e,x,z} of frozen)Object.assign(e,{x,z,wx:x,wz:z,cooldown:999,wander:999});
   step(g,1/30);
   const damaged=g.enemies.filter(e=>(e.damageBy[g.p.id]??0)>0);
   if(selected)assert.ok(damaged.every(e=>e.dataId===species),'only the selected species is attacked');
   hit=damaged.length>0;
  }
  assert.ok(hit,`${map}: AUTO reaches and damages a native monster within 30 seconds`);
 });
}
