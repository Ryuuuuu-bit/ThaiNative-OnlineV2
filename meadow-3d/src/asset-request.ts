let active = 0;
const queue: { priority: RequestPriority; run: () => void }[] = [];
function schedule<T>(priority: RequestPriority, job: () => Promise<T>) {
	return new Promise<T>((resolve, reject) => {
		queue.push({
			priority,
			run: () => {
				active++;
				void job()
					.then(resolve, reject)
					.finally(() => {
						active--;
						pump();
					});
			},
		});
		pump();
	});
}
function pump() {
	while (active < 3 && queue.length) {
		queue.sort(
			(a, b) => Number(a.priority === "low") - Number(b.priority === "low"),
		);
		queue.shift()!.run();
	}
}
export async function assetFetch(
	url: string,
	priority: RequestPriority = "high",
) {
	return retryAsset(
		url,
		priority,
		async (response) =>
			new Response(await response.arrayBuffer(), {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			}),
	);
}
async function retryAsset<T>(
	url: string,
	priority: RequestPriority,
	read: (response: Response) => Promise<T>,
) {
	let last: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return await schedule(priority, async () => {
				if (typeof window !== "undefined") window.tnBoot?.activity?.();
				const response = await fetch(url, {
					signal: AbortSignal.timeout(20000),
					priority,
				});
				if (!response.ok) throw Error("asset response");
				return await read(response);
			});
		} catch (e) {
			last = e;
			if (attempt < 2)
				await new Promise((r) => setTimeout(r, 300 * 3 ** attempt));
		}
	}
	throw last;
}
export async function assetJSON<T>(url: string) {
	return retryAsset<T>(url, "high", (response) => response.json());
}
export async function assetImage(
	url: string,
	priority: RequestPriority = "high",
) {
	return retryAsset(url, priority, async (response) => {
		const blob = await response.blob(),
			image = new Image(),
			objectURL = URL.createObjectURL(blob);
		try {
			image.src = objectURL;
			await image.decode();
			return image;
		} finally {
			URL.revokeObjectURL(objectURL);
		}
	});
}
export function reportDeferred() {
	void fetch("/api/boot-report", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			code: "asset-deferred",
			page: "play",
			progress: 100,
		}),
		keepalive: true,
	}).catch(() => {});
}
