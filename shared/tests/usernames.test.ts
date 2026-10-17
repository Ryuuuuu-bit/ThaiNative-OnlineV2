import test from 'node:test';
import assert from 'node:assert/strict';
import { usernamePolicyError } from '../src/usernames.js';

test('registration policy preserves valid usernames and catches reserved/profane evasions', () => {
	for (const name of ['Aerin_01', 'gmailfan', 'Modern', 'Magma', 'Mustafa', 'Dickens', 'Scunthorpe']) assert.equal(usernamePolicyError(name), null, name);
	for (const name of ['root', 'guest', 'mod_x', 'GMhero', 'Adm1n', 'a_d_m_i_n', 'Staaaff', 'Support01']) assert.equal(usernamePolicyError(name)?.code, 'USERNAME_RESERVED', name);
	for (const name of ['Fuuuck', 'f_u_c_k', 'Sh1t', 'B1tch']) assert.equal(usernamePolicyError(name)?.code, 'USERNAME_INAPPROPRIATE', name);
	for (const name of ['ไทย', 'a b', 'ab', 'a'.repeat(21), null]) assert.equal(usernamePolicyError(name)?.code, 'INVALID_USERNAME', String(name));
});
