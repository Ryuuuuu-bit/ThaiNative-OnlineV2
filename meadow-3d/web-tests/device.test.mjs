import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isMobileDevice} from '../src/web/device.ts';

test('phones and tablets are blocked, including iPad desktop mode',()=>{
 for(const device of [
  {userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148',platform:'iPhone',maxTouchPoints:5},
  {userAgent:'Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36',platform:'Linux armv8l',maxTouchPoints:5},
  {userAgent:'Mozilla/5.0 (Linux; Android 14; SM-X710) Safari/537.36',platform:'Linux armv8l',maxTouchPoints:5},
  {userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5},
  {userAgent:'new browser',platform:'unknown',maxTouchPoints:0,userAgentData:{mobile:true}}
 ])assert.equal(isMobileDevice(device),true,device.userAgent);
});
test('Windows, Mac and Linux PCs stay enabled, including touchscreen PCs',()=>{
 for(const platform of ['Win32','MacIntel','Linux x86_64'])for(const maxTouchPoints of [0,...(platform==='MacIntel'?[]:[10])])
  assert.equal(isMobileDevice({userAgent:'Mozilla/5.0 Desktop',platform,maxTouchPoints,userAgentData:{mobile:false}}),false);
});
test('all account and play entry pages pass through the device gate',()=>{
 for(const page of ['index','login','characters','play']){
  const html=readFileSync(`meadow-3d/${page}.html`,'utf8');
  assert.match(html,/<script type="module" src="\/src\/web\/entry.ts"><\/script>/);
  assert.doesNotMatch(html,/<script type="module" src="\/src\/(?:boot|main|web\/(?:portal|login|characters))\.ts"/);
 }
 const mobile=readFileSync('meadow-3d/public/mobile.html','utf8');
 assert.match(mobile,/เวอร์ชันมือถือกำลังพัฒนา/);assert.match(mobile,/PC เท่านั้น/);assert.doesNotMatch(mobile,/<script/);
});
