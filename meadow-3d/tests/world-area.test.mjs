import test from 'node:test';
import assert from 'node:assert/strict';
import {drawAreaRing,drawAreaTag} from '../src/world-area.ts';
import {overlaps} from '../src/world-labels.ts';
import {readFileSync} from 'node:fs';
import {project2D} from '../src/game-2d-projection.ts';

function canvas(){
 const calls=[];const ctx=new Proxy({measureText:text=>({width:text.length*7}),getTransform:()=>({a:1.5,d:1.5})},{get:(o,key)=>key in o?o[key]:(...args)=>calls.push([key,...args])});
 return {ctx,calls};
}
test('tall area plaques avoid player nameplates and each other without clipping Thai detail',()=>{
 const {ctx}=canvas(),actor={left:180,top:100,right:270,bottom:160},occupied=[actor],q={x:200,y:140};
 const first=drawAreaTag(ctx,q,'ไปนครที่ถูกลืมเลือน','เดินทางกลับเมือง · เขตปลอดภัย','travel','#dfca88',occupied);
 assert.ok(first);assert.equal(first.bottom-first.top,44);assert.equal(overlaps(first,actor,6),false);
 assert.ok(first.right-first.left>='เดินทางกลับเมือง · เขตปลอดภัย'.length*7+60);
 const second=drawAreaTag(ctx,q,'แคมป์พักฟื้น 1','ฟื้น HP · ยังมีอันตราย','camp','#a9d3b4',[...occupied,first]);
 assert.ok(second);assert.equal(overlaps(first,second,6),false);
 assert.equal(drawAreaTag(ctx,q,'แคมป์','ฟื้น HP','camp','#a9d3b4',[{left:-1000,right:1000,top:-1000,bottom:1000}]),null);
});
test('ground engravings retain their world radius and restore the canvas at either zoom',()=>{
 for(const scale of [24,70]){
  const {ctx,calls}=canvas();drawAreaRing(ctx,{x:320,y:240},2,scale,'#a9d3b4',true);
  assert.equal(calls[0][0],'save');assert.equal(calls.at(-1)[0],'restore');
  assert.equal(calls.find(c=>c[0]==='arc')[3],2);
  assert.ok(calls.filter(c=>c[0]==='transform').every(c=>c[5]===320&&c[6]===240));
  assert.ok(calls.some(c=>c[0]==='setLineDash'&&c[1].length===0));
 }
});

test('the campfire hearth stays centred on the server camp coordinate at either zoom',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/env-painted/manifest.json',import.meta.url),'utf8'));
 const fire=manifest.assets.find(a=>a.name==='campfire'),camp=project2D(-14,-34);
 // Measured hearth centre within the cropped campfire artwork, above the front stones.
 const hearth=[.5,.6];
 for(const scale of [24,70]){
  const h=1.1*scale,w=h*fire.rect[2]/fire.rect[3],left=camp.x*scale-w*fire.anchor[0],top=camp.y*scale-h*fire.anchor[1];
  assert.ok(Math.abs(left+w*hearth[0]-camp.x*scale)<1e-8);
  assert.ok(Math.abs(top+h*hearth[1]-camp.y*scale)<1e-8);
 }
});
