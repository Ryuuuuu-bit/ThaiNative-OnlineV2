import {CanvasAssets} from './game-2d-assets';
import {loadField2D,type FieldProp} from './game-2d-fields';
import {loadMapBackdrop} from './game-2d-backdrop';
import {boundaryPlants} from './game-2d-boundaries';
import {project2D} from './game-2d-projection';
import {LAYOUTS} from '@the-beginning-online/shared/maps';
import previousObstacles from '../art/canyon-painted-v1/previous-obstacles.json';
import {HERO_PIXEL_METRES} from './world-scale';
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!,c=canvas.getContext('2d')!;
const status=document.querySelector('#status')!;
const assets=new CanvasAssets(await fetch('/texture-manifest.json').then(r=>r.json()));
const hero=await assets.image('/assets/hero-painted/hero-idle-v1.png');
const [field,backdrop,env]=await Promise.all([loadField2D('canyon',assets),loadMapBackdrop('canyon',assets),assets.json<any>('/assets/env-painted/manifest.json')]);
const old:FieldProp[]=[];
async function oldProp(name:string,x:number,z:number,h:number){const a=env.assets.find((a:any)=>a.name===name);old.push({x,z,h,w:h*a.rect[2]/a.rect[3],rect:a.rect,anchor:a.anchor,image:await assets.image('/assets/env-painted/'+a.atlas)});}
for(const o of previousObstacles)await oldProp(o.kind==='rock-cluster'?'rock-cluster':'boulder-tall',o.x,o.z,o.r*(o.kind==='rock-cluster'?3:4));
for(const p of boundaryPlants('canyon'))await oldProp(['boulder-tall','rock-cluster','boulder-round','boulder-flat','grass-2','boulder-tall'][p.variant],p.x,p.z,p.variant===3?2.2:p.variant===4?1.6:p.h);
const extras=field.props.slice(LAYOUTS.canyon.obstacles.length);
const updated=[...backdrop.props,...field.props];
let legacy=false,x=-58,z=0,scale=30,dirty=true;
const keys=new Set<string>();
document.querySelector('#toggle')!.addEventListener('click',()=>{legacy=!legacy;document.querySelector('#toggle')!.textContent=legacy?'ดูภาพใหม่':'ดูภาพเดิม';dirty=true;});
document.querySelector('#place')!.addEventListener('change',e=>{[x,z]=({entry:[-58,0],west:[-31,-22],center:[5,2],boss:[46,24]})[(e.target as HTMLSelectElement).value];dirty=true;});
document.querySelector('#zoom')!.addEventListener('input',e=>{scale=+(e.target as HTMLInputElement).value;dirty=true;});
addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;if(['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();keys.add(e.key);}});
addEventListener('keyup',e=>keys.delete(e.key));addEventListener('blur',()=>keys.clear());addEventListener('resize',()=>dirty=true);
function draw(){const dpr=Math.min(devicePixelRatio,1.5),w=innerWidth,h=innerHeight;canvas.width=w*dpr;canvas.height=h*dpr;c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingQuality='high';const focus=project2D(x,z),o={x:w/2-focus.x*scale,y:h*.6-focus.y*scale};
 backdrop.draw(c,o,scale,w,h);c.save();c.transform(.83205*scale,.39223*scale,-.5547*scale,.58835*scale,o.x,o.y);const l=field.layout;c.drawImage(field.plane,-l.halfX,-l.halfZ,l.halfX*2,l.halfZ*2);c.restore();
 const props=legacy?[...old,...extras]:updated;let visible=0;
 for(const p of [...props].sort((a,b)=>project2D(a.x,a.z).y-project2D(b.x,b.z).y)){const q=project2D(p.x,p.z),px=o.x+q.x*scale-p.w*p.anchor[0]*scale,py=o.y+q.y*scale-p.h*p.anchor[1]*scale;if(px+p.w*scale<0||px>w||py+p.h*scale<0||py>h)continue;c.drawImage(p.image,...p.rect as [number,number,number,number],px,py,p.w*scale,p.h*scale);visible++;}
 const hw=384*HERO_PIXEL_METRES*scale,hh=256*HERO_PIXEL_METRES*scale;c.drawImage(hero,0,0,hero.width/4,hero.height,w/2-hw/2,h*.6-hh*.9375,hw,hh);
 status.textContent=`${legacy?'ภาพเดิม':'หินใหม่ 9 ทรง'} · ${Math.round(x)}, ${Math.round(z)} · ${visible} ชิ้นในจอ · ตัวละครเทียบขนาด`;
}
let last=performance.now();function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;const dx=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft')),dz=Number(keys.has('s')||keys.has('ArrowDown'))-Number(keys.has('w')||keys.has('ArrowUp'));if(dx||dz){x+=dx*dt*14;z+=dz*dt*14;dirty=true;}if(dirty){draw();dirty=false;}requestAnimationFrame(frame);}requestAnimationFrame(frame);
