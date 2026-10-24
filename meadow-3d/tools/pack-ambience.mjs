import {readFileSync,writeFileSync,mkdirSync,unlinkSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),out=resolve(root,'public/assets/audio');
const config=JSON.parse(readFileSync(resolve(root,'art/ambience-source/map-v1/sources.json'),'utf8').replace(/^\uFEFF/,''));
const rate=48000,channels=2,n=Math.round(config.crossfadeSeconds*rate);
const pcmInput=['-f','f32le','-ar',String(rate),'-ac','2','-i','pipe:0'];
mkdirSync(out,{recursive:true});
function run(args,input){
 const result=spawnSync(ffmpeg,['-hide_banner','-nostdin',...args],{input,maxBuffer:64*1024*1024,windowsHide:true});
 if(result.status!==0)throw Error(result.stderr?.toString()||'ffmpeg failed');return result;
}
function measure(pcm){
 const log=run([...pcmInput,'-af','loudnorm=I=-30:TP=-6:LRA=20:print_format=json','-f','null','-'],pcm).stderr.toString();
 const result=JSON.parse(log.slice(log.lastIndexOf('{')));
 return {lufs:Number(result.input_i),truePeakDbtp:Number(result.input_tp)};
}
function seam(pcm){
 const samples=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4);let jump=0,maxStep=0;
 for(let c=0;c<channels;c++)jump=Math.max(jump,Math.abs(samples[c]-samples[samples.length-channels+c]));
 for(let i=channels;i<samples.length;i++)maxStep=Math.max(maxStep,Math.abs(samples[i]-samples[i-channels]));
 return {wrapJump:jump,maxAdjacentStep:maxStep,passed:jump<.005&&jump<=maxStep};
}
const manifest={version:1,sampleRate:rate,channels,tracks:{}};
for(const[id,source]of Object.entries(config.tracks)){
 const bytes=readFileSync(resolve(root,source.source));
 if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error(id+': approved source hash mismatch');
 const data=run(['-i',resolve(root,source.source),'-f','f32le','-ar',String(rate),'-ac','2','pipe:1']).stdout;
 const full=new Float32Array(data.buffer,data.byteOffset,data.length/4),frames=full.length/channels;
 if(frames<n*3)throw Error(id+': take too short');
 const loop=new Float32Array((frames-n)*channels);
 for(let i=0;i<n;i++){
  const w=.5-.5*Math.cos(Math.PI*i/(n-1));
  for(let c=0;c<channels;c++)loop[i*channels+c]=full[(frames-n+i)*channels+c]*(1-w)+full[i*channels+c]*w;
 }
 loop.set(full.subarray(n*channels,(frames-n)*channels),n*channels);
 let pcm=Buffer.from(loop.buffer);
 // Remove DC/infrasonic drift before loudness processing and lossy codec filtering.
 pcm=run([...pcmInput,'-af','highpass=f=30','-f','f32le','-ar',String(rate),'-ac','2','pipe:1'],pcm).stdout;
 // Normalize the finished circular loop, preserving the approved timbre.
 pcm=run([...pcmInput,'-af','loudnorm=I=-30:TP=-6.5:LRA=20','-f','f32le','-ar',String(rate),'-ac','2','pipe:1'],pcm).stdout;
 for(let attempt=0;attempt<4;attempt++){
  const m=measure(pcm);if(Math.abs(m.lufs+30)<.35&&m.truePeakDbtp<=-6.3)break;
  const gain=-30-m.lufs;
  const limiter=m.truePeakDbtp+gain>-6.3?',alimiter=limit=0.473151:level=false:latency=true':'';
  pcm=run([...pcmInput,'-af',`volume=${gain}dB${limiter}`,'-f','f32le','-ar',String(rate),'-ac','2','pipe:1'],pcm).stdout;
 }
 // Apply the codec boundary fade after normalization so its lookahead cannot lift the edges.
 const final=new Float32Array(pcm.buffer,pcm.byteOffset,pcm.length/4),edge=Math.round(rate*.05);
 for(let i=0;i<edge;i++)for(let c=0;c<channels;c++){
  const w=.5-.5*Math.cos(Math.PI*i/(edge-1));final[i*channels+c]*=w;final[final.length-(i+1)*channels+c]*=w;
 }
 const pcmSeam=seam(pcm);if(!pcmSeam.passed)throw Error(id+': PCM seam failed');
 const track={map:source.map,source:source.source,sourceSha256:source.sha256,sourceDuration:frames/rate,
  loopStart:0,loopEnd:pcm.length/4/channels/rate,loopCrossfade:config.crossfadeSeconds,boundaryFadeSeconds:.05,
  targetLufs:-30,truePeakCeilingDbtp:-6,highpassHz:30,pcmSeam};
 for(const[key,ext,codec]of [['opus','ogg','libopus'],['aac','m4a','aac']]){
  const temp=resolve(out,`.amb-${id}-${process.pid}.${ext}`);let encoded;
  try{
   run([...pcmInput,'-map_metadata','-1','-fflags','+bitexact','-flags:a','+bitexact','-c:a',codec,'-b:a','96k',
    ...(ext==='ogg'?['-vbr','constrained','-serial_offset','0']:['-movflags','+faststart']),'-y',temp],pcm);
   encoded=readFileSync(temp);
  }finally{try{unlinkSync(temp);}catch{}}
  const hash=createHash('sha256').update(encoded).digest('hex').slice(0,12),name=`amb-${id}-${hash}.${ext}`;
  writeFileSync(resolve(out,name),encoded);
  const decoded=run(['-i',resolve(out,name),'-f','f32le','-ar',String(rate),'-ac','2','pipe:1']).stdout;
  const decodedSeam=seam(decoded),m=measure(decoded);
  if(!decodedSeam.passed||Math.abs(m.lufs+30)>1||m.truePeakDbtp>-5.8)throw Error(`${name}: loop/loudness check failed ${JSON.stringify({decodedSeam,...m})}`);
  track[key]={url:'/assets/audio/'+name,bytes:encoded.length,decodedDuration:decoded.length/4/channels/rate,seam:decodedSeam,...m};
 }
 manifest.tracks[id]=track;console.log(`Packed ${id}: ${track.loopEnd.toFixed(2)}s, ${track.opus.lufs} LUFS`);
}
writeFileSync(resolve(out,'ambience.json'),JSON.stringify(manifest,null,2)+'\n');
