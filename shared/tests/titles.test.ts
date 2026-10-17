import test from 'node:test';
import assert from 'node:assert/strict';
import { TITLES, earnTitles, canWearTitle, titleDefinition, normalizeTitleRecords, compareRankings, IntentSchema } from '../src/index.node.js';

test('earned cosmetic titles persist; PvP remains locked even with forged saved ownership',()=>{
 const p={level:10,kills:100,titleRecords:{bosses:{king_jelly:1}},unlockedTitles:['duel200']};
 const earned=earnTitles(p).map(t=>t.id);
 for(const id of ['rookie','lv10','hunt100','boss_king'])assert.ok(earned.includes(id));
 assert.ok(!p.unlockedTitles.includes('duel200'));assert.deepEqual(earnTitles(p),[]);
 p.level=1;p.kills=0;assert.ok(canWearTitle(titleDefinition('lv10')!,p));
 for(const t of TITLES.filter(t=>t.metric==='future'))assert.equal(canWearTitle(t,{...p,unlockedTitles:[t.id]}),false);
 assert.equal(new Set(TITLES.map(t=>t.id)).size,TITLES.length);
});
test('rank titles follow current positions and cannot be retained through saved unlocks',()=>{
 const t=titleDefinition('level_top1')!,p={level:1,kills:0,unlockedTitles:[t.id]};
 assert.ok(canWearTitle(t,p,{level:1}));assert.equal(canWearTitle(t,p,{level:2}),false);
 assert.equal(canWearTitle(t,p),false);earnTitles(p);assert.deepEqual(p.unlockedTitles,['rookie']);
});
test('title records sanitize unknown bosses and bad counters; ranking ties are deterministic',()=>{
 assert.deepEqual(normalizeTitleRecords({bosses:{king_jelly:2,mist_warden:-1,unknown:99}}),{bosses:{king_jelly:2}});
 const a={id:'a',name:'A',jobId:'swordsman',level:2,xp:10,kills:1},b={...a,id:'b'};
 assert.ok(compareRankings('level',a,b)<0);assert.ok(compareRankings('hunt',a,b)<0);
 assert.ok(compareRankings('level',{...a,xp:11},b)<0);
 for(const body of [{t:'titleEquip',id:'rookie',kills:999},{t:'titles',unlocked:['duel200']},{t:'rankings',board:'pvp'}])assert.equal(IntentSchema.safeParse(body).success,false);
 assert.ok(IntentSchema.safeParse({t:'titleEquip',id:null}).success);
});
