import { beforeEach, describe, expect, it } from 'vitest';
import type { ImportedHousehold } from '../guests.ts';

process.env.DATABASE_PATH = ':memory:';
const { all, run } = await import('../server/db.ts');
const { createHousehold, replaceHouseholds } = await import('../server/households.ts');

const household = (name: string, guests: string[], extra: Partial<ImportedHousehold> = {}): ImportedHousehold => ({
	name,
	side: 'mire',
	category: 'prieteni',
	subcategory: '',
	phone: '',
	notes: '',
	tbd: 0,
	guests: guests.map((g) => ({ name: g, is_child: 0, menu: 'standard', dietary: '' })),
	...extra
});

const list = () =>
	all<{ name: string; notes: string; tbd: number; guests: string }>(
		`SELECT h.name, h.notes, h.tbd, group_concat(g.name || CASE WHEN g.attending = 1 THEN ' ✓' ELSE '' END, ', ') AS guests
		 FROM households h LEFT JOIN guests g ON g.household_id = h.id GROUP BY h.id ORDER BY h.id`
	);

describe('replaceHouseholds', () => {
	beforeEach(() => {
		run('DELETE FROM households');
		createHousehold({ name: 'Fam. Pop', side: 'mire', category: '', subcategory: '', guests: [{ name: 'Ana Pop', is_child: 0 }, { name: 'Ion Pop', is_child: 0 }] });
		createHousehold({ name: 'Marina?', side: 'mire', category: '', subcategory: '', guests: [{ name: 'Marina?', is_child: 0 }] });
		run("UPDATE guests SET attending = 1 WHERE name = 'Ana Pop'");
	});

	it('makes the list match the file and keeps the answers of the people who stay', () => {
		const r = replaceHouseholds([
			household('fam. pop', ['Ana Pop', 'Sot Ana'], { notes: '+1 de confirmat', tbd: 1 }),
			household('Fam. Ilie', ['Dan Ilie'])
		]);
		expect(r).toEqual({ added: 1, updated: 1, removed: 1, guestsAdded: 2, guestsRemoved: 2 });
		expect(list()).toEqual([
			{ name: 'Fam. Pop', notes: '+1 de confirmat', tbd: 1, guests: 'Ana Pop ✓, Sot Ana' },
			{ name: 'Fam. Ilie', notes: '', tbd: 0, guests: 'Dan Ilie' }
		]);
	});

	it('takes the child flag from the file and moves a default menu with it', () => {
		const pop = household('Fam. Pop', ['Ana Pop', 'Ion Pop']);
		pop.guests[1].is_child = 1;
		replaceHouseholds([pop]);
		expect(all('SELECT name, is_child, menu FROM guests ORDER BY id')).toEqual([
			{ name: 'Ana Pop', is_child: 0, menu: 'standard' },
			{ name: 'Ion Pop', is_child: 1, menu: 'copil' }
		]);
	});
});
