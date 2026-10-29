import { redirect } from '@sveltejs/kit';
import { RETRY_MARK, safeNext, shouldRetry, signInProblem } from '#lib/access.ts';
import { roleOf, startSession, verifiedEmail } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

const TEMP_COOKIES = ['google_state', 'google_verifier', 'login_next'];

export const GET: RequestHandler = async ({ url, cookies, request }) => {
	const state = cookies.get('google_state');
	const verifier = cookies.get('google_verifier');
	const next = safeNext(cookies.get('login_next'));
	for (const name of TEMP_COOKIES) cookies.delete(name, { path: '/' });

	const code = url.searchParams.get('code');
	const returnedState = url.searchParams.get('state');
	const problem = signInProblem({
		error: url.searchParams.get('error'),
		code,
		state: returnedState,
		cookieState: state,
		verifier
	});
	if (problem || !code || !verifier) {
		const retry = shouldRetry(problem, returnedState);
		console.warn(`google sign-in: ${problem}${returnedState?.endsWith(RETRY_MARK) ? ' (on retry)' : ''}${retry ? ', retrying' : ''}`);
		if (retry) redirect(303, `/auth/google?retry=1&next=${encodeURIComponent(next)}`);
		redirect(303, `/login?error=${problem === 'cancelled' ? 'cancelled' : 'google'}`);
	}
	const email = await verifiedEmail(url.origin, code, verifier);
	if (!email) redirect(303, '/login?error=google');
	if (!roleOf(email)) {
		console.warn(`sign-in refused for ${email}: not on any e-mail list or among the added readers`);
		redirect(303, '/login?error=denied');
	}
	startSession(cookies, email, request.headers.get('user-agent') ?? '');
	redirect(303, next);
};
