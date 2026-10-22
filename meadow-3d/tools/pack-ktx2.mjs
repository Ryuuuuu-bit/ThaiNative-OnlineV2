import{spawnSync}from'node:child_process';import{readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync,readdirSync,unlinkSync}from'node:fs';import{resolve,dirname}from'node:path';
const root=resolve(import.meta.dirname,'..'),repo=resolve(root,'..');
const encoder=process.env.TOKTX||resolve(repo,'.codex-run/ktx-tools/extracted/bin/toktx.exe');
if(!existsSync(encoder))throw Error('Set TOKTX to Khronos toktx 4.4.2. See art/texture-sources/PACKING.md.');
const prep=spawnSync(process.env.PYTHON||'python',['-X','utf8',resolve(root,'tools/prepare-textures.py')],{stdio:'inherit'});if(prep.status)process.exit(prep.status);
const entries=JSON.parse(readFileSync(resolve(repo,'.codex-run/texture-inputs/manifest.json'),'utf8')),done=new Set();
for(const [logical,entry]of Object.entries(entries)){
 if(entry.ktx2&&!done.has(entry.ktx2)){const output=resolve(root,'public',entry.ktx2.slice(1));const args=['--t2','--encode',entry.mode,'--assign_oetf','srgb','--lower_left_maps_to_s0t0','--threads','1'];
  if(entry.mode==='uastc')args.push('--uastc_quality','3','--uastc_rdo_l','0.5','--zcmp','18');else args.push('--qlevel','255','--clevel','4');
  if(entry.mips)args.push('--genmipmap');args.push(output,entry.input);const result=spawnSync(encoder,args,{encoding:'utf8'});if(result.status)throw Error(result.stderr||result.stdout);done.add(entry.ktx2);console.log(entry.ktx2);
 }
 delete entry.input;
}
// Source names remain logical IDs; shipping filenames are content-versioned in the manifest.
for(const entry of Object.values(entries))for(const key of ['ktx2','webp','hitMask']){if(!entry[key])continue;const old=resolve(root,'public',entry[key].slice(1));if(!existsSync(old))continue;const bytes=readFileSync(old),hash=(await import('node:crypto')).createHash('sha256').update(bytes).digest('hex').slice(0,10),ext=entry[key].slice(entry[key].lastIndexOf('.')),next=entry[key].slice(0,-ext.length)+'-'+hash+ext;copyFileSync(old,resolve(root,'public',next.slice(1)));entry[key]=next;}
const basis=resolve(root,'public/basis/three-r185');mkdirSync(basis,{recursive:true});for(const file of ['basis_transcoder.js','basis_transcoder.wasm'])copyFileSync(resolve(repo,'node_modules/three/examples/jsm/libs/basis',file),resolve(basis,file));
writeFileSync(resolve(root,'public/texture-manifest.json'),JSON.stringify(entries,null,2)+'\n');
// Remove only archived PNG atlases and unversioned pack outputs from the shipping asset folders.
for(const folder of ['hero-painted','hero-skills','monsters-painted','env-painted','ui-painted']){
 if(folder==='monsters-painted'&&JSON.parse(readFileSync(resolve(root,'public/assets/monsters-painted/manifest.json'),'utf8')).originRevision)continue;
 const visit=dir=>{for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())visit(path);else if(item.name.endsWith('.png')||(/\.(webp|ktx2)$/.test(item.name)&&!/-[a-f0-9]{10}\.(webp|ktx2)$/.test(item.name)))unlinkSync(path);}};visit(resolve(root,'public/assets',folder));
}
for(const file of readdirSync(resolve(root,'public/assets')).filter(n=>n.endsWith('.png')))unlinkSync(resolve(root,'public/assets',file));
console.log('Packed textures and versioned Three r185 transcoder.');
await import('./pack-ktx2-worker.mjs');

// Preserve city entries when rebuilding the shared manifest.
await import('./pack-city-textures.mjs');
