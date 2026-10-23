import {CITY,CITY_LAYOUT,cityWalkable} from '@the-beginning-online/shared/maps';
import {CITY_GROUND_FILTER} from './city-palette';
const FOUNTAIN=CITY_LAYOUT.items.find(p=>p.assetId.startsWith('theme:fountain:'))!;

const EXTENT=106,HALF=53,SIZE=2048,MASK_SIZE=768;
const aprons=CITY_LAYOUT.items.filter(p=>p.assetId.startsWith('building:')||/^theme:(chapel|gazebo):/.test(p.assetId)).map(p=>{
 const parts=p.assetId.split(':'),w=Number(parts[2]),d=Number(parts[3]);
 return{x:p.x,z:p.z,w:(p.facing%2?d:w)*p.scale,d:(p.facing%2?w:d)*p.scale};
});
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function rectangle(x:number,z:number,cx:number,cz:number,hw:number,hd:number){
  const dx=Math.abs(x-cx)-hw,dz=Math.abs(z-cz)-hd;
  return Math.hypot(Math.max(dx,0),Math.max(dz,0))+Math.min(Math.max(dx,dz),0);
}
function roadDistance(x:number,z:number){
  let d=Math.min(Math.hypot(x,z)-12.5,Math.abs(x)-3.3,Math.abs(z)-3.3,
    Math.abs(rectangle(x,z,0,0,36,36))-1.7,
    rectangle(x,z,-13,-25,9,10),rectangle(x,z,13,-27,8,14),
    rectangle(x,z,28,14,14,11),rectangle(x,z,-28,-13,13,11),
    rectangle(x,z,-28,9,9,8),rectangle(x,z,18,29,12,9),
    rectangle(x,z,-15,-14,1.8,10),rectangle(x,z,15,15,1.8,11),
    rectangle(x,z,26,-27,1.6,12),rectangle(x,z,32,-18,8,1.6));
  for(const b of aprons)d=Math.min(d,rectangle(x,z,b.x,b.z,b.w/2+1.6,b.d/2+2));
  return d;
}
function gardenDistance(x:number,z:number){
  return Math.min(Math.abs(Math.hypot(x-FOUNTAIN.x,z-FOUNTAIN.z)-4.8)-1.4,
    Math.hypot(x-FOUNTAIN.x,z-FOUNTAIN.z)-3.4,
    rectangle(x,z,-23,16,12,1.3),rectangle(x,z,-23,31,10,1.3),
    rectangle(x,z,-16,24,1.3,9),rectangle(x,z,-31,24,1.3,8),
    rectangle(x,z,-10,15,7,1.2));
}
// Small vegetation stays on planting ground, clear of paved routes and their shoulders.
export function isCityPlantingGround(x:number,z:number){return roadDistance(x,z)>.8&&gardenDistance(x,z)>.8;}
function noise(x:number,z:number){return Math.sin(x*2.7+Math.sin(z*2.1))*.12+Math.sin(z*5.3-x*1.7)*.055;}
function makeMasks(){
  const road=document.createElement('canvas'),path=document.createElement('canvas'),edge=document.createElement('canvas');
  for(const c of [road,path,edge]){c.width=MASK_SIZE;c.height=MASK_SIZE;}
  const masks=[road,path,edge].map(c=>c.getContext('2d')!.createImageData(MASK_SIZE,MASK_SIZE));
  for(let y=0;y<MASK_SIZE;y++)for(let x=0;x<MASK_SIZE;x++){
    const wx=(x+.5)/MASK_SIZE*EXTENT-HALF,wz=(y+.5)/MASK_SIZE*EXTENT-HALF;
    if(Math.max(Math.abs(wx),Math.abs(wz))>48)continue;
    const n=noise(wx,wz),rd=roadDistance(wx,wz)+n,pd=gardenDistance(wx,wz)+n*1.5;
    const alpha=[clamp(.5-rd/.32),clamp(.5-pd/.48),clamp(.5-(Math.min(rd,pd)-.28)/.7)];
    const at=(y*MASK_SIZE+x)*4;
    masks.forEach((m,i)=>{m.data[at]=m.data[at+1]=m.data[at+2]=255;m.data[at+3]=Math.round(alpha[i]*255);});
  }
  [road,path,edge].forEach((c,i)=>c.getContext('2d')!.putImageData(masks[i],0,0));
  return {road,path,edge};
}

export async function makePaintedGround(shadows=true){
  if(CITY.empty){const empty=document.createElement('canvas');empty.width=empty.height=1;return empty;}
  const images=await Promise.all(['road','grass','garden'].map(async id=>{
    const img=new Image();img.src='/assets/city-sprite-v2/ground-'+id+'.webp';await img.decode();return img;
  }));
  const masks=makeMasks(),plane=document.createElement('canvas');plane.width=plane.height=SIZE;
  const c=plane.getContext('2d')!,pixels=SIZE/EXTENT;
  function pattern(img:HTMLImageElement,metres:number){
    const p=c.createPattern(img,'repeat')!;
    p.setTransform(new DOMMatrix().scale(metres*pixels/img.width,metres*pixels/img.height));return p;
  }
  // The shared backdrop draws grass continuously inside and outside the city.
  // Keep this overlay transparent beyond roads, shadows and planting detail.
  const layer=document.createElement('canvas');layer.width=layer.height=SIZE;const lc=layer.getContext('2d')!;
  function blend(fill:CanvasPattern|string,mask:HTMLCanvasElement,opacity=1){
    lc.clearRect(0,0,SIZE,SIZE);lc.globalCompositeOperation='source-over';lc.filter=CITY_GROUND_FILTER;lc.fillStyle=fill;lc.fillRect(0,0,SIZE,SIZE);lc.filter='none';
    lc.globalCompositeOperation='destination-in';lc.drawImage(mask,0,0,SIZE,SIZE);
    c.globalAlpha=opacity;c.drawImage(layer,0,0);c.globalAlpha=1;
  }
  // A narrow earthy shoulder blends the two painted materials without a grid edge.
  blend(pattern(images[2],7),masks.edge,.7);
  blend(pattern(images[2],7),masks.path);
  blend(pattern(images[0],8),masks.road);
  c.save();c.scale(pixels,pixels);c.translate(HALF,HALF);
  // Gentle mottling breaks up repeated tiles across broad areas; baked once at load.
  for(let i=0;i<160;i++){
    const x=Math.sin(i*12.9898)*47,z=Math.sin(i*78.233+2)*47,r=1.4+(i%7)*.5;
    const g=c.createRadialGradient(x,z,0,x,z,r);g.addColorStop(0,i%3?'#d5c79c0a':'#334c3110');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(x-r,z-r,r*2,r*2);
  }
  // Small olive tufts and seed flowers stay in planting soil, clear of the saved layout.
  for(let i=0;i<2400;i++){
    const x=Math.sin(i*127.1+3)*46,z=Math.sin(i*311.7+7)*46;
    if(!isCityPlantingGround(x,z)||!cityWalkable(x,z,.35))continue;
    c.strokeStyle=i%3?'#a1a05d88':'#3e492e99';c.lineWidth=.035;c.beginPath();c.moveTo(x-.07,z+.04);c.lineTo(x,z-.13);c.lineTo(x+.06,z+.03);c.stroke();
    if(i%11===0){c.fillStyle=i%22?'#d4c996aa':'#a49ab199';c.fillRect(x-.035,z-.13,.07,.07);}
  }
  // Soft contact shadows integrate vegetation and buildings with textured ground.
  function shadow(x:number,z:number,rx:number,rz:number){
    c.save();c.translate(x,z);c.scale(rx,rz);const g=c.createRadialGradient(0,0,.1,0,0,1);g.addColorStop(0,'#263b302f');g.addColorStop(.55,'#293f301a');g.addColorStop(1,'#293f3000');c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  }
  if(shadows){
    for(const b of aprons)shadow(b.x+1,b.z+.8,b.w*.85,b.d*.85);
    for(const p of CITY_LAYOUT.items.filter(p=>p.assetId.startsWith('nature:tree-')))shadow(p.x+.7,p.z+.6,2.2*p.scale,2*p.scale);
  }
  c.restore();
  const ground=document.createElement('canvas');ground.width=3000;ground.height=2222;
  const gc=ground.getContext('2d')!;gc.scale(20,20);gc.translate(75,55.5556);
  gc.transform(.83205,.39223,-.5547,.58835,0,0);gc.drawImage(plane,-HALF,-HALF,EXTENT,EXTENT);
  return ground;
}
