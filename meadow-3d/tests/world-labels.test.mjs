import test from 'node:test';
import assert from 'node:assert/strict';
import {nameplateCandidates,overlaps} from '../src/world-labels.ts';
import {createGame,revive} from '@thainative/shared';
import {CITY_SPAWN} from '@thainative/shared/maps';
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
test('city spawn and revive clear the Angel and face south',()=>{
 const g=createGame(123,undefined,'local',undefined,'city_plaza');
 assert.ok(CITY_SPAWN.z-3.2>=3);
 g.p.dead=true;g.p.fx=1;g.p.fz=0;revive(g);
 assert.equal(g.p.z,CITY_SPAWN.z);assert.equal(g.p.fx,0);assert.equal(g.p.fz,1);
});

