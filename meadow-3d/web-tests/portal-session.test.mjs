import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{heroView}from'../src/web/portal-state.ts';
const html=readFileSync('meadow-3d/index.html','utf8');
test('portal hero starts pending: guest/login actions are not shown before the session check, account actions are hidden',()=>{
 assert.match(html,/<div id="hero-session" data-session="pending"/);assert.match(html,/<div id="account-actions" hidden>/);
 assert.match(readFileSync('meadow-3d/src/web-glass.css','utf8'),/#hero-session\[data-session=pending\] #guest-actions\{visibility:hidden\}/);
 const guest=html.indexOf('id="guest-actions"'),end=html.indexOf('id="account-actions"');for(const id of ['guest-play','href="/login.html"'])assert.ok(html.indexOf(id,guest)<end,id);
});
test('signed out keeps the guest and login actions',()=>{assert.deepEqual(heroView(null),{session:'out'});});
test('signed in shows the account, its UID and a way back into the game instead of guest/Google',()=>{
 const base={account:{id:'x',uid:'123456789',displayName:'Panupong',kind:'google'}};
 const fresh=heroView({...base,selectedCharacterId:null});assert.equal(fresh.session,'in');assert.equal(fresh.uid,'123456789');assert.equal(fresh.continueHref,'/characters.html');assert.equal(fresh.showCharacters,false);assert.equal(fresh.guest,false);
 const playing=heroView({...base,selectedCharacterId:'c1'});assert.equal(playing.continueHref,'/play.html');assert.equal(playing.continueLabel,'เข้าเกมต่อ');assert.equal(playing.showCharacters,true);
 assert.equal(heroView({account:{...base.account,kind:'guest'},selectedCharacterId:null}).guest,true);
});
