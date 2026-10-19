// Capture shared/dist/src/game/maps.js BEFORE editing into the baseline path below,
// resolving its city-details import to an absolute file URL. Never recapture after the change.
// Run: node scripts/benchmark-obstacle-collision.mjs [--baseline-only]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {cpus} from 'node:os';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const directory = resolve('.codex-run/rbush-collision');
const baseline = await import(pathToFileURL(resolve(directory, 'baseline-maps.mjs')).href);
const candidate = process.argv.includes('--baseline-only') ? null : await import('../shared/dist/src/game/maps.js');
const maps = ['city_plaza', 'meadow', 'forest', 'ruins', 'canyon'];
const name = map => map === 'city_plaza' ? 'cityWalkable' : `${map}Walkable`;
let seed = 92173;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
const rounds = 9, repeats = 6, count = 12000;
let sink = 0;
function run(fn, queries) {
 const start = performance.now(); let hits = 0;
 for (let i = 0; i < repeats; i++) for (const q of queries) hits += +fn(q.x, q.z, q.r);
 sink += hits;
 return performance.now() - start;
}
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length/2)];
const results = [];
for (const map of maps) {
 const layout = baseline.LAYOUTS[map];
 if (candidate) assert.deepEqual(candidate.LAYOUTS[map], layout, `${map}: layouts and deterministic spawns unchanged`);
 for (const workload of ['movement', 'wide-radius']) {
  const queries = Array.from({length:count}, (_,i) => ({
   x:(random()*2-1)*layout.halfX, z:(random()*2-1)*layout.halfZ,
   r:workload === 'movement' ? [0.3,0.4,0.65][i%3] : [2.5,2.500001,4,8][i%4],
  }));
  // Include collision boundaries as well as uniformly distributed points.
  const circles = map === 'city_plaza' ? [...baseline.CITY_PLANTERS, ...baseline.GARDEN_TREES.map(t=>({...t,r:.55}))]
   : [...layout.obstacles, ...(map === 'meadow' ? baseline.MEADOW_LANDMARKS.circles : [])];
  const edgeQueries = [];
  for (const o of circles) for (const r of [0,.3,.4,2.5,3,8]) for (const epsilon of [-1e-8,0,1e-8])
   edgeQueries.push({x:o.x+o.r+r+epsilon,z:o.z,r});
  const before = baseline[name(map)], after = candidate?.[name(map)];
  if (after) for (const q of [...queries,...edgeQueries]) assert.equal(after(q.x,q.z,q.r),before(q.x,q.z,q.r),`${map}/${workload} ${JSON.stringify(q)}`);
  for(let i=0;i<3;i++){run(before,queries);if(after)run(after,queries);}
  const oldTimes=[],newTimes=[];
  for(let i=0;i<rounds;i++) {
   // Alternate order to reduce the effect of CPU frequency drift.
   if(i%2&&after){newTimes.push(run(after,queries));oldTimes.push(run(before,queries));}
   else{oldTimes.push(run(before,queries));if(after)newTimes.push(run(after,queries));}
  }
  const oldMs=median(oldTimes),newMs=after?median(newTimes):null;
  const row={map,workload,queriesPerRound:queries.length*repeats,beforeMs:oldMs,afterMs:newMs,speedup:newMs?oldMs/newMs:null,beforeSamplesMs:oldTimes,afterSamplesMs:newTimes};
  results.push(row);
  console.log(`${map.padEnd(11)} ${workload.padEnd(11)} before=${oldMs.toFixed(2)}ms${newMs===null?'':` after=${newMs.toFixed(2)}ms speedup=${row.speedup.toFixed(2)}x`} (${row.queriesPerRound} queries)`);
 }
}
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,candidate?'comparison.json':'before.json'),JSON.stringify({
 timestamp:new Date().toISOString(),node:process.version,platform:process.platform,arch:process.arch,
 cpu:cpus()[0]?.model,
 baselineSha256:createHash('sha256').update(await readFile(resolve(directory,'baseline-maps.mjs'))).digest('hex'),
 method:'Single-process warmed microbenchmark; median of 9 rounds; alternating order; identical seeded queries; exact result and layout parity asserted. Not an FPS or concurrency benchmark.',
 sink,results,
},null,2));
