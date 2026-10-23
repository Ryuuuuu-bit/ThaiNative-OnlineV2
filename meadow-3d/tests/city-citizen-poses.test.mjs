import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadCitizenArt,citizenPoseFrame} from '../src/city-2d-citizen-art.ts';
import {CITIZEN_PROFILES} from '../src/city-2d-citizens.ts';
import {CITIZEN_CALIBRATION} from '../src/city-character-calibration.ts';
const manifest=JSON.parse(readFileSync(new URL('../public/assets/city-poses-v2/citizens-manifest.json',import.meta.url)));
const originalFetch=globalThis.fetch,originalImage=globalThis.Image;
const legacy=JSON.parse(readFileSync(new URL('../public/assets/city-painted-v1/citizens-manifest.json',import.meta.url)));
test('existing walking art, scale and foot placement are preserved for all citizens',()=>{
 for(const p of CITIZEN_PROFILES){
  const entry=manifest.characters.find(a=>a.key===p.key),atlas=legacy.atlases.find(a=>a.id===p.atlas),row=atlas.rows[p.row],walk=entry.states.walk;
  assert.equal(walk.image,atlas.image);assert.deepEqual(walk.frames,row.frames);
  assert.equal(walk.bodyPixels,CITIZEN_CALIBRATION[p.key].bodyPixels);assert.deepEqual(walk.feet,CITIZEN_CALIBRATION[p.key].feet);
 }
});
test('standing gestures use time while walking remains locked to distance travelled',()=>{
 const pose={frames:[[],[],[],[]],duration:1.332};
 assert.deepEqual([0,.24,.48,.72].map(d=>citizenPoseFrame(pose,d,true,100)),[0,1,2,3]);
 assert.deepEqual([0,1,2,3].map(i=>citizenPoseFrame(pose,100,false,pose.duration*(i+.5)/4)),[0,1,2,3]);
 assert.equal(citizenPoseFrame(pose,0,false,-1),0);assert.equal(citizenPoseFrame(pose,0,false,pose.duration),0);
});
test('all forty identities have separate idle and walk drawings with measured ground contacts',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>manifest});
 globalThis.Image=class{async decode(){}};
 try{
  assert.equal(manifest.characters.length,40);const art=await loadCitizenArt();
  for(const profile of CITIZEN_PROFILES){
   const entry=manifest.characters.find(a=>a.key===profile.key);assert.ok(entry);assert.equal(entry.worldHeight,profile.height);
   assert.ok(readFileSync(new URL('../public'+entry.image,import.meta.url)).length>0);
   for(const state of ['idle','walk']){
    const pose=entry.states[state],moving=state==='walk';assert.equal(pose.frames.length,4);assert.equal(pose.feet.length,4);
    for(let i=0;i<4;i++){
     const calls=[],flips=[],ctx={save(){},restore(){},translate(){},beginPath(){},ellipse(){},fill(){},scale:(...v)=>flips.push(v),drawImage:(...v)=>calls.push(v)};
     art.draw(ctx,{profile,moving,walk:(i+.1)*.95/4,phase:pose.duration*(i+.5)/4,fx:-1,fz:0},{x:100,y:200},40);
     const call=calls[0],rect=pose.frames[i],unit=profile.height*40/pose.bodyPixels;
     assert.equal(call[0].src,pose.image??entry.image);assert.deepEqual(call.slice(1,5),rect);assert.equal(call[7],rect[2]*unit);assert.equal(call[8],rect[3]*unit);
     assert.ok(Math.abs(call[6]+pose.feet[i]*unit)<1e-10,profile.key+' '+state+' grounded pose '+i);
     assert.deepEqual(flips,[[-1,1]]);
    }
   }
  }
 }finally{globalThis.fetch=originalFetch;globalThis.Image=originalImage;}
});
test('incomplete pose data fails loading explicitly',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>({characters:manifest.characters.slice(1)})});
 try{await assert.rejects(loadCitizenArt(),/ภาพท่าทางชาวเมืองไม่ครบ/);}finally{globalThis.fetch=originalFetch;}
});
