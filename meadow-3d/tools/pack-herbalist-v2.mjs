import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../art/herbalist-v1/',import.meta.url));
const motions=['idle','walk','attack','cast','hurt','death'],durations=[1.2,.72,.7,1,.48,1.05];
const fw=384,fh=256,anchor={x:192,y:240},all=[],report=[];
for(const [row,id] of motions.entries()){
 const input=root+`source/${id}-v2.png`;
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=info,labels=new Int32Array(w*h),queue=new Int32Array(w*h),components=[];
 // Separate the six connected character silhouettes. This avoids cutting a
 // staff at an arbitrary grid seam or importing a neighbour's weapon/label.
 let seq=0;
 for(let i=0;i<w*h;i++){
  if(labels[i]||data[i*4+3]<80)continue;
  const label=++seq;labels[i]=label;queue[0]=i;
  let n=1,k=0,left=w,right=0,top=h,bottom=0;
  while(k<n){const p=queue[k++],x=p%w,y=Math.floor(p/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(const v of[x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(v>=0&&!labels[v]&&data[v*4+3]>=80){labels[v]=label;queue[n++]=v;}
  }
  components.push({label,n,left,right,top,bottom});
 }
 const bodies=components.toSorted((a,b)=>b.n-a.n).slice(0,6);
 if(bodies.length!==6||bodies.some(b=>b.n<3000||b.right-b.left>w*.6||b.bottom-b.top>h*.7))throw Error(`Invalid transparent silhouettes: ${id}`);
 const upper=bodies.filter(b=>(b.top+b.bottom)/2<h/2).sort((a,b)=>a.left-b.left),lower=bodies.filter(b=>(b.top+b.bottom)/2>=h/2).sort((a,b)=>a.left-b.left);
 if(upper.length!==3||lower.length!==3)throw Error(`Expected 3x2 layout: ${id}`);
 const ordered=[...upper,...lower];
 const scale=168/(ordered[0].bottom-ordered[0].top+1),strip=[];
 await mkdir(root+`frames-v2/${id}`,{recursive:true});
 for(const [f,b]of ordered.entries()){
  const x0=Math.max(0,b.left-3),y0=Math.max(0,b.top-3),bw=Math.min(w,b.right+4)-x0,bh=Math.min(h,b.bottom+4)-y0;
  const pixels=Buffer.alloc(bw*bh*4);
  let footMin=w,footMax=0;
  for(let y=b.top+Math.floor((b.bottom-b.top)*.83);y<=b.bottom;y++)for(let x=b.left;x<=b.right;x++)if(labels[y*w+x]===b.label){footMin=Math.min(footMin,x);footMax=Math.max(footMax,x);}
  for(let y=y0;y<y0+bh;y++)for(let x=x0;x<x0+bw;x++){
   const p=y*w+x;if(!data[p*4+3])continue;
   let belongs=labels[p]===b.label;
   if(!belongs&&data[p*4+3]<80)for(let dy=-2;dy<=2&&!belongs;dy++)for(let dx=-2;dx<=2;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h&&labels[yy*w+xx]===b.label){belongs=true;break;}}
   if(belongs)data.copy(pixels,((y-y0)*bw+x-x0)*4,p*4,p*4+4);
  }
  const outW=Math.round(bw*scale),outH=Math.round(bh*scale),center=(footMin+footMax)/2;
  const left=anchor.x+Math.round((x0-center)*scale),top=anchor.y-Math.round((b.bottom+1-y0)*scale);
  if(left<2||left+outW>fw-2||top<2||top+outH>fh-2)throw Error(`Clipped output ${id}:${f}`);
  const sprite=await sharp(pixels,{raw:{width:bw,height:bh,channels:4}}).resize(outW,outH).png().toBuffer();
  const frame=await sharp({create:{width:fw,height:fh,channels:4,background:'#00000000'}}).composite([{input:sprite,left,top}]).png().toBuffer();
  await writeFile(root+`frames-v2/${id}/${String(f+1).padStart(2,'0')}.png`,frame);
  strip.push({input:frame,left:f*fw,top:0});all.push({input:frame,left:f*fw,top:row*fh});
  report.push({motion:id,frame:f,scale,source:b,output:{left,top,width:outW,height:outH}});
 }
 await sharp({create:{width:fw*6,height:fh,channels:4,background:'#00000000'}}).composite(strip).png().toFile(root+`sheets/herbalist-${id}-v2.png`);
 console.log(id,'packed, body scale',scale.toFixed(4));
}
await sharp({create:{width:fw*6,height:fh*6,channels:4,background:'#00000000'}}).composite(all).png().toFile(root+'herbalist-atlas-v2.png');
await writeFile(root+'manifest.json',JSON.stringify({version:2,character:'herbalist-concept-02',direction:'approved-front-three-quarter',previewOnly:true,frameDirectory:'frames-v2',frameWidth:fw,frameHeight:fh,anchor,bodyPixels:168,bodyMetres:1.8,columns:6,atlas:'herbalist-atlas-v2.png',motions:motions.map((id,row)=>({id,row,frames:6,duration:durations[row],loop:row<2,sheet:`sheets/herbalist-${id}-v2.png`}))},null,2));
await writeFile(root+'normalization-v2.json',JSON.stringify({frames:report},null,2));
