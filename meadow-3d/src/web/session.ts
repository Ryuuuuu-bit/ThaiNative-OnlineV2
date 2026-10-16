import{api,post,ApiError}from'./api';
export interface Account{id:string;kind:'guest'|'google';displayName:string}
export interface Me{account:Account;selectedCharacterId:string|null}
const KEY='tn_guest_key';
export function guestKey(){try{return localStorage.getItem(KEY);}catch{return null;}}
export function forgetGuest(){try{localStorage.removeItem(KEY);}catch{}}
export async function getMe():Promise<Me|null>{try{return await api<Me>('/me');}catch(e){if(e instanceof ApiError&&e.status===401)return null;throw e;}}
export async function requireLogin(){const me=await getMe();if(!me){location.replace('/login.html?next='+encodeURIComponent(location.pathname+location.search));return null;}return me;}
export async function logout(){await post('/logout');location.assign('/login.html');}
export async function startGuest(){const existing=await getMe();if(existing)return existing;const key=guestKey();if(key){try{return await post('/guest/resume',{guestKey:key});}catch(e){if(!(e instanceof ApiError&&e.status===401))throw e;forgetGuest();}}
 const data=await post('/guest');if(data.guestKey)try{localStorage.setItem(KEY,data.guestKey);}catch{}return data;
}
export function safeNext(value:string|null){return value&&/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value)&&!/^\/(?:login|index)\.html(?:[?#]|$)/.test(value)?value:'/characters.html';}
export async function mountAccountChip(){const chip=document.querySelector<HTMLElement>('#account-chip');if(!chip)return;try{const me=await getMe();chip.replaceChildren();if(me){const name=document.createElement('a');name.href='/characters.html';name.textContent=me.account.displayName;const out=document.createElement('button');out.className='link-button';out.textContent='ออกจากระบบ';out.onclick=()=>void logout().catch(e=>{chip.textContent=e.message;});chip.append(name,out);}else{const a=document.createElement('a');a.href='/login.html';a.textContent='เข้าสู่ระบบ';chip.append(a);}}catch{chip.textContent='เชื่อมต่อบัญชีไม่ได้';}}
