import './city-residents-review.css';
import {TOWN_NPCS} from './city-2d-locations';
import {loadCityNpcSprites,drawNpcSprite} from './city-npc-sprite';
const root=document.querySelector('#residents')!,status=document.querySelector('#status')!;
let paused=false,clock=0,last=0;
const stations:Record<string,string>={market:'หน้าร้านค้าตลาด',forge:'หน้าโรงตีเหล็ก',storage:'หน้าคลังเก็บของ',healer:'จุดพักฟื้นข้างสวน',angel:'ลานเปลี่ยนอาชีพ',captain:'จุดแนะนำเส้นทางประตูเมือง'};
const cards=TOWN_NPCS.map(npc=>{
 const card=document.createElement('article'),canvas=document.createElement('canvas');canvas.width=280;canvas.height=220;canvas.setAttribute('aria-label',npc.name+' · '+npc.role);
 const title=document.createElement('h2'),detail=document.createElement('p'),station=document.createElement('a');title.textContent=npc.name;detail.textContent=npc.role;station.textContent=`${stations[npc.id]} · (${npc.x}, ${npc.z}) ↗`;station.href='/city-2d-review.html?npc='+encodeURIComponent(npc.id);card.append(canvas,title,detail,station);root.append(card);
 return {npc,ctx:canvas.getContext('2d')!};
});
document.querySelector('#motion')!.addEventListener('click',e=>{paused=!paused;const button=e.currentTarget as HTMLButtonElement;button.textContent=paused?'เล่นท่าทาง':'หยุดท่าทาง';button.setAttribute('aria-pressed',String(paused));});
loadCityNpcSprites(async path=>{const image=new Image();image.src=path;await image.decode();return image;},TOWN_NPCS.map(n=>n.art)).then(sprites=>{
 status.textContent=`NPC สำคัญ ${cards.length} ตัว · ยืนประจำจุด · ใช้ชุดเดียวกับเมืองและเกมจริง`;
 function render(now:number){requestAnimationFrame(render);const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(document.hidden)return;if(!paused)clock+=dt;
  cards.forEach((card,i)=>{card.ctx.clearRect(0,0,280,220);drawNpcSprite(card.ctx,sprites.get(card.npc.art)!,140,207,70,clock+i*.173);});
 }requestAnimationFrame(render);
}).catch(e=>{status.textContent='โหลดภาพไม่สำเร็จ: '+e.message;});
