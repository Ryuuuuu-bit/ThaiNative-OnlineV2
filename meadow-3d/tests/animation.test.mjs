import test from 'node:test';
import assert from 'node:assert/strict';
import {facingFor,facing8For,heroSprite,motionFor,motionFrame,frameCount,MOTION_DURATION,MOTIONS,attackFrame,atlasCell,DIRECTIONS,WALK_DIRECTIONS,WALK_FRAMES,WALK_STAND,walkFrame} from '../src/sprite-animation.ts';

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
  assert.equal(motionFor(p),'walk');
  p.attack=.5;p.attackKind='spin';assert.equal(motionFor(p),'spin');
  p.attackKind='meteor';assert.equal(motionFor(p),'cast');
  p.dash=.1;assert.equal(motionFor(p),'dodge');
  p.hurt=.3;assert.equal(motionFor(p),'hit');
  p.dead=true;assert.equal(motionFor(p),'death');
});
test('all dedicated one-shots cover their frames and hold rather than wrap',()=>{
  for(const motion of MOTIONS.filter(m=>m!=='idle'&&m!=='run'&&m!=='walk')){
    const n=frameCount(motion),duration=MOTION_DURATION[motion];
    assert.deepEqual(Array.from({length:n},(_,i)=>motionFrame(motion,duration*(i+.1)/n)),Array.from({length:n},(_,i)=>i));
    assert.equal(motionFrame(motion,-1),0);
    assert.equal(motionFrame(motion,duration),n-1);
    assert.equal(motionFrame(motion,100),n-1);
    assert.equal(atlasCell(motion,'NW',100).column,n-1);
    assert.equal(atlasCell(motion,'NW',0).columns,n);
  }
  assert.equal(motionFrame('run',.6),0);
  assert.equal(motionFrame('walk',MOTION_DURATION.walk),0);
  assert.deepEqual(Array.from({length:8},(_,i)=>motionFrame('walk',MOTION_DURATION.walk*(i+.1)/8)),[0,1,2,3,4,5,6,7]);
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
test('walk: each facing owns 12 slots wrapped 8 per row, frames then the standing pose, no overlap',()=>{
  assert.deepEqual(WALK_DIRECTIONS.slice(0,4),[...DIRECTIONS]);
  const seen=new Set();
  for(const [row,direction] of WALK_DIRECTIONS.entries())for(let f=0;f<=WALK_FRAMES[direction];f++){
    const slot=f===WALK_FRAMES[direction]?WALK_STAND:f,c=atlasCell('walk',direction,slot),index=row*12+slot;
    assert.deepEqual(c,{column:index%8,row:Math.floor(index/8),columns:8,rows:12});
    const key=`${c.column},${c.row}`;assert.ok(!seen.has(key));seen.add(key);
  }
  assert.deepEqual(atlasCell('walk','S',99),atlasCell('walk','S',WALK_STAND));
});
test('walk plays one whole stride cycle per walk duration in every facing',()=>{
  for(const facing of WALK_DIRECTIONS){
    const n=WALK_FRAMES[facing];
    assert.deepEqual(Array.from({length:n},(_,i)=>walkFrame(facing,MOTION_DURATION.walk*(i+.5)/n)),Array.from({length:n},(_,i)=>i));
    assert.equal(walkFrame(facing,MOTION_DURATION.walk),0);
  }
});
test('eight-way facing follows the screen axes and agrees with the quadrant facing on diagonals',()=>{
  // Screen right/up in world terms come from facingFor: horizontal=13x-9z, upward=-9x-13z.
  const screen=(h,u)=>({x:(13*h-9*u)/250,z:(-9*h-13*u)/250});
  const cases=[[0,-1,'S'],[1,0,'E'],[0,1,'N'],[-1,0,'W'],[1,-1,'SE'],[-1,-1,'SW'],[1,1,'NE'],[-1,1,'NW']];
  for(const [h,u,want] of cases){const v=screen(h,u);assert.equal(facing8For(v.x,v.z),want);if(want.length===2)assert.equal(facingFor(v.x,v.z),want);}
  for(let a=0;a<360;a+=7.5){const r=a*Math.PI/180,v=screen(Math.cos(r),Math.sin(r)),f=facing8For(v.x,v.z);if(f.length===2)assert.equal(f,facingFor(v.x,v.z));}
});
test('hero sprite: walk on 8 rows, cardinal idle uses the walk standing column, other motions stay on 4 rows',()=>{
  const s={x:9/250,z:13/250}; // screen straight down
  assert.equal(facing8For(s.x,s.z),'S');
  assert.deepEqual(heroSprite('walk',s.x,s.z,3),{sheet:'walk',cell:atlasCell('walk','S',3)});
  assert.deepEqual(heroSprite('walk',s.x,s.z,0,MOTION_DURATION.walk*.99),{sheet:'walk',cell:atlasCell('walk','S',WALK_FRAMES.S-1)});
  assert.deepEqual(heroSprite('idle',s.x,s.z,0),{sheet:'walk',cell:atlasCell('walk','S',WALK_STAND)});
  assert.deepEqual(heroSprite('attack',s.x,s.z,2),{sheet:'attack',cell:atlasCell('attack',facingFor(s.x,s.z),2)});
  assert.deepEqual(heroSprite('idle',22,4,0),{sheet:'idle',cell:atlasCell('idle','SE',0)});
});
