import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MASTERY_VISUALS,masteryVisualEvent,masteryMotion,masteryStatusArt,summonPose} from '../src/mastery-visuals.ts';
import {MasteryVfx2D} from '../src/mastery-vfx-2d.ts';
import {NetworkWorld} from '../src/net/world.ts';
const catalog=JSON.parse(readFileSync(new URL('../../shared/data/mastery.json',import.meta.url),'utf8'));
test('basic arrow effects keep the authoritative endpoints without inventing damage and reject invalid geometry',()=>{
 const fx=new MasteryVfx2D(),e={type:'bowShot',playerId:'p',x:1,z:2,dx:1,dz:0,targetX:7,targetZ:2};
 assert.equal(fx.event(e),true);assert.deepEqual(fx.effects[0].e,e);assert.equal(fx.effects[0].family,'basic-bow');assert.equal(e.damage,undefined);
 assert.equal(fx.event({...e,dx:NaN}),false);assert.equal(fx.effects.length,1);for(let i=0;i<4;i++)fx.advance(.1);assert.equal(fx.effects.length,0);
});

test('all147 visual contracts distinguish passive, existing sword art and specific active effects',()=>{
 assert.equal(Object.keys(MASTERY_VISUALS).length,147);
 for(const s of catalog.skills){const v=MASTERY_VISUALS[s.id];assert.ok(v.family,s.id);assert.equal(v.passive,s.passive);if(s.passive){assert.equal(v.family,'passive');assert.equal(masteryVisualEvent({type:'skill',skillId:s.id,x:0,z:0}),null);}else if(s.school!=='Swordsman')assert.notEqual(v.family,'legacy-sword');}
 assert.equal(masteryMotion('mage_01'),'cast');assert.equal(masteryMotion('archer_01'),'attack');assert.equal(masteryMotion('slash'),undefined);
 assert.equal(MASTERY_VISUALS.mage_04.family,'ice');assert.equal(MASTERY_VISUALS.rogue_04.family,'smoke');
});

test('canonical IDs survive old visual aliases; damage effects require confirmed server hit events',()=>{
 assert.equal(masteryVisualEvent({type:'skill',skillId:'slash',learnedSkill:'rogue_01',x:1,z:2}).v.id,'rogue_01');
 assert.equal(masteryVisualEvent({type:'skillImpact',skillId:'mage_01',x:1,z:2}).phase,'handled');
 assert.equal(masteryVisualEvent({type:'hit',skillId:'mage_01',x:1,z:2}).phase,'hit');
 assert.equal(masteryVisualEvent({type:'skillImpact',skillId:'mage_03',x:1,z:2}).phase,'impact');
 for(const e of [{type:'hit',skillId:'mage_01',x:NaN,z:0},{type:'notice',skillId:'mage_01',x:0,z:0},{type:'skill',skillId:'not-a-skill',x:0,z:0}])assert.equal(masteryVisualEvent(e),null);
});

test('mastery status feedback uses its own painted icon and Thai name; potion speed remains distinct',()=>{
 assert.equal(masteryStatusArt('magic_shield').name,'ม่านเวท');
 assert.match(masteryStatusArt('archer_mark').file,/^archer_02-/);
 assert.match(masteryStatusArt('speed','archer_04').file,/^archer_04-/);
 assert.equal(masteryStatusArt('speed','potion'),undefined);
 assert.equal(masteryStatusArt('unknown'),undefined);
});

test('recovery ticks and successful displacement use confirmed results without inventing healing or movement',()=>{
 assert.equal(masteryVisualEvent({type:'heal',skillId:'healer_03',x:0,z:4,amount:16}).phase,'impact');
 assert.equal(masteryVisualEvent({type:'heal',skillId:'healer_03',x:0,z:4,amount:0}),null);
 const e={type:'skillDisplace',skillId:'boxer_04',x:3,z:4,fromX:1,fromZ:4,resisted:false};
 assert.equal(masteryVisualEvent(e).phase,'displace');
 assert.equal(masteryVisualEvent({...e,resisted:true}),null);
 assert.equal(masteryVisualEvent({...e,fromX:NaN}),null);
});

test('effects and pet attack clocks are bounded, expire and reset on travel without touching game state',()=>{
 const fx=new MasteryVfx2D(),e={type:'hit',skillId:'archer_01',playerId:'p',id:7,x:1,z:2,amount:42};
 for(let i=0;i<250;i++)fx.event(e);assert.equal(fx.effects.length,fx.max);assert.equal(e.amount,42);
 fx.event({type:'summonAttack',petId:9,playerId:'p',x:0,z:0});assert.equal(fx.petAttacks.get(9),0);
 for(let i=0;i<15;i++)fx.advance(.1);assert.equal(fx.effects.length,0);assert.equal(fx.petAttacks.size,0);
 fx.event(e);fx.clear();assert.deepEqual(fx.snapshot(),{effects:0,skills:[],petAttacks:0});
});

test('guardian attack frame remains synchronized to the real300ms windup',()=>{
 assert.equal(summonPose({state:'chase',attack:0},1).motion,'move');
 assert.equal(summonPose({state:'attack',attack:.3},1,1).time,0);
 assert.ok(Math.abs(summonPose({state:'attack',attack:.1},1.2,1).time-.2)<1e-9);
 assert.equal(summonPose({state:'attack',attack:0},1.3,1).motion,'attack','contact plays after server impact');
 assert.equal(summonPose({state:'attack',attack:0},1.6,1).motion,'idle');
});

test('reduced motion keeps persistent state geometry steady while real effect lifetimes still expire',()=>{
 const fx=new MasteryVfx2D(),calls=[];
 const ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>calls.push([key,...args]),set:()=>true});
 const f={ctx,width:800,height:600,scale:30,highQuality:true,reducedMotion:true,screen:(x,z,h=0)=>({x:400+x*30,y:300+z*15-h*30}),enemy:()=>undefined};
 const p={id:'p',x:0,z:0,fx:1,fz:0,statuses:[{id:'speed',remaining:3},{id:'spirit_intercept',remaining:3}],wisp:{until:5,hitsLeft:3}};
 fx.post(f,[p],[],1);const initial=JSON.stringify(calls);calls.length=0;
 fx.time=1;fx.post(f,[p],[],2);assert.equal(JSON.stringify(calls),initial);
 fx.event({type:'hit',skillId:'mage_01',x:0,z:0});for(let i=0;i<5;i++)fx.advance(.1);assert.equal(fx.effects.length,0);
});

test('smoke fields retain their fixed server origin and disappear when omitted from the next map snapshot',()=>{
 const world=new NetworkWorld(),p={...world.game.p,id:'p',mapId:'meadow',x:0,z:4,hp:100,statuses:[],cd:{}};
 const snap={players:[p],mapId:'meadow',time:1,tick:1,ack:0,enemies:[],drops:[],projectiles:[],kills:0,won:false,bossSpawned:false,smokeFields:[{id:8,ownerId:'p',x:2,z:4,until:3}]};
 world.receive(snap,'p',1000);world.update(1000,0,{x:0,z:0},1);assert.equal(world.game.smokeFields[0].x,2);
 world.receive({...snap,time:2,tick:2,mapId:'forest',smokeFields:[]},'p',2000);world.update(2000,0,{x:0,z:0},2);assert.deepEqual(world.game.smokeFields,[]);
});


test('Mix feedback only follows known server recipes, while persistent fields follow snapshots and cancel independently',()=>{
 const fx=new MasteryVfx2D();assert.equal(fx.event({type:'masteryMix',mixId:'M05',x:0,z:0}),true);assert.equal(fx.effects[0].family,'mix');assert.equal(fx.event({type:'masteryMix',mixId:'fake',x:0,z:0}),false);
 const calls=[],ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):(...args)=>calls.push([key,...args]),set:()=>true});
 const f={ctx,width:800,height:600,scale:30,highQuality:true,screen:(x,z,h=0)=>({x:400+x*30,y:300+z*15-h*30}),enemy:()=>undefined};
 const p={id:'p',x:0,z:0,statuses:[],castRemaining:0,masteryFx:{zones:[{id:7,skillId:'archer_18',x:1,z:2,armed:2,until:5,radius:2.5}]}};
 fx.pre(f,[p],[],1);assert(calls.some(c=>c[0]==='stroke'));calls.length=0;fx.pre(f,[p],[],6);assert.equal(calls.length,0);
 fx.event({type:'skill',skillId:'mage_01',autoSpell:true,duration:.6,playerId:'p',x:0,z:0});fx.pre(f,[{...p,masteryFx:null}],[],1);assert(calls.length>0);calls.length=0;
 fx.event({type:'skillCancel',playerId:'p'});fx.pre(f,[{...p,masteryFx:null}],[],1);assert.equal(calls.length,0);
});


test('poison ticks stay on the defender and confirmed chain impacts use their actual previous target',()=>{
 const fx=new MasteryVfx2D(),rays=[],ctx=new Proxy({}, {get:(_,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{},set:()=>true});fx.ray=(...args)=>rays.push(args);
 const f={ctx,width:800,height:600,scale:30,highQuality:true,screen:(x,z,h=0)=>({x:400+x*30,y:300+z*15-h*30}),enemy:()=>undefined},owner={id:'p',x:0,z:0,statuses:[]};
 fx.event({type:'hit',skillId:'rogue_16',playerId:'p',x:2,z:0,dot:true});fx.post(f,[owner],[],1);assert.equal(rays.length,0);
 fx.clear();fx.event({type:'skillImpact',skillId:'mage_11',playerId:'p',x:3,z:0,fromX:2,fromZ:0,chain:true});fx.post(f,[owner],[],1);assert.deepEqual(rays[0][1],{x:2,z:0});assert.equal(rays[0][2].x,3);
});


test('pet commands prepare the existing attack animation and confirmed pet hits align its contact frame',()=>{
 const fx=new MasteryVfx2D();fx.event({type:'skill',skillId:'shaman_03',playerId:'p',petId:9,duration:.5,x:0,z:0});assert.equal(fx.petAttacks.get(9),.2);
 fx.time=.5;fx.event({type:'hit',skillId:'shaman_03',playerId:'p',petId:9,x:1,z:0});assert.equal(fx.petAttacks.get(9),.2);assert.equal(summonPose({attack:0,state:'attack'},fx.time,fx.petAttacks.get(9)).time,.3);
 fx.event({type:'skillCancel',playerId:'p'});assert.equal(fx.petAttacks.has(9),false);
});

test('passive activations use existing icon/state feedback without becoming cast animations; medical basic needs a confirmed hit',()=>{
 assert.match(masteryStatusArt('speed','archer_08').file,/archer_08-/);assert.match(masteryStatusArt('speed','rogue_08').file,/rogue_08-/);
 assert.equal(masteryMotion('healer_07'),undefined);assert.equal(masteryVisualEvent({type:'masteryPassive',skillId:'mage_15',x:0,z:0}).v.family,'passiveproc');
 assert.equal(masteryVisualEvent({type:'hit',skillId:'basic',visual:'medical_needle',x:0,z:0}).v.family,'medical');
 assert.equal(masteryVisualEvent({type:'skill',skillId:'healer_07',x:0,z:0}),null);
});
