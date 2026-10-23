import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {shadowClipSchema,shadowPose,parseShadowManifest} from '../src/shadow-hero.ts';
import {WALK_DIRECTIONS} from '../src/sprite-animation.ts';

test('city exploration validates only its idle and walk art while keeping clip validation and poses',()=>{
 const full=JSON.parse(readFileSync(new URL('../public/assets/hero-shadow-8dir-v1/manifest.json',import.meta.url)));
 for(const look of Object.values(full.looks))for(const motion of ['hit','dodge','death'])delete look[motion];
 const schema=z.object({version:z.literal(1),looks:z.object({'male-iron':z.object({idle:shadowClipSchema,walk:shadowClipSchema})})});
 const explorer=schema.parse(full);
 assert.deepEqual(Object.keys(explorer.looks),['male-iron']);
 assert.deepEqual(Object.keys(explorer.looks['male-iron']),['idle','walk']);
 assert.throws(()=>parseShadowManifest(full));
 for(const motion of ['idle','walk'])for(const facing of WALK_DIRECTIONS)for(const time of [0,.37,9]){
   assert.deepEqual(shadowPose(explorer,'male-iron',motion,facing,time),shadowPose(full,'male-iron',motion,facing,time));
 }
 const malformed=structuredClone(full);delete malformed.looks['male-iron'].walk.anchors.N;
 assert.throws(()=>schema.parse(malformed));
 const path=structuredClone(full);path.looks['male-iron'].idle.url='/assets/hero-shadow-8dir-v1/../secret.webp';
 assert.throws(()=>schema.parse(path));
 const geometry=structuredClone(full);geometry.looks['male-iron'].idle.anchors.SE.height=geometry.looks['male-iron'].idle.size+1;
 assert.throws(()=>schema.parse(geometry));
});
