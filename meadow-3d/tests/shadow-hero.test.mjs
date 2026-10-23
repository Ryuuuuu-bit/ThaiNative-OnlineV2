import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseShadowManifest,shadowPose,ShadowHero,SHADOW_LOOKS,SHADOW_MOTIONS} from '../src/shadow-hero.ts';
import {WALK_DIRECTIONS} from '../src/sprite-animation.ts';
import {createGame,action,step,revive} from '@the-beginning-online/shared';
import {PREVIEW_FACING} from '../src/hero-presentation.ts';
const manifest=()=>parseShadowManifest(JSON.parse(readFileSync(new URL('../public/assets/hero-shadow-8dir-v1/manifest.json',import.meta.url))));
test('combat frames follow event duration, preserve attacks through automatic casts, and keep the selected outfit',()=>{
 const hero=new ShadowHero(manifest());hero.combat=true;hero.playerId='hero';
 const p={id:'hero',fx:1,fz:0,dead:false,hurt:0,moving:false,stats:{weaponType:'bow'}};
 hero.event({type:'bowShot',playerId:'hero'});const a=hero.combatPose(p,.17);assert.equal(a.cell.column,8);assert.match(a.key,/male-bow-attack/);
 hero.event({type:'skill',playerId:'hero',skillId:'mage_01',autoSpell:true,duration:1});assert.equal(hero.action.elapsed,.17);assert.equal(hero.action.motion,'attack');
 assert.equal(hero.combatPose(p,.1).cell.column,12);
 hero.event({type:'skill',playerId:'hero',skillId:'healer_01',duration:.8});assert.match(hero.combatPose(p,.4).key,/male-bow-cast/);
 hero.event({type:'skillCancel',playerId:'hero'});assert.match(hero.combatPose(p,0).key,/idle/);
 hero.outfit='female';p.dead=true;assert.match(hero.combatPose(p,1).key,/female-bow-death/);
 p.dead=false;p.stats.weaponType='sword1h';assert.match(hero.combatPose(p,0).key,/female-iron-idle/);
});

test('reviewed atlases keep transparent gutters and complete source frames for every facing',()=>{
 const reports=JSON.parse(readFileSync(new URL('../public/assets/hero-shadow-8dir-v1/validation.json',import.meta.url)));
 assert.equal(reports.length,224);
 assert.equal(new Set(reports.map(r=>`${r.look}/${r.motion}/${r.direction}`)).size,224);
 for(const r of reports){assert.deepEqual(r.edgeFrames,[]);assert.equal(r.gutter,8);assert.match(r.sourceHash,/^[a-f0-9]{64}$/);}
 for(const look of Object.values(manifest().looks))for(const [motion,clip] of Object.entries(look)){assert.equal(clip.size,256);assert.equal(clip.frames,{hit:4,dodge:4,death:8}[motion]??16);}
});

test('all four looks contain every action and eight distinct authored directions',()=>{
 const data=manifest();
 for(const look of SHADOW_LOOKS)for(const motion of SHADOW_MOTIONS){
  const rows=new Set();
  for(const facing of WALK_DIRECTIONS){const pose=shadowPose(data,look,motion,facing,0);rows.add(pose.cell.row);assert.equal(pose.cell.rows,8);assert.equal(pose.cell.column,0);assert.ok(pose.scale>0);}
  assert.equal(rows.size,8);
  assert.ok(readFileSync(new URL('../public'+data.looks[look][motion].url,import.meta.url)).length>1000);
 }
 const bad=structuredClone(data);delete bad.looks['female-bow'].attack.anchors.N;assert.throws(()=>parseShadowManifest(bad));
 const path=structuredClone(data);path.looks['male-iron'].idle.url='/assets/hero-shadow-8dir-v1/../secret.webp';assert.throws(()=>parseShadowManifest(path));
 const geometry=structuredClone(data);geometry.looks['male-iron'].idle.anchors.N.y=999;assert.throws(()=>parseShadowManifest(geometry));
});

test('direction mapping, action completion, loop wrap and whole-body scale stay consistent',()=>{
 const data=manifest(),hero=new ShadowHero(data);
 for(const facing of WALK_DIRECTIONS){
  const [fx,fz]=PREVIEW_FACING[facing];
  assert.equal(hero.pose('walk',fx,fz,0).cell.row,WALK_DIRECTIONS.indexOf(facing));
  for(const motion of SHADOW_MOTIONS){const clip=data.looks['male-iron'][motion],a=shadowPose(data,'male-iron',motion,facing,0),b=shadowPose(data,'male-iron',motion,facing,clip.seconds*2,false);assert.equal(b.cell.column,clip.frames-1);assert.equal(shadowPose(data,'male-iron',motion,facing,clip.seconds*2).cell.column,0);assert.equal(a.feet,b.feet);assert.equal(a.scale,b.scale);}
 }
 assert.match(hero.pose('death',0,1,0).key,/death/);
 hero.motion='death';hero.clock=10;assert.equal(hero.pose('idle',0,1,0).cell.column,7);
});

test('failed equipment loads preserve current art; successful swaps release only the previous set',async()=>{
 const hero=new ShadowHero(manifest()),released=[];
 const assets={image:async()=>{throw Error('offline');},release:path=>released.push(path)};
 await assert.rejects(hero.load(assets,'female-bow'));assert.equal(hero.look,'male-iron');assert.equal(released.length,0);
 assets.image=async()=>({});await hero.load(assets,'female-bow');assert.equal(hero.look,'female-bow');assert.equal(released.length,SHADOW_MOTIONS.length);assert.ok(released.every(p=>p.includes('male-iron')));
});

test('hurt and dodge track authoritative reactions; death completes once and revival clears it',()=>{
 for(const outfit of ['male','female'])for(const weaponType of ['bow','sword1h']){
  const hero=new ShadowHero(manifest());hero.combat=true;hero.outfit=outfit;
  const p={id:'hero',fx:1,fz:0,dead:false,hurt:0,dash:0,moving:false,stats:{weaponType}};
  hero.combatPose(p,0);hero.event({type:'slash',playerId:'hero'});
  p.hurt=.3;assert.match(hero.combatPose(p,0).key,/-hit-/);assert.equal(hero.action,undefined);
  const row=hero.reaction.facing;p.fx=-1;
  p.hurt=.15;const hit=hero.combatPose(p,.15);assert.ok(hit.cell.column>0);assert.equal(hero.reaction.facing,row);
  hero.event({type:'skill',playerId:'hero',skillId:'mage_04',autoSpell:true});assert.equal(hero.reaction.elapsed,.15);
  p.hurt=0;p.dash=.22;assert.match(hero.combatPose(p,0).key,/-dodge-/);
  p.dash=.1;assert.ok(hero.combatPose(p,.12).cell.column>0);
  p.dash=0;assert.match(hero.combatPose(p,0).key,/-idle-/);
  p.dead=true;assert.equal(hero.combatPose(p,0).cell.column,0);
  const dying=hero.combatPose(p,.55);assert.ok(dying.cell.column>0);
  const last=hero.combatPose(p,2);assert.equal(last.cell.column,last.cell.columns-1);
  assert.deepEqual(hero.combatPose(p,30),last);
  p.dead=false;assert.match(hero.combatPose(p,0).key,/-idle-/);assert.equal(hero.reaction,undefined);
  p.hurt=.3;hero.combatPose(p,0);p.hurt=.1;hero.combatPose(p,.2);p.hurt=.3;assert.equal(hero.combatPose(p,.01).cell.column,0);
 }
});

test('revival UI respects the death animation reveal interval',()=>{
 const source=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
 assert.match(source,/if\(game\.p\.dead&&deathReveal<=0&&\$\('#overlay'\)\.hidden\)showDeath\(\)/);
});


test('real simulation damage, evasion and revival select the authored reactions',()=>{
 const g=createGame();g.enemies=[];g.random=()=>.5;
 const hero=new ShadowHero(manifest());hero.combat=true;hero.combatPose(g.p,0);
 const projectile=damage=>g.projectiles.push({id:90,owner:1,x:g.p.x,z:g.p.z,vx:0,vz:0,life:1,damage,phase:1});
 projectile(5);step(g,1/60,{x:0,z:0});assert.ok(g.p.hurt>0);assert.match(hero.combatPose(g.p,0).key,/-hit-/);
 for(let i=0;i<40;i++)step(g,1/60,{x:0,z:0});
 assert.equal(action(g,'dash'),true);assert.ok(g.p.dash>0);assert.match(hero.combatPose(g.p,0).key,/-dodge-/);
 for(let i=0;i<60;i++)step(g,1/60,{x:0,z:0});
 g.p.hp=1;g.p.cd.potion=10;projectile(999);step(g,1/60,{x:0,z:0});
 assert.equal(g.p.dead,true);assert.match(hero.combatPose(g.p,0).key,/-death-/);
 const final=hero.combatPose(g.p,1.2);assert.equal(final.cell.column,final.cell.columns-1);
 revive(g);assert.equal(g.p.dead,true);
 for(let i=0;i<301;i++)step(g,1/60,{x:0,z:0});
 revive(g);assert.equal(g.p.dead,false);assert.match(hero.combatPose(g.p,0).key,/-idle-/);
});

test('unapproved weapon families keep the existing renderer instead of showing a sword',()=>{
 const hero=new ShadowHero(manifest());hero.combat=true;
 for(const weaponType of ['staff','dagger','fist'])assert.equal(hero.combatPose({id:'hero',fx:1,fz:0,dead:false,hurt:0,moving:false,stats:{weaponType}},0),undefined);
});
