import {CanvasAssets} from './game-2d-assets';
import {atlasCell,type Direction} from './sprite-animation';
import type {PartyMember,PartyState} from './party-ui';
type Art={assets:CanvasAssets;hero:HTMLImageElement;props:any[];ground:HTMLImageElement};
let sharedArt:Promise<Art>|undefined;
function art(){return sharedArt??=(async()=>{const manifest=await(await fetch('/texture-manifest.json')).json(),assets=new CanvasAssets(manifest);const props=await assets.json<any>('/assets/env-painted/manifest.json');const [hero,ground]=await Promise.all([assets.image('/assets/hero-painted/hero-idle-v1.png'),assets.image('/assets/city-painted-v1/ground-grass-v1.png'),...props.atlases.map((a:any)=>assets.image('/assets/env-painted/'+a.file))]);return{assets,hero,props:props.assets,ground};})().catch(error=>{sharedArt=undefined;throw error;});}
function hero(c:CanvasRenderingContext2D,image:HTMLImageElement,x:number,y:number,size:number,direction:Direction,muted=false){
 const cell=atlasCell('idle',direction,0),w=size*1.5,h=size;c.save();c.globalAlpha=muted?.4:1;c.drawImage(image,cell.column*image.width/cell.columns,0,image.width/cell.columns,image.height,x-w/2,y-h*.9375,w,h);c.restore();
}
export function paintPartyPortrait(canvas:HTMLCanvasElement,member:PartyMember){
 canvas.width=240;canvas.height=154;canvas.ariaLabel='ตัวละคร '+member.name;canvas.setAttribute('role','img');
 void art().then(a=>{const c=canvas.getContext('2d')!;c.clearRect(0,0,240,154);hero(c,a.hero,120,148,178,'SE');}).catch(()=>{canvas.hidden=true;});
}
/** Head-and-shoulders crop of the shared hero atlas for the HUD party strip. */
export function paintPartyAvatar(canvas:HTMLCanvasElement){
 canvas.width=64;canvas.height=64;
 void art().then(a=>{const c=canvas.getContext('2d')!;c.clearRect(0,0,64,64);hero(c,a.hero,32,111,150,'SE');}).catch(()=>{canvas.hidden=true;});
}
/** Local illustrative camp assembled from the same painted props and hero atlas as gameplay. */
export function mountPartyCamp(host:HTMLElement,isOpen:()=>boolean,you:()=>string,onInvite:()=>void){
 const canvas=document.createElement('canvas');canvas.width=1100;canvas.height=350;canvas.ariaLabel='ค่ายพักและตัวละครสมาชิกปาร์ตี้';canvas.setAttribute('role','img');host.append(canvas);
 const labels=document.createElement('div');labels.className='camp-nameplates';host.append(labels);
 let assets:Art|undefined,state:PartyState|null=null,last=-1,active=false,labelKey='';
 const spots=[[.22,.76],[.37,.61],[.64,.61],[.8,.76],[.37,.91],[.65,.91]];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function prop(name:string,x:number,y:number,h:number){if(!assets)return;const a=assets.props.find(a=>a.name===name);if(!a)return;const image=assets.assets.get('/assets/env-painted/'+a.atlas)!;const w=h*a.rect[2]/a.rect[3];const c=canvas.getContext('2d')!;c.drawImage(image,...a.rect as [number,number,number,number],x-w*a.anchor[0],y-h*a.anchor[1],w,h);}
 function render(time=0){
  if(!assets)return;const c=canvas.getContext('2d')!,w=1100,h=350;c.clearRect(0,0,w,h);
  c.save();const pattern=c.createPattern(assets.ground,'repeat')!;c.fillStyle=pattern;c.fillRect(0,0,w,h);c.fillStyle='#071c20ae';c.fillRect(0,0,w,h);
  const clearing=c.createRadialGradient(550,250,10,550,250,490);clearing.addColorStop(0,'#b3965c88');clearing.addColorStop(.7,'#6b705541');clearing.addColorStop(1,'#253f3a00');c.fillStyle=clearing;c.fillRect(0,0,w,h);
  prop('tree-round',90,190,305);prop('tree-tall',1025,200,330);prop('tent',265,155,160);prop('tent',845,160,152);prop('fallen-log',575,155,60);prop('fern-wide',80,310,70);prop('bush-round',1010,300,85);prop('stump',935,230,55);
  const glow=c.createRadialGradient(550,266,0,550,266,200);glow.addColorStop(0,'#ecab4645');glow.addColorStop(1,'#ecab4600');c.fillStyle=glow;c.fillRect(340,80,420,270);
  const members=state?.members??[];
  spots.forEach(([x,y],i)=>{c.beginPath();c.ellipse(x*w,y*h,40,12,0,0,Math.PI*2);c.fillStyle=members[i]?'#07191485':'#93b8a00b';c.fill();c.strokeStyle=members[i]?.id===state?.leader?'#d3b46d9c':'#799d8240';c.lineWidth=1;c.setLineDash(members[i]?[]:[3,5]);c.stroke();c.setLineDash([]);});
  members.forEach((m,i)=>{const [x,y]=spots[i]??spots[0];hero(c,assets!.hero,x*w,y*h-3,172,i%2?'SW':'SE',!m.online||m.dead);});
  prop('campfire',550,287,104);
  // A restrained flame above the actual painted logs; no new bitmap assets.
  const flicker=reduced.matches?0:Math.sin(time*.007)*3;c.save();c.translate(550,259);c.fillStyle='#dc8734d9';c.beginPath();c.moveTo(-15,0);c.bezierCurveTo(-25,-22,-2,-23,-5,-53-flicker);c.bezierCurveTo(13,-40,10,-28,18,-20);c.bezierCurveTo(28,-5,10,8,-15,0);c.fill();c.fillStyle='#f7d484e6';c.beginPath();c.moveTo(-7,0);c.quadraticCurveTo(-10,-17,3,-32-flicker);c.quadraticCurveTo(2,-16,10,-10);c.quadraticCurveTo(15,3,-7,0);c.fill();c.restore();
  if(!reduced.matches)for(let i=0;i<8;i++){const phase=(time*.00018+i*.127)%1;c.globalAlpha=Math.sin(phase*Math.PI)*.7;c.fillStyle='#e4c385';c.beginPath();c.arc(550+Math.sin(i*8+phase*4)*19,254-phase*70,1.1,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  const shade=c.createLinearGradient(0,0,0,h);shade.addColorStop(0,'#071a2366');shade.addColorStop(.4,'#071a2300');shade.addColorStop(1,'#07191e99');c.fillStyle=shade;c.fillRect(0,0,w,h);c.restore();
 }
 function animate(t:number){if(!isOpen()||document.hidden||reduced.matches){active=false;return;}if(t-last>85){render(t);last=t;}requestAnimationFrame(animate);}
 function start(){if(!active&&!reduced.matches&&isOpen()){active=true;requestAnimationFrame(animate);}}
 function update(next:PartyState|null){state=next;const key=JSON.stringify([state?.leader,state?.members.map(m=>[m.id,m.name,m.online])]);if(key===labelKey){render();start();return;}labelKey=key;labels.replaceChildren();for(let i=0;i<6;i++){const member=state?.members[i],[x,y]=spots[i];const label=document.createElement(member?'span':'button');label.className=member?'camp-name':'camp-vacancy';label.style.left=x*100+'%';label.style.top=(y*100-37)+'%';if(member){label.textContent=(member.id===state?.leader?'♛ ':'')+member.name;label.classList.toggle('is-you',member.id===you());label.classList.toggle('is-offline',!member.online);}else{label.textContent='＋';label.ariaLabel='เชิญสมาชิกเข้าช่องที่ '+(i+1);(label as HTMLButtonElement).onclick=onInvite;label.style.top=(y*100-15)+'%';}labels.append(label);}render();start();}
 void art().then(a=>{assets=a;host.classList.add('is-ready');render();start();}).catch(()=>host.classList.add('camp-unavailable'));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)start();});
 return{update,refresh:()=>{render();start();}};
}
