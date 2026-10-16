import * as T from 'three';
import { CITY_BUILDINGS, HEALER } from '@thainative/shared/maps';
import { label } from './scene';
import type { PaintedLoader } from './assets';

/** All city geometry is local and untextured, except the existing Angel sprite. */
export function buildCity(scene: T.Scene, loader: PaintedLoader) {
 const root=new T.Group();root.name='city_plaza';scene.add(root);
 const materials=new Map<string,T.MeshStandardMaterial>();
 function material(color:string){if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:1}));return materials.get(color)!;}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,color='#94948b'){
  const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),material(color));mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 }
 function cylinder(x:number,y:number,z:number,r:number,h:number,color:string){const m=new T.Mesh(new T.CylinderGeometry(r,r,h,32),material(color));m.position.set(x,y+h/2,z);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
 function sign(text:string,x:number,y:number,z:number,scale=1.6){const s=label(text,'#f1ead5');s.position.set(x,y,z);s.scale.multiplyScalar(scale);root.add(s);}
 box(0,-.2,0,60,.2,60,'#a5aaa1');
 box(0,.01,0,5,.04,58,'#c4c2b5');box(0,.02,0,58,.04,5,'#c4c2b5');
 // Broad central apron and shallow south steps keep the spawn and Angel accessible.
 cylinder(0,.04,0,5,.08,'#b8b7aa');
 box(0,.12,0,4,10,4,'#898d89');box(0,10.12,0,4.8,.5,4.8,'#6f7876');
 cylinder(0,10.62,0,1.9,2,'#a4a395');
 for(const [x,z,rotation] of [[0,2.02,Math.PI/2],[2.02,0,0],[0,-2.02,Math.PI/2],[-2.02,0,0]]){
  const face=cylinder(x,7.4,z,1,.09,'#e0d9c2');face.rotation.z=Math.PI/2;face.rotation.y=rotation;
 }
 box(0,.08,2.6,5,.15,1,'#bab9ad');box(0,.04,3.5,6,.08,1,'#bab9ad');
 sign('หอนาฬิกา · จุดเกิด',0,13.6,0,2);
 for(const b of CITY_BUILDINGS){
  box(b.x,0,b.z,b.w,b.id==='market'?2.6:4.5,b.d,b.id==='forge'?'#8b8580':'#949e96');
  box(b.x,b.id==='market'?2.6:4.5,b.z,b.w+.6,.5,b.d+.6,'#787e79');
  sign(b.name,b.x,6.2,b.z,2);
  cylinder(b.talk.x,0,b.talk.z,.4,1.5,'#c1b394');cylinder(b.talk.x,1.5,b.talk.z,.3,.5,'#d3c7ae');
  sign(b.npc,b.talk.x,2.7,b.talk.z);
 }
 cylinder(-9,0,9,2.5,.65,'#8b9593');cylinder(-9,.65,9,2.1,.08,'#89a7ac');cylinder(-9,.73,9,.45,1.4,'#a4aaa4');
 cylinder(HEALER.x,0,HEALER.z,.4,1.6,'#d1cbb6');cylinder(HEALER.x,1.6,HEALER.z,.3,.4,'#ddd2bb');
 sign('นักบวชหมอ · ฟื้น HP / SP',HEALER.x,2.8,HEALER.z,1.8);
 for(const axis of ['x','z'] as const)for(const side of [-1,1]){
  for(const offset of [-16.5,16.5])box(axis==='x'?side*30:offset,0,axis==='z'?side*30:offset,axis==='x'?1:27,5,axis==='z'?1:27,'#7d8987');
  const x=axis==='x'?side*30:0,z=axis==='z'?side*30:0,open=axis==='z'&&side===1;
  box(x,5,z,axis==='x'?2:7,1.2,axis==='z'?2:7,'#929a91');
  if(!open)box(x,0,z,axis==='x'?1:6,5,axis==='z'?1:6,'#606f70');
  for(const offset of [-3.5,3.5])box(x+(axis==='z'?offset:0),0,z+(axis==='x'?offset:0),2,6.5,2,'#8b9690');
  sign(open?'ทุ่งวุ้นจิ๋ว ↓':'หมอกปิดทาง',x,7.8,z,1.8);
  // Layered translucent curtains grow denser at the boundary, independent of camera distance.
  for(let i=0;i<5;i++){
   const fog=new T.Mesh(new T.PlaneGeometry(66,12),new T.MeshBasicMaterial({color:'#c8d1cd',transparent:true,opacity:.10+i*.055,side:T.DoubleSide,depthWrite:false}));
   fog.position.set(axis==='x'?side*(28+i*.6):0,5,axis==='z'?side*(28+i*.6):0);fog.rotation.y=axis==='x'?Math.PI/2:0;root.add(fog);
  }
 }
 cylinder(4,0,25,.45,1.6,'#7c8996');cylinder(4,1.6,25,.32,.45,'#c5baa4');sign('หัวหน้าทหารประตู',4,3,25,1.8);
 const angel=new T.Sprite(new T.SpriteMaterial({map:loader.load('/assets/skills-painted/angel-v1.png'),transparent:true,alphaTest:.04,depthWrite:false,toneMapped:false}));
 angel.center.set(.5,.025);angel.scale.set(2.6,3.9,1);angel.position.set(0,.2,3.2);root.add(angel);
 return {root,setQuality(hq:boolean){root.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=hq;});},snapshot:()=>({ready:true,mapId:'city_plaza',size:[60,60]}),update(_time:number){}};
}
