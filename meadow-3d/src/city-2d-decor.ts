import {project} from './city-2d-sim';
import {polygon,line,slab,ellipse,house,roof,awning} from './city-2d-art';
import type {Decoration} from './city-2d-layout';
import type {Citizen} from './city-2d-life';
const cloth=['#548e91','#b77760','#8c7d9d','#79936a','#c39e62','#718aa4'];
export function drawDecoration(c:CanvasRenderingContext2D,p:Decoration){
 const v=p.variant||0,color=cloth[v%cloth.length];
 if(['guild','chapel','workshop','inn'].includes(p.kind)){
   house(c,p.w,p.d,p.kind==='guild'?3:p.kind==='inn'?1:2,p.kind);
   if(p.kind==='guild'){
     for(const x of [-2.7,2.7]){polygon(c,[[x-.55,p.d/2+.08,5.4],[x+.55,p.d/2+.08,5.4],[x+.55,p.d/2+.08,3],[x,p.d/2+.08,2.6],[x-.55,p.d/2+.08,3]],'#66668c');line(c,[x,p.d/2+.1,3.4],[x,p.d/2+.1,4.8],'#dac78f',.14);line(c,[x-.3,p.d/2+.1,4.2],[x+.3,p.d/2+.1,4.2],'#dac78f',.12);}
     slab(c,0,p.d/2+1,3,1.2,.4);slab(c,0,p.d/2+.7,2.5,.6,.6);
   }
   if(p.kind==='chapel'){slab(c,0,0,2,2,9.2,['#d3d0b1','#9dada0','#e6ddc0'],6);roof(c,2.1,2.1,9.2,['#79979b','#4f707b','#aec4c0']);line(c,[0,0,11.2],[0,0,12.5],'#d3bc78',.12);line(c,[-.35,0,12],[.35,0,12],'#d3bc78',.1);const pos=project(0,p.d/2+.05,4.3);c.beginPath();c.ellipse(pos.x,pos.y,.8,1.1,0,0,Math.PI*2);c.fillStyle='#70a9b0';c.fill();c.strokeStyle='#dbca8e';c.lineWidth=.12;c.stroke();}
   if(p.kind==='inn'){awning(c,p.w*.8,2.5,2.8,p.d/2+1);line(c,[p.w/2,p.d/2,3.7],[p.w/2+1.4,p.d/2,3.7],'#5b4a37',.1);polygon(c,[[p.w/2+.4,p.d/2,3.5],[p.w/2+1.4,p.d/2,3.5],[p.w/2+1.4,p.d/2,2.5],[p.w/2+.4,p.d/2,2.5]],'#725238');ellipse(c,p.w/2+.9,p.d/2,.22,.25,'#e6c482',3);}
   return;
 }
 if(p.kind==='gazebo'){slab(c,0,0,4.3,4.3,.3);for(const x of [-1.8,1.8])for(const z of [-1.8,1.8])line(c,[x,z,.3],[x,z,3.3],'#c2baa0',.2);roof(c,4.7,4.7,3.3,['#73967e','#456854','#a1bda0']);return;}
 if(p.kind==='bench'){slab(c,0,0,p.w,p.d,.6,['#897b55','#596449','#b5a978']);slab(c,0,-p.d/2,p.w,.15,1.2,['#897b55','#596449','#b5a978'],.6);return;}
 if(p.kind==='stall'){awning(c,p.w,p.d,2.5);polygon(c,[[-p.w/2,-p.d/2,3.1],[p.w/2,-p.d/2,3.1],[p.w/2,p.d/2,2.5],[-p.w/2,p.d/2,2.5]],color);for(let x=-p.w/2;x<p.w/2;x+=.7)polygon(c,[[x,-p.d/2,3.1],[x+.25,-p.d/2,3.1],[x+.25,p.d/2,2.5],[x,p.d/2,2.5]],'#e5d5ac','');for(let x=-1.1;x<1.2;x+=.3)ellipse(c,x,.5,.16,.11,['#c59547','#aa5750','#8d9e51'][v%3],1.1);return;}
 if(p.kind==='lamp'){slab(c,0,0,.6,.6,.3);line(c,[0,0,.25],[0,0,3.5],'#45584b',.12);line(c,[0,0,3.5],[.6,0,3.5],'#45584b',.1);slab(c,.6,0,.48,.48,3.4,['#d8ba73','#af8d4a','#e0d1a6'],2.7);roof(c,.65,.65,3.4,['#5c6751','#405544','#a5a57e']);return;}
 if(p.kind==='banner'){line(c,[0,0,0],[0,0,4.8],'#776d4a',.11);ellipse(c,0,0,.12,.12,'#d5bd79',4.9);line(c,[-.65,0,4.55],[.65,0,4.55],'#a79a6a',.09);polygon(c,[[-.55,0,4.5],[.55,0,4.5],[.55,0,2.6],[0,0,2.15],[-.55,0,2.6]],color);polygon(c,[[0,-.01,3.9],[.25,-.01,3.5],[0,-.01,3.1],[-.25,-.01,3.5]],'#e2c780');return;}
 if(p.kind==='flowerbed'){slab(c,0,0,p.w,p.d,.4,['#a5a38a','#7f8a6a','#c6c2a4']);slab(c,0,0,p.w-.2,p.d-.2,.42,['#4e6241','#4e6241','#567247']);for(let i=0;i<24;i++){const x=Math.sin(i*16.7)*p.w*.42,z=Math.cos(i*9.1)*p.d*.4;line(c,[x,z,.4],[x,z,.9],'#658349',.025);ellipse(c,x,z,.09,.06,['#d5b0ba','#b9b0d2','#e5cf81','#dfd8bc'][v%4],.7+(i%3)*.1);}return;}
 if(p.kind==='table'){ellipse(c,0,0,.9,.48,'#6c5b3f',.85);ellipse(c,0,0,.88,.47,'#ba9c69',.94);line(c,[0,0,0],[0,0,.9],'#61563c',.2);for(const x of [-1.2,1.2])slab(c,x,0,.55,.65,.5,['#807655','#5e6448','#b3a374']);ellipse(c,-.25,0,.19,.1,'#e4d7ae',1);slab(c,.3,0,.15,.15,1.2,['#9c6949','#744a35','#d5b77c'],.95);return;}
 if(p.kind==='notice'){for(const x of [-.85,.85])line(c,[x,0,0],[x,0,2.5],'#6b6042',.12);polygon(c,[[-1,0,2.5],[1,0,2.5],[1,0,1],[-1,0,1]],'#7c6849');for(const [x,z,h] of [[-.65,0,2.2],[.15,0,2.25],[-.4,0,1.6]] as [number,number,number][])polygon(c,[[x,z,h],[x+.45,z,h],[x+.45,z,h-.55],[x,z,h-.55]],'#dfcea3');roof(c,2.3,.7,2.5,['#71846b','#405d49','#a5b196']);return;}
 if(p.kind==='wagon'){slab(c,0,0,3,1.8,.9,['#a38a5d','#716542','#bcaa79']);for(const x of [-1,1])for(const z of [-1,1]){const q=project(x,z,.45);c.beginPath();c.arc(q.x,q.y,.5,0,Math.PI*2);c.fillStyle='#4f533a';c.fill();c.strokeStyle='#b7a172';c.lineWidth=.09;c.stroke();}for(let i=0;i<3;i++)slab(c,(i-1)*.9,0,.8,1.2,1.6,['#9d9166','#72734f','#c2b688'],.9);if(!v)awning(c,3,2,2.2);return;}
 if(p.kind==='dummy'){line(c,[0,0,0],[0,0,2.4],'#6c6043',.15);line(c,[-.7,0,1.5],[.7,0,1.5],'#8b7850',.18);ellipse(c,0,0,.3,.34,'#c9b57d',2.2);slab(c,0,0,.7,.4,1.9,['#9b8460','#726c4d','#baab7d'],.9);return;}
 if(p.kind==='anvil'){slab(c,0,0,.8,.8,.6);slab(c,0,0,1.4,.6,1.1,['#59665d','#3d4d48','#95a196'],.6);return;}
 if(p.kind==='barrels'){for(const [x,z] of [[-.35,0],[.35,.3]]){slab(c,x,z,.65,.65,1,['#a18a58','#6c6b43','#bcaa74']);for(const h of [.2,.8])line(c,[x-.3,z+.34,h],[x+.3,z+.34,h],'#535d4b',.09);}return;}
 if(p.kind==='gate'){for(const x of [-4,4]){slab(c,x,0,1.8,2,5.6);roof(c,2.3,2.4,5.6,['#5d8170','#3b5b4c','#a1b49a']);}slab(c,0,0,7,1,5.2,['#b9b79b','#809078','#d4ccad'],4.4);}
}

// Articulated canvas townsfolk: feet alternate while walking; idle actors stop their gait.
export function drawCitizen(c:CanvasRenderingContext2D,n:Citizen,screen:{x:number;y:number},scale:number){
 c.save();c.translate(screen.x,screen.y);c.scale(scale,scale);
 const dir=project(n.fx,n.fz),facing=dir.x<0?-1:1,back=dir.y<0;
 const stride=n.moving?Math.sin(n.phase*9)*.2:0,bob=n.moving?Math.abs(Math.sin(n.phase*9))*.035:Math.sin(n.phase*1.5)*.01;
 c.fillStyle='#223b333b';c.beginPath();c.ellipse(0,0,.34,.13,0,0,Math.PI*2);c.fill();c.translate(0,-bob);c.scale(facing,1);
 const coat=n.role==='guard'?'#73847c':cloth[n.palette%cloth.length];
 const segment=(x:number,y:number,x2:number,y2:number,color:string,width:number)=>{c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();};
 segment(-.12,-.6,-.12+stride,-.12,'#564d3b',.16);segment(.14,-.6,.14-stride,-.1,'#746344',.17);segment(-.12+stride,-.1,-.02+stride,-.06,'#3f4435',.18);segment(.14-stride,-.08,.26-stride,-.04,'#414635',.18);
 const fabric=c.createLinearGradient(-.25,0,.3,0);fabric.addColorStop(0,'#4a5c4b');fabric.addColorStop(.3,coat);fabric.addColorStop(1,coat);c.fillStyle=fabric;c.beginPath();c.moveTo(-.25,-1.35);c.quadraticCurveTo(0,-1.5,.25,-1.3);c.lineTo(.29,-.55);c.lineTo(-.27,-.55);c.closePath();c.fill();segment(-.25,-1.22,-.32-stride*.6,-.7,'#c1a37b',.12);segment(.25,-1.23,.31+stride*.6,-.72,'#d8b88e',.13);segment(-.08,-1.25,.08,-.75,'#d4c196',.035);
 segment(-.25,-.7,.26,-.7,'#a99667',.09);c.fillStyle='#d3b28a';c.beginPath();c.ellipse(0,-1.55,.2,.24,0,0,Math.PI*2);c.fill();
 c.fillStyle=['#514636','#8e7050','#5d4d3c'][n.id%3];c.beginPath();c.ellipse(-.03,-1.7,.21,.13,0,Math.PI,Math.PI*2);c.fill();if(back){c.fillRect(-.18,-1.72,.33,.28);}else{c.fillStyle='#3e4436';c.fillRect(.1,-1.59,.035,.04);}
 if(n.role==='guard'){c.fillStyle='#aab5a4';c.beginPath();c.ellipse(0,-1.68,.24,.16,0,Math.PI,Math.PI*2);c.fill();segment(.42,-.1,.42,-2.1,'#847751',.045);segment(.42,-2.1,.42,-2.3,'#c8cebb',.1);}
 if(n.role==='gardener'||n.role==='buyer'){c.fillStyle='#c0a875';c.beginPath();c.ellipse(0,-1.75,.35,.08,0,0,Math.PI*2);c.fill();c.fillRect(-.19,-1.9,.38,.16);}
 if(n.role==='scholar'){c.fillStyle='#b9ae7e';c.fillRect(.25,-.99,.18,.27);}
 if(n.role==='traveler'){c.fillStyle='#8b7655';c.fillRect(-.33,-1.28,.2,.47);}
 if(n.role==='artisan'&&!n.moving){const lift=Math.sin(n.phase*4)*.15;segment(.25,-.9,.48,-1.12-lift,'#d8b88e',.1);segment(.48,-1.05-lift,.5,-1.4-lift,'#7b6e49',.06);segment(.38,-1.4-lift,.65,-1.4-lift,'#829184',.14);}
 if(n.role==='gardener'&&!n.moving){c.fillStyle='#79918b';c.fillRect(.3,-.8,.3,.23);segment(.55,-.7,.75,-.8,'#79918b',.08);for(let i=0;i<3;i++)segment(.75+i*.04,-.72+i*.08,.78+i*.04,-.68+i*.08,'#b0d4cc',.02);}
 c.restore();
}
