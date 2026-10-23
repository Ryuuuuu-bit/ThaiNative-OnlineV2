import './city-assets-review.css';
import {loadCitySpriteTheme} from './city-sprite-theme';
let data:Awaited<ReturnType<typeof loadCitySpriteTheme>>,category:'houses'|'npcs'|'residents'='houses';
const buildings=new Set(['cottage','townhouse','inn','market','forge','guild','clocktower','chapel','gazebo','watchtower','gate','wall','booth']);
const categories={houses:'อาคาร กำแพง และประตู',npcs:'NPC ประจำเมือง',residents:'ของตกแต่งและธรรมชาติ'};
const gallery=document.querySelector('#assets')!;
const dialog=document.querySelector<HTMLDialogElement>('#detail')!;
const name=(id:string)=>(data.manifest.assets[id] as {label?:string}).label??id.replaceAll('-',' ');
function paint(canvas:HTMLCanvasElement,id:string,allViews=false){
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const columns=allViews?2:1,cellW=canvas.width/columns,cellH=canvas.height/columns;
 for(const facing of (allViews?[0,1,2,3]:[0]) as (0|1|2|3)[]){
   const {source,rect}=data.view(id,facing),[x,y,w,h]=rect,left=(facing%columns)*cellW,top=Math.floor(facing/columns)*cellH,scale=Math.min((cellW-60)/w,(cellH-65)/h);
   ctx.drawImage(source,x,y,w,h,left+(cellW-w*scale)/2,top+cellH-h*scale-30,w*scale,h*scale);
   if(allViews){ctx.font='18px "Noto Sans Thai",sans-serif';ctx.textAlign='center';ctx.fillStyle='#10231ce6';ctx.fillRect(left+cellW/2-78,top+cellH-28,156,27);ctx.fillStyle='#ece5ce';ctx.fillText(`ทิศ ${facing+1} · ${facing*90}°`,left+cellW/2,top+cellH-7);}
 }
}
function detail(id:string){const canvas=document.querySelector<HTMLCanvasElement>('#large')!;paint(canvas,id,true);canvas.setAttribute('aria-label',name(id)+' · ภาพครบสี่ทิศ');document.querySelector('#detail-name')!.textContent=name(id);document.querySelector('#detail-description')!.textContent='ด้านหน้า ด้านข้าง และด้านหลัง · เลือกทิศที่หันบนพื้นเมืองได้ในเครื่องมือจัด Layout';document.querySelector('#detail-kind')!.textContent=`CITY SPRITE V2 / ${id}`;dialog.showModal();}
function render(){
 const ids=Object.keys(data.manifest.assets).filter(id=>category==='houses'?buildings.has(id):category==='npcs'?id.startsWith('npc-'):!buildings.has(id)&&!id.startsWith('npc-'));
 gallery.replaceChildren();gallery.setAttribute('aria-label',categories[category]);
 document.querySelector('#collection-title')!.textContent=`${categories[category]} ${ids.length} แบบ · ภาพครบ 4 ทิศ`;
 for(const [i,id] of ids.entries()){
   const card=document.createElement('article');card.className='asset-card';const button=document.createElement('button');button.className='art-button';button.setAttribute('aria-label',`ดูภาพสี่ทิศ ${name(id)}`);
   const canvas=document.createElement('canvas');canvas.width=700;canvas.height=560;button.append(canvas);button.addEventListener('click',()=>detail(id));card.append(button);
   const copy=document.createElement('div');copy.className='card-copy';const no=document.createElement('span');no.className='number';no.textContent=`${String(i+1).padStart(2,'0')} / ${id.toUpperCase()}`;const title=document.createElement('h2');title.textContent=name(id);const description=document.createElement('p');description.textContent='ใช้ชุดเดียวกับเมืองและเครื่องมือจัด Layout';const zone=document.createElement('span');zone.className='chip';zone.textContent='4 ทิศ · ภาพโปร่งใส';copy.append(no,title,description,zone);card.append(copy);gallery.append(card);paint(canvas,id);
 }
}
document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.addEventListener('click',()=>{if(!data)return;category=button.dataset.category as typeof category;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
document.querySelector('#backdrop')!.addEventListener('change',e=>{document.body.className=(e.target as HTMLSelectElement).value;});
document.querySelector('#close')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
async function init(){data=await loadCitySpriteTheme();render();document.querySelector<HTMLElement>('#loading')!.hidden=true;}
void init().catch(error=>{document.querySelector('#loading')!.textContent=`${error.message} · โปรดรีเฟรชหลังชุดภาพพร้อม`;console.error(error);});
