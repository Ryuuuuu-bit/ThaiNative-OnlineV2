import type {Game,Player,Enemy} from './sim.js';
import {restoreMasteryHp} from './mastery-training.js';
import type {Skill} from '../schema.js';
export interface EndgameLootState {
 map:string;walk:number;still:number;lastX:number;lastZ:number;lastPotion:number;wasSlow:boolean;
 target?:number;hits:number;killTarget?:number;lastHitAt?:number;lastType?:string;typeCount:number;lastElement?:string;elements:string[];lastSkill?:string;skillTypes:string[];
 lastHeal?:{id:string;at:number};supportTypes:string[];role?:string;roleUntil?:number;roleCd?:number;
 statusTargets:Record<string,string[]>;counts:Record<string,{target:number;hits:number}>;focusHits?:{at:number;ids:number[];eligible:boolean};
}
const loot=(p:Player)=>p.lootEffects??={cooldowns:{},shield:0,shieldFor:0};
const state=(p:Player)=>{
 const l=loot(p);if(!l.endgame||l.endgame.map!==p.mapId)l.endgame={map:p.mapId,walk:0,still:0,lastX:p.x,lastZ:p.z,lastPotion:-100,wasSlow:false,hits:0,typeCount:0,elements:[],skillTypes:[],supportTypes:[],statusTargets:{},counts:{}};
 return l.endgame;
};
const card=(p:Player,id:string)=>!!p.inventory?.items.some(i=>i.location==='equip'&&i.cards.includes('card_'+id));
const unique=(p:Player,id:string)=>!!p.inventory?.items.some(i=>i.location==='equip'&&i.template==='unique_'+id+'_relic'&&i.roll?.quality==='unique');
const active=(p:Player,k:string)=>(loot(p).cooldowns['end:'+k]??0)>0;
const charge=(p:Player,k:string,t:number)=>{loot(p).cooldowns['end:'+k]=t;};
const trigger=(p:Player,k:string,t:number)=>{if(active(p,k))return false;charge(p,k,t);return true;};
const spend=(p:Player,k:string)=>{charge(p,k,0);};
function combo(p:Player,key:string,target:number,count:number){const s=state(p);let c=s.counts[key];if(!c||c.target!==target)c=s.counts[key]={target,hits:0};if(++c.hits<count)return false;c.hits=0;return true;}
const restore=(p:Player,n:number)=>{if(!p.dead)p.mp=Math.min(p.maxMp,p.mp+n);};
const heal=(g:Game,p:Player,n:number)=>{const amount=restoreMasteryHp(p,n);if(amount>0)g.events.push({type:'heal',playerId:p.id,x:p.x,z:p.z,amount:Math.round(amount)});};
const shield=(g:Game,p:Player,key:string,percent=.02,duration=3,owner:Player=p)=>{if(owner.id!==p.id&&card(owner,'ocean_mist_isle_siren'))duration*=1.05;const l=loot(p);l.partyShields=[...(l.partyShields??[]).filter(s=>s.source!==key||s.owner!==owner.id),{amount:Math.max(1,Math.round(p.maxHp*percent)),remaining:duration,source:key,owner:owner.id,map:g.mapId}];g.events.push({type:'item_proc',playerId:p.id,x:p.x,z:p.z,text:'เกราะรอยต่อ',duration});};
const allies=(g:Game,p:Player)=>(g.partyMembers?.(p.id)??[p.id]).map(id=>g.players.get(id)).filter((a):a is Player=>!!a&&!a.dead&&a.mapId===g.mapId&&Math.hypot(a.x-p.x,a.z-p.z)<=6);
const poisoned=(e:Enemy)=>e.itemPoisons?.some(v=>!v.bleed&&!v.burn&&v.remaining>0);
const bleeding=(e:Enemy)=>e.itemPoisons?.some(v=>v.bleed&&v.remaining>0);
const burning=(e:Enemy)=>e.itemPoisons?.some(v=>v.burn&&v.remaining>0);
function role(g:Game,p:Player,next:string){
 const s=state(p),withCard=card(p,'confluence_worldcore_sovereign'),withUnique=unique(p,'confluence');
 if(!withCard&&!withUnique||s.role===next||g.time<(s.roleCd??0))return;
 s.role=next;s.roleUntil=g.time+5;s.roleCd=g.time+20;charge(p,'role_buff',5);
 g.events.push({type:'item_proc',playerId:p.id,x:p.x,z:p.z,text:'รอยต่อ · '+({attack:'โจมตี',support:'สนับสนุน',guard:'ป้องกัน'}[next]??next)});
}
export function endgameTick(g:Game,p:Player,dt:number){
 const s=state(p),moved=p.moving||Math.hypot(p.x-s.lastX,p.z-s.lastZ)>.01;
 s.walk=moved?s.walk+dt:0;s.still=moved?0:s.still+dt;s.lastX=p.x;s.lastZ=p.z;
 if(p.dead){s.walk=s.still=0;s.hits=0;s.elements=[];s.skillTypes=[];s.role=undefined;return;}
 if(card(p,'dragon_cloud_carp')&&s.walk>=3&&trigger(p,'carp_cd',8)){charge(p,'carp',5);s.walk=0;}
 if(card(p,'dragon_jade_gatekeeper')&&s.still>=2&&p.statuses.some(v=>v.id==='guard')&&trigger(p,'jade_cd',12))shield(g,p,'jade_card');
 const slow=p.statuses.some(v=>v.id==='slow');if(s.wasSlow&&!slow&&card(p,'ocean_whirlpool_lanternfish')&&trigger(p,'fish_cd',10))charge(p,'water_resist',3);s.wasSlow=slow;
 if(card(p,'astral_vacuum_bell_construct')&&g.time-s.lastPotion>=10)p.mp=Math.min(p.maxMp,p.mp+dt*.3);
 if(card(p,'fae_false_garden_root'))for(const status of p.statuses)if(status.id==='slow')status.remaining=Math.max(0,status.remaining-dt*(1/.9-1));
 if(card(p,'volcano_red_smoke_shroom')&&p.lootEffects?.venom)p.lootEffects.venom.remaining=Math.max(0,p.lootEffects.venom.remaining-dt*(1/.9-1));
 if(p.lootEffects?.bleed&&card(p,'abyss_silt_mudskipper'))p.lootEffects.bleed.remaining=Math.max(0,p.lootEffects.bleed.remaining-dt*.15/.85);
}
export function endgameAccuracy(p:Player,e?:Enemy){
 let n=active(p,'carp')&&card(p,'dragon_cloud_carp')?15:0;
 if(active(p,'moth_hit')&&card(p,'fae_wandering_light_moth'))n+=10;
 if(e&&bleeding(e)&&card(p,'volcano_ash_spine_boar'))n+=12;
 if(e&&new Set([...e.statuses.map(v=>v.id),...(poisoned(e)?['poison']:[]),...(bleeding(e)?['bleed']:[])]).size>=2&&card(p,'astral_meteor_ring_serpent'))n+=15;
 return n;
}
export function endgameDamage(g:Game,p:Player,e:Enemy,skillId:string,damage:number,crit:boolean,sourceSkill?:Skill){
 if(damage<=0)return 0;
 const s=state(p),skill=sourceSkill??g.data.skills.skills.find(v=>v.id===skillId),type=skill?.type==='magic'?'magic':'physical',element=skill?.element&&skill.element!=='weapon'?skill.element:p.stats.weaponElement,basic=skillId==='basic',oldTarget=s.target;
 if(g.time-(s.lastHitAt??g.time)>6){s.typeCount=0;s.lastType=undefined;s.lastElement=undefined;s.elements=[];s.hits=0;}s.lastHitAt=g.time;
 let mult=1;
 if(s.target!==e.id){s.target=e.id;s.hits=0;}
 s.hits++;
 if(basic)spend(p,'carp');
 if(e.hp/e.maxHp>.8&&(e.dataId.includes('guard')||e.dataId.includes('keeper'))&&card(p,'dragon_stone_liondog'))mult*=1.05;
 if(type==='magic'&&active(p,'bell_magic')&&card(p,'dragon_bell_drake'))mult*=1.04;
 if(active(p,'tiger')&&card(p,'dragon_white_cloud_tiger')){mult*=1.08;spend(p,'tiger');}
 if(element==='fire'&&card(p,'volcano_lava_glass_lizard')&&trigger(p,'lizard:'+e.id,10))mult*=1.06;
 if(element==='fire'&&active(p,'firebird')&&card(p,'volcano_azure_firebird'))mult*=1.05;
 if(basic&&active(p,'hammer')&&card(p,'volcano_crater_hammer_ogre')){mult*=1.1;spend(p,'hammer');}
 if(type==='magic'&&e.statuses.length&&card(p,'fae_wandering_light_moth')&&trigger(p,'moth_cd',8))charge(p,'moth_hit',3);
 if(basic&&card(p,'fae_moondrop_mirrorfae')&&trigger(p,'mirror_cd',8))charge(p,'mirror',5);
 else if(type==='magic'&&active(p,'mirror')&&card(p,'fae_moondrop_mirrorfae')){mult*=1.05;spend(p,'mirror');}
 if(type==='magic'&&card(p,'fae_violet_banshee')&&trigger(p,'banshee_cd',10))charge(p,'magic_resist',3);
 if(active(p,'dullahan')&&card(p,'fae_silverchain_dullahan')){e.statuses.push({id:'mdef_down',sourceId:'dullahan:'+p.id,remaining:3,value:.04});spend(p,'dullahan');}
 if(basic&&card(p,'ocean_mast_crab')&&combo(p,'crab',e.id,3)&&trigger(p,'crab_cd',10))charge(p,'crab_speed',3);
 if(card(p,'ocean_sunken_coral_knight')&&(skill?.kind==='area'||(p.landings??[]).some(l=>Math.hypot(e.x-l.x,e.z-l.z)<=3)||(loot(p).pool&&Math.hypot(e.x-loot(p).pool!.x,e.z-loot(p).pool!.z)<=2)))mult*=1.05;
 if(card(p,'ocean_sixhead_reef_scylla')){let h=s.focusHits;if(!h||g.time-h.at>.15)h=s.focusHits={at:g.time,ids:[e.id],eligible:!active(p,'scylla_cd')};else if(!h.ids.includes(e.id)){h.ids.push(e.id);if(h.eligible&&h.ids.length===2){restore(p,2);charge(p,'scylla_cd',10);}else if(h.eligible&&h.ids.length===3)restore(p,1);}}
 if(card(p,'ocean_stormcrown_kraken')&&combo(p,'kraken',e.id,6)&&trigger(p,'kraken_cd',12))damage+=p.stats.atk*.08;
 if(type==='magic'&&active(p,'jellyfish')&&card(p,'astral_stardust_jellyfish')){mult*=1.05;spend(p,'jellyfish');}
 if(type==='magic'&&s.lastElement!==undefined&&s.lastElement!==element&&card(p,'astral_stardust_jellyfish')&&trigger(p,'jellyfish_cd',8))charge(p,'jellyfish',5);
 if(s.lastType!==undefined&&s.lastType!==type&&card(p,'astral_constellation_crane')&&trigger(p,'star_crane',6))restore(p,2);
 if(basic&&active(p,'sunlion')&&card(p,'astral_solarshadow_lion')){mult*=1.1;spend(p,'sunlion');}
 s.typeCount=s.lastType&&s.lastType!==type?s.typeCount+1:1;s.lastType=type;
 if(s.typeCount>=4&&card(p,'astral_star_eating_eclipse')&&trigger(p,'eclipse_cd',15)){charge(p,'eclipse_damage',4);s.typeCount=0;}
 if(active(p,'eclipse_damage')&&card(p,'astral_star_eating_eclipse'))mult*=1.05;
 if(poisoned(e)&&card(p,'abyss_black_salt_crab'))mult*=1.05;
 if(active(p,'clay_melee')&&type==='physical'&&Math.hypot(e.x-p.x,e.z-p.z)<=3&&card(p,'abyss_ziggurat_clay_guard'))mult*=1.04;
 if(crit&&bleeding(e)&&card(p,'abyss_anzu_lionbird')&&trigger(p,'anzu_cd',10))heal(g,p,p.maxHp*.01);
 if(oldTarget!==undefined&&oldTarget!==e.id&&card(p,'confluence_starshadow_pillar_guard')&&trigger(p,'starshadow_cd',8))restore(p,2);
 if(unique(p,'dragon')){mult*=.94;if(active(p,'qilin_chain')&&trigger(p,'qilin_cd',12)){spend(p,'qilin_chain');for(const target of g.enemies.filter(v=>!v.dead&&v.id!==e.id&&!v.endgame?.focus&&Math.hypot(v.x-e.x,v.z-e.z)<=4).slice(0,3))target.itemPoisons=[...(target.itemPoisons??[]),{owner:p.id,remaining:1,tick:0,damage:Math.round(p.stats.atk*.12),sourceUnique:'unique_dragon_relic'}];}}
 if(unique(p,'volcano')&&trigger(p,'ember:'+e.id,6)){e.itemPoisons=[...(e.itemPoisons??[]).filter(v=>v.owner!==p.id||!v.burn),{owner:p.id,remaining:3,tick:0,damage:Math.round(p.stats.atk*.06),burn:true,sourceUnique:'unique_volcano_relic'}];}
 if(unique(p,'volcano')&&p.hp<p.maxHp*.5&&element==='fire')mult*=1.08;
 if(unique(p,'ocean')&&combo(p,'anchor',e.id,5)&&trigger(p,'anchor_cd',12)){for(const target of g.enemies.filter(v=>!v.dead&&Math.hypot(v.x-e.x,v.z-e.z)<=2.5)){target.statuses.push({id:target.boss?'slow':'root',sourceId:p.id,remaining:1,value:target.boss?.25:1});endgameStatus(g,p,target);}g.events.push({type:'item_pool',playerId:p.id,x:e.x,z:e.z,r:2.5,duration:1});}
 if(unique(p,'astral')&&type==='magic'){
  if(s.lastElement!==element){s.elements.push(element);s.elements=s.elements.slice(-3);}
  if(new Set(s.elements).size===3&&trigger(p,'astral_cd',15)){charge(p,'astral_element:'+element,5);s.elements=[];}
  const chosen=Object.entries(loot(p).cooldowns).find(([k,v])=>k.startsWith('end:astral_element:')&&v>0)?.[0].split(':').at(-1);if(chosen)mult*=chosen===element?1.08:.96;
 }
 s.lastElement=element;
 if(unique(p,'abyss')){mult*=.93;const effects=e.itemPoisons?.filter(v=>v.owner===p.id&&!v.burn);if(effects?.some(v=>v.bleed)&&effects.some(v=>!v.bleed)&&trigger(p,'abyss_cd',10))for(const v of effects)if(!v.refreshed){v.remaining=Math.max(v.remaining,3);v.refreshed=true;}}
 role(g,p,'attack');if(s.role==='attack'&&(s.roleUntil??0)>g.time)mult*=unique(p,'confluence')?1.08:1.04;
 return Math.round(damage*mult);
}
export function endgameEvade(g:Game|undefined,p:Player){
 if(card(p,'dragon_jade_crane')&&trigger(p,'crane_cd',8))restore(p,2);
 if(card(p,'dragon_white_cloud_tiger')&&trigger(p,'tiger_cd',8))charge(p,'tiger',5);
 if(card(p,'astral_orbital_ray')&&trigger(p,'ray_cd',10))charge(p,'ray_cast',5);
}
export function endgameInterrupt(g:Game|undefined,p:Player,e?:Enemy){
 if(card(p,'fae_silverchain_dullahan')&&trigger(p,'dullahan_cd',12))charge(p,'dullahan',5);
 if(card(p,'confluence_thunder_pillar_guard')&&trigger(p,'thunder_cd',12))charge(p,'physical_resist',4);
 if(g&&e?.boss&&card(p,'dragon_cloud_dragon_lord')&&trigger(p,'dragonlord_cd',15))for(const a of allies(g,p))a.statuses.push({id:'speed',sourceId:'dragonlord:'+p.id,remaining:3*(a.id!==p.id&&card(p,'ocean_mist_isle_siren')?1.05:1),value:.08});
}
export function endgameGuard(g:Game,p:Player,e:Enemy|undefined,heavy:boolean){
 if(heavy&&card(p,'volcano_crater_hammer_ogre')&&trigger(p,'hammer_cd',10))charge(p,'hammer',5);
 if(card(p,'abyss_blackstone_lamassu')&&trigger(p,'lamassu_cd',20)){if(p.lootEffects)delete p.lootEffects.venom;}
 role(g,p,'guard');
}
export function endgameIncoming(p:Player,damage:number,element:string|undefined,ranged:boolean,magic:boolean){
 let factor=1;if(damage<=0)return damage;
 if(ranged&&state(p).still>0&&card(p,'ocean_storm_conch'))factor*=.96;
 if(element==='wind'&&active(p,'qilin_resist')&&card(p,'dragon_sky_qilin'))factor*=.92;
 if(element==='water'&&active(p,'water_resist')&&card(p,'ocean_whirlpool_lanternfish'))factor*=.92;
 if(magic&&active(p,'magic_resist')&&card(p,'fae_violet_banshee'))factor*=.95;
 if(!magic&&active(p,'physical_resist')&&card(p,'confluence_thunder_pillar_guard'))factor*=.96;
 if(active(p,'all_resist')&&card(p,'astral_twelve_star_knight'))factor*=.97;
 if(!ranged&&!magic&&active(p,'beetle_melee')&&card(p,'volcano_ash_boulder_beetle')){factor*=.95;spend(p,'beetle_melee');}
 if(element==='fire'&&card(p,'volcano_ash_boulder_beetle')&&trigger(p,'beetle_cd',8))charge(p,'beetle_melee',5);
 const s=state(p);if(s.role==='guard'&&active(p,'role_buff'))factor*=unique(p,'confluence')?.92:.96;
 return Math.round(damage*factor);
}
export function endgameKill(g:Game,p:Player,e:Enemy){
 if(e.endgame?.focus){if(card(p,'dragon_bell_drake')&&trigger(p,'bell_cd',10))charge(p,'bell_magic',3);return;}
 if(e.summoned)return;
 if(card(p,'fae_puca_shadowhorse'))state(p).killTarget=e.id;
 if(burning(e)&&card(p,'volcano_golden_ash_zmey')&&trigger(p,'zmey_cd',10))shield(g,p,'zmey_card');
 if(poisoned(e)&&bleeding(e)&&card(p,'abyss_primordial_sea_dragon')&&trigger(p,'sea_dragon_cd',15))restore(p,p.maxMp*.03);
}
export function endgamePotion(g:Game,p:Player,kind:string){
 state(p).lastPotion=g.time;if(kind==='hp'&&card(p,'volcano_azure_firebird')&&trigger(p,'firebird_cd',12))charge(p,'firebird',3);
}
export function endgameHeal(g:Game,p:Player,target:Player,amount:number,before:number){
 if(amount<=0||p.id===target.id)return;
 if(card(target,'dragon_sky_qilin')&&trigger(target,'qilin_resist_cd',10))charge(target,'qilin_resist',3);
 if(card(p,'fae_moonlichen_stag')){const last=state(p).lastHeal;if(last?.id===target.id&&g.time-last.at<=4)charge(p,'stag_discount',4);state(p).lastHeal={id:target.id,at:g.time};}
 if(before<target.maxHp*.3&&card(p,'confluence_life_pillar_guard')&&trigger(p,'life_cd',15))shield(g,target,'life_card',.02,3,p);
 role(g,p,'support');const s=state(p);if(s.role==='support'&&(s.roleUntil??0)>g.time)heal(g,target,amount*(unique(p,'confluence')?.08:.04));
}
export function endgameSkillCost(p:Player,base:number,skillId?:string){
 const s=state(p);let factor=1;
 if(base>0&&s.killTarget!==undefined&&p.target!==null&&p.target!==s.killTarget&&card(p,'fae_puca_shadowhorse')&&trigger(p,'puca_cd',8)){charge(p,'puca_discount',5);s.killTarget=undefined;}
 if(active(p,'puca_discount')&&card(p,'fae_puca_shadowhorse'))factor*=.95;
 if(active(p,'stag_discount')&&card(p,'fae_moonlichen_stag'))factor*=.95;
 if(unique(p,'fae')&&skillId&&s.lastSkill===skillId)factor*=1.04;
 return base*factor;
}
export function endgameSkillSpent(g:Game,p:Player,skill:Skill){
 const s=state(p);if(skill.sp>0){spend(p,'puca_discount');spend(p,'stag_discount');}

 const kind=skill.type==='heal'||skill.kind==='utility'||!skill.percent?'support':skill.kind==='area'?'area':'single';
 if(s.lastSkill!==skill.id){s.skillTypes.push(kind);s.skillTypes=s.skillTypes.slice(-3);}
 if(unique(p,'fae')&&new Set(s.skillTypes).size===3&&trigger(p,'fae_cd',12)){restore(p,p.maxMp*.04);s.skillTypes=[];}
 if(card(p,'astral_solarshadow_lion')&&s.lastSkill&&s.lastSkill!==skill.id&&trigger(p,'sunlion_cd',10))charge(p,'sunlion',5);
 s.lastSkill=skill.id;
 if(kind==='support'){
  if(unique(p,'dragon'))charge(p,'qilin_chain',5);
  const supportType=skill.effect??skill.id;
  if(card(p,'astral_twelve_star_knight')){if(!s.supportTypes.includes(supportType))s.supportTypes.push(supportType);if(s.supportTypes.length>=2&&trigger(p,'knight_cd',15)){charge(p,'all_resist',4);s.supportTypes=[];}}
  role(g,p,'support');
 }
}
export function endgameCast(p:Player,seconds:number,maxReduction=.5){let bonus=1;if(seconds>0&&active(p,'ray_cast')&&card(p,'astral_orbital_ray')){spend(p,'ray_cast');bonus=.95;}return seconds*Math.max(1-maxReduction,p.stats.castMul*bonus);}
export function endgameAttackInterval(p:Player,n:number){return n*(active(p,'crab_speed')&&card(p,'ocean_mast_crab')?1/1.03:1)*(unique(p,'ocean')?1/.97:1);}
export function endgameStatus(g:Game,p:Player,e:Enemy){
 const types=[...new Set<string>([...e.statuses.filter(v=>v.sourceId===p.id).map(v=>v.id),...(e.itemPoisons??[]).filter(v=>v.owner===p.id&&v.remaining>0).map(v=>v.burn?'burn':v.bleed?'bleed':'poison')])];if(!types.length)return;
 if(card(p,'abyss_ziggurat_clay_guard')&&trigger(p,'clay_cd',8))charge(p,'clay_melee',3);
 if(types.some(v=>v==='root'||v==='stun')&&card(p,'ocean_shipwreck_colossus')&&trigger(p,'wreck_cd',12))shield(g,p,'wreck_card');
 if(card(p,'fae_twilight_antler_king')){const s=state(p);s.statusTargets[e.id]=[...new Set([...(s.statusTargets[e.id]??[]),...types])];if(s.statusTargets[e.id].length>=2&&trigger(p,'antler_cd',15)){restore(p,p.maxMp*.03);delete s.statusTargets[e.id];}for(const key of Object.keys(s.statusTargets).slice(0,-32))delete s.statusTargets[key];}
}
export function endgameDot(p:Player,e:Enemy,damage:number,burn:boolean){return damage*(burn&&card(p,'volcano_old_kiln_sprite')?1.05:1)*(burn&&unique(p,'volcano')&&p.hp<p.maxHp*.5?1.08:1)*(poisoned(e)&&bleeding(e)&&card(p,'abyss_night_border_scorpion')?1.05:1);}
