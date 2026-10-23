import test from 'node:test';
import assert from 'node:assert/strict';
import {npcSprite,cityNpcSprite,loadCityNpcSprites,drawNpcSprite} from '../src/city-npc-sprite.ts';
import {CITY_NPC_CLIPS} from '../src/city-npc-clips.ts';
import {CITY_SPRITEGEN_CLIPS} from '../src/city-spritegen-clips.ts';
import {TOWN_NPCS} from '../src/city-2d-locations.ts';
import {HERO_METRES} from '../src/world-scale.ts';
const clips={...CITY_NPC_CLIPS,...CITY_SPRITEGEN_CLIPS};
function draw(sprite,time){
 const calls=[],ctx={imageSmoothingQuality:'low',drawImage:(...args)=>calls.push(args)};
 drawNpcSprite(ctx,sprite,100,200,30,time);assert.equal(ctx.imageSmoothingQuality,'low');return calls[0];
}
test('each named service NPC owns a generated occupational gesture',async()=>{
 const paths=[],sprites=await loadCityNpcSprites(async path=>{paths.push(path);return {};},TOWN_NPCS.map(n=>n.art));
 assert.equal(sprites.size,6);assert.equal(new Set(TOWN_NPCS.map(n=>n.art)).size,6);
 assert.deepEqual(new Set(paths),new Set(TOWN_NPCS.map(n=>clips[n.art].file)));
 for(const n of TOWN_NPCS)assert.ok(sprites.has(n.art),n.id);
});
test('every occupational pose uses native rectangles and timing with a fixed body scale',()=>{
 for(const [id,clip] of Object.entries(clips)){
  const sprite=cityNpcSprite({},id),a=sprite.animation;
  assert.equal(a.frames.length,5);assert.equal(clip.feet.length,5);assert.equal(clip.worldHeight,HERO_METRES);
  assert.ok(Math.abs(sprite.height*(clip.bodyBounds[3]-clip.bodyBounds[1])/clip.cell[1]-HERO_METRES)<1e-10);
  for(let i=0;i<a.frames.length;i++){
   const args=draw(sprite,a.duration*(i+.5)/a.frames.length);
   assert.deepEqual(args.slice(1,5),clip.rects[i]);
   assert.equal(args[7],sprite.width*30);assert.equal(args[8],sprite.height*30);
   assert.ok(Math.abs(args[6]+args[8]*clip.feet[i]/clip.cell[1]-200)<1e-10,id+' grounded frame '+i);
  }
  assert.deepEqual(draw(sprite,a.duration),draw(sprite,0));assert.deepEqual(draw(sprite,-1),draw(sprite,0));
 }
});
test('static sprites retain crop, size and bottom-centre placement',()=>{
 const source={},sprite=npcSprite(source,[10,20,100,200],2);
 assert.deepEqual(draw(sprite,100),[source,10,20,100,200,85,140,30,60]);
});
test('a missing city NPC image remains an explicit loading error',async()=>{
 await assert.rejects(loadCityNpcSprites(async path=>{if(path===CITY_NPC_CLIPS.guard.file)throw Error('missing guard clip');return {};},TOWN_NPCS.map(n=>n.art)),/missing guard clip/);
});
