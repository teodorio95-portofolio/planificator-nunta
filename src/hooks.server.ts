import { error, redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { allowed, asSeenBy, formAction, PREVIEW_COOKIE } from '#lib/access.ts';
import { authEnabled, authProblems, currentUser, openAccess } from '#lib/server/auth.ts';
import { get } from '#lib/server/db.ts';
import { seedDemo } from '#lib/server/demo.ts';
import { MODE_COOKIE, modeFrom, THEME_COOKIE, themeFrom } from '#lib/theme.ts';

// Guests reach only their RSVP and save the date pages (and the photo and music on them); everything else
// needs a sign-in. The privacy note is public because Google's sign-in screen links to it.
const isPublic = (path: string) =>
	path === '/login' ||
	path === '/health' ||
	path === '/confidentialitate' ||
	path.startsWith('/r/') ||
	path.startsWith('/s/') ||
	path.startsWith('/media/') ||
	path.startsWith('/auth/');

// Logged once at start-up, so a typo in the sign-in settings shows in `docker logs`.
for (const problem of authProblems()) console.warn(`sign-in: ${problem}`);
if (!authEnabled() && !openAccess())
	console.warn('sign-in: no ADMIN_PASSWORD or GOOGLE_CLIENT_ID set; the app stays locked (AUTH_DISABLED=true opens it).');

// A made-up wedding to try the app with (never set at build time, so the build opens no database).
if (process.env.DEMO_DATA === 'true') seedDemo(get<{ n: number }>('SELECT COUNT(*) AS n FROM households')?.n === 0);

/** POSTs a browser can send cross-site without CORS: these must come from our own pages. */
const FORM_TYPES = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain'];

/**
 * Kit's own CSRF check compares against an origin it guesses as https (adapter-node), which refuses
 * every form on plain http://localhost. This one compares the Origin's host with the Host header,
 * so the same image works on a laptop and behind a TLS proxy.
 */
function crossSite(request: Request): boolean {
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return false;
	const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (!FORM_TYPES.includes(type)) return false;
	const origin = request.headers.get('origin');
	// Behind a proxy that rewrites Host, adapter-node's HOST_HEADER names the one carrying the public host.
	const host = request.headers.get(process.env.HOST_HEADER || 'host');
	try {
		return !origin || new URL(origin).host !== host;
	} catch {
		return true;
	}
}

const LOCKED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Configurare necesară</title><body style="font:16px/1.5 system-ui;max-width:36rem;margin:15vh auto;padding:0 16px">
<h1>Aplicația nu are încă o parolă</h1>
<p>Setați <code>ADMIN_PASSWORD</code> (minim 8 caractere) sau Google sign-in (<code>GOOGLE_CLIENT_ID</code>)
în <code>.env</code> și reporniți containerul. Detalii în README.</p></body>`;

export const handle: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	if (crossSite(event.request)) return new Response('Cross-site form submissions are forbidden', { status: 403 });
	if (!authEnabled() && !openAccess() && !isPublic(path))
		return new Response(LOCKED, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
	// An admin previewing as a reader is a reader everywhere below: rights, nav, hidden amounts.
	const signedIn = currentUser(event.cookies);
	const user = (event.locals.user = signedIn && asSeenBy(signedIn, event.cookies.get(PREVIEW_COOKIE)));
	// Rendered into <html data-theme data-mode> so the chosen look is there from the first paint.
	const theme = (event.locals.theme = themeFrom(event.cookies.get(THEME_COOKIE)));
	const mode = (event.locals.mode = modeFrom(event.cookies.get(MODE_COOKIE)));
	if (!isPublic(path)) {
		if (!user) redirect(303, `/login?next=${encodeURIComponent(path)}`);
		if (!allowed(user.role, event.request.method, path, formAction(event.url.searchParams)))
			error(403, 'Contul vostru nu are acces aici.');
	}
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%nunta.theme%', theme).replace('%nunta.mode%', mode)
	});
	response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	// RSVP links carry their token in the URL: never leak it via Referer (e.g. to Google Maps).
	// Not `no-referrer`: with it browsers send `Origin: null` on form POSTs and the CSRF check fails.
	response.headers.set('referrer-policy', 'same-origin');
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('content-security-policy', "frame-ancestors 'none'");
	return response;
};
