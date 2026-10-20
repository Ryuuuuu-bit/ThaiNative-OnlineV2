import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILL_V2,SKILL_MOTIONS,SKILL_FRAMES,CONTACT_FRAME,skillFrame,earthHeight,leapHeight,CAST_SECONDS,OWN_ART,preferOwnArt,MULTI_CONTACTS,contactOffset} from '../src/skill-motions.ts';
import {CombatFeel,AutoQuality} from '../src/combat-feel.ts';
test('zero-cast contacts are immediate; Earth Break lands on frame seven at the existing cast time',()=>{
 for(const id of SKILL_MOTIONS.filter(id=>!CAST_SECONDS[id]))assert.equal(skillFrame(id,0),CONTACT_FRAME[id]);
 assert.equal(skillFrame('earth_break',.399),5);assert.equal(skillFrame('earth_break',.4),6);
 assert.equal(earthHeight(.4),0);assert.ok(earthHeight(.25)>1);
 for(const id of SKILL_MOTIONS)for(let t=0;t<1;t+=1/60)assert.ok(skillFrame(id,t)<SKILL_FRAMES[id]);
});
test('visual holds use wall time, affect only attacker and target, and respect opt out/reduced motion',()=>{
 global.matchMedia=()=>({matches:true});global.localStorage={getItem:()=>null,setItem(){}};
 const feel=new CombatFeel(),p={x:0,z:0};
 feel.event({type:'hit',playerId:'own',id:7,x:1,z:0},'own',p,100);
 assert.equal(feel.frozen('own',154),true);assert.equal(feel.frozen('own',155),false);assert.equal(feel.frozen('monster:8',110),false);
 feel.event({type:'hit',playerId:'own',id:7,x:1,z:0,crit:true},'own',p,200);
 assert.equal(feel.frozen('own',294),true);assert.equal(feel.frozen('own',295),false);
 assert.equal(feel.flash(7,259),1);assert.equal(feel.flash(7,260),0);assert.equal(feel.camera(.01),0);
 feel.event({type:'skillImpact',skillId:'earth_break',playerId:'own'},'own',p,300);
 assert.equal(feel.frozen('own',419),true);assert.equal(feel.frozen('own',420),false);
 feel.setEnabled(false);assert.equal(feel.flash(7,310),0);assert.equal(feel.frozen('own',310),false);
});
test('quality steps down once after three slow seconds, with desktop/mobile thresholds',()=>{
 global.innerWidth=1440;const q=new AutoQuality();assert.equal(q.threshold(),45);
 for(let i=0;i<119;i++)assert.equal(q.update(.025,true),false);
 assert.equal(q.update(.026,true),true);assert.equal(q.update(.1,true),false);
 q.reset();global.innerWidth=390;assert.equal(q.threshold(),28);assert.equal(q.update(4,false),false);
});

test('whirlwind contacts frames three and six at split impact times',()=>{assert.equal(skillFrame('whirlwind',0),2);assert.equal(skillFrame('whirlwind',.25),5);});


test('Job 2 cast and leap presentation obey the existing durations',()=>{
 for(let t=0;t<.5;t+=1/600)assert.ok(skillFrame('quake_slam',t)<=5);
 assert.equal(skillFrame('quake_slam',.5),6);
 assert.equal(leapHeight(0),0);assert.equal(leapHeight(.5),0);
 for(let t=-.1;t<1;t+=.001)assert.ok(leapHeight(t)>=0&&leapHeight(t)<=1.1);
});
test('only unreviewed art uses the server-provided visual alias',()=>{
 for(const id of SKILL_MOTIONS){const e={skillId:id,visual:'slash'};assert.equal(preferOwnArt(e).skillId,OWN_ART.has(id)?id:'slash');assert.equal(e.skillId,id);}
});
test('planned multi-hit offsets map to the specified contact frames',()=>{
 for(const [id,contacts] of Object.entries(MULTI_CONTACTS))for(const [i,frame] of contacts.entries())assert.equal(skillFrame(id,contactOffset(id,i)+1e-9),frame);
});

test('Job 2 effects and sounds keep the real id while hero motions stay borrowed until reviewed',async()=>{
 const {MOTION_READY,BORROWED_MOTION,JOB2_MOTIONS}=await import('../src/skill-motions.ts');
 for(const id of [...JOB2_MOTIONS.guardian,...JOB2_MOTIONS.berserker]){
  assert.ok(OWN_ART.has(id),id+' keeps its own VFX and SFX');
  assert.ok(MOTION_READY.has(id)||BORROWED_MOTION[id],id+' has a motion to show');
 }
});

test('8-facing swordsman sheets match their packed sources: frame counts, 8 rows, cell size',async()=>{
 const {readFileSync}=await import('node:fs');
 const meta=JSON.parse(readFileSync(new URL('../art/texture-sources/hero-skills-v2/skills-v2.json',import.meta.url),'utf8'));
 const manifest=JSON.parse(readFileSync(new URL('../public/texture-manifest.json',import.meta.url),'utf8'));
 assert.deepEqual(Object.keys(SKILL_V2).sort(),Object.keys(meta).sort());
 for(const [id,cell] of Object.entries(SKILL_V2)){
  assert.deepEqual(meta[id].cell,[cell.w,cell.h]);assert.equal(meta[id].anchor[1],cell.feet);
  for(const frames of Object.values(meta[id].frames))assert.equal(frames.length,SKILL_FRAMES[id]);
  assert.equal(Object.keys(meta[id].frames).length,8);
  assert.deepEqual(manifest[`/assets/hero-skills/hero-skill-${id}-v2.png`].originalSize,[cell.w*SKILL_FRAMES[id],cell.h*8]);
 }
});
