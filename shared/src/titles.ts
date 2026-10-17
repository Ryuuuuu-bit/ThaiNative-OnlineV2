/** Cosmetic titles. PvP definitions stay unavailable until authoritative PvP records exist. */
export type RankingBoard = 'level' | 'hunt';
export interface TitleRecords { bosses: Record<string, number> }
export interface TitleProfile {
 level: number; kills: number; titleId?: string | null;
 unlockedTitles?: string[]; titleRecords?: TitleRecords;
}
export interface TitleDefinition {
 id: string; name: string; category: 'level' | 'hunt' | 'boss' | 'pvp' | 'legend' | 'rank';
 color: string; hint: string; goal: number; metric: 'level' | 'kills' | 'boss' | 'rank' | 'future';
 key?: string; board?: RankingBoard; available: boolean;
}
const countTitle=(id:string,name:string,category:TitleDefinition['category'],metric:TitleDefinition['metric'],goal:number,hint:string,color='#e6c98f',key?:string):TitleDefinition=>
 ({id,name,category,metric,goal,hint,color,key,available:metric!=='future'});
export const TITLES: readonly TitleDefinition[] = [
 countTitle('rookie','ผู้กล้าหน้าใหม่','level','level',1,'สร้างตัวละคร'),
 ...([10,20,30,50,75,99] as const).map((n,i)=>countTitle('lv'+n,['ผู้เลือกทาง','ยอดฝีมือกรุงศรี','ตำนานแห่งกรุงศรี','ผู้พิชิตหิมพานต์','สหายพญานาค','ผู้อยู่เหนือยมโลก'][i],'level','level',n,`ถึงระดับ ${n}`,n===99?'#e7a6ed':'#aed6f1')),
 ...([100,1000,5000] as const).map((n,i)=>countTitle('hunt'+n,['นักล่าแห่งทุ่ง','ยอดนักล่า','ตำนานนักล่า'][i],'hunt','kills',n,`ปราบมอนสเตอร์ ${n.toLocaleString('th-TH')} ตัว`,'#f5b7b1')),
 countTitle('boss_king','ผู้ปราบราชาวุ้น','boss','boss',1,'ปราบราชาวุ้น 1 ครั้ง','#f0b27a','king_jelly'),
 countTitle('boss_warden','ผู้พิชิตป่าหมอก','boss','boss',1,'ปราบผู้เฝ้าป่าหมอก 1 ครั้ง','#a3c99a','mist_warden'),
 ...(['level','hunt'] as const).flatMap(board=>[1,3,10].map((n,i):TitleDefinition=>({
  id:`${board}_top${n}`,name:(board==='level'?['ผู้นำแห่งเส้นทาง','สามยอดผู้กล้า','สิบยอดผู้กล้า']:['ราชันนักล่า','สามยอดนักล่า','สิบยอดนักล่า'])[i],
  category:'rank',metric:'rank',board,goal:n,hint:`${board==='level'?'เลเวล':'จำนวนมอนสเตอร์ที่ปราบ'}อันดับ ${n===1?'1':`1–${n}`} · ถือครองขณะอยู่ในอันดับ`,color:n===1?'#ffd700':'#c6cce6',available:true
 }))),
 ...([1,10,50,200] as const).flatMap((n,i)=>[
  countTitle('duel'+n,['นักประลองหน้าใหม่','ยอดนักประลอง','เซียนเวทีประลอง','ราชันแห่งการดวล'][i],'pvp','future',n,`ชนะดวล ${n} ครั้ง`,'#5dade2'),
  countTitle('redhunt'+n,['ผู้พิทักษ์ธรรม','นักล่าค่าหัว','มือปราบทรชน','ดาบอาญาสิทธิ์'][i],'pvp','future',n,`ปราบผู้เล่นหัวแดง ${n} คน`,'#82e0aa'),
  countTitle('pk'+n,['มือเปื้อนเลือด','ทรชนแห่งพงไพร','ยมทูตเดินดิน','เงาโลหิตแห่งราตรี'][i],'pvp','future',n,`สังหารผู้บริสุทธิ์ ${n} คน`,'#e77474'),
 ]),
 countTitle('merit1000','ผู้ทรงบุญญาธิการ','pvp','future',1000,'สะสมบุญ 1,000','#ffe08a'),
 countTitle('merit10k','ผู้ปราบมารแห่งแผ่นดิน','pvp','future',10000,'สะสมบุญ 10,000','#fff1a8'),
 countTitle('sin2k','ผู้ขายวิญญาณ','pvp','future',2000,'สะสมบาป 2,000','#b03a5b'),
 countTitle('sin10k','บุตรแห่งอเวจี','pvp','future',10000,'สะสมบาป 10,000','#8e2c6e'),
 countTitle('lg_merit50k','ตำนานแห่งธรรม','legend','future',50000,'สะสมบุญ 50,000','#fff4c2'),
 countTitle('lg_sin50k','จ้าวแห่งกาลียุค','legend','future',50000,'สะสมบาป 50,000','#c276e8'),
];
export const titleDefinition=(id:unknown)=>TITLES.find(t=>t.id===id);
export function normalizeTitleRecords(raw: unknown): TitleRecords {
 const bosses:Record<string,number>={};
 const values=(raw as Partial<TitleRecords>|null)?.bosses;
 for(const id of ['king_jelly','mist_warden']){
  const n=values?.[id];if(typeof n==='number'&&Number.isSafeInteger(n)&&n>0)bosses[id]=n;
 }
 return {bosses};
}
export function titleProgress(t:TitleDefinition,p:TitleProfile,ranks:Partial<Record<RankingBoard,number>>={}) {
 if(!t.available)return 0;
 if(t.metric==='rank'){const r=t.board&&ranks[t.board];return r&&r<=t.goal?1:0;}
 return Math.min(t.goal,t.metric==='level'?p.level:t.metric==='kills'?p.kills:t.metric==='boss'?(p.titleRecords?.bosses[t.key!]??0):0);
}
export function canWearTitle(t:TitleDefinition,p:TitleProfile,ranks:Partial<Record<RankingBoard,number>>={}) {
 if(!t.available)return false;
 if(t.metric==='rank')return titleProgress(t,p,ranks)===1;
 return p.unlockedTitles?.includes(t.id)||titleProgress(t,p,ranks)>=t.goal;
}
export function earnTitles(p:TitleProfile) {
 const owned=new Set((p.unlockedTitles??[]).filter(id=>{const t=titleDefinition(id);return t?.available&&t.metric!=='rank';}));
 const earned=TITLES.filter(t=>t.available&&t.metric!=='rank'&&!owned.has(t.id)&&titleProgress(t,p)>=t.goal);
 for(const t of earned)owned.add(t.id);
 p.unlockedTitles=[...owned];return earned;
}
export interface RankingCharacter extends TitleProfile { id:string; name:string; jobId:string; xp:number }
export function compareRankings(board:RankingBoard,a:RankingCharacter,b:RankingCharacter) {
 return (board==='level'?b.level-a.level||b.xp-a.xp:b.kills-a.kills||b.level-a.level||b.xp-a.xp)||a.id.localeCompare(b.id);
}
