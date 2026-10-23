import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_LAYOUT,CITY_COLLISION,CITY_BUILDINGS,HEALER,cityWalkable,cityLayoutGeometry} from '@the-beginning-online/shared/maps';
import {parseDraft} from '../src/city-layout-model.ts';
import {route} from '../src/city-2d-layout.ts';
import {windowEmission,CityLighting} from '../src/city-lighting.ts';
import jobs from '../../shared/data/jobs.json' with {type:'json'};

test('approved city preserves the saved 250 placements, facing, scale and NPC service coordinates',()=>{
 const parsed=parseDraft(CITY_LAYOUT,new Set(CITY_LAYOUT.items.map(p=>p.assetId)));
 assert.equal(parsed.items.length,250);
 const gazebo=parsed.items.find(p=>p.assetId==='theme:gazebo:5:5');
 assert.deepEqual([gazebo.x,gazebo.z],[-12,19.5]);
 const merchant=parsed.items.find(p=>p.assetId==='npc:merchant');
 assert.deepEqual([merchant.x,merchant.z,merchant.scale],[17,6.5,1.2]);
 assert.deepEqual(CITY_BUILDINGS.find(b=>b.id==='market').talk,merchant);
 assert.equal(parsed.items.filter(p=>p.assetId.startsWith('npc:')).length,6);
 assert.ok(parsed.items.filter(p=>p.assetId.startsWith('npc:')).every(p=>!p.flip));
 const angel=parsed.items.find(p=>p.assetId==='npc:angel');assert.deepEqual([jobs.angel.x,jobs.angel.z],[angel.x,angel.z]);
});
test('collision follows moved, removed, rotated and scaled scenery',()=>{
 assert.equal(cityWalkable(-12,19.5,.2),false,'moved gazebo is solid');
 assert.equal(cityWalkable(-9,22,.2),true,'old gazebo footprint is released');
 assert.equal(cityWalkable(27,24,.2),true,'removed well leaves no invisible obstacle');
 const bench=CITY_COLLISION.boxes.find(p=>p.x===-16.5&&p.z===8);
 assert.deepEqual(bench,{x:-16.5,z:8,w:.7,d:2.2});
 assert.ok(CITY_COLLISION.boxes.some(p=>p.x===0&&p.z===0&&p.w===4.4&&p.d===4.4));
 assert.throws(()=>cityLayoutGeometry([{assetId:'theme:unknown',x:0,z:0,scale:1,facing:0}]),/footprint/);
});
test('all services and four gates remain reachable from the player spawn',()=>{
 for(const p of [...CITY_BUILDINGS.map(b=>b.talk),HEALER,{x:-3,z:5},{x:0,z:44},{x:44,z:0},{x:0,z:-44},{x:-44,z:0}]){
  assert.ok(cityWalkable(p.x,p.z,.38),`service or gate at ${p.x},${p.z}`);
  assert.ok(route({x:0,z:14},p).length,`route to ${p.x},${p.z}`);
 }
});
test('window emission selects warm painted lights and preserves cool water, foliage and stone',()=>{
 assert.ok(windowEmission(240,155,55)>0);
 for(const rgb of [[100,125,70],[155,150,140],[70,150,200],[255,255,255],[60,35,15]])assert.equal(windowEmission(...rgb),0);
});
test('city lamps share cached stamps, cull offscreen lights and restore compositing',()=>{
 const previous=globalThis.document;
 let stamps=0,draws=0;
 globalThis.document={createElement:()=>{stamps++;return{getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})};}};
 try{
  const states=[],lights=new CityLighting(),c={globalCompositeOperation:'source-over',save(){states.push(this.globalCompositeOperation);},restore(){this.globalCompositeOperation=states.pop();},drawImage(){draws++;}};
  const items=[{assetId:'theme:lamp:3.2',x:50,z:50,scale:1},{assetId:'theme:lamp:3.2',x:500,z:500,scale:1},{assetId:'theme:bench:2.2:0.7',x:50,z:50,scale:1}];
  for(let i=0;i<2;i++)lights.draw(c,items,(x,z)=>({x,y:z}),10,100,100);
  assert.equal(stamps,2);assert.equal(draws,2);assert.equal(c.globalCompositeOperation,'source-over');
 }finally{globalThis.document=previous;}
});
