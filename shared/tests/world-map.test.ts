import test from "node:test";
import assert from "node:assert/strict";
import { GATE_LINKS, GATES, gateRoute, travelDestination, type MapId } from "../src/index.node.js";

test("gate links match where each gate really leads (closed gates lead nowhere)", () => {
	for (const [map, gates] of Object.entries(GATES) as [MapId, Record<string, { x: number; z: number }>][]) {
		for (const [gate, at] of Object.entries(gates)) assert.equal(travelDestination(map, gate, at)?.mapId, GATE_LINKS[map][gate], `${map}/${gate}`);
	}
});

test("routes chain gates across maps, shortest first", () => {
	assert.deepEqual(gateRoute("city_plaza", "canyon"), [{ map: "city_plaza", gate: "east" }, { map: "forest", gate: "east" }, { map: "ruins", gate: "east" }]);
	assert.deepEqual(gateRoute("meadow", "forest"), [{ map: "meadow", gate: "north" }, { map: "city_plaza", gate: "east" }]);
	assert.deepEqual(gateRoute("canyon", "canyon"), []);
	const maps = Object.keys(GATE_LINKS) as MapId[];
	for (const a of maps) for (const b of maps) if (a !== b) assert.ok(gateRoute(a, b).length > 0, `${a} → ${b}`);
});
