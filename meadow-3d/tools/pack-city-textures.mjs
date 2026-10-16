import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),repo=resolve(root,'..');
const prep=spawnSync(process.env.PYTHON||'python',['-X','utf8',resolve(root,'tools/prepare-city-textures.py')],{stdio:'inherit'});if(prep.status)process.exit(prep.status);
const manifestPath=resolve(root,'public/texture-manifest.json'),manifest=JSON.parse(readFileSync(manifestPath,'utf8'));const dest=resolve(root,'public/assets/city');mkdirSync(dest,{recursive:true});
for(const name of ['city-trim-v1','city-npcs-v1']){
 const source=resolve(root,'art/texture-sources/city',name+'.png'),output=resolve(repo,'.codex-run',name+'.ktx2');
 const args=['--t2','--encode','uastc','--assign_oetf','srgb','--lower_left_maps_to_s0t0','--threads','1','--uastc_quality','3','--uastc_rdo_l','0.5','--zcmp','18'];if(name.includes('trim'))args.push('--genmipmap');args.push(output,source);
 const r=spawnSync(process.env.TOKTX||resolve(repo,'.codex-run/ktx-tools/extracted/bin/toktx.exe'),args,{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||r.error);
 const entry={size:name.includes('trim')?[1024,768]:[1024,1600],mode:'uastc',hitMask:null,mips:name.includes('trim'),cpu:false,source:'art/texture-sources/city/'+name+'.png'};
 for(const ext of ['ktx2','webp']){const path=ext==='ktx2'?output:source.replace('.png','.webp'),hash=createHash('sha256').update(readFileSync(path)).digest('hex').slice(0,10),file=name+'-'+hash+'.'+ext;copyFileSync(path,resolve(dest,file));entry[ext]='/assets/city/'+file;}
 manifest['/assets/city/'+name+'.png']=entry;
}
writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
