// Sign-in. Two ways in, either or both: Google, for e-mails on the lists in env, or a shared
// password per role (ADMIN_PASSWORD, EDITOR_PASSWORD, READER_PASSWORD), which needs no Google setup.
// With neither, the app is open as admin under `vite dev` or with AUTH_DISABLED=true, and locked otherwise.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { decodeIdToken, Google } from 'arctic';
import { deviceName, PASSWORD_ACCOUNT, passwordAccountLabel, roleFor, type Role, type User } from '#lib/access.ts';
import { all, get, run } from '#lib/server/db.ts';

const COOKIE = 'nunta_session';
const MAX_AGE_S = 60 * 60 * 24 * 30;
const LOCAL_ADMIN: User = { email: 'local', role: 'admin' };

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID);

const PASSWORD_VARS: [Role, string][] = [
	['admin', 'ADMIN_PASSWORD'],
	['editor', 'EDITOR_PASSWORD'],
	['reader', 'READER_PASSWORD']
];
/** Shorter passwords are ignored (with a warning at start-up): too easy to guess. */
export const MIN_PASSWORD = 8;

/** The configured role passwords, strongest role first. */
function passwords(): [Role, string][] {
	return PASSWORD_VARS.map(([role, v]) => [role, process.env[v] ?? ''] as [Role, string]).filter(
		([, pw]) => pw.length >= MIN_PASSWORD
	);
}

export const passwordEnabled = () => passwords().length > 0;
export const authEnabled = () => googleEnabled() || passwordEnabled();
/** Nothing to sign in with: open as admin for local development, or when explicitly asked to. */
export const openAccess = () => !authEnabled() && (import.meta.env.DEV || process.env.AUTH_DISABLED === 'true');

/** Problems with the sign-in setup, for the log at start-up and the locked page. */
export function authProblems(): string[] {
	const out: string[] = [];
	for (const [, v] of PASSWORD_VARS) {
		const pw = process.env[v];
		if (pw && pw.length < MIN_PASSWORD) out.push(`${v} is shorter than ${MIN_PASSWORD} characters and is ignored.`);
	}
	if (googleEnabled() && !process.env.GOOGLE_CLIENT_SECRET) out.push('GOOGLE_CLIENT_ID is set without GOOGLE_CLIENT_SECRET.');
	if (googleEnabled() && !process.env.ADMIN_EMAILS && !passwordEnabled())
		out.push('Google sign-in is on but ADMIN_EMAILS is empty: nobody can reach Setări.');
	return out;
}

const sha = (v: string) => createHash('sha256').update(v).digest();
/** Ties a password session to the password it was opened with: changing the password signs everyone out. */
const fingerprint = (pw: string) => sha(`planificator-nunta:${pw}`).toString('hex').slice(0, 16);

/** The role a typed password opens, or null. Compares every password in constant time. */
export function passwordRole(typed: string): Role | null {
	let found: Role | null = null;
	for (const [role, pw] of passwords()) {
		if (timingSafeEqual(sha(typed), sha(pw)) && !found) found = role;
	}
	return found;
}

/** The session account for a password sign-in: `password:<role>:<fingerprint>`. */
export function passwordAccount(role: Role): string {
	const pw = passwords().find(([r]) => r === role)?.[1] ?? '';
	return `${PASSWORD_ACCOUNT}${role}:${fingerprint(pw)}`;
}

// Failed password attempts per client address: 10 per quarter of an hour, then a pause.
const ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; since: number }>();

/** Whether this address may try a password now. */
export function mayTry(address: string, now = Date.now()): boolean {
	const f = failures.get(address);
	if (!f || now - f.since > WINDOW_MS) return true;
	return f.count < ATTEMPTS;
}

export function recordFailure(address: string, now = Date.now()) {
	const f = failures.get(address);
	if (!f || now - f.since > WINDOW_MS) failures.set(address, { count: 1, since: now });
	else f.count++;
}

export const clearFailures = (address: string) => failures.delete(address);

export const google = (origin: string) =>
	new Google(
		process.env.GOOGLE_CLIENT_ID ?? '',
		process.env.GOOGLE_CLIENT_SECRET ?? '',
		`${origin}/auth/google/callback`
	);

/** The verified e-mail behind an authorization code, or null if Google says no. */
export async function verifiedEmail(origin: string, code: string, verifier: string): Promise<string | null> {
	try {
		const tokens = await google(origin).validateAuthorizationCode(code, verifier);
		// Straight from Google's token endpoint over TLS, so the ID token needs no signature check.
		const claims = decodeIdToken(tokens.idToken()) as { email?: string; email_verified?: boolean };
		return claims.email && claims.email_verified ? claims.email.toLowerCase() : null;
	} catch (e) {
		console.error('google sign-in failed:', e instanceof Error ? e.message : e);
		return null;
	}
}

// The cookie holds a random token, the database only its hash: a leaked backup opens no session.
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * `secure`: false only for a sign-in sent from a plain http:// page (a home server on the LAN), where a
 * browser would drop a Secure cookie; adapter-node assumes https, so Kit would mark it Secure by default.
 */
export function startSession(cookies: Cookies, email: string, userAgent: string, secure = true) {
	const token = randomBytes(32).toString('base64url');
	run("DELETE FROM sessions WHERE expires_at <= datetime('now')");
	run(
		"INSERT INTO sessions (token_hash, email, user_agent, expires_at) VALUES (?, ?, ?, datetime('now', ?))",
		hash(token),
		email,
		userAgent.slice(0, 300),
		`+${MAX_AGE_S} seconds`
	);
	cookies.set(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE_S, secure });
}

/**
 * The signed-in user, or null. The role is looked up on every request, so taking an e-mail off
 * the lists locks it out at once, without waiting for its session to expire.
 */
export function currentUser(cookies: Cookies): User | null {
	if (!authEnabled()) return openAccess() ? LOCAL_ADMIN : null;
	const token = cookies.get(COOKIE);
	if (!token) return null;
	const row = get<{ email: string }>(
		"SELECT email FROM sessions WHERE token_hash = ? AND expires_at > datetime('now')",
		hash(token)
	);
	const role = row ? roleOf(row.email) : null;
	return row && role ? { email: passwordAccountLabel(row.email), role } : null;
}

/**
 * The role from the e-mail lists, else reader if the admin added the e-mail in Setări; null = no access.
 * A password account keeps its role only while that role's password is unchanged.
 */
export function roleOf(email: string): Role | null {
	const e = email.trim().toLowerCase();
	if (e.startsWith(PASSWORD_ACCOUNT)) {
		const role = e.split(':')[1] as Role;
		return passwords().some(([r]) => r === role) && passwordAccount(role) === e ? role : null;
	}
	return roleFor(e) ?? (get('SELECT 1 FROM readers WHERE email = ?', e) ? 'reader' : null);
}

export type AddedReader = { email: string; added_by: string; added_at: string };

export const addedReaders = () =>
	all<AddedReader>('SELECT email, added_by, added_at FROM readers ORDER BY email');

/** `email` must come through cleanEmail. */
export function addReader(email: string, addedBy: string) {
	run('INSERT OR IGNORE INTO readers (email, added_by) VALUES (?, ?)', email, addedBy);
}

/** Takes the reader off and, unless an e-mail list still lets them in, signs out their devices. */
export function removeReader(email: string) {
	run('DELETE FROM readers WHERE email = ?', email);
	if (!roleOf(email)) run('DELETE FROM sessions WHERE email = ?', email);
}

export function endSession(cookies: Cookies) {
	const token = cookies.get(COOKIE);
	if (token) run('DELETE FROM sessions WHERE token_hash = ?', hash(token));
	cookies.delete(COOKIE, { path: '/' });
}

export type SessionInfo = { id: number; email: string; device: string; created_at: string; current: boolean };

/** Live sessions for the admin page, newest first; `current` marks the one asking. */
export function activeSessions(cookies: Cookies): SessionInfo[] {
	const token = cookies.get(COOKIE);
	const mine = token ? hash(token) : '';
	return all<{ id: number; token_hash: string; email: string; user_agent: string; created_at: string }>(
		"SELECT id, token_hash, email, user_agent, created_at FROM sessions WHERE expires_at > datetime('now') ORDER BY created_at DESC, id DESC"
	).map((s) => ({
		id: s.id,
		email: passwordAccountLabel(s.email),
		device: deviceName(s.user_agent),
		created_at: s.created_at,
		current: s.token_hash === mine
	}));
}

export function revokeSession(id: number) {
	run('DELETE FROM sessions WHERE id = ?', id);
}
