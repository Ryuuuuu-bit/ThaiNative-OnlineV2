import test from 'node:test';
import assert from 'node:assert/strict';
import {shadowOutfit,setShadowOutfit} from '../src/shadow-outfit.ts';

test('explicit outfit survives login redirects, invalid choices are ignored, and opt-out clears it',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}});
 try{
  assert.equal(shadowOutfit(''),undefined);
  assert.equal(shadowOutfit('?shadow=female'),'female');assert.equal(shadowOutfit(''),'female');
  assert.equal(shadowOutfit('?shadow=invalid'),'female');setShadowOutfit('male');assert.equal(shadowOutfit(''),'male');
  assert.equal(shadowOutfit('?shadow=off'),undefined);assert.equal(shadowOutfit(''),undefined);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Storage blocked');}});
  assert.equal(shadowOutfit('?shadow=female'),'female');assert.equal(shadowOutfit(''),undefined);
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;}
});
