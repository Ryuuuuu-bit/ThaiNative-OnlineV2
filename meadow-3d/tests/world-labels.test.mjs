import test from 'node:test';
import assert from 'node:assert/strict';
import {nameplateCandidates,overlaps,sceneryOpacity,placeWorldLabel} from '../src/world-labels.ts';
import {createGame,revive} from '@the-beginning-online/shared';
import {CITY_SPAWN} from '@the-beginning-online/shared/maps';
import jobs from '../../shared/data/jobs.json' with {type:'json'};
test('nameplate budget reserves target and hover, then nearest living monsters within five metres',()=>{
 const es=[1,2,3,4,5,6,7,8].map(id=>({id,x:id,z:0}));
 assert.deepEqual(nameplateCandidates(es,{x:0,z:0},8,7),[8,7,1,2]);
 assert.deepEqual(nameplateCandidates(es,{x:0,z:0},null,null),[1,2,3,4]);
 es[0].dead=true;assert.deepEqual(nameplateCandidates(es,{x:0,z:0},1,8),[8,2,3,4]);
 assert.deepEqual(nameplateCandidates(es,{x:30,z:0},null,null),[]);
});
test('labels detect partial panel occlusion and adjacent text lanes',()=>{
 const r={left:10,top:10,right:80,bottom:30};
 assert.ok(overlaps(r,{left:75,top:0,right:120,bottom:15}));
 assert.equal(overlaps(r,{left:10,top:34,right:80,bottom:54}),false);
});
test('foreground scenery fades over heads and targets without fading scenery behind them',()=>{
 const actor={left:90,top:60,right:110,bottom:110,footY:110};
 const canopy={left:80,top:40,right:130,bottom:80};
 assert.equal(sceneryOpacity(canopy,140,[actor]),.24,'head is covered although feet are below the canopy');
 assert.equal(sceneryOpacity(canopy,90,[actor]),1,'scenery behind the actor stays opaque');
 assert.equal(sceneryOpacity({...canopy,left:120},140,[actor]),1);
 assert.equal(sceneryOpacity(canopy,140,[]),1);
});
test('gate and camp labels keep clear of actor names and previously placed labels',()=>{
 const actor={left:50,top:40,right:150,bottom:120};
 const first=placeWorldLabel(100,100,120,[actor]);assert.ok(first);assert.equal(overlaps(first,actor,6),false);
 const second=placeWorldLabel(100,100,120,[actor,first]);assert.ok(second);assert.equal(overlaps(first,second,6),false);
 const name={left:150,top:70,right:230,bottom:90},body={left:180,top:85,right:200,bottom:130};
 const gate=placeWorldLabel(100,90,120,[name,body]);assert.ok(gate);assert.equal(overlaps(gate,name,6),false,'wide nameplates reserve space beyond the body');
 assert.equal(placeWorldLabel(100,100,120,[{left:0,top:-100,right:200,bottom:200}]),null);
});
test('city spawn and revive clear the Angel and face south',()=>{
 const g=createGame(123,undefined,'local',undefined,'city_plaza');
 assert.ok(Math.hypot(CITY_SPAWN.x-jobs.angel.x,CITY_SPAWN.z-jobs.angel.z)>=3);
 g.p.dead=true;g.p.fx=1;g.p.fz=0;revive(g);
 assert.equal(g.p.z,CITY_SPAWN.z);assert.equal(g.p.fx,0);assert.equal(g.p.fz,1);
});

