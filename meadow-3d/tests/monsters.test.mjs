import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,spawn,step,action,revive,KING_PATTERN} from '@thainative/shared';
import {monsterFrame,monsterCell,monsterOpacity,VARIANT_HUE} from '../src/monster-animation.ts';
const tick=(g,seconds)=>{for(let t=0;t<seconds;t+=1/120)step(g,1/120);};
function encounter(){const g=createGame();g.random=()=>.5;g.enemies=[];g.p.x=0;g.p.z=0;g.p.invulnerable=100;const e=spawn(g,0,2,true);return{g,e};}
test('small jelly warns before one lunge and holds its final death puddle before loot',()=>{
 const g=createGame();g.random=()=>.5;g.enemies=[];g.p.x=g.p.z=0;const e=spawn(g,0,.9);e.cooldown=0;step(g,1/120);assert.equal(e.motion,'attack');assert.ok(g.events.some(e=>e.type==='warning'));tick(g,.45);assert.equal(g.p.hp,126);tick(g,.23);assert.equal(g.events.filter(e=>e.type==='hurt').at(-1).amount,8);assert.ok(g.p.hp>=118&&g.p.hp<118.2);tick(g,.15);assert.equal(g.events.filter(e=>e.type==='hurt').at(-1).amount,8);assert.ok(g.p.hp>=118&&g.p.hp<118.2);
 e.hp=1;g.p.cd.earth_break=0;action(g,'earth_break');tick(g,.45);assert.equal(e.motion,'death');assert.equal(g.drops.length,0);tick(g,.7);assert.equal(e.rewarded,false);tick(g,.1);assert.equal(e.rewarded,true);assert.equal(monsterFrame('slime','death',9),2);assert.equal(monsterOpacity(e),1);tick(g,1.4);assert.equal(monsterOpacity(e),0);
});
test('king cycles all five attacks, stuns after slam, spits three projectiles and summons three',()=>{
 const {g,e}=encounter();let stun=false,volley=false,summons=false;
 for(let i=0;i<4000&&!summons;i++){g.p.x=e.x;g.p.z=e.z+2;step(g,1/120);if(e.motion==='stun')stun=true;if(g.projectiles.length===3)volley=true;if(g.events.some(v=>v.type==='summon'))summons=true;}
 assert.deepEqual(e.history.slice(0,5),KING_PATTERN);assert.ok(stun);assert.ok(volley);assert.ok(summons);assert.equal(g.enemies.filter(m=>m.summoned).length,3);
});
test('king telegraph causes no early slam damage and phase two transforms once and accelerates',()=>{
 const {g,e}=encounter();g.p.invulnerable=0;while(e.motion!=='slam')step(g,1/120);tick(g,.8);assert.equal(g.p.hp,126);tick(g,.1);assert.equal(g.events.filter(e=>e.type==='hurt').at(-1).amount,24);assert.ok(g.p.hp>=102&&g.p.hp<102.1);
 e.hp=451;g.p.x=e.x;g.p.z=e.z+1;g.p.cd.earth_break=0;action(g,'earth_break');tick(g,.45);assert.equal(e.bossPhase,2);assert.equal(e.motion,'transform');tick(g,1.4);assert.equal(e.motion,'transform');tick(g,.25);assert.notEqual(e.motion,'transform');
 g.p.cd.earth_break=0;g.p.mp=80;action(g,'earth_break');tick(g,.45);assert.equal(g.events.filter(v=>v.type==='phase2').length,1);
 e.motion='sweep';e.motionTime=0;e.motionDuration=1.2;e.attackApplied=false;tick(g,.5);assert.ok(e.motionTime>.64);revive(g);assert.equal(e.bossPhase,2);assert.equal(g.projectiles.length,0);assert.equal(e.engaged,false);
});
test('king death finishes before victory and summoned jellies never respawn',()=>{
 const{g,e}=encounter();e.hp=1;g.p.cd.earth_break=0;action(g,'earth_break');tick(g,.45);assert.equal(e.dead,true);assert.equal(g.won,false);tick(g,1.7);assert.equal(g.won,false);tick(g,.15);assert.equal(g.won,true);assert.equal(g.events.filter(v=>v.type==='victory').length,1);assert.equal(monsterFrame('king','death',10),5);
 const minion=spawn(g,g.p.x,g.p.z+1,false,'mint',true);minion.hp=1;g.p.cd.earth_break=0;g.p.mp=80;action(g,'earth_break');tick(g,.45);tick(g,13);assert.ok(!g.enemies.includes(minion));
});
test('monster cells use independent timing, four facings and distinct material variants',()=>{
 assert.equal(monsterFrame('king','slam',.54),0);assert.equal(monsterFrame('king','slam',.56),1);assert.equal(monsterFrame('king','slam',.86),2);assert.equal(monsterFrame('king','slam',1.1),3);assert.equal(monsterFrame('slime','idle',1.66),0);
 assert.equal(new Set([[1,0],[-1,0],[0,1],[0,-1]].map(([x,z])=>monsterCell('slime','hop',x,z,0).row)).size,4);assert.equal(new Set(Object.values(VARIANT_HUE)).size,3);
});
test('packed monster manifest has sixteen complete motion atlases and 192 unclipped frames',()=>{
 const root=new URL('../public/assets/monsters-painted/',import.meta.url),manifest=JSON.parse(readFileSync(new URL('manifest.json',root)));let atlases=0,frames=0;
 for(const[species,s]of Object.entries(manifest.species)){assert.deepEqual(s.cellSize,species==='slime'?[384,256]:[768,512]);assert.deepEqual(s.anchor,[.5,.0625]);for(const m of Object.values(s.motions)){
  atlases++;frames+=m.frames*4;assert.equal(m.frameDurations.length,m.frames);assert.ok(Math.abs(m.frameDurations.reduce((a,b)=>a+b)-m.duration)<1e-8);assert.equal(m.holdLast,!m.loop);const png=readFileSync(new URL('../art/texture-sources/monsters-painted/'+m.file,import.meta.url));assert.equal(png.readUInt32BE(16),s.cellSize[0]*m.frames);assert.equal(png.readUInt32BE(20),s.cellSize[1]*4);
  for(const[rowIndex,row]of m.directions.entries()){assert.equal(row.length,m.frames);for(const f of row){const[x,y,right,bottom]=f.bounds;assert.ok(x>=3&&y>=3&&right<=s.cellSize[0]-3&&bottom<=s.cellSize[1]-3);if(rowIndex>=2)assert.equal(f.faceRect,null);}}
  if(species==='king'){const glow=readFileSync(new URL('../art/texture-sources/monsters-painted/'+m.glowMask,import.meta.url));assert.equal(glow.readUInt32BE(16),s.cellSize[0]*m.frames);assert.equal(glow.readUInt32BE(20),s.cellSize[1]*4);}
 }}assert.equal(atlases,16);assert.equal(frames,192);assert.equal(manifest.phase2.hueShift,-.045);assert.ok(manifest.species.king.motions.idle.directions.slice(0,2).every(row=>row.every(f=>f.faceRect&&f.faceRect[2]>100)));const report=JSON.parse(readFileSync(new URL('../art/painted-monsters/packing-report.json',import.meta.url)));assert.deepEqual(report.clippingWarnings,[]);assert.equal(report.phase2FullFrameCopies,0);
});
