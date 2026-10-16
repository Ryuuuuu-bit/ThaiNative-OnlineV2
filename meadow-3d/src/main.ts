import {CONTACT_FRAME,isSkillMotion} from './skill-motions';
import {CombatFeel,AutoQuality} from './combat-feel';
import {mountInventory} from './inventory-ui';
import {loadGameData,rarityColors} from '@thainative/shared';
import { CITY_BUILDINGS, HEALER, GATES, type MapId } from '@thainative/shared/maps';
import { playEventAudio } from './audio-events';
import { mountAudioSettings } from './audio-settings-ui';
import{mountSkills}from'./skills-ui';import{mountSkillArt}from'./skill-art';
import{loadSelected}from'./web/game-session';
import{PaintedLoader,assetJSON}from'./assets';import type{TextureManifest}from'./assets';
import{GameSocket}from'./net/socket';import{NetworkWorld}from'./net/world';
import{KEYS,isKey}from'./keys';
import * as T from 'three';import './style.css';
import{walkable,CD,CAMP,ARENA}from'./sim';import type{Action,Event}from'./sim';
import{mat}from'./actors';import{makePaintedMonster,makePaintedDroplet,warmKing,kingReady}from'./painted-monster';import{makePaintedHero}from'./painted-hero';import{buildScene,label}from'./scene';import{AudioEngine}from'./audio';
const $=<E extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<E>(s)!;const $$=(s:string)=>[...document.querySelectorAll<HTMLElement>(s)];
window.tnBoot.stage(0);
const [selected,textureManifest]=await Promise.all([loadSelected(),assetJSON<TextureManifest>('/texture-manifest.json?v='+import.meta.env.VITE_BUILD_ID)]);window.tnBoot.stage(2);
let statsController:any=null,lastStats:any=null;const statsUI={get open(){return !!statsController?.open;},async toggle(){if(!statsController){const{mountStats}=await import('./stats-window');statsController=mountStats(message=>net.send(message),()=>clearInput());if(lastStats)statsController.receive(lastStats);}if(!statsController.open)sound.play('ui_open');statsController.toggle();},receive(e:any){if(e.type==='stats'){lastStats=e;$('#stats-button').classList.toggle('has-points',e.points>=2);}statsController?.receive(e);}};$('#stats-button').onclick=()=>void statsUI.toggle();
const skillsUI=mountSkills(message=>net.send(message),()=>{clearInput();net.send({t:'auto',on:false});},id=>doAction(id),id=>sound.play(id));$('#skills-button').onclick=()=>skillsUI.toggle();
const inventoryUI=mountInventory(message=>net.send(message),()=>{clearInput();net.send({t:'auto',on:false});});
const itemData=loadGameData();
const worldState=new NetworkWorld(),game=worldState.game,sound=new AudioEngine(selected.character.id),keys=new Set<string>();let started=false,paused=false,wonShown=false,quality=true,time=0,previous=performance.now(),accumulator=0,shake=0,zoomHeight=19.5,deathReveal=0;
sound.restore(selected.character.audioSettings);
const combatFeel=new CombatFeel(),autoQuality=new AutoQuality();
const audioUI=mountAudioSettings(sound,message=>net.send(message));
const feelLabel=document.createElement('label');feelLabel.innerHTML='<input type="checkbox" id="combat-feel">ภาพสั่น/หยุดภาพ';document.querySelector('#audio-settings')!.append(feelLabel);const feelInput=feelLabel.querySelector('input')!;feelInput.checked=combatFeel.enabled;feelInput.onchange=()=>combatFeel.setEnabled(feelInput.checked);
document.addEventListener('click',e=>{if(e.target instanceof Element&&e.target.closest('button:not(:disabled)'))sound.play('ui_click');},true);
let sceneReady=false,netOverlay=false;const net=new GameSocket({message(message){
 audioUI.receive(message);inventoryUI.receive(message);
 if(message.t==='ev')for(const e of message.list)if(e.playerId===net.you)audioUI.receive(e);
 if(message.t==='snap'){worldState.receive(message,net.you,performance.now());if(message.mapId!==activeMap)void switchMap(message.mapId);}
 if(message.t==='welcome')window.tnBoot.stage(3);
 if(message.t==='ev'){for(const e of message.list)if(e.playerId===net.you&&['stats','statsError'].includes(e.type))statsUI.receive(e);for(const e of message.list)if(e.playerId===net.you)skillsUI.receive(e);game.events.push(...message.list.filter((e:any)=>!['death','level','notice','victory'].includes(e.type)||e.playerId===net.you||e.type==='victory'));events();}
},status(state){
 let banner=document.querySelector<HTMLElement>('#network-status');if(!banner){banner=document.createElement('div');banner.id='network-status';banner.role='status';document.querySelector('#ui')!.append(banner);}
 banner.hidden=state==='connected';banner.textContent=state==='connecting'?'กำลังเชื่อมต่อ…':state==='reconnecting'?'การเชื่อมต่อขาด กำลังต่อใหม่':'';
 if(state==='offline'||state==='opened elsewhere'||state==='kicked'){if(window.tnBoot.progress<100)window.tnBoot.fail('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่','socket');netOverlay=true;overlay(`<h1>${state==='opened elsewhere'?'เปิดตัวละครในหน้าต่างอื่น':state==='kicked'?'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่':'เซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง'}</h1><button id="net-retry" class="primary">ลองใหม่อีกครั้ง</button>`);$('#net-retry').onclick=()=>{if(state==='kicked')location.assign('/login.html');else net.retry();};}
 if(state==='connected'&&netOverlay){netOverlay=false;paused=false;$('#overlay').hidden=true;}
}});
document.querySelector('#player-name')!.textContent=selected.character.name;
if(game.bossSpawned){document.querySelector('#quest-name')!.textContent='ผู้พิทักษ์แห่งทุ่งหญ้า';document.querySelector('#quest-note')!.textContent='หลบวงสีแดง แล้วโจมตีในช่วงพักของบอส';}
const renderer=(()=>{try{return new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});}catch(e){window.tnBoot.fail('เปิดภาพสามมิติไม่สำเร็จ กรุณาลองใหม่หรือใช้เบราว์เซอร์ที่รองรับ WebGL','webgl');throw e;}})();renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.outputColorSpace=T.SRGBColorSpace;$('#world').appendChild(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#c8d1bd');scene.fog=new T.Fog('#c8d1bd',30,72);scene.add(new T.HemisphereLight('#fff0db','#888775',1.6));const sun=new T.DirectionalLight('#ffefd5',1.8);sun.position.set(-14,24,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-27;sun.shadow.camera.right=27;sun.shadow.camera.top=27;sun.shadow.camera.bottom=-27;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.normalBias=.025;sun.shadow.bias=-.00008;sun.shadow.radius=4;scene.add(sun);
const camera=new T.OrthographicCamera(-17,17,9.75,-9.75,.1,120),cameraOffset=new T.Vector3(9,16,13),focus=new T.Vector3(-1,0,4.5);camera.position.copy(focus).add(cameraOffset);camera.lookAt(focus);
let assetFailure=false;
const loading=new T.LoadingManager();loading.onProgress=(_url,loaded,total)=>{window.tnBoot.stage(1,Math.min(.99,loaded/total));};loading.onLoad=()=>{if(assetFailure||sceneReady)return;sceneReady=true;window.tnBoot.stage(1);net.ready();const state=$('#load-state');if(state)state.textContent='พร้อมแล้ว · เดินด้วย WASD หรือคลิกที่พื้น';};loading.onError=()=>{assetFailure=true;window.tnBoot.fail('โหลดภาพวาดไม่สำเร็จ กรุณาลองใหม่','texture');};const loader=new PaintedLoader(loading,renderer,textureManifest);let activeMap:MapId=selected.character.mapId||'city_plaza';
const scenes=new Map<MapId,any>();
async function buildMap(id:MapId){const built=id==='city_plaza'?(await import('./city-scene')).buildCity(scene,loader):buildScene(scene,loader);scenes.set(id,built);return built;}
let world=await buildMap(activeMap);sound.setMap(activeMap);
const hero=makePaintedHero(loader);scene.add(hero.root);
const previewMonster=makePaintedMonster(loader);previewMonster.dispose();
loader.load('/assets/hero-painted/portrait-v1.png',texture=>{const c=document.createElement('canvas'),im=texture.image as HTMLImageElement;c.width=im.width;c.height=im.height;c.getContext('2d')!.drawImage(im,0,0);document.documentElement.style.setProperty('--portrait',`url(${c.toDataURL()})`);});loader.load('/assets/skills-painted/skills-v1.png',texture=>{const c=document.createElement('canvas'),im=texture.image as HTMLImageElement;c.width=im.width;c.height=im.height;c.getContext('2d')!.drawImage(im,0,0);document.documentElement.style.setProperty('--skill-atlas',`url(${c.toDataURL()})`);});
const heroName=label(selected.character.name,'#f4f5da');heroName.position.y=3.7;scene.add(heroName);
const right=new T.Vector3(13,0,-9).normalize(),up=new T.Vector3(-9,0,-13).normalize(),ray=new T.Raycaster(),pointer=new T.Vector2(),floor=new T.Plane(new T.Vector3(0,1,0),0),point=new T.Vector3();
const skillArt=mountSkillArt(scene,loader,hero.root);
const areaName=(id:MapId)=>id==='city_plaza'?'นครที่ถูกลืมเลือน · ลานกลางเมือง':'ทุ่งวุ้นจิ๋ว';
$('.location').hidden=true;
const area=document.createElement('div');area.id='area-name';area.textContent=areaName(activeMap);$('#ui').append(area);
const fade=document.createElement('div');fade.id='map-loading';fade.className='overlay center';fade.hidden=true;fade.textContent='กำลังเดินทาง…';document.body.append(fade);
let switching=false,lastGate=0,closedGate='',overviewOn=false;
async function switchMap(id:MapId){
 if(switching)return;switching=true;fade.hidden=false;clearInput();
 try{
  const next=scenes.get(id)||await buildMap(id);await loader.whenReady();world.root.visible=false;world=next;world.root.visible=true;activeMap=id;
  world.setQuality(quality);sound.setMap(id);$('#quest-name').textContent=id==='city_plaza'?'นครที่ถูกลืมเลือน':'ก้าวแรกของนักผจญภัย';resize();area.textContent=areaName(id);notice(areaName(id));
  const own=game.p;focus.set(own.x,0,own.z-1.1);markerTime=0;wonShown=false;
  for(const e of effects)scene.remove(e.mesh);effects.length=0;
  await new Promise(r=>setTimeout(r,180));
 }finally{switching=false;fade.hidden=true;}
}
const npcTalk=document.createElement('button');npcTalk.id='npc-talk';npcTalk.hidden=true;$('#ui').append(npcTalk);
const npcDialog=document.createElement('dialog');npcDialog.id='npc-dialog';npcDialog.innerHTML='<h2></h2><p></p><button>ปิด</button>';document.body.append(npcDialog);npcDialog.querySelector('button')!.onclick=()=>npcDialog.close();
let nearNpc: {name:string;kind:string;text:string}|null=null;
npcTalk.onclick=()=>{if(!nearNpc)return;clearInput();if(['market','forge'].includes(nearNpc.kind)){inventoryUI.shop(nearNpc.kind);return;}if(nearNpc.kind==='heal')net.send({t:'heal'});npcDialog.querySelector('h2')!.textContent=nearNpc.name;npcDialog.querySelector('p')!.textContent=nearNpc.text;npcDialog.showModal();};
function mapInteractions(){
 const mapTitle=document.querySelector('.map-head');if(mapTitle)mapTitle.textContent=areaName(activeMap);
 overview.hidden=activeMap!=='city_plaza';const p=game.p;nearNpc=null;
 if(activeMap==='city_plaza'&&!p.dead){
  for(const b of CITY_BUILDINGS)if(Math.hypot(p.x-b.talk.x,p.z-b.talk.z)<3)nearNpc={name:b.npc,kind:b.id,text:'เร็ว ๆ นี้'};
  if(Math.hypot(p.x-HEALER.x,p.z-HEALER.z)<3)nearNpc={name:'นักบวชหมอ',kind:'heal',text:'ขอให้พลังกลับคืนมา · ฟื้น HP / SP เต็มได้ทุก 60 วินาที'};
  if(Math.hypot(p.x-4,p.z-25)<3)nearNpc={name:'หัวหน้าทหารประตู',kind:'guard',text:'ผ่านประตูใต้สู่ทุ่งวุ้นจิ๋ว เริ่มฝึกกับวุ้นใกล้ทางเข้า หากบาดเจ็บให้กลับมาพบนักบวชหมอข้างน้ำพุ'};
 }
 npcTalk.hidden=!nearNpc;npcTalk.textContent=nearNpc?'คุย · '+nearNpc.name:'';
 const gates=GATES[activeMap];let closed='';
 for(const [gate,point]of Object.entries(gates))if(Math.hypot(p.x-point.x,p.z-point.z)<3){
  const open=activeMap==='meadow'||gate==='south';
  if(!open)closed=gate;
  else if(!p.dead&&!switching&&performance.now()-lastGate>1500&&Math.hypot(p.x-point.x,p.z-point.z)<1.25){lastGate=performance.now();net.send({t:'travel',gate});}
 }
 if(closed&&closed!==closedGate)notice('หมอกหนาเกินไป ยังผ่านไม่ได้');closedGate=closed;
 scene.fog=overviewOn&&activeMap==='city_plaza'?null:new T.Fog(activeMap==='city_plaza'?'#c8d1cd':'#c8d1bd',activeMap==='city_plaza'?35:30,activeMap==='city_plaza'?68:72);
}
const statusLabels=new Map<number,HTMLElement>();
const dropLabels=new Map<number,T.Sprite>(),dropPillars=new Map<number,T.Mesh>();
const enemies=new Map<number,any>(),drops=new Map<number,T.Mesh>(),effects:any[]=[],numbers:any[]=[];let markerTime=0;
function ring(x:number,z:number,r:number,color:string,width=.03,opacity=.7){const mesh=new T.Mesh(new T.RingGeometry(Math.max(.01,r-width),r,72),new T.MeshBasicMaterial({color,transparent:true,opacity,side:T.DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.045,z);scene.add(mesh);return mesh;}
const playerRing=ring(game.p.x,game.p.z,.48,'#e7eac2',.025,.5),targetRing=ring(0,0,.85,'#efc185',.04,.8),marker=ring(0,0,.3,'#fff1b5',.035,0);targetRing.visible=false;
const enemyLabel=(e:any)=>e.boss?(e.bossPhase===2?'ราชาวุ้นกริ้ว':'ราชาวุ้น'):e.variant==='mint'?'วุ้นเขียว':e.variant==='sky'?'วุ้นฟ้า':'วุ้นจิ๋ว';
const motionContacts:any[]=[],pendingContacts:any[]=[];let presentationFrame=0;
const encounterLog:any[]=[],projectileActors=new Map<number,ReturnType<typeof makePaintedDroplet>>();
function makeEnemy(e:any){const actor=makePaintedMonster(loader,e.boss,{variant:e.variant,id:e.id});scene.add(actor.root);const name=label(`${enemyLabel(e)} · Lv. ${e.boss?5:e.variant==='pink'?1:3}`,e.boss?'#ffe0a0':'#faf0d6');name.scale.multiplyScalar(e.boss?1:.72);scene.add(name);const bg=new T.Sprite(new T.SpriteMaterial({color:'#3b4638',transparent:true,opacity:.8,depthTest:false})),hp=new T.Sprite(new T.SpriteMaterial({color:'#dc8b9b',depthTest:false}));bg.scale.set(.85,.055,1);hp.scale.copy(bg.scale);scene.add(bg,hp);const v={actor,name,bg,hp};enemies.set(e.id,v);return v;}

let lighterVfx=false;
function particles(x:number,z:number,color:string,count=15,power=2,y=.8,jelly=false){count=Math.min(Math.floor(count*(quality?1:.5)*(lighterVfx?.4:1)),Math.max(0,(quality?96:48)-effects.filter(e=>e.kind==='particle').length));for(let i=0;i<count;i++){const s=.025+Math.random()*.045;const o=new T.Mesh((jelly?new T.SphereGeometry(s,6,5):new T.OctahedronGeometry(s,0)),new T.MeshBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));o.position.set(x,y+Math.random()*.5,z);if(jelly)o.scale.y=1.4;scene.add(o);const a=Math.random()*6.28;effects.push({kind:'particle',mesh:o,vx:Math.cos(a)*power,vz:Math.sin(a)*power,vy:1+Math.random()*3,life:.45+Math.random()*.4,max:.85});}}
function effectRing(x:number,z:number,color:string,r=2,life=.5){const o=ring(x,z,r,color,.15,.7);effects.push({kind:'ring',mesh:o,life,max:life});return o;}
function slash(e:Event){const angle=Math.atan2(e.dx,e.dz),o=new T.Mesh(new T.RingGeometry(.9,e.combo===2?2:1.6,40,1,0,Math.PI*1.3),new T.MeshBasicMaterial({color:e.combo===2?'#ffe2a0':'#f3f7e6',transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false,blending:T.AdditiveBlending}));if(e.combo===2)o.scale.setScalar(1.12);o.rotation.set(-Math.PI/2,.1,-angle-2);o.position.set(e.x,.95,e.z);scene.add(o);effects.push({kind:'slash',mesh:o,life:.26,max:.26});particles(e.x+e.dx,e.z+e.dz,'#ffebae',7,1.5);}
function spinEffect(x:number,z:number){effectRing(x,z,'#b6f6f0',3.2,.55);effectRing(x,z,'#f9e9a8',2.5,.42);for(let j=0;j<(lighterVfx?1:3);j++){const curve=[];for(let i=0;i<=50;i++){const a=i/50*Math.PI*1.65+j*2.1;curve.push(new T.Vector3(Math.cos(a)*(1.7+j*.35),.25+i/50*1.1,Math.sin(a)*(1.7+j*.35)));}const o=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(curve),50,.025+j*.01,5,false),new T.MeshBasicMaterial({color:j%2?'#eaffd9':'#8fe6e4',transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));o.position.set(x,0,z);scene.add(o);effects.push({kind:'spiral',mesh:o,life:.6,max:.6});}particles(x,z,'#baf6e6',38,4.5);}
function meteorEffect(e:Event){const o=new T.Group();const rock=new T.Mesh(new T.IcosahedronGeometry(.43,1),mat('#613d34'));o.add(rock);const shell=new T.Mesh(new T.SphereGeometry(.5,12,10),new T.MeshBasicMaterial({color:'#ffbe66',transparent:true,opacity:.6,blending:T.AdditiveBlending,depthWrite:false}));o.add(shell);const tail=new T.Mesh(new T.ConeGeometry(.42,2.5,10,1,true),new T.MeshBasicMaterial({color:'#f4b96d',transparent:true,opacity:.45,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false}));tail.rotation.z=Math.PI;tail.position.y=1.3;o.add(tail);o.position.set(e.x,10,e.z);scene.add(o);effects.push({kind:'meteor',mesh:o,life:e.duration,max:e.duration});effectRing(e.x,e.z,'#f4d191',2.7,e.duration);}
function notice(text:string){if([...$('#notices').children].some(el=>el.textContent===text))return;const el=document.createElement('div');el.className='notice';el.textContent=text;$('#notices').appendChild(el);setTimeout(()=>el.remove(),3500);}
function number(text:string,e:{x:number;z:number},kind='',height=1.8){const el=document.createElement('span');el.className=`number ${kind}`;el.textContent=text;$('#numbers').appendChild(el);numbers.push({el,x:e.x,z:e.z,height,life:1,max:1,offset:(Math.random()-.5)*16});}
function events(){for(const e of game.events.splice(0)){lighterVfx=!!e.playerId&&e.playerId!==net.you;const now=performance.now();combatFeel.event(e,net.you,game.p,now);if(e.playerId===net.you){hero.event(e);if((e.type==='skill'&&isSkillMotion(e.skillId)&&e.skillId!=='earth_break')||(e.type==='skillImpact'&&e.skillId==='earth_break'))pendingContacts.push({skill:e.skillId,eventAt:now,eventFrame:presentationFrame,expectedFrame:CONTACT_FRAME[e.skillId]});}else remoteHeroes.get(e.playerId)?.actor.event(e);if(e.type==='dashTrail'&&e.playerId===net.you)hero.update({...game.p,x:e.toX,z:e.toZ},time);skillArt.emit({...e,lighter:e.playerId!==net.you});const effectStart=effects.length;if(['kingAttack','phase2','summon','stun','kill','victory'].includes(e.type)){encounterLog.push({...e,time:game.time});if(encounterLog.length>128)encounterLog.shift();}sound.setListener(game.p);playEventAudio(sound,e,net.you,game.enemies.find(e=>e.boss)||ARENA);switch(e.type){
 case'skillImpact':if(e.skillId==='earth_break'){effectRing(e.x,e.z,'#c8b78f',2.5,.45);particles(e.x,e.z,'#c8b78f',18,2.6,.12);}break;
 case'slash':slash(e);break;
 case'spin':spinEffect(e.x,e.z);shake=.1;break;
 case'meteor':meteorEffect(e);break;
 case'impact':effectRing(e.x,e.z,'#ffd28c',3.1,.45);particles(e.x,e.z,'#ffd180',65,5);shake=.25;break;
 case'miss':number('MISS',e,'evade',e.defender==='player'?2.4:e.boss?2.5:1.55);break;
 case'hit':number(e.damage,e,e.crit?'crit':'',e.boss?2.5:1.55);particles(e.x,e.z,e.variant==='mint'?'#a8cbb1':e.variant==='sky'?'#a5c2d3':'#e1b0c1',e.crit?14:8,2,.8,true);shake=Math.max(shake,e.crit?.09:.035);break;
 case'kill':particles(e.x,e.z,'#ddb0c2',e.boss?35:16,2.5,e.boss?2:.8,true);break;
 case'hurt':number(`−${e.amount}`,e,'hurt',2.4);shake=.13;break;
 case'evade':number('DODGE',e,'evade',2.4);break;
 case'heal':number(`+${e.amount}`,e,'heal',2.4);effectRing(e.x,e.z,'#c3edb0',.9,.45);particles(e.x,e.z,'#d6f5b0',14,1);break;
 case'itemPickup':if(e.playerId===net.you)inventoryUI.toast(e.loot);break;
 case'pickup':number(`+${e.xp} EXP   ◈ ${e.gold}`,e,'reward',2.8);break;
 case'jobLevel':if(e.playerId===net.you){notice(`✦ JOB LV.${e.jobLevel} · +${e.granted} แต้มสกิล · K`);if(e.jobLevel===40)notice('✧ ทูตสวรรค์จะนำทางสู่อาชีพขั้นสองเมื่อถึงเวลา');}break;
 case'level':notice(`✦ LEVEL ${e.level} · +${e.granted||3} แต้มสเตตัส · C ดูสเตตัส`);$('#stats-button').classList.add('level-pulse');setTimeout(()=>$('#stats-button').classList.remove('level-pulse'),4500);effectRing(e.x,e.z,'#ffe6a0',2.2,.8);particles(e.x,e.z,'#ffedb7',45,3);break;
 case'dash':effectRing(e.x,e.z,'#c1e9e6',.6,.25);particles(e.x,e.z,'#d6eee2',16,1.4);break;
 case'warning':{const o=ring(e.x,e.z,e.r,'#e98074',.07,.8),fill=new T.Mesh(new T.CircleGeometry(e.r,48),new T.MeshBasicMaterial({color:'#df7162',transparent:true,opacity:.16,side:T.DoubleSide,depthWrite:false}));fill.rotation.x=-Math.PI/2;fill.position.set(e.x,.035,e.z);scene.add(fill);effects.push({kind:'warning',mesh:o,life:e.duration,max:e.duration});effects.push({kind:'warningFill',mesh:fill,life:e.duration,max:e.duration});break;}
 case'slam':effectRing(e.x,e.z,'#f2d8aa',2.8,.45);particles(e.x,e.z,'#dfd1ac',40,4);shake=.2;break;
 case'phase2':notice('✦ ราชาวุ้นกริ้ว — ระวังจังหวะโจมตีที่เร็วขึ้น!');effectRing(e.x,e.z,'#d28daf',3.5,1);break;
 case'sweep':effectRing(e.x,e.z,'#ddbacb',3.5,.4);break;
 case'summon':particles(e.x,e.z,'#c1c9a0',18,1.6,.8,true);break;
 case'boss':notice('✦ ผู้พิทักษ์ตื่นขึ้นแล้ว — ไปที่ซากโบราณทางใต้');$('#quest-name').textContent='ผู้พิทักษ์แห่งทุ่งหญ้า';$('#quest-note').textContent='หลบวงสีแดง แล้วโจมตีในช่วงพักของบอส';break;
 case'notice':notice(e.text);break;
 case'death':clearInput();deathReveal=1.5;break;
 case'victory':notice('✦ ราชาวุ้นถูกปราบแล้ว!');setTimeout(()=>{if(!game.p.dead)showVictory();},2000);break;
 }for(let i=effectStart;i<effects.length;i++)effects[i].owner=e.playerId;} }
function toggleAuto(){if(activeMap==='city_plaza'){notice('เขตปลอดภัย ต่อสู้ในเมืองไม่ได้');return;}if(!started||paused||game.p.dead)return;net.send({t:'auto',on:!game.p.auto});}
function stopAuto(){if(game.p.auto)net.send({t:'auto',on:false});}
const nextAction:Partial<Record<Action,number>>={};
function doAction(name:Action){if(!started||paused||inventoryUI.open||skillsUI.open||statsUI.open||game.p.dead||!net.connected)return;if(activeMap==='city_plaza'&&name!=='potion'){notice('เขตปลอดภัย ใช้สกิลต่อสู้ในเมืองไม่ได้');return;}const id=({attack:'basic',spin:'whirlwind',dash:'dodge'} as Record<string,string>)[name]||name;if(!game.p.skills?.[id]){notice('ยังไม่ได้เรียนสกิลนี้ · เปิด K เพื่อเรียน');return;}const now=performance.now();if(now<(nextAction[name]||0)||game.p.cd[name]>.08)return;nextAction[name]=now+(CD[name]||.12)*1000;
 net.send({t:'act',a:name,...(['attack','meteor'].includes(name)&&game.target?{target:game.target}:{})});worldState.animate(name,now);}
let heldPointer:{id:number;x:number;y:number;startX:number;startY:number;since:number;ground:boolean;dragged:boolean;nearTarget:number|null}|null=null;
const joy={x:0,y:0},stick=$('#joystick');let stickId:number|null=null;function clearInput(){heldPointer=null;keys.clear();net.send({t:'steer',dx:0,dz:0});joy.x=joy.y=0;$('#joystick i').style.transform='';}
function joyMove(e:PointerEvent){const b=stick.getBoundingClientRect(),x=e.clientX-b.left-b.width/2,y=e.clientY-b.top-b.height/2,l=Math.hypot(x,y),k=Math.min(1,27/(l||1));joy.x=x*k/27;joy.y=y*k/27;$('#joystick i').style.transform=`translate(${x*k}px,${y*k}px)`;}
stick.addEventListener('pointerdown',e=>{net.send({t:'auto',on:false});stopAuto();stickId=e.pointerId;stick.setPointerCapture(stickId);joyMove(e);});stick.addEventListener('pointermove',e=>{if(e.pointerId===stickId)joyMove(e);});for(const evt of['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(evt,()=>{stickId=null;joy.x=joy.y=0;$('#joystick i').style.transform='';});
const held=(binding:keyof typeof KEYS)=>KEYS[binding].some(code=>keys.has(code));
function nextTarget(){
 const living=game.enemies.filter(e=>!e.dead).sort((a,b)=>Math.hypot(a.x-game.p.x,a.z-game.p.z)-Math.hypot(b.x-game.p.x,b.z-game.p.z)||a.id-b.id);
 const index=living.findIndex(e=>e.id===game.target);const target=living.length?living[(index+1)%living.length].id:null;if(target)net.send({t:'target',id:target});game.target=target;game.destination=null;
}
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable))return;
 if(isKey('inventory',e.code)&&started&&!e.repeat){e.preventDefault();inventoryUI.toggle();return;}
 if(inventoryUI.open)return;
 if(isKey('mute',e.code)){e.preventDefault();if(!e.repeat)audioUI.toggleMute();return;}
 if(e.code==='KeyK'&&started&&!e.repeat){e.preventDefault();if(!statsUI.open)skillsUI.toggle();return;}
 if(skillsUI.open)return;
 if(isKey('stats',e.code)&&started&&!e.repeat){e.preventDefault();statsUI.toggle();return;}
 if(statsUI.open)return;
 if(isKey('pause',e.code)){e.preventDefault();net.send({t:'auto',on:false});stopAuto();if(e.repeat)return;if(($<HTMLDialogElement>('#guide')).open){$<HTMLDialogElement>('#guide').close();return;}if(started&&!game.p.dead)togglePause();return;}
 if(!started||paused||game.p.dead||$<HTMLDialogElement>('#guide').open)return;
 if(Object.values(KEYS).some(codes=>(codes as readonly string[]).includes(e.code)))e.preventDefault();
 if(['up','down','left','right'].some(a=>isKey(a as keyof typeof KEYS,e.code)))stopAuto();
 keys.add(e.code);if(e.repeat)return;
 if(isKey('auto',e.code))toggleAuto();else if(isKey('nextTarget',e.code))nextTarget();
 else if(skillsUI.key(e.code))e.preventDefault();else for(const a of ['dash','potion'] as const)if(isKey(a,e.code))doAction(a);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
function loseFocus(){clearInput();if(started&&!paused&&!game.p.dead&&!game.p.auto)togglePause();}window.addEventListener('blur',loseFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});
$('#auto-hunt').addEventListener('click',toggleAuto);
$$('[data-action]').forEach(b=>b.addEventListener('click',()=>doAction(b.dataset.action as Action)));
function pointerRay(x:number,y:number){const b=renderer.domElement.getBoundingClientRect();pointer.set((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1);ray.setFromCamera(pointer,camera);}
function pointerGround(){if(ray.ray.intersectPlane(floor,point)&&walkable(point.x,point.z,.3,activeMap)){net.send({t:'move',x:Math.round(point.x*100)/100,z:Math.round(point.z*100)/100});marker.position.set(point.x,.04,point.z);markerTime=.65;}}
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{
 if(!started||paused||switching||npcDialog.open||inventoryUI.open||skillsUI.open||statsUI.open||game.p.dead||e.button!==0)return;
 pointerRay(e.clientX,e.clientY);
 const targets=[...enemies.values()].filter(v=>v.actor.root.visible&&!v.actor.root.userData.dead).map(v=>v.actor.root);
 const hit=ray.intersectObjects(targets,true).find(h=>h.object.userData.enemyId!==undefined);
 const lootHit=ray.intersectObjects([...drops.values()],false)[0];if(lootHit){net.send({t:'inv',op:'pickup',req:crypto.randomUUID(),drop:lootHit.object.userData.dropId});return;}
 const current=game.enemies.find(e=>e.id===game.target&&!e.dead&&Math.hypot(e.x-game.p.x,e.z-game.p.z)<(e.boss?2.3:1.8));
 heldPointer={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,since:performance.now(),ground:!hit,dragged:false,nearTarget:current?.id??null};
 renderer.domElement.setPointerCapture(e.pointerId);
 if(hit){game.target=hit.object.userData.enemyId;game.destination=null;net.send({t:'target',id:game.target});}
 else{pointerGround();events();hud();}
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!heldPointer||heldPointer.id!==e.pointerId)return;
 heldPointer.x=e.clientX;heldPointer.y=e.clientY;
 if(Math.hypot(e.clientX-heldPointer.startX,e.clientY-heldPointer.startY)>6)heldPointer.dragged=true;
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])renderer.domElement.addEventListener(name,()=>{heldPointer=null;});
function pointerAttack(now:number){
 const h=heldPointer;if(!h)return false;
 if(!h.ground)return true;
 // A single ground click moves immediately. After the hold threshold, a nearby selected
 // jelly can be attacked; dragging always keeps steering across the ground.
 if(now-h.since<=180&&!h.dragged)return false;
 const target=!h.dragged&&game.enemies.find(e=>e.id===h.nearTarget&&!e.dead&&Math.hypot(e.x-game.p.x,e.z-game.p.z)<(e.boss?2.3:1.8));
 if(target){if(game.target!==target.id||game.destination)net.send({t:'target',id:target.id});game.target=target.id;game.destination=null;return true;}
 pointerRay(h.x,h.y);pointerGround();return false;
}
renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();zoomHeight=T.MathUtils.clamp(zoomHeight+e.deltaY*.008,12,25);resize();},{passive:false});
$('#play').addEventListener('click',()=>{started=true;paused=false;if(sceneReady)net.ready();$('#overlay').hidden=true;sound.start();notice(activeMap==='city_plaza'?'WASD หรือแตะพื้นเพื่อเดิน · คุยกับชาวเมือง · ประตูใต้นำไปทุ่งวุ้นจิ๋ว':'WASD เดิน · กดเมาส์ซ้ายค้าง / Space โจมตี · K สมุดสกิล · Shift หลบ · F ออโต้');});
$('#audio').addEventListener('click',()=>audioUI.toggleMute());
function applyQuality(automatic=false){renderer.setPixelRatio(quality?Math.min(devicePixelRatio,1.5):1);sun.castShadow=quality;renderer.shadowMap.enabled=quality;world.setQuality(quality);skillArt.setQuality(quality);renderer.shadowMap.needsUpdate=true;$('#quality').textContent=automatic?'LOW · อัตโนมัติ':quality?'HQ':'LOW';$('#quality').title='คุณภาพภาพ · '+(automatic?'อัตโนมัติ':'เลือกเอง');resize();}
$('#quality').addEventListener('click',()=>{quality=!quality;autoQuality.reset();applyQuality();});
$('#pause').addEventListener('click',()=>{if(started&&!game.p.dead)togglePause();});
$('#help').addEventListener('click',()=>{clearInput();paused=true;$<HTMLDialogElement>('#guide').showModal();});$('#guide .close').addEventListener('click',()=>$<HTMLDialogElement>('#guide').close());$('#guide .done').addEventListener('click',()=>$<HTMLDialogElement>('#guide').close());$('#guide').addEventListener('close',()=>{if(started&&$('#overlay').hidden)paused=false;});
function overlay(html:string){clearInput();paused=true;$('#overlay').className='overlay center';$('#overlay').innerHTML=`<section class="welcome">${html}</section>`;$('#overlay').hidden=false;}
function togglePause(){if(!paused){overlay('<p class="caption">TAKE A BREATH</p><h1>พักการผจญภัย</h1><p>โลกยังดำเนินต่อบนเซิร์ฟเวอร์</p><button id="resume" class="primary">เล่นต่อ →</button>');$('#resume').onclick=()=>{paused=false;$('#overlay').hidden=true;};}else{paused=false;$('#overlay').hidden=true;}}
function showDeath(){overlay('<p class="caption">A NEW BEGINNING</p><h1>พักสักหน่อย<br>แล้วเริ่มใหม่</h1><p>EXP และเงินที่เก็บได้ยังอยู่<br>กลับไปฟื้นพลังที่หอนาฬิกากันเถอะ</p><button id="revive" class="primary">กลับเมือง →</button>');$('#revive').onclick=()=>{net.send({t:'revive'});paused=false;$('#overlay').hidden=true;events();};}
function showVictory(){if(wonShown)return;wonShown=true;overlay(`<div class="ornament">✧ ───────── ✧</div><p class="caption">GUARDIAN OF THE FIELDS DEFEATED</p><h1>การผจญภัย<br>บทแรกสำเร็จ!</h1><p>Lv. ${game.p.level} · ${game.kills} defeated · ${game.p.gold} Zeny</p><button id="continue" class="primary">สำรวจทุ่งหญ้าต่อ →</button>`);$('#continue').onclick=()=>{paused=false;$('#overlay').hidden=true;};}
const map=$<HTMLCanvasElement>('#map'),mx=map.getContext('2d')!;
function minimap(){if(activeMap==='city_plaza'){
 mx.fillStyle='#88938f';mx.fillRect(0,0,160,132);mx.strokeStyle='#d5cdb5';mx.lineWidth=8;mx.beginPath();mx.moveTo(80,2);mx.lineTo(80,130);mx.moveTo(2,66);mx.lineTo(158,66);mx.stroke();mx.strokeStyle='#505e5d';mx.lineWidth=3;mx.strokeRect(2,2,156,128);
 const dot=(x:number,z:number,r:number,color:string)=>{mx.fillStyle=color;mx.beginPath();mx.arc((x+30)/60*160,(z+30)/60*132,r,0,Math.PI*2);mx.fill();};
 for(const b of CITY_BUILDINGS)dot(b.x,b.z,6,'#56645f');dot(0,0,5,'#e3dcc3');dot(-9,9,4,'#8bc3d0');dot(0,28,4,'#b5deaa');dot(game.p.x,game.p.z,3,'#fff7d5');mx.fillStyle='#fff';mx.font='10px sans-serif';mx.fillText('N',84,12);return;}
mx.fillStyle='#889d69';mx.fillRect(0,0,160,132);mx.lineCap='round';mx.strokeStyle='#d2c397';mx.lineWidth=7;mx.beginPath();mx.moveTo(75,132);mx.lineTo(75,96);mx.lineTo(80,75);mx.lineTo(75,57);mx.lineTo(85,24);mx.stroke();mx.lineWidth=5;mx.beginPath();mx.moveTo(0,75);mx.lineTo(80,75);mx.lineTo(104,66);mx.lineTo(160,66);mx.stroke();mx.fillStyle='#7fa9a1';mx.beginPath();mx.ellipse(132,61,14,20,0,0,6.28);mx.fill();mx.fillStyle='#bba16c';mx.fillRect(117,63,30,5);for(const[x,z]of[[-11,-6],[-8,-10],[8,-9],[-12,5],[10,8],[5,10]]){mx.fillStyle='#4f7654';mx.beginPath();mx.arc((x+17)/34*160,(z+14)/28*132,5,0,6.28);mx.fill();}mx.fillStyle='#e5dcb2';mx.fillRect((ARENA.x+17)/34*160-9,(ARENA.z+14)/28*132-2,18,5);mx.fillRect((CAMP.x+17)/34*160-3,(CAMP.z+14)/28*132-3,6,6);for(const e of game.enemies){if(e.dead)continue;mx.fillStyle=e.boss?'#ffdb87':'#f4b3c5';mx.beginPath();mx.arc((e.x+17)/34*160,(e.z+14)/28*132,e.boss?3:1.7,0,6.28);mx.fill();}mx.fillStyle='#fff7d5';mx.strokeStyle='#314d39';mx.lineWidth=1.5;mx.beginPath();mx.arc((game.p.x+17)/34*160,(game.p.z+14)/28*132,3,0,6.28);mx.fill();mx.stroke();}
function hud(){mapInteractions();const p=game.p;inventoryUI.update(p);skillsUI.update(p);const auto=$('#auto-hunt');auto.classList.toggle('auto-active',p.auto);auto.setAttribute('aria-pressed',String(p.auto));$('#auto-label').textContent=p.auto?'AUTO ON':'AUTO';const status=$('#auto-status');status.hidden=!p.auto;status.textContent='ออโต้: '+(p.autoState==='retreat'?'กลับแคมป์':p.autoState==='fight'?'กำลังสู้':'กำลังหาเป้าหมาย');$('#level').textContent=String(p.level);$('#hp').style.width=`${p.hp/p.maxHp*100}%`;$('#hp-text').textContent=`${Math.ceil(p.hp)} / ${Math.ceil(p.maxHp)}`;$('#mp').style.width=`${p.mp/p.maxMp*100}%`;$('#mp-text').textContent=`${Math.floor(p.mp)} / ${Math.floor(p.maxMp)}`;$('#xp').style.width=`${p.xp/p.nextXp*100}%`;$('#gold').textContent=String(p.gold);$('#kills').textContent=`${game.kills} defeated`;$('#potions').textContent=String(p.potions);
 const boss=game.enemies.find(e=>e.boss&&(!e.dead||e.deathAge<3.8));$('#boss-hud').hidden=!boss;document.body.classList.toggle('boss-active',!!boss);if(boss){$('#boss-hp').style.width=`${boss.hp/boss.maxHp*100}%`;$('#boss-hud h3').textContent=enemyLabel(boss);$('#boss-hud small').textContent=boss.dead?'DEFEATED':`${boss.bossPhase===2?'PHASE II':'PHASE I'} · ${boss.motion.toUpperCase()}`;}
 if(activeMap==='city_plaza'){$('#quest-name').textContent='นครที่ถูกลืมเลือน';$('#quest-line').textContent='ออกประตูใต้เพื่อสำรวจทุ่งวุ้นจิ๋ว';$('#quest-progress').style.width='0';$('#quest-note').textContent='คุยกับทูตสวรรค์ หรือพักฟื้นข้างน้ำพุ';}else if(game.won){$('#quest-line').innerHTML='ปราบผู้พิทักษ์สำเร็จ <b>✓</b>';$('#quest-progress').style.width='100%';$('#quest-note').textContent='ลองคอมโบและสำรวจทุ่งหญ้าต่อได้';}else if(game.bossSpawned){$('#quest-line').innerHTML='ปราบราชาวุ้น <b>0 / 1</b>';$('#quest-progress').style.width=boss?`${(1-boss.hp/boss.maxHp)*100}%`:'0';}else{$('#quest-line').innerHTML=`ปราบวุ้นจิ๋ว <b>${Math.min(6,game.kills)} / 6</b>`;$('#quest-progress').style.width=`${Math.min(1,game.kills/6)*100}%`;}
 const target=game.enemies.find(e=>e.id===game.target&&!e.dead);$('#target').hidden=!target||target.boss;if(target){$('#target-name').textContent=enemyLabel(target);$('#target-lv').textContent=target.boss?'Lv. 5':'Lv. 1';$('#target-hp').style.width=`${target.hp/target.maxHp*100}%`;}
 for(const b of $$('[data-action]')){const a=b.dataset.action as Action,cd=p.cd[a];b.style.setProperty('--cooldown-angle',`${Math.min(1,cd/CD[a])*360}deg`);let n=b.querySelector<HTMLElement>('.cooldown');if(cd>.15){if(!n){n=document.createElement('span');n.className='cooldown';b.appendChild(n);}n.textContent=cd>=1?String(Math.ceil(cd)):cd.toFixed(1);}else n?.remove();const unavailable=(a==='spin'&&p.mp<20)||(a==='meteor'&&p.mp<30)||(a==='potion'&&p.potions===0);b.classList.toggle('empty',unavailable);b.classList.toggle('ready',!unavailable&&cd<=.15);b.setAttribute('aria-disabled',String(unavailable||cd>0));}minimap();}
const remoteHeroes=new Map<string,any>();
function render(dt:number){sound.setListener(game.p);for(const other of worldState.others){let v=remoteHeroes.get(other.id);if(!v){v={actor:makePaintedHero(loader),label:label(other.name,'#f4f5da')};scene.add(v.actor.root,v.label);remoteHeroes.set(other.id,v);}v.actor.update(other,time,combatFeel.frozen(other.id,performance.now()));v.label.position.set(other.x,3.7,other.z);v.label.visible=!other.dead;}for(const [id,v]of remoteHeroes)if(!worldState.others.some(p=>p.id===id)){scene.remove(v.actor.root,v.label);v.actor.dispose?.();v.label.material.map?.dispose();v.label.material.dispose();remoteHeroes.delete(id);}if(deathReveal>0){deathReveal=Math.max(0,deathReveal-dt);if(deathReveal===0&&game.p.dead)showDeath();}const p=game.p;skillArt.update(dt,[p,...worldState.others],id=>combatFeel.frozen(id,performance.now()));hero.update(p,time,combatFeel.frozen(net.you,performance.now()));for(const c of pendingContacts.splice(0)){motionContacts.push({...c,renderedAt:performance.now(),renderFrame:presentationFrame,hero:hero.snapshot()});if(motionContacts.length>64)motionContacts.shift();}hero.root.visible=worldState.ready;playerRing.position.set(p.x,.05,p.z);heroName.position.set(p.x,3.7,p.z);heroName.visible=worldState.ready&&!p.dead;focus.lerp(new T.Vector3(p.x,0,p.z-1.1),1-Math.exp(-dt*5));camera.position.copy(focus).add(cameraOffset);const cameraShake=combatFeel.camera(dt);if(cameraShake>0){camera.position.x+=(Math.random()-.5)*cameraShake;camera.position.y+=(Math.random()-.5)*cameraShake;}shake=0;camera.lookAt(focus);if(overviewOn&&activeMap==='city_plaza'){camera.position.set(0,70,.01);camera.lookAt(0,0,0);}camera.updateMatrixWorld();
 for(const e of game.enemies){const v=enemies.get(e.id)||makeEnemy(e);v.actor.root.position.x-=v.nudgeX||0;v.actor.root.position.z-=v.nudgeZ||0;if(!combatFeel.frozen('monster:'+e.id,performance.now()))v.actor.update(e,time);v.actor.flash(combatFeel.flash(e.id,performance.now()));const nudge=combatFeel.nudge(e.id,performance.now());v.actor.root.position.x+=nudge.x;v.actor.root.position.z+=nudge.z;v.nudgeX=nudge.x;v.nudgeZ=nudge.z;if(!e.boss&&!e.dead&&e.motion==='hop'&&Math.hypot(e.x-game.p.x,e.z-game.p.z)<9){const beat=Math.floor(e.motionTime/.6);if(v.audioHop!==beat){v.audioHop=beat;if(Math.random()<.25)sound.play('jelly_hop',e);}}else v.audioHop=-1;const lift=e.statuses?.find(s=>s.id==='knockup');if(lift)v.actor.root.position.y+=Math.sin((.8-lift.remaining)/.8*Math.PI)*.7;if(e.boss&&v.actor.snapshot().actualMotion==='fallback')v.actor.root.visible=false;let tag=statusLabels.get(e.id);if(!tag){tag=document.createElement('span');tag.className='status-tag';$('#numbers').append(tag);statusLabels.set(e.id,tag);}tag.hidden=e.dead||!e.statuses?.length;if(!tag.hidden){tag.textContent=e.statuses.map((s:any)=>`${s.id==='stun'?'✧':s.id==='knockup'?'↑':s.id==='taunt'?'◎':'↓DEF'} ${s.remaining.toFixed(1)}`).join(' ');const pos=new T.Vector3(e.x,e.boss?4:2.1,e.z).project(camera);tag.style.left=`${(pos.x*.5+.5)*innerWidth}px`;tag.style.top=`${(-pos.y*.5+.5)*innerHeight}px`;}v.name.visible=!e.dead&&!e.boss;v.name.position.set(e.x,1.8,e.z);v.bg.visible=v.hp.visible=!e.dead&&!e.boss&&(e.hp<e.maxHp||game.target===e.id);v.bg.position.set(e.x,1.6,e.z);v.hp.position.copy(v.bg.position);const w=.85;v.hp.scale.x=w*e.hp/e.maxHp;v.hp.position.addScaledVector(right,-w*(1-e.hp/e.maxHp)/2);}
 for(const[id,v]of enemies)if(!game.enemies.some(e=>e.id===id)){scene.remove(v.actor.root,v.name,v.bg,v.hp);v.actor.dispose();v.name.material.map?.dispose();v.name.material.dispose();v.bg.material.dispose();v.hp.material.dispose();enemies.delete(id);}
 for(const p of game.projectiles){let actor=projectileActors.get(p.id);if(!actor){actor=makePaintedDroplet(loader,p.phase);projectileActors.set(p.id,actor);scene.add(actor.root);}actor.update(p.x,p.z,time);}
 for(const[id,actor]of projectileActors)if(!game.projectiles.some(p=>p.id===id)){scene.remove(actor.root);actor.dispose();projectileActors.delete(id);}

 const target=game.enemies.find(e=>e.id===game.target&&!e.dead);targetRing.visible=!!target;if(target){targetRing.position.set(target.x,.05,target.z);targetRing.scale.setScalar(target.boss?1.75:1);targetRing.rotation.z=time*.4;}
 for(const d of game.drops){
  const template=d.loot?.map(i=>itemData.items.items.find(t=>t.id===i.template)!).sort((a,b)=>['common','fine','rare','epic','legendary'].indexOf(b.rarity)-['common','fine','rare','epic','legendary'].indexOf(a.rarity))[0];const color=template?rarityColors[template.rarity]:'#ffe7a0';
  if(template&&!dropLabels.has(d.id)){const name=label(d.loot!.map(i=>itemData.items.items.find(t=>t.id===i.template)!.nameTh+' ×'+i.qty).join(' · '),color);name.scale.multiplyScalar(.6);scene.add(name);dropLabels.set(d.id,name);if(['rare','epic','legendary'].includes(template.rarity)){const pillar=new T.Mesh(new T.CylinderGeometry(.18,.45,3,12,1,true),new T.MeshBasicMaterial({color,transparent:true,opacity:.17,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide}));scene.add(pillar);dropPillars.set(d.id,pillar);sound.play('levelup');}}
  dropLabels.get(d.id)?.position.set(d.x,1.3,d.z);dropPillars.get(d.id)?.position.set(d.x,1.6,d.z);
  let o=drops.get(d.id);if(!o){o=new T.Mesh(new T.OctahedronGeometry(.14,0),new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.4,metalness:.3,roughness:.4}));scene.add(o);o.userData.dropId=d.id;drops.set(d.id,o);}o.position.set(d.x,.5+Math.sin(time*5+d.id)*.1,d.z);o.rotation.y=time*2;}
 for(const[id,o]of drops)if(!game.drops.some(d=>d.id===id)){scene.remove(o);const name=dropLabels.get(id);if(name){scene.remove(name);name.material.map?.dispose();name.material.dispose();dropLabels.delete(id);}const pillar=dropPillars.get(id);if(pillar){scene.remove(pillar);pillar.geometry.dispose();(pillar.material as T.Material).dispose();dropPillars.delete(id);}o.geometry.dispose();(o.material as T.Material).dispose();drops.delete(id);}
 for(let i=effects.length-1;i>=0;i--){const e=effects[i];if(e.owner&&combatFeel.frozen(e.owner,performance.now()))continue;e.life-=dt;const ratio=Math.max(0,e.life/e.max),o=e.mesh;if(e.kind==='particle'){o.position.x+=e.vx*dt;o.position.z+=e.vz*dt;o.position.y+=e.vy*dt;e.vy-=dt*6;o.rotation.y+=dt*4;o.material.opacity=ratio;}else if(e.kind==='meteor'){o.position.y=ratio*10;o.rotation.y+=dt*5;}else if(e.kind==='slash'){o.rotation.z+=dt*7;o.material.opacity=ratio*.8;}else if(e.kind==='spiral'){o.rotation.y+=dt*9;o.material.opacity=ratio*.8;}else if(e.kind==='warning'||e.kind==='warningFill'){o.material.opacity=e.kind==='warning'?.65+Math.sin(time*30)*.15:.12+(1-ratio)*.18;}else{o.scale.setScalar(.45+(1-ratio)*.8);o.material.opacity=ratio*.75;}if(e.life<=0){scene.remove(o);o.traverse((c:any)=>{c.geometry?.dispose();if(c.material)c.material.dispose();});effects.splice(i,1);}}
 for(let i=numbers.length-1;i>=0;i--){const n=numbers[i];n.life-=dt;if(n.life<=0){n.el.remove();numbers.splice(i,1);continue;}const pos=new T.Vector3(n.x,n.height+(1-n.life)*1.3,n.z).project(camera);n.el.style.transform=`translate(${(pos.x*.5+.5)*innerWidth+n.offset}px,${(-pos.y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;n.el.style.opacity=String(Math.min(1,n.life*3));}
 markerTime=Math.max(0,markerTime-dt);(marker.material as T.MeshBasicMaterial).opacity=markerTime;marker.scale.setScalar(1+(.65-markerTime)*1.8);world.update(time);
}
function resize(){const aspect=innerWidth/innerHeight,h=typeof overviewOn!=='undefined'&&overviewOn&&activeMap==='city_plaza'?72:(innerWidth<650?zoomHeight+2:zoomHeight);camera.left=-h*aspect/2;camera.right=h*aspect/2;camera.top=h/2;camera.bottom=-h/2;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}window.addEventListener('resize',resize);resize();
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;overlay('<h1>การแสดงผลถูกพัก</h1><p>กรุณารีเฟรชหน้าเพื่อเริ่มเกมใหม่</p><button id="reload" class="primary">เริ่มใหม่</button>');$('#reload').onclick=()=>location.reload();});
let hudTime=0,frameCount=0,fpsTime=0;
function frame(now:number){requestAnimationFrame(frame);const wallDt=Math.max(0,(now-previous)/1000),dt=Math.min(wallDt,.05);previous=now;time+=dt;
 let input={x:0,z:0};if(started&&!paused&&!statsUI.open&&!skillsUI.open&&!npcDialog.open&&!switching&&!game.p.dead&&net.connected){let x=Number(held('right'))-Number(held('left'))+joy.x,y=Number(held('up'))-Number(held('down'))-joy.y;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}input={x:right.x*x+up.x*y,z:right.z*x+up.z*y};net.send({t:'steer',dx:Math.round(input.x*1000)/1000,dz:Math.round(input.z*1000)/1000});if(held('attack')||pointerAttack(now))doAction('attack');}
 worldState.update(now,Math.min(wallDt,.1),input,net.seq);if(window.tnBoot.progress===100){loader.startDeferred();sound.afterPlayable();if(activeMap==='meadow'&&(game.bossSpawned||game.kills>=3||Math.hypot(game.p.x-ARENA.x,game.p.z-ARENA.z)<10)){warmKing(loader);void sound.load('sfx-king');}}let kingNote=document.querySelector<HTMLElement>('#king-loading');if(game.bossSpawned&&!kingReady(loader)){if(!kingNote){kingNote=document.createElement('div');kingNote.id='king-loading';kingNote.role='status';kingNote.textContent='ราชาวุ้นกำลังมา…';$('#ui').append(kingNote);}kingNote.hidden=false;}else if(kingNote)kingNote.hidden=true;events();presentationFrame++;if(quality&&autoQuality.update(wallDt,started&&sceneReady&&worldState.ready&&!switching&&!document.hidden)) {quality=false;applyQuality(true);}render(dt);renderer.render(scene,camera);if(sceneReady&&worldState.ready&&!assetFailure)window.tnBoot.stage(4);hudTime+=dt;if(hudTime>.1){hud();hudTime=0;}frameCount++;fpsTime+=wallDt;if(fpsTime>=1){$('#fps').textContent=`${Math.round(frameCount/fpsTime)} FPS · ${Math.round(net.ping)} ms`;fpsTime=frameCount=0;}}
const overview=document.createElement('button');overview.id='city-overview';overview.textContent='ผังเมือง';$('#ui').append(overview);
overview.onclick=()=>{overviewOn=!overviewOn;overview.setAttribute('aria-pressed',String(overviewOn));resize();};
hud();requestAnimationFrame(frame);
// Read-only diagnostics; no test-only mutation or gameplay shortcuts are exposed.
(window as any).__FIELDS__={snapshot:()=>({mapId:activeMap,transitioning:switching,assets:loader.snapshot(),others:worldState.others.map(p=>({id:p.id,name:p.name,x:p.x,z:p.z,hp:p.hp})),network:{connected:net.connected,tick:worldState.lastTick,ack:worldState.ack,ping:net.ping,you:net.you},started,paused,time:game.time,hero:hero.snapshot(),environment:world.snapshot(),p:{...game.p,cd:{...game.p.cd}},target:game.target,destination:game.destination,kills:game.kills,bossSpawned:game.bossSpawned,won:game.won,encounterLog:encounterLog.map(e=>({...e})),projectiles:game.projectiles.map(p=>({...p})),enemies:game.enemies.map(e=>({id:e.id,x:e.x,z:e.z,hp:e.hp,maxHp:e.maxHp,boss:e.boss,dead:e.dead,deathAge:e.deathAge,motion:e.motion,motionTime:e.motionTime,bossPhase:e.bossPhase,variant:e.variant,summoned:e.summoned,aimX:e.aimX,aimZ:e.aimZ,windup:e.windup,statuses:e.statuses,history:[...e.history],actor:enemies.get(e.id)?.actor.snapshot()})),motionContacts,combatFeel:combatFeel.enabled,autoQuality:{automatic:autoQuality.automatic,threshold:autoQuality.threshold(),seconds:3},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),project:(x:number,z:number,y=0)=>{const p=new T.Vector3(x,y,z).project(camera);return{x:(p.x*.5+.5)*innerWidth,y:(-p.y*.5+.5)*innerHeight};}};



