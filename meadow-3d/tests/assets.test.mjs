import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { assetJSON, assetFetch } from "../src/asset-request.ts";
const manifest = JSON.parse(
	readFileSync("meadow-3d/public/texture-manifest.json", "utf8"),
);
test("shipping texture pack uses hashed GPU/WebP variants, bounded dimensions and sprite-safe mipmaps", () => {
	for (const [logical, a] of Object.entries(manifest)) {
		const atelier = logical.includes('/preview/');
		assert.ok(a.size.every((n) => (atelier || n <= 2048) && n % 4 === 0), logical);
		if (atelier) { assert.equal(a.cpu, true); assert.equal(a.ktx2, null); }
		assert.match(a.webp, /-[a-f0-9]{10}\.webp$/);
		assert.ok(existsSync("meadow-3d/public" + a.webp));
		assert.ok(existsSync("meadow-3d/" + a.source));
		if (a.ktx2) {
			const b = readFileSync("meadow-3d/public" + a.ktx2);
			assert.equal(
				b.subarray(0, 12).toString("hex"),
				"ab4b5458203230bb0d0a1a0a",
			);
			assert.equal(b.readUInt32LE(20), a.size[0]);
			assert.equal(b.readUInt32LE(24), a.size[1]);
			assert.equal(b.readUInt32LE(40) > 1, a.mips);
		}
		if (/hero-|king-|slime-/.test(logical)) assert.equal(a.mips, false);
	}
});
test("asset requests retry twice, including body failures; success returns parsed data", async () => {
	const original = global.fetch;
	let calls = 0;
	global.fetch = async () => {
		calls++;
		if (calls === 1) throw Error("offline");
		if (calls === 2)
			return new Response(
				new ReadableStream({
					start(c) {
						c.error(Error("body interrupted"));
					},
				}),
			);
		return new Response('{"ready":true}', {
			headers: { "Content-Type": "application/json" },
		});
	};
	try {
		assert.deepEqual(await assetJSON("/test"), { ready: true });
		assert.equal(calls, 3);
	} finally {
		global.fetch = original;
	}
});
test("asset HTTP failures stop after three attempts", async () => {
	const original = global.fetch;
	let calls = 0;
	global.fetch = async () => {
		calls++;
		return new Response("", { status: 503 });
	};
	try {
		await assert.rejects(assetFetch("/failed"));
		assert.equal(calls, 3);
	} finally {
		global.fetch = original;
	}
});
test("asset fetch concurrency is bounded so slow connections retain the twenty-second budget", async () => {
	const original = global.fetch;
	let active = 0,
		max = 0;
	global.fetch = async () => {
		max = Math.max(max, ++active);
		await new Promise((r) => setTimeout(r, 10));
		active--;
		return new Response("{}");
	};
	try {
		await Promise.all(Array.from({ length: 12 }, (_, i) => assetJSON("/" + i)));
		assert.equal(max, 3);
	} finally {
		global.fetch = original;
	}
});
