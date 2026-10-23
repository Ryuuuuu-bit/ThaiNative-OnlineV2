import {z} from 'zod';
import connections from '../../data/world-connections.json' with {type:'json'};

const number=z.number().finite(),positive=number.positive();
const properties=z.array(z.object({name:z.string(),type:z.enum(['string','int','float','bool']),value:z.union([z.string(),number,z.boolean()])})).default([]);
const object=z.object({id:z.number().int().positive(),name:z.string().default(''),type:z.enum(['entry','gate','camp','arena','path','water','obstacle','landmark','structure','spawn','poi']),x:number,y:number,width:number.nonnegative().default(0),height:number.nonnegative().default(0),rotation:z.literal(0).default(0),point:z.boolean().default(false),ellipse:z.boolean().default(false),polyline:z.array(z.object({x:number,y:number})).min(2).optional(),properties}).passthrough();
const source=z.object({type:z.literal('map'),orientation:z.literal('orthogonal'),infinite:z.literal(false),width:z.number().int().positive().max(512),height:z.number().int().positive().max(512),tilewidth:positive,tileheight:positive,properties,layers:z.array(z.object({type:z.literal('objectgroup'),name:z.string(),x:z.literal(0).default(0),y:z.literal(0).default(0),offsetx:z.literal(0).default(0),offsety:z.literal(0).default(0),objects:z.array(object).max(2000)}).passthrough()).min(1)}).passthrough();
type Position={x:number;z:number};
type Circle=Position&{r:number;kind:string};
type Box=Position&{w:number;d:number;kind:string};
type Water=Position&{rx:number;rz:number;bridgeZ?:number;bridgeHalf?:number};
type Spawn=Position&{name:string;dataId:string;variant:'pink'|'mint'|'sky';rx:number;rz:number;count:number};

/** Supported Tiled subset: unrotated object layers in a top-down authoring view. */
export function importTiledMap(input:unknown){
 const map=source.parse(input),meta=Object.fromEntries(map.properties.map(p=>[p.name,p.value]));
 const pixelsPerMetre=positive.parse(meta.pixelsPerMetre);
 const halfX=map.width*map.tilewidth/pixelsPerMetre/2,halfZ=map.height*map.tileheight/pixelsPerMetre/2;
 const id=z.enum(Object.keys(connections).filter(id=>id!=='city_plaza') as [keyof typeof connections,...(keyof typeof connections)[]]).parse(meta.mapId);
 const paths:{points:[number,number][];width:number}[]=[],water:Water[]=[],camps:Position[]=[],obstacles:Circle[]=[],structures:Circle[]=[],landmarks:{circles:Circle[];boxes:Box[]}={circles:[],boxes:[]},spawnZones:Spawn[]=[],pois:(Position&{name:string;kind:string})[]=[],gates:Record<string,Position&{destination:string}>= {};
 let entry:Position|undefined,arena:(Position&{r:number})|undefined;
 const ids=new Set<number>();
 for(const layer of map.layers)for(const o of layer.objects){
  const fail=(message:string):never=>{throw Error(`Tiled ${layer.name}/${o.name||o.id}: ${message}`);};
  if(ids.has(o.id))fail('duplicate object id');ids.add(o.id);
  if('polygon'in o||'gid'in o||'template'in o)fail('polygons, tile objects and external templates are not supported');
  const props=Object.fromEntries(o.properties.map(p=>[p.name,p.value]));
  if(new Set(o.properties.map(p=>p.name)).size!==o.properties.length)fail('duplicate custom property');
  const pos=(px:number,py:number):Position=>({x:px/pixelsPerMetre-halfX,z:py/pixelsPerMetre-halfZ});
  const p=pos(o.x+(o.point||o.polyline?0:o.width/2),o.y+(o.point||o.polyline?0:o.height/2));
  const num=(key:string)=>{const value=props[key];return typeof value==='number'&&Number.isFinite(value)?value:fail(`missing numeric ${key}`);};
  const str=(key:string)=>{const value=props[key];return typeof value==='string'&&value.length?value:fail(`missing string ${key}`);};
  const radius=()=>{if(!o.ellipse||o.width<=0||Math.abs(o.width-o.height)>.001)fail('expected a nonzero circular ellipse');return o.width/pixelsPerMetre/2;};
  if(Math.abs(p.x)>halfX||Math.abs(p.z)>halfZ)fail('object origin is outside map bounds');
  if(o.type==='path'){
   if(!o.polyline)fail('path needs a polyline');const width=positive.parse(num('pathWidth'));
   const points=o.polyline!.map(v=>{const p=pos(o.x+v.x,o.y+v.y);if(Math.abs(p.x)>halfX||Math.abs(p.z)>halfZ)fail('path leaves map');return[p.x,p.z] as [number,number];});paths.push({points,width});
  }else if(o.type==='water'){
   if(!o.ellipse||o.width<=0||o.height<=0)fail('water needs an ellipse');
   const w:Water={...p,rx:o.width/pixelsPerMetre/2,rz:o.height/pixelsPerMetre/2};
   if(props.bridgeZ!==undefined){w.bridgeZ=num('bridgeZ');w.bridgeHalf=positive.parse(num('bridgeHalf'));if(Math.abs(w.bridgeZ-p.z)>=w.rz||w.bridgeHalf>=w.rz)fail('bridge must cross the water');}water.push(w);
  }else if(o.type==='obstacle')obstacles.push({...p,r:radius(),kind:str('kind')});
  else if(o.type==='structure'){
   if(id!=='ruins')fail('masonry structures belong to ruins');
   const kind=z.enum(['ruins-wall-x','ruins-wall-z','ruins-house','ruins-arch','ruins-foundation','ruins-temple','ruins-column','ruins-pier','ruins-statue','ruins-fallen']).parse(str('kind'));
   const r=radius();structures.push({...p,r,kind});
   const offsets=kind==='ruins-arch'?[-3.5,3.5]:kind.startsWith('ruins-wall')?[-2.8,-1.4,0,1.4,2.8]:[0];
   for(const offset of offsets)obstacles.push({x:p.x+(kind==='ruins-wall-z'?0:offset),z:p.z+(kind==='ruins-wall-z'?offset:0),r,kind:'ruins-foot'});
  }else if(o.type==='landmark'){
   const kind=str('kind');if(o.ellipse)landmarks.circles.push({...p,r:radius(),kind});
   else{if(o.width<=0||o.height<=0)fail('landmark needs an ellipse or rectangle');landmarks.boxes.push({...p,w:o.width/pixelsPerMetre,d:o.height/pixelsPerMetre,kind});}
  }else if(o.type==='spawn'){
   if(!o.ellipse||o.width<=0||o.height<=0)fail('spawn zone needs an ellipse');
   spawnZones.push({...p,name:z.string().min(1).parse(o.name),dataId:str('dataId'),variant:z.enum(['pink','mint','sky']).parse(props.variant??'pink'),rx:o.width/pixelsPerMetre/2,rz:o.height/pixelsPerMetre/2,count:z.number().int().positive().max(100).parse(num('count'))});
  }else if(o.type==='arena'){if(arena)fail('only one arena is supported');arena={...p,r:radius()};}
  else{
   if(!o.point)fail('entry, gates, camps and POIs must be point objects');
   if(o.type==='entry'){if(entry)fail('duplicate entry');entry=p;}
   if(o.type==='camp')camps.push(p);
   if(o.type==='gate'){if(!['north','east','south','west'].includes(o.name)||gates[o.name])fail('invalid or duplicate gate direction');gates[o.name]={...p,destination:str('destination')};}
   if(o.type==='poi')pois.push({...p,name:o.name,kind:str('kind')});
  }
 }
 if(!entry||!arena||!camps.length||!paths.length||(!spawnZones.length&&meta.exploration!==true)||!Object.keys(gates).length)throw Error('Tiled map requires entry, arena, camp, paths, spawn zones and gates');
 if(JSON.stringify(Object.entries(gates).map(([direction,g])=>[direction,g.destination]).sort())!==JSON.stringify(Object.entries(connections[id]).sort()))throw Error('Tiled gates must match the implemented world connections');
 if(id!=='meadow'&&(landmarks.circles.length||landmarks.boxes.length))throw Error('Use obstacles or ruins structures for non-meadow collision');
 return {...(meta.exploration===true?{exploration:true}:{}),id,halfX,halfZ,entry,arena,paths,water,camps,obstacles,structures,landmarks,spawnZones,pois,gates};
}
