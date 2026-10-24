import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadGameData,huntList,rollDrops,rollEquipment,validateItemRoll,requiredEquipmentLevel} from '../src/index.node.js';
import {MAP_INFO,FIELD_HABITATS,type FieldMapId} from '../src/game/maps.js';

const data=loadGameData();
const bands:Partial<Record<FieldMapId,number[]>>={meadow:[1,5],forest:[5,10],ruins:[10,15],canyon:[15,20],grove:[20,25],summit:[25,30],temple:[30,35],himmapan:[35,40],desert:[40,49],frost:[50,59],yokai:[60,69],dragon:[70,79],volcano:[70,79],fae:[80,89],ocean:[80,89],astral:[90,99],abyss:[90,99],confluence:[100,100]};

test('atlas, live map labels, monsters and equipment drops agree on the progression bands',()=>{
 const plan=JSON.parse(readFileSync(new URL('../../../maps/biome-plan.json',import.meta.url),'utf8'));
 for(const [map,band] of Object.entries(bands)){
  assert.deepEqual(plan.biomes.find((b:{id:string})=>b.id===map).levels,band,map);
  assert.equal(MAP_INFO[map as FieldMapId].levels,band.join('–'),map);
  const monsters=huntList(map as FieldMapId,data);
  assert.ok(monsters.length,map);
  if(band[1]-band[0]>5)for(const habitat of FIELD_HABITATS[map as FieldMapId]){
   const level=data.monsters.monsters.find(m=>m.id===habitat.dataId)!.level;
   const lo=level<band[0]+5?band[0]:band[0]+5;
   assert.ok(habitat.name.endsWith(`Lv.${lo}–${lo+4}`),`${map}/${habitat.name}`);
  }
  for(const listed of monsters){
   assert.ok(listed.level>=band[0]&&listed.level<=band[1],listed.id);
   const monster=data.monsters.monsters.find(m=>m.id===listed.id)!;
   for(const drop of rollDrops(monster,()=>0,data,0,0,()=>0)){
    const template=data.items.items.find(i=>i.id===drop.template)!;
    if(!template.slot)continue;
    assert.ok(requiredEquipmentLevel(template.level,drop)<=monster.level,`${map}/${monster.id}/${template.id}`);
    if(drop.roll)assert.deepEqual(validateItemRoll(drop.template,drop.roll,data),drop.roll);
   }
  }
 }
 for(let level=1;level<=100;level++)assert.ok(Object.values(bands).some(([lo,hi])=>level>=lo&&level<=hi),`uncovered Lv.${level}`);
});

test('stored equipment and Unique rolls retain their original item levels and affixes',()=>{
 for(const [template,level] of [['field_iron_sword',10],['field_sentinel_armour',20],['field_relic_bow',30],['unique_blade_oath',30],['unique_himmapan_relic',59],['unique_desert_relic',59],['unique_frost_relic',69]] as const){
  const stored={...rollEquipment(template,level,data,()=>.5)!,itemLevel:level};
  assert.deepEqual(validateItemRoll(template,JSON.parse(JSON.stringify(stored)),data),stored);
  if(level>10)assert.equal(requiredEquipmentLevel(data.items.items.find(i=>i.id===template)!.level,{roll:stored}),level);
 }
});
