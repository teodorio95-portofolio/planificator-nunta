import { error } from '@sveltejs/kit';
import { mediaUrls } from '#lib/server/media.ts';
import { getSettings } from '#lib/server/db.ts';
import { householdByToken } from '#lib/server/queries.ts';
import type { PageServerLoad } from './$types';

// The save the date: the same link token as the RSVP, so each family gets its own envelope.
export const load: PageServerLoad = ({ params }) => {
	const h = householdByToken(params.token);
	if (!h) error(404, 'Linkul nu este valid.');
	const s = getSettings();
	// Only the family's name and the day: the venue and program wait for the invitation.
	return {
		household: { name: h.name },
		event: {
			partner1: s.partner1,
			partner2: s.partner2,
			monogram: s.monogram,
			wedding_date: s.wedding_date,
			venue: s.venue,
			ceremony: s.ceremony
		},
		media: mediaUrls()
	};
};
