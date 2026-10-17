// Original deterministic synthesis; no recordings, samples, or external licences.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../art/sfx-source/',import.meta.url)),rate=48000;
mkdirSync(root+'synth',{recursive:true});
const specs={shield_bash:[.36,180,1100],bulwark:[.8,95,660],quake_slam:[.8,55,220],rally_roar:[.75,145,440],frenzy_slash:[.18,380,1700],blood_rage:[.7,62,210],blade_cyclone:[.6,280,800],leap_strike:[.3,320,900],guard_block:[.22,240,1450],reflect:[.22,900,1800],blade_cyclone_tick:[.1,450,1300],leap_strike_land:[.24,140,700]};
const picks=JSON.parse(readFileSync(root+'picks.json')),metadata=JSON.parse(readFileSync(root+'sfx-sources.json'));
for(const [id,[duration,body,chime]] of Object.entries(specs)){
 let seed=0x5eed,low=0,phase=0;
 const n=Math.round(duration*rate),samples=new Float32Array(n);
 for(let i=0;i<n;i++){
  const t=i/rate,u=t/duration,noise=((seed=(1664525*seed+1013904223)>>>0)/2**32)*2-1;
  low+=.14*(noise-low);phase+=2*Math.PI*body*(1+.5*Math.exp(-t/.025))/rate;
  const attack=Math.min(1,t/.004),tail=Math.min(1,(duration-t)/.035);
  let voice=.55*Math.sin(phase)*Math.exp(-u*5)+.2*Math.sin(2*Math.PI*chime*t)*Math.exp(-u*7)+.8*low*Math.exp(-u*8);
  if(id==='bulwark')voice=(.45*Math.sin(phase)+.18*Math.sin(2*Math.PI*chime*t))*Math.sin(Math.PI*u);
  if(id==='quake_slam')voice=.65*Math.sin(phase)*Math.exp(-u*4)+low*(.8+.3*Math.sin(t*170))*Math.exp(-u*5);
  if(id==='rally_roar')voice=(.35*Math.sin(phase)+.16*Math.sin(phase*2)+.12*Math.sin(phase*3)+low*.4)*Math.sin(Math.PI*u);
  if(id==='blood_rage')voice=.6*Math.sin(phase)*(Math.exp(-t*28)+Math.exp(-Math.abs(t-.18)*35))+low*.6*Math.sin(Math.PI*u);
  if(id.includes('slash')||id.includes('cyclone')||id==='leap_strike')voice=(low*1.8+.2*Math.sin(phase))*(.6+.4*Math.sin(t*70))*Math.sin(Math.PI*u);
  samples[i]=Math.tanh(voice)*attack*tail;
 }
 const wav=Buffer.alloc(44+n*4);wav.write('RIFF');wav.writeUInt32LE(36+n*4,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(3,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*4,28);wav.writeUInt16LE(4,32);wav.writeUInt16LE(32,34);wav.write('data',36);wav.writeUInt32LE(n*4,40);Buffer.from(samples.buffer).copy(wav,44);
 writeFileSync(root+'synth/'+id+'.wav',wav);picks[id]='synth/'+id+'.wav';metadata[id]={target:duration,source:'Original deterministic synthesis: tools/synth-job2-sfx.mjs',license:'Original project asset; no third-party samples'};
}
writeFileSync(root+'picks.json',JSON.stringify(picks,null,2)+'\n');writeFileSync(root+'sfx-sources.json',JSON.stringify(metadata,null,1)+'\n');
