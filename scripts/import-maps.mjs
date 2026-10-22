import {readFile,writeFile} from 'node:fs/promises';
import {importTiledMap} from '../shared/src/game/tiled-map.ts';
const monsters=JSON.parse(await readFile(new URL('../shared/data/monsters.json',import.meta.url),'utf8')).monsters;
const plan=JSON.parse(await readFile(new URL('../maps/biome-plan.json',import.meta.url),'utf8'));
for(const [id,file]of [['meadow','south-meadow'],['forest','east-forest'],['ruins','north-ruins'],['canyon','west-quarry'],['grove','grove'],['summit','summit'],['temple','temple'],['himmapan','himmapan']]){
 const input=new URL(`../maps/${file}.tmj`,import.meta.url),output=new URL(`../shared/data/maps/${id}.generated.json`,import.meta.url);
 const data=importTiledMap(JSON.parse(await readFile(input,'utf8')));
 if(data.id!==id)throw Error('Map identity does not match '+file);
 for(const zone of data.spawnZones)if(!monsters.some(m=>m.id===zone.dataId&&!m.boss))throw Error('Unknown spawn monster: '+zone.dataId);
 const encoded=JSON.stringify(data,null,2)+'\n';
 if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==encoded)throw Error(`${id} output is stale; run npm run maps:import`);console.log(`${id}: Tiled map output is current`);}
 else{await writeFile(output,encoded);console.log(`Imported ${file}.tmj: ${data.paths.length} paths, ${data.obstacles.length} obstacles, ${data.spawnZones.length} spawn zones`);}
}
const exploration={};
for(const id of ['desert','frost','yokai','dragon','volcano','fae','ocean','astral','abyss','confluence']){
 const data=importTiledMap(JSON.parse(await readFile(new URL(`../maps/${id}.tmj`,import.meta.url),'utf8')));
 const biome=plan.biomes.find(b=>b.id===id);
 if(data.id!==id)throw Error('Map identity does not match '+id);
 for(const zone of data.spawnZones)if(!monsters.some(m=>m.id===zone.dataId&&!m.boss))throw Error('Unknown regional monster: '+zone.dataId);
 exploration[id]={...data,exploration:data.exploration===true,name:biome.name,levels:biome.levels.join('–')};
}
const output=new URL('../shared/data/maps/exploration.generated.json',import.meta.url),encoded=JSON.stringify(exploration,null,2)+'\n';
if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==encoded)throw Error('Exploration output is stale; run npm run maps:import');console.log('10 biome maps: Tiled outputs are current');}
else{await writeFile(output,encoded);console.log('Imported10 biome maps');}
