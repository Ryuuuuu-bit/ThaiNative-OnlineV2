import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

global.document??={createElement:()=>({getContext:()=>({})})};
const {SkillVfx2D,vfxKind,PALS,DRAW}=await import('../src/skill-vfx-2d.ts');
const {bossPalette,BOSS_PAL,FAMILY}=await import('../src/boss-vfx-2d.ts');
const {BOSS_FAMILY,SIG}=await import('../src/boss-vfx-signature.ts');
const monsters=JSON.parse(readFileSync(new URL('../../shared/data/monsters.json',import.meta.url),'utf8'));
const bosses=(monsters.monsters??Object.values(monsters).flat()).filter(m=>m?.boss);

test('boss telegraphs, blasts and basic attacks are owned by the boss VFX',()=>{
 assert.equal(vfxKind({type:'warning',x:0,z:0,id:1,attack:'jelly_wave'}),'bossTele');
 assert.equal(vfxKind({type:'bossBlast',x:0,z:0,id:1,attack:'jelly_wave'}),'bossBlast');
 assert.equal(vfxKind({type:'slam',x:0,z:0,id:1}),'bossSlam');
 for(const k of ['bossTele','bossBlast','bossSlam','bossSweep','bossSpit'])assert.ok(DRAW[k],k);
});

test('every boss has its own palette and every telegraph a look',()=>{
 for(const b of bosses){
  assert.ok(BOSS_PAL[b.id],`palette for ${b.id}`);assert.ok(PALS[BOSS_PAL[b.id]],`palette ${BOSS_PAL[b.id]} exists`);
  for(const t of b.telegraphs??[]){const sig=BOSS_FAMILY[`${b.id}/${t.id}`];assert.ok(sig?SIG[sig]:FAMILY[t.id],`look for ${b.id}/${t.id}`);}
 }
 assert.equal(bossPalette({attack:'crag_titan_fall'}),'magma');
 assert.equal(bossPalette({dataId:'ocean_stormcrown_kraken',attack:'endgame_focus'}),'storm');
});

test('warnings last their wind-up and a cancel removes them',()=>{
 const vfx=new SkillVfx2D();
 vfx.event({type:'warning',x:0,z:0,id:7,attack:'mist_crush',shape:'circle',r:3,duration:2.4,dataId:'mist_warden'});
 assert.equal(vfx.effects.at(-1).kind,'bossTele');assert.ok(Math.abs(vfx.effects.at(-1).life-2.45)<1e-9);
 assert.equal(vfx.event({type:'warningCancel',id:7}),true);assert.equal(vfx.effects.length,0);
 assert.equal(vfx.event({type:'warningCancel',id:7}),false,'nothing left to cancel falls through to the renderer');
});
