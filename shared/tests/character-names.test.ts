import test from 'node:test';
import assert from 'node:assert/strict';
import { characterNameError } from '../src/character-names.js';
import { namePolicyError } from '../src/chat.js';

test('character names accept Thai, accented Latin and mixed digits without blocking innocent words', () => {
	for (const name of ['ธารา', 'นักดาบ01', 'อรุณ๑', '123Knight', 'Éclair', 'E\u0301clair', 'Magma', 'Modern', 'Mustafa', 'หีบสมบัติ', 'เหี้ยม', 'Dickens', 'Scunthorpe'])
		assert.equal(characterNameError(name), null, name);
});

test('character names reject invalid types, invisible text, foreign scripts, punctuation and numeric-only names', () => {
	for (const name of [null, {}, 123, '', 'a', 'abcdefghijklmn', ' leading', 'trailing ', 'มี ช่อง', 'GM_01', '<script>', '🙂🙂', 'Имя', 'Ａerin', 'ผู้\u200bกล้า', 'Hero\u202e', '\u0e48ไทย', '\u0301Aerin', 'A\u0483erin', '1234', '๑๒๓'])
		assert.ok(characterNameError(name), String(name));
});

test('reserved names reject team impersonation, leetspeak, accents and repeated-letter evasion', () => {
	for (const name of ['GMhero', 'gm01', 'Adm1n', 'Ádmin', 'Admiin', 'System', 'Sy5tem', 'Staff', 'Staaaff', 'Support', 'Official', 'Moderator', 'Mod01', 'ทีมงาน', 'ผู้ดูแล', 'แอดมิ่น', 'จีเอ็ม', 'ThaiNative'])
		assert.match(characterNameError(name)!, /สงวน/, name);
	assert.match(namePolicyError('G\u200bM_hero')!, /สงวน/);
});

test('inappropriate character names reject Thai/English words and spelling evasions', () => {
	for (const name of ['ควยดำ', 'เหี้ยดำ', 'เหี๊ยดำ', 'เย้ด', 'หำใหญ่', 'แตด', 'FuckYou', 'Fuuuck', 'Fück', 'Sh1t', 'B1tch', 'Asshole', 'N1gger'])
		assert.match(characterNameError(name)!, /ไม่เหมาะสม/, name);
	assert.match(namePolicyError('f.u.c.k')!, /ไม่เหมาะสม/);
});
