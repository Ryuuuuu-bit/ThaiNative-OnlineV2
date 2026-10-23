import {isMobileDevice} from './pc-device';

if (isMobileDevice(navigator)) {
 document.documentElement.dataset.pcOnly = 'true';
 const dialog = document.createElement('dialog');
 dialog.setAttribute('aria-labelledby', 'pc-only-title');
 dialog.setAttribute('aria-describedby', 'pc-only-description');
 // Keep this notice independent of each entry's game/portal styles.
 dialog.style.cssText = 'border:1px solid #b99a60;border-radius:20px;padding:0;max-width:440px;width:calc(100% - 40px);max-height:90dvh;overflow:auto;background:#142b2a;color:#f7eed9;box-shadow:0 24px 90px #0009;';
 const content = document.createElement('div');
 const root = content.attachShadow({mode: 'open'});
 root.innerHTML = `<style>:host{font:16px/1.8 system-ui,sans-serif;text-align:center}section{padding:32px 24px}small{color:#d6bc88;letter-spacing:2px;font-size:11px}svg{display:block;margin:20px auto;color:#d6bc88}h1{font-size:25px;line-height:1.5;margin:12px 0}p{margin:12px 0;color:#dce4dd}footer{margin-top:24px;font-size:13px;color:#b4c7bd}</style><section><small>THE BEGINNING ONLINE · DEVELOPMENT</small><svg width="64" height="56" viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="3" width="56" height="36" rx="4"/><path d="M24 40v11m16-11v11M16 52h32"/></svg><h1>ขณะนี้เล่นได้บน PC เท่านั้น</h1><p>เกมอยู่ระหว่างการพัฒนา<br>กรุณาเปิดเกมผ่านคอมพิวเตอร์เพื่อเข้าเล่น</p><footer>ยังไม่รองรับการเล่นบนมือถือและแท็บเล็ต</footer></section>`;
 // Accessible names stay in the light DOM so aria-labelledby works across browsers.
 const title = document.createElement('span');
 title.id = 'pc-only-title';title.textContent = 'ขณะนี้เล่นได้บน PC เท่านั้น';title.hidden = true;
 const description = document.createElement('span');
 description.id = 'pc-only-description';description.textContent = 'เกมอยู่ระหว่างการพัฒนา กรุณาเปิดเกมผ่านคอมพิวเตอร์เพื่อเข้าเล่น ยังไม่รองรับมือถือและแท็บเล็ต';description.hidden = true;
 dialog.append(title, description, content);
 document.body.append(dialog);
 dialog.addEventListener('cancel', event => event.preventDefault());
 dialog.showModal();
 // Suspend importing entry points: no renderer, login flow or game socket starts.
 await new Promise<void>(() => {});
}
