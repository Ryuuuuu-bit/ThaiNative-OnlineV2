import test from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
const page=name=>readFileSync(`meadow-3d/${name}`,'utf8');
test('login page offers username/password, guest and Google tabs with an accessible form',()=>{const html=page('login.html');
 for(const id of ['tab-account','tab-guest','tab-google'])assert.match(html,new RegExp(`role="tab" id="${id}" aria-controls="panel-`));
 assert.equal((html.match(/role="tabpanel"/g)||[]).length,3);
 assert.match(html,/id="login-username" name="username" autocomplete="username"/);assert.match(html,/id="login-password" name="password" type="password" autocomplete="current-password"/);
 assert.match(html,/id="register-username" name="username" autocomplete="username"/);assert.equal((html.match(/autocomplete="new-password"/g)||[]).length,2);
 // every input has a label, and the forms submit on Enter with a real submit button
 for(const[,id]of html.matchAll(/<input id="([\w-]+)"/g))if(!/link-guest/.test(id))assert.match(html,new RegExp(`<label for="${id}">`),id);
 assert.match(html,/id="login-submit" class="gold-button" type="submit"/);assert.match(html,/id="register-submit" class="gold-button" type="submit"/);
 assert.match(html,/id="build-id"/);assert.match(html,/logo-v2-512\.webp/);assert.match(html,/<html lang="th">/);
});
test('character select shows the account UID and a change-password form; the game menu shows the UID',()=>{const html=page('characters.html');assert.match(html,/id="account-uid"/);assert.match(html,/id="current-password" type="password" autocomplete="current-password"/);
 assert.match(readFileSync('meadow-3d/src/web/game-session.ts','utf8'),/uidChip\(account\.uid\)/);assert.match(readFileSync('meadow-3d/src/main.ts','utf8'),/mountMenuAccount\(selected\.account\)/);
 assert.match(readFileSync('meadow-3d/src/web/account-ui.ts','utf8'),/navigator\.clipboard\.writeText\(uid\)/);
});
