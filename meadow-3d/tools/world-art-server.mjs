/** Local review fixture. MemoryStore only; never imports the production server entry or a DB adapter. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {MemoryStore} from '../../server/build/store/memory.js';
import {createApp} from '../../server/build/app.js';
import {mountRealtime} from '../../server/build/realtime/index.js';
import {LAYOUTS,cityWalkable,meadowWalkable,forestWalkable,CITY_BUILDINGS,CITY_HOUSES,CITY_FOUNTAIN} from '../../shared/src/game/maps.ts';

const repo=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(repo,'.codex-run');mkdirSync(out,{recursive:true});
const grid={};
for(const [id,l]of Object.entries(LAYOUTS)){
 const ok=id==='city_plaza'?cityWalkable:id==='meadow'?meadowWalkable:forestWalkable,cells=[];
 for(let x=-l.halfX;x<=l.halfX;x++)for(let z=-l.halfZ;z<=l.halfZ;z++)if(ok(x,z,.8))cells.push([x,z]);
 grid[id]=cells;
}
writeFileSync(resolve(out,'walk-grid.json'),JSON.stringify(grid));
writeFileSync(resolve(out,'walk-layout.json'),JSON.stringify({layouts:LAYOUTS,buildings:[...CITY_BUILDINGS,...CITY_HOUSES],fountain:CITY_FOUNTAIN}));
const build=JSON.parse(readFileSync(resolve(repo,'meadow-3d/dist/build.json'),'utf8')).build;
const store=new MemoryStore();await store.init();
const create=store.createCharacter.bind(store);
store.createCharacter=async(...args)=>{
 const c=await create(...args);
 return store.saveProgress(c.accountId,c.id,{...c,...(process.argv.includes('--forest')?{mapId:'forest',posX:-56.5,posZ:0}:{}),level:99,baseStats:{str:10,agi:10,vit:99,int:10,dex:10,luk:10}});
};
const secret='world-art-local-memory-fixture';let realtime;
const app=createApp({store,secret,production:false,build,staticDir:resolve(repo,'meadow-3d/dist'),realtimeHealthy:()=>realtime?.healthy()??false});
const server=app.listen(8787,'127.0.0.1',()=>console.log('World art review: http://127.0.0.1:8787 · temporary memory · level99 survival fixture · normal movement/collision'));
realtime=mountRealtime(server,{store,secret,build,production:false});
