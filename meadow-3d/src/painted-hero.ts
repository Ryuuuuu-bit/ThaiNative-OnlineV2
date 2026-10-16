import * as T from 'three';
import type { Player } from './sim';
import { makeHero } from './actors';
import { facingFor, motionFor, motionFrame, atlasCell, MOTIONS, MOTION_DURATION } from './sprite-animation';
import type { Motion } from './sprite-animation';

/** Hand-painted, alpha-tested billboard with one physical foot anchor. */
export function makePaintedHero(loader: T.TextureLoader) {
  const root = new T.Group();
  const fallback = makeHero();
  root.add(fallback.root);
  const material = new T.SpriteMaterial({transparent:true, alphaTest:.08, depthWrite:true, toneMapped:false});
  const portrait = new T.Sprite(material);
  // Normalized art baseline is y=240/256, independent of weapon extent.
  portrait.center.set(.5, 16/256);
  portrait.scale.set(6.3,4.2,1);
  portrait.position.y=.035;
  portrait.visible=false;
  root.add(portrait);
  const shadow = new T.Mesh(new T.CircleGeometry(.45,32),new T.MeshBasicMaterial({color:'#233d2b',transparent:true,opacity:.22,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.y=.7;
  shadow.position.y=.025;
  root.add(shadow);
  const textures:Partial<Record<Motion,T.Texture>>={};
  for(const motion of MOTIONS) {
    loader.load(`/assets/hero-painted/hero-${motion}-v1.png`,texture=>{
      texture.colorSpace=T.SRGBColorSpace;
      texture.magFilter=T.LinearFilter;
      texture.minFilter=T.LinearMipmapLinearFilter;
      texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
      textures[motion]=texture;
    });
  }
  let lastMotion:Motion='idle', lastTime=0, motionClock=0;
  let diagnostic={motion:'idle' as Motion,actualMotion:'idle' as Motion,frame:0,direction:'SE',loaded:[] as Motion[]};
  return {root, snapshot:()=>({...diagnostic,loaded:Object.keys(textures)}), update(p:Player,time:number) {
    const dt=Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
    const motion=motionFor(p);
    if(motion!==lastMotion)motionClock=0;
    else motionClock+=dt;
    lastMotion=motion;
    const texture=textures[motion]||textures.idle;
    if(!texture) {fallback.root.visible=true;portrait.visible=false;root.position.set(0,0,0);fallback.update(p,time);return;}
    fallback.root.visible=false;portrait.visible=true;
    const actualMotion=textures[motion]?motion:'idle';
    const direction=facingFor(p.fx,p.fz);
    // Remaining gameplay timers also reset consecutive attacks of the same kind.
    const elapsed=motion==='attack'||motion==='spin'||motion==='cast'?MOTION_DURATION[motion]-p.attack:
      motion==='dodge'?MOTION_DURATION.dodge-p.dash:motion==='hit'?MOTION_DURATION.hit-p.hurt:motionClock;
    const frame=motionFrame(motion,elapsed);
    diagnostic={motion,actualMotion,frame,direction,loaded:[]};
    const cell=atlasCell(actualMotion,direction,frame);
    texture.repeat.set(1/cell.columns,1/cell.rows);
    texture.offset.set(cell.column/cell.columns,1-(cell.row+1)/cell.rows);
    if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
    root.position.set(p.x,.015,p.z);
    material.color.set(!p.dead&&p.hurt>0?'#ffb6aa':'#ffffff');
    material.opacity=!p.dead&&p.invulnerable>0&&Math.floor(time*18)%2===0?.65:1;
    material.rotation=0;
    const breath=motion==='idle'?Math.sin(time*2.2)*.006:0;
    portrait.scale.set(actualMotion==='death'?8.4:6.3,4.2+breath,1);
    portrait.position.y=.035;
    shadow.scale.x=p.dash>0?1.4:1;
  }};
}
