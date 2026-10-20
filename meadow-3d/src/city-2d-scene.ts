import { CITY_BUILDINGS, CITY_PLANTERS, CITY_BENCHES, CITY_STALLS } from '@the-beginning-online/shared/maps';
import {bake,type Sprite} from './city-2d-art';
import {CITY_HOUSES,CITY_ART_SOLIDS,DECOR,DISTRICTS,TOUR_STOPS,CITY2D_FOUNTAIN as CITY_FOUNTAIN,GARDEN_TREES,districtAt,city2dWalkable,NEW_BUILDINGS} from './city-2d-layout';
import {TOWN_NPCS,WAYPOINTS,CITY_EXITS,nearbyWaypoint,nearbyExit,waypointArrival} from './city-2d-locations';
import {loadPaintedCityScene} from './city-2d-painted-scene';
import {makePaintedGround,isCityPlantingGround} from './city-2d-ground';
import {CITY_GATES} from './city-2d-gates';
import {npcSprite,type NpcSprite} from './city-npc-sprite';
export async function loadCity2DScene(){
 type Prop={x:number;z:number;image:Sprite;label?:string;fade?:boolean;water?:boolean;tree?:boolean;foliage?:boolean};
 type PaintedAsset={id:string;rect:[number,number,number,number]};type PaintedGroup={image:string;assets:PaintedAsset[]};
 let manifest:Record<string,{webp:string}>,ground:HTMLCanvasElement,idle:HTMLImageElement,run:HTMLImageElement,paintedSceneAssets=0;
 const props:Prop[]=[],npcSprites=new Map<string,NpcSprite>();
 const image=async(key:string)=>{const img=new Image();img.src=manifest[key]?.webp??key;await img.decode();return img;};
 function add(x:number,z:number,draw:(c:CanvasRenderingContext2D)=>void,label?:string,fade=false,tree=false){props.push({x,z,image:bake(draw),label,fade,tree});}
  manifest=await fetch('/texture-manifest.json').then(r=>{if(!r.ok)throw Error('โหลดรายการภาพไม่สำเร็จ');return r.json();});
  const env=await fetch('/assets/env-painted/manifest.json').then(r=>r.json());
  const tree=env.assets.find((a: {name:string})=>a.name==='tree-round');
  const loaded=await Promise.all([image('/assets/hero-painted/hero-idle-v1.png'),image('/assets/hero-painted/hero-run-v1.png'),image('/assets/city-painted-v1/npcs-idle-se-atlas-v1.png'),image('/assets/env-painted/'+tree.atlas)]);
  [idle,run]=loaded;ground=await makePaintedGround();
  const cityArt=await fetch('/assets/city-painted-v1/manifest.json').then(r=>r.json()) as {houses:PaintedGroup;npcs:PaintedGroup;residents:PaintedGroup};
  const houses=await image(cityArt.houses.image);
  const theme=await loadPaintedCityScene();paintedSceneAssets=theme.assetCount;
  function themed(x:number,z:number,image:Sprite,label?:string,fade=true){props.push({x,z,image,label,fade});}
  function building(b:{x:number;z:number;w:number;d:number},id:string,label?:string){
    const asset=cityArt.houses.assets.find(a=>a.id===id)!;
    const w=(.83205*b.w+.5547*b.d)*1.13,h=w*asset.rect[3]/asset.rect[2];
    const foot=(.39223*b.w+.58835*b.d)/2;
    add(b.x,b.z,c=>c.drawImage(houses,...asset.rect,-w/2,foot-h,w,h),label,true);
  }
  for(const group of [cityArt.npcs,cityArt.residents]){
    const atlas=await image(group.image);
    for(const a of group.assets){const h=a.id==='child'?1.3:a.id==='guard'?2.65:2.05;
      npcSprites.set(a.id,npcSprite(atlas,a.rect,h));
    }
  }
  const paintedCache=new Map<string,Sprite>();
  async function painted(name:string,w:number,h:number){
    const key=`${name}:${w}:${h}`;if(paintedCache.has(key))return paintedCache.get(key)!;
    const asset=env.assets.find((a:{name:string})=>a.name===name);const atlas=asset.atlas===tree.atlas?loaded[3]:await image('/assets/env-painted/'+asset.atlas);
    // Fit inside the requested size without stretching the painted silhouette.
    const unit=Math.min(w/asset.rect[2],h/asset.rect[3]),drawW=asset.rect[2]*unit,drawH=asset.rect[3]*unit;
    const sprite=bake(c=>c.drawImage(atlas,...asset.rect as [number,number,number,number],-drawW*asset.anchor[0],-drawH*asset.anchor[1],drawW,drawH));paintedCache.set(key,sprite);return sprite;
  }
  const blossom=await painted('tree-flowering',5.4,5.4),tall=await painted('tree-tall',4.7,6.2);
  GARDEN_TREES.forEach(p=>props.push({...p,image:p.flowering?blossom:tall,fade:true,tree:true,foliage:true}));
  const shrub=await painted('bush-flowering',1.25,1),flowers=await painted('flowers-lavender',.6,.7),white=await painted('flowers-white',.6,.6),grass=await painted('grass-2',.5,.5);
  for(let i=0;i<180;i++){
    const a=i*2.39996,r=4+Math.sqrt(i)*1.45,x=-19+Math.cos(a)*r,z=26+Math.sin(a)*r*.65;
    if(x<-44||x>0||z>44||z<17||!city2dWalkable(x,z,.15)||!isCityPlantingGround(x,z))continue;
    if(Math.hypot(x-CITY_FOUNTAIN.x,z-CITY_FOUNTAIN.z)<6.8)continue;
    props.push({x,z,foliage:true,image:i%4===0?shrub:i%3===0?white:i%2?flowers:grass});
  }
  for(const b of CITY_HOUSES)for(const dx of [-b.w/2-1,b.w/2+1])props.push({x:b.x+dx,z:b.z+1,image:shrub});
  for(const p of DECOR){
    if(p.kind==='gate')continue;
    if(['guild','inn','workshop'].includes(p.kind)){building(p,p.kind==='workshop'?'cottage':p.kind,p.label);continue;}
    const sprite=p.kind==='lamp'?theme.upright('lamp',3.2):p.kind==='banner'?theme.upright('banner',4.2):p.kind==='dummy'?theme.upright('dummy',2.25):theme.footprint(p.kind,p.w,p.d);
    themed(p.x,p.z,sprite,p.label,!['flowerbed','table'].includes(p.kind));
  }

  CITY_HOUSES.forEach((b,i)=>building(b,i%3===0?'townhouse':'cottage'));
  CITY_BUILDINGS.forEach(b=>building(b,b.id==='storage'?'guild':b.id,b.name));
  themed(0,0,theme.footprint('clocktower',4.4,4.4),'หอนาฬิกา');
  props.push({x:CITY_FOUNTAIN.x,z:CITY_FOUNTAIN.z,image:theme.sprite('fountain',6,1.6),label:'น้ำพุธาราจันทร์',water:true});
  for(const p of CITY_PLANTERS){
    themed(p.x,p.z,theme.footprint('flowerbed',1.3,1.3),undefined,false);
    add(p.x,p.z,c=>{const [sx,sy,sw,sh]=tree.rect;const w=5.1,h=w*sh/sw;c.drawImage(loaded[3],sx,sy,sw,sh,-w*tree.anchor[0],-h,w,h);},undefined,true,true);
  }
  for(const b of CITY_BENCHES)themed(b.x,b.z,theme.footprint('bench',b.w,b.d));
  for(const p of CITY_STALLS)themed(p.x,p.z,theme.footprint('stall',p.w,p.d));
  for(const p of CITY_ART_SOLIDS){
    if(p.kind==='circle')themed(p.x,p.z,theme.sprite('well',p.r*2.2,p.r*.5),undefined,false);
    else {const id=p.label.startsWith('guard')?'booth':p.label.startsWith('cart')?'wagon':p.label.startsWith('hay')?'hay':'crates';themed(p.x,p.z,theme.footprint(id,p.w,p.d));}
  }
  // Repeated painted panels are fitted at their ground endpoints, not tiled as rectangles.
  function wallRun(axis:'x'|'z',fixed:number,start:number,end:number){
    const count=Math.ceil((end-start)/8),length=(end-start)/count;
    const sprite=theme.wall(axis,length);
    for(let i=0;i<count;i++){const v=start+(i+.5)*length;themed(axis==='x'?v:fixed,axis==='x'?fixed:v,sprite);}
  }
  for(const [start,end] of [[-47,-4.8],[4.8,47]])for(const side of [-47,47]){wallRun('x',side,start,end);wallRun('z',side,start,end);}
  for(const [x,z] of [[-47,-47],[47,-47],[-47,47],[47,47]])themed(x,z,theme.footprint('watchtower',3.4,3.4));
  for(const gate of CITY_GATES)themed(gate.x,gate.z,theme.gate(gate.axis),gate.name);
  for(const p of WAYPOINTS){
    themed(p.x,p.z,theme.sprite('portal',3.8,3.8*240/359/2),undefined,false);
    for(const dx of [-2,2])themed(p.x+dx,p.z,theme.upright('marker',1.65));
  }

return {ground,props,npcSprites,paintedSceneAssets};
}
