import { toCsv } from '#lib/csv.ts';
import { all } from '#lib/server/db.ts';
import { householdsWithGuests } from '#lib/server/queries.ts';
import { CATEGORIES, MENUS, SIDES, SUBCATEGORIES } from '#lib/types.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const tables = new Map(all<{ id: number; name: string }>('SELECT id, name FROM tables').map((t) => [t.id, t.name]));
	const rows = householdsWithGuests().flatMap((h) =>
		h.guests.map((g) => [
			h.name,
			SIDES[h.side],
			h.category ? CATEGORIES[h.category] : '',
			h.subcategory ? SUBCATEGORIES[h.subcategory] : '',
			g.name,
			g.is_child ? 'da' : '',
			MENUS[g.menu],
			g.dietary,
			g.attending === 1 ? 'vine' : g.attending === 0 ? 'nu vine' : '',
			g.table_id ? (tables.get(g.table_id) ?? '') : '',
			h.phone,
			h.notes,
			h.tbd ? '?' : '',
			`${url.origin}/r/${h.token}`,
			`${url.origin}/s/${h.token}`
		])
	);
	const header = [
		'familie',
		'parte',
		'categorie',
		'subcategorie',
		'nume',
		'copil',
		'meniu',
		'restrictii',
		'prezenta',
		'masa',
		'telefon',
		'observatii',
		'tbd',
		'link',
		'save_the_date'
	];
	return new Response(toCsv(header, rows), {
		headers: {
			'content-type': 'text/csv; charset=utf-8',
			'content-disposition': 'attachment; filename="invitati.csv"'
		}
	});
};
