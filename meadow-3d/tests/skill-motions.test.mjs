import test from 'node:test';
import assert from 'node:assert/strict';
import {SKILL_MOTIONS,SKILL_FRAMES,CONTACT_FRAME,skillFrame,earthHeight} from '../src/skill-motions.ts';
import {CombatFeel,AutoQuality} from '../src/combat-feel.ts';
test('zero-cast contacts are immediate; Earth Break lands on frame seven at the existing cast time',()=>{
 for(const id of SKILL_MOTIONS.filter(id=>id!=='earth_break'))assert.equal(skillFrame(id,0),CONTACT_FRAME[id]);
 assert.equal(skillFrame('earth_break',.399),5);assert.equal(skillFrame('earth_break',.4),6);
 assert.equal(earthHeight(.4),0);assert.ok(earthHeight(.25)>1);
 for(const id of SKILL_MOTIONS)for(let t=0;t<1;t+=1/60)assert.ok(skillFrame(id,t)<SKILL_FRAMES[id]);
});
test('visual holds use wall time, affect only attacker and target, and respect opt out/reduced motion',()=>{
 global.matchMedia=()=>({matches:true});global.localStorage={getItem:()=>null,setItem(){}};
 const feel=new CombatFeel(),p={x:0,z:0};
 feel.event({type:'hit',playerId:'own',id:7,x:1,z:0},'own',p,100);
 assert.equal(feel.frozen('own',139),true);assert.equal(feel.frozen('own',140),false);assert.equal(feel.frozen('monster:8',110),false);
 feel.event({type:'hit',playerId:'own',id:7,x:1,z:0,crit:true},'own',p,200);
 assert.equal(feel.frozen('own',279),true);assert.equal(feel.frozen('own',280),false);
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
