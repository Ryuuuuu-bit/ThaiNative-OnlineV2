// First snapshot the pre-change shared/dist into .codex-run/rapier-knockback/before/shared.
// Then run --baseline-only before implementation, and run again after server/shared builds.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {cpus} from 'node:os';
import assert from 'node:assert/strict';
const root='.codex-run/rapier-knockback/';
const before=await import('../'+root+'before/shared/src/index.node.js');
const baselineOnly=process.argv.includes('--baseline-only');
let after,physics,wasmImportMs=0;
if(!baselineOnly){after=await import('../shared/dist/src/index.node.js');const t=performance.now();physics=await import('../server/build/realtime/monster-knockback.js');wasmImportMs=performance.now()-t;}
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
const rounds=7,ticks=500,rows=[];
function fixture(api,map,players,rapier,scenario){
 const g=api.createGame(73451,undefined,'bench-0',api.loadGameData(),map);
 let point=map==='meadow'?{x:0,z:4}:api.MAP_ENTRY[map];
 if(scenario==='blocked'){
  const obstacle=api.LAYOUTS[map].obstacles.find(o=>api.walkable(o.x-o.r-1.9,o.z,.3,map)&&api.walkable(o.x-o.r-.5,o.z,.3,map));
  assert.ok(obstacle,'requires a real blocked knockback fixture');point={x:obstacle.x-obstacle.r-1.9,z:obstacle.z};
 }
 const others=g.enemies.filter(e=>!e.boss).slice(0,23);g.enemies=others;
 const target=api.spawn(g,point.x+1.4,point.z);target.hp=target.maxHp=1e9;
 for(let i=1;i<players;i++)api.addPlayer(g,`bench-${i}`);
 for(const p of g.players.values()){p.x=point.x;p.z=point.z;p.hp=p.maxHp=1e6;p.potions=0;}
 if(rapier)g.resolveMonsterKnockback=physics.monsterKnockbackFor(map);
 g.random=()=>.5;
 return {g,point,target};
}
function run(api,map,players,rapier,scenario){
 const {g,point,target}=fixture(api,map,players,rapier,scenario);const times=[];let hits=0;
 for(let n=0;n<ticks+80;n++){
  const t=performance.now();
  if(n%5===0)for(const p of g.players.values()){
   target.x=point.x+1.4;target.z=point.z;target.cooldown=99;target.wander=99;
   p.cd.attack=0;p.attack=0;p.hp=p.maxHp;p.statuses=[];
   api.withPlayer(g,p.id,()=>api.action(g,'attack'));
  }
  api.step(g,.05);
  const ms=performance.now()-t;
  if(n>=80){times.push(ms);hits+=g.events.filter(e=>e.type==='hit'&&e.playerId?.startsWith('bench-')).length;}
  g.events.length=0;
 }
 return {totalMs:times.reduce((a,b)=>a+b,0),p50TickMs:percentile(times,.5),p95TickMs:percentile(times,.95),maxTickMs:Math.max(...times),hits};
}
for(const map of ['meadow','ruins'])for(const [players,scenario] of [[1,'open'],[8,'open'],[32,'open'],[32,'blocked']]){
 const samples={before:[],after:[]};
 run(before,map,players,false,scenario);if(after)run(after,map,players,true,scenario);
 for(let round=0;round<rounds;round++){
  const phases=round%2?['after','before']:['before','after'];
  for(const phase of phases){if(phase==='after'&&!after)continue;samples[phase].push(run(phase==='before'?before:after,map,players,phase==='after',scenario));}
 }
 if(after)assert.equal(samples.after[0].hits,samples.before[0].hits,`${map}/${players}: equal attack workload`);
 const summary={};for(const phase of ['before','after'])if(samples[phase].length){summary[phase]={};for(const field of ['totalMs','p50TickMs','p95TickMs','maxTickMs','hits'])summary[phase][field]=median(samples[phase].map(s=>s[field]));}
 rows.push({map,players,scenario,ticks,summary,samples});console.log(JSON.stringify({map,players,scenario,...summary}));
}
await mkdir(root,{recursive:true});
await writeFile(root+(after?'comparison.json':'before.json'),JSON.stringify({measuredAt:new Date().toISOString(),node:process.version,cpu:cpus()[0]?.model,method:'Authoritative simulation CPU benchmark, not a WebSocket load test. 20 Hz simulation; 24 normal monsters; 1/8/32 players; one forced basic attack/player every 5 ticks. Median of 7 rounds of 500 measured ticks, with 80 warmup ticks; alternating order; identical seeded fixtures and hit counts. Excludes JSON serialization, database and network latency.',wasmImportMs,physics:physics?.knockbackPhysicsStats(),rows},null,2));
