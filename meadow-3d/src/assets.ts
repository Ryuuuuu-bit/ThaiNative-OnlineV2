import * as T from "three";
interface Asset {
	webp: string;
	ktx2: string | null;
	hitMask: string | null;
	mips: boolean;
	cpu: boolean;
}
export type TextureManifest = Record<string, Asset>;
import {
	assetFetch,
	assetImage,
	assetJSON,
	reportDeferred,
} from "./asset-request";
export { assetFetch, assetImage, assetJSON } from "./asset-request";
/** Composite requests keep critical progress honest through retries, fallback, decode and transcode. */
export class PaintedLoader {
	private metrics = {
		ktx2: 0,
		webp: 0,
		criticalFailures: 0,
		deferredFailures: 0,
	};
	private manifest: TextureManifest;
	private started = false;
	private jobs: (() => Promise<void>)[] = [];
	private active = 0;
	private ktx: Promise<any> | null = null;
	private ktxDisabled = false;
	constructor(
		public manager: T.LoadingManager,
		private renderer: T.WebGLRenderer,
		manifest: TextureManifest,
	) {
		this.manifest = manifest;
	}
	isDeferred(url: string) {
		return /hero-(?:spin|cast|hit|dodge|death)|king-|env-far|tile-stone/.test(
			url,
		);
	}
	startDeferred() {
		this.started = true;
		this.pump();
	}
	snapshot() {
		return {
			...this.metrics,
			queued: this.jobs.length,
			active: this.active,
			ktxDisabled: this.ktxDisabled,
		};
	}
	private pump() {
		while (this.started && this.active < 2 && this.jobs.length) {
			this.active++;
			void this.jobs.shift()!().finally(() => {
				this.active--;
				this.pump();
			});
		}
	}
	private schedule(url: string, job: () => Promise<void>) {
		if (this.isDeferred(url)) {
			this.jobs.push(job);
			this.pump();
		} else void job();
	}
	private getKtx() {
		if (!this.ktx)
			this.ktx = (async () => {
				const base = "/basis/three-r185/";
				const [{ KTX2Loader }, js, wasm] = await Promise.all([
					import("three/addons/loaders/KTX2Loader.js"),
					assetFetch(base + "basis_transcoder.js").then((r) => r.text()),
					assetFetch(base + "basis_transcoder.wasm").then((r) =>
						r.arrayBuffer(),
					),
				]);
				T.Cache.enabled = true;
				T.Cache.add(base + "basis_transcoder.js", js);
				T.Cache.add(base + "basis_transcoder.wasm", wasm);
				const loader: any = new KTX2Loader()
					.setTranscoderPath(base)
					.setWorkerLimit(2)
					.detectSupport(this.renderer);
				await loader.init();
				URL.revokeObjectURL(loader.workerSourceURL);
				loader.workerSourceURL = base + "ktx2-worker-v1.js";
				const create = loader.workerPool.workerCreator;
				loader.workerPool.setWorkerCreator(() => {
					const worker = create();
					worker.addEventListener("error", (event: ErrorEvent) =>
						event.preventDefault(),
					);
					return worker;
				});
				return loader;
			})().catch((error) => {
				this.ktxDisabled = true;
				throw error;
			});
		return this.ktx;
	}
	load(
		url: string,
		onLoad?: (texture: T.Texture) => void,
		_onProgress?: (event: ProgressEvent) => void,
		onError?: (error: unknown) => void,
	): T.Texture {
		const entry = this.manifest[url],
			critical = !this.isDeferred(url),
			texture = new T.Texture();
		texture.colorSpace = T.SRGBColorSpace;
		texture.minFilter = entry?.mips
			? T.LinearMipmapLinearFilter
			: T.LinearFilter;
		texture.generateMipmaps = entry?.mips ?? false;
		if (!critical) {
			const blank = document.createElement("canvas");
			blank.width = blank.height = 2;
			texture.image = blank;
			texture.needsUpdate = true;
		}
		if (critical) this.manager.itemStart(url);
		this.schedule(url, async () => {
			try {
				let loaded: T.Texture | undefined;
				let hit: HTMLImageElement | undefined;
				const supported = [
					"WEBGL_compressed_texture_astc",
					"WEBGL_compressed_texture_etc",
					"WEBGL_compressed_texture_s3tc",
					"EXT_texture_compression_bptc",
					"WEBGL_compressed_texture_pvrtc",
				].some((e) => this.renderer.extensions.has(e));
				if (entry?.ktx2 && !this.ktxDisabled && supported) {
					try {
						const [loader, buffer, mask] = await Promise.all([
							this.getKtx(),
							assetFetch(entry.ktx2, critical ? "high" : "low").then((r) =>
								r.arrayBuffer(),
							),
							entry.hitMask
								? assetImage(entry.hitMask, critical ? "high" : "low")
								: null,
						]);
						loaded = await Promise.race([
							new Promise<T.Texture>((resolve, reject) =>
								loader.parse(buffer, resolve, reject),
							),
							new Promise<never>((_, reject) =>
								setTimeout(() => reject(Error("transcode timeout")), 20000),
							),
						]);
						hit = mask || undefined;
					} catch {
						/* Per-file failure falls back without disabling other GPU assets. */
					}
				}
				if (loaded) {
					this.metrics.ktx2++;
					const { wrapS, wrapT, anisotropy, onUpdate } = texture,
						repeat = texture.repeat.clone(),
						offset = texture.offset.clone();
					texture.copy(loaded);
					Object.assign(texture, {
						isCompressedTexture: (loaded as any).isCompressedTexture,
						wrapS,
						wrapT,
						anisotropy,
						onUpdate,
					});
					texture.repeat.copy(repeat);
					texture.offset.copy(offset);
					texture.userData.hitMask = hit;
					texture.flipY = false;
				} else {
					this.metrics.webp++;
					texture.image = await assetImage(
						entry?.webp || url,
						critical ? "high" : "low",
					);
					texture.flipY = true;
					texture.generateMipmaps = entry?.mips ?? false;
				}
				texture.minFilter = entry?.mips
					? T.LinearMipmapLinearFilter
					: T.LinearFilter;
				texture.needsUpdate = true;
				texture.userData.ready = true;
				onLoad?.(texture);
			} catch (error) {
				texture.userData.failed = true;
				if (critical) {
					this.metrics.criticalFailures++;
					this.manager.itemError(url);
				} else {
					this.metrics.deferredFailures++;
					reportDeferred();
				}
				onError?.(error);
			} finally {
				if (critical) this.manager.itemEnd(url);
			}
		});
		return texture;
	}
	json<T>(url: string, onLoad: (data: T) => void) {
		this.manager.itemStart(url);
		void assetJSON<T>(
			url +
				(url.includes("?") ? "&" : "?") +
				"v=" +
				import.meta.env.VITE_BUILD_ID,
		)
			.then(onLoad)
			.catch(() => this.manager.itemError(url))
			.finally(() => this.manager.itemEnd(url));
	}
}
