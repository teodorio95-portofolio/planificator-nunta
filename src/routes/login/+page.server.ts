import { fail, redirect } from '@sveltejs/kit';
import { safeNext } from '#lib/access.ts';
import {
	authEnabled,
	clearFailures,
	googleEnabled,
	mayTry,
	passwordAccount,
	passwordEnabled,
	passwordRole,
	recordFailure,
	startSession
} from '#lib/server/auth.ts';
import { getSettings } from '#lib/server/db.ts';
import type { Actions, PageServerLoad } from './$types';

const ERRORS: Record<string, string> = {
	denied: 'Acest cont Google nu are acces. Cereți-le mirilor să vă adauge.',
	cancelled: 'Ați anulat autentificarea Google.',
	google: 'Autentificarea Google nu a reușit. Încercați din nou.'
};

export const load: PageServerLoad = ({ url, locals }) => {
	const next = safeNext(url.searchParams.get('next'));
	if (!authEnabled() || locals.user) redirect(303, next);
	const s = getSettings();
	return {
		next,
		google: googleEnabled(),
		password: passwordEnabled(),
		error: ERRORS[url.searchParams.get('error') ?? ''] ?? null,
		// For the link preview: the names are already public on every RSVP page.
		couple: [s.partner1, s.partner2].filter(Boolean)
	};
};

export const actions: Actions = {
	password: async ({ request, cookies, getClientAddress, url }) => {
		if (!passwordEnabled()) return fail(400, { error: 'Intrarea cu parolă nu este activată.' });
		const address = getClientAddress();
		if (!mayTry(address)) return fail(429, { error: 'Prea multe încercări. Reîncercați peste un sfert de oră.' });
		const role = passwordRole(String((await request.formData()).get('password') ?? ''));
		if (!role) {
			recordFailure(address);
			return fail(400, { error: 'Parola nu este corectă.' });
		}
		clearFailures(address);
		// hooks.server.ts has already checked that Origin is this host, so its scheme is the page's.
		const plainHttp = request.headers.get('origin')?.startsWith('http:') ?? false;
		startSession(cookies, passwordAccount(role), request.headers.get('user-agent') ?? '', !plainHttp);
		redirect(303, safeNext(url.searchParams.get('next')));
	}
};
