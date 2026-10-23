import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
// Exercise the actual Escape branch without booting the renderer or network.

test('Escape opens the game menu, then closes the top dialog',()=>{
 const calls=[];
 const context={
  e:{code:'Escape',repeat:false,target:null,preventDefault:()=>calls.push('prevent')},
  dialogs:[],groundSkill:undefined,HTMLElement:class {},started:true,game:{p:{dead:false}},netOverlay:false,
  $:selector=>selector==='#overlay'?{hidden:true}:{click:()=>calls.push('menu')},
  qol:{cancel:()=>calls.push('cancel')},net:{send:message=>calls.push(message.t+':'+message.on)},
  clearInput:()=>calls.push('clear'),settingsUI:{open:()=>calls.push('settings')},
 };
 const branch=main.slice(main.indexOf(" if(e.code==='Escape'){",main.indexOf("window.addEventListener('keydown'")),main.indexOf(" if(e.target instanceof HTMLElement",main.indexOf("$('#game-menu').click();return;")));
 const press=()=>runInNewContext(`(function(){${branch.replace('!.close()', '.close()')}})()`,context);
 press();
 assert.deepEqual(calls,['prevent','cancel','auto:false','clear','menu']);
 calls.length=0;
 context.dialogs=[{close:()=>calls.push('close')}];
 press();
 assert.deepEqual(calls,['prevent','close','clear']);
 calls.length=0;
 context.dialogs=[];
 context.e.repeat=true;
 press();
 assert.deepEqual(calls,['prevent']);
});
