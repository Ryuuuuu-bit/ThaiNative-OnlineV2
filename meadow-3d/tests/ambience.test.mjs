import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ffmpeg from 'ffmpeg-static';
import {MAP_MUSIC} from '../src/music-state.ts';
import {MusicPlayer} from '../src/music.ts';

const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const ambient=read('../public/assets/audio/ambience.json');
const bgm=read('../public/assets/audio/bgm.json');
const sources=read('../art/ambience-source/map-v1/sources.json').tracks;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('all 19 maps retain approved ambience bytes and both encoded loops are continuous and balanced',()=>{
 assert.deepEqual(new Set(Object.keys(ambient.tracks)),new Set(Object.values(MAP_MUSIC)));
 for(const[map,id]of Object.entries(MAP_MUSIC)){
  const track=ambient.tracks[id],source=sources[id];
  assert.equal(track.map,map);assert.equal(source.take,1);
  assert.equal(hash(readFileSync(new URL('../'+source.source,import.meta.url))),source.sha256);
  assert.equal(track.sourceSha256,source.sha256);
  assert.ok(Math.abs(track.loopEnd-(track.sourceDuration-1.5))<.001);
  assert.equal(track.loopCrossfade,1.5);assert.ok(track.pcmSeam.passed);
  for(const codec of ['opus','aac']){
   const file=track[codec],url=new URL('../public'+file.url,import.meta.url),bytes=readFileSync(url);
   assert.equal(bytes.length,file.bytes);assert.ok(file.url.includes(hash(bytes).slice(0,12)));
   assert.ok(Math.abs(file.lufs+30)<1);assert.ok(file.truePeakDbtp<=-5.8);
   assert.ok(bgm.tracks[id][codec].lufs-file.lufs>6,'Ambience must sit below the map BGM');
   const decoded=spawnSync(ffmpeg,['-v','error','-i',fileURLToPath(url),'-f','f32le','-ar','48000','-ac','2','pipe:1'],{windowsHide:true,maxBuffer:32*1024*1024});
   assert.equal(decoded.status,0,decoded.stderr?.toString());
   const samples=new Float32Array(decoded.stdout.buffer,decoded.stdout.byteOffset,decoded.stdout.length/4);
   let peak=0;for(const value of samples){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));}
   assert.ok(peak>0&&peak<.6);
   for(let c=0;c<2;c++)assert.ok(Math.abs(samples[c]-samples[samples.length-2+c])<.005,`${id}/${codec} wrap`);
  }
 }
});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('BGM and ambience stream independently across every map, boss changes and hidden/focus transitions',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const requests=[],media=[];
 t.mock.method(globalThis,'fetch',async url=>{requests.push(url);return{ok:true,json:async()=>url.includes('ambience.json')?ambient:bgm};});
 const previous=globalThis.Audio;
 globalThis.Audio=class{
  paused=true;
  constructor(){media.push(this);}
  canPlayType(){return 'probably';}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}
  addEventListener(){}removeAttribute(){}load(){}
 };
 t.after(()=>{globalThis.Audio=previous;});
 const ctx={currentTime:5,createGain:()=>({connect(){},disconnect(){},gain:{value:0,cancelAndHoldAtTime(){},linearRampToValueAtTime(){}}}),
  createMediaElementSource:()=>({connect(){},disconnect(){}})};
 const music=new MusicPlayer(ctx,{}),ambience=new MusicPlayer(ctx,{},'/assets/audio/ambience.json');
 assert.equal(requests.length,0);
 for(const id of Object.values(MAP_MUSIC)){
  music.select(id);ambience.select(id);await flush();t.mock.timers.tick(3000);
  assert.deepEqual(new Set(media.filter(m=>!m.paused).map(m=>m.src)),new Set([bgm.tracks[id].opus.url,ambient.tracks[id].opus.url]));
 }
 assert.equal(requests.length,2);
 music.select('king');await flush();t.mock.timers.tick(3000);
 assert.equal(media.filter(m=>!m.paused&&m.src.startsWith('/assets/audio/amb-')).length,1);
 music.visibility(true);ambience.visibility(true);assert.ok(media.every(m=>m.paused));
 music.visibility(false);ambience.visibility(false);await flush();assert.equal(media.filter(m=>!m.paused).length,2);
 music.select(null);ambience.select(null);await flush();t.mock.timers.tick(3000);assert.ok(media.every(m=>m.paused));
});
test('an unavailable ambience manifest cannot prevent BGM playback',async t=>{
 t.mock.method(console,'warn',()=>{});
 t.mock.method(globalThis,'fetch',async url=>({ok:!url.includes('ambience.json'),json:async()=>bgm}));
 const media=[],previous=globalThis.Audio;
 globalThis.Audio=class{
  paused=true;constructor(){media.push(this);}canPlayType(){return 'probably';}
  play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}addEventListener(){}
 };
 t.after(()=>{globalThis.Audio=previous;});
 const ctx={currentTime:5,createGain:()=>({connect(){},gain:{value:0,cancelAndHoldAtTime(){},linearRampToValueAtTime(){}}}),createMediaElementSource:()=>({connect(){}})};
 const music=new MusicPlayer(ctx,{}),ambience=new MusicPlayer(ctx,{},'/assets/audio/ambience.json');
 music.select('city');ambience.select('city');await flush();
 assert.deepEqual(media.map(m=>m.src),[bgm.tracks.city.opus.url]);assert.equal(media[0].paused,false);
});
