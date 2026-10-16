/** Project-local portable extraction only. Never executes the Windows installer. */
import{mkdirSync,existsSync,writeFileSync,readFileSync}from'node:fs';import{resolve}from'node:path';import{spawnSync}from'node:child_process';import{createHash}from'node:crypto';
const base=resolve(import.meta.dirname,'../../.codex-run/ktx-tools');mkdirSync(base,{recursive:true});
if(process.platform!=='win32'||process.arch!=='x64')throw Error('Install Khronos KTX-Software 4.4.2 for your platform and set TOKTX to its toktx executable.');
async function download(name,url,sha){const file=resolve(base,name);if(!existsSync(file))writeFileSync(file,Buffer.from(await(await fetch(url)).arrayBuffer()));if(createHash('sha256').update(readFileSync(file)).digest('hex')!==sha.toLowerCase())throw Error('Encoder download checksum mismatch');return file;}
const installer=await download('installer.exe','https://github.com/KhronosGroup/KTX-Software/releases/download/v4.4.2/KTX-Software-4.4.2-Windows-x64.exe','1F323B0FEC19794F5E6C0425A61D4B1DA396872A10BE862D105F4F4B2D2957FE');
const archive=await download('7zip-bin-full-26.4.1.tgz','https://registry.npmjs.org/7zip-bin-full/-/7zip-bin-full-26.4.1.tgz','4BAC2C4D77F47E40CDD5F698D249F5EA511298E9961A83DD2DDFE4398626038C');
for(const[exe,args]of[['tar',['-xf',archive,'-C',base]],[resolve(base,'package/win/x64/7z.exe'),['x',installer,'-o'+resolve(base,'extracted'),'-y']]]){const result=spawnSync(exe,args,{stdio:'inherit',windowsHide:true});if(result.status)process.exit(result.status);}
console.log('Portable toktx ready:',resolve(base,'extracted/bin/toktx.exe'));
