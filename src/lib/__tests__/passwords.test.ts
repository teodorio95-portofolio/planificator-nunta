import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';

process.env.DATABASE_PATH = ':memory:';
process.env.ADMIN_PASSWORD = 'correct horse battery';
process.env.EDITOR_PASSWORD = 'editor-pass-1';
process.env.READER_PASSWORD = 'short';
const auth = await import('../server/auth.ts');

function jar(): Cookies {
	const store = new Map<string, string>();
	return {
		get: (name: string) => store.get(name),
		set: (name: string, value: string) => void store.set(name, value),
		delete: (name: string) => void store.delete(name)
	} as unknown as Cookies;
}

describe('role passwords', () => {
	it('maps each password to its role and ignores ones that are too short', () => {
		expect(auth.passwordEnabled()).toBe(true);
		expect(auth.passwordRole('correct horse battery')).toBe('admin');
		expect(auth.passwordRole('editor-pass-1')).toBe('editor');
		expect(auth.passwordRole('short')).toBeNull();
		expect(auth.passwordRole('')).toBeNull();
		expect(auth.authProblems()).toEqual(['READER_PASSWORD is shorter than 8 characters and is ignored.']);
	});

	it('opens a session shown by role, which a password change ends', () => {
		const phone = jar();
		auth.startSession(phone, auth.passwordAccount('editor'), 'Mozilla/5.0 (iPhone)');
		expect(auth.currentUser(phone)).toEqual({ email: 'Parolă · Editor', role: 'editor' });
		process.env.EDITOR_PASSWORD = 'a-new-editor-pass';
		expect(auth.currentUser(phone)).toBeNull();
		process.env.EDITOR_PASSWORD = 'editor-pass-1';
		expect(auth.currentUser(phone)?.role).toBe('editor');
	});

	it('pauses an address after ten wrong passwords', () => {
		const t = 1_000_000;
		for (let i = 0; i < 10; i++) {
			expect(auth.mayTry('1.2.3.4', t)).toBe(true);
			auth.recordFailure('1.2.3.4', t);
		}
		expect(auth.mayTry('1.2.3.4', t + 1000)).toBe(false);
		expect(auth.mayTry('5.6.7.8', t + 1000)).toBe(true);
		expect(auth.mayTry('1.2.3.4', t + 16 * 60 * 1000)).toBe(true);
	});
});

describe('without any sign-in', () => {
	it('is open only in development or when AUTH_DISABLED=true', () => {
		const saved = { ...process.env };
		delete process.env.ADMIN_PASSWORD;
		delete process.env.EDITOR_PASSWORD;
		expect(auth.authEnabled()).toBe(false);
		// vitest runs with import.meta.env.DEV, like `vite dev`.
		expect(auth.openAccess()).toBe(true);
		Object.assign(process.env, saved);
	});
});
