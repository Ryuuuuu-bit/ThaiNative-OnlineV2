/* Early, dependency-free loading UI. Also survives module download failures. */
(() => {
 const weights=[10,60,10,10,10],values=[0,0,0,0,0];let percent=0,last=Date.now(),done=false,failed=false;
 const labels=['กำลังเปิดสมุดการผจญภัย…','กำลังโหลดภาพวาด…','กำลังตรวจสอบตัวละคร…','กำลังเชื่อมต่อเซิร์ฟเวอร์…','กำลังเข้าสู่ทุ่งหญ้า…'];
 const $=id=>document.getElementById(id);
 function draw(){const el=$('painted-loading');if(!el)return;const total=Math.floor(values.reduce((sum,v,i)=>sum+v*weights[i],0));percent=Math.max(percent,total);el.dataset.progress=String(percent);$('loading-fill').style.width=percent+'%';$('loading-percent').textContent=percent+'%';el.setAttribute('aria-valuenow',String(percent));if(!failed)$('loading-stage').textContent=labels[values.findIndex(v=>v<1)]||'พร้อมออกเดินทาง';if(percent===100&&!done){done=true;performance.mark('tn-playable');el.classList.add('leaving');setTimeout(()=>{el.hidden=true;},600);}}
 const reported=new Set();
 window.tnBoot={stage(i,value=1){if(value>values[i]){last=Date.now();values[i]=Math.min(1,value);}draw();},fail(message='เปิดทุ่งหญ้าไม่สำเร็จ กรุณาลองใหม่',code='runtime'){failed=true;const el=$('painted-loading');if(!el)return;el.hidden=false;el.classList.remove('leaving');$('loading-stage').textContent=message;$('loading-retry').hidden=false;if(!reported.has(code)){reported.add(code);fetch('/api/boot-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,page:location.pathname.includes('characters')?'characters':'play',progress:percent}),keepalive:true}).catch(()=>{});}},get progress(){return percent;}};
 function init(){draw();$('loading-retry')?.addEventListener('click',()=>location.reload());setInterval(()=>{const note=$('loading-slow');if(note)note.hidden=done||Date.now()-last<8000;},500);}
 document.addEventListener('DOMContentLoaded',init);
 window.addEventListener('error',e=>{if(e.target instanceof HTMLScriptElement||e.error)window.tnBoot.fail('เปิดทุ่งหญ้าไม่สำเร็จ กรุณาลองใหม่',e.target instanceof HTMLScriptElement?'module':'runtime');},true);
 window.addEventListener('unhandledrejection',()=>window.tnBoot.fail('เตรียมการผจญภัยไม่สำเร็จ กรุณาลองใหม่'));
 setInterval(()=>{if(!done&&!failed&&Date.now()-last>45000)window.tnBoot.fail('โหลดนานเกินไป กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่','timeout');},1000);
})();
