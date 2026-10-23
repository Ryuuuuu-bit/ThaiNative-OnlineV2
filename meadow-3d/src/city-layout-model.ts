export type Facing=0|1|2|3;

export interface LayoutItem {
 id:string;assetId:string;x:number;z:number;scale:number;flip:boolean;facing:Facing;
}

export interface CityLayoutDraft {
 version:2;mapId:'city_plaza';name:string;items:LayoutItem[];
}

function isFacing(value:unknown):value is Facing {
 return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<=3;
}

export function createDraft(items:(Omit<LayoutItem,'facing'>&{facing?:Facing;rotation?:number})[]):CityLayoutDraft {
 return {version:2,mapId:'city_plaza',name:'นครที่ถูกลืมเลือน · แบบร่าง',items:items.map(({id,assetId,x,z,scale,flip,facing=0})=>({id,assetId,x,z,scale,flip,facing}))};
}

export function parseDraft(value:unknown,assetIds:ReadonlySet<string>,availableFacings?:ReadonlyMap<string,readonly Facing[]>):CityLayoutDraft {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('ไฟล์แบบร่างต้องเป็นข้อมูลเมือง');
 const draft=value as Record<string,unknown>;
 if(draft.version!==1&&draft.version!==2||draft.mapId!=='city_plaza')throw new Error('ไม่รองรับรุ่นหรือแผนที่ของแบบร่างนี้');
 if(typeof draft.name!=='string'||!draft.name.trim()||draft.name.length>80)throw new Error('ชื่อแบบร่างต้องมี 1–80 ตัวอักษร');
 if(!Array.isArray(draft.items)||draft.items.length>2000)throw new Error('แบบร่างต้องมีรายการวัตถุไม่เกิน 2,000 ชิ้น');
 const ids=new Set<string>();
 const items=Array.from(draft.items,(value,index):LayoutItem=>{
  const invalid=()=>new Error(`วัตถุชิ้นที่ ${index+1} มีข้อมูลไม่ถูกต้อง`);
  if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
  const item=value as Record<string,unknown>;
  if(typeof item.id!=='string'||!item.id.trim()||item.id.length>180||ids.has(item.id))throw invalid();
  if(typeof item.assetId!=='string'||!assetIds.has(item.assetId))throw invalid();
  if(typeof item.x!=='number'||!Number.isFinite(item.x)||Math.abs(item.x)>48||typeof item.z!=='number'||!Number.isFinite(item.z)||Math.abs(item.z)>48)throw invalid();
  if(typeof item.scale!=='number'||!Number.isFinite(item.scale)||item.scale<.25||item.scale>2||typeof item.flip!=='boolean')throw invalid();
  if(draft.version===1&&item.rotation!==undefined&&(typeof item.rotation!=='number'||!Number.isFinite(item.rotation)||item.rotation<0||item.rotation>=360))throw invalid();
  // Legacy rotation tilted the image, so it cannot describe a ground-facing direction.
  const facing=draft.version===1?0:item.facing;
  if(!isFacing(facing)||availableFacings&&!(availableFacings.get(item.assetId)??[0]).includes(facing))throw invalid();
  ids.add(item.id);
  return {id:item.id,assetId:item.assetId,x:item.x,z:item.z,scale:item.scale,flip:item.flip,facing};
 });
 return {version:2,mapId:'city_plaza',name:draft.name,items};
}

export function moveItem(item:LayoutItem,x:number,z:number,snap:number):LayoutItem {
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(snap)||snap<0)throw new Error('ตำแหน่งและระยะกริดต้องเป็นตัวเลขที่ถูกต้อง');
 const place=(value:number)=>{
  const bounded=Math.max(-48,Math.min(48,value));
  return snap?Math.max(-48,Math.min(48,Math.round(bounded/snap)*snap)):bounded;
 };
 return {...item,x:place(x),z:place(z)};
}

export function faceItem(item:LayoutItem,facing:Facing,availableFacings:readonly Facing[]):LayoutItem {
 if(!isFacing(facing)||!availableFacings.includes(facing))throw new Error('วัตถุนี้ไม่มีภาพสำหรับทิศที่เลือก');
 return {...item,facing};
}

export function createLayoutHistory(initial:CityLayoutDraft) {
 const states=[structuredClone(initial)];
 let cursor=0;
 const current=()=>structuredClone(states[cursor]);
 return {
  current,
  commit(next:CityLayoutDraft) {
   states.splice(cursor+1,states.length,structuredClone(next));
   if(states.length>60)states.shift();
   cursor=states.length-1;
  },
  undo(){cursor=Math.max(0,cursor-1);return current();},
  redo(){cursor=Math.min(states.length-1,cursor+1);return current();},
  canUndo:()=>cursor>0,
  canRedo:()=>cursor<states.length-1,
 };
}
