import { fail } from '@sveltejs/kit';
import { parseAmount } from '#lib/notes.ts';
import { run } from '#lib/server/db.ts';
import { allNotes } from '#lib/server/queries.ts';
import type { Actions, PageServerLoad } from './$types';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const id = (f: FormData, k = 'id') => Number(f.get(k));

/** Marks a note as just changed, and by whom. */
const touch = (noteId: number, email: string) =>
	run("UPDATE notes SET updated_by = ?, updated_at = datetime('now') WHERE id = ?", email, noteId);

// Admin-only, like Setări (see #lib/access.ts).
export const load: PageServerLoad = () => ({ notes: allNotes() });

export const actions: Actions = {
	// A blank page, opened right away; the title is optional, as in Notes.
	add: async ({ locals }) => {
		const { lastInsertRowid } = run("INSERT INTO notes (title, updated_by) VALUES ('', ?)", locals.user!.email);
		return { id: Number(lastInsertRowid) };
	},

	// Sent in the background while typing, so it keeps the text exactly as typed.
	save: async ({ request, locals }) => {
		const f = await request.formData();
		run('UPDATE notes SET title = ?, body = ? WHERE id = ?', text(f, 'title'), String(f.get('body') ?? ''), id(f));
		touch(id(f), locals.user!.email);
	},

	pin: async ({ request }) => {
		run('UPDATE notes SET pinned = 1 - pinned WHERE id = ?', id(await request.formData()));
	},

	delete: async ({ request }) => {
		run('DELETE FROM notes WHERE id = ?', id(await request.formData()));
	},

	addRow: async ({ request, locals }) => {
		const f = await request.formData();
		const item = text(f, 'item');
		if (!item) return fail(400, { error: 'Scrieți ce calculați (ex. trandafiri).' });
		// An empty count means one: "1 arcadă" needs no "× 1".
		run(
			'INSERT INTO note_rows (note_id, item, per_unit, unit, units, price) VALUES (?, ?, ?, ?, ?, ?)',
			id(f, 'note'),
			item,
			text(f, 'per_unit') ? parseAmount(f.get('per_unit')) : 1,
			text(f, 'unit'),
			text(f, 'units') ? parseAmount(f.get('units')) : 1,
			parseAmount(f.get('price'))
		);
		touch(id(f, 'note'), locals.user!.email);
	},

	saveRow: async ({ request, locals }) => {
		const f = await request.formData();
		const item = text(f, 'item');
		if (!item) return fail(400, { error: 'Rândul are nevoie de un nume.' });
		run(
			'UPDATE note_rows SET item = ?, per_unit = ?, unit = ?, units = ?, price = ? WHERE id = ?',
			item,
			parseAmount(f.get('per_unit')),
			text(f, 'unit'),
			parseAmount(f.get('units')),
			parseAmount(f.get('price')),
			id(f)
		);
		touch(id(f, 'note'), locals.user!.email);
	},

	deleteRow: async ({ request, locals }) => {
		const f = await request.formData();
		run('DELETE FROM note_rows WHERE id = ?', id(f));
		touch(id(f, 'note'), locals.user!.email);
	}
};
