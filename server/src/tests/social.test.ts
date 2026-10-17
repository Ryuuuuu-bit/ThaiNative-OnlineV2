import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChat, namePolicyError, chatAllowed, expShares, createGame, addPlayer } from '@thainative/shared';
import { createSocial, type SocialPeer } from '../realtime/social.js';
import { characterName } from '../store/progress.js';

function world() {
	let clock = 1_000_000;
	const sent = new Map<string, any[]>(), live = new Map<string, SocialPeer>();
	const rooms = { city: { game: { mapId: 'city_plaza', players: new Map<string, any>() } }, meadow: { game: { mapId: 'meadow', players: new Map<string, any>() } } };
	const add = (id: string, name: string, map: 'city' | 'meadow' = 'city', accountId = 'acc-' + id) => {
		const ws = { id } as any;
		rooms[map].game.players.set(id, { id, name, level: 5, jobId: 'swordsman', hp: 50, maxHp: 100, dead: false });
		const peer = { ws, id, accountId, ready: true, room: rooms[map] } as SocialPeer;
		live.set(id, peer);
		sent.set(id, []);
		return peer;
	};
	const social = createSocial({ live, send: (ws: any, body) => sent.get(ws.id)!.push(body), adminIds: ['acc-admin'], now: () => clock, offlineMs: 300000 });
	const of = (id: string, t: string) => sent.get(id)!.filter(m => m.t === t);
	return { social, add, sent, of, live, tick: (ms: number) => { clock += ms; } };
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

test('admin can mute and broadcast; players cannot', () => {
	const w = world();
	const admin = w.add('admin', 'Staff', 'city', 'acc-admin'), p = w.add('p', 'Loud');
	w.social.chat(p, { ch: 'map', text: '/notice hi' });
	assert.equal(w.of('p', 'chat').at(-1).text, '/notice hi');
	assert.ok(!w.of('admin', 'chat').some((m: any) => m.text.startsWith('📢')));
	w.social.chat(admin, { ch: 'map', text: '/mute Loud 5' });
	w.tick(2000);
	w.social.chat(p, { ch: 'map', text: 'spam' });
	assert.match(w.of('p', 'chatError').at(-1).text, /ปิดแชท/);
	w.social.chat(admin, { ch: 'map', text: '/notice ปิดปรับปรุง 5 นาที' });
	assert.equal(w.of('p', 'chat').at(-1).text, '📢 ปิดปรับปรุง 5 นาที');
});

test('party EXP: members in range split EXP with +10% per extra member; others get nothing', () => {
	const g = createGame(5, undefined, 'local', undefined, 'meadow');
	g.players.clear();
	const a = addPlayer(g, 'a', g.data.stats.defaultBuild), b = addPlayer(g, 'b', g.data.stats.defaultBuild), c = addPlayer(g, 'c', g.data.stats.defaultBuild);
	a.x = 0; a.z = 0; b.x = 10; b.z = 0; c.x = 100; c.z = 0;
	assert.deepEqual(expShares(g, a, 100, 50).map(s => [s.player.id, s.xp]), [['a', 100]]);
	g.partyMembers = () => ['a', 'b', 'c'];
	const shares = expShares(g, a, 100, 50);
	assert.deepEqual(shares.map(s => [s.player.id, s.xp, s.jobExp]), [['a', 55, 27], ['b', 55, 27]]);
});
