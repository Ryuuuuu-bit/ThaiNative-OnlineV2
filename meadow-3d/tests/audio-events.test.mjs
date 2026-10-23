import test from 'node:test';
import assert from 'node:assert/strict';
import {playEventAudio} from '../src/audio-events.ts';

function recorder() {
  const plays = [], ducks = [];
  return {plays, ducks, play: (...args) => plays.push(args), duckMusic: (...args) => ducks.push(args)};
}
test('leap takeoff and landing play on distinct authoritative events, not each AoE hit', () => {
  const sound = recorder();
  const event = {playerId:'you',skillId:'dash_strike',learnedSkill:'leap_strike',x:0,z:0};
  playEventAudio(sound,{...event,type:'skill'},'you');
  assert.deepEqual(sound.plays.map(p=>p[0]),['leap_strike']);
  playEventAudio(sound,{...event,type:'skillImpact'},'you');
  assert.deepEqual(sound.plays.map(p=>p[0]),['leap_strike','leap_strike_land']);
  for(let id=1;id<=3;id++)playEventAudio(sound,{...event,type:'hit',id,boss:false},'you');
  assert.equal(sound.plays.filter(p=>p[0]==='leap_strike_land').length,1);
});
test('ground impact waits for resolution and rapid attacks retain one sound per hit', () => {
  const sound = recorder();
  playEventAudio(sound,{type:'skill',skillId:'earth_break',playerId:'you'},'you');
  assert.equal(sound.plays.length,0);
  playEventAudio(sound,{type:'skillImpact',skillId:'earth_break',playerId:'you',x:2,z:3},'you');
  assert.equal(sound.plays[0][0],'earth_break');
  for(let i=0;i<3;i++)playEventAudio(sound,{type:'hit',skillId:'frenzy_slash',playerId:'you',id:1,x:2,z:3},'you');
  assert.equal(sound.plays.filter(p=>p[0]==='frenzy_slash').length,3);
  assert.equal(sound.plays.filter(p=>p[0]==='hit_thock').length,3);
  assert.equal(sound.plays.filter(p=>p[0]==='mat_jelly').length,3);
});
test('remote sound attenuation and local-only rewards remain intact', () => {
  const sound = recorder();
  playEventAudio(sound,{type:'slash',playerId:'other',combo:2,x:1,z:1},'you');
  assert.equal(sound.plays[0][0],'combo3');assert.equal(sound.plays[0][3],true);
  playEventAudio(sound,{type:'pickup',playerId:'other'},'you');assert.equal(sound.plays.length,1);
  playEventAudio(sound,{type:'pickup',playerId:'you'},'you');assert.equal(sound.plays[1][0],'pickup');
});
