import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,loadGameData,newJob,learnSkill,validateHotbar,resolveSkill,action,spawn,step,revive,addPlayer,applyPlayerBurn,applyPotionEffect,DEFAULT_AUTO} from '../src/index.node.js';
import {recordMasteryWound} from '../src/game/mastery-training.js';
const data=loadGameData();
function fixture(){
 const g=createGame(1281,{...data.stats.defaultBuild,classId:'swordsman'});g.enemies=[];g.random=()=>.5;const p=g.p;Object.assign(p,newJob());p.masteries.Healer=25;Object.assign(p.skills,{healer_01:1,healer_04:1});
 p.x=0;p.z=4;p.stats.matk=101;p.stats.hpRegen=0;p.stats.spRegen=0;p.stats.softMdef=0;p.stats.flee=-1000;p.hp=p.maxHp=1000;p.mp=p.maxMp=400;return {g,p};
}
function advance(g:ReturnType<typeof createGame>,s:number){for(let n=0;n<Math.round(s/.05);n++)step(g,.05);}
function poison(p:ReturnType<typeof fixture>['p']){p.lootEffects={cooldowns:{},shield:0,shieldFor:0,venom:{remaining:3,tick:0}};}
function foe(g:ReturnType<typeof createGame>){const e=spawn(g,4,4);e.hp=e.maxHp=10000;e.cooldown=999;e.wander=999;return e;}
function bolt(g:ReturnType<typeof createGame>,damage=100){const e=foe(g);e.dataId=data.monsters.monsters.find(s=>s.element==='fire')!.id;g.p.invulnerable=0;g.projectiles.push({id:g.nextId++,owner:e.id,attack:'bolt',x:g.p.x,z:g.p.z,vx:0,vz:0,life:1,damage,phase:1});step(g,.05);}

test('cleanse follows all accepted ranks, classless learning, hotbar, cast and effective MATK healing',()=>{
 let progress=newJob();progress.skillPoints=3;assert.throws(()=>learnSkill(progress,'healer_04',data));progress=learnSkill(progress,'healer_01',data);assert.throws(()=>learnSkill(progress,'healer_04',data),/Mastery 25/);progress.masteries.Healer=25;progress=learnSkill(progress,'healer_04',data);
 assert.equal(validateHotbar(progress,progress.hotbar.map((s,i)=>({...s,skill:i===0?'healer_04':null})),data)[0].skill,'healer_04');
 for(const r of data.mastery.skills.find(s=>s.id==='healer_04')!.ranks){const {g,p}=fixture();p.skills.healer_04=r.rank;p.hp=100;poison(p);const mp=p.mp,s=resolveSkill(data,'healer_04',r.rank);assert.equal(s.sp,r.mp);assert.equal(s.cast,r.cast);assert.equal(s.cooldown,r.cooldown);assert(action(g,'healer_04'));assert.equal(p.mp,mp-r.mp);assert.equal(p.cd.healer_04,r.cooldown);advance(g,.15);assert.equal(p.hp,100);assert(p.lootEffects?.venom);advance(g,.05);assert.equal(p.hp,100+Math.round(101*r.params.heal/100));assert.equal(p.lootEffects?.venom,undefined);assert.equal(g.events.find(v=>v.type==='skillImpact'&&v.skillId==='healer_04')!.cleansed,'poison');}
});

test('full healthy targets are no-ops; full poisoned or burned targets cleanse, wounded healthy targets heal',()=>{
 const a=fixture();assert.equal(action(a.g,'healer_04'),false);assert.equal(a.p.mp,400);assert.equal(a.p.cd.healer_04||0,0);
 for(const status of ['burn','poison','wound']){const {g,p}=fixture();if(status==='burn')assert(applyPlayerBurn(g,p));if(status==='poison')poison(p);if(status==='wound')p.hp-=10;assert(action(g,'healer_04'));advance(g,.2);assert.equal(p.hp,p.maxHp);assert.equal(p.lootEffects?.venom,undefined);assert(!p.statuses.some(s=>s.id==='burn'));assert.equal(p.masteryExp.Healer,0);}
});

test('one cast removes Burn before Poison, retaining unrelated Bleed, Root, Slow and beneficial effects',()=>{
 const {g,p}=fixture();assert(applyPlayerBurn(g,p));poison(p);p.lootEffects!.bleed={remaining:4,tick:0,damage:3,map:g.mapId};p.statuses.push({id:'root',sourceId:'fixture',remaining:4,value:1},{id:'slow',sourceId:'fixture',remaining:4,value:.5},{id:'guard',sourceId:'fixture',remaining:4,value:.1});
 assert(action(g,'healer_04'));advance(g,.2);assert(!p.statuses.some(s=>s.id==='burn'));assert(p.lootEffects?.venom);assert(p.lootEffects?.bleed);assert.deepEqual(p.statuses.map(s=>s.id),['root','slow','guard']);p.cd.healer_04=0;assert(action(g,'healer_04'));advance(g,.2);assert.equal(p.lootEffects?.venom,undefined);assert(p.lootEffects?.bleed);assert.deepEqual(p.statuses.map(s=>s.id),['root','slow','guard']);
});

test('Burn uses real HP ticks, exact lifetime, non-stacking refresh and preserves fractional tick progress',()=>{
 const {g,p}=fixture();assert(applyPlayerBurn(g,p));assert.equal(p.hp,1000);advance(g,.5);assert.equal(p.hp,1000);assert(applyPlayerBurn(g,p));assert.equal(p.statuses.filter(s=>s.id==='burn').length,1);advance(g,.5);assert.equal(p.hp,970);advance(g,5.5);assert.equal(p.hp,820);assert(!p.statuses.some(s=>s.id==='burn'));advance(g,1);assert.equal(p.hp,820);
});

test('cleanse stops future real Burn/Poison ticks without adding support credit for source-less damage',()=>{
 for(const status of ['burn','poison']){const {g,p}=fixture(),e=foe(g);if(status==='burn')assert(applyPlayerBurn(g,p));else poison(p);advance(g,1);assert.equal(p.hp,status==='burn'?970:997);assert(action(g,'healer_04'));advance(g,.2);assert.equal(p.hp,1000);advance(g,4);assert.equal(p.hp,1000);assert.equal(e.masterySupport,undefined);assert.equal(p.masteryExp.Healer,0);}
});

test('Burn rejects foreign, dead, god, wrong-map and invalid-chance applications and respects status resistance',()=>{
 for(const reason of ['foreign','dead','god','map','chance','nan','resist']){const {g,p}=fixture();if(reason==='foreign')g.players.delete(p.id);if(reason==='dead')p.dead=true;if(reason==='god')p.god=true;if(reason==='map')p.mapId='city_plaza';if(reason==='resist'){p.stats.statusResist.burn=.5;g.random=()=>.75;}assert.equal(applyPlayerBurn(g,p,reason==='chance'?-1:reason==='nan'?NaN:1),false,reason);assert(!p.statuses.some(s=>s.id==='burn'));}
 const {g,p}=fixture();g.random=()=>0;p.stats.statusResist.burn=.5;assert(applyPlayerBurn(g,p));
});

test('Burn lowers actual fire resistance by twenty points without mutating base stats, and cleansing/expiry restore it',()=>{
 for(const resistance of [-1,0,.3,.5,.8])for(const state of ['healthy','burned','cleansed','expired','itemCleanse']){
  const {g,p}=fixture();p.stats.elementResist.fire=resistance;if(state!=='healthy')assert(applyPlayerBurn(g,p));if(state==='cleansed'){assert(action(g,'healer_04'));advance(g,.2);}if(state==='expired')advance(g,6);if(state==='itemCleanse')applyPotionEffect(g,p,'party_cleanse',1);const hp=p.hp;bolt(g);const effective=Math.max(-1,Math.min(.5,resistance-(state==='burned'?.2:0)));assert.equal(hp-p.hp,Math.round(100*(1-effective)),state);assert.equal(p.stats.elementResist.fire,resistance);
 }
});

test('source-based fire melee uses the same transient resistance in its real damage breakdown',()=>{
 for(const burned of [false,true]){const {g,p}=fixture();p.stats.elementResist.fire=.3;const e=foe(g);e.dataId=data.monsters.monsters.find(s=>s.element==='fire'&&!s.boss)!.id;e.x=.9;e.motion='attack';e.motionTime=(e.behavior?.windup??.5)-.01;e.motionDuration=2;e.fx=-1;e.fz=0;e.attackApplied=false;if(burned)assert(applyPlayerBurn(g,p));step(g,.05);const hit=g.events.find(v=>v.type==='hurt')!;assert(hit.amount>0);assert(Math.abs(hit.breakdown.E-data.elements.table.fire[p.stats.element]/100*(burned?.9:.7))<1e-8);assert.equal(p.stats.elementResist.fire,.3);}
});

test('one allied cleanse uses range eight and heals the ally without cleansing the caster',()=>{
 const {g,p}=fixture(),other=addPlayer(g,'other');other.x=7.9;other.z=4;other.stats.hpRegen=0;other.hp=other.maxHp-100;g.partyMembers=()=>[p.id,other.id];assert(applyPlayerBurn(g,other));poison(p);assert(action(g,'healer_04',other.id));const hp=other.hp;advance(g,.2);assert.equal(other.hp,hp+40);assert(!other.statuses.some(s=>s.id==='burn'));assert(p.lootEffects?.venom);assert.equal(g.events.find(v=>v.type==='heal'&&v.skillId==='healer_04')!.playerId,other.id);
});

test('Burn periodic HP damage bypasses hit invulnerability without spending one-hit intercept, and clears on death/revive',()=>{
 const {g,p}=fixture();p.statuses.push({id:'spirit_intercept',sourceId:'shaman_04',remaining:4,value:.2});p.masteries.Summoner=25;Object.assign(p.skills,{shaman_01:1,shaman_04:1});p.invulnerable=5;assert(applyPlayerBurn(g,p));advance(g,1);assert.equal(p.hp,970);assert(p.statuses.some(s=>s.id==='spirit_intercept'));
 p.hp=1;advance(g,1);assert(p.dead);assert(!p.statuses.some(s=>s.id==='burn'));p.reviveRemaining=0;revive(g);assert(!p.statuses.some(s=>s.id==='burn'));
});

test('party selection is revalidated at impact, with no refund on cancellation and no mutation of strangers',()=>{
 for(const reason of ['party','range','dead','map','cc']){const {g,p}=fixture(),other=addPlayer(g,'other');other.x=1;other.z=4;other.stats.hpRegen=0;other.hp=other.maxHp-100;g.partyMembers=()=>[p.id,other.id];assert(action(g,'healer_04',other.id));const hp=other.hp,mp=p.mp;if(reason==='party')g.partyMembers=()=>[p.id];if(reason==='range')other.x=30;if(reason==='dead')other.dead=true;if(reason==='map')other.mapId='city_plaza';if(reason==='cc')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});advance(g,.2);assert.equal(other.hp,hp,reason);assert.equal(p.mp,mp);}
 const {g,p}=fixture(),stranger=addPlayer(g,'stranger');stranger.x=1;stranger.z=4;stranger.hp-=20;assert.equal(action(g,'healer_04',stranger.id),false);assert.equal(p.mp,400);
});

test('actual encounter wound healing receives only effective Healer support; overheal cannot multiply it',()=>{
 const {g,p}=fixture(),e=foe(g);p.hp-=10;recordMasteryWound(g,p,e,10);assert(action(g,'healer_04'));advance(g,.2);assert.equal(p.hp,1000);assert.equal(e.masterySupport![p.id].Healer,10);p.cd.healer_04=0;poison(p);assert(action(g,'healer_04'));advance(g,.2);assert.equal(e.masterySupport![p.id].Healer,10);
});

test('any weapon works while invalid ranks, Mastery, root, MP and control cannot spend resources',()=>{
 for(const reason of ['rank','mastery','root','mp','cc']){const {g,p}=fixture();p.hp-=10;if(reason==='rank')p.skills.healer_04=6;if(reason==='mastery')p.masteries.Healer=0;if(reason==='root')p.skills.healer_01=0;if(reason==='mp')p.mp=0;if(reason==='cc')p.statuses.push({id:'stun',sourceId:'fixture',remaining:1,value:0});const mp=p.mp;assert.equal(action(g,'healer_04'),false,reason);assert.equal(p.mp,mp);assert.equal(p.cd.healer_04||0,0);}
 for(const weapon of ['unarmed','bow','dagger','staff','sword1h','sword2h'] as const){const {g,p}=fixture();p.hp-=10;p.stats.weaponType=weapon;assert(action(g,'healer_04'));}
});

test('AUTO uses self cleanse on real status and skips a healthy unaffected self',()=>{
 const {g,p}=fixture();foe(g);p.auto=true;p.autoCfg={...DEFAULT_AUTO,basic:false,order:['healer_04'],off:['healer_01']};advance(g,.3);assert.equal(p.mp,400);poison(p);g.autoTimer=0;advance(g,.4);assert.equal(p.lootEffects?.venom,undefined);assert.equal(p.mp,382);assert.equal(p.hp,1000);
});
