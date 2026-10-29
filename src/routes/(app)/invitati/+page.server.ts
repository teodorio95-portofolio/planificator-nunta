import { fail } from '@sveltejs/kit';
import { headcount, householdStatus, people } from '#lib/calc.ts';
import { parseCsv, toRecords } from '#lib/csv.ts';
import { groupCsvRows, parseCategory, parseMembers, parseSide } from '#lib/guests.ts';
import { get, run } from '#lib/server/db.ts';
import { createHousehold, importHouseholds, replaceHouseholds, setChild } from '#lib/server/households.ts';
import { householdsWithGuests } from '#lib/server/queries.ts';
import { readXlsx } from '#lib/server/xlsx.ts';
import type { Category, Subcategory } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

/** CSV, or the guest sheet saved as .xlsx (a zip: it starts with "PK"). */
async function readRows(file: File): Promise<Record<string, string>[]> {
	const buf = Buffer.from(await file.arrayBuffer());
	if (buf.subarray(0, 2).toString() !== 'PK') return parseCsv(buf.toString('utf8'));
	return toRecords(readXlsx(buf));
}

export const load: PageServerLoad = () => {
	const households = householdsWithGuests().map((h) => ({ ...h, status: householdStatus(h.guests) }));
	return { households, hc: headcount(people(households)) };
};

export const actions: Actions = {
	add: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		const members = parseMembers(String(f.get('members') ?? ''));
		if (!name) return fail(400, { error: 'Completați numele familiei.' });
		createHousehold({
			name,
			side: parseSide(String(f.get('side') ?? '')),
			...parseCategory(String(f.get('category') ?? ''), String(f.get('subcategory') ?? '')),
			phone: String(f.get('phone') ?? '').trim(),
			notes: String(f.get('notes') ?? '').trim(),
			tbd: f.get('tbd') ? 1 : 0,
			// A household typed without members is usually a single person.
			guests: members.length ? members : [{ name, is_child: 0 }]
		});
		return { message: `Am adăugat „${name}”.` };
	},

	import: async ({ request }) => {
		const f = await request.formData();
		const file = f.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Alegeți un fișier CSV sau Excel.' });
		if (file.size > 2_000_000) return fail(400, { error: 'Fișierul e prea mare (max. 2 MB).' });
		let rows: Record<string, string>[];
		try {
			rows = await readRows(file);
		} catch {
			return fail(400, { error: 'Nu am putut citi fișierul. Salvați-l ca .xlsx sau .csv.' });
		}
		const groups = groupCsvRows(rows);
		if (!groups.length) {
			return fail(400, { error: 'Nu am găsit rânduri. Verificați că există coloana „nume” sau „invitat”.' });
		}
		if (f.get('replace')) {
			const r = replaceHouseholds(groups);
			return {
				message:
					`Lista e acum cea din fișier: ${r.added} familii noi, ${r.updated} actualizate, ${r.removed} șterse; ` +
					`${r.guestsAdded} invitați adăugați, ${r.guestsRemoved} șterși.`
			};
		}
		const r = importHouseholds(groups);
		const categorised = r.categorised ? `, ${r.categorised} familii existente au primit categoria` : '';
		return { message: `Import: ${r.households} familii noi, ${r.guests} invitați noi${categorised}.` };
	},

	toggleInvite: async ({ request }) => {
		const f = await request.formData();
		run(
			'UPDATE households SET invite_sent = 1 - invite_sent WHERE id = ?',
			Number(f.get('id'))
		);
	},

	/** One cell of the sheet view: a household field, or a member's child flag or answer. */
	cell: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const value = String(f.get('value') ?? '').trim();
		const field = String(f.get('field'));
		if (field === 'child') return void setChild(id, value ? 1 : 0);
		// Marked by hand (phone call, in person): the same answer the RSVP page records.
		if (field === 'attending') {
			return void run('UPDATE guests SET attending = ? WHERE id = ?', value === '1' ? 1 : value === '0' ? 0 : null, id);
		}
		const h = get<{ category: Category; subcategory: Subcategory }>('SELECT category, subcategory FROM households WHERE id = ?', id);
		if (!h) return fail(404, { error: 'Familia nu mai există.' });
		if (field === 'side') run('UPDATE households SET side = ? WHERE id = ?', parseSide(value), id);
		else if (field === 'notes') run('UPDATE households SET notes = ? WHERE id = ?', value, id);
		else if (field === 'tbd') run('UPDATE households SET tbd = ? WHERE id = ?', value ? 1 : 0, id);
		else if (field === 'category' || field === 'subcategory') {
			const c = field === 'category' ? parseCategory(value, h.subcategory) : parseCategory(h.category, value);
			run('UPDATE households SET category = ?, subcategory = ? WHERE id = ?', c.category, c.subcategory, id);
		} else return fail(400, { error: 'Câmp necunoscut.' });
	}
};
