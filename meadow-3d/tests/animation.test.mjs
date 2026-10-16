import test from 'node:test';
import assert from 'node:assert/strict';
import {facingFor,motionFor,motionFrame,frameCount,MOTION_DURATION,MOTIONS,attackFrame,atlasCell,DIRECTIONS} from '../src/sprite-animation.ts';

test('screen-space facing matches camera axes in all four quadrants',()=>{
  assert.equal(facingFor(22,4),'SE');
  assert.equal(facingFor(-4,22),'SW');
  assert.equal(facingFor(4,-22),'NE');
  assert.equal(facingFor(-22,-4),'NW');
});
test('attack beats override movement and cover every frame without wrapping',()=>{
  assert.equal(motionFor({attack:.2,dash:0,moving:true}),'attack');
  assert.equal(motionFor({attack:0,dash:.1,moving:false}),'dodge');
  assert.equal(motionFor({attack:0,dash:0,moving:false}),'idle');
  for(const [kind,duration] of [['slash',.34],['spin',.6],['meteor',.8]]){
    assert.deepEqual(Array.from({length:6},(_,i)=>attackFrame(duration*(1-(i+.1)/6),kind)),[0,1,2,3,4,5]);
    assert.equal(attackFrame(0,kind),5);
  }
});
test('dedicated motion priorities include death, hurt, dodge and skill kinds',()=>{
  const p={dead:false,hurt:0,dash:0,attack:0,attackKind:'',moving:true};
  assert.equal(motionFor(p),'run');
  p.attack=.5;p.attackKind='spin';assert.equal(motionFor(p),'spin');
  p.attackKind='meteor';assert.equal(motionFor(p),'cast');
  p.dash=.1;assert.equal(motionFor(p),'dodge');
  p.hurt=.3;assert.equal(motionFor(p),'hit');
  p.dead=true;assert.equal(motionFor(p),'death');
});
test('all dedicated one-shots cover their frames and hold rather than wrap',()=>{
  for(const motion of MOTIONS.filter(m=>m!=='idle'&&m!=='run')){
    const n=frameCount(motion),duration=MOTION_DURATION[motion];
    assert.deepEqual(Array.from({length:n},(_,i)=>motionFrame(motion,duration*(i+.1)/n)),Array.from({length:n},(_,i)=>i));
    assert.equal(motionFrame(motion,-1),0);
    assert.equal(motionFrame(motion,duration),n-1);
    assert.equal(motionFrame(motion,100),n-1);
    assert.equal(atlasCell(motion,'NW',100).column,n-1);
    assert.equal(atlasCell(motion,'NW',0).columns,n);
  }
  assert.equal(motionFrame('run',.6),0);
  assert.equal(motionFrame('idle',100),0);
});
test('each direction maps to its own complete atlas row, idle to own cell',()=>{
  const cells=new Set();
  for(const [row,direction] of DIRECTIONS.entries()){
    assert.deepEqual(atlasCell('idle',direction,0),{column:row,row:0,columns:4,rows:1});
    for(let f=0;f<6;f++){
      const c=atlasCell('run',direction,f);
      assert.equal(c.row,row);assert.equal(c.column,f);
      cells.add(`${c.column},${c.row}`);
    }
  }
  assert.equal(cells.size,24);
});
