import './city-residents-review.css';
import {TOWN_NPCS} from './city-2d-locations';
import {drawNpcSprite,npcSprite} from './city-npc-sprite';
import {loadCitySpriteTheme} from './city-sprite-theme';
import type {Facing} from './city-layout-model';
const root=document.querySelector('#residents')!,status=document.querySelector('#status')!;
const turn=document.querySelector<HTMLButtonElement>('#motion')!;turn.textContent='ทิศ 1/4 · เปลี่ยนทิศ ↻';turn.removeAttribute('aria-pressed');turn.disabled=true;
let facing:Facing=0;
const stations:Record<string,string>={market:'หน้าร้านค้าตลาด',forge:'หน้าโรงตีเหล็ก',storage:'หน้าคลังเก็บของ',healer:'จุดพักฟื้นข้างสวน',angel:'ลานเปลี่ยนอาชีพ',captain:'จุดแนะนำเส้นทางประตูเมือง'};
const cards=TOWN_NPCS.map(npc=>{
 const card=document.createElement('article'),canvas=document.createElement('canvas');canvas.width=280;canvas.height=220;canvas.setAttribute('aria-label',npc.name+' · '+npc.role);
 const title=document.createElement('h2'),detail=document.createElement('p'),station=document.createElement('a');title.textContent=npc.name;detail.textContent=npc.role;station.textContent=`${stations[npc.id]} · (${npc.x}, ${npc.z}) ↗`;station.href='/city-2d-review.html?npc='+encodeURIComponent(npc.id);card.append(canvas,title,detail,station);root.append(card);
 return {npc,ctx:canvas.getContext('2d')!};
});
loadCitySpriteTheme().then(theme=>{
 status.textContent=`NPC สำคัญ ${cards.length} ตัว · ท่ายืน 4 ทิศ · ใช้ชุดเดียวกับเมืองและเกมจริง`;
 function render(){
  for(const card of cards){const base=theme.npc(card.npc.art),view=theme.view('npc-'+card.npc.art,facing),sprite=npcSprite(view.source,view.rect,base.height);sprite.anchor=view.anchor;card.ctx.clearRect(0,0,280,220);drawNpcSprite(card.ctx,sprite,140,207,70);}
 }
 turn.disabled=false;turn.addEventListener('click',()=>{facing=(facing+1)%4 as Facing;turn.textContent=`ทิศ ${facing+1}/4 · เปลี่ยนทิศ ↻`;render();});render();
}).catch(e=>{status.textContent='โหลดภาพไม่สำเร็จ: '+e.message;});
