// Offline UAT fixture only. No server connection, persisted characters, or production flag.
import {createGame,spawn,action,step,changeJob,loadGameData} from '@thainative/shared';
import {writeFileSync} from 'node:fs';
if(!process.argv.includes('--dev-fast-job'))throw Error('Explicit offline --dev-fast-job required');
const data=loadGameData(),runs=[];
for(const job of ['guardian','berserker'])for(const spec of data.skills.skills.filter(s=>s.jobId===job&&!s.passive)){
 const g=createGame();g.enemies=[];g.random=()=>.5;g.p.x=0;g.p.z=4;
 // Fast job progression is confined to this in-memory test fixture.
 Object.assign(g.p,{jobId:'swordsman',jobLevel:40});
 Object.assign(g.p,changeJob(g.p,job,data.jobs.angel.x,data.jobs.angel.z,data));
 g.p.skills[spec.id]=1;
 const enemy=spawn(g,1,4);enemy.hp=enemy.maxHp=10000;enemy.wander=100;g.target=enemy.id;
 g.events.length=0;const accepted=action(g,spec.id),events=g.events.splice(0).map(e=>({...e,at:0}));
 for(let i=0;i<40;i++){step(g,1/60);events.push(...g.events.splice(0).filter(e=>e.skillId===spec.id||e.type==='dashTrail').map(e=>({...e,at:g.time})));}
 runs.push({job,skill:spec.id,accepted,events});
}
writeFileSync('.codex-run/job2-contact-events.json',JSON.stringify(runs,null,2)+'\n');
console.log(runs.map(r=>({skill:r.skill,accepted:r.accepted,events:r.events.filter(e=>['skill','hit','skillImpact','dashTrail'].includes(e.type)).map(e=>({type:e.type,at:e.at,hitIndex:e.hitIndex}))})));
