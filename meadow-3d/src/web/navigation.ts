const header = document.querySelector<HTMLElement>('.tn-header');
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
