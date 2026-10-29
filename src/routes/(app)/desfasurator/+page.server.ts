import { fail } from '@sveltejs/kit';
import { isTime, shiftTime } from '#lib/schedule.ts';
import { run, transaction } from '#lib/server/db.ts';
import { allSchedule } from '#lib/server/queries.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ schedule: allSchedule() });

/** start, end, title, place, people, notes, on_invite — or an error message for the form. */
function itemFields(f: FormData): (string | number)[] | string {
	const text = (k: string) => String(f.get(k) ?? '').trim();
	const [start, end, title] = [text('start_time'), text('end_time'), text('title')];
	if (!title) return 'Scrieți ce se întâmplă.';
	if (!isTime(start)) return 'Alegeți ora de început.';
	if (end && !isTime(end)) return 'Ora de final nu este validă.';
	return [start, end, title, text('place'), text('people'), text('notes'), f.get('on_invite') ? 1 : 0];
}

export const actions: Actions = {
	add: async ({ request }) => {
		const fields = itemFields(await request.formData());
		if (typeof fields === 'string') return fail(400, { error: fields });
		run(
			'INSERT INTO schedule (start_time, end_time, title, place, people, notes, on_invite) VALUES (?, ?, ?, ?, ?, ?, ?)',
			...fields
		);
	},

	update: async ({ request }) => {
		const f = await request.formData();
		const fields = itemFields(f);
		if (typeof fields === 'string') return fail(400, { error: fields });
		run(
			'UPDATE schedule SET start_time = ?, end_time = ?, title = ?, place = ?, people = ?, notes = ?, on_invite = ? WHERE id = ?',
			...fields,
			Number(f.get('id'))
		);
	},

	// Running late: move this moment and everything after it by the same number of minutes.
	shift: async ({ request }) => {
		const f = await request.formData();
		const id = Number(f.get('id'));
		const minutes = Number(f.get('minutes'));
		if (!Number.isInteger(minutes) || minutes === 0) return fail(400, { error: 'Alegeți cu cât mutați.' });
		const items = allSchedule();
		const from = items.findIndex((it) => it.id === id);
		if (from < 0) return fail(404, { error: 'Momentul nu mai există.' });
		transaction(() => {
			for (const it of items.slice(from)) {
				run(
					'UPDATE schedule SET start_time = ?, end_time = ? WHERE id = ?',
					shiftTime(it.start_time, minutes),
					shiftTime(it.end_time, minutes),
					it.id
				);
			}
		});
	},

	delete: async ({ request }) => {
		run('DELETE FROM schedule WHERE id = ?', Number((await request.formData()).get('id')));
	}
};
