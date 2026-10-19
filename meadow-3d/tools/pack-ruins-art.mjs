import sharp from 'sharp';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../public/assets/ruins-painted-v1/',import.meta.url);await mkdir(root,{recursive:true});
const specs=[{source:'architecture',regions:[[0,0,443,568],[443,0,404,568],[847,0,407,568],[0,590,415,664],[415,590,468,664],[883,590,371,664]],names:['wall-x','wall-z','house','arch','temple','foundation']},{source:'details',regions:[[0,0,418,715],[418,0,400,715],[818,0,436,715],[0,715,418,539],[418,715,405,539],[823,715,431,539]],names:['column','pier','statue','fallen','boulder','rubble']}];
const assets=[],atlases=[];
for(const spec of specs){const source=new URL(`../art/ruins-painted-v1/${spec.source}-source.png`,import.meta.url);const {data,info}=await sharp(await readFile(source)).ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==1254||info.height!==1254)throw Error('Recheck source atlas bounds');
 const bytes=await sharp(await readFile(source)).webp({lossless:true}).toBuffer(),hash=createHash('sha256').update(bytes).digest('hex').slice(0,10),atlas=`${spec.source}-${hash}.webp`;await writeFile(new URL(atlas,root),bytes);atlases.push({file:atlas,width:info.width,height:info.height,bytes:bytes.length});
 for(const [i,[x,y,w,h]]of spec.regions.entries()){let x0=x+w,y0=y+h,x1=x,y1=y;for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(data[(yy*info.width+xx)*4+3]>20){x0=Math.min(x0,xx);y0=Math.min(y0,yy);x1=Math.max(x1,xx);y1=Math.max(y1,yy);}assets.push({name:spec.names[i],atlas,rect:[x0,y0,x1-x0+1,y1-y0+1],anchor:[.5,.87]});}
}
await writeFile(new URL('manifest.json',root),JSON.stringify({version:1,atlases,assets},null,2)+'\n');console.log(JSON.stringify({atlases,assets}));

