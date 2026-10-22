import test from 'node:test';import assert from 'node:assert/strict';
import {loadGameData,createGame,spawn,step,action,walkable,LAYOUTS,revive,type MapId} from '../src/index.node.js';
import {ENDGAME_REGIONS,isEndgameEnemy} from '../src/game/endgame-combat.js';
const data=loadGameData();
function fixture(id:string){
 const m=data.monsters.monsters.find(m=>m.id===id)!,map=m.tags[0] as MapId,g=createGame(2269,{...data.stats.defaultBuild,level:m.level},'qa',data,map);g.enemies=[];g.random=()=>0;
 let point:{x:number;z:number}|undefined;
 for(let z=-60;z<=60&&!point;z+=4)for(let x=-60;x<=60&&!point;x+=4)if(Array.from({length:16},(_,i)=>i/16*Math.PI*2).every(a=>walkable(x+Math.cos(a)*6,z+Math.sin(a)*6,.6,map))&&walkable(x,z,.6,map))point={x,z};
 assert.ok(point,map+' open test patch');
 if(id==='confluence_worldcore_sovereign')for(const guard of data.monsters.monsters.filter(v=>v.tags[0]==='confluence'&&!v.boss)){const gate=spawn(g,point.x+20,point.z,false,'pink',false,guard.id);gate.dead=true;gate.rewarded=true;gate.respawn=1800;}
 const e=spawn(g,point.x,point.z,m.boss,'pink',false,id);g.p.x=point.x;g.p.z=point.z+2;g.p.god=true;
 return{g,e};
}
test('all52 original endgame species have authoritative, readable fixed warnings',()=>{
 const species=data.monsters.monsters.filter(m=>isEndgameEnemy(m.id));assert.equal(species.length,52);
 for(const m of species){const{g,e}=fixture(m.id);for(let i=0;i<60&&!g.events.some(v=>v.type==='warning');i++)step(g,.05);
  const warnings=g.events.filter(v=>v.type==='warning');assert.ok(warnings.length,m.id);assert.ok(e.telegraph,m.id);
  const warning=warnings[0];assert.ok(warning.duration>=1,m.id);assert.equal(warning.x,e.telegraph.x,m.id);assert.equal(warning.z,e.telegraph.z,m.id);
  const fixed={x:e.telegraph.x,z:e.telegraph.z,fx:e.telegraph.fx,fz:e.telegraph.fz};g.p.x+=1;step(g,.05);assert.deepEqual({x:e.telegraph!.x,z:e.telegraph!.z,fx:e.telegraph!.fx,fz:e.telegraph!.fz},fixed,m.id+' does not track target during windup');
 }
});
test('destroying a real focus weakens its parent attack and gives no kill, EXP, gold or loot',()=>{
 const{g,e}=fixture('dragon_bell_drake');for(let i=0;i<20&&!e.endgame?.action;i++)step(g,.05);
 const focus=g.enemies.find(v=>v.endgame?.focus)!;assert.ok(focus);const xp=g.p.xp,gold=g.p.gold,kills=g.p.kills;
 g.p.x=focus.x;g.p.z=focus.z+.8;g.p.target=focus.id;g.p.stats.atk=1e6;g.p.stats.hit=10000;g.p.cd.attack=0;
 assert.ok(action(g,'attack'));assert.ok(focus.dead);assert.equal(e.endgame?.broken,1);
 for(let i=0;i<80;i++)step(g,.05);
 assert.equal(g.p.kills,kills);assert.equal(g.kills,0);assert.equal(g.p.xp,xp);assert.equal(g.p.gold,gold);assert.ok(!g.drops.some(d=>d.ownerId===g.p.id));assert.ok(g.events.some(v=>v.type==='hazardDestroyed'));assert.ok(!g.events.some(v=>v.type==='kill'));
});
test('each regional boss has phase2 damage metadata for exactly its own scripted actions',()=>{
 for(const region of ENDGAME_REGIONS){const boss=data.monsters.monsters.find(m=>m.tags[0]===region&&m.boss)!;assert.ok(boss);assert.ok(boss.phase2);assert.ok(boss.telegraphs!.length<=4);for(const t of boss.telegraphs!)assert.ok(t.phase2Percent>=t.percent);}
});
test('regional bosses recover and repeat their patterns for a sustained fight',()=>{
 const{g,e}=fixture('dragon_cloud_dragon_lord');for(let i=0;i<600;i++)step(g,.05);
 const warnings=g.events.filter(v=>v.type==='warning'&&v.id===e.id);assert.ok(warnings.some(v=>v.attack==='endgame_focus'));assert.ok(warnings.some(v=>v.attack==='endgame_fan'));assert.ok(warnings.filter(v=>v.attack==='endgame_focus').length>=6);assert.equal(e.dead,false);
});
test('worldcore opens only after all three guardians and changes mechanics at66% and33% HP',()=>{
 const{g,e}=fixture('confluence_worldcore_sovereign');step(g,.05);assert.equal(e.endgame!.action!.pattern.kind,'focus');
 e.hp=e.maxHp*.6;step(g,.05);for(let i=0;i<40;i++)step(g,.05);assert.equal(e.endgame!.coreStage,1);assert.equal(e.endgame!.action!.pattern.kind,'cross');
 e.hp=e.maxHp*.25;step(g,.05);for(let i=0;i<40;i++)step(g,.05);assert.equal(e.endgame!.coreStage,2);assert.equal(e.endgame!.action!.pattern.kind,'ring');
 const guard=g.enemies.find(v=>v.dataId==='confluence_life_pillar_guard')!;guard.dead=false;guard.hp=guard.maxHp;step(g,.05);assert.equal(e.hp,e.maxHp);assert.equal(e.telegraph,undefined);
});

test('a boss accepts one brief interrupt then resists repeated hard control for15 seconds',()=>{
 const{g,e}=fixture('dragon_cloud_dragon_lord');g.p.skills.earth_break=1;g.p.stats.hit=100000;g.p.maxMp=g.p.mp=1000;e.hp=e.maxHp=10000000;
 const cast=()=>{Object.assign(g.p,{x:e.x,z:e.z+2,target:e.id,hurt:0,castRemaining:0});g.p.cd.earth_break=0;assert.ok(action(g,'earth_break'));for(let i=0;i<12;i++)step(g,.05);};
 cast();const until=e.controlImmuneUntil!;assert.ok(until>=15&&until<16);assert.ok(e.statuses.some(s=>(s.id==='stun'||s.id==='knockup')&&s.remaining<=.7));
 e.statuses=[];g.time=1;cast();assert.ok(!e.statuses.some(s=>s.id==='stun'||s.id==='knockup'));assert.equal(e.controlImmuneUntil,until);
 g.time=until+.1;cast();assert.ok(e.controlImmuneUntil!>until+15);assert.ok(e.statuses.some(s=>s.id==='knockup'||s.id==='stun'));
});

test('Worldcore revive returns to a real safe camp without reviving completed guardians',()=>{
 const{g,e}=fixture('confluence_worldcore_sovereign'),guards=g.enemies.filter(v=>!v.boss&&!v.summoned);g.p.dead=true;g.p.hp=0;g.p.reviveRemaining=0;revive(g);
 assert.equal(g.p.dead,false);assert.equal(g.p.mapId,'confluence');assert.ok(LAYOUTS.confluence.camps.some(c=>c.x===g.p.x&&c.z===g.p.z));assert.ok(walkable(g.p.x,g.p.z,.4,'confluence'));assert.ok(guards.every(v=>v.dead));
 assert.ok(Math.hypot(g.p.x-e.homeX,g.p.z-e.homeZ)>18);
});
