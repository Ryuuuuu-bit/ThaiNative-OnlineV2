import {HERO_PIXEL_METRES} from './world-scale.ts';
import * as T from 'three';import type{PaintedLoader}from'./assets';
import type { Player } from './sim';
import { makeHero } from './actors';
import { facingFor, motionFor, motionFrame, atlasCell, MOTIONS, MOTION_DURATION } from './sprite-animation';
import type { Motion } from './sprite-animation';
import { SKILL_MOTIONS, SKILL_FRAMES, SKILL_DURATION, CONTACT_FRAME, isSkillMotion, skillFrame, earthHeight, type SkillMotion } from './skill-motions';

// One download/GPU source per loader; each actor owns its UV transform.
const banks=new WeakMap<PaintedLoader,Map<string,{texture?:T.Texture;subscribers:((t:T.Texture)=>void)[]}>>();
function instanceTexture(t:T.Texture){const copy=t.clone();(copy as any).isCompressedTexture=(t as any).isCompressedTexture;return copy;}
function request(loader:PaintedLoader,id:string,receive:(t:T.Texture)=>void){
 let bank=banks.get(loader);if(!bank){bank=new Map();banks.set(loader,bank);}
 const entry=bank.get(id);if(entry){if(entry.texture)receive(instanceTexture(entry.texture));else entry.subscribers.push(receive);return;}
 const next:{texture?:T.Texture;subscribers:((t:T.Texture)=>void)[]}={subscribers:[receive]};bank.set(id,next);
 const url=isSkillMotion(id)?`/assets/hero-skills/hero-skill-${id}-v1.png`:`/assets/hero-painted/hero-${id}-v1.png`;
 loader.load(url,t=>{next.texture=t;next.subscribers.splice(0).forEach(fn=>fn(instanceTexture(t)));});
}

/** Hand-painted, alpha-tested billboard with one physical foot anchor. */
export function makePaintedHero(loader: PaintedLoader) {
  const root = new T.Group();
  const fallback = makeHero();
  root.add(fallback.root);
  const material = new T.SpriteMaterial({transparent:true, alphaTest:.08, depthWrite:true, toneMapped:false});
  const portrait = new T.Sprite(material);
  // Normalized art baseline is y=240/256, independent of weapon extent.
  portrait.center.set(.5, 16/256);
  portrait.scale.set(384*HERO_PIXEL_METRES,256*HERO_PIXEL_METRES,1);
  portrait.position.y=.035;
  portrait.visible=false;
  root.add(portrait);
  const shadow = new T.Mesh(new T.CircleGeometry(.45,32),new T.MeshBasicMaterial({color:'#233d2b',transparent:true,opacity:.22,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.y=.7;
  shadow.position.y=.025;
  root.add(shadow);
  const textures:Partial<Record<Motion,T.Texture>>={};
  const skills:Partial<Record<SkillMotion,T.Texture>>={};
  for(const motion of MOTIONS) {
    request(loader,motion,texture=>{
      texture.colorSpace=T.SRGBColorSpace;
      texture.magFilter=T.LinearFilter;
      texture.minFilter=T.LinearFilter;
      texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;
      textures[motion]=texture;
    });
  }
  for(const id of SKILL_MOTIONS)request(loader,id,t=>{t.magFilter=t.minFilter=T.LinearFilter;skills[id]=t;});
  let lastMotion:Motion='idle', lastTime=0, motionClock=0;
  let skill:SkillMotion|null=null,elapsed=0,contact:number|null=null,combo=0;
  let skillFacing={x:0,z:1};
  let presented:any=null,fresh=false;
  let diagnostic={motion:'idle' as Motion,actualMotion:'idle' as Motion,frame:0,direction:'SE',loaded:[] as Motion[]};
  return {root, snapshot:()=>({...diagnostic,loaded:Object.keys(textures),skillsLoaded:Object.keys(skills),skill,skillElapsed:elapsed,height:portrait.position.y-.035}),
    event(e:any){
      if(e.type==='skill'&&isSkillMotion(e.skillId)){skill=e.skillId;elapsed=0;contact=null;fresh=true;skillFacing={x:e.dx??0,z:e.dz??1};}
      if(e.type==='skillImpact'&&e.skillId===skill){elapsed=.4;contact=CONTACT_FRAME[skill!];}
      if(e.type==='hit'&&skill&&skill!=='earth_break'){contact=skill==='whirlwind'&&e.hitIndex===2?5:CONTACT_FRAME[skill];if(skill==='whirlwind'&&e.hitIndex===2)elapsed=Math.max(elapsed,.25);}
      if(e.type==='slash'){skill=null;combo=e.combo||0;fresh=true;}
      if(e.type==='dash'||e.type==='death'){skill=null;contact=null;}
    },
    dispose(){Object.values(textures).forEach(t=>t.dispose());Object.values(skills).forEach(t=>t.dispose());material.dispose();shadow.geometry.dispose();(shadow.material as T.Material).dispose();},
    update(p:Player,time:number,frozen=false) {
    const dt=Math.min(.05,Math.max(0,time-lastTime));lastTime=time;
    if(frozen&&contact===null&&presented&&!fresh)return;
    if(!frozen&&!fresh)elapsed+=dt;
    fresh=false;
    if(p.dead||p.dash>0||p.hurt>0){skill=null;contact=null;}
    if(skill&&elapsed>=SKILL_DURATION[skill])skill=null;
    const motion=motionFor(p);
    if(motion!==lastMotion)motionClock=0;
    else motionClock+=dt;
    lastMotion=motion;
    const texture=skill&&skills[skill]||textures[motion]||textures.idle;
    if(!texture) {fallback.root.visible=true;portrait.visible=false;root.position.set(0,0,0);fallback.update(p,time);return;}
    fallback.root.visible=false;portrait.visible=true;
    const actualMotion=textures[motion]?motion:'idle';
    const direction=skill?facingFor(skillFacing.x,skillFacing.z):facingFor(p.fx,p.fz);
    // Remaining gameplay timers also reset consecutive attacks of the same kind.
    const legacyElapsed=motion==='attack'||motion==='spin'||motion==='cast'?MOTION_DURATION[motion]-p.attack:
      motion==='dodge'?MOTION_DURATION.dodge-p.dash:motion==='hit'?MOTION_DURATION.hit-p.hurt:motionClock;
    let frame=motionFrame(motion,legacyElapsed);
    let cell=atlasCell(actualMotion,direction,frame);
    if(skill&&skills[skill]){frame=contact??skillFrame(skill,elapsed);cell={column:frame,row:['SE','SW','NE','NW'].indexOf(direction),columns:SKILL_FRAMES[skill],rows:4};}
    else if(motion==='attack'&&p.attackKind==='slash'){frame=[2,3,4][combo];cell=atlasCell(actualMotion,direction,frame);}
    diagnostic={motion:(skill||motion) as Motion,actualMotion:(skill&&skills[skill]?skill:actualMotion) as Motion,frame,direction,loaded:[]};
    texture.repeat.set(1/cell.columns,1/cell.rows);
    texture.offset.set(cell.column/cell.columns,1-(cell.row+1)/cell.rows);
    if(material.map!==texture){
      // Retain the compressed CPU source, release inactive skill GPU storage.
      if(material.map&&Object.values(skills).includes(material.map))material.map.dispose();
      material.map=texture;material.needsUpdate=true;
    }
    root.position.set(p.x,.015,p.z);
    material.color.set(!p.dead&&p.hurt>0?'#ffb6aa':'#ffffff');
    material.opacity=!p.dead&&p.invulnerable>0&&Math.floor(time*18)%2===0?.65:1;
    material.rotation=0;
    const breath=motion==='idle'?Math.sin(time*2.2)*.006:0;
    portrait.scale.set(actualMotion==='death'?512*HERO_PIXEL_METRES:384*HERO_PIXEL_METRES,256*HERO_PIXEL_METRES+breath,1);
    const lift=skill==='earth_break'?earthHeight(elapsed):0;
    portrait.position.y=.035+lift;
    shadow.scale.set((p.dash>0?1.4:1)*(1-lift*.35),.7*(1-lift*.35),1);
    (shadow.material as T.MeshBasicMaterial).opacity=.22*(1-lift*.45);
    contact=null;presented=diagnostic;
  }};
}
