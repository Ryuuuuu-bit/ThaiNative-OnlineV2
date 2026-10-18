import './city-assets-review.css';
type Asset={id:string;name:string;description:string;zone:string;rect:[number,number,number,number]};
type Collection={image:string;assets:Asset[]};
type ArtManifest={houses:Collection;npcs:Collection;residents:Collection};
let data:ArtManifest,category:'houses'|'npcs'|'residents'='houses';
const images=new Map<string,HTMLImageElement>();
const gallery=document.querySelector('#assets')!;
const dialog=document.querySelector<HTMLDialogElement>('#detail')!;
function paint(canvas:HTMLCanvasElement,asset:Asset,image:HTMLImageElement){
 const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 const [x,y,w,h]=asset.rect,scale=Math.min((canvas.width-60)/w,(canvas.height-45)/h);
 ctx.drawImage(image,x,y,w,h,(canvas.width-w*scale)/2,canvas.height-h*scale-20,w*scale,h*scale);
}
function detail(asset:Asset){const group=data[category];paint(document.querySelector<HTMLCanvasElement>('#large')!,asset,images.get(group.image)!);document.querySelector('#detail-name')!.textContent=asset.name;document.querySelector('#detail-description')!.textContent=asset.description;document.querySelector('#detail-kind')!.textContent=`${category==='houses'?'BUILDING':'TOWNSFOLK'} / ${asset.zone}`;dialog.showModal();}
function render(){
 gallery.replaceChildren();gallery.setAttribute('aria-label',category==='houses'?'ชุดภาพบ้านเรือน':'ชุดภาพ NPC ในเมือง');
 document.querySelector('#collection-title')!.textContent=category==='houses'?'บ้าน 6 แบบ · มุมกล้องเดียวกัน':'NPC 6 บทบาท · ท่ายืน SE · ยังไม่ใช่เฟรมเดิน';
 for(const [i,asset] of data[category].assets.entries()){
   const card=document.createElement('article');card.className='asset-card';const button=document.createElement('button');button.className='art-button';button.setAttribute('aria-label',`ดูภาพ ${asset.name}`);
   const canvas=document.createElement('canvas');canvas.width=700;canvas.height=560;button.append(canvas);button.addEventListener('click',()=>detail(asset));card.append(button);
   const copy=document.createElement('div');copy.className='card-copy';const no=document.createElement('span');no.className='number';no.textContent=`${String(i+1).padStart(2,'0')} / ${asset.id.toUpperCase()}`;const title=document.createElement('h2');title.textContent=asset.name;const description=document.createElement('p');description.textContent=asset.description;const zone=document.createElement('span');zone.className='chip';zone.textContent=asset.zone;copy.append(no,title,description,zone);card.append(copy);gallery.append(card);paint(canvas,asset,images.get(data[category].image)!);
 }
}
document.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button=>button.addEventListener('click',()=>{if(!data)return;category=button.dataset.category as typeof category;document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
document.querySelector('#backdrop')!.addEventListener('change',e=>{document.body.className=(e.target as HTMLSelectElement).value;});
document.querySelector('#close')!.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
async function init(){const res=await fetch('/assets/city-painted-v1/manifest.json');if(!res.ok)throw Error('ยังไม่มีไฟล์ภาพสำหรับตรวจ');data=await res.json();await Promise.all([data.houses,data.npcs,data.residents].map(async group=>{const img=new Image();img.src=group.image;await img.decode();images.set(group.image,img);}));render();document.querySelector<HTMLElement>('#loading')!.hidden=true;}
void init().catch(error=>{document.querySelector('#loading')!.textContent=`${error.message} · โปรดรีเฟรชหลังชุดภาพพร้อม`;console.error(error);});
