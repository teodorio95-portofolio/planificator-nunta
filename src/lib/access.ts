// Who may do what. Pure functions, shared by the hooks, the login flow and the tests.

export type Role = 'admin' | 'editor' | 'reader';
/** `previewing`: an admin looking at the app as a reader ("Vezi ca reader"), with a reader's rights. */
export type User = { email: string; role: Role; previewing?: boolean };

// The reader preview: a cookie the admin sets and clears through PREVIEW_PATH.
export const PREVIEW_PATH = '/vezi-ca';
export const PREVIEW_COOKIE = 'nunta_view_as';

/** The user the app acts for: an admin who asked to see it as a reader gets exactly a reader's rights. */
export function asSeenBy(user: User, preview: string | undefined): User {
	return user.role === 'admin' && preview === 'reader' ? { ...user, role: 'reader', previewing: true } : user;
}

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Administrator',
	editor: 'Editor',
	reader: 'Doar citire'
};

/** Sessions opened with a role password are stored under `password:<role>:<fingerprint>`. */
export const PASSWORD_ACCOUNT = 'password:';

/** What to show for a session's account: the e-mail, or "Parolă · Editor" for a password sign-in. */
export function passwordAccountLabel(account: string): string {
	if (!account.startsWith(PASSWORD_ACCOUNT)) return account;
	const role = account.split(':')[1] as Role;
	return `Parolă · ${ROLE_LABELS[role] ?? role}`;
}

const list = (v: string | undefined) => [
	...new Set(
		(v ?? '')
			.split(',')
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean)
	)
];

const LIST_VARS: Record<Role, string> = {
	admin: 'ADMIN_EMAILS',
	editor: 'EDITOR_EMAILS',
	reader: 'READER_EMAILS'
};

/** The three e-mail lists as the app reads them, for the admin's read-only view. */
export function accessLists(env: Record<string, string | undefined> = process.env) {
	return (Object.keys(LIST_VARS) as Role[]).map((role) => ({
		role,
		variable: LIST_VARS[role],
		emails: list(env[LIST_VARS[role]])
	}));
}

/** A typed e-mail, trimmed and lowercased, or null if it cannot be one. */
export function cleanEmail(v: string): string | null {
	const e = v.trim().toLowerCase();
	return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e) ? e : null;
}

/**
 * Role from the comma-separated e-mail lists in env; null = no access.
 * Readers added in Setări live in the database: see roleOf in #lib/server/auth.ts.
 */
export function roleFor(email: string, env: Record<string, string | undefined> = process.env): Role | null {
	const e = email.trim().toLowerCase();
	return accessLists(env).find((l) => l.emails.includes(e))?.role ?? null;
}

// Settings, the full database backup and the session list; the couple's working notes.
const ADMIN_ONLY = ['/setari', '/notite'];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

// The few form actions a reader may still send (page path → action names): adding a task is welcome,
// ticking, editing or deleting stays with the couple.
const READER_ACTIONS: Record<string, string[]> = { '/sarcini': ['add'] };

/** The form action a POST names (`?/add` → "add"), or null for any other request. */
export const formAction = (search: URLSearchParams) =>
	[...search.keys()].find((k) => k.startsWith('/'))?.slice(1) || null;

/**
 * Whether a signed-in role may make this request. Readers only look, and get no bulk export,
 * except for the form actions in READER_ACTIONS.
 */
export function allowed(role: Role, method: string, path: string, action: string | null = null): boolean {
	// The preview switch checks the real role itself: a previewing admin is a reader here.
	if (path === '/logout' || path === PREVIEW_PATH) return true;
	if (ADMIN_ONLY.some((p) => under(path, p))) return role === 'admin';
	if (role !== 'reader') return true;
	if (method === 'POST' && action) return READER_ACTIONS[path]?.includes(action) ?? false;
	return (method === 'GET' || method === 'HEAD') && path !== '/invitati/export.csv';
}

/** Whether a role may send this page's form action, for the UI to hide what would be refused. */
export const canAct = (role: Role, path: string, action: string) => allowed(role, 'POST', path, action);

/** Only same-site paths after sign-in: never `//evil.example` or an absolute URL. */
export const safeNext = (next: string | null | undefined) =>
	next?.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : '/';

export type SignInProblem = 'cancelled' | 'google_error' | 'no_code' | 'no_cookies' | 'state_mismatch';

/** Why Google's redirect back cannot be used, or null if it can. Only names, never values, get logged. */
export function signInProblem(p: {
	error: string | null;
	code: string | null;
	state: string | null;
	cookieState: string | undefined;
	verifier: string | undefined;
}): SignInProblem | null {
	if (p.error) return p.error === 'access_denied' ? 'cancelled' : 'google_error';
	if (!p.code) return 'no_code';
	if (!p.cookieState || !p.verifier) return 'no_cookies';
	if (p.state !== p.cookieState) return 'state_mismatch';
	return null;
}

// A second attempt carries this mark in `state` (Google echoes it back), so it cannot loop.
export const RETRY_MARK = '.retry';

/**
 * Lost or stale login cookies are worth one automatic second attempt: by then the person is
 * signed in to Google, so it comes straight back. Anything Google refused is not.
 */
export const shouldRetry = (problem: SignInProblem | null, state: string | null) =>
	(problem === 'no_cookies' || problem === 'state_mismatch') && !state?.endsWith(RETRY_MARK);

/** A rough "Chrome pe Mac" from a User-Agent, enough to tell sessions apart. */
export function deviceName(ua: string): string {
	const os = /iPhone|iPad/.test(ua)
		? 'iPhone/iPad'
		: /Android/.test(ua)
			? 'Android'
			: /Mac OS X/.test(ua)
				? 'Mac'
				: /Windows/.test(ua)
					? 'Windows'
					: /Linux/.test(ua)
						? 'Linux'
						: 'dispozitiv necunoscut';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\/|FxiOS/.test(ua)
			? 'Firefox'
			: /Chrome\/|CriOS/.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: '';
	return browser ? `${browser} pe ${os}` : os;
}
