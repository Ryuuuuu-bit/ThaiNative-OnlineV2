import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGameData} from '@the-beginning-online/shared';
import {LAYOUTS,MAP_ENTRY,gateRoute} from '@the-beginning-online/shared/maps';
import {createPlayerPathfinder} from '@the-beginning-online/shared/pathfinding';
import {questDestination} from '../src/quest-navigation.ts';
import {TOWN_NPCS} from '../src/city-2d-locations.ts';
const data=loadGameData(),player={...MAP_ENTRY.city_plaza,level:10};
test('quest navigation follows real monster and drop locations, then returns to the giver',()=>{
 for(const quest of data.quests.quests){
  const progress=quest.objectives.map(()=>0),point=questDestination(data,quest,progress,'city_plaza',player);
  assert.ok(point,quest.id);
  if(point.map!=='city_plaza'){
   assert.ok(gateRoute('city_plaza',point.map,player.level).length);
   assert.ok(createPlayerPathfinder(point.map).findPath(MAP_ENTRY[point.map],point).length,`${quest.id}: objective is reachable`);
   const objective=quest.objectives[0];
   if(objective.kind==='kill')assert.ok(LAYOUTS[point.map].spawns.some(s=>objective.monsters.includes(s.dataId))||point.kind==='boss');
  }
  const ready=questDestination(data,quest,quest.objectives.map(o=>o.count),'meadow',player);
  const giver=TOWN_NPCS.find(n=>n.kind===quest.giver);
  assert.equal(ready.map,'city_plaza');assert.equal(ready.kind,quest.giver);
  assert.equal(ready.x,giver.x);assert.equal(ready.z,giver.z);
 }
});
test('the navigator advances to the next unfinished objective and prefers the current map',()=>{
 const quest=data.quests.quests.find(q=>q.id==='healer_colors');
 const a=questDestination(data,quest,[0,0],'meadow',player),b=questDestination(data,quest,[5,0],'meadow',player);
 assert.equal(a.map,'meadow');assert.equal(b.map,'meadow');assert.notDeepEqual({x:a.x,z:a.z},{x:b.x,z:b.z});
});
