import { error } from '@sveltejs/kit';
import { calendarFile } from '#lib/calendar.ts';
import { getSettings } from '#lib/server/db.ts';
import { householdByToken } from '#lib/server/queries.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	if (!householdByToken(params.token)) error(404, 'Linkul nu este valid.');
	const s = getSettings();
	if (!s.wedding_date) error(404, 'Data nunții nu este stabilită încă.');
	const couple = [s.partner1, s.partner2].filter(Boolean).join(' & ');
	const ics = calendarFile(
		{
			date: s.wedding_date,
			title: couple ? `Nunta ${couple}` : 'Nunta',
			location: s.venue,
			description: 'Save the date! Invitația cu toate detaliile vine în curând.'
		},
		// One UID for the wedding, not per family: a forwarded link updates the same event.
		`save-the-date-${s.wedding_date}@${url.hostname}`
	);
	return new Response(ics, {
		headers: {
			'content-type': 'text/calendar; charset=utf-8',
			'content-disposition': 'inline; filename="nunta.ics"',
			'cache-control': 'no-store'
		}
	});
};
