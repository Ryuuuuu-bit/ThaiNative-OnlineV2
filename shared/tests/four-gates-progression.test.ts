import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,loadGameData,step,action,buildForLevel} from '../src/index.node.js';
import {GATES,GATE_LINKS,FIELD_HABITATS,FIELD_BOSS,LAYOUTS,MAP_ENTRY,travelDestination,type FieldMapId} from '../src/game/maps.js';
import {walkable} from '../src/game/collision.js';
import {createPathfinder} from '../src/game/pathfinding.js';
const data=loadGameData(),monster=(id:string)=>data.monsters.monsters.find(m=>m.id===id)!;

test('all four city gates lead directly out and back through the facing regional gate',()=>{
 for(const [direction,map,back]of [['south','meadow','north'],['east','forest','west'],['north','ruins','south'],['west','canyon','east']] as const){
  const arrival=travelDestination('city_plaza',direction,GATES.city_plaza[direction])!;
  assert.equal(arrival.mapId,map);assert.ok(walkable(arrival.x,arrival.z,.4,map));
  const portal=(GATES[map] as Record<string,{x:number;z:number}>)[back];
  const home=travelDestination(map,back,portal)!;assert.equal(home.mapId,'city_plaza');assert.ok(walkable(home.x,home.z,.4,'city_plaza'));
  assert.equal(GATE_LINKS[map][back],'city_plaza');
  assert.equal(travelDestination(map,back,{...portal,dead:true}),null);
 }
});
for(const map of ['meadow','forest','ruins','canyon'] as const){
 const entryLevel={meadow:1,forest:5,ruins:10,canyon:15}[map];
 test(`${map}: arrival is quiet, entry-level monsters are nearby, and high monsters stay in deep spawn areas`,()=>{
  const entry=MAP_ENTRY[map],spawns=LAYOUTS[map].spawns,distance=(p:{x:number;z:number})=>Math.hypot(p.x-entry.x,p.z-entry.z);
  assert.ok(spawns.filter(s=>monster(s.dataId).level===entryLevel).some(s=>distance(s)<30));
  for(const s of spawns){assert.ok(distance(s)>8);if(map!=='meadow'&&monster(s.dataId).level>entryLevel+1)assert.ok(distance(s)>40,s.dataId);}
  assert.ok(distance(FIELD_BOSS[map])>70);
  const path=createPathfinder((x,z)=>walkable(x,z,.4,map),LAYOUTS[map]);
  for(const h of FIELD_HABITATS[map])assert.ok(path.findPath(entry,h).length,`no route to ${h.name}`);
  if(map!=='meadow'){
   const ordered=[...FIELD_HABITATS[map]].sort((a,b)=>monster(a.dataId).level-monster(b.dataId).level);
   for(let i=1;i<ordered.length;i++)if(monster(ordered[i].dataId).level>monster(ordered[i-1].dataId).level)assert.ok(distance(ordered[i])>distance(ordered[i-1]),'habitat tiers deepen away from the city');
  }
 });
 test(`${map}: an appropriately equipped entry-level character can defeat its first small monster`,()=>{
  const g=createGame(42,buildForLevel('swordsman',entryLevel,data),'starter-test',data,map),enemy=g.enemies.find(e=>monster(e.dataId).level===entryLevel)!;
  assert.equal(g.p.level,entryLevel);g.random=()=>.5;g.enemies=[enemy];g.p.x=enemy.x;g.p.z=enemy.z+1.2;
  for(let i=0;i<800&&!enemy.dead&&!g.p.dead;i++){action(g,'attack');step(g,.05);}
  assert.ok(enemy.dead,'first enemy is killable with starter equipment');assert.equal(g.p.dead,false);assert.ok(g.kills>=1);
 });
}
