import { getSettings } from '#lib/server/db.ts';
import { authEnabled } from '#lib/server/auth.ts';
import { mediaUrl } from '#lib/server/media.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals }) => {
	// hooks.server.ts lets no anonymous request into (app).
	const user = locals.user!;
	const settings = getSettings();
	return {
		// The nași + parents contribution counts in every estimate, but only the admin (Setări) sees the amount:
		// the family gets the app too. Every page's data reaches the browser, so it is blanked here, not just unshown.
		settings: user.role === 'admin' ? settings : { ...settings, family_contribution: 0 },
		authEnabled: authEnabled(),
		// Acasă runs it up behind the header; the header needs to know.
		cover: mediaUrl('cover'),
		user
	};
};
