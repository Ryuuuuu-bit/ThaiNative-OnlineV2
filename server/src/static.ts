import express from "express";
import type { Express } from "express";
import { resolve, basename, extname } from "node:path";
import { existsSync } from "node:fs";
export function serveStatic(app: Express, dir: string) {
	const root = resolve(dir);
	const headers = (res: any, path: string) => {
		if (path.endsWith("ktx2-worker-v1.js"))
			res.setHeader(
				"Content-Security-Policy",
				"default-src 'none'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'; connect-src 'self'",
			);
		const name = basename(path),
			immutable =
				/-[A-Za-z0-9_-]{8,}\.(?:js|css|webp|ktx2|jpg|png)$/.test(name) ||
				/-v\d+(?:@2x)?\.(?:png|jpg|webp|ktx2)$/.test(name) ||
				/basis[\\/]three-r185/.test(path);
		res.setHeader(
			"Cache-Control",
			extname(path) === ".html"
				? "no-cache"
				: extname(path) === ".json"
					? "public, max-age=60, must-revalidate"
					: immutable
						? "public, max-age=31536000, immutable"
						: "no-cache",
		);
	};
	app.use((req, res, next) => {
		if (
			!["GET", "HEAD"].includes(req.method) ||
			!/\.(?:js|css|json|html|wasm)$/.test(req.path)
		)
			return next();
		const path = resolve(root, "." + req.path);
		if (!path.startsWith(root + requireSeparator())) return next();
		const available = ["br", "gzip"].filter((e) =>
				existsSync(path + (e === "br" ? ".br" : ".gz")),
			),
			encoding = req.acceptsEncodings(...available, "identity");
		if (encoding === "identity") return next();
		if (!encoding) return next();
		headers(res, path);
		res.type(extname(path));
		res.setHeader("Content-Encoding", encoding);
		res.vary("Accept-Encoding");
		res.sendFile(path + (encoding === "br" ? ".br" : ".gz"), {
			cacheControl: false,
		});
	});
	app.use(express.static(root, { setHeaders: headers }));
	app.get("/{*path}", (req, res, next) => {
		if (extname(req.path)) {
			res.status(404).end();
			return;
		}
		res.setHeader("Cache-Control", "no-cache");
		res.sendFile(
			resolve(root, "index.html"),
			{ cacheControl: false },
			(err) => {
				if (err) next(err);
			},
		);
	});
}
function requireSeparator() {
	return process.platform === "win32" ? "\\" : "/";
}
