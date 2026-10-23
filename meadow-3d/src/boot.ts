import './pc-only';
import { assetJSON } from "./asset-request";
declare global {
	interface Window {
		tnBuild?: string;
		tnBoot: {
			activity?: () => void;
			stage: (index: number, value?: number) => void;
			fail: (message?: string, code?: string) => void;
			staleCheck?: () => Promise<boolean>;
			readonly progress: number;
		};
	}
}
// Lets boot.js tell whether the server has moved to another build mid-load (see tnBoot.staleCheck).
window.tnBuild = import.meta.env.VITE_BUILD_ID;
void import("./main").catch((error) => {
	console.error("main module failed", error);
	window.tnBoot.fail("เปิดทุ่งหญ้าไม่สำเร็จ กรุณาลองใหม่", "module");
});
assetJSON<string[]>("/loading-tips.json")
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
