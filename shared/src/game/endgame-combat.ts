import type {Game,Enemy,Player,MonsterMotion,BossTelegraph} from './sim.js';
import {telegraphContains} from './telegraph-area.js';
import {walkable} from './collision.js';
import {pathSegmentWalkable} from './pathfinding.js';
import {lootEvadedWarning} from './loot-effects.js';

export const ENDGAME_REGIONS=['dragon','volcano','fae','ocean','astral','abyss','confluence'] as const;
type Pattern={kind:'dive'|'fan'|'guard'|'trail'|'focus'|'pair'|'cross'|'ring'|'retreat'|'pull'|'split'|'quake';name:string;windup:number;radius:number;angle?:number;inner?:number;count?:number;slow?:number;bleed?:boolean;heal?:number;cooldown:number};
const rule=(kind:Pattern['kind'],name:string,radius:number,extra:Partial<Pattern>={}):Pattern=>({kind,name,radius,windup:1.6,cooldown:7,...extra});
const patterns:Record<string,Pattern[]>={
 dragon_cloud_carp:[rule('dive','ปลามังกรกระโจนหมอก',2,{slow:.15,windup:1.4})],
 dragon_jade_crane:[rule('fan','ปีกหยกสามช่อง',6,{angle:22,count:3})],
 dragon_stone_liondog:[rule('guard','ตราเฝ้าตำหนัก',3.5,{windup:1.8})],
 dragon_sky_qilin:[rule('trail','รอยกีบสายฟ้า',1.5,{count:4,windup:1.8})],
 dragon_bell_drake:[rule('focus','กระดิ่งรวมพลัง',3,{count:1,windup:2.5})],
 dragon_white_cloud_tiger:[rule('pair','พยัคฆ์กระโจนสองจังหวะ',2.2,{count:2,windup:1.3})],
 dragon_jade_gatekeeper:[rule('cross','โล่หยกสองทิศ',6,{count:2,angle:60,windup:2})],
 dragon_cloud_dragon_lord:[rule('focus','เสาพายุทะเลเมฆ',2.8,{count:3,windup:3}),rule('fan','อ้าวหลงลมหายใจเมฆา',10,{angle:45,count:3,windup:2.4})],
 volcano_lava_glass_lizard:[rule('guard','เกล็ดแก้วอัดความร้อน',4,{angle:65,windup:2})],
 volcano_ash_boulder_beetle:[rule('focus','หินร้อนเริ่มกลิ้ง',2,{count:1,windup:2.4})],
 volcano_ash_spine_boar:[rule('dive','พุ่งหนามออบซิเดียน',2.4,{bleed:true,windup:1.8})],
 volcano_old_kiln_sprite:[rule('split','เตาถ่านสลับแสง',2.3,{count:3,windup:2})],
 volcano_red_smoke_shroom:[rule('ring','ควันแก้วแดงปะทุ',5,{inner:1.7,slow:.2,windup:2})],
 volcano_azure_firebird:[rule('focus','ขนเพลิงฟื้นชีพ',2.6,{count:2,heal:.08,windup:2.7})],
 volcano_crater_hammer_ogre:[rule('cross','ค้อนแยกทางหินเย็น',7,{angle:28,count:3,windup:2.2})],
 volcano_golden_ash_zmey:[rule('focus','เกราะคอซเมย์สามเศียร',8,{angle:28,count:3,windup:3.2}),rule('trail','ลมหายใจเถ้าทอง',2.5,{count:5,windup:2.6,bleed:true})],
 fae_puca_shadowhorse:[rule('pair','กีบม้าเงาวนกลับ',2,{count:2,windup:1.5})],
 fae_wandering_light_moth:[rule('split','แสงผีเสื้อหลงทาง',2.5,{count:3,windup:2,slow:.2})],
 fae_false_garden_root:[rule('trail','รากสวนลวงแตกหน่อ',1.5,{count:3,windup:1.8,slow:.35})],
 fae_moondrop_mirrorfae:[rule('guard','กระจกจันทร์สะท้อนทิศ',4,{windup:2})],
 fae_moonlichen_stag:[rule('retreat','ธารตะไคร่จันทรา',3,{heal:.07,windup:2.2})],
 fae_violet_banshee:[rule('ring','เสียงคร่ำครวญผ้าม่วง',6,{inner:2.5,windup:2.2,slow:.3})],
 fae_silverchain_dullahan:[rule('pull','โซ่เงินกวาดเงา',7,{angle:25,windup:2.1})],
 fae_twilight_antler_king:[rule('focus','วงแหวนราชันสนธยา',3,{count:3,windup:3}),rule('ring','เขากวางเปิดจันทร์',10,{inner:3.5,windup:2.5})],
 ocean_storm_conch:[rule('guard','เกลียวสังข์พายุ',4,{windup:1.9})],
 ocean_mast_crab:[rule('cross','ก้ามเสากระโดงไขว้',4.5,{angle:55,count:2,windup:1.8})],
 ocean_whirlpool_lanternfish:[rule('pull','แสงโคมกระแสวน',3.5,{windup:2})],
 ocean_mist_isle_siren:[rule('fan','เสียงไซเรนสามแนว',7,{angle:18,count:3,slow:.2,windup:2})],
 ocean_sunken_coral_knight:[rule('guard','โล่ปะการังเปิดข้าง',5,{angle:40,windup:1.8})],
 ocean_sixhead_reef_scylla:[rule('cross','สกิลลาหกเศียร',6,{angle:24,count:6,windup:2.3})],
 ocean_shipwreck_colossus:[rule('quake','ซากเรือถล่ม',8,{inner:2.8,windup:2.5})],
 ocean_stormcrown_kraken:[rule('focus','สมอหนวดมงกุฎพายุ',2.8,{count:4,windup:3}),rule('cross','แปดหนวดปิดทางน้ำ',10,{angle:24,count:4,windup:2.5})],
 astral_stardust_jellyfish:[rule('ring','หนวดละอองดาว',4.5,{inner:1.5,windup:1.8})],
 astral_orbital_ray:[rule('dive','กระเบนเปลี่ยนวงโคจร',2.2,{windup:1.5})],
 astral_meteor_ring_serpent:[rule('trail','วงแหวนอุกกาบาต',1.7,{count:4,windup:2})],
 astral_constellation_crane:[rule('fan','ปีกกระเรียนกลุ่มดาว',7,{angle:18,count:3,windup:1.7})],
 astral_vacuum_bell_construct:[rule('focus','ระฆังกลืนเสียง',3.3,{count:2,windup:2.6,slow:.3})],
 astral_solarshadow_lion:[rule('pair','กรงเล็บสุริยเงา',2.6,{count:2,windup:1.5})],
 astral_twelve_star_knight:[rule('cross','หอกตราสิบสองดาว',7,{angle:18,count:4,windup:2.2})],
 astral_star_eating_eclipse:[rule('focus','ตราดาวรับสุริยคราส',2.5,{count:3,windup:3}),rule('ring','คืนเงากลืนดารา',11,{inner:4,windup:2.6})],
 abyss_black_salt_crab:[rule('retreat','เกลือดำปิดทาง',3,{slow:.4,windup:1.7})],
 abyss_silt_mudskipper:[rule('dive','ปลาตีนยิงคราบดิน',2,{slow:.25,windup:1.5})],
 abyss_ziggurat_clay_guard:[rule('focus','ประกอบแขนดินดำ',5,{angle:50,count:2,windup:2.5})],
 abyss_anzu_lionbird:[rule('fan','ฝุ่นปีกอันซู',8,{angle:25,count:2,windup:2,bleed:true})],
 abyss_mushhushshu_serpent:[rule('guard','ตราดินมุชฮุชชู',4.5,{windup:2.1})],
 abyss_night_border_scorpion:[rule('cross','หอกและหางชายแดนราตรี',6,{angle:40,count:2,windup:2,bleed:true})],
 abyss_blackstone_lamassu:[rule('dive','ปีกหินดำวิ่งชน',3.2,{windup:2.5})],
 abyss_primordial_sea_dragon:[rule('focus','ตราน้ำมารดาทะเล',3,{count:3,windup:3.2,slow:.3}),rule('fan','ลมหายใจทะเลบรรพกาล',11,{angle:38,count:3,windup:2.8,bleed:true})],
 confluence_life_pillar_guard:[rule('focus','หลักชีวิตแยกพิษ',3,{count:3,heal:.08,windup:3})],
 confluence_thunder_pillar_guard:[rule('cross','หลักอสนีผลัดแนวศิลา',8,{angle:36,count:2,windup:2.6})],
 confluence_starshadow_pillar_guard:[rule('focus','หลักเงาดาราปิดตรา',2.5,{count:3,windup:3})],
 confluence_worldcore_sovereign:[rule('focus','แกนชีวิตรอยต่อ',3,{count:3,heal:.06,windup:3.2}),rule('cross','แกนศิลารอยต่อ',10,{angle:28,count:4,windup:2.8}),rule('ring','แกนดารารอยต่อ',11,{inner:3.8,windup:2.6})],
};
export const isEndgameEnemy=(id:string)=>Object.hasOwn(patterns,id);
export const CONFLUENCE_GUARDS=['confluence_life_pillar_guard','confluence_thunder_pillar_guard','confluence_starshadow_pillar_guard'];
export function endgameBossLocked(g:Game,e:Enemy){return e.dataId==='confluence_worldcore_sovereign'&&!CONFLUENCE_GUARDS.every(id=>g.enemies.some(v=>v.dataId===id&&!v.summoned&&v.dead));}
export interface EndgameCombat {next:number;coreStage?:number;recovery?:number;openUntil?:number;focus?:boolean;expires?:number;broken?:number;stage?:number;fields?:{area:BossTelegraph;until:number;tick:number}[];action?:{pattern:Pattern;areas:BossTelegraph[];targets:string[];left:number;target:{x:number;z:number}}}
interface Hooks {motion:(e:Enemy,m:MonsterMotion)=>void;move:(e:Enemy,x:number,z:number)=>void;movePlayer:(p:Player,x:number,z:number)=>void;hurt:(p:Player,e:Enemy,attack?:string)=>boolean|void;spawn:(x:number,z:number,id:string,parent:number)=>Enemy;}
export function endgameDestroyed(g:Game,e:Enemy){if(!e.endgame?.focus)return;const parent=g.enemies.find(v=>v.id===e.summonedBy);if(parent?.endgame)parent.endgame.broken=(parent.endgame.broken??0)+1;e.rewarded=true;}
export function endgameHitMultiplier(g:Game,e:Enemy,p:Player){
 const s=e.endgame;if(!isEndgameEnemy(e.dataId))return 1;
 if(s?.openUntil&&s.openUntil>g.time)return 1.15;
 const rule=patterns[e.dataId][0];
 if(rule.kind==='guard'){
  const front=(p.x-e.x)*e.fx+(p.z-e.z)*e.fz>0;
  return front&&Math.hypot(e.x-e.homeX,e.z-e.homeZ)<4?.65:1;
 }
 return 1;
}
export function endgameStep(g:Game,e:Enemy,dt:number,h:Hooks){
 const s=e.endgame??(isEndgameEnemy(e.dataId)?e.endgame={next:0}:undefined);if(!s)return false;
 if(s.focus){if(g.time>=(s.expires??0)||!g.enemies.some(v=>v.id===e.summonedBy&&!v.dead)){e.dead=true;e.rewarded=true;e.deathAge=0;h.motion(e,'death');}return true;}
 if(endgameBossLocked(g,e)){e.hp=e.maxHp;e.telegraph=undefined;s.action=undefined;h.motion(e,'idle');return true;}
 const list=patterns[e.dataId],p=g.p,d=Math.hypot(p.x-e.x,p.z-e.z);
 const clear=(x:number,z:number)=>walkable(x,z,.4,g.mapId);
 if(e.dataId==='confluence_worldcore_sovereign'){
  const stage=e.hp>e.maxHp*.66?0:e.hp>e.maxHp*.33?1:2;
  if(s.coreStage===undefined)s.coreStage=stage;
  else if(stage!==s.coreStage){s.coreStage=stage;s.action=undefined;s.recovery=undefined;e.telegraph=undefined;s.next=g.time+1.5;h.motion(e,'transform');g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});for(const player of g.players.values())g.events.push({type:'notice',playerId:player.id,x:e.x,z:e.z,text:['แกนชีวิต · ทำลายตราเพื่อหยุดฟื้นตัว','แกนศิลา · หลบช่องระหว่างแนวฟาด','แกนดารา · เข้าวงในเพื่อหลบคลื่น'][stage]});return true;}
 }
 if(e.motion==='transform'){s.action=undefined;s.stage=0;if(e.motionTime<1.5)return true;h.motion(e,'idle');}
 if(e.motion==='hit'){if(e.motionTime<e.motionDuration)return true;h.motion(e,'idle');}
 if(s.fields){for(const field of s.fields){field.tick-=dt;if(field.until>g.time&&field.tick<=0){field.tick+=1;for(const v of g.players.values())if(!v.dead&&telegraphContains(field.area,v.x,v.z))h.hurt(v,e,field.area.id);}}s.fields=s.fields.filter(v=>v.until>g.time);}
 if(s.recovery){if(s.recovery>g.time)return true;s.recovery=undefined;h.motion(e,'idle');}
 if(s.action){const a=s.action;
  if(e.motion!=='attack'||!e.telegraph){s.action=undefined;s.stage=0;s.openUntil=g.time+2;s.recovery=g.time+.8;g.events.push({type:'warningCancel',id:e.id,x:e.x,z:e.z});for(const f of g.enemies)if(f.summonedBy===e.id&&f.endgame?.focus){f.dead=true;f.rewarded=true;f.deathAge=0;}return true;}
  a.left-=dt;e.windup=Math.max(0,a.left);e.telegraph.left=e.windup;if(a.left>0)return true;
  s.action=undefined;e.telegraph=undefined;const r=a.pattern;let reached=true;
  if(r.kind==='dive'||r.kind==='pair'){
   const dx=a.target.x-e.x,dz=a.target.z-e.z,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.3));
   for(let i=0;i<steps;i++)h.move(e,dx/steps,dz/steps);reached=Math.hypot(e.x-a.target.x,e.z-a.target.z)<.8;
  }
  const areas=a.areas.slice(r.kind==='focus'?s.broken??0:0);
  for(const v of g.players.values())if(!v.dead){const hit=reached&&areas.some(t=>telegraphContains(t,v.x,v.z));if(a.targets.includes(v.id)&&(!hit||v.invulnerable>0&&v.cd.dash>0))lootEvadedWarning(v,g);
   if(hit){const connected=h.hurt(v,e,areas[0]?.id);if(connected&&!v.dead){if(r.slow)v.statuses.push({id:'slow',sourceId:'endgame:'+e.id,remaining:2.5,value:r.slow});if(r.bleed){v.lootEffects??={cooldowns:{},shield:0,shieldFor:0};v.lootEffects.bleed={remaining:3,tick:0,damage:Math.round(g.data.monsters.monsters.find(m=>m.id===e.dataId)!.atk*.09),map:g.mapId};}if(r.kind==='pull'){const distance=Math.hypot(e.x-v.x,e.z-v.z)||1;for(let i=0;i<5;i++)h.movePlayer(v,(e.x-v.x)/distance*.25,(e.z-v.z)/distance*.25);}}}
  }
  if(r.heal&&(!s.broken||r.kind!=='focus'))e.hp=Math.min(e.maxHp,e.hp+Math.round(e.maxHp*r.heal));
  if(r.kind==='trail'){s.fields=areas.map(area=>({area,until:g.time+3,tick:1}));for(const t of areas)g.events.push({type:'warning',id:e.id,attack:t.id,x:t.x,z:t.z,r:t.radius,shape:t.shape,duration:3,name:'พื้นที่อันตราย · '+r.name});}
  if(r.kind==='pair'&&(s.stage??0)+1<(r.count??2)){s.stage=(s.stage??0)+1;s.next=g.time+.55;s.recovery=g.time+.35;}
  else{s.stage=0;s.next=g.time+r.cooldown;s.recovery=g.time+(e.boss?2:1.3);s.openUntil=g.time+(r.kind==='pair'||r.kind==='guard'?2:1.3);}
  for(const t of areas)g.events.push({type:'bossBlast',id:e.id,x:t.x,z:t.z,r:t.radius});
  e.attackApplied=true;return true;
 }
 if(p.dead||d>(e.boss?18:8)||g.time<s.next||e.motion==='attack')return e.boss;
 const r=list[e.dataId==='confluence_worldcore_sovereign'?s.coreStage??0:(e.patternIndex++)%list.length],windup=Math.max(1,r.windup-(e.bossPhase===2?.3:0)),dx=(p.x-e.x)/(d||1),dz=(p.z-e.z)/(d||1),facing=Math.atan2(dz,dx),target={x:p.x,z:p.z};
 let areas:BossTelegraph[]=[];
 const area=(x:number,z:number,radius:number,shape:BossTelegraph['shape']='circle',angle=0,inner=0,theta=facing):BossTelegraph=>({id:'endgame_'+r.kind,nameTh:r.name,x,z,radius,shape,angle,inner,fx:Math.cos(theta),fz:Math.sin(theta),left:windup});
 if(r.kind==='dive'||r.kind==='pair'){if(!clear(target.x,target.z)||!pathSegmentWalkable(e,target,clear))return false;areas=[area(target.x,target.z,r.radius)];}
 else if(r.kind==='ring'||r.kind==='quake')areas=[area(e.x,e.z,r.radius,'ring',0,r.inner??2)];
 else if(r.kind==='trail')areas=Array.from({length:r.count??3},(_,i)=>area(e.x+dx*(i+1)*1.8,e.z+dz*(i+1)*1.8,r.radius));
 else if(r.kind==='fan'||r.kind==='cross')areas=Array.from({length:r.count??3},(_,i)=>area(e.x,e.z,r.radius,'cone',r.angle??30,0,facing+(r.kind==='cross'?i*Math.PI*2/(r.count??3):(i-((r.count??3)-1)/2)*.72)));
 else if(r.kind==='focus'){
  s.broken=0;const count=r.count??1;areas=Array.from({length:count},(_,i)=>r.angle?area(e.x,e.z,r.radius,'cone',r.angle,0,facing+(i-(count-1)/2)*.75):area(target.x+Math.cos(i*2*Math.PI/count)*2,target.z+Math.sin(i*2*Math.PI/count)*2,r.radius));
  for(let i=0;i<count;i++){
   const theta=facing+(i-(count-1)/2)*.85,x=e.x+Math.cos(theta)*3.5,z=e.z+Math.sin(theta)*3.5;
   if(!clear(x,z)){s.broken++;continue;}
   const focus=h.spawn(x,z,'endgame_focus',e.id);focus.endgame={next:Infinity,focus:true,expires:g.time+windup+.3};focus.hp=focus.maxHp=Math.round(180+g.data.monsters.monsters.find(m=>m.id===e.dataId)!.level*3);focus.rewarded=true;
  }
 }else if(r.kind==='split'){
  const real=e.id%3;areas=[area(target.x+(real-1)*2,target.z,r.radius)];for(let i=0;i<3;i++)g.events.push({type:'yokai_echo',id:e.id,x:e.x+(i-1)*3,z:e.z+1,r:1.5,duration:windup});
 }else if(r.kind==='retreat'){
  const x=e.x-dx*2,z=e.z-dz*2;if(clear(x,z)&&pathSegmentWalkable(e,{x,z},clear)){h.move(e,-dx*2,-dz*2);}areas=[area(target.x,target.z,r.radius)];
 }else areas=[area(e.x,e.z,r.radius,r.angle||r.kind==='pull'?'cone':'circle',r.angle??45)];
 e.fx=dx;e.fz=dz;e.windup=windup;e.motionDuration=windup+.7;e.cooldown=windup+1.3;e.telegraph=areas[0];h.motion(e,'attack');
 s.action={pattern:r,areas,left:windup,target,targets:[...g.players.values()].filter(v=>!v.dead&&areas.some(t=>telegraphContains(t,v.x,v.z))).map(v=>v.id)};s.next=g.time+windup+r.cooldown;
 for(const t of areas)g.events.push({type:'warning',id:e.id,attack:t.id,x:t.x,z:t.z,r:t.radius,shape:t.shape,inner:t.inner,angle:t.angle,fx:t.fx,fz:t.fz,duration:windup,name:t.nameTh});
 return true;
}
