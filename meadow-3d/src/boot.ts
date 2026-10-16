declare global {
	interface Window {
		tnBoot: {
			stage: (index: number, value?: number) => void;
			fail: (message?: string, code?: string) => void;
			readonly progress: number;
		};
	}
}
void import("./main").catch(() =>
	window.tnBoot.fail("เปิดทุ่งหญ้าไม่สำเร็จ กรุณาลองใหม่", "module"),
);
fetch("/loading-tips.json")
	.then((r) => r.json())
	.then((tips: string[]) => {
		let i = 0;
		const el = document.querySelector("#loading-tip");
		if (el) {
			el.textContent = tips[0];
			setInterval(() => {
				el.textContent = tips[++i % tips.length];
			}, 5000);
		}
	})
	.catch(() => {});
export {};
