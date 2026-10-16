export class ApiError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
export async function api<T=any>(path:string,options:RequestInit={}):Promise<T>{
 const response=await fetch('/api'+path,{signal:AbortSignal.timeout(15000),...options,credentials:'same-origin',headers:{'Content-Type':'application/json',...options.headers}});
 const data=await response.json().catch(()=>null);
 if(!response.ok)throw new ApiError(response.status,data?.error?.code||'NETWORK_ERROR',data?.error?.message||'เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');return data as T;
}
export const post=<T=any>(path:string,body:unknown={})=>api<T>(path,{method:'POST',body:JSON.stringify(body)});
export function showError(target:HTMLElement,error:unknown){target.textContent=error instanceof Error?error.message:'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่';target.hidden=false;}
