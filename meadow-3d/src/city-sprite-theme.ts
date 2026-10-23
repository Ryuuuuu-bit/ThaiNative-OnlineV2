import {bake,type Sprite} from './city-2d-art';
import {cityNpcWorldHeight,npcSprite,type CityNpcArt} from './city-npc-sprite';
import type {Facing} from './city-layout-model';
import {fortificationTransform} from './city-2d-gates';

type ThemeView={rect:[number,number,number,number];anchor:[number,number]};
type ThemeManifest={version:1;name:string;assets:Record<string,{image:string;views:ThemeView[]}>;ground:{grass:string;road:string;garden:string}};
let themePromise:ReturnType<typeof loadTheme>|undefined;
export function loadCitySpriteTheme(){return themePromise??=loadTheme();}

async function loadTheme(){
 const response=await fetch('/assets/city-sprite-v2/manifest.json');
 if(!response.ok)throw Error('โหลดชุดภาพเมืองไม่สำเร็จ');
 const manifest=await response.json() as ThemeManifest;
 if(manifest.version!==1||!manifest.assets||!manifest.ground)throw Error('ชุดภาพเมืองมีข้อมูลไม่ถูกต้อง');
 const sources=new Map<string,HTMLImageElement>();
 await Promise.all(Object.entries(manifest.assets).map(async([family,asset])=>{
   if(!Array.isArray(asset.views)||asset.views.length!==4||asset.views.some(v=>!Array.isArray(v.rect)||v.rect.length!==4||v.rect.some(n=>!Number.isFinite(n))||v.rect[0]<0||v.rect[1]<0||v.rect[2]<=0||v.rect[3]<=0||!Array.isArray(v.anchor)||v.anchor.length!==2||v.anchor.some(n=>!Number.isFinite(n)||n<0||n>1)))throw Error('ภาพเมืองต้องมีสี่ทิศที่ถูกต้อง: '+family);
   const source=new Image();source.src=asset.image;await source.decode();
   if(asset.views.some(v=>v.rect[0]+v.rect[2]>source.naturalWidth||v.rect[1]+v.rect[3]>source.naturalHeight))throw Error('กรอบภาพเมืองเกินขนาดภาพ: '+family);
   sources.set(family,source);
 }));
 function view(family:string,facing:Facing=0){
   const asset=manifest.assets[family],source=sources.get(family);
   if(!asset||!source)throw Error('ไม่มีภาพเมือง '+family);
   return {source,...asset.views[facing]};
 }
 const cache=new Map<string,Record<Facing,Sprite>>();
 function faces(id:string,base:Sprite):Record<Facing,Sprite>{
   const cached=cache.get(id);if(cached)return cached;
   const [kind,name,a,b]=id.split(':'),family=kind==='npc'?'npc-'+name:kind==='wall'||kind==='gate'?kind:name;
   const sprites={} as Record<Facing,Sprite>;
   for(const facing of [0,1,2,3] as const){
     const axis=kind==='wall'||kind==='gate',offset=axis&&name==='z'?1:0,index=(facing+offset)%4 as Facing,{source,rect,anchor}=view(family,index);
     if(axis){
       const t=fortificationTransform(kind,index,kind==='wall'?Number(a):6.8);
       sprites[facing]=bake(c=>{c.transform(t.sx,t.skew,0,t.sy,t.tx,t.ty);c.drawImage(source,...rect,...rect);});
       continue;
     }
     let width=base.width/28,height:number,bottom=base.top+base.height/28;
     if(kind==='npc'){
       height=cityNpcWorldHeight(name as CityNpcArt);width=height*rect[2]/rect[3];bottom=0;
     }else if(kind==='nature'){
       if(b){const unit=Math.min(Number(a)/rect[2],Number(b)/rect[3]);width=rect[2]*unit;height=rect[3]*unit;}
       else {width=Number(a);height=width*rect[3]/rect[2];}
       bottom=0;
     }else if(kind==='building'||kind==='theme'&&b&&!['fountain','well'].includes(name)){
       const w=facing%2?Number(b):Number(a),d=facing%2?Number(a):Number(b);
       width=(.83205*w+.5547*d)*(kind==='building'?1.13:1.08);height=width*rect[3]/rect[2];bottom=(.39223*w+.58835*d)/2;
     }else if(['lamp','banner','dummy','marker','warp-core'].includes(name)){
       height=Number(a);width=height*rect[2]/rect[3];bottom=.1;
     }else if(name==='fountain'||name==='well'||name==='portal'){
       width=Number(a);height=width*rect[3]/rect[2];bottom=name==='portal'?3.8*240/359/2:Number(b);
     }else throw Error('ไม่รู้จักชนิดภาพเมือง '+id);
     sprites[facing]=bake(c=>c.drawImage(source,...rect,-width*anchor[0],bottom-height*anchor[1],width,height));
   }
   cache.set(id,sprites);return sprites;
 }
 function npc(art:CityNpcArt){
   const {source,rect,anchor}=view('npc-'+art),sprite=npcSprite(source,rect,cityNpcWorldHeight(art));sprite.anchor=anchor;return sprite;
 }
 return {manifest,view,faces,npc};
}
