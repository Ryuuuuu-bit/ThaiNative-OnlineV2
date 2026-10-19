import sharp from 'sharp';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[2];
if(!source)throw Error('Pass the approved ImageGen source PNG path');
const root=new URL('../public/assets/canyon-painted-v1/',import.meta.url);
await mkdir(root,{recursive:true});
const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
if(info.width!==1254||info.height!==1254)throw Error('This layout requires the reviewed 1254px source');
// Reviewed, non-uniform row bounds; no resampling or synthetic sharpening.
const regions=[[0,0,425,500],[425,0,440,495],[865,0,389,500],[0,500,440,365],[440,495,345,375],[785,500,469,365],[0,870,440,384],[440,870,360,384],[800,870,454,384]];
const names=['split-crag','layered-outcrop','round-boulder','fractured-cluster','leaning-fin','flat-slab','scree-pile','twin-columns','mineral-boulder'];
const assets=regions.map(([x,y,w,h],i)=>{
 let x0=x+w,y0=y+h,x1=x,y1=y;
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(data[(yy*info.width+xx)*4+3]>20){x0=Math.min(x0,xx);y0=Math.min(y0,yy);x1=Math.max(x1,xx);y1=Math.max(y1,yy);}
 return {name:names[i],rect:[x0,y0,x1-x0+1,y1-y0+1],anchor:[.5,.90]};
});
const bytes=await sharp(source).webp({lossless:true}).toBuffer();
const hash=createHash('sha256').update(bytes).digest('hex').slice(0,10),file=`rocks-${hash}.webp`;
await writeFile(new URL(file,root),bytes);
await writeFile(new URL('manifest.json',root),JSON.stringify({version:1,atlas:file,size:[info.width,info.height],assets},null,2)+'\n');
const art=new URL('../art/canyon-painted-v1/',import.meta.url);await mkdir(art,{recursive:true});await copyFile(source,new URL('rocks-source.png',art));
console.log(JSON.stringify({file,bytes:bytes.length,assets}));
