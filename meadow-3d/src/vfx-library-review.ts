/** Read-only showcase of the production SkillVfx2D, without simulation/account changes. */
import{SkillVfx2D,PALS}from'./skill-vfx-2d';
import{project2D}from'./game-2d-projection';
import{SHIELD_BASH_ART}from'./shield-bash-art';
const shieldURL=SHIELD_BASH_ART.url;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const entries=[
 ['basic','ฟันปกติ','พื้นฐาน','steel','คมดาบสีเงิน พร้อมประกายปะทะและคริติคอล'],
 ['slash','ฟันเฉือน','นักดาบ','cream','คมฟันโค้งสีครีม–ทอง พร้อมแสงปะทะ'],
 ['whirlwind','ฟันพายุ','นักดาบ','jade','วงคมดาบหมุนสีหยก ล้อมรอบจุดร่าย'],
 ['dash_strike','พุ่งทะยาน','นักดาบ','jade','แนวพุ่งสีหยกและประกายที่ปลายทาง'],
 ['earth_break','ตอกพสุธา','นักดาบ','gold','พลังทองกระแทกพื้น พร้อมรอยแตกและเศษหิน'],
 ['provoke','คำรามท้าศึก','นักดาบ','sand','คลื่นคำรามโทนทราย กระจายออกจากจุดร่าย'],
 ['endure','ใจเหล็ก','นักดาบ','gold','ออร่าป้องกันสีทอง ล้อมรอบผู้ใช้'],
 ['shield_bash','กระแทกโล่','ผู้พิทักษ์','emerald','โล่พุ่งและแสงปะทะสีมรกต'],
 ['bulwark','ป้อมปราการ','ผู้พิทักษ์','emerald','พลังป้องกันและม่านโล่สีเขียว'],
 ['quake_slam','ทุบแผ่นดินไหว','ผู้พิทักษ์','amber','ชาร์จพลังอำพัน ก่อนระเบิดพื้นและเศษหิน'],
 ['rally_roar','คำรามรวมพล','ผู้พิทักษ์','storm','คลื่นพลังสีฟ้า กระจายเป็นวงรอบผู้ใช้'],
 ['frenzy_slash','ฟันคลั่ง','เบอร์เซิร์กเกอร์','crimson','คมฟันต่อเนื่องพร้อมแสงปะทะสีแดง'],
 ['blood_rage','โลหิตเดือด','เบอร์เซิร์กเกอร์','crimson','ออร่าพลังคลั่งสีแดง ลอยรอบจุดร่าย'],
 ['blade_cyclone','พายุใบมีด','เบอร์เซิร์กเกอร์','crimson','พายุคมดาบสีแดง พร้อมประกายหลายจังหวะ'],
 ['leap_strike','กระโจนฟัน','เบอร์เซิร์กเกอร์','crimson','รอยพุ่งกลางอากาศและแรงกระแทกตอนลงพื้น']
];
const canvas=$<HTMLCanvasElement>('#view'),ctx=canvas.getContext('2d')!,fx=new SkillVfx2D();
const shieldImage=new Image();shieldImage.src=shieldURL;await shieldImage.decode();
$<HTMLAnchorElement>('#shield-art-link').href=shieldURL;
function syncShield(){fx.setShieldArt($<HTMLInputElement>('#shield-new').checked?shieldImage:null,SHIELD_BASH_ART.rect);}
const requestedEffect=new URLSearchParams(location.search).get('effect');
let selected=entries.some(e=>e[0]===requestedEffect)?requestedEffect!:'shield_bash',running=true,time=0,last=performance.now(),width=1,height=1,dpr=1,queue:{at:number;e:any}[]=[],fired=0;
function face(){const vectors:Record<string,[number,number]>={SE:[1,-1],SW:[-1,-1],NE:[1,1],NW:[-1,1],S:[0,-1],E:[1,0],N:[0,1],W:[-1,0]},[h,u]=vectors[$<HTMLSelectElement>('#direction').value],x=13*h-9*u,z=-9*h-13*u,n=Math.hypot(x,z);return{dx:x/n,dz:z/n}}
function events(){const{dx,dz}=face(),playerId='preview',base={x:0,z:0,dx,dz,playerId,id:7},hit={...base,type:'hit',x:dx*1.8,z:dz*1.8,skillId:selected,crit:$<HTMLInputElement>('#crit').checked};const q:{at:number;e:any}[]=[];const add=(at:number,e:any)=>q.push({at,e});
 if(selected==='basic'){add(0,{...base,type:'slash',combo:1});add(.15,{...hit,skillId:'basic'})}
 else {add(0,{...base,type:'skill',skillId:selected});
  if(selected==='dash_strike'||selected==='leap_strike'){const dur=selected==='leap_strike'?.4:.22;add(0,{...base,type:'dashTrail',skillId:selected,fromX:0,fromZ:0,toX:dx*3,toZ:dz*3,duration:dur});if(selected==='leap_strike')add(.4,{...base,type:'skillImpact',skillId:selected,x:dx*3,z:dz*3});add(dur,{...hit,x:dx*3,z:dz*3})}
  else if(selected==='earth_break'||selected==='quake_slam'){const at=selected==='earth_break'?.4:.5;add(at,{...base,type:'skillImpact',skillId:selected});add(at,{...hit})}
  else if(selected==='frenzy_slash'||selected==='blade_cyclone'){for(let i=0;i<(selected==='frenzy_slash'?3:4);i++)add(.1+i*.13,{...hit,hitIndex:i+1})}
  else if(selected==='whirlwind'){add(.15,hit);add(.4,{...hit,hitIndex:2})}
  else if(selected==='slash'||selected==='shield_bash')add(.18,hit);
 }return q.sort((a,b)=>a.at-b.at)
}
function replay(){fx.clear();fx.time=0;time=0;fired=0;queue=events();running=true;$('#play').textContent='หยุดภาพ'}
function choose(id:string){selected=id;const entry=entries.find(e=>e[0]===id)!;$('#category').textContent=entry[2];$('#title').textContent=entry[1]+' · '+id;$('#description').textContent=entry[4];$('#shield-choice').hidden=id!=='shield_bash'&&id!=='bulwark';syncShield();const pal=PALS[entry[3]];$('#palette').replaceChildren();for(const color of [pal.edge,pal.hi,pal.mid,pal.low,pal.deep].filter(Boolean)){const chip=document.createElement('span');chip.style.background=color!;$('#palette').append(chip)}for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-effect]'))b.setAttribute('aria-pressed',String(b.dataset.effect===id));replay()}
let group='';for(const[id,name,g,pal,desc]of entries){if(g!==group){const title=document.createElement('div');title.className='group';title.textContent=g;$('#catalog').append(title);group=g}const b=document.createElement('button'),title=document.createElement('span'),sub=document.createElement('small'),dot=document.createElement('i');b.className='effect';b.dataset.effect=id;title.textContent=name;sub.textContent=id;dot.style.color=dot.style.background=PALS[pal].mid;b.title=desc;b.append(title,sub,dot);b.onclick=()=>choose(id);$('#catalog').append(b)}
$('#play').onclick=()=>{running=!running;$('#play').textContent=running?'หยุดภาพ':'เล่นต่อ'};$('#restart').onclick=replay;$('#direction').onchange=replay;$('#crit').onchange=replay;
$('#shield-new').onchange=()=>{syncShield();replay()};
$('#seek').oninput=()=>{time=Number($<HTMLInputElement>('#seek').value)/1000;fx.clear();fired=0;queue=events();for(const q of queue){if(q.at>time)break;fx.time=q.at;fx.event(q.e,'preview');fired++}fx.time=time;running=false;$('#play').textContent='เล่นต่อ'};
function resize(){const r=canvas.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr)}window.addEventListener('resize',resize);resize();choose(selected);
function tick(now:number){const dt=Math.min(.05,(now-last)/1000)*Number($<HTMLSelectElement>('#speed').value);last=now;if(running){time+=dt;if(time>3.2){if($<HTMLInputElement>('#repeat').checked)replay();else{time=3.2;running=false;$('#play').textContent='เล่นต่อ'}}}while(fired<queue.length&&queue[fired].at<=time){const q=queue[fired++];fx.time=q.at;fx.event(q.e,'preview')}fx.time=time;
 const S=Math.min(width/12,65),P=(x:number,z:number,h=0)=>{const p=project2D(x,z,h);return{x:width*.5+p.x*S,y:height*.66+p.y*S}};ctx.setTransform(dpr,0,0,dpr,0,0);const bg=$<HTMLSelectElement>('#background').value;ctx.fillStyle=bg==='light'?'#a0a999':bg==='grass'?'#3a5840':'#152621';ctx.fillRect(0,0,width,height);ctx.strokeStyle=bg==='light'?'#31483a28':'#93b59b16';ctx.lineWidth=1;for(let i=-12;i<=12;i++){for(const[a,b]of [[P(i,-12),P(i,12)],[P(-12,i),P(12,i)]]){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}}const p=P(0,0);ctx.strokeStyle='#b4c5aa44';ctx.beginPath();ctx.ellipse(p.x,p.y,S*.6,S*.3,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#bdc9b6';ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();const frame={ctx,width,height,dpr,scale:S,screen:P,locate:()=>({x:0,z:0}),highQuality:true};fx.pre(frame,0);fx.post(frame);$<HTMLInputElement>('#seek').value=String(time*1000);$('#clock').textContent=time.toFixed(2)+' s';$('#status').textContent=`เอฟเฟกต์จากตัวเกม · ${selected} · ${fx.snapshot().effects} เอฟเฟกต์กำลังแสดง`;canvas.dataset.effect=selected;canvas.dataset.time=time.toFixed(2);canvas.dataset.kinds=fx.snapshot().kinds.join(',');requestAnimationFrame(tick)
}requestAnimationFrame(tick);
