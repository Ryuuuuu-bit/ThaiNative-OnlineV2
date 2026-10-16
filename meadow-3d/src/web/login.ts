import'../web.css';import{api,post,showError}from'./api';import{getMe,guestKey,startGuest,safeNext,forgetGuest,mountAccountChip}from'./session';
declare global{interface Window{google?:any}}
const error=document.querySelector<HTMLElement>('#login-error')!,note=document.querySelector<HTMLElement>('#guest-note')!,next=safeNext(new URLSearchParams(location.search).get('next'));
document.querySelector<HTMLButtonElement>('#login-guest')!.onclick=async function(this:HTMLButtonElement){this.disabled=true;try{await startGuest();location.assign(next);}catch(e){showError(error,e);this.disabled=false;}};
async function boot(){const me=await getMe();if(me?.account.kind==='guest'){note.hidden=false;note.textContent='คุณกำลังเล่นเป็นผู้เยี่ยมชม · ผูกบัญชี Google เพื่อไม่ให้ข้อมูลหาย';}else if(me){note.hidden=false;note.textContent=`เข้าสู่ระบบแล้ว: ${me.account.displayName}`;}
 else if(guestKey()){note.hidden=false;note.textContent='พบข้อมูลผู้เยี่ยมชม เดิมในเครื่องนี้ · กดเล่นแบบผู้เยี่ยมชม เพื่อกลับไปยังตัวละครเดิม';document.querySelector('#login-guest')!.textContent='กลับไปยังผู้เยี่ยมชม เดิม →';}
 const config=await api('/config');const status=document.querySelector<HTMLElement>('#google-status')!;
 if(!config.googleClientId){status.textContent='การเข้าสู่ระบบด้วย Google ยังไม่เปิดใช้ในเซิร์ฟเวอร์นี้';return;}
 status.textContent='กำลังเตรียมการเข้าสู่ระบบด้วย Google…';const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
 const blocked=()=>{status.textContent='โหลดการเข้าสู่ระบบด้วย Google ไม่สำเร็จ · คุณยังเล่นแบบผู้เยี่ยมชม ได้';};script.onerror=blocked;
 const timeout=setTimeout(blocked,8000);
 script.onload=()=>{clearTimeout(timeout);if(!window.google?.accounts?.id){blocked();return;}status.textContent='';const target=document.querySelector<HTMLElement>('#google-button')!;target.hidden=false;window.google.accounts.id.initialize({client_id:config.googleClientId,auto_select:false,callback:async({credential}:{credential:string})=>{try{await post('/google',{credential});if(me?.account.kind==='guest')forgetGuest();location.assign(next);}catch(e){showError(error,e);}}});window.google.accounts.id.renderButton(target,{type:'standard',theme:'outline',size:'large',text:me?.account.kind==='guest'?'continue_with':'signin_with',locale:'th',width:Math.min(320,target.clientWidth||320)});};document.head.append(script);
}void boot().catch(e=>showError(error,e));

void mountAccountChip();
