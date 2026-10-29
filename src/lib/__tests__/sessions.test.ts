import type { Cookies } from '@sveltejs/kit';
import { beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_PATH = ':memory:';
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.ADMIN_EMAILS = 'teo@example.com';
process.env.EDITOR_EMAILS = 'ana@example.com';
process.env.READER_EMAILS = 'bunica@example.com';
const { activeSessions, addedReaders, addReader, currentUser, endSession, removeReader, revokeSession, roleOf, startSession } =
	await import(
	'../server/auth.ts'
);

/** One browser's cookie jar. */
function jar(): Cookies {
	const store = new Map<string, string>();
	return {
		get: (name: string) => store.get(name),
		set: (name: string, value: string) => void store.set(name, value),
		delete: (name: string) => void store.delete(name)
	} as unknown as Cookies;
}

describe('sessions', () => {
	let phone: Cookies;
	beforeEach(() => {
		phone = jar();
	});

	it('signs in, knows the role, and signs out', () => {
		expect(currentUser(phone)).toBeNull();
		startSession(phone, 'ana@example.com', 'Mozilla/5.0 (iPhone; like Mac OS X) Safari/604.1');
		expect(currentUser(phone)).toEqual({ email: 'ana@example.com', role: 'editor' });
		endSession(phone);
		expect(currentUser(phone)).toBeNull();
	});

	it('stores only a hash of the cookie token', () => {
		startSession(phone, 'teo@example.com', '');
		const token = phone.get('nunta_session')!;
		expect(token).toMatch(/^[\w-]{43}$/);
		const mine = activeSessions(phone).find((s) => s.current)!;
		expect(mine.email).toBe('teo@example.com');
		expect(JSON.stringify(activeSessions(phone))).not.toContain(token);
	});

	it('locks out an e-mail taken off the lists, at once', () => {
		startSession(phone, 'ana@example.com', '');
		process.env.EDITOR_EMAILS = '';
		try {
			expect(currentUser(phone)).toBeNull();
		} finally {
			process.env.EDITOR_EMAILS = 'ana@example.com';
		}
	});

	it('lets the admin sign out another device', () => {
		const laptop = jar();
		startSession(phone, 'ana@example.com', '');
		startSession(laptop, 'teo@example.com', '');
		const ana = activeSessions(laptop).find((s) => s.email === 'ana@example.com' && !s.current)!;
		revokeSession(ana.id);
		expect(currentUser(phone)).toBeNull();
		expect(currentUser(laptop)?.role).toBe('admin');
	});

	it('rejects a forged cookie', () => {
		phone.set('nunta_session', 'x'.repeat(43), { path: '/' });
		expect(currentUser(phone)).toBeNull();
	});
});

describe('readers added in Setări', () => {
	it('lets an added reader in as a reader, and locks them out once removed', () => {
		const phone = jar();
		expect(roleOf('mama@example.com')).toBeNull();
		addReader('mama@example.com', 'teo@example.com');
		expect(roleOf('Mama@Example.com')).toBe('reader');
		expect(addedReaders()).toMatchObject([{ email: 'mama@example.com', added_by: 'teo@example.com' }]);
		startSession(phone, 'mama@example.com', '');
		expect(currentUser(phone)).toEqual({ email: 'mama@example.com', role: 'reader' });
		removeReader('mama@example.com');
		expect(currentUser(phone)).toBeNull();
		expect(activeSessions(phone).some((s) => s.email === 'mama@example.com')).toBe(false);
	});

	it('never lowers a role from the e-mail lists', () => {
		addReader('ana@example.com', 'teo@example.com');
		expect(roleOf('ana@example.com')).toBe('editor');
		removeReader('ana@example.com');
	});

	it('keeps the devices of someone still on an e-mail list', () => {
		const laptop = jar();
		addReader('bunica@example.com', 'teo@example.com');
		startSession(laptop, 'bunica@example.com', '');
		removeReader('bunica@example.com');
		expect(currentUser(laptop)?.role).toBe('reader');
	});
});
