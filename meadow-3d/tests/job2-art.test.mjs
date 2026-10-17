import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const skills=JSON.parse(readFileSync(new URL('../../shared/data/skills.json',import.meta.url))).skills;
test('the twelve Job 2 icons occupy unique cells 12 through 23',()=>{
 const job2=skills.filter(s=>['guardian','berserker'].includes(s.jobId));
 assert.equal(job2.length,12);assert.deepEqual(job2.map(s=>s.icon),Array.from({length:12},(_,i)=>i+12));
 assert.ok(skills.every(s=>s.icon>=0&&s.icon<=23));
});
