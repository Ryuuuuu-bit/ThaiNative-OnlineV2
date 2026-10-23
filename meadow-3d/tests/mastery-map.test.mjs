import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {masteryCamera} from '../src/mastery-camera.ts';
import {masteryAncestors,masteryCurve} from '../src/mastery-paths.ts';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const layout=read('../src/mastery-layout.json'),catalog=read('../../shared/data/mastery.json');

test('live constellation covers the canonical catalog and its prerequisite edges',()=>{
 assert.equal(catalog.skills.length,147);
 assert.deepEqual(Object.keys(layout.nodes).sort(),catalog.skills.map(s=>s.id).sort());
 assert.deepEqual(layout.hubs.map(h=>h.name),[...new Set(catalog.skills.map(s=>s.school))]);
 assert.deepEqual(layout.edges,catalog.skills.flatMap(s=>s.requires.map(r=>({from:r.id,to:s.id,rank:r.rank}))));
 const points=Object.values(layout.nodes);
 for(const p of points){assert.ok(p.x>100&&p.x<3500&&p.y>100&&p.y<3500);}
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
  assert.ok(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>110,'star hit boxes stay separate');
});

test('whole constellation fits both desktop and mobile viewports without clipping',()=>{
 for(const [w,h] of [[650,390],[340,265],[1100,680]]){
  const c=masteryCamera();c.fit(w,h);
  assert.ok(c.state.x>=0&&c.state.y>=0);
  assert.ok(c.state.x+3600*c.state.scale<=w);
  assert.ok(c.state.y+3600*c.state.scale<=h);
 }
});

test('zoom preserves the world point beneath the pointer and respects bounds',()=>{
 const c=masteryCamera();c.focus(1800,1800,640,400,.7);
 const before={x:(200-c.state.x)/c.state.scale,y:(120-c.state.y)/c.state.scale};
 c.zoom(1.25,200,120,640,400);
 assert.ok(Math.abs((200-c.state.x)/c.state.scale-before.x)<1e-9);
 assert.ok(Math.abs((120-c.state.y)/c.state.scale-before.y)<1e-9);
 c.zoom(1e6,320,200,640,400);assert.equal(c.state.scale,1.8);
 c.pan(1e6,-1e6,640,400);
 assert.equal(c.state.x,580);assert.equal(c.state.y,60-3600*1.8);
 c.zoom(1e-6,320,200,640,400);assert.equal(c.state.scale,.04);
 c.bound(320,250);assert.equal(c.state.x,88);assert.equal(c.state.y,53);
});

test('highlighted routes follow actual prerequisites without including siblings or other schools',()=>{
 assert.deepEqual([...masteryAncestors(catalog.skills,'mage_13')],['mage_11','mage_10','mage_01']);
 assert.deepEqual([...masteryAncestors(catalog.skills,'mage_01')],[]);
 assert.deepEqual([...masteryAncestors(catalog.skills,'mage_09')],['mage_07']);
 for(const s of catalog.skills)for(const id of masteryAncestors(catalog.skills,s.id))
  assert.equal(catalog.skills.find(p=>p.id===id).school,s.school);
});

test('curved links retain every edge endpoint and remain in its outward radial range',()=>{
 for(const e of layout.edges){
  const a=layout.nodes[e.from],b=layout.nodes[e.to],before=JSON.stringify([a,b]),curve=masteryCurve(a,b);
  const n=curve.path.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/g).map(Number);
  assert.equal(n.length,8);assert.deepEqual(n.slice(0,2),[a.x,a.y]);assert.deepEqual(n.slice(-2),[b.x,b.y]);
  const low=Math.min(a.radius,b.radius)-.01,high=Math.max(a.radius,b.radius)+.01;
  for(const [x,y] of [[n[2],n[3]],[n[4],n[5]]])assert.ok(Math.hypot(x-1800,y-1800)>=low&&Math.hypot(x-1800,y-1800)<=high);
  assert.ok(Number.isFinite(curve.label.x)&&Number.isFinite(curve.label.y));
  assert.equal(JSON.stringify([a,b]),before);
 }
});
