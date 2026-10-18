import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

const source=(await readFile(new URL('../src/net/socket.ts',import.meta.url),'utf8')).replaceAll('import.meta.env.VITE_BUILD_ID',"'test'").replaceAll('import.meta.env.DEV','false');
const {GameSocket}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));

test('map transitions discard throttled movement and new input retains its source map',t=>{
 let now=100;const timers=[];
 class Socket {static OPEN=1;readyState=1;sent=[];send(raw){this.sent.push(JSON.parse(raw));}close(){}}
 t.mock.method(performance,'now',()=>now);
 t.mock.method(globalThis,'setInterval',fn=>{timers.push(fn);return 1;});
 const old={window:globalThis.window,location:globalThis.location,WebSocket:globalThis.WebSocket};
 Object.assign(globalThis,{window:{addEventListener(){}},location:{href:'http://localhost/play.html',protocol:'http:'},WebSocket:Socket});
 t.after(()=>{for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const socket=new GameSocket({message(){},status(){}}),ws=socket.ws;
 const snap=mapId=>ws.onmessage({data:JSON.stringify({t:'snap',mapId})});
 const flush=()=>{now+=100;for(const timer of timers)timer();};
 snap('city_plaza');
 socket.send({t:'steer',dx:0,dz:0});now+=1;
 socket.send({t:'move',x:46,z:0}); // throttled old waypoint
 socket.send({t:'travel',gate:'east'});flush();
 assert.equal(ws.sent.filter(m=>m.t==='move').length,0,'travel must discard, not flush, the old waypoint');
 snap('forest');
 socket.send({t:'move',x:-50,z:0});
 assert.equal(ws.sent.at(-1).mapId,'forest');
 now+=1;socket.send({t:'move',x:46,z:0,mapId:'city_plaza'});flush();
 assert.equal(ws.sent.at(-1).mapId,'city_plaza','a delayed render-map intent must not be relabelled as the new map');
 now+=1;socket.send({t:'move',x:-40,z:0});snap('ruins');flush();
 assert.equal(ws.sent.some(m=>m.x===-40),false,'incoming map change clears pending movement before callbacks');
 socket.send({t:'move',x:-50,z:0});assert.equal(ws.sent.at(-1).mapId,'ruins');
 for(const t of ['returnCity','revive']){
  socket.send({t:'steer',dx:0,dz:0});
  now+=1;socket.send({t:'move',x:30,z:30});socket.send({t});flush();
  assert.equal(ws.sent.some(m=>m.x===30),false,`${t} must clear queued movement`);
 }
});
