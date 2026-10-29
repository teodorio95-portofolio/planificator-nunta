import { describe, expect, it } from 'vitest';
import {
	accessLists,
	allowed,
	asSeenBy,
	canAct,
	cleanEmail,
	deviceName,
	formAction,
	PREVIEW_PATH,
	RETRY_MARK,
	roleFor,
	safeNext,
	shouldRetry,
	signInProblem
} from '../access.ts';

const env = {
	ADMIN_EMAILS: 'teo@example.com',
	EDITOR_EMAILS: ' Ana@Example.com , ion@example.com',
	READER_EMAILS: 'mama@example.com,'
};

describe('roleFor', () => {
	it('reads the lists, ignoring case and spaces', () => {
		expect(roleFor('teo@example.com', env)).toBe('admin');
		expect(roleFor('ana@example.com', env)).toBe('editor');
		expect(roleFor('ION@example.com', env)).toBe('editor');
		expect(roleFor('mama@example.com', env)).toBe('reader');
	});

	it('refuses anyone else, and empty lists let nobody in', () => {
		expect(roleFor('stranger@example.com', env)).toBeNull();
		expect(roleFor('', env)).toBeNull();
		expect(roleFor('teo@example.com', {})).toBeNull();
	});

	it('gives the higher role when an e-mail is on two lists', () => {
		expect(roleFor('teo@example.com', { ...env, READER_EMAILS: 'teo@example.com' })).toBe('admin');
	});
});

describe('accessLists', () => {
	it('shows each list normalised, without duplicates', () => {
		expect(accessLists({ ...env, READER_EMAILS: 'mama@example.com, MAMA@example.com,' })).toEqual([
			{ role: 'admin', variable: 'ADMIN_EMAILS', emails: ['teo@example.com'] },
			{ role: 'editor', variable: 'EDITOR_EMAILS', emails: ['ana@example.com', 'ion@example.com'] },
			{ role: 'reader', variable: 'READER_EMAILS', emails: ['mama@example.com'] }
		]);
		expect(accessLists({}).every((l) => l.emails.length === 0)).toBe(true);
	});
});

describe('cleanEmail', () => {
	it('trims and lowercases a typed e-mail', () => {
		expect(cleanEmail('  Mama@Gmail.com ')).toBe('mama@gmail.com');
	});

	it('refuses what cannot be one address', () => {
		for (const v of ['', 'mama', 'mama@gmail', '@gmail.com', 'a b@gmail.com', 'a@x.ro,b@x.ro', 'a@x.ro;b@x.ro'])
			expect(cleanEmail(v)).toBeNull();
	});
});

describe('allowed', () => {
	it('keeps Setări, the backup and its actions for the admin', () => {
		for (const path of ['/setari', '/setari/backup', '/setari/__data.json']) {
			expect(allowed('admin', 'GET', path)).toBe(true);
			expect(allowed('editor', 'GET', path)).toBe(false);
			expect(allowed('reader', 'GET', path)).toBe(false);
		}
		expect(allowed('editor', 'POST', '/setari')).toBe(false);
		expect(allowed('editor', 'GET', '/setarile-mele')).toBe(true);
	});

	it('keeps Notițe for the admin, not for editors or readers', () => {
		expect(allowed('admin', 'GET', '/notite')).toBe(true);
		expect(allowed('admin', 'POST', '/notite', 'add')).toBe(true);
		expect(allowed('editor', 'GET', '/notite')).toBe(false);
		expect(allowed('editor', 'POST', '/notite', 'add')).toBe(false);
		expect(allowed('reader', 'GET', '/notite/__data.json')).toBe(false);
	});

	it('lets editors change the plan and export guests', () => {
		expect(allowed('editor', 'POST', '/invitati')).toBe(true);
		expect(allowed('editor', 'GET', '/invitati/export.csv')).toBe(true);
	});

	it('lets readers only look, without the CSV export', () => {
		expect(allowed('reader', 'GET', '/invitati')).toBe(true);
		expect(allowed('reader', 'HEAD', '/buget')).toBe(true);
		expect(allowed('reader', 'POST', '/invitati')).toBe(false);
		expect(allowed('reader', 'POST', '/mese')).toBe(false);
		expect(allowed('reader', 'GET', '/invitati/export.csv')).toBe(false);
	});

	it('lets readers add a task, and nothing else', () => {
		expect(allowed('reader', 'POST', '/sarcini', 'add')).toBe(true);
		expect(allowed('reader', 'POST', '/sarcini', 'toggle')).toBe(false);
		expect(allowed('reader', 'POST', '/sarcini', 'delete')).toBe(false);
		expect(allowed('reader', 'POST', '/sarcini')).toBe(false);
		expect(allowed('reader', 'POST', '/invitati', 'add')).toBe(false);
		expect(allowed('reader', 'POST', '/sarcini/', 'add')).toBe(false);
		expect(canAct('reader', '/sarcini', 'add')).toBe(true);
		expect(canAct('editor', '/sarcini', 'delete')).toBe(true);
	});

	it('lets everyone sign out', () => {
		expect(allowed('reader', 'POST', '/logout')).toBe(true);
	});

	it('lets a previewing admin, who is a reader by then, switch the preview off', () => {
		expect(allowed('reader', 'POST', PREVIEW_PATH)).toBe(true);
	});
});

describe('formAction', () => {
	it('reads the action the way SvelteKit picks it: the first ?/name', () => {
		expect(formAction(new URLSearchParams('/add'))).toBe('add');
		expect(formAction(new URLSearchParams('/add&/delete'))).toBe('add');
		expect(formAction(new URLSearchParams('x=1&/toggle'))).toBe('toggle');
		expect(formAction(new URLSearchParams('next=/'))).toBeNull();
		expect(formAction(new URLSearchParams(''))).toBeNull();
	});
});

describe('asSeenBy', () => {
	const admin = { email: 'teo@example.com', role: 'admin' as const };

	it('gives an admin in preview exactly a reader’s rights', () => {
		const seen = asSeenBy(admin, 'reader');
		expect(seen).toEqual({ email: 'teo@example.com', role: 'reader', previewing: true });
		expect(allowed(seen.role, 'GET', '/setari')).toBe(false);
		expect(allowed(seen.role, 'POST', '/invitati')).toBe(false);
	});

	it('changes nobody else, and nothing without the cookie', () => {
		expect(asSeenBy(admin, undefined)).toBe(admin);
		expect(asSeenBy(admin, 'editor')).toBe(admin);
		const editor = { email: 'ana@example.com', role: 'editor' as const };
		expect(asSeenBy(editor, 'reader')).toBe(editor);
	});
});

describe('safeNext', () => {
	it('keeps same-site paths only', () => {
		expect(safeNext('/invitati?x=1')).toBe('/invitati?x=1');
		expect(safeNext('//evil.example/x')).toBe('/');
		expect(safeNext('/\\evil.example')).toBe('/');
		expect(safeNext('https://evil.example')).toBe('/');
		expect(safeNext(null)).toBe('/');
		expect(safeNext(undefined)).toBe('/');
	});
});

describe('deviceName', () => {
	it('names common browsers', () => {
		const iphone =
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
		const mac =
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
		const android =
			'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
		expect(deviceName(iphone)).toBe('Safari pe iPhone/iPad');
		expect(deviceName(mac)).toBe('Chrome pe Mac');
		expect(deviceName(android)).toBe('Chrome pe Android');
		expect(deviceName('')).toBe('dispozitiv necunoscut');
	});
});

describe('signInProblem', () => {
	const ok = { error: null, code: 'c', state: 's', cookieState: 's', verifier: 'v' };

	it('accepts a matching return from Google', () => {
		expect(signInProblem(ok)).toBeNull();
	});

	it('names what went wrong', () => {
		expect(signInProblem({ ...ok, error: 'access_denied', code: null })).toBe('cancelled');
		expect(signInProblem({ ...ok, error: 'server_error', code: null })).toBe('google_error');
		expect(signInProblem({ ...ok, code: null })).toBe('no_code');
		expect(signInProblem({ ...ok, cookieState: undefined })).toBe('no_cookies');
		expect(signInProblem({ ...ok, verifier: undefined })).toBe('no_cookies');
		expect(signInProblem({ ...ok, state: 'other' })).toBe('state_mismatch');
	});
});

describe('shouldRetry', () => {
	it('retries lost or stale login cookies once', () => {
		expect(shouldRetry('no_cookies', 'abc')).toBe(true);
		expect(shouldRetry('state_mismatch', 'abc')).toBe(true);
		expect(shouldRetry('no_cookies', `abc${RETRY_MARK}`)).toBe(false);
	});

	it('does not retry what Google refused, or a success', () => {
		expect(shouldRetry('cancelled', 'abc')).toBe(false);
		expect(shouldRetry('google_error', 'abc')).toBe(false);
		expect(shouldRetry(null, 'abc')).toBe(false);
	});
});
