import { error, redirect } from '@sveltejs/kit';
import { PREVIEW_COOKIE, safeNext } from '#lib/access.ts';
import { currentUser } from '#lib/server/auth.ts';
import type { RequestHandler } from './$types';

// "Vezi ca reader": the admin sees the app with a reader's rights until switching back.
// locals.user is already the previewed reader, so the real role comes from the session.
export const POST: RequestHandler = async ({ cookies, request }) => {
	if (currentUser(cookies)?.role !== 'admin') error(403, 'Doar administratorul poate vedea aplicația ca reader.');
	const f = await request.formData();
	if (f.get('as') === 'reader') {
		cookies.set(PREVIEW_COOKIE, 'reader', { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60 });
	} else {
		cookies.delete(PREVIEW_COOKIE, { path: '/' });
	}
	redirect(303, safeNext(f.get('next')?.toString()));
};
