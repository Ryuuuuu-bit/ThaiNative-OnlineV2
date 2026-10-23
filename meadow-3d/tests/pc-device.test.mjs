import test from 'node:test';
import assert from 'node:assert/strict';
import {isMobileDevice} from '../src/pc-device.ts';

test('phones and tablets are blocked, including desktop-mode iPads', () => {
 for (const userAgent of ['Mozilla/5.0 (iPhone) Mobile Safari', 'Mozilla/5.0 (Linux; Android 14) Chrome', 'Mozilla/5.0 (iPad) Safari']) {
  assert.equal(isMobileDevice({userAgent,platform:'',maxTouchPoints:5}),true);
 }
 assert.equal(isMobileDevice({userAgent:'Mozilla/5.0 Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),true);
 assert.equal(isMobileDevice({userAgent:'unknown',platform:'',maxTouchPoints:0,userAgentData:{mobile:true}}),true);
});

test('desktop computers remain supported, including touch-screen Windows PCs', () => {
 for (const [platform,maxTouchPoints] of [['Win32',0],['Win32',10],['MacIntel',0],['Linux x86_64',0]]) {
  assert.equal(isMobileDevice({userAgent:'Mozilla/5.0 Chrome',platform,maxTouchPoints}),false);
 }
});
