import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createGame,loadGameData,spawn,starterInventory,rollEquipment,validateItemRoll,castSunScroll,applyInventory,type Player} from '../src/index.node.js';
import {lootHitDamage,lootAccuracy,lootEvadedWarning,lootGuard,lootOnKill,lootInterrupted,tickPlayerLoot,tickEnemyLoot,applyPotionEffect,healPartyMember} from '../src/game/loot-effects.js';
import {endgameSkillCost,endgameSkillSpent,endgameIncoming,endgameCast,endgameAttackInterval,endgameStatus,endgameDot} from '../src/game/endgame-loot.js';
import {ENDGAME_UNIQUES,ENDGAME_CARD_TEXT} from '../src/game/endgame-loot-data.js';
import {moveSliding} from '../src/game/collision.js';
const data=loadGameData();
function fixture(){const g=createGame(100,{...data.stats.defaultBuild,level:100},'hunter',data,'dragon');g.enemies=[];const p=g.p;Object.assign(p,{x:-48,z:12,maxHp:1000,hp:500,maxMp:100,mp:10});p.inventory=starterInventory(0,randomUUID);const e=spawn(g,-46,12,false,'pink',false,'dragon_cloud_carp');return{g,p,e};}
const card=(p:Player,id:string)=>p.inventory!.items.push({id:randomUUID(),template:'field_ring',location:'equip',slot:'accessory1',qty:1,refine:0,cards:['card_'+id],bound:false,source:'test'});
const unique=(p:Player,id:string)=>{const template='unique_'+id+'_relic';p.inventory!.items.push({id:randomUUID(),template,location:'equip',slot:'accessory1',qty:1,refine:0,cards:[],bound:false,source:'test',roll:rollEquipment(template,100,data,()=>.5)});};
const spell=(element:'fire'|'water'|'holy')=>({...data.skills.skills.find(s=>s.id==='fire_bolt')!,element});
test('all52 cards and seven original Unique have valid catalogs, source-bound loot, fixed lines and persistable rolls',()=>{
 assert.equal(Object.keys(ENDGAME_CARD_TEXT).length,52);assert.equal(Object.keys(ENDGAME_UNIQUES).length,7);
 for(const [id,def]of Object.entries(ENDGAME_UNIQUES)){const roll=rollEquipment(id,100,data,()=>.5)!;assert.equal(roll.quality,'unique');assert.equal(roll.itemLevel,def.level);assert.deepEqual(validateItemRoll(id,JSON.parse(JSON.stringify(roll)),data),roll);assert.equal(data.monsters.monsters.filter(m=>m.drops.some(d=>d.item===id)).length,1);}
 for(const id of Object.keys(ENDGAME_CARD_TEXT)){assert.ok(data.cards.cards.some(c=>c.id===id));assert.equal(data.monsters.monsters.filter(m=>m.drops.some(d=>d.item===id)).length,1);assert.ok(ENDGAME_CARD_TEXT[id][0].length>10);}
});
test('carp walking charge needs three continuous seconds and is spent only by a positive basic hit',()=>{
 const{g,p,e}=fixture();card(p,'dragon_cloud_carp');p.moving=true;tickPlayerLoot(g,p,2.9);assert.equal(lootAccuracy(p,e),0);tickPlayerLoot(g,p,.1);assert.equal(lootAccuracy(p,e),15);
 lootHitDamage(g,p,e,'slash',100,false);assert.equal(lootAccuracy(p,e),15);lootHitDamage(g,p,e,'basic',0,false);assert.equal(lootAccuracy(p,e),15);lootHitDamage(g,p,e,'basic',100,false);assert.equal(lootAccuracy(p,e),0);
});
test('crane evade SP and tiger next-hit bonus cannot repeat during cooldown',()=>{
 const{g,p,e}=fixture();card(p,'dragon_jade_crane');card(p,'dragon_white_cloud_tiger');lootEvadedWarning(p,g);assert.equal(p.mp,12);lootEvadedWarning(p,g);assert.equal(p.mp,12);
 assert.equal(lootHitDamage(g,p,e,'slash',0,false),0);assert.equal(lootHitDamage(g,p,e,'slash',100,false),108);assert.equal(lootHitDamage(g,p,e,'slash',100,false),100);
});
test('jade Guard requires stillness and boss interruption gives nearby party speed only',()=>{
 const{g,p,e}=fixture();card(p,'dragon_jade_gatekeeper');p.statuses=[{id:'guard',sourceId:p.id,value:.3,remaining:5}];tickPlayerLoot(g,p,2);assert.equal(p.lootEffects!.partyShields![0].amount,20);tickPlayerLoot(g,p,2);assert.equal(p.lootEffects!.partyShields!.length,0);assert.ok(p.lootEffects!.cooldowns['end:jade_cd']>0);
 card(p,'dragon_cloud_dragon_lord');e.boss=true;lootInterrupted(p,g,e);assert.ok(p.statuses.some(v=>v.id==='speed'&&v.value===.08));
});
test('qilin bell chains from a support cast to at most three other enemies, with a single-target tradeoff',()=>{
 const{g,p,e}=fixture();unique(p,'dragon');for(let i=0;i<4;i++)spawn(g,e.x+1,e.z,false,'pink',false,e.dataId);
 const support=data.skills.skills.find(s=>s.effect==='guard')!;endgameSkillSpent(g,p,support);
 assert.equal(lootHitDamage(g,p,e,'basic',100,false),94);assert.equal(g.enemies.filter(v=>v.itemPoisons?.some(d=>d.sourceUnique==='unique_dragon_relic')).length,3);
 lootHitDamage(g,p,e,'basic',100,false);assert.equal(g.enemies.flatMap(v=>v.itemPoisons??[]).length,3);
});
test('volcanic burn is bounded, does not erase another DOT, and its potion penalty is real',()=>{
 const{g,p,e}=fixture();unique(p,'volcano');card(p,'volcano_old_kiln_sprite');e.itemPoisons=[{owner:p.id,remaining:4,tick:0,damage:2,bleed:true}];lootHitDamage(g,p,e,'slash',100,false);assert.equal(e.itemPoisons.length,2);assert.ok(e.itemPoisons.some(v=>v.burn));
 assert.equal(endgameDot(p,e,100,true),105);p.hp=400;assert.equal(Math.round(endgameDot(p,e,100,true)),113);
 p.maxHp=5000;p.hp=1;applyPotionEffect(g,p,'hp',100);assert.equal(p.hp,93);
});
test('fire first-hit, potion fire buff and next-melee protection each respect their own trigger',()=>{
 const{g,p,e}=fixture();card(p,'volcano_lava_glass_lizard');card(p,'volcano_azure_firebird');card(p,'volcano_ash_boulder_beetle');
 assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),106);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),100);
 applyPotionEffect(g,p,'hp',1);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),105);
 assert.equal(endgameIncoming(p,100,'fire',true,false),100);assert.equal(endgameIncoming(p,100,'neutral',false,false),95);assert.equal(endgameIncoming(p,100,'neutral',false,false),100);
});
test('fae mirror is a next-spell bonus and a successful interrupt applies a bounded magic-defense debuff',()=>{
 const{g,p,e}=fixture();card(p,'fae_moondrop_mirrorfae');card(p,'fae_silverchain_dullahan');lootHitDamage(g,p,e,'basic',100,false);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false),105);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false),100);
 lootInterrupted(p,g,e);lootHitDamage(g,p,e,'basic',100,false);assert.equal(e.statuses.find(v=>v.id==='mdef_down')!.value,.04);
});
test('fae three skill categories refund once and repeating the same paid skill costs more',()=>{
 const{g,p}=fixture();unique(p,'fae');for(const skill of [data.skills.skills.find(s=>s.kind==='single'&&s.percent>0)!,data.skills.skills.find(s=>s.kind==='area'&&s.percent>0)!,data.skills.skills.find(s=>s.effect==='guard')!])endgameSkillSpent(g,p,skill);
 assert.equal(p.mp,14);const id=p.lootEffects!.endgame!.lastSkill;assert.equal(endgameSkillCost(p,100,id),104);
});
test('puca discount applies to the first paid cast on the next target and is consumed after commit',()=>{
 const{g,p,e}=fixture();card(p,'fae_puca_shadowhorse');lootOnKill(g,e,p);p.target=e.id+1;assert.equal(endgameSkillCost(p,20,'slash'),19);endgameSkillSpent(g,p,data.skills.skills.find(s=>s.id==='slash')!);assert.equal(endgameSkillCost(p,20,'slash'),20);
});
test('crab, Kraken and anchor counters stay independent when worn together; ordinary targets root and bosses slow',()=>{
 const{g,p,e}=fixture();card(p,'ocean_mast_crab');card(p,'ocean_stormcrown_kraken');unique(p,'ocean');const results=[];for(let i=0;i<6;i++)results.push(lootHitDamage(g,p,e,'basic',100,false));
 assert.ok(e.statuses.some(v=>v.id==='root'));assert.ok(results[5]>100);assert.ok(endgameAttackInterval(p,1)<1/.97);
 const before=e.x;moveSliding(e,1,0);assert.equal(e.x,before);
});
test('Scylla refunds at most3 SP for a multi-target action and cannot refund from repeated hits on one target',()=>{
 const{g,p,e}=fixture();card(p,'ocean_sixhead_reef_scylla');lootHitDamage(g,p,e,'whirlwind',100,false);lootHitDamage(g,p,e,'whirlwind',100,false);assert.equal(p.mp,10);
 for(let i=0;i<4;i++){const other=spawn(g,e.x+i*.1,e.z,false,'pink',false,e.dataId);lootHitDamage(g,p,other,'whirlwind',100,false);}assert.equal(p.mp,13);
 g.time=1;const other=spawn(g,e.x,e.z,false,'pink',false,e.dataId);lootHitDamage(g,p,other,'whirlwind',100,false);lootHitDamage(g,p,e,'whirlwind',100,false);assert.equal(p.mp,13);
});
test('jellyfish alternation arms the next spell, and ray cast reduction expires after one cast',()=>{
 const{g,p,e}=fixture();card(p,'astral_stardust_jellyfish');card(p,'astral_orbital_ray');assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),100);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('water')),100);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('water')),105);
 lootEvadedWarning(p,g);assert.equal(endgameCast(p,2),1.9);assert.equal(endgameCast(p,2),2);
});
test('astral Unique tracks actual supplied spell elements and applies its off-element drawback',()=>{
 const{g,p,e}=fixture();unique(p,'astral');assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),100);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('holy')),100);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('water')),108);assert.equal(lootHitDamage(g,p,e,'fire_bolt',100,false,spell('fire')),96);
});
test('abyss refreshes poison and bleed once, never stacks a multiplier and preserves its direct-hit drawback',()=>{
 const{g,p,e}=fixture();unique(p,'abyss');card(p,'abyss_night_border_scorpion');e.itemPoisons=[{owner:p.id,remaining:1,tick:0,damage:2},{owner:p.id,remaining:1,tick:0,damage:2,bleed:true}];assert.equal(lootHitDamage(g,p,e,'slash',100,false),93);assert.ok(e.itemPoisons.every(v=>v.remaining===3&&v.refreshed));
 e.itemPoisons.forEach(v=>v.remaining=1);lootHitDamage(g,p,e,'slash',100,false);assert.ok(e.itemPoisons.every(v=>v.remaining===1));assert.equal(endgameDot(p,e,100,false),105);
});
test('confluence role is one timed buff, cannot stack roles, and Guard mitigation really expires',()=>{
 const{g,p,e}=fixture();unique(p,'confluence');lootGuard(g,p,e,true);assert.equal(endgameIncoming(p,100,'neutral',false,false),92);assert.equal(lootHitDamage(g,p,e,'slash',100,false),100);tickPlayerLoot(g,p,5.1);assert.equal(endgameIncoming(p,100,'neutral',false,false),100);
 g.time=21;assert.equal(lootHitDamage(g,p,e,'slash',100,false),108);assert.equal(p.lootEffects!.endgame!.role,'attack');
});
test('life pillar heal uses pre-heal HP, real nearby party membership, cooldown and bounded shield',()=>{
 const{g,p}=fixture();card(p,'confluence_life_pillar_guard');const ally=createGame().p;Object.assign(ally,{id:'ally',mapId:g.mapId,x:p.x+1,z:p.z,maxHp:1000,hp:200});g.players.set(ally.id,ally);g.partyMembers=()=>[p.id,ally.id];assert.equal(healPartyMember(g,p,ally,200),200);assert.equal(ally.lootEffects!.partyShields![0].amount,20);healPartyMember(g,p,ally,10);assert.equal(ally.lootEffects!.partyShields!.length,1);
});
test('elemental scrolls require their item level before consuming, and the authoritative element reaches hit effects',()=>{
 const{g,p,e}=fixture();const template='astral_water_scroll';let state=applyInventory({inventory:p.inventory!,gold:0},{op:'admin',loot:[{template,qty:1}]},p.profile,data,randomUUID).state;const item=state.inventory.items.find(i=>i.template===template)!;assert.throws(()=>applyInventory(state,{op:'use',id:item.id},{...p.profile,level:89},data,randomUUID),/ระดับ/);assert.equal(state.inventory.items.find(i=>i.id===item.id)!.qty,1);
 p.level=100;g.random=()=>0;assert.ok(castSunScroll(g,p,160,e.id,'water'));assert.ok(g.events.some(v=>v.type==='hit'&&v.element==='water'));
});

test('Siren extends life-pillar shields and dragonlord speed for an ally, preserving the real source owner',()=>{
 const{g,p,e}=fixture();card(p,'confluence_life_pillar_guard');card(p,'ocean_mist_isle_siren');card(p,'dragon_cloud_dragon_lord');
 const ally=createGame().p;Object.assign(ally,{id:'ally',mapId:g.mapId,x:p.x+1,z:p.z,maxHp:1000,hp:200});g.players.set(ally.id,ally);g.partyMembers=()=>[p.id,ally.id];
 healPartyMember(g,p,ally,100);const shield=ally.lootEffects!.partyShields![0];assert.equal(shield.owner,p.id);assert.ok(Math.abs(shield.remaining-3.15)<1e-8);
 e.boss=true;lootInterrupted(p,g,e);assert.ok(Math.abs(ally.statuses.find(s=>s.sourceId==='dragonlord:'+p.id)!.remaining-3.15)<1e-8);assert.equal(p.statuses.find(s=>s.sourceId==='dragonlord:'+p.id)!.remaining,3);
});
