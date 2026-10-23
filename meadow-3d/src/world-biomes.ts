import {mountWorldAtlas} from './world-atlas';
import atlas from '../../maps/biome-plan.json';
import {huntList,loadGameData} from '@the-beginning-online/shared';
import type {FieldMapId} from '@the-beginning-online/shared/maps';
import './world-biomes.css';
const data=loadGameData();
const levelLabel=(levels:number[])=>levels[0]===levels[1]?String(levels[0]):levels.join('–');
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const campaignStatus=(ids:readonly string[])=>{
 const regions=ids.map(id=>atlas.biomes.find(b=>b.id===id)!);
 if(regions.every(b=>b.status==='playable'))return 'มีพื้นที่ล่าในเกมแล้ว';
 if(regions.every(b=>b.status==='playable'||b.status==='exploration'))return 'เดินสำรวจได้ · มอนยังไม่เปิดครบ';
 return 'แบบเสนอ';
};
const slotNames:Record<string,string>={weapon:'อาวุธ',armour:'ตัว',garment:'คลุม',footgear:'รองเท้า',shield:'โล่',accessory:'ประดับ'};

export function mountBiomeAtlas(host:HTMLElement,openMap:(id:string)=>void){
 const section=document.createElement('section');section.className='biome-atlas';section.setAttribute('aria-label','ผัง biome และตำนานในโลก');
 const planned=atlas.biomes.filter(b=>b.status!=='playable'),plannedMonsters=planned.reduce((n,b)=>n+(b.monsters?.length??0),0);
 section.innerHTML=`<div class="biome-heading"><div><div class="section-label">WORLD ATLAS / BIOMES & MYTHS</div><h2>ออกจากเมือง · พบโลกคนละแบบ</h2><p>เล่นได้ ${atlas.biomes.length-planned.length} ภูมิภาคถึง Lv.${atlas.playableMaxLevel}${atlas.biomes.some(b=>b.status==='exploration')?' · แมปสำรวจ '+atlas.biomes.filter(b=>b.status==='exploration').length:''}${planned.length?' · รอทำมอน '+planned.length+' ภูมิภาค / '+plannedMonsters+' มอนตามแผน':' · เปิดเส้นทางครบถึง Lv.'+atlas.proposedMaxLevel}</p></div><div class="biome-controls"><label>ช่วงที่ต้องการดู<select class="biome-band"><option value="all">โลกทั้งหมด · Lv.1–100</option><option value="1-49">Lv.1–49 · ภูมิภาคเดิม</option>${atlas.campaignBands.filter(b=>b.levels[0]>=50).map(b=>`<option value="${b.levels[0]}-${b.levels[1]}">Lv.${b.levels[0]===b.levels[1]?b.levels[0]:levelLabel(b.levels)}</option>`).join('')}</select></label><label>เลือก biome<select class="biome-picker" aria-label="เลือก biome">${atlas.biomes.map(b=>`<option value="${b.id}">${esc(b.name)} · ${levelLabel(b.levels)}</option>`).join('')}</select></label></div></div><div class="biome-content"><div class="biome-chart"><div class="biome-painted"></div><p class="biome-caption">ผังแนวคิดการเชื่อมภูมิภาค · ระยะและรูปภูมิประเทศไม่ได้แทนพิกัดเกม</p></div><aside class="biome-detail" aria-live="polite"></aside></div><div class="biome-rules">${atlas.principles.map((p,i)=>`<p><b>0${i+1}</b>${esc(p)}</p>`).join('')}</div>`;
 host.querySelector('main')!.before(section);
 const detail=section.querySelector<HTMLElement>('.biome-detail')!,select=section.querySelector<HTMLSelectElement>('.biome-picker')!,bandSelect=section.querySelector<HTMLSelectElement>('.biome-band')!;
 const painted=mountWorldAtlas(section.querySelector<HTMLElement>('.biome-painted')!,{onSelect:r=>{if(r.id!=='city')show(r.id);}});
 function show(id:string){
  const b=atlas.biomes.find(b=>b.id===id);if(!b)return;
  select.value=id;section.style.setProperty('--chosen-biome',b.colour);
  painted.select(id,false);
  const playable=b.status==='playable',monsters=playable?huntList(b.mapId as FieldMapId,data).map(m=>({name:m.name,level:m.level,rank:m.boss?'boss':data.monsters.monsters.find(spec=>spec.id===m.id)?.tags.includes('elite')?'elite':'normal',behaviour:b.monsters?.find(v=>v.id===m.id)?.behaviour??'',material:b.monsters?.find(v=>v.id===m.id)?.material??'',card:b.monsters?.find(v=>v.id===m.id)?.card??''})):b.monsters??[];
  detail.innerHTML=`<span class="biome-status ${b.status}">${playable?'เล่นได้ในเครื่อง · รอ deploy':b.status==='exploration'?'เดินสำรวจได้ในเครื่อง · มอนและของดรอปยังไม่เปิด':b.id===atlas.nextPriority?'ลำดับถัดไป · ยังไม่มีแมปหรือของดรอปในเกม':'แนวคิด · ยังไม่มีแมปหรือของดรอปในเกม'}</span><h3>${esc(b.name)}</h3><p class="biome-myth">${esc(b.myth)} <span>Lv.${levelLabel(b.levels)}</span></p><p>${esc(b.climate)}</p>${'prototypeNote' in b&&b.prototypeNote?`<p class="biome-access">${esc(b.prototypeNote)}</p>`:''}<dl><dt>เดินทางแบบไหน</dt><dd>${esc(b.travel)}</dd><dt>เหตุผลที่ไปล่า</dt><dd>${esc(b.hunt)}</dd><dt>ภาพจำของภูมิภาค</dt><dd>${esc(b.identity)}</dd><dt>ของล่าประจำ biome</dt><dd>${esc(b.reward)}</dd></dl><p class="biome-access">${esc(b.access)}</p><h4>${playable?'มอนสเตอร์ที่มีอยู่':'มอนสเตอร์ที่เสนอ'}</h4><ul class="biome-monsters">${monsters.map(m=>`<li><div><b>${esc(m.name)}</b><span>Lv.${m.level}${m.rank==='boss'?' · Boss':m.rank==='elite'?' · Elite':''}</span></div>${m.behaviour?`<p>${esc(m.behaviour)}</p><small>วัสดุ: ${esc(m.material)}<br>${playable?'การ์ด':'แนวคิดการ์ด'}: ${esc(m.card)}${'cardSlot' in m?' · ใส่'+(slotNames[String(m.cardSlot)]??'ประดับ'):''}</small>`:''}</li>`).join('')}</ul>${'unique' in b&&b.unique?`<div class="biome-unique"><h4>Unique ประจำบอส · ${playable?'ต้นแบบในเกม':'แบบเสนอ'}</h4><b>${esc(b.unique.name)} · Lv.${b.unique.level}</b><p>${esc(b.unique.effect)}</p><small>ข้อแลกเปลี่ยน: ${esc(b.unique.tradeoff)}<br>จังหวะใช้งาน: ${esc(b.unique.cooldown)}</small></div>`:''}${playable||b.status==='exploration'?'<button class="biome-open" type="button">ดูผัง Tiled ของภูมิภาคนี้ ↓</button>':'<p class="biome-limit">ท่ามอน การ์ด และ Unique ข้างต้นเป็นแบบเสนอ ยังต้องผลิตภาพ เชื่อมระบบ และทดสอบสมดุล</p>'}`;
  detail.querySelector('.biome-open')?.addEventListener('click',()=>openMap(b.mapId!));
 }
 function focusBand(value:string){
  if(value==='all'){painted.reset();return;}
  const [lo,hi]=value.split('-').map(Number);painted.focusRegions(atlas.biomes.filter(b=>b.levels[0]<=hi&&b.levels[1]>=lo).map(b=>b.id));
 }
 bandSelect.addEventListener('change',()=>focusBand(bandSelect.value));
 select.addEventListener('change',()=>{show(select.value);const b=atlas.biomes.find(b=>b.id===select.value)!;const band=atlas.campaignBands.find(c=>c.levels[0]>=50&&c.levels[0]<=b.levels[0]&&c.levels[1]>=b.levels[0]);bandSelect.value=band?band.levels.join('-'):'1-49';focusBand(bandSelect.value);});
 const requested=new URLSearchParams(location.search).get('biome');show(atlas.biomes.some(b=>b.id===requested)?requested!:atlas.biomes.some(b=>b.id===atlas.nextPriority)?atlas.nextPriority:'confluence');
 const roadmap=document.createElement('section');roadmap.className='campaign-roadmap';
 roadmap.innerHTML=`<div class="section-label">CAMPAIGN / Lv.1–100</div><h3>เส้นทางเติบโตและชุดงานผลิต</h3><p>เลือก biome ตามสไตล์และของที่อยากล่า · หิมพานต์เป็นชุดแรก · รวมปล่อยหลังตรวจครบ</p><div class="campaign-table"><table><thead><tr><th>Lv.</th><th>เส้นทางให้เลือก</th><th>เป้าหมายการเล่น</th><th>ชุดอุปกรณ์ที่เสนอ</th></tr></thead><tbody>${atlas.campaignBands.map(b=>`<tr><td>${b.levels[0]===b.levels[1]?b.levels[0]:levelLabel(b.levels)}</td><td>${b.regions.map(id=>atlas.biomes.find(r=>r.id===id)!.name).join(' / ')}<small>${campaignStatus(b.regions)}</small></td><td>${esc(b.goal)}<small>${esc(b.party)}</small></td><td>${esc(b.gearTier)}</td></tr>`).join('')}</tbody></table></div><details><summary>ลำดับผลิตและตรวจสอบก่อนรวม deploy ครั้งเดียว</summary><ol>${atlas.implementationPhases.map(p=>`<li><b>${esc(p.name)}</b><p>${p.deliverables.map(esc).join(' · ')}</p></li>`).join('')}</ol></details><p class="campaign-cap">ระบบปัจจุบัน cap Lv.${atlas.runtimeLevelCap} และสุ่มออฟ item level ${atlas.runtimeItemRollCap} · EXP เต็มเมื่อห่างมอนไม่เกิน 5 ระดับ ลดลงช่วง 6–10 และเป็น 0 เมื่อห่างเกิน 10 · ใช้กับ EXP และ Job EXP</p>`;
 section.append(roadmap);
 return section;
}
