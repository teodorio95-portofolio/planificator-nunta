import { fail } from '@sveltejs/kit';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { attendanceShare, headcount } from '#lib/calc.ts';
import { BAND, FEATURES, HEAD_TABLE, hallLayout, tableCapacities } from '#lib/floorplan.ts';
import { all, get, getSettings, planImagePath, run, transaction } from '#lib/server/db.ts';
import { byCategory, type Category, type FloorItem, type Side, type Subcategory, type Table } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export interface SeatGuest {
	id: number;
	name: string;
	is_child: number;
	attending: number | null;
	table_id: number | null;
	household_id: number;
	household: string;
	side: Side;
	category: Category;
	subcategory: Subcategory;
}

// Declined guests never need a seat.
// Grouped by category, then bride's side before groom's, so each group can fill a table together.
const seatGuests = () =>
	all<SeatGuest>(
		`SELECT g.id, g.name, g.is_child, g.attending, g.table_id, g.household_id, h.name AS household,
		        h.side, h.category, h.subcategory
		 FROM guests g JOIN households h ON h.id = g.household_id
		 WHERE g.attending IS NOT 0
		 ORDER BY CASE h.side WHEN 'mireasa' THEN 0 WHEN 'mire' THEN 1 ELSE 2 END, h.name COLLATE NOCASE, g.id`
	).sort(byCategory);

/** People to seat by the attendance estimate in Setări, the same number Acasă and Buget plan for. */
function expectedPeople(guests: SeatGuest[]): number {
	const hc = headcount(guests, attendanceShare(getSettings()));
	return hc.expectedAdults + hc.expectedChildren;
}

export const load: PageServerLoad = () => {
	const guests = seatGuests();
	return {
		tables: all<Table>('SELECT * FROM tables ORDER BY id'),
		items: all<FloorItem>('SELECT * FROM floor_items ORDER BY id'),
		hasPlanImage: existsSync(planImagePath()),
		guests,
		expected: expectedPeople(guests)
	};
};

const shape = (v: FormDataEntryValue | null) => (v === 'dreptunghiulara' ? 'dreptunghiulara' : 'rotunda');
const capacity = (v: FormDataEntryValue | null) => Math.min(60, Math.max(1, Number(v) || 10));
const pct = (v: FormDataEntryValue | null) => Math.min(100, Math.max(0, Number(v) || 0));
const int = (v: FormDataEntryValue | null, min: number, max: number) =>
	Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

export const actions: Actions = {
	addTables: async ({ request }) => {
		const f = await request.formData();
		const count = int(f.get('count'), 1, 50);
		const n = get<{ n: number }>('SELECT COUNT(*) AS n FROM tables')!.n;
		transaction(() => {
			for (let i = 0; i < count; i++) {
				// Dropped in a loose grid; arrange mode moves them into place.
				const k = n + i;
				run(
					'INSERT INTO tables (name, capacity, shape, x, y) VALUES (?, ?, ?, ?, ?)',
					`Masa ${k + 1}`,
					capacity(f.get('capacity')),
					shape(f.get('shape')),
					8 + (k % 9) * 10.5,
					10 + (Math.floor(k / 9) % 7) * 12
				);
			}
		});
	},

	/**
	 * Builds the real hall: as many round tables as the attendance estimate needs (of `capacity`
	 * seats, some one larger when the hall's slots run out), split around the dance floor, plus the
	 * couple's table and the hall's fixed features. Replaces the current plan (guests become unseated).
	 */
	template: async ({ request }) => {
		const f = await request.formData();
		const seats = capacity(f.get('capacity'));
		const head = int(f.get('head_seats'), 0, 40);
		const band = f.get('band') === 'on';
		const layout = hallLayout(tableCapacities(expectedPeople(seatGuests()) - head, seats));
		transaction(() => {
			run('UPDATE guests SET table_id = NULL');
			run('DELETE FROM tables');
			run('DELETE FROM floor_items');
			for (const t of layout) {
				run(
					"INSERT INTO tables (name, capacity, shape, x, y) VALUES (?, ?, 'rotunda', ?, ?)",
					t.name,
					t.capacity,
					t.x,
					t.y
				);
			}
			if (head) {
				run(
					"INSERT INTO tables (name, capacity, shape, x, y) VALUES ('Masa mirilor', ?, 'dreptunghiulara', ?, ?)",
					head,
					HEAD_TABLE.x,
					HEAD_TABLE.y
				);
			}
			for (const it of band ? [...FEATURES, BAND] : FEATURES) {
				run('INSERT INTO floor_items (label, x, y, w, h) VALUES (?, ?, ?, ?, ?)', it.label, it.x, it.y, it.w, it.h);
			}
		});
		const total = layout.reduce((s, t) => s + t.capacity, 0) + head;
		return { message: `Planul a fost generat: ${layout.length} mese, ${total} locuri cu masa mirilor.` };
	},

	position: async ({ request }) => {
		const f = await request.formData();
		const table = f.get('type') === 'item' ? 'floor_items' : 'tables';
		run(`UPDATE ${table} SET x = ?, y = ? WHERE id = ?`, pct(f.get('x')), pct(f.get('y')), Number(f.get('id')));
	},

	updateTable: async ({ request }) => {
		const f = await request.formData();
		const name = String(f.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Masa are nevoie de un nume.' });
		run(
			'UPDATE tables SET name = ?, capacity = ?, shape = ? WHERE id = ?',
			name,
			capacity(f.get('capacity')),
			shape(f.get('shape')),
			Number(f.get('id'))
		);
	},

	deleteTable: async ({ request }) => {
		run('DELETE FROM tables WHERE id = ?', Number((await request.formData()).get('id')));
	},

	addItem: async ({ request }) => {
		const label = String((await request.formData()).get('label') ?? '').trim() || 'Element';
		run('INSERT INTO floor_items (label, x, y, w, h) VALUES (?, 50, 50, 14, 10)', label);
	},

	updateItem: async ({ request }) => {
		const f = await request.formData();
		run(
			'UPDATE floor_items SET label = ?, w = ?, h = ? WHERE id = ?',
			String(f.get('label') ?? '').trim() || 'Element',
			Math.max(3, pct(f.get('w'))),
			Math.max(3, pct(f.get('h'))),
			Number(f.get('id'))
		);
	},

	deleteItem: async ({ request }) => {
		run('DELETE FROM floor_items WHERE id = ?', Number((await request.formData()).get('id')));
	},

	uploadPlan: async ({ request }) => {
		const file = (await request.formData()).get('image');
		if (!(file instanceof File) || file.size === 0) return fail(400, { error: 'Alegeți o imagine.' });
		if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail(400, { error: 'Doar JPG, PNG sau WebP.' });
		if (file.size > 8_000_000) return fail(400, { error: 'Imaginea e prea mare (max. 8 MB).' });
		writeFileSync(planImagePath(), Buffer.from(await file.arrayBuffer()));
	},

	removePlan: async () => {
		rmSync(planImagePath(), { force: true });
	},

	assign: async ({ request }) => {
		const f = await request.formData();
		const ids = String(f.get('guest_ids') ?? '')
			.split(',')
			.map(Number)
			.filter(Boolean);
		const tableId = Number(f.get('table_id')) || null;
		transaction(() => {
			for (const id of ids) run('UPDATE guests SET table_id = ? WHERE id = ?', tableId, id);
		});
	}
};
