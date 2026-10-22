import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),art=path.join(root,'meadow-3d/art/monster-origin-rebuild-v1');
const retired=JSON.parse(await fs.readFile(path.join(art,'retired-inventory.json'),'utf8')),hashes=new Set(retired.files.map(f=>f.sha256));
const result={date:'2026-10-21',passed:false,retiredRuntimeFiles:retired.files.length,scanned:{},matches:[]};
for(const folder of ['meadow-3d/public','meadow-3d/dist']){
 let count=0;async function scan(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await scan(file);else if(item.isFile()){count++;const hash=createHash('sha256').update(await fs.readFile(file)).digest('hex');if(hashes.has(hash))result.matches.push(path.relative(root,file).replaceAll('\\','/'));}}}
 await scan(path.join(root,folder));result.scanned[folder]=count;
}
result.passed=result.matches.length===0;await fs.writeFile(path.join(art,'release-scan.json'),JSON.stringify(result,null,2)+'\n');
if(!result.passed)throw Error('Retired monster files remain in shipping output: '+result.matches.join(', '));
console.log(JSON.stringify(result));
