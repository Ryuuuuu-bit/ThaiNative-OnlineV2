// Water paths match the cropped sprite's three basins within its six-metre footprint.
// Drawing inside the prop's depth pass keeps visitors and foreground props in front.
const STREAMS=[
  [-.64,-3.14,-.77,-2.62,-.83,-2.11],
  [-.15,-3.07,-.21,-2.5,-.21,-1.9],
  [.84,-3.12,.94,-2.61,.98,-2.12],
  [-1.3,-1.73,-1.44,-1.33,-1.5,-.97],
  [-.9,-1.66,-1.03,-.95,-1.08,-.26],
  [.74,-1.66,.88,-.95,.93,-.26],
  [1.46,-1.73,1.52,-1.33,1.54,-.93],
] as const;
function point(p:readonly number[],t:number){const v=1-t;return {x:v*v*p[0]+2*v*t*p[2]+t*t*p[4],y:v*v*p[1]+2*v*t*p[3]+t*t*p[5]};}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number){c.moveTo(x+rx,y);c.ellipse(x,y,rx,ry,0,0,Math.PI*2);}
export function drawFountainWater(c:CanvasRenderingContext2D,x:number,y:number,scale:number,time:number,gentle=false){
  // Reduced motion removes airborne spray; the falling water remains easy to see.
  time*=gentle?.85:1.35;
  c.save();c.translate(x,y);c.scale(scale,scale);
  c.lineCap='round';
  // Clip the shimmer to water surfaces, cutting out stone tiers and the center column.
  for(const pool of [{x:.04,y:-.68,rx:2.35,ry:.9,lower:true},{x:.04,y:-2.2,rx:1.3,ry:.4,lower:false},{x:.04,y:-3.4,rx:.64,ry:.21,lower:false}]){
    c.save();c.beginPath();ellipse(c,pool.x,pool.y,pool.rx,pool.ry);c.clip();
    c.beginPath();ellipse(c,pool.x,pool.y,pool.rx,pool.ry);
    if(pool.lower)ellipse(c,0,-.85,.72,.6);
    else ellipse(c,pool.x,pool.y-.18,pool.rx*.24,pool.ry*.85);
    c.clip('evenodd');
    for(let i=0;i<(gentle?3:5);i++){
      const phase=(time*.55+i/4)%1,r=.2+phase*.95;
      c.beginPath();c.ellipse(pool.x+Math.sin(time*.9+i)*.05,pool.y,pool.rx*r,pool.ry*r,0,0,Math.PI*2);
      c.strokeStyle=`rgba(198,243,236,${Math.sin(phase*Math.PI)*.65})`;c.lineWidth=.032;c.stroke();
    }
    for(let i=0;i<(gentle?6:15);i++){
      const phase=(time*.8+i*.618)%1,xx=pool.x+Math.sin(i*5.3)*pool.rx*.9,yy=pool.y+Math.cos(i*3.7)*pool.ry*.8;
      c.globalAlpha=Math.sin(phase*Math.PI)*.65;c.strokeStyle='#effff7';c.lineWidth=.02;c.beginPath();c.moveTo(xx-.025,yy);c.lineTo(xx+.025+phase*.05,yy-.012);c.stroke();
    }
    c.restore();
  }
  STREAMS.forEach((p,i)=>{
    c.beginPath();c.moveTo(p[0],p[1]);c.quadraticCurveTo(p[2],p[3],p[4],p[5]);
    c.strokeStyle='#174c6666';c.lineWidth=.15;c.stroke();
    c.strokeStyle='#6ccfe1c4';c.lineWidth=.1;c.stroke();
    // Bright segments travel DOWN each stream instead of merely blinking in place.
    for(let j=0;j<(gentle?3:5);j++){
      const t=(time*1.6+j/(gentle?3:5)+i*.13)%1,a=point(p,t),b=point(p,Math.min(1,t+.14));
      c.beginPath();c.moveTo(a.x+Math.sin(time*8+j)*.009,a.y);c.lineTo(b.x,b.y);c.lineWidth=.055;c.strokeStyle='#edffffed';c.stroke();
    }
    for(let j=0;j<(gentle?2:4);j++){
      const t=(time*1.8+j/(gentle?2:4)+i*.2)%1;
      c.beginPath();c.ellipse(p[4],p[5],.05+t*.29,.02+t*.087,0,0,Math.PI*2);c.strokeStyle=`rgba(224,255,247,${(1-t)*.78})`;c.lineWidth=.031;c.stroke();
    }
    for(let j=0;j<(gentle?0:5);j++){
      const t=(time*2+j/5+i*.31)%1,v=(j-2)*.062;
      const xx=p[4]+v*t,yy=p[5]-Math.sin(t*Math.PI)*(.14+j%3*.05);
      c.globalAlpha=(1-t)*.8;c.fillStyle='#e1fff7';c.beginPath();c.ellipse(xx,yy,.02,.03,0,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
  });
  c.restore();
}
