import test from 'node:test';
import assert from 'node:assert/strict';
import {heroPresentation,previewFrameCount,PREVIEW_FACING} from '../src/hero-presentation.ts';
import {heroSprite,v2Cell,MOTION_V2,motionFrame,facingFor,facing8For,WALK_FRAMES,WALK_DIRECTIONS} from '../src/sprite-animation.ts';
import {heroBodyCalibration} from '../src/city-character-calibration.ts';
import {bossAnticipation} from '../src/boss-anticipation.ts';

test('shared presentation keeps the game cell and calibration for every facing and motion',()=>{
 for(const direction of WALK_DIRECTIONS)for(const motion of ['idle','walk','run','attack','spin','cast','hit','dodge','death'])for(const elapsed of [0,.13,.4,.85,2.1]){
  const [x,z]=PREVIEW_FACING[direction];assert.equal(facing8For(x,z),direction);
  const before=heroSprite(motion,x,z,motionFrame(motion,elapsed),elapsed),base=MOTION_V2[before.sheet];
  const cell=base?v2Cell(before.sheet,facingFor(x,z),before.cell.column,elapsed):before.cell;
  const actual=heroPresentation(motion,x,z,elapsed);assert.deepEqual(actual.cell,cell);
  const calibration=heroBodyCalibration(before.sheet,direction,cell.column,cell.row);
  assert.equal(actual.scale,calibration?.scale??1);assert.equal(actual.feet,calibration?.feet??base?.feet??240);
 }
});
test('atelier can inspect all real walk/breathing frames and cardinal standing poses',()=>{
 for(const direction of WALK_DIRECTIONS){
  const [x,z]=PREVIEW_FACING[direction];assert.equal(previewFrameCount('walk',direction),WALK_FRAMES[direction]);
  const cells=Array.from({length:WALK_FRAMES[direction]},(_,frame)=>heroPresentation('walk',x,z,0,frame).cell);
  assert.equal(new Set(cells.map(c=>c.row+':'+c.column)).size,WALK_FRAMES[direction]);
 }
 assert.equal(previewFrameCount('idle','NE'),8);assert.equal(previewFrameCount('idle','N'),1);
 assert.equal(heroPresentation('idle',...PREVIEW_FACING.N,0).sheet,'walk');
 assert.equal(heroPresentation('idle',...PREVIEW_FACING.NE,0,7).cell.column,7);
});
test('aliased boss anticipation distinguishes moves and ends on authoritative contact without mutating state',()=>{
 const original={boss:true,motion:'slam',motionTime:.6,windup:.2,fx:1,fz:0};
 const slam=bossAnticipation(original,true),charge=bossAnticipation({...original,motion:'charge'},true),spit=bossAnticipation({...original,motion:'spit'},true);
 assert.ok(slam.y>1&&slam.x<1);assert.ok(charge.y<1&&charge.x>1);assert.ok(spit.x>1&&spit.y>1);
 assert.deepEqual(original,{boss:true,motion:'slam',motionTime:.6,windup:.2,fx:1,fz:0});
 for(const patch of [{windup:0},{dead:true},{boss:false},{motion:'idle'}])assert.equal(bossAnticipation({...original,...patch},true),null);
 assert.equal(bossAnticipation(original,false),null);
});
