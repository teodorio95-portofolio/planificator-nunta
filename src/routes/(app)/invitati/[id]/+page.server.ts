import { error, fail, redirect } from '@sveltejs/kit';
import { parseCategory, parseMembers, parseSide } from '#lib/guests.ts';
import { all, get, newToken, run, transaction } from '#lib/server/db.ts';
import { addGuest } from '#lib/server/households.ts';
import { householdById } from '#lib/server/queries.ts';
import { MENUS, type Menu } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const household = householdById(Number(params.id));
	if (!household) error(404, 'Familia nu există.');
	const others = all<{ id: number; name: string }>(
		'SELECT id, name FROM households WHERE id != ? ORDER BY name COLLATE NOCASE',
		household.id
	);
	return { household, others };
};

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const attending = (v: string) => (v === '1' ? 1 : v === '0' ? 0 : null);

export const actions: Actions = {
	save: async ({ request, params }) => {
		const id = Number(params.id);
		const f = await request.formData();
		const name = str(f, 'name');
		if (!name) return fail(400, { error: 'Numele nu poate fi gol.' });
		const giftCurrency = str(f, 'gift_currency') === 'EUR' ? 'EUR' : 'RON';
		const giftMethod = ['numerar', 'transfer'].includes(str(f, 'gift_method')) ? str(f, 'gift_method') : '';
		const { category, subcategory } = parseCategory(str(f, 'category'), str(f, 'subcategory'));
		transaction(() => {
			run(
				`UPDATE households SET name = ?, side = ?, category = ?, subcategory = ?, phone = ?, notes = ?, tbd = ?,
				 invite_sent = ?, gift_amount = ?, gift_currency = ?, gift_method = ? WHERE id = ?`,
				name,
				parseSide(str(f, 'side')),
				category,
				subcategory,
				str(f, 'phone'),
				str(f, 'notes'),
				f.get('tbd') ? 1 : 0,
				f.get('invite_sent') ? 1 : 0,
				Math.max(0, Number(str(f, 'gift_amount').replace(',', '.')) || 0),
				giftCurrency,
				giftMethod,
				id
			);
			for (const gid of f.getAll('guest_id').map(Number)) {
				const menu = str(f, `menu_${gid}`);
				run(
					`UPDATE guests SET name = ?, is_child = ?, attending = ?, menu = ?, dietary = ?
					 WHERE id = ? AND household_id = ?`,
					str(f, `name_${gid}`) || '—',
					f.get(`child_${gid}`) ? 1 : 0,
					attending(str(f, `attending_${gid}`)),
					(menu in MENUS ? menu : 'standard') as Menu,
					str(f, `dietary_${gid}`),
					gid,
					id
				);
			}
		});
		return { message: 'Salvat.' };
	},

	addGuests: async ({ request, params }) => {
		const members = parseMembers(str(await request.formData(), 'members'));
		for (const m of members) addGuest(Number(params.id), m);
		return { message: members.length ? `Am adăugat ${members.length} ${members.length === 1 ? 'persoană' : 'persoane'}.` : undefined };
	},

	deleteGuest: async ({ request, params }) => {
		// Not `guest_id`: the surrounding save form already posts one hidden `guest_id` per member.
		const gid = Number((await request.formData()).get('delete_guest_id'));
		run('DELETE FROM guests WHERE id = ? AND household_id = ?', gid, Number(params.id));
	},

	move: async ({ request, params }) => {
		const id = Number(params.id);
		const f = await request.formData();
		const guestId = Number(f.get('move_guest_id'));
		const target = String(f.get('target') ?? '');
		const guest = get<{ name: string }>('SELECT name FROM guests WHERE id = ? AND household_id = ?', guestId, id);
		if (!guest) return fail(400, { error: 'Alegeți un membru.' });
		const targetId = transaction(() => {
			let tid = Number(target);
			if (target === 'new') {
				const h = get<{ side: string }>('SELECT side FROM households WHERE id = ?', id)!;
				tid = Number(
					run('INSERT INTO households (name, side, token) VALUES (?, ?, ?)', guest.name, h.side, newToken())
						.lastInsertRowid
				);
			} else if (!tid || tid === id || !get('SELECT 1 FROM households WHERE id = ?', tid)) {
				return null;
			}
			run('UPDATE guests SET household_id = ? WHERE id = ?', tid, guestId);
			return tid;
		});
		if (targetId === null) return fail(400, { error: 'Alegeți familia în care îl mutați.' });
		// A household left without members has no reason to exist (its RSVP link would be empty).
		if (!get('SELECT 1 FROM guests WHERE household_id = ?', id)) {
			run('DELETE FROM households WHERE id = ?', id);
			redirect(303, `/invitati/${targetId}`);
		}
		return { message: `${guest.name} a fost mutat(ă).` };
	},

	newLink: async ({ params }) => {
		run('UPDATE households SET token = ? WHERE id = ?', newToken(), Number(params.id));
		return { message: 'Link nou generat — cel vechi nu mai funcționează.' };
	},

	delete: async ({ params }) => {
		run('DELETE FROM households WHERE id = ?', Number(params.id));
		redirect(303, '/invitati');
	}
};
