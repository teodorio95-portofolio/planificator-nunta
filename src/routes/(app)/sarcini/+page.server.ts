import { fail } from '@sveltejs/kit';
import { daysBetween } from '#lib/calc.ts';
import { getSettings, run } from '#lib/server/db.ts';
import { allTasks } from '#lib/server/queries.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ tasks: allTasks() });

export const actions: Actions = {
	toggle: async ({ request }) => {
		run('UPDATE tasks SET done = 1 - done WHERE id = ?', Number((await request.formData()).get('id')));
	},

	add: async ({ request }) => {
		const f = await request.formData();
		const title = String(f.get('title') ?? '').trim();
		const due = String(f.get('due') ?? '');
		const weddingDate = getSettings().wedding_date;
		if (!title) return fail(400, { error: 'Scrieți sarcina.' });
		if (!weddingDate) return fail(400, { error: 'Setați întâi data nunții în Setări.' });
		// Stored relative to the wedding, so moving the date moves every deadline with it.
		const daysBefore = due ? daysBetween(due, weddingDate) : 0;
		run('INSERT INTO tasks (title, category, days_before) VALUES (?, ?, ?)', title, String(f.get('category') || 'Organizare'), daysBefore);
	},

	delete: async ({ request }) => {
		run('DELETE FROM tasks WHERE id = ?', Number((await request.formData()).get('id')));
	}
};
