import { error, fail } from '@sveltejs/kit';
import { mediaUrls } from '#lib/server/media.ts';
import { getSettings, run, transaction } from '#lib/server/db.ts';
import { allSchedule, householdByToken } from '#lib/server/queries.ts';
import { MENUS, type Menu } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

function findHousehold(token: string) {
	const household = householdByToken(token);
	if (!household) error(404, 'Linkul de confirmare nu este valid.');
	return household;
}

export const load: PageServerLoad = ({ params }) => {
	const h = findHousehold(params.token);
	const s = getSettings();
	// Only what a guest needs: no budget, other guests or gifts leave the server.
	return {
		household: {
			name: h.name,
			responded: !!h.responded_at,
			note: h.rsvp_note,
			guests: h.guests.map((g) => ({
				id: g.id,
				name: g.name,
				is_child: g.is_child,
				attending: g.attending,
				menu: g.menu,
				dietary: g.dietary
			}))
		},
		event: {
			partner1: s.partner1,
			partner2: s.partner2,
			monogram: s.monogram,
			wedding_date: s.wedding_date,
			venue: s.venue,
			venue_address: s.venue_address,
			ceremony: s.ceremony,
			rsvp_deadline: s.rsvp_deadline
		},
		// The moments ticked "Pe invitație" in Desfășurător; people and notes stay with the couple.
		program: allSchedule()
			.filter((it) => it.on_invite)
			.map((it) => ({ id: it.id, start_time: it.start_time, title: it.title, place: it.place })),
		media: mediaUrls()
	};
};

export const actions: Actions = {
	default: async ({ request, params }) => {
		const h = findHousehold(params.token);
		const f = await request.formData();
		const answers = h.guests.map((g) => ({ g, v: String(f.get(`attending_${g.id}`) ?? '') }));
		if (answers.some((a) => a.v !== '1' && a.v !== '0')) {
			return fail(400, { error: 'Vă rugăm să alegeți un răspuns pentru fiecare persoană.' });
		}
		transaction(() => {
			for (const { g, v } of answers) {
				const menu = String(f.get(`menu_${g.id}`) ?? g.menu);
				run(
					'UPDATE guests SET attending = ?, menu = ?, dietary = ? WHERE id = ? AND household_id = ?',
					Number(v),
					(menu in MENUS ? menu : g.menu) as Menu,
					String(f.get(`dietary_${g.id}`) ?? '').slice(0, 200),
					g.id,
					h.id
				);
			}
			run(
				"UPDATE households SET rsvp_note = ?, responded_at = datetime('now') WHERE id = ?",
				String(f.get('note') ?? '').slice(0, 1000),
				h.id
			);
		});
		return { saved: true };
	}
};
