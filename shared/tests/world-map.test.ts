import test from "node:test";
import assert from "node:assert/strict";
import { GATE_LINKS, GATES,MAP_IDS,LAYOUTS,MAP_INFO, gateRoute, travelDestination, type MapId } from "../src/index.node.js";

test("gate links match where each gate really leads (closed gates lead nowhere)", () => {
	for (const [map, gates] of Object.entries(GATES) as [MapId, Record<string, { x: number; z: number }>][]) {
		for (const [gate, at] of Object.entries(gates)) assert.equal(travelDestination(map, gate, at)?.mapId, GATE_LINKS[map][gate], `${map}/${gate}`);
	}
});

test("routes chain gates across maps, shortest first", () => {
	assert.deepEqual(gateRoute("city_plaza", "canyon"), [{ map: "city_plaza", gate: "west" }]);
	assert.deepEqual(gateRoute("meadow", "forest"), [{ map: "meadow", gate: "north" }, { map: "city_plaza", gate: "east" }]);
	assert.deepEqual(gateRoute("canyon", "canyon"), []);
	const maps = Object.keys(GATE_LINKS) as MapId[];
	for (const a of maps) for (const b of maps) if (a !== b) assert.ok(gateRoute(a, b).length > 0, `${a} → ${b}`);
});

test('World travel avoids the Lv50 desert shortcut for a Lv45 player and keeps it available to a Lv79 player',()=>{
 const low=gateRoute('temple','yokai',45),high=gateRoute('temple','yokai',79);
 assert.equal(low.length,6);assert.ok(!low.some(s=>s.map==='desert'));assert.equal(low[0].gate,'east');
 assert.deepEqual(gateRoute('temple','yokai',69),low);assert.equal(high.length,4);assert.equal(high[0].gate,'south');assert.ok(high.some(s=>s.map==='desert'));
 assert.deepEqual(gateRoute('temple','yokai'),high);assert.deepEqual(gateRoute('temple','temple',45),[]);
});

test('Level-aware routes remain continuous without loops, allow intentional high-level destinations and avoid newly populated ocean transit at low levels',()=>{
 for(const level of [5,35,45,69])for(const from of MAP_IDS)for(const to of MAP_IDS){
  const route=gateRoute(from,to,level);let at=from;const seen=new Set<MapId>([from]);
  for(const step of route){assert.equal(step.map,at);at=GATE_LINKS[at][step.gate];assert.ok(!seen.has(at));seen.add(at);}assert.equal(at,to);
 }
 assert.equal(gateRoute('ruins','yokai',1).length,1);
 const dragon=gateRoute('yokai','dragon',1);assert.ok(dragon.length>2);assert.ok(!dragon.some(s=>s.map==='ocean'));assert.ok(dragon.every(s=>s.map==='yokai'||s.map==='city_plaza'||parseInt(MAP_INFO[s.map].levels,10)<=50));
});
