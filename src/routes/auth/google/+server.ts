import { generateCodeVerifier, generateState } from 'arctic';
import { RETRY_MARK, safeNext } from '#lib/access.ts';
import { error } from '@sveltejs/kit';
import { google, googleEnabled } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

// Short-lived cookies tie Google's answer to this browser (state) and to this attempt (PKCE).
// `lax` still sends them on the top-level redirect back from accounts.google.com.
const TEMP = { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 600 } as const;

export const GET: RequestHandler = ({ url, cookies }) => {
	if (!googleEnabled()) error(404, 'Google sign-in nu este configurat.');
	// The automatic second attempt skips the account picker: Google returns at once if signed in.
	const retry = url.searchParams.get('retry') === '1';
	const state = generateState() + (retry ? RETRY_MARK : '');
	const verifier = generateCodeVerifier();
	const target = google(url.origin).createAuthorizationURL(state, verifier, ['openid', 'email']);
	if (!retry) target.searchParams.set('prompt', 'select_account');
	cookies.set('google_state', state, TEMP);
	cookies.set('google_verifier', verifier, TEMP);
	cookies.set('login_next', safeNext(url.searchParams.get('next')), TEMP);
	// A plain Response: Kit's redirect() refuses another host.
	return new Response(null, { status: 302, headers: { location: target.toString() } });
};
