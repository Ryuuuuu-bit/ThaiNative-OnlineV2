import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../art/herbalist-v1/',import.meta.url));
const raw=await sharp(root+'source/animations-v1.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const {width,height,channels}=raw.info;
if(width!==1254||height!==1254||channels!==4)throw Error('Unexpected source atlas');
// Use the actual transparent gutters in the approved generated atlas, rather
// than assuming the generator placed all poses inside perfectly equal cells.
const xs=[0,224,433,642,851,1060,1254],ys=[0,237,445,663,871,1060,1254];
const motions=['idle','walk','attack','cast','hurt','death'];
const durations=[1.2,.72,.7,1,.48,1.05];
const bounds=[];
for(let row=0;row<6;row++)for(let col=0;col<6;col++){
 let left=width,top=height,right=0,bottom=0,count=0;
 for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++)if(raw.data[(y*width+x)*4+3]>24){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
 if(count<100)throw Error(`Empty frame ${row}:${col}`);
 bounds.push({left,top,width:right-left+1,height:bottom-top+1,bottom:bottom+1});
}
const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)];
// The game defines a 168px standing body as 1.8m. One scale across ALL
// animations preserves head/body size when kneeling, striking or lying down.
const scale=168/median(bounds.slice(0,6).map(b=>b.height));
const frameWidth=384,frameHeight=256,anchor={x:192,y:240};
const anchors=bounds.slice(0,6).map((b,c)=>{
 let sum=0,n=0;
 for(let y=b.bottom-22;y<b.bottom;y++)for(let x=xs[c];x<xs[c+1];x++)if(raw.data[(y*width+x)*4+3]>80){sum+=x;n++;}
 return sum/n;
});
const parts=[],report=[];
await mkdir(root+'sheets',{recursive:true});await mkdir(root+'frames',{recursive:true});
for(let row=0;row<6;row++){
 const strip=[];await mkdir(root+`frames/${motions[row]}`,{recursive:true});
 for(let col=0;col<6;col++){
  const b=bounds[row*6+col],w=Math.round(b.width*scale),h=Math.round(b.height*scale);
  const left=anchor.x+Math.round((b.left-anchors[col])*scale),top=anchor.y-h;
  if(left<2||left+w>frameWidth-2||top<2)throw Error(`Clipped normalized frame ${row}:${col}`);
  const sprite=await sharp(root+'source/animations-v1.png').extract({left:b.left,top:b.top,width:b.width,height:b.height}).resize(w,h,{kernel:'lanczos3'}).png().toBuffer();
  const frame=await sharp({create:{width:frameWidth,height:frameHeight,channels:4,background:'#00000000'}}).composite([{input:sprite,left,top}]).png().toBuffer();
  await writeFile(root+`frames/${motions[row]}/${String(col+1).padStart(2,'0')}.png`,frame);
  strip.push({input:frame,left:col*frameWidth,top:0});parts.push({input:frame,left:col*frameWidth,top:row*frameHeight});
  report.push({motion:motions[row],frame:col,source:b,output:{left,top,width:w,height:h}});
 }
 await sharp({create:{width:frameWidth*6,height:frameHeight,channels:4,background:'#00000000'}}).composite(strip).png().toFile(root+`sheets/herbalist-${motions[row]}-v1.png`);
}
await sharp({create:{width:frameWidth*6,height:frameHeight*6,channels:4,background:'#00000000'}}).composite(parts).png().toFile(root+'herbalist-atlas-v1.png');
await writeFile(root+'manifest.json',JSON.stringify({version:1,character:'herbalist-concept-02',direction:'approved-front-three-quarter',previewOnly:true,frameWidth,frameHeight,anchor,bodyPixels:168,bodyMetres:1.8,columns:6,atlas:'herbalist-atlas-v1.png',motions:motions.map((id,row)=>({id,row,frames:6,duration:durations[row],loop:row<2,sheet:`sheets/herbalist-${id}-v1.png`}))},null,2));
await writeFile(root+'normalization.json',JSON.stringify({scale,frames:report},null,2));
console.log(`Packed 36 frames / 6 motions, shared scale ${scale.toFixed(4)}, 384x256, anchor 192,240`);
