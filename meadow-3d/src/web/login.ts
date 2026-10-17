import'../web.css';import'../web-glass.css';import{api,post,showError,ApiError}from'./api';import{getMe,guestKey,startGuest,safeNext,forgetGuest,mountAccountChip,loginPassword,register,logout,type Me}from'./session';import{kindLabel,uidChip,mountBuild}from'./account-ui';
declare global{interface Window{google?:any}}
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const error=$('#login-error'),note=$('#guest-note'),next=safeNext(new URLSearchParams(location.search).get('next'));
mountBuild();

// ---------- Tabs (WAI-ARIA tabs: arrows/Home/End move, Enter/Space or click selects) ----------
const tabs=[...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
function selectTab(tab:HTMLButtonElement,focus=false){for(const t of tabs){const on=t===tab;t.setAttribute('aria-selected',String(on));t.tabIndex=on?0:-1;document.getElementById(t.getAttribute('aria-controls')!)!.hidden=!on;}if(focus)tab.focus();error.hidden=true;}
for(const t of tabs){t.onclick=()=>selectTab(t);t.onkeydown=e=>{const i=tabs.indexOf(t),to={ArrowRight:i+1,ArrowLeft:i-1,Home:0,End:tabs.length-1}[e.key];if(to===undefined)return;e.preventDefault();selectTab(tabs[(to+tabs.length)%tabs.length],true);};}
const loginForm=$<HTMLFormElement>('#login-form'),registerForm=$<HTMLFormElement>('#register-form');
function mode(which:'login'|'register',focus=true){loginForm.hidden=which!=='login';registerForm.hidden=which!=='register';if(focus)$<HTMLInputElement>(`#${which}-username`).focus();}
for(const b of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))b.onclick=()=>mode(b.dataset.mode as 'login'|'register');
function fromHash(){const hash=location.hash.slice(1);if(hash==='guest')selectTab($('#tab-guest'));else if(hash==='google')selectTab($('#tab-google'));else if(hash==='register'||hash==='login'){selectTab($('#tab-account'));mode(hash,false);}}
fromHash();addEventListener('hashchange',fromHash);

for(const b of document.querySelectorAll<HTMLButtonElement>('.reveal'))b.onclick=()=>{const input=document.getElementById(b.getAttribute('aria-controls')!) as HTMLInputElement,show=input.type==='password';input.type=show?'text':'password';b.setAttribute('aria-pressed',String(show));b.textContent=show?'ซ่อน':'แสดง';b.setAttribute('aria-label',show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน');};

// ---------- Field validation (mirrors the server rules; the server stays authoritative) ----------
function fieldError(input:HTMLInputElement,message=''){const out=document.getElementById(input.id+'-error')!;out.textContent=message;out.hidden=!message;input.setAttribute('aria-invalid',String(!!message));return!message;}
const USERNAME=/^[A-Za-z0-9_]{3,20}$/;
function validate(form:'login'|'register'){
 const u=$<HTMLInputElement>(`#${form}-username`),p=$<HTMLInputElement>(`#${form}-password`),checks:[HTMLInputElement,string][]=[];
 checks.push([u,!u.value?'กรุณากรอกชื่อผู้ใช้':form==='register'&&!USERNAME.test(u.value)?'ชื่อผู้ใช้ 3–20 ตัว ใช้ได้เฉพาะ a–z, 0–9 และ _':'']);
 checks.push([p,!p.value?'กรุณากรอกรหัสผ่าน':form==='register'&&[...p.value].length<8?'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว':'']);
 if(form==='register'){const c=$<HTMLInputElement>('#register-confirm');checks.push([c,!c.value?'กรุณายืนยันรหัสผ่าน':c.value!==p.value?'รหัสผ่านทั้งสองช่องไม่ตรงกัน':'']);}
 let first:HTMLInputElement|undefined;for(const[input,message]of checks)if(!fieldError(input,message))first??=input;first?.focus();return!first;
}
for(const input of document.querySelectorAll<HTMLInputElement>('.auth-form input:not([type=checkbox])'))input.addEventListener('input',()=>{if(input.getAttribute('aria-invalid')==='true')fieldError(input);});
// Server codes that belong to one field; everything else (LOGIN_FAILED, LOGIN_LOCKED, RATE_LIMIT…) shows on the form.
const FIELD:Record<string,string>={USERNAME_TAKEN:'register-username',INVALID_USERNAME:'register-username',USERNAME_RESERVED:'register-username',WEAK_PASSWORD:'register-password',PASSWORD_MISMATCH:'register-confirm'};
function serverError(form:'login'|'register',e:unknown){const target=e instanceof ApiError&&FIELD[e.code]&&form==='register'?document.getElementById(FIELD[e.code]) as HTMLInputElement:undefined;if(target){fieldError(target,(e as Error).message);target.focus();}else showError($(`#${form}-form-error`),e);}
async function busy(button:HTMLButtonElement,run:()=>Promise<void>){button.disabled=true;button.setAttribute('aria-busy','true');try{await run();}finally{button.disabled=false;button.removeAttribute('aria-busy');}}

let me:Me|null=null;
loginForm.onsubmit=e=>{e.preventDefault();$('#login-form-error').hidden=true;if(!validate('login'))return;void busy($('#login-submit'),async()=>{try{await loginPassword($<HTMLInputElement>('#login-username').value,$<HTMLInputElement>('#login-password').value);location.assign(next);}catch(err){$<HTMLInputElement>('#login-password').value='';serverError('login',err);}});};
registerForm.onsubmit=e=>{e.preventDefault();$('#register-form-error').hidden=true;if(!validate('register'))return;void busy($('#register-submit'),async()=>{try{const out=await register({username:$<HTMLInputElement>('#register-username').value,password:$<HTMLInputElement>('#register-password').value,confirmPassword:$<HTMLInputElement>('#register-confirm').value,linkGuest:me?.account.kind==='guest'&&$<HTMLInputElement>('#link-guest').checked});
 showSignedIn({account:out.account,selectedCharacterId:null},out.linked?'ผูกบัญชีสำเร็จ · ตัวละครเดิมย้ายมาแล้ว':'สมัครบัญชีสำเร็จ');void mountAccountChip();}catch(err){serverError('register',err);}});};
$('#login-guest').onclick=function(this:HTMLButtonElement){void busy(this,async()=>{try{await startGuest();location.assign(next);}catch(e){showError(error,e);}});};
$('#signed-in-logout').onclick=function(this:HTMLButtonElement){void busy(this,async()=>{try{await logout();}catch(e){showError(error,e);}});};

function showSignedIn(m:Me,heading='เข้าสู่ระบบแล้ว'){me=m;const a=m.account;$('#signed-in').hidden=false;$('#signed-in-heading').textContent=heading;$('#signed-in-name').textContent=a.displayName;$('#signed-in-kind').textContent=kindLabel(a.kind);$('#signed-in-uid').replaceChildren(uidChip(a.uid));$<HTMLAnchorElement>('#signed-in-continue').href=next;
 const guest=a.kind==='guest';$('#auth-methods').hidden=!guest;$('#link-guest-row').hidden=!guest;note.hidden=!guest;
 if(guest){note.textContent='คุณกำลังเล่นเป็นผู้เยี่ยมชม · สมัครชื่อผู้ใช้หรือผูก Google เพื่อไม่ให้ข้อมูลหาย';$('#auth-title').textContent='เก็บการผจญภัยไว้กับบัญชี';$('#register-heading').textContent='สมัครบัญชีให้ผู้เยี่ยมชมนี้';}
 else $('#auth-title').textContent='ยินดีต้อนรับกลับ';}

async function boot(){me=await getMe();
 if(me)showSignedIn(me);else if(guestKey()){note.hidden=false;note.textContent='พบข้อมูลผู้เยี่ยมชมเดิมในเครื่องนี้ · กดเล่นแบบผู้เยี่ยมชมเพื่อกลับไปยังตัวละครเดิม';$('#login-guest').textContent='กลับไปยังผู้เยี่ยมชมเดิม →';}
 const config=await api('/config');const status=$('#google-status');
 if(!config.googleClientId){status.textContent='การเข้าสู่ระบบด้วย Google ยังไม่เปิดใช้ในเซิร์ฟเวอร์นี้ · ใช้ชื่อผู้ใช้หรือเล่นแบบผู้เยี่ยมชมได้';return;}
 status.textContent='กำลังเตรียมการเข้าสู่ระบบด้วย Google…';const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
 const blocked=()=>{status.textContent='โหลดการเข้าสู่ระบบด้วย Google ไม่สำเร็จ · ใช้ชื่อผู้ใช้หรือเล่นแบบผู้เยี่ยมชมได้';};script.onerror=blocked;
 const timeout=setTimeout(blocked,8000);
 script.onload=()=>{clearTimeout(timeout);if(!window.google?.accounts?.id){blocked();return;}status.textContent='';const target=$('#google-button');target.hidden=false;window.google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:async({credential}:{credential:string})=>{try{await post('/google',{credential});if(me?.account.kind==='guest')forgetGuest();location.assign(next);}catch(e){showError(error,e);}}});window.google.accounts.id.renderButton(target,{type:'standard',theme:'outline',size:'large',text:me?.account.kind==='guest'?'continue_with':'signin_with',locale:'th',width:Math.min(320,target.clientWidth||320)});};document.head.append(script);
}void boot().catch(e=>showError(error,e));

void mountAccountChip();
