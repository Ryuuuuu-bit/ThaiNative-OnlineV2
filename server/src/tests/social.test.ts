import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChat, namePolicyError, chatAllowed, expShares, createGame, addPlayer } from '@thainative/shared';
import { createSocial, type SocialPeer } from '../realtime/social.js';
import { characterName } from '../store/progress.js';

function world() {
	let clock = 1_000_000;
	const commands: [string, string][] = [];
	const sent = new Map<string, any[]>(), live = new Map<string, SocialPeer>();
	const rooms = { city: { game: { mapId: 'city_plaza', players: new Map<string, any>() } }, meadow: { game: { mapId: 'meadow', players: new Map<string, any>() } } };
	const add = (id: string, name: string, map: 'city' | 'meadow' = 'city', accountId = 'acc-' + id) => {
		const ws = { id } as any;
		rooms[map].game.players.set(id, { id, name, level: 5, jobId: 'swordsman', hp: 50, maxHp: 100, mp:30,maxMp:80, dead: false });
		const peer = { ws, id, accountId, ready: true, room: rooms[map] } as SocialPeer;
		live.set(id, peer);
		sent.set(id, []);
		return peer;
	};
	const social = createSocial({ live, send: (ws: any, body) => sent.get(ws.id)!.push(body), command: (peer: SocialPeer, text: string) => commands.push([peer.id, text]), now: () => clock, offlineMs: 300000 });
	const of = (id: string, t: string) => sent.get(id)!.filter(m => m.t === t);
	return { social, add, sent, of, live, commands, tick: (ms: number) => { clock += ms; } };
}

test('chat filter masks strong insults, keeps look-alike words and leetspeak cannot dodge it', () => {
	assert.equal(filterChat('ไอ้ ควย'), 'ไอ้ ✱✱✱');
	assert.equal(filterChat('หีบสมบัติอยู่ไหน'), 'หีบสมบัติอยู่ไหน');
	assert.equal(filterChat('สัดส่วนดาเมจดีมาก'), 'สัดส่วนดาเมจดีมาก');
	assert.equal(filterChat('f.u.c.k you'), '✱✱✱✱✱✱✱ you');
	assert.equal(filterChat('sh1t'), '✱✱✱✱');
	assert.equal(filterChat('สวัสดี​ครับ   ทุกคน'), 'สวัสดีครับ ทุกคน');
});

test('name policy rejects staff look-alikes and insults at character creation', () => {
	assert.equal(namePolicyError('GM_Aerin'), 'ชื่อนี้สงวนไว้สำหรับทีมงาน');
	assert.equal(namePolicyError('Adm1n'), 'ชื่อนี้สงวนไว้สำหรับทีมงาน');
	assert.equal(namePolicyError('ควยดำ'), 'ชื่อนี้มีคำไม่เหมาะสม');
	assert.equal(namePolicyError('Aerin'), null);
	assert.throws(() => characterName('ทีมงาน'), /สงวน/);
	assert.equal(characterName('แอริน').name, 'แอริน');
});

test('anti-spam: 1 s spacing, 5 per 10 s, no repeats, 3 strikes mutes for 60 s', () => {
	const l = { times: [], strikes: [] };
	let t = 0;
	assert.equal(chatAllowed(l, 'a', t), null);
	assert.match(chatAllowed(l, 'b', t + 500)!, /ช้าลง/);
	assert.match(chatAllowed(l, 'a', t += 1500)!, /ซ้ำ/);
	assert.match(chatAllowed(l, 'a', t + 100)!, /60 วินาที/);
	assert.match(chatAllowed(l, 'd', t += 30000)!, /ปิดแชท/);
	assert.equal(chatAllowed(l, 'd', t += 31000), null);
});

test('map chat reaches only the same map; whispers reach one player and /r replies', () => {
	const w = world();
	const a = w.add('a', 'Aerin'), b = w.add('b', 'Bora'), c = w.add('c', 'Chai', 'meadow');
	w.social.chat(a, { ch: 'map', text: 'สวัสดี' });
	assert.equal(w.of('b', 'chat')[0].text, 'สวัสดี');
	assert.equal(w.of('a', 'chat').length, 1);
	assert.equal(w.of('c', 'chat').length, 0);
	w.tick(2000);
	w.social.chat(c, { ch: 'whisper', to: 'aerin', text: 'ไปทุ่งไหม' });
	assert.equal(w.of('a', 'chat').at(-1).from, 'Chai');
	assert.equal(w.of('b', 'chat').length, 1);
	w.tick(2000);
	w.social.chat(a, { ch: 'whisper', text: 'ไปสิ' });
	assert.equal(w.of('c', 'chat').at(-1).text, 'ไปสิ');
	w.social.chat(b, { ch: 'whisper', to: 'nobody', text: 'x' });
	assert.match(w.of('b', 'chatError')[0].text, /ไม่พบผู้เล่น/);
	w.social.ready(w.add('d', 'Dao'));
	assert.equal(w.of('d', 'chatHistory')[0].list[0].text, 'สวัสดี');
});

test('party: invite, accept, party chat, leader-only kick, max 6, offline cleanup', () => {
	const w = world();
	const a = w.add('a', 'Aerin'), b = w.add('b', 'Bora'), c = w.add('c', 'Chai', 'meadow');
	w.social.party(a, { op: 'invite', name: 'Bora' });
	const invite = w.of('b', 'partyInvite')[0];
	assert.equal(invite.from, 'Aerin');
	w.social.party(b, { op: 'accept', id: invite.partyId });
	assert.deepEqual(w.social.partyMembers('a'), ['a', 'b']);
	assert.equal(w.of('b', 'partyState').at(-1).party.members.length, 2);
	w.social.chat(b, { ch: 'party', text: 'พร้อม' });
	assert.equal(w.of('a', 'chat').at(-1).ch, 'party');
	assert.equal(w.of('c', 'chat').filter((m: any) => m.ch === 'party').length, 0);
	w.social.party(b, { op: 'kick', id: 'a' });
	assert.match(w.of('b', 'chatError').at(-1).text, /หัวหน้า/);
	w.social.party(c, { op: 'accept' });
	assert.match(w.of('c', 'chatError').at(-1).text, /หมดอายุ/);
	for (const id of ['d', 'e', 'f', 'g']) { const p = w.add(id, 'P' + id); w.social.party(a, { op: 'invite', name: 'P' + id }); w.social.party(p, { op: 'accept' }); }
	assert.equal(w.social.partyMembers('a').length, 6);
	w.social.party(a, { op: 'invite', name: 'Chai' });
	assert.match(w.of('a', 'chatError').at(-1).text, /เต็ม/);
	w.live.delete('b');
	w.social.offline('b');
	w.tick(301000);
	w.social.tick();
	assert.ok(!w.social.partyMembers('a').includes('b'));
	w.social.party(a, { op: 'kick', id: 'd' });
	assert.ok(!w.social.partyMembers('a').includes('d'));
	assert.equal(w.of('d', 'partyState').at(-1).party, null);
});

test('slash commands go to the command handler and are never broadcast; staff mute blocks chat', () => {
	const w = world();
	const a = w.add('a', 'Staff'), p = w.add('p', 'Loud');
	w.social.chat(p, { ch: 'map', text: '/gm announce hi' });
	w.social.chat(a, { ch: 'whisper', to: 'Loud', text: '/notice hi' });
	assert.deepEqual(w.commands, [['p', '/gm announce hi'], ['a', '/notice hi']]);
	assert.equal(w.of('p', 'chat').length + w.of('a', 'chat').length, 0);
	w.social.mute('p', 5);
	w.social.chat(p, { ch: 'map', text: 'spam' });
	assert.match(w.of('p', 'chatError').at(-1).text, /ปิดแชท/);
	assert.equal(w.social.unmute('p'), true);
	w.tick(2000);
	w.social.chat(p, { ch: 'map', text: 'ok now' });
	assert.equal(w.of('a', 'chat').at(-1).text, 'ok now');
	const bare = createSocial({ live: w.live, send: (ws: any, body) => w.sent.get(ws.id)!.push(body) });
	bare.chat(p, { ch: 'map', text: '/gm help' });
	assert.match(w.of('p', 'chatError').at(-1).text, /ไม่รู้จักคำสั่ง/);
});

test('party EXP: distant members share map-wide EXP; dead and other-room members do not', () => {
	const g = createGame(5, undefined, 'local', undefined, 'meadow');
	g.players.clear();
	const a = addPlayer(g, 'a', g.data.stats.defaultBuild), b = addPlayer(g, 'b', g.data.stats.defaultBuild), c = addPlayer(g, 'c', g.data.stats.defaultBuild);
	a.x = 0; a.z = 0; b.x = 10; b.z = 0; c.x = 100; c.z = 0;
	assert.deepEqual(expShares(g, a, 100, 50).map(s => [s.player.id, s.xp]), [['a', 100]]);
	g.partyMembers = () => ['a', 'b', 'c'];
	const shares = expShares(g, a, 100, 50);
	assert.deepEqual(shares.map(s => [s.player.id, s.xp, s.jobExp]), [['a', 40, 20], ['b', 40, 20], ['c', 40, 20]]);
 c.dead=true;g.partyMembers=()=>['a','b','c','other-map-or-channel'];
 assert.deepEqual(expShares(g,a,100,50).map(s=>[s.player.id,s.xp,s.jobExp]),[['a',55,27],['b',55,27]]);
 b.dead=true;assert.deepEqual(expShares(g,a,100,50).map(s=>[s.player.id,s.xp,s.shared]),[['a',100,false]]);
});

test('party manager: explicit creation, status, singleton survival and leader-only disband revoke invitations',()=>{
 const w=world(),a=w.add('a','Aerin'),b=w.add('b','Bora'),c=w.add('c','Chai');
 w.social.party(a,{op:'status'});assert.equal(w.of('a','partyState').at(-1).party,null);
 w.social.party(a,{op:'create'});const id=w.of('a','partyState').at(-1).party.id;
 w.social.party(a,{op:'create'});assert.match(w.of('a','chatError').at(-1).text,/อยู่ในปาร์ตี้แล้ว/);
 w.social.party(a,{op:'invite',name:'Bora'});w.social.party(b,{op:'accept',id});
 w.social.party(b,{op:'disband'});assert.match(w.of('b','chatError').at(-1).text,/หัวหน้า/);
 w.social.party(b,{op:'leave'});assert.deepEqual(w.social.partyMembers('a'),['a']);
 w.social.party(a,{op:'status'});assert.equal(w.of('a','partyState').at(-1).party.id,id);
 w.social.party(a,{op:'invite',name:'Chai'});w.social.party(a,{op:'disband'});
 assert.equal(w.social.parties.size,0);assert.equal(w.of('c','partyInviteClosed').at(-1).reason,'disbanded');
 w.social.party(c,{op:'accept',id});assert.match(w.of('c','chatError').at(-1).text,/หมดอายุ/);
});

test('party invites deduplicate, expire, and joining revokes invitations from other parties',()=>{
 const w=world(),a=w.add('a','Aerin'),b=w.add('b','Bora'),c=w.add('c','Chai');
 w.social.party(a,{op:'invite',name:'Bora'});const first=w.of('b','partyInvite').at(-1);
 assert.equal(first.expiresAt,1060000);
 w.social.party(a,{op:'invite',name:'Bora'});assert.equal(w.of('b','partyInvite').length,1);
 w.tick(60001);w.social.tick();assert.equal(w.of('b','partyInviteClosed').at(-1).reason,'expired');
 w.social.party(b,{op:'accept',id:first.partyId});assert.match(w.of('b','chatError').at(-1).text,/หมดอายุ/);
 w.social.party(a,{op:'invite',name:'Bora'});w.social.party(c,{op:'invite',name:'Bora'});
 const second=w.of('b','partyInvite').at(-1);w.social.party(b,{op:'accept',id:second.partyId});
 assert.deepEqual(w.social.partyMembers('b'),['c','b']);
 assert.ok(w.of('b','partyInviteClosed').some(m=>m.partyId===first.partyId&&m.reason==='joined'));
 w.social.party(b,{op:'accept',id:first.partyId});assert.match(w.of('b','chatError').at(-1).text,/หมดอายุ/);
});

test('party vitals expose HP/MP, reconnect retains membership, and a non-ready peer stays offline',()=>{
 const w=world(),a=w.add('a','Aerin'),b=w.add('b','Bora');
 w.social.party(a,{op:'invite',name:'Bora'});w.social.party(b,{op:'accept'});
 const member=w.of('a','partyState').at(-1).party.members.find((m:any)=>m.id==='b');
 assert.deepEqual([member.hp,member.maxHp,member.mp,member.maxMp],[50,100,30,80]);
 b.ready=false;w.social.offline('b');assert.equal(w.of('a','partyState').at(-1).party.members[1].online,false);
 w.social.party(a,{op:'lead',id:'b'});assert.match(w.of('a','chatError').at(-1).text,/ออนไลน์/);
 w.tick(20000);b.ready=true;w.social.ready(b);assert.equal(w.of('a','partyState').at(-1).party.members[1].online,true);
 w.social.party(a,{op:'lead',id:'b'});assert.equal(w.of('a','partyState').at(-1).party.leader,'b');
 b.ready=false;w.social.offline('b');w.tick(301000);w.social.tick();
 assert.equal(w.of('a','partyState').at(-1).party.leader,'a');assert.deepEqual(w.social.partyMembers('a'),['a']);
});


test('online party directory lists only ready peers in the same map/channel without account data',()=>{
 const w=world(),a=w.add('a','Aerin'),b=w.add('b','Bora'),c=w.add('c','Chai'),d=w.add('d','Distant','meadow'),e=w.add('e','OtherCH'),f=w.add('f','Loading');
 const ep=e.room.game.players.get(e.id)!;e.room={game:{mapId:'city_plaza',players:new Map([[e.id,ep]])}};f.ready=false;
 w.social.party(c,{op:'create'});w.social.party(a,{op:'online'});
 const directory=w.of('a','partyOnline').at(-1);
 assert.equal(directory.mapId,'city_plaza');assert.deepEqual(directory.list.map((p:any)=>[p.id,p.status]),[['b','available'],['c','party']]);
 assert.deepEqual(Object.keys(directory.list[0]).sort(),['id','jobId','level','name','status']);
 w.social.party(a,{op:'inviteNearby',id:'b'});w.social.party(a,{op:'online'});
 assert.equal(w.of('a','partyOnline').at(-1).list[0].status,'invited');
 w.social.party(b,{op:'accept'});w.social.party(a,{op:'online'});
 assert.deepEqual(w.of('a','partyOnline').at(-1).list.map((p:any)=>p.id),['c'],'own party members disappear from invite list');
 w.social.party(b,{op:'inviteNearby',id:'c'});assert.match(w.of('b','chatError').at(-1).text,/ปาร์ตี้อื่น|หัวหน้า/);
});

test('one-click invitations recheck room membership and reject stale, offline and forged targets',()=>{
 const w=world(),a=w.add('a','Aerin'),b=w.add('b','Bora'),other=w.add('c','Elsewhere','meadow');
 w.social.party(a,{op:'online'});const directory=w.of('a','partyOnline').at(-1);assert.equal(directory.list[0].id,b.id);
 const bp=b.room.game.players.get(b.id)!;b.room={game:{mapId:'city_plaza',players:new Map([[b.id,bp]])}};
 for(const id of ['b','c','missing','a']){w.social.party(a,{op:'inviteNearby',id});assert.match(w.of('a','chatError').at(-1).text,/แมพและ CH/);}
 assert.equal(w.of('b','partyInvite').length,0);assert.equal(w.of('c','partyInvite').length,0);
 assert.equal(w.social.parties.size,0);
});
