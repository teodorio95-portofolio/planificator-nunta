// A made-up wedding for trying the app: with DEMO_DATA=true an empty database gets settings, families
// with a few answers already in, and a budget. Every name is invented.
import { BAND, FEATURES, HEAD_TABLE, hallLayout, tableCapacities } from '#lib/floorplan.ts';
import { all, newToken, run, saveSettings, transaction } from '#lib/server/db.ts';
import type { Category, ExpenseKind, Side, Subcategory } from '#lib/types.ts';

type DemoGuest = [name: string, child?: boolean];
type DemoHousehold = {
	name: string;
	side: Side;
	category: Category;
	subcategory?: Subcategory;
	guests: DemoGuest[];
	/** 1 = everyone coming, 0 = declined, undefined = no answer yet. */
	answer?: 0 | 1;
};

const HOUSEHOLDS: DemoHousehold[] = [
	{ name: 'Ana și Mihai', side: 'comun', category: 'miri', guests: [['Ana Popescu'], ['Mihai Ionescu']], answer: 1 },
	{ name: 'Fam. Dumitrescu (nași)', side: 'comun', category: 'nasi', guests: [['Radu Dumitrescu'], ['Elena Dumitrescu']], answer: 1 },
	{ name: 'Fam. Popescu', side: 'mireasa', category: 'familie', subcategory: 'parinti', guests: [['Ion Popescu'], ['Maria Popescu']], answer: 1 },
	{ name: 'Fam. Ionescu', side: 'mire', category: 'familie', subcategory: 'parinti', guests: [['Gheorghe Ionescu'], ['Rodica Ionescu']], answer: 1 },
	{ name: 'Ioana Popescu', side: 'mireasa', category: 'familie', subcategory: 'sora', guests: [['Ioana Popescu'], ['Vlad Marin']], answer: 1 },
	{ name: 'Fam. Stan', side: 'mire', category: 'familie', subcategory: 'veri', guests: [['Andrei Stan'], ['Bianca Stan'], ['Matei Stan', true]] },
	{ name: 'Fam. Constantin', side: 'mireasa', category: 'familie', subcategory: 'unchi_matusi', guests: [['Dan Constantin'], ['Lia Constantin']], answer: 0 },
	{ name: 'Cristina și Paul', side: 'mireasa', category: 'prieteni', guests: [['Cristina Dobre'], ['Paul Dobre']], answer: 1 },
	{ name: 'Alex Rusu', side: 'mire', category: 'prieteni', guests: [['Alex Rusu'], ['Irina Vlad']] },
	{ name: 'Fam. Toma', side: 'mire', category: 'prieteni', guests: [['Sorin Toma'], ['Diana Toma'], ['Eva Toma', true], ['Luca Toma', true]], answer: 1 },
	{ name: 'Echipa Mihai', side: 'mire', category: 'colegi', subcategory: 'serviciu', guests: [['Cosmin Stoica'], ['Raluca Neagu']] },
	{ name: 'Colegele Anei', side: 'mireasa', category: 'colegi', subcategory: 'facultate', guests: [['Oana Matei'], ['Simona Ilie']], answer: 1 },
	{ name: 'Fam. Georgescu', side: 'mireasa', category: 'cunostinte', subcategory: 'parinti', guests: [['Victor Georgescu'], ['Carmen Georgescu']] },
	{ name: 'Bunicii Popescu', side: 'mireasa', category: 'familie', subcategory: 'alte_rude', guests: [['Vasile Popescu'], ['Ana Popescu']], answer: 1 },
	{ name: 'Fam. Lungu', side: 'mire', category: 'familie', subcategory: 'veri', guests: [['Tudor Lungu'], ['Alina Lungu'], ['Sara Lungu', true]], answer: 1 },
	{ name: 'Fam. Barbu', side: 'mire', category: 'familie', subcategory: 'unchi_matusi', guests: [['Mihai Barbu'], ['Doina Barbu']], answer: 1 },
	{ name: 'Fam. Enache', side: 'mireasa', category: 'prieteni', guests: [['Bogdan Enache'], ['Larisa Enache']], answer: 1 },
	{ name: 'Fam. Florea', side: 'mireasa', category: 'prieteni', guests: [['Ștefan Florea'], ['Ioana Florea'], ['David Florea', true]], answer: 1 },
	{ name: 'Răzvan și Ilinca', side: 'mire', category: 'prieteni', guests: [['Răzvan Petre'], ['Ilinca Petre']], answer: 1 },
	{ name: 'Fam. Ciobanu', side: 'mire', category: 'colegi', subcategory: 'fost_serviciu', guests: [['Marius Ciobanu'], ['Andreea Ciobanu']], answer: 1 },
	{ name: 'Colegii de liceu', side: 'mireasa', category: 'colegi', subcategory: 'liceu', guests: [['Roxana Mihai'], ['Teo Sandu'], ['Lavinia Popa']] },
	{ name: 'Fam. Nistor', side: 'mire', category: 'cunostinte', subcategory: 'parinti', guests: [['Costel Nistor'], ['Mariana Nistor']], answer: 0 }
];

const EXPENSES: [category: string, name: string, kind: ExpenseKind, amount: number, paid: number][] = [
	['Locație & meniu', 'Meniu', 'per_adult', 650, 0],
	['Locație & meniu', 'Meniu copii', 'per_child', 300, 0],
	['Locație & meniu', 'Avans sală', 'fixed', 5000, 5000],
	['Băuturi', 'Pachet băuturi', 'per_adult', 120, 0],
	['Foto & video', 'Fotograf și videograf', 'fixed', 9000, 2000],
	['Muzică', 'Formație', 'fixed', 10000, 2500],
	['Flori & decor', 'Aranjamente florale', 'fixed', 6000, 0],
	['Tort & candy bar', 'Tort', 'per_adult', 35, 0],
	['Invitații & papetărie', 'Invitații tipărite', 'fixed', 900, 900],
	['Verighete', 'Verighete', 'fixed', 3500, 3500]
];

/** The hall from the template, the couple and nași at their table, and most of the others seated. */
function seatGuests() {
	const guests = all<{ id: number; household_id: number; category: string }>(
		`SELECT g.id, g.household_id, h.category FROM guests g JOIN households h ON h.id = g.household_id
		 WHERE g.attending IS NOT 0 ORDER BY h.id, g.id`
	);
	const head = guests.filter((g) => g.category === 'miri' || g.category === 'nasi');
	const rest = guests.filter((g) => !head.includes(g));
	const headId = Number(
		run(
			"INSERT INTO tables (name, capacity, shape, x, y) VALUES ('Masa mirilor', ?, 'dreptunghiulara', ?, ?)",
			6,
			HEAD_TABLE.x,
			HEAD_TABLE.y
		).lastInsertRowid
	);
	for (const g of head) run('UPDATE guests SET table_id = ? WHERE id = ?', headId, g.id);
	const tables = hallLayout(tableCapacities(rest.length, 8)).map((t) => ({
		...t,
		id: Number(
			run("INSERT INTO tables (name, capacity, shape, x, y) VALUES (?, ?, 'rotunda', ?, ?)", t.name, t.capacity, t.x, t.y)
				.lastInsertRowid
		),
		free: t.capacity
	}));
	for (const it of [...FEATURES, BAND]) {
		run('INSERT INTO floor_items (label, x, y, w, h) VALUES (?, ?, ?, ?, ?)', it.label, it.x, it.y, it.w, it.h);
	}
	// Whole families together; the last few families stay unseated, as in a plan still in progress.
	const families = [...new Set(rest.map((g) => g.household_id))].slice(0, -3);
	for (const family of families) {
		const members = rest.filter((g) => g.household_id === family);
		const table = tables.find((t) => t.free >= members.length);
		if (!table) continue;
		for (const g of members) run('UPDATE guests SET table_id = ? WHERE id = ?', table.id, g.id);
		table.free -= members.length;
	}
}

/** Fills an empty database with the demo wedding; does nothing once any family exists. */
export function seedDemo(isEmpty: boolean) {
	if (!isEmpty) return;
	const date = new Date();
	date.setMonth(date.getMonth() + 7);
	transaction(() => {
		const insHousehold = (h: DemoHousehold) =>
			Number(
				run(
					`INSERT INTO households (name, side, category, subcategory, token, invite_sent, responded_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`,
					h.name,
					h.side,
					h.category,
					h.subcategory ?? '',
					newToken(),
					h.answer === undefined ? 0 : 1,
					h.answer === undefined ? null : new Date().toISOString().slice(0, 19).replace('T', ' ')
				).lastInsertRowid
			);
		for (const h of HOUSEHOLDS) {
			const id = insHousehold(h);
			for (const [name, child] of h.guests) {
				run(
					'INSERT INTO guests (household_id, name, is_child, attending, menu) VALUES (?, ?, ?, ?, ?)',
					id,
					name,
					child ? 1 : 0,
					h.answer ?? null,
					child ? 'copil' : 'standard'
				);
			}
		}
		seatGuests();
		// The first tasks of the checklist, as if the couple had started a few months ago.
		run('UPDATE tasks SET done = 1 WHERE days_before >= 240');
		for (const [category, name, kind, amount, paid] of EXPENSES) {
			run(
				'INSERT INTO expenses (category, name, kind, amount, currency, paid) VALUES (?, ?, ?, ?, ?, ?)',
				category,
				name,
				kind,
				amount,
				'RON',
				paid
			);
		}
	});
	saveSettings({
		partner1: 'Ana',
		partner2: 'Mihai',
		wedding_date: date.toISOString().slice(0, 10),
		venue: 'Conacul cu Tei',
		venue_address: 'Strada Teilor 1, Snagov',
		ceremony: 'Biserica Sf. Nicolae, ora 15:00',
		gift_estimate: 500,
		family_contribution: 15000,
		attendance_rate: 85
	});
	console.log('demo: seeded a made-up wedding (DEMO_DATA=true)');
}
