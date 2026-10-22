import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const within=relative=>{const absolute=path.resolve(root,relative);if(!absolute.startsWith(root+path.sep))throw Error('Path escapes workspace: '+relative);return absolute;};
const art='meadow-3d/art/monster-origin-rebuild-v1',stage='output/monster-origin-rebuild-20261021/runtime';
const read=async p=>JSON.parse(await fs.readFile(within(p),'utf8'));
const provenance=await read(art+'/provenance.json');
if(provenance.status!=='reviewed-replacement')throw Error('Replacement QA is incomplete');
for(const f of provenance.files){const bytes=await fs.readFile(within(`${stage}/${f.group}/${f.file}`));if(createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Staged file changed: '+f.file);}
for(const group of ['monsters-painted','monsters-hunting']){
 const staged=await read(`${stage}/${group}/manifest.json`);if(staged.originRevision!=='original-rebuild-v1')throw Error('Unexpected replacement manifest');
 const shipping=`meadow-3d/public/assets/${group}`,archive=`${art}/quarantine/${group}`;
 const current=await read(shipping+'/manifest.json');
 if(!current.originRevision){
  // Both absolute paths are checked inside this workspace before moving a directory.
  const source=within(shipping),target=within(archive);await fs.mkdir(path.dirname(target),{recursive:true});
  try{await fs.access(target);throw Error('Archive already exists; inspect before retrying: '+archive);}catch(e){if(e.code!=='ENOENT')throw e;}
  await fs.rename(source,target);
 }
 await fs.mkdir(within(shipping),{recursive:true});
 for(const name of await fs.readdir(within(`${stage}/${group}`)))if(name!=='manifest.json')await fs.copyFile(within(`${stage}/${group}/${name}`),within(`${shipping}/${name}`));
 await fs.copyFile(within(`${stage}/${group}/manifest.json`),within(shipping+'/manifest.json'));
}
const texturesFile='meadow-3d/public/texture-manifest.json',textures=await read(texturesFile),retired={};
for(const [key,value]of Object.entries(textures))if(/^\/assets\/monsters-(painted|hunting)\//.test(key)){retired[key]=value;delete textures[key];}
if(Object.keys(retired).length)await fs.writeFile(within(art+'/quarantine/texture-manifest.json'),JSON.stringify(retired,null,2)+'\n');
await fs.writeFile(within(texturesFile),JSON.stringify(textures,null,2)+'\n');
const inventory=await read(art+'/retired-inventory.json');inventory.status='archived-outside-public';
for(const f of inventory.files)f.archivePath=f.path.replace('meadow-3d/public/assets/',art+'/quarantine/');
await fs.writeFile(within(art+'/retired-inventory.json'),JSON.stringify(inventory,null,2)+'\n');
await fs.writeFile(within(art+'/admission.json'),JSON.stringify({date:'2026-10-21',revision:'original-rebuild-v1',retiredRuntimeFiles:inventory.files.length,legacyFilesShipped:false,externalBaseImageReferences:[],sourceIds:Object.keys(provenance.sources),deployed:false,scope:provenance.scope,limitations:['No legal clearance opinion is asserted.','Equipment icons, hero, environment and audio are outside this monster-atlas audit.','Some boss abilities share the replacement attack strip; authoritative warnings and damage timing are unchanged.']},null,2)+'\n');
console.log('Admitted original monster art. Archived '+inventory.files.length+' retired runtime files outside public.');
