// Water paths are registered to the painted fountain's source atlas coordinates.
// Drawing inside the prop's depth pass keeps visitors and foreground props in front.
const STREAMS=[
  [1091,209,1087,241,1085,292],
  [1156,224,1158,266,1158,309],
  [1218,210,1223,247,1227,295],
  [1074,331,1050,345,1048,385],
  [1156,374,1157,393,1157,413],
  [1234,334,1251,354,1257,388],
] as const;
function point(p:readonly number[],t:number){const v=1-t;return {x:v*v*p[0]+2*v*t*p[2]+t*t*p[4],y:v*v*p[1]+2*v*t*p[3]+t*t*p[5]};}
function ellipse(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number){c.moveTo(x+rx,y);c.ellipse(x,y,rx,ry,0,0,Math.PI*2);}
export function drawFountainWater(c:CanvasRenderingContext2D,x:number,y:number,scale:number,time:number){
  c.save();const unit=6*scale/481;
  c.translate(x-3*scale,y+(1.6-424*6/481)*scale);c.scale(unit,unit);c.translate(-915,-75);
  c.lineCap='round';
  // Clip the shimmer to water surfaces, cutting out stone tiers and the center column.
  for(const pool of [{x:1155,y:365,rx:169,ry:61,lower:true},{x:1157,y:288,rx:88,ry:31,lower:false},{x:1155,y:189,rx:58,ry:21,lower:false}]){
    c.save();c.beginPath();ellipse(c,pool.x,pool.y,pool.rx,pool.ry);c.clip();
    c.beginPath();ellipse(c,pool.x,pool.y,pool.rx,pool.ry);
    if(pool.lower){ellipse(c,1156,309,111,66);ellipse(c,1156,359,25,27);}
    else ellipse(c,pool.x,pool.y-15,pool.rx*.24,pool.ry*.85);
    c.clip('evenodd');
    for(let i=0;i<4;i++){
      const phase=(time*.55+i/4)%1,r=.2+phase*.95;
      c.beginPath();c.ellipse(pool.x+Math.sin(time*.9+i)*4,pool.y,pool.rx*r,pool.ry*r,0,0,Math.PI*2);
      c.strokeStyle=`rgba(198,243,236,${Math.sin(phase*Math.PI)*.5})`;c.lineWidth=1.8;c.stroke();
    }
    for(let i=0;i<15;i++){
      const phase=(time*.8+i*.618)%1,xx=pool.x+Math.sin(i*5.3)*pool.rx*.9,yy=pool.y+Math.cos(i*3.7)*pool.ry*.8;
      c.globalAlpha=Math.sin(phase*Math.PI)*.65;c.strokeStyle='#effff7';c.lineWidth=1.6;c.beginPath();c.moveTo(xx-2,yy);c.lineTo(xx+2+phase*4,yy-1);c.stroke();
    }
    c.restore();
  }
  STREAMS.forEach((p,i)=>{
    c.beginPath();c.moveTo(p[0],p[1]);c.quadraticCurveTo(p[2],p[3],p[4],p[5]);
    c.strokeStyle='#7cd7df99';c.lineWidth=5;c.stroke();
    // Bright segments travel DOWN each stream instead of merely blinking in place.
    for(let j=0;j<5;j++){
      const t=(time*1.1+j/5+i*.13)%1,a=point(p,t),b=point(p,Math.min(1,t+.075));
      c.beginPath();c.moveTo(a.x+Math.sin(time*8+j)*.7,a.y);c.lineTo(b.x,b.y);c.lineWidth=2.2;c.strokeStyle='#e9ffffd9';c.stroke();
    }
    for(let j=0;j<3;j++){
      const t=(time*1.4+j/3+i*.2)%1;
      c.beginPath();c.ellipse(p[4],p[5],3+t*13,1+t*4,0,0,Math.PI*2);c.strokeStyle=`rgba(224,255,247,${(1-t)*.65})`;c.lineWidth=1.6;c.stroke();
    }
    for(let j=0;j<5;j++){
      const t=(time*1.7+j/5+i*.31)%1,v=(j-2)*5;
      const xx=p[4]+v*t,yy=p[5]-Math.sin(t*Math.PI)*(6+j%3*3);
      c.globalAlpha=(1-t)*.8;c.fillStyle='#e1fff7';c.beginPath();c.ellipse(xx,yy,1.2,1.8,0,0,Math.PI*2);c.fill();
    }
    c.globalAlpha=1;
  });
  c.restore();
}
