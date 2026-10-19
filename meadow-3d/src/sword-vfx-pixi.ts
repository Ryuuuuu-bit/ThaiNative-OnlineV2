import {Container,Sprite,Texture,WebGLRenderer} from 'pixi.js';
// Pixi's CSP compatibility implementation replaces generated Functions with safe sync code.
import 'pixi.js/unsafe-eval';
import {SwordVfxModel,type SwordEvent} from './sword-vfx-model';

type Project=(x:number,z:number,height?:number)=>{x:number;y:number};

function texture(width:number,height:number,paint:(ctx:CanvasRenderingContext2D)=>void){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 paint(canvas.getContext('2d')!);return Texture.from(canvas);
}
function bladeTexture(){return texture(256,160,c=>{
 const g=c.createLinearGradient(40,140,216,18);g.addColorStop(0,'#42bca000');g.addColorStop(.35,'#57bfa75a');g.addColorStop(.7,'#c9dbafc9');g.addColorStop(1,'#ffedb1');
 c.fillStyle=g;c.beginPath();c.moveTo(28,136);c.bezierCurveTo(244,142,252,37,154,12);c.bezierCurveTo(234,65,173,119,28,136);c.fill();
 c.strokeStyle='#fff3d3';c.lineWidth=2.6;c.beginPath();c.moveTo(38,136);c.bezierCurveTo(224,134,247,44,157,13);c.stroke();
 c.strokeStyle='#8ce5cb88';c.lineWidth=1.3;c.beginPath();c.moveTo(22,143);c.bezierCurveTo(227,151,267,39,159,7);c.stroke();
});}

/** Transparent GPU layer over the Canvas2D world. Input passes through to the game. */
export class SwordVfxPixi {
 readonly model=new SwordVfxModel();readonly stage=new Container();
 private renderer=new WebGLRenderer();private arcs:Sprite[]=[];private sparks:Sprite[]=[];
 private blade?:Texture;private streak?:Texture;private failed=false;private destroyed=false;private dirty=false;
 private reduced=matchMedia('(prefers-reduced-motion: reduce)');
 get canvas(){return this.renderer.canvas as HTMLCanvasElement;}
 async init(width:number,height:number,resolution:number){
  await this.renderer.init({width,height,resolution,backgroundAlpha:0,antialias:false,autoDensity:true,powerPreference:'low-power'});
  const canvas=this.canvas;canvas.setAttribute('aria-hidden','true');canvas.className='sword-vfx-layer';
  Object.assign(canvas.style,{position:'absolute',inset:'0',pointerEvents:'none',filter:'none'});
  canvas.addEventListener('webglcontextlost',()=>{this.failed=true;this.clear();});
  canvas.addEventListener('webglcontextrestored',()=>{this.failed=false;});
  this.blade=bladeTexture();
  this.streak=texture(48,12,c=>{const g=c.createLinearGradient(0,0,48,0);g.addColorStop(0,'#ffffff00');g.addColorStop(.65,'#ffffff77');g.addColorStop(1,'#ffffff');c.fillStyle=g;c.beginPath();c.moveTo(0,6);c.lineTo(42,2);c.lineTo(48,6);c.lineTo(42,10);c.closePath();c.fill();});
  // Upload both textures and compile the sprite batch before the first real strike.
  const warm=[this.blade,this.streak].map(texture=>{const sprite=new Sprite(texture);sprite.position.set(-1024,-1024);this.stage.addChild(sprite);return sprite;});
  this.renderer.render(this.stage);for(const sprite of warm){this.stage.removeChild(sprite);sprite.destroy();}
 }
 event(e:SwordEvent){if(this.failed||this.destroyed)return false;return this.model.event(e,this.reduced.matches);}
 resize(width:number,height:number,resolution:number){if(!this.destroyed)this.renderer.resize(width,height,resolution);}
 private sprite(pool:Sprite[],index:number,texture:Texture){
  let sprite=pool[index];if(!sprite){sprite=new Sprite({texture,anchor:.5});sprite.blendMode='add';pool.push(sprite);this.stage.addChild(sprite);}sprite.visible=true;return sprite;
 }
 render(dt:number,project:Project,scale:number){
  if(this.failed||this.destroyed)return;
  this.model.update(dt);
  const active=this.model.arcs.length+this.model.sparks.length;
  if(!active&&!this.dirty)return;
  for(const p of this.arcs)p.visible=false;for(const p of this.sparks)p.visible=false;
  this.model.arcs.forEach((a,i)=>{
   const t=a.age/a.life,q=project(a.x,a.z,.95),forward=project(a.x+a.dx,a.z+a.dz,.95),angle=Math.atan2(forward.y-q.y,forward.x-q.x);
   const sprite=this.sprite(this.arcs,i,this.blade!);sprite.position.set(q.x+Math.cos(angle)*scale*.55,q.y+Math.sin(angle)*scale*.55);
   sprite.rotation=angle+(this.reduced.matches?0:(t-.5)*.5*a.flip);sprite.width=scale*(a.strong?4.3:3.5)*(1+t*.18);sprite.height=scale*2.5;
   sprite.scale.y=Math.abs(sprite.scale.y)*a.flip;sprite.alpha=Math.sin(Math.PI*Math.min(1,t*1.7))*(1-t)*.95;
  });
  this.model.sparks.forEach((p,i)=>{
   const t=p.age/p.life,q=project(p.x+p.vx*p.age,p.z+p.vz*p.age,p.height+p.rise*p.age-4*p.age*p.age),before=project(p.x+p.vx*(p.age-.03),p.z+p.vz*(p.age-.03),p.height+p.rise*(p.age-.03)-4*(p.age-.03)**2);
   const sprite=this.sprite(this.sparks,i,this.streak!);sprite.position.set(q.x,q.y);sprite.rotation=Math.atan2(q.y-before.y,q.x-before.x);
   sprite.width=scale*(this.reduced.matches?.2:.52)*(1-t*.6);sprite.height=Math.max(1.5,scale*.09)*(1-t*.5);sprite.tint=p.gold?0xffdd91:0xafffe0;sprite.alpha=(1-t)**1.3;
  });
  this.renderer.render(this.stage);this.dirty=active>0;
 }
 clear(){this.model.clear();for(const p of [...this.arcs,...this.sparks])p.visible=false;this.dirty=true;}
 snapshot(){return{engine:this.failed?'canvas-fallback':'pixi-webgl',arcs:this.model.arcs.length,sparks:this.model.sparks.length,pooled:this.arcs.length+this.sparks.length};}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.stage.destroy({children:true});this.blade?.destroy(true);this.streak?.destroy(true);this.renderer.destroy({removeView:true});}
}
