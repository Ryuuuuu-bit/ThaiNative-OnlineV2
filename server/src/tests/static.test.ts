import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, get } from "node:http";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	brotliCompressSync,
	gzipSync,
	brotliDecompressSync,
	gunzipSync,
} from "node:zlib";
import { createApp } from "../app.js";
import { MemoryStore } from "../store/memory.js";
test("static transport preserves immutable assets, revalidated HTML/JSON, ETag and both compression encodings", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "tn-static-"));
	await mkdir(join(dir, "assets"));
	await mkdir(join(dir, "basis/three-r185"), { recursive: true });
	const text = "<html>" + "painted ".repeat(300) + "</html>";
	for (const file of [
		"play.html",
		"data.json",
		"assets/main-abcdefgh.js",
		"basis/three-r185/ktx2-worker-v1.js",
	]) {
		await writeFile(join(dir, file), text);
		await writeFile(join(dir, file + ".br"), brotliCompressSync(text));
		await writeFile(join(dir, file + ".gz"), gzipSync(text));
	}
	await writeFile(
		join(dir, "assets/hero-v1-0123456789.ktx2"),
		"compressed image",
	);
	const app = createApp({ store: new MemoryStore(), staticDir: dir }),
		server = createServer(app).listen(0, "127.0.0.1");
	await once(server, "listening");
	t.after(async () => {
		server.closeAllConnections();
		await new Promise<void>((r) => server.close(() => r()));
		await rm(dir, { recursive: true, force: true });
	});
	const base = `http://127.0.0.1:${(server.address() as any).port}`;
	for (const path of [
		"/play.html",
		"/data.json",
		"/assets/main-abcdefgh.js",
		"/assets/hero-v1-0123456789.ktx2",
	]) {
		const r = await fetch(base + path);
		assert.match(
			r.headers.get("cache-control")!,
			path.endsWith(".html")
				? /^no-cache$/
				: path.endsWith(".json")
					? /max-age=60/
					: /immutable/,
		);
		assert.ok(r.headers.get("etag"));
		if (path.endsWith("ktx2"))
			assert.equal(r.headers.get("content-encoding"), null);
	}
	const first = await fetch(base + "/data.json", {
		headers: { "Accept-Encoding": "gzip" },
	});
	await new Promise<void>((resolve, reject) => {
		get(
			base + "/data.json",
			{
				headers: {
					"Accept-Encoding": "gzip",
					"If-None-Match": first.headers.get("etag")!,
				},
			},
			(r) => {
				r.resume();
				try {
					assert.equal(r.statusCode, 304);
					resolve();
				} catch (e) {
					reject(e);
				}
			},
		).on("error", reject);
	});
	for (const encoding of ["br", "gzip"])
		await new Promise<void>((resolve, reject) => {
			get(
				base + "/assets/main-abcdefgh.js",
				{ headers: { "Accept-Encoding": encoding } },
				(r) => {
					const chunks: Buffer[] = [];
					r.on("data", (c) => chunks.push(c));
					r.on("end", () => {
						try {
							assert.equal(r.headers["content-encoding"], encoding);
							assert.equal(
								(encoding === "br" ? brotliDecompressSync : gunzipSync)(
									Buffer.concat(chunks),
								).toString(),
								text,
							);
							resolve();
						} catch (e) {
							reject(e);
						}
					});
				},
			).on("error", reject);
		});
	const worker = await fetch(base + "/basis/three-r185/ktx2-worker-v1.js");
	assert.match(worker.headers.get("content-security-policy")!, /'unsafe-eval'/);
	const html = await fetch(base + "/play.html");
	assert.doesNotMatch(
		html.headers.get("content-security-policy")!,
		/ 'unsafe-eval'/,
	);
	assert.equal((await fetch(base + "/missing-texture.webp")).status, 404);
});
