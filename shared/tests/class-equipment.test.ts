import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {loadGameData,LAYOUTS,FIELD_BOSS,THORN_NEST,rollEquipment,validateItemRoll,rolledModifiers,itemRollLines,applyInventory,starterInventory,inventoryProfile,deriveStats,newJob,createGame,refreshStats,spawn,action,step,resolveSkill,starterUnique,applyTrade} from '../src/index.node.js';
import {endgameSkillSpent,endgameIncoming} from '../src/game/endgame-loot.js';

const data=loadGameData(),tiers=['','iron','sentinel','relic','silver','sunsteel','naga','celestial','royalguard','mythic','eternal'];
const kinds=['sword','greatsword','dagger','knuckles','staff','bow','armour','robe','shield','focus_shield','cloak','spirit_cloak','boots','swift_boots','ring','arcane_ring','amulet'];
const live=new Set([...Object.values(LAYOUTS).flatMap(m=>m.spawns.map(s=>s.dataId)),...Object.values(FIELD_BOSS).map(m=>m.dataId),THORN_NEST.dataId]);
const template=(id:string)=>data.items.items.find(i=>i.id===id)!;
const uniqueIds=['blade_oath','hunters_eye','ember_robe','lotus_vow','spirit_bond','shadow_fang','flowing_fist'].map(id=>'unique_'+id);

test('every level band has farmable weapons for seven Masteries and alternatives in every equipment category',()=>{
 for(const tier of tiers)for(const kind of kinds){
  const id='field_'+(tier?tier+'_':'')+kind,t=template(id);assert.ok(t,id);
  const sources=data.monsters.monsters.filter(m=>live.has(m.id)&&m.drops.some(d=>d.item===id));assert.ok(sources.length,id);
  for(const source of sources){assert.ok(source.level>=t.level,id);const roll=rollEquipment(id,source.level,data,()=>.5,'rare')!;assert.deepEqual(validateItemRoll(id,roll,data),roll);}
 }
 for(const tier of tiers.slice(1))for(const kind of ['dagger','knuckles','greatsword'])assert.ok(data.economy.shops.forge[tier+'_'+kind]>0);
});

test('gear drops retain their expected quantity budget and summons cannot farm the new gear',()=>{
 for(const [id,budget]of [['himmapan_01',.04],['himmapan_08',.35],['dragon_cloud_carp',.055],['confluence_worldcore_sovereign',.5]] as const){
  const m=data.monsters.monsters.find(m=>m.id===id)!;assert.ok(Math.abs(m.drops.filter(d=>d.item.startsWith('field_')).reduce((n,d)=>n+d.rate,0)-budget)<1e-10,id);
 }
 for(const m of data.monsters.monsters.filter(m=>['jelly_summon','desert_sand_ball','desert_binding_knot','endgame_focus'].includes(m.id)))assert.ok(!m.drops.some(d=>kinds.some(k=>d.item.endsWith('_'+k))&&d.item.startsWith('field_')),m.id);
});

test('new affixes use real cast/regen stats, readable signs and strict stored bounds; old weapon rolls remain valid',()=>{
 const roll={version:1 as const,itemLevel:1,quality:'magic' as const,affixes:[{id:'focus',value:2}]};
 validateItemRoll('field_staff',roll,data);assert.deepEqual(rolledModifiers({template:'field_staff',roll}),[{kind:'percent',stat:'castMul',value:-.02}]);
 assert.ok(itemRollLines({template:'field_staff',roll}).some(line=>line.includes('-2')));
 const profile={...data.stats.defaultBuild,masteries:newJob().masteries,equipment:['field_staff']},normal=deriveStats(profile,data),faster=deriveStats({...profile,modifiers:rolledModifiers({template:'field_staff',roll})},data);assert.ok(Math.abs(faster.castMul/normal.castMul-.98)<1e-9);
 for(const id of ['meditation','renewal']){const r={...roll,affixes:[{id,value:6}]},stat=id==='meditation'?'spRegen':'hpRegen';validateItemRoll('field_robe',r,data);assert.ok(deriveStats({...profile,modifiers:rolledModifiers({template:'field_robe',roll:r})},data)[stat]>normal[stat]);}
 assert.throws(()=>validateItemRoll('field_staff',{...roll,affixes:[{id:'focus',value:99}]},data));
 const legacy={...roll,affixes:[{id:'arcane',value:5}]};assert.deepEqual(validateItemRoll('field_sword',legacy,data),legacy);
 let n=123;const rng=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 for(const id of ['field_staff','field_dagger','field_knuckles','field_bow'])for(let i=0;i<100;i++){const r=rollEquipment(id,50,data,rng,'rare')!;assert.ok(!r.affixes.some(a=>a.id===(id==='field_staff'?'force':'arcane')));}
});

test('seven Unique builds equip, persist and trade through real inventory rules, with no sockets or level bypass',()=>{
 const profile={...data.stats.defaultBuild,level:30,masteries:newJob().masteries};
 for(const id of uniqueIds){
  const t=template(id),def=starterUnique(id)!;assert.ok(def);assert.equal(t.slots,0);assert.equal(def.level,t.level);
  assert.ok(data.monsters.monsters.some(m=>live.has(m.id)&&m.level>=t.level&&m.drops.some(d=>d.item===id)));
  const roll=rollEquipment(id,100,data,()=>.5)!;let state=applyInventory({inventory:starterInventory(0,randomUUID),gold:0},{op:'admin',loot:[{template:id,qty:1,roll}]},profile,data,randomUUID).state;
  const item=state.inventory.items.find(i=>i.template===id)!;
  assert.throws(()=>applyInventory(state,{op:'equip',id:item.id},{...profile,level:29},data,randomUUID));
  state=applyInventory(state,{op:'equip',id:item.id},profile,data,randomUUID).state;const stats=deriveStats(inventoryProfile(profile,state.inventory,data),data);assert.ok(Number.isFinite(stats.atk)&&stats.matk>0);
  assert.throws(()=>applyInventory(state,{op:'socket',id:item.id},profile,data,randomUUID));
  for(const op of ['unequip','store','retrieve'] as const)state=applyInventory(state,{op,id:item.id},profile,data,randomUUID).state;
  const out=applyTrade({state,offer:{gold:0,items:[{id:item.id,qty:1}]},profile},{state:{gold:0,inventory:starterInventory(0,randomUUID)},offer:{gold:0,items:[]},profile},data);
  assert.deepEqual(out.b.state.inventory.items.find(i=>i.id===item.id)!.roll,roll);
 }
});

test('equipped dagger and handwraps unlock real Assassin/Boxer attacks, and spirit gear strengthens the actual summon',()=>{
 for(const [id,skill]of [['unique_shadow_fang','rogue_01'],['unique_flowing_fist','boxer_01'],['unique_spirit_bond','shaman_01']] as const){
  const g=createGame(1,{...data.stats.defaultBuild,level:30},'test',data);g.enemies=[];g.random=()=>.1;const p=g.p;Object.assign(p,newJob());p.skills[skill]=1;p.inventory=starterInventory(0,randomUUID);refreshStats(g,p);const before={...p.stats};
  let state=applyInventory({inventory:p.inventory,gold:0},{op:'admin',loot:[{template:id,qty:1,roll:rollEquipment(id,30,data,()=>.5)}]},p.profile,data,randomUUID).state;
  const item=state.inventory.items.find(i=>i.template===id)!;state=applyInventory(state,{op:'equip',id:item.id}, {...p.profile,masteries:p.masteries},data,randomUUID).state;p.inventory=state.inventory;refreshStats(g,p);p.mp=p.maxMp;
  const enemy=spawn(g,p.x+1,p.z);enemy.hp=enemy.maxHp=10000;enemy.cooldown=999;g.target=enemy.id;
  assert.ok(action(g,skill),skill);for(let i=0;i<25;i++)step(g,.05);
  if(skill==='shaman_01'){assert.ok(p.summon);assert.ok(p.stats.matk>before.matk&&p.maxHp>before.maxHp);assert.equal(p.summon.atk,p.stats.matk*.35);assert.equal(p.summon.maxHp,Math.round(p.maxHp*data.mastery.skills.find(s=>s.id==='shaman_01')!.ranks[0].params.petHp/100));}else assert.ok(enemy.hp<10000,skill);
 }
});

test('regional support uniques recognize Mastery heal coefficients and distinct utility skills',()=>{
 const g=createGame(1,{...data.stats.defaultBuild,level:100},'test',data),p=g.p;p.inventory=starterInventory(0,randomUUID);
 const add=(id:string)=>p.inventory!.items.push({id:randomUUID(),template:id,qty:1,location:'equip',slot:'accessory1',refine:0,cards:[],bound:false,source:'test',roll:rollEquipment(id,100,data,()=>.5)});
 add('unique_fae_relic');p.mp=0;p.maxMp=100;
 for(const id of ['mage_01','mage_03','healer_01'])endgameSkillSpent(g,p,resolveSkill(data,id));assert.equal(p.mp,4);
 p.inventory.items=[];add('unique_dragon_relic');endgameSkillSpent(g,p,resolveSkill(data,'healer_01'));assert.ok(p.lootEffects?.cooldowns['end:qilin_chain']);
 p.inventory.items=[];add('unique_confluence_relic');g.time=25;endgameSkillSpent(g,p,resolveSkill(data,'boxer_17'));assert.equal(p.lootEffects?.endgame?.role,'support');
 assert.equal(endgameIncoming(p,100,'neutral',false,false),100);
});

test('two-handed sword and shield conflict is rejected atomically in either equip order',()=>{
 const profile={...data.stats.defaultBuild,level:30,masteries:newJob().masteries};
 for(const ids of [['field_relic_greatsword','field_relic_shield'],['field_relic_shield','field_relic_greatsword']]){
  let state=applyInventory({inventory:starterInventory(0,randomUUID),gold:0},{op:'admin',loot:ids.map(template=>({template,qty:1,roll:rollEquipment(template,30,data,()=>.5)}))},profile,data,randomUUID).state;
  const [first,second]=ids.map(id=>state.inventory.items.find(i=>i.template===id)!);
  state=applyInventory(state,{op:'equip',id:first.id},profile,data,randomUUID).state;const before=structuredClone(state);
  assert.throws(()=>applyInventory(state,{op:'equip',id:second.id},profile,data,randomUUID),/ดาบสองมือ/);assert.deepEqual(state,before);
 }
});
