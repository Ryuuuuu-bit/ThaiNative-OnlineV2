export {};
const publicHeader=document.querySelector<HTMLElement>('[data-public-header]');
if(publicHeader)publicHeader.innerHTML=`<header class="tn-header"><div class="tn-header-inner"><a class="tn-brand" href="/" aria-label="The Beginning Online หน้าหลัก"><img src="/assets/brand/logo-v3-512.webp" width="512" height="168" alt="The Beginning Online"><span><i aria-hidden="true"></i> โลกแห่งนักล่า <small>ช่วงทดสอบ</small></span></a><button class="tn-menu-toggle" type="button" aria-expanded="false" aria-controls="tn-navigation"><span aria-hidden="true"></span><span class="sr-only">เปิดเมนูหลัก</span></button><div class="tn-navigation" id="tn-navigation"><nav aria-label="เมนูหลัก"><a href="/#changelog">ข่าวจากนคร</a><a href="/world.html">แผนที่โลก</a><a href="/#professions">เส้นทางอาชีพ</a><a href="/monsters.html">มอนสเตอร์</a><a href="/items.html">ของสะสม</a><a href="/#guide">คู่มือ</a></nav><div class="tn-account"><div id="account-chip" class="account-chip"><a href="/login.html">เข้าสู่ระบบ / สมัครบัญชี</a></div></div></div><a class="tn-header-play" href="/#play-now">เริ่มผจญภัย <span aria-hidden="true">↗</span></a></div></header>`;
const header = document.querySelector<HTMLElement>('.tn-header');
const navigation=header?.querySelector('nav');
const worldLink=navigation?.querySelector<HTMLAnchorElement>('a[href="/#explore-world"]');
if(worldLink){worldLink.href='/world.html';worldLink.textContent='แผนที่โลก';}
if(navigation&&!navigation.querySelector('a[href="/items.html"]')){
 const items=document.createElement('a');items.href='/items.html';items.textContent='ของสะสม';
 const characters=navigation.querySelector('a[href="/characters.html"]');
 if(characters)characters.replaceWith(items);else navigation.append(items);
}
navigation?.querySelectorAll<HTMLAnchorElement>('a').forEach(a=>{if(a.pathname===location.pathname&&!a.hash)a.setAttribute('aria-current','page');});
const toggle = header?.querySelector<HTMLButtonElement>('.tn-menu-toggle');

if (header && toggle) {
 const setOpen = (open: boolean) => {
  header.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.sr-only')!.textContent = open ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก';
 };
 toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
 header.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => setOpen(false)));
 document.addEventListener('click', event => {
  if (event.target instanceof Node && !header.contains(event.target)) setOpen(false);
 });
 document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
   setOpen(false);
   toggle.focus();
  }
 });
 matchMedia('(min-width: 1001px)').addEventListener('change', () => setOpen(false));
}
