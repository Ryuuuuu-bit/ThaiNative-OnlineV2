import type{Account}from'./session';
export const kindLabel=(kind:Account['kind'])=>kind==='guest'?'ผู้เยี่ยมชม':kind==='google'?'บัญชี Google':'ชื่อผู้ใช้และรหัสผ่าน';
/** "UID 123456789 [คัดลอก]" — the public account id players can share with support or friends. */
export function uidChip(uid:string){
 const chip=document.createElement('span');chip.className='uid-chip';
 const label=document.createElement('span');label.textContent='UID';label.className='uid-label';
 const code=document.createElement('code');code.textContent=uid;code.className='uid-code';
 const copy=document.createElement('button');copy.type='button';copy.className='uid-copy';copy.textContent='คัดลอก';copy.setAttribute('aria-label',`คัดลอก UID ${uid}`);
 const status=document.createElement('span');status.className='uid-status';status.setAttribute('role','status');
 copy.onclick=async()=>{let ok=false;try{await navigator.clipboard.writeText(uid);ok=true;}catch{const range=document.createRange();range.selectNodeContents(code);const sel=getSelection();sel?.removeAllRanges();sel?.addRange(range);try{ok=document.execCommand('copy');}catch{}}
  status.textContent=ok?'คัดลอกแล้ว':'เลือกข้อความไว้แล้ว กด Ctrl+C';copy.textContent=ok?'คัดลอกแล้ว ✓':'คัดลอก';setTimeout(()=>{status.textContent='';copy.textContent='คัดลอก';},2000);};
 chip.append(label,code,copy,status);return chip;
}
export function mountBuild(){const b=document.querySelector('#build-id');if(b)b.textContent=import.meta.env.VITE_BUILD_ID||'ทดสอบ';}
