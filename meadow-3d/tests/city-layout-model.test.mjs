import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraft,parseDraft,moveItem,faceItem,createLayoutHistory} from '../src/city-layout-model.ts';

const assets=new Set(['building:inn','prop:tree']);
const item=()=>({id:'inn-1',assetId:'building:inn',x:3,z:-7,scale:1,flip:false,facing:0});
const draft=()=>createDraft([item()]);

test('city drafts round-trip approved facing fields and keep their source data independent',()=>{
 const original={...item(),facing:3,rotation:47.5},created=createDraft([original]);original.x=10;
 assert.equal(created.version,2);
 assert.equal(created.items[0].x,3);
 assert.equal(created.items[0].facing,3);
 assert.equal(Object.hasOwn(created.items[0],'rotation'),false);
 assert.equal(created.name,'นครที่ถูกลืมเลือน · แบบร่าง');
 const input=JSON.parse(JSON.stringify({...created,admin:true,items:[{...created.items[0],url:'https://untrusted.example/asset.png',rotation:90}]}));
 const parsed=parseDraft(input,assets);
 assert.deepEqual(parsed,created);
 input.items[0].x=20;assert.equal(parsed.items[0].x,3);
 assert.equal(Object.hasOwn(parsed,'admin'),false);
 assert.equal(Object.hasOwn(parsed.items[0],'url'),false);
 assert.equal(Object.hasOwn(parsed.items[0],'rotation'),false);
});

test('legacy version 1 drafts preserve layout and discard image tilt when migrating',()=>{
 const {facing,...legacyItem}=item();
 for(const rotation of[undefined,0,47.5,90,180,359.9]){
  const input={...draft(),version:1,items:[{...legacyItem,flip:true,rotation,facing:3}]};
  const parsed=parseDraft(input,assets);
  assert.deepEqual(parsed,{...draft(),items:[{...item(),flip:true}]});
  assert.equal(Object.hasOwn(parsed.items[0],'rotation'),false);
  assert.equal(input.items[0].rotation,rotation);
 }
 assert.deepEqual(createDraft([legacyItem]),draft());
 assert.deepEqual(createDraft([{...legacyItem,rotation:90}]),draft());
 assert.equal(Object.hasOwn(legacyItem,'facing'),false);
});

test('draft import rejects malformed headers, unsupported maps and excessive content',()=>{
 for(const value of[null,undefined,[],false,'{}',{},
  {...draft(),version:0},{...draft(),version:3},{...draft(),version:'2'},{...draft(),mapId:'meadow'},
  {...draft(),name:''},{...draft(),name:'  '},{...draft(),name:'x'.repeat(81)},
  {...draft(),items:null},{...draft(),items:{}},{...draft(),items:Array(2)},{...draft(),items:Array(2001).fill(item())},
 ])assert.throws(()=>parseDraft(value,assets));
 assert.deepEqual(parseDraft(createDraft([]),assets).items,[]);
});

test('one malformed item rejects the whole import, including unsafe asset references',()=>{
 const invalidItems=[null,[],false,{},
  {...item(),id:''},{...item(),id:'  '},{...item(),id:'x'.repeat(181)},
  {...item(),assetId:'../../private.json'},{...item(),assetId:'https://untrusted.example/image.png'},
  {...item(),assetId:2},{...item(),x:'3'},{...item(),x:48.01},{...item(),z:-48.01},
  {...item(),x:NaN},{...item(),z:Infinity},{...item(),z:-Infinity},
  {...item(),scale:NaN},{...item(),scale:Infinity},{...item(),scale:.249},{...item(),scale:2.001},
  {...item(),flip:0},{...item(),flip:'false'},
  ...[undefined,null,'1',false,NaN,Infinity,-Infinity,-1,.5,4,90].map(facing=>({...item(),facing})),
 ];
 for(const invalid of invalidItems)assert.throws(()=>parseDraft({...draft(),items:[{...item(),id:'valid'},invalid]},assets));
 assert.throws(()=>parseDraft({...draft(),items:[item(),item()]},assets));
 for(const [x,z,scale,facing]of[[-48,48,.25,1],[48,-48,2,3]]){
  const input={...draft(),items:[{...item(),x,z,scale,flip:true,facing}]};
  assert.deepEqual(parseDraft(input,assets),input);
 }
});

test('legacy tilt still receives its original validation before migration',()=>{
 for(const rotation of[null,'90',false,NaN,Infinity,-Infinity,-.01,360,720]){
  assert.throws(()=>parseDraft({...draft(),version:1,items:[{...item(),rotation}]},assets));
 }
});

test('draft import accepts only directions available for each asset',()=>{
 const available=new Map([['building:inn',[0,2]]]);
 for(const facing of[0,2]){
  const input={...draft(),items:[{...item(),facing}]};
  assert.deepEqual(parseDraft(input,assets,available),input);
 }
 for(const facing of[1,3])assert.throws(()=>parseDraft({...draft(),items:[{...item(),facing}]},assets,available));
 assert.deepEqual(parseDraft(draft(),assets,new Map()),draft());
 assert.throws(()=>parseDraft({...draft(),items:[{...item(),facing:1}]},assets,new Map()));
 assert.throws(()=>parseDraft(draft(),assets,new Map([['building:inn',[]]])));
 const tree={...draft(),items:[{...item(),assetId:'prop:tree'}]};
 assert.deepEqual(parseDraft(tree,assets,available),tree);
 assert.throws(()=>parseDraft({...tree,items:[{...tree.items[0],facing:2}]},assets,available));
});

test('facing changes require a real supported view and preserve the other item fields',()=>{
 const original={...item(),facing:2,flip:true};
 for(const facing of[0,1,2,3])assert.deepEqual(faceItem(original,facing,[0,1,2,3]),{...original,facing});
 for(const invalid of[NaN,Infinity,-Infinity,null,undefined,'1',false,-1,.5,4,90]){
  assert.throws(()=>faceItem(original,invalid,[0,1,2,3]));
 }
 assert.throws(()=>faceItem(original,1,[0,2]));
 assert.throws(()=>faceItem(original,0,[]));
 assert.deepEqual(original,{...item(),facing:2,flip:true});
});

test('movement snaps and clamps both axes while retaining facing and source data',()=>{
 const original={...item(),facing:3};
 assert.deepEqual(moveItem(original,3.14,-7.14,.5),{...original,x:3,z:-7});
 assert.deepEqual(moveItem(original,3.14,-7.14,0),{...original,x:3.14,z:-7.14});
 assert.deepEqual(moveItem(original,99,-99,5),{...original,x:48,z:-48});
 assert.deepEqual(moveItem(original,Number.MAX_VALUE,-Number.MAX_VALUE,0),{...original,x:48,z:-48});
 assert.deepEqual(original,{...item(),facing:3});
 for(const args of[[NaN,0,1],[0,Infinity,1],[0,0,NaN],[0,0,Infinity],[0,0,-1]])assert.throws(()=>moveItem(original,...args));
});

test('history snapshots survive caller mutation and discard redo after a new edit',()=>{
 const original=draft(),history=createLayoutHistory(original);original.items[0].x=20;
 assert.equal(history.current().items[0].x,3);
 assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),false);
 const next=history.current();next.items[0].x=4;history.commit(next);next.items[0].x=40;
 assert.equal(history.current().items[0].x,4);
 const undone=history.undo();undone.items[0].x=30;
 assert.equal(history.current().items[0].x,3);assert.equal(history.canRedo(),true);
 const redone=history.redo();redone.items[0].x=40;assert.equal(history.current().items[0].x,4);
 history.undo();const branch=history.current();branch.items[0].x=5;history.commit(branch);
 assert.equal(history.canRedo(),false);assert.equal(history.redo().items[0].x,5);
 assert.equal(history.undo().items[0].x,3);assert.equal(history.undo().items[0].x,3);
});

test('history retains at most 60 snapshots',()=>{
 const history=createLayoutHistory(draft());
 for(let i=1;i<=80;i++)history.commit({...draft(),name:'draft '+i});
 let undoCount=0;while(history.canUndo()){history.undo();undoCount++;}
 assert.equal(undoCount,59);assert.equal(history.current().name,'draft 21');
 let redoCount=0;while(history.canRedo()){history.redo();redoCount++;}
 assert.equal(redoCount,59);assert.equal(history.current().name,'draft 80');
});

test('history restores facing and copies alongside position when undoing and redoing',()=>{
 const history=createLayoutHistory(draft()),next=history.current();
 next.items[0]=faceItem(moveItem(next.items[0],12,14,0),3,[0,1,2,3]);
 next.items.push({...next.items[0],id:'inn-copy'});history.commit(next);
 next.items[1].facing=1;
 assert.deepEqual(history.undo().items,[item()]);
 assert.deepEqual(history.redo().items,[
  {...item(),x:12,z:14,facing:3},
  {...item(),id:'inn-copy',x:12,z:14,facing:3},
 ]);
});
