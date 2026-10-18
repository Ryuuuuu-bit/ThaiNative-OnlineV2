import {slab,line,polygon,ellipse,roof} from './city-2d-art';

// Geometry follows the same projection as the ground, including the perpendicular walls.
export function drawWall(c:CanvasRenderingContext2D,axis:'x'|'z',length=4){
  const w=axis==='x'?length:1.2,d=axis==='z'?length:1.2,h=3.7;
  slab(c,0,0,w,d,h,['#b3b09a','#868b77','#d0cbb0']);
  slab(c,0,0,w+.13,d+.13,.5,['#96967f','#717b65','#b4b297']);
  for(let y=.65;y<h;y+=.53){
    line(c,[-w/2,d/2,y],[w/2,d/2,y],'#898e77',.045);
    line(c,[w/2,-d/2,y],[w/2,d/2,y],'#717d69',.045);
    for(let x=-w/2+.65+(Math.round(y/.53)%2)*.4;x<w/2;x+=.95)line(c,[x,d/2,y],[x,d/2,Math.min(h,y+.53)],'#92947c',.035);
    for(let z=-d/2+.6;z<d/2;z+=.85)line(c,[w/2,z,y],[w/2,z,Math.min(h,y+.53)],'#74816e',.035);
  }
  slab(c,0,0,w+.2,d+.2,3.95,['#c1bca1','#929780','#dfd5b6'],3.65);
  for(let v=-length/2+.45;v<length/2;v+=1.05)slab(c,axis==='x'?v:0,axis==='z'?v:0,axis==='x'?.58:1.35,axis==='z'?.58:1.35,4.6,['#b9b59b','#89917b','#dad1b2'],3.95);
  // Exterior buttress, kept within the boundary footprint.
  slab(c,axis==='z'?.63:0,axis==='x'?.63:0,.48,.48,2.7,['#aaa68e','#7b866e','#c4bda0']);
}
export function drawWatchtower(c:CanvasRenderingContext2D){
  slab(c,0,0,3.4,3.4,5.3,['#b7af94','#848b75','#d2c5a4']);
  for(let y=.7;y<5;y+=.65){line(c,[-1.7,1.7,y],[1.7,1.7,y],'#979880',.04);line(c,[1.7,-1.7,y],[1.7,1.7,y],'#76836e',.04);}
  for(const x of [-.85,.85])polygon(c,[[x-.13,1.72,3],[x+.13,1.72,3],[x+.13,1.72,4.2],[x-.13,1.72,4.2]],'#394b43','');
  slab(c,0,0,3.8,3.8,5.6,['#c5b99a','#92967c','#ddd0ad'],5.2);
  roof(c,4,4,5.6,['#537b75','#365d58','#86a392']);
  line(c,[0,0,7],[0,0,8.1],'#847c55',.07);
  polygon(c,[[0,0,8.1],[1.1,0,7.85],[0,0,7.55]],'#d6bc76','#a28f61');
}
export function drawGate(c:CanvasRenderingContext2D,axis:'x'|'z'){
  const point=(v:number):[number,number]=>axis==='x'?[v,0]:[0,v];
  for(const v of [-5,5]){const [x,z]=point(v);c.save();const dx=.83205*x-.5547*z,dy=.39223*x+.58835*z;c.translate(dx,dy);drawWatchtower(c);c.restore();}
  const w=axis==='x'?7:1.5,d=axis==='z'?7:1.5;
  slab(c,0,0,w,d,5.5,['#c3b99a','#8d967e','#daceac'],4.3);
  for(let v=-3;v<=3;v+=1){const [x,z]=point(v);slab(c,x,z,.55,.55,6.1,['#bfb698','#90967b','#d9d0af'],5.5);}
  // Open passage; banners sit on the towers rather than obstructing the doorway.
  for(const v of [-4.7,4.7]){const [x,z]=point(v);polygon(c,[[x-.35,z+.9,4.9],[x+.35,z+.9,4.9],[x+.35,z+.9,2.9],[x,z+.9,2.5],[x-.35,z+.9,2.9]],'#456f6d','#cdb774',.08);ellipse(c,x,z+.94,.13,.18,'#dfc78c',3.9);}
}
