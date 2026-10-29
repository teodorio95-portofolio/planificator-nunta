export type Side = 'mire' | 'mireasa' | 'comun';
/** Who the guest is to the couple; '' = not categorised yet. */
export type Category = '' | 'miri' | 'nasi' | 'familie' | 'prieteni' | 'colegi' | 'cunostinte';
/** Narrows the category: "Familie · Părinți", "Colegi · Serviciu", "Nași · Părinți" (the nași's parents). */
export type Subcategory =
	| ''
	| 'parinti'
	| 'sora'
	| 'veri'
	| 'unchi_matusi'
	| 'alte_rude'
	| 'serviciu'
	| 'fost_serviciu'
	| 'facultate'
	| 'liceu'
	| 'altele';
export type Menu = 'standard' | 'vegetarian' | 'vegan' | 'copil';
export type Currency = 'RON' | 'EUR';
export type ExpenseKind = 'fixed' | 'per_adult' | 'per_child';
export type RsvpStatus = 'pending' | 'yes' | 'no';

export interface Household {
	id: number;
	name: string;
	side: Side;
	category: Category;
	subcategory: Subcategory;
	token: string;
	phone: string;
	/** "Observații" in the guest sheet: small children, "+1 to be confirmed"… */
	notes: string;
	/** 1 = not sure yet whether to invite them ("TBD ?" in the sheet). They are still counted. */
	tbd: number;
	invite_sent: number;
	rsvp_note: string;
	responded_at: string | null;
	gift_amount: number;
	gift_currency: Currency;
	gift_method: '' | 'numerar' | 'transfer';
}

export interface Guest {
	id: number;
	household_id: number;
	name: string;
	is_child: number;
	/** null = no answer yet, 1 = coming, 0 = not coming */
	attending: number | null;
	menu: Menu;
	dietary: string;
	table_id: number | null;
}

export interface Table {
	id: number;
	name: string;
	capacity: number;
	shape: 'rotunda' | 'dreptunghiulara';
	/** Centre on the floor plan, in % of its width / height. */
	x: number;
	y: number;
}

export interface FloorItem {
	id: number;
	label: string;
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface Expense {
	id: number;
	category: string;
	name: string;
	vendor: string;
	kind: ExpenseKind;
	/** Total for `fixed`, price per person for `per_adult` / `per_child`. */
	amount: number;
	currency: Currency;
	paid: number;
	due_date: string;
}

export interface Task {
	id: number;
	title: string;
	category: string;
	/** Days before the wedding; negative means after it. */
	days_before: number;
	done: number;
}

/** One moment of the wedding day. Times are "HH:MM"; an empty end means open-ended. */
export interface ScheduleItem {
	id: number;
	start_time: string;
	end_time: string;
	title: string;
	place: string;
	/** Who is involved or responsible: "Mireasa, makeup artist". */
	people: string;
	notes: string;
	/** 1 = shown to guests in the program on the invitation. */
	on_invite: number;
}

/** A working note for the couple (admins only): free text plus an optional calculator. */
export interface Note {
	id: number;
	title: string;
	body: string;
	pinned: number;
	updated_by: string;
	/** SQLite datetime('now'): UTC "YYYY-MM-DD HH:MM:SS". */
	updated_at: string;
}

/** One calculator line: `per_unit` pieces on each of `units` (7 roses × 21 vases), at `price` RON a piece. */
export interface NoteRow {
	id: number;
	note_id: number;
	item: string;
	per_unit: number;
	/** What the pieces go on: "vază", "masă". */
	unit: string;
	units: number;
	price: number;
}

export interface Settings {
	partner1: string;
	partner2: string;
	/** The letters pressed into the envelope's wax seal; empty = the couple's initials ("A&M"). */
	monogram: string;
	wedding_date: string;
	venue: string;
	venue_address: string;
	ceremony: string;
	rsvp_deadline: string;
	/** Currency for display and for the money settings below. */
	currency: Currency;
	eur_rate: number;
	budget_total: number;
	/** Expected combined gift from nași + parents (they are not counted as regular givers). */
	family_contribution: number;
	/** Expected average gift per regular adult guest, for the income projection. */
	gift_estimate: number;
	/** Percentage of everyone invited expected to come, bounded by the answers (calc.ts `expectedOf`); 100 plans for everyone not declined. */
	attendance_rate: number;
}

export const SIDES: Record<Side, string> = {
	mireasa: 'Mireasă',
	mire: 'Mire',
	comun: 'Comun'
};

/** In display order: the list is sorted by it. */
export const CATEGORIES: Record<Category, string> = {
	miri: 'Miri',
	nasi: 'Nași',
	familie: 'Familie',
	prieteni: 'Prieteni',
	colegi: 'Colegi',
	cunostinte: 'Cunoștințe',
	'': 'Fără categorie'
};

export const SUBCATEGORIES: Record<Subcategory, string> = {
	'': '—',
	parinti: 'Părinți',
	sora: 'Soră',
	veri: 'Veri',
	unchi_matusi: 'Unchi / Mătuși',
	alte_rude: 'Alte rude',
	serviciu: 'Serviciu',
	fost_serviciu: 'Fost serviciu',
	facultate: 'Facultate',
	liceu: 'Liceu',
	altele: 'Altele'
};

/** "Familie · Părinți", or just "Prieteni"; '' when uncategorised. */
export const categoryLabel = (h: { category: Category; subcategory: Subcategory }) =>
	[h.category && CATEGORIES[h.category], h.subcategory && SUBCATEGORIES[h.subcategory]].filter(Boolean).join(' · ');

/** Index in a label map's key order; unknown keys go last. */
const rank = (labels: Record<string, string>, k: string) => {
	const keys = Object.keys(labels);
	return keys.indexOf(k) + 1 || keys.length + 1;
};

/** Comparator: CATEGORIES order (couple, nași, family…), then SUBCATEGORIES order. Stable, so pre-sort by name. */
export const byCategory = (
	a: { category: Category; subcategory: Subcategory },
	b: { category: Category; subcategory: Subcategory }
) =>
	rank(CATEGORIES, a.category) - rank(CATEGORIES, b.category) ||
	rank(SUBCATEGORIES, a.subcategory) - rank(SUBCATEGORIES, b.subcategory);

export const MENUS: Record<Menu, string> = {
	standard: 'Standard',
	vegetarian: 'Vegetarian',
	vegan: 'Vegan',
	copil: 'Meniu copil'
};

export const EXPENSE_KINDS: Record<ExpenseKind, string> = {
	fixed: 'Sumă fixă',
	per_adult: 'Per adult',
	per_child: 'Per copil'
};

export const EXPENSE_CATEGORIES = [
	'Locație & meniu',
	'Băuturi',
	'Foto & video',
	'Muzică',
	'Ținute',
	'Flori & decor',
	'Tort & candy bar',
	'Invitații & papetărie',
	'Biserică & acte',
	'Transport & cazare',
	'Verighete',
	'Altele'
];
