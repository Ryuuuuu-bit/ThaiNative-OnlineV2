import './city-residents-review.css';
import {CITIZEN_PROFILES} from './city-2d-citizens';
import {loadCitizenArt} from './city-2d-citizen-art';
const root=document.querySelector('#residents')!,status=document.querySelector('#status')!;
let paused=false,left=false,walk=0,last=0;
const cards=CITIZEN_PROFILES.map(profile=>{
 const card=document.createElement('article'),canvas=document.createElement('canvas');canvas.width=280;canvas.height=220;canvas.setAttribute('aria-label',profile.name+' · '+profile.occupation);
 const title=document.createElement('h2'),detail=document.createElement('p');title.textContent=profile.name;detail.textContent=profile.occupation;card.title=profile.speech;card.append(canvas,title,detail);root.append(card);
 return {profile,card,ctx:canvas.getContext('2d')!};
});
document.querySelector<HTMLSelectElement>('#group')!.addEventListener('change',e=>{const value=(e.target as HTMLSelectElement).value;for(const n of cards)n.card.hidden=value!=='all'&&value!==n.profile.atlas;});
document.querySelector('#motion')!.addEventListener('click',e=>{paused=!paused;const b=e.currentTarget as HTMLButtonElement;b.textContent=paused?'เล่นภาพเดิน':'หยุดภาพเดิน';b.setAttribute('aria-pressed',String(paused));});
document.querySelector('#direction')!.addEventListener('click',e=>{left=!left;const b=e.currentTarget as HTMLButtonElement;b.textContent=left?'หันขวา':'หันซ้าย';b.setAttribute('aria-pressed',String(left));});
loadCitizenArt().then(art=>{
 status.textContent='เลือกย่านเพื่อดูแต่ละกลุ่ม · ชี้ที่การ์ดเพื่ออ่านบทพูด';
 function render(now:number){requestAnimationFrame(render);const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(document.hidden)return;if(!paused)walk+=dt;
  for(const n of cards){if(n.card.hidden)continue;n.ctx.clearRect(0,0,280,220);art.draw(n.ctx,{profile:n.profile,walk:walk*n.profile.speed,moving:true,fx:left?-1:1,fz:0},{x:140,y:207},78);}
 }requestAnimationFrame(render);
}).catch(e=>{status.textContent='โหลดภาพไม่สำเร็จ: '+e.message;});
