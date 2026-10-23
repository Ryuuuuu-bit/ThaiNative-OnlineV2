import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, action, healerHeal, revive, setAuto, step, walkable } from '../src/game/sim.js';
import { CITY_SPAWN, CITY_RETURN, MEADOW_ENTRY, HEALER, GATES, CITY_BUILDINGS, CITY_LAYOUT, travelDestination } from '../src/game/maps.js';

const city=()=>createGame(123,undefined,undefined,undefined,'city_plaza');
test('travel accepts only the open gate, living character and authoritative radius',()=>{
 const G=GATES.city_plaza;
 assert.equal(travelDestination('city_plaza','south',CITY_SPAWN),null);
 assert.deepEqual(travelDestination('city_plaza','south',G.south),{mapId:'meadow',...MEADOW_ENTRY});
 assert.deepEqual(travelDestination('meadow','north',GATES.meadow.north),{mapId:'city_plaza',...CITY_RETURN});
 assert.equal(travelDestination('city_plaza','east',G.east)?.mapId,'forest');
 assert.equal(travelDestination('city_plaza','north',G.north)?.mapId,'ruins');assert.equal(travelDestination('city_plaza','west',G.west)?.mapId,'canyon');
 assert.equal(travelDestination('city_plaza','south',{x:0,z:G.south.z-1.51}),null);
 assert.equal(travelDestination('city_plaza','south',{...G.south,dead:true}),null);
 assert.equal(travelDestination('meadow','south',{x:0,z:-GATES.meadow.north.z}),null);
});
test('city has no monster simulation or combat; potion remains usable',()=>{
 const g=city();assert.equal(g.enemies.length,0);g.p.hp=1;
 for(const a of ['attack','basic','dash','dodge','spin','endure','earth_break'])assert.equal(action(g,a),false);
 setAuto(g,true);assert.equal(g.p.auto,false);assert.equal(action(g,'potion'),true);assert.ok(g.p.hp>1);
 for(let i=0;i<100;i++)step(g,.05,{x:0,z:1});assert.ok(g.p.z>CITY_SPAWN.z+15);assert.equal(g.enemies.length,0);
 assert.equal(walkable(0,0,.3,'city_plaza'),false);for(const b of CITY_LAYOUT.items.filter(p=>p.assetId.startsWith('building:')))assert.equal(walkable(b.x,b.z,.3,'city_plaza'),false);
});
test('healer validates map, range, death and independent wall-clock cooldown',()=>{
 const g=city();g.p.hp=1;g.p.mp=0;assert.equal(healerHeal(g,1000),false);
 Object.assign(g.p,HEALER);assert.equal(healerHeal(g,1000),true);assert.equal(g.p.hp,g.p.maxHp);assert.equal(g.p.mp,g.p.maxMp);
 g.p.hp=1;assert.equal(healerHeal(g,60999),false);assert.equal(g.p.hp,1);assert.equal(healerHeal(g,61000),true);
 g.p.dead=true;assert.equal(healerHeal(g,121000),false);
 const meadow=createGame();Object.assign(meadow.p,HEALER);assert.equal(healerHeal(meadow,121000),false);
});
test('death in either map restores resources at city clock tower',()=>{
 for(const g of [city(),createGame()]){g.p.dead=true;g.p.hp=0;revive(g);assert.equal(g.p.mapId,'city_plaza');assert.equal(g.p.x,CITY_SPAWN.x);assert.equal(g.p.z,CITY_SPAWN.z);assert.equal(g.p.hp,g.p.maxHp);assert.equal(g.p.dead,false);}
});
