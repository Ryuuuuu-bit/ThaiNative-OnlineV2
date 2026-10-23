import './city-layout-editor.css';
import {loadCityLayoutAssets,type CityLayoutAsset} from './city-layout-assets';
import {createDraft,parseDraft,moveItem,faceItem,createLayoutHistory,type CityLayoutDraft,type LayoutItem,type Facing} from './city-layout-model';
import {project,unproject} from './city-2d-sim';
import type {Sprite} from './city-2d-art';

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('city-editor'),ctx=canvas.getContext('2d')!;
const nameInput=$<HTMLInputElement>('draft-name'),objectList=$<HTMLSelectElement>('objects');
const storageKey='tbo:city-layout-draft:v1';
let assets=new Map<string,CityLayoutAsset>(),ground:HTMLCanvasElement,grass:HTMLImageElement;
let availableFacings=new Map<string,Facing[]>();
let original:CityLayoutDraft,draft:CityLayoutDraft,history:ReturnType<typeof createLayoutHistory>;
let selected='',placing='',tool:'select'|'pan'='select',ready=false,saved='',width=1,height=1,zoom=8;
let camera={x:0,y:-3},pointer:{x:number;z:number}|null=null;
let gesture:{type:'pan'|'move';id:number;startX:number;startY:number;camera:{x:number;y:number};item?:LayoutItem;world:{x:number;z:number}}|null=null;
let scaleBefore='',recoveryRaw='';
const status=(message:string)=>{$('status').textContent=message;};
const selectedItem=()=>draft?.items.find(p=>p.id===selected);
const snap=()=>Number($<HTMLSelectElement>('snap').value);
const serialize=()=>JSON.stringify(draft);
const dirty=()=>ready&&serialize()!==saved;
const assetName=(item:LayoutItem)=>assets.get(item.assetId)!.name;
const itemImage=(item:LayoutItem)=>assets.get(item.assetId)!.facings[item.facing]!;
const screen=(x:number,z:number)=>{const p=project(x,z);return{x:width/2+(p.x-camera.x)*zoom,y:height/2+(p.y-camera.y)*zoom};};
const world=(x:number,y:number)=>unproject((x-width/2)/zoom+camera.x,(y-height/2)/zoom+camera.y);
const local=(e:PointerEvent|WheelEvent)=>{const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};

function paintPreview(target:HTMLCanvasElement,image:Sprite,scale=1,flip=false){
 const c=target.getContext('2d')!;c.clearRect(0,0,target.width,target.height);
 const s=Math.min((target.width-26)/image.width,(target.height-18)/image.height)*Math.min(scale,1.3);
 c.save();c.translate(target.width/2,target.height/2);c.scale(flip?-1:1,1);c.drawImage(image,-image.width*s/2,-image.height*s/2,image.width*s,image.height*s);c.restore();
}
function renderLibrary(){
 const root=$('asset-library'),query=$<HTMLInputElement>('asset-search').value.trim().toLocaleLowerCase(),category=$<HTMLSelectElement>('category').value;
 root.replaceChildren();
 for(const asset of assets.values()){
  if(category&&asset.category!==category||query&&!`${asset.name} ${asset.category}`.toLocaleLowerCase().includes(query))continue;
  const button=document.createElement('button'),image=document.createElement('canvas'),label=document.createElement('span');
  button.className='asset-card';button.title=asset.name;button.setAttribute('aria-label',`วาง ${asset.name}`);button.setAttribute('aria-pressed',String(placing===asset.id));
  image.width=220;image.height=170;label.textContent=asset.name;button.append(image,label);paintPreview(image,asset.image);
  button.addEventListener('click',()=>{placing=asset.id;selected='';setTool('select');updateSelection();renderLibrary();updatePlacement();draw();canvas.focus();status(`เลือกตำแหน่งวาง ${asset.name} · Esc เพื่อยกเลิก`);});root.append(button);
 }
 if(!root.children.length){const p=document.createElement('p');p.className='hint';p.textContent='ไม่มีชิ้นส่วนที่ตรงกับการค้นหา';root.append(p);}
}
function updateObjects(){
 const query=$<HTMLInputElement>('object-search').value.trim().toLocaleLowerCase();objectList.replaceChildren();
 for(const item of draft.items){
  const label=assetName(item);if(query&&!`${label} ${item.id}`.toLocaleLowerCase().includes(query))continue;
  const option=document.createElement('option');option.value=item.id;option.textContent=`${label} · ${item.x.toFixed(1)}, ${item.z.toFixed(1)}`;objectList.append(option);
 }
 objectList.value=selected;$('object-count').textContent=String(draft.items.length);
}
function updateSelection(){
 const item=selectedItem();if(!item)selected='';
 $('selection').hidden=!item;$('empty-selection').hidden=!!item;objectList.value=selected;
 if(!item)return;
 const asset=assets.get(item.assetId)!;
 $('selected-name').textContent=asset.name;$('selected-category').textContent=asset.category;
 paintPreview($<HTMLCanvasElement>('selected-preview'),itemImage(item),item.scale,item.flip);
 $<HTMLInputElement>('position-x').value=String(Math.round(item.x*1000)/1000);$<HTMLInputElement>('position-z').value=String(Math.round(item.z*1000)/1000);
 $<HTMLInputElement>('object-scale').value=String(item.scale);$('scale-value').textContent=`${Math.round(item.scale*100)}%`;$('flip').setAttribute('aria-pressed',String(item.flip));
 $('facing-value').textContent=`${item.facing*90}°`;
 for(const facing of [0,1,2,3] as const){
  const button=$<HTMLButtonElement>('facing-'+facing),image=asset.facings[facing],preview=button.querySelector('canvas')!;
  button.disabled=!image;button.setAttribute('aria-pressed',String(item.facing===facing));
  if(image)paintPreview(preview,image,1,item.flip);else preview.getContext('2d')!.clearRect(0,0,preview.width,preview.height);
 }
 const count=availableFacings.get(item.assetId)!.length;
 $('facing-note').textContent=count===4?'เลือกภาพแต่ละด้าน · วัตถุยังตั้งตรงบนพื้นเมือง':`ชุดภาพนี้มี ${count}/4 ทิศ · ปุ่มที่ปิดไว้ยังไม่มีภาพด้านนั้น`;
}
function updatePlacement(){
 $('placement').hidden=!placing;$('placement-name').textContent=placing?`กำลังวาง · ${assets.get(placing)!.name}`:'';canvas.style.cursor=placing?'crosshair':tool==='pan'?'grab':'default';
}
function updateDocument(){
 nameInput.value=draft.name;$('undo').toggleAttribute('disabled',!history.canUndo());$('redo').toggleAttribute('disabled',!history.canRedo());
 const state=$('save-state');state.textContent=dirty()?'มีการแก้ไข · ยังไม่บันทึก':'แบบร่างในเบราว์เซอร์นี้';state.classList.toggle('dirty',dirty());
}
function refresh(){updateDocument();updateObjects();updateSelection();draw();}
function commit(message?:string){
 if(serialize()!==JSON.stringify(history.current()))history.commit(draft);
 refresh();if(message)status(message);
}
function setTool(value:'select'|'pan'){
 tool=value;if(value==='pan')placing='';$('select-tool').setAttribute('aria-pressed',String(tool==='select'));$('pan-tool').setAttribute('aria-pressed',String(tool==='pan'));updatePlacement();
}
function cancelPlacement(){placing='';pointer=null;updatePlacement();renderLibrary();draw();}
function sortedItems(){return [...draft.items].sort((a,b)=>project(a.x,a.z).y-project(b.x,b.z).y);}
function itemBounds(item:LayoutItem){
 const image=itemImage(item),p=screen(item.x,item.z),s=zoom*item.scale;
 return {x:p.x+(item.flip?-image.left-image.width/28:image.left)*s,y:p.y+image.top*s,w:image.width/28*s,h:image.height/28*s};
}
function paintItem(item:LayoutItem,alpha=1){
 const image=itemImage(item),p=screen(item.x,item.z),b=itemBounds(item);
 if(b.x>width||b.x+b.w<0||b.y>height||b.y+b.h<0)return;
 ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);ctx.scale(zoom*item.scale*(item.flip?-1:1),zoom*item.scale);
 ctx.drawImage(image,image.left,image.top,image.width/28,image.height/28);ctx.restore();
}
function groundLine(points:number[][],color:string,lineWidth=1){
 ctx.beginPath();for(const [i,[x,z]] of points.entries()){const p=screen(x,z);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.stroke();
}
function draw(){
 if(!ready)return;
 const dpr=Math.min(devicePixelRatio||1,2);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
 const o=screen(0,0);ctx.save();ctx.transform(.83205*zoom,.39223*zoom,-.5547*zoom,.58835*zoom,o.x,o.y);
 const pattern=ctx.createPattern(grass,'repeat')!;pattern.setTransform(new DOMMatrix().translate(-53,-53).scale(9/grass.width,9/grass.height));ctx.fillStyle=pattern;
 const corners=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>world(x,y)),minX=Math.min(...corners.map(p=>p.x))-1,minZ=Math.min(...corners.map(p=>p.z))-1;
 ctx.fillRect(minX,minZ,Math.max(...corners.map(p=>p.x))-minX+1,Math.max(...corners.map(p=>p.z))-minZ+1);ctx.restore();
 ctx.drawImage(ground,o.x-75*zoom,o.y-55.5556*zoom,150*zoom,111.1111*zoom);
 if($<HTMLInputElement>('grid').checked){for(let v=-48;v<=48;v+=zoom<10?4:2){groundLine([[v,-48],[v,48]],'#e7e8c414');groundLine([[-48,v],[48,v]],'#e7e8c414');}}
 ctx.setLineDash([5,5]);groundLine([[-48,-48],[48,-48],[48,48],[-48,48],[-48,-48]],'#ecdfad99');ctx.setLineDash([]);
 for(const item of sortedItems())paintItem(item);
 const item=selectedItem();if(item){
  const b=itemBounds(item),p=screen(item.x,item.z);ctx.save();ctx.strokeStyle='#f0d38d';ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.strokeRect(b.x-3,b.y-3,b.w+6,b.h+6);ctx.setLineDash([]);ctx.fillStyle='#f0d38d';ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 if(placing&&pointer){const ghost=moveItem({id:'preview',assetId:placing,x:0,z:0,scale:1,flip:false,facing:0},pointer.x,pointer.z,snap());paintItem(ghost,.65);const p=screen(ghost.x,ghost.z);ctx.strokeStyle='#ffe8a8';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.stroke();}
 $('zoom-level').textContent=`${Math.round(zoom/18*100)}%`;
}
function fit(){camera={x:0,y:-3};zoom=Math.max(2,Math.min(18,Math.min((width-50)/140,(height-80)/108)));draw();}
function zoomAt(factor:number,x=width/2,y=height/2){
 const before={x:(x-width/2)/zoom+camera.x,y:(y-height/2)/zoom+camera.y};zoom=Math.max(2,Math.min(55,zoom*factor));camera={x:before.x-(x-width/2)/zoom,y:before.y-(y-height/2)/zoom};draw();
}
function hitTest(x:number,y:number){
 for(const item of sortedItems().reverse()){
  const b=itemBounds(item);if(x<b.x||y<b.y||x>=b.x+b.w||y>=b.y+b.h)continue;
  const image=itemImage(item),p=screen(item.x,item.z),u=Math.floor(((x-p.x)/(zoom*item.scale)*(item.flip?-1:1)-image.left)*28),v=Math.floor(((y-p.y)/(zoom*item.scale)-image.top)*28);
  if(u>=0&&u<image.width&&v>=0&&v<image.height&&image.getContext('2d')!.getImageData(u,v,1,1).data[3]>30)return item;
 }
}
function addItem(assetId:string,x:number,z:number,copy?:LayoutItem){
 if(draft.items.length>=2000){status('แบบร่างรองรับวัตถุสูงสุด 2,000 ชิ้น');return;}
 const item=moveItem({...copy,id:'object:'+crypto.randomUUID(),assetId,x,z,scale:copy?.scale??1,flip:copy?.flip??false,facing:copy?.facing??0},x,z,snap());
 draft.items.push(item);selected=item.id;commit(`เพิ่ม ${assetName(item)} แล้ว`);
}
function duplicate(){const item=selectedItem();if(item)addItem(item.assetId,item.x+1,item.z+1,item);}
function remove(){const item=selectedItem();if(!item)return;draft.items=draft.items.filter(p=>p.id!==selected);selected='';commit(`ลบ ${assetName(item)} · ย้อนกลับได้ด้วย Ctrl+Z`);}
function undo(redo=false){if(!ready)return;draft=redo?history.redo():history.undo();cancelPlacement();refresh();status(redo?'ทำซ้ำแล้ว':'ย้อนกลับแล้ว');}
function save(){
 if(!ready)return;
 try{if(recoveryRaw)localStorage.setItem(storageKey+':recovery',recoveryRaw);localStorage.setItem(storageKey,serialize());saved=serialize();updateDocument();status('บันทึกแบบร่างในเบราว์เซอร์นี้แล้ว · ส่งออก JSON เพื่อเก็บสำรองหรือย้ายเครื่อง');}
 catch{status('บันทึกไม่ได้: พื้นที่เบราว์เซอร์เต็มหรือถูกปิดกั้น · ใช้ส่งออก JSON เพื่อเก็บแบบร่าง');}
}
function download(text:string,filename:string){
 const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportFile(){
 download(JSON.stringify(draft,null,2)+'\n','city-layout-draft.json');status('ส่งออกแบบร่างแล้ว · ใช้เปิดไฟล์เพื่อนำกลับมาแก้ได้');
}
canvas.addEventListener('pointerdown',e=>{
 if(!ready||gesture||e.button!==0&&e.button!==1)return;
 canvas.focus();e.preventDefault();const p=local(e),w=world(p.x,p.y);
 if(placing&&e.button===0){if(Math.abs(w.x)>48||Math.abs(w.z)>48){status('วางของภายในเส้นขอบเมือง');return;}addItem(placing,w.x,w.z);return;}
 const item=tool==='select'&&e.button===0?hitTest(p.x,p.y):undefined;
 selected=item?.id??'';updateSelection();
 gesture={type:item?'move':'pan',id:e.pointerId,startX:p.x,startY:p.y,camera:{...camera},item:item?{...item}:undefined,world:w};canvas.setPointerCapture(e.pointerId);canvas.style.cursor=item?'grabbing':'grab';draw();
});
canvas.addEventListener('pointermove',e=>{
 if(!ready)return;const p=local(e),w=world(p.x,p.y);pointer=w;$('coordinates').textContent=`X ${w.x.toFixed(1)} / Z ${w.z.toFixed(1)}`;
 if(gesture&&gesture.id===e.pointerId){
  if(gesture.type==='pan'){camera={x:gesture.camera.x-(p.x-gesture.startX)/zoom,y:gesture.camera.y-(p.y-gesture.startY)/zoom};}
  else{const item=selectedItem();if(item)Object.assign(item,moveItem(item,gesture.item!.x+w.x-gesture.world.x,gesture.item!.z+w.z-gesture.world.z,snap()));updateSelection();}
  draw();
 }else if(placing)draw();
});
function finishGesture(e:PointerEvent,cancel=false){
 if(!gesture||e.pointerId!==gesture.id)return;const g=gesture;gesture=null;
 if(g.type==='move'){if(cancel&&g.item){const item=selectedItem();if(item)Object.assign(item,g.item);}else commit('จัดตำแหน่งแล้ว');}
 if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);updatePlacement();draw();
}
canvas.addEventListener('pointerup',e=>finishGesture(e));canvas.addEventListener('pointercancel',e=>finishGesture(e,true));canvas.addEventListener('lostpointercapture',e=>finishGesture(e,true));
canvas.addEventListener('pointerleave',()=>{if(!gesture){pointer=null;draw();}});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!ready||gesture)return;const p=local(e);zoomAt(Math.exp(-e.deltaY*.001),p.x,p.y);},{passive:false});
new ResizeObserver(()=>{const r=canvas.getBoundingClientRect();width=r.width;height=r.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);draw();}).observe(canvas);
$('asset-search').addEventListener('input',renderLibrary);$('category').addEventListener('change',renderLibrary);$('object-search').addEventListener('input',()=>{if(ready)updateObjects();});
objectList.addEventListener('change',()=>{selected=objectList.value;cancelPlacement();const item=selectedItem();if(item){const p=project(item.x,item.z);camera={x:p.x,y:p.y-3};zoom=Math.max(zoom,18);}updateSelection();draw();});
for(const axis of ['x','z'] as const)$('position-'+axis).addEventListener('change',()=>{
 const item=selectedItem(),input=$<HTMLInputElement>('position-'+axis);if(!item)return;
 const value=input.valueAsNumber;if(!Number.isFinite(value)){updateSelection();status('กรุณาใส่พิกัดเป็นตัวเลข');return;}
 Object.assign(item,moveItem(item,axis==='x'?value:item.x,axis==='z'?value:item.z,0));commit('เปลี่ยนตำแหน่งแล้ว');
});
$('object-scale').addEventListener('input',()=>{const item=selectedItem();if(!item)return;if(!scaleBefore)scaleBefore=serialize();item.scale=$<HTMLInputElement>('object-scale').valueAsNumber;$('scale-value').textContent=`${Math.round(item.scale*100)}%`;draw();});
$('object-scale').addEventListener('change',()=>{if(scaleBefore){scaleBefore='';commit('เปลี่ยนขนาดแล้ว');updateSelection();}});
for(const facing of [0,1,2,3] as const)$('facing-'+facing).addEventListener('click',()=>{
 const item=selectedItem();if(!item)return;Object.assign(item,faceItem(item,facing,availableFacings.get(item.assetId)!));commit('เปลี่ยนทิศที่หันแล้ว');
});
$('flip').addEventListener('click',()=>{const item=selectedItem();if(item){item.flip=!item.flip;commit('กลับด้านภาพแล้ว');}});
nameInput.addEventListener('change',()=>{if(!ready)return;const name=nameInput.value.trim();if(!name){nameInput.value=draft.name;return;}draft.name=name;commit();});
$('select-tool').addEventListener('click',()=>{setTool('select');renderLibrary();canvas.focus();});$('pan-tool').addEventListener('click',()=>{setTool('pan');renderLibrary();draw();canvas.focus();});
$('cancel-place').addEventListener('click',cancelPlacement);$('duplicate').addEventListener('click',duplicate);$('delete').addEventListener('click',remove);
$('deselect').addEventListener('click',()=>{selected='';updateSelection();draw();canvas.focus();});
$('undo').addEventListener('click',()=>undo());$('redo').addEventListener('click',()=>undo(true));$('save').addEventListener('click',save);$('export').addEventListener('click',exportFile);
$('recover').addEventListener('click',()=>{if(recoveryRaw){download(recoveryRaw,'city-layout-recovery.json');status('ส่งออกข้อมูลแบบร่างเดิมแล้ว · เก็บไฟล์นี้ไว้เพื่อกู้คืนข้อมูล');}});
$('fit').addEventListener('click',fit);$('zoom-in').addEventListener('click',()=>zoomAt(1.2));$('zoom-out').addEventListener('click',()=>zoomAt(1/1.2));$('grid').addEventListener('change',draw);
$('reset').addEventListener('click',()=>{draft=structuredClone(original);selected='';cancelPlacement();commit('กลับไปใช้เมืองต้นฉบับแล้ว · ย้อนกลับได้ด้วย Ctrl+Z');fit();});
$('import').addEventListener('click',()=>$<HTMLInputElement>('import-file').click());
$('import-file').addEventListener('change',async()=>{
 const input=$<HTMLInputElement>('import-file'),file=input.files?.[0];if(!file)return;
 try{if(file.size>2_000_000)throw Error('ไฟล์ใหญ่เกิน 2 MB');const imported=parseDraft(JSON.parse(await file.text()),new Set(assets.keys()),availableFacings);draft=imported;selected='';cancelPlacement();commit('เปิดไฟล์แบบร่างแล้ว · ย้อนกลับได้ด้วย Ctrl+Z');fit();}
 catch(error){status('เปิดไฟล์ไม่ได้: '+(error instanceof Error?error.message:'ข้อมูลไม่ถูกต้อง'));}finally{input.value='';}
});
window.addEventListener('keydown',e=>{
 if(!ready)return;
 const modifier=e.ctrlKey||e.metaKey;if(modifier&&e.code==='KeyS'){e.preventDefault();nameInput.blur();save();return;}
 if((e.target as HTMLElement).matches('input,select,textarea')||gesture)return;
 if(modifier&&e.code==='KeyZ'){e.preventDefault();undo(e.shiftKey);return;}if(modifier&&e.code==='KeyY'){e.preventDefault();undo(true);return;}
 if(e.code==='Escape'){selected='';cancelPlacement();updateSelection();draw();return;}
 if(e.target!==canvas)return;
 if(e.code==='Delete'||e.code==='Backspace'){e.preventDefault();remove();}else if(e.code==='KeyD'){e.preventDefault();duplicate();}else if(e.code==='Home'){e.preventDefault();fit();}
 else if(e.code==='Equal')zoomAt(1.2);else if(e.code==='Minus')zoomAt(1/1.2);
 else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){
  e.preventDefault();const item=selectedItem();if(!item)return;
  const step=e.shiftKey?1:(snap()||.1),dx=e.code==='ArrowRight'?step:e.code==='ArrowLeft'?-step:0,dz=e.code==='ArrowDown'?step:e.code==='ArrowUp'?-step:0;
  Object.assign(item,moveItem(item,item.x+dx,item.z+dz,0));commit();
 }
});
window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});

async function init(){
 const [scene,grassImage]=await Promise.all([loadCityLayoutAssets(),(async()=>{const image=new Image();image.src='/assets/city-sprite-v2/ground-grass.webp';await image.decode();return image;})()]);
 assets=scene.assets;availableFacings=new Map([...assets].map(([id,asset])=>[id,Object.keys(asset.facings).map(Number) as Facing[]]));ground=scene.ground;grass=grassImage;original=createDraft(scene.items);draft=structuredClone(original);saved=JSON.stringify(draft);
 let warning='',stored='';try{stored=localStorage.getItem(storageKey)??'';if(stored){const data=JSON.parse(stored);draft=parseDraft(data,new Set(assets.keys()),availableFacings);saved=JSON.stringify(draft);if(data.version===1){recoveryRaw=stored;$('recover').hidden=false;warning='เปิดแบบร่างเดิมแล้ว · ยกเลิกการเอียงภาพและเก็บผังเดิมไว้ สำรองฉบับเก่าได้ก่อนบันทึก';}}}
 catch{recoveryRaw=stored;$('recover').hidden=!recoveryRaw;warning='เปิดแบบร่างเดิมไม่ได้ · กดสำรองข้อมูลเดิมเพื่อเก็บไฟล์ ระบบจะเก็บสำเนาก่อนบันทึกใหม่ด้วย';}
 history=createLayoutHistory(draft);ready=true;
 const category=$<HTMLSelectElement>('category');for(const name of new Set([...assets.values()].map(a=>a.category))){const option=document.createElement('option');option.value=name;option.textContent=name;category.append(option);}
 $('asset-count').textContent=`${assets.size} แบบ`;
 for(const id of ['import','export','save','reset'])$(id).removeAttribute('disabled');
 renderLibrary();refresh();fit();$('loading').hidden=true;status(warning||'เมืองเดิมพร้อมแล้ว · คลิกวัตถุเพื่อจัดตำแหน่ง หรือเลือกของจากคลังด้านซ้าย');
}
void init().catch(error=>{console.error(error);$('loading').replaceChildren();const title=document.createElement('strong'),message=document.createElement('span'),retry=document.createElement('button');title.textContent='เปิดฉากเมืองไม่สำเร็จ';message.textContent=error instanceof Error?error.message:'กรุณาลองใหม่';retry.textContent='ลองอีกครั้ง';retry.onclick=()=>location.reload();$('loading').append(title,message,retry);status('โหลด Assets ไม่ครบ กรุณาลองใหม่');});
