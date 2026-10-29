// Pure parsing helpers for guest input (form textarea and CSV import).
import { CATEGORIES, SUBCATEGORIES, type Category, type Menu, type Side, type Subcategory } from './types';

export const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim()
		.toLowerCase();

export interface MemberInput {
	name: string;
	is_child: number;
}

/** One member per line; a trailing "(copil)" marks a child. */
export function parseMembers(text: string): MemberInput[] {
	return text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean)
		.map((l) => {
			const child = /\(\s*copil\s*\)\s*$/i.test(l);
			return { name: l.replace(/\(\s*copil\s*\)\s*$/i, '').trim(), is_child: child ? 1 : 0 };
		})
		.filter((m) => m.name);
}

export function parseSide(v: string): Side {
	const f = fold(v);
	if (f.startsWith('mireas')) return 'mireasa';
	if (f.startsWith('mire')) return 'mire';
	return 'comun';
}

/** Form keys ("alte_rude") or spreadsheet spellings ("Alte rude", "Parinti Mire"); anything else is "altele". */
export function parseSubcategory(v: string): Subcategory {
	if (v in SUBCATEGORIES) return v as Subcategory;
	const f = fold(v);
	if (f.startsWith('parint')) return 'parinti';
	if (f.startsWith('sora') || f.startsWith('frat')) return 'sora';
	if (f.startsWith('ver')) return 'veri';
	if (f.startsWith('unchi') || f.startsWith('matus')) return 'unchi_matusi';
	if (f.startsWith('alte rude') || f.startsWith('rud')) return 'alte_rude';
	if (f.startsWith('fost')) return 'fost_serviciu';
	if (f.startsWith('servic') || f.startsWith('job') || f.startsWith('munc')) return 'serviciu';
	if (f.startsWith('facult')) return 'facultate';
	if (f.startsWith('lice')) return 'liceu';
	return f ? 'altele' : '';
}

export interface Categorised {
	category: Category;
	subcategory: Subcategory;
}

/**
 * Category and subcategory as the guest spreadsheet writes them. Besides the plain names it accepts
 * the sheet's shorthands: "Mire" / "Mireasa" / "Miri" for the couple, "Nas" / "Nasa", "Parinti" and
 * "Sora" as a category (family), and "Parinti" + "Nasi" (the nași's parents). The old `rol` values
 * (nași / părinți / miri) read the same way.
 */
export function parseCategory(category: string, subcategory = ''): Categorised {
	const f = fold(category);
	const sub = parseSubcategory(subcategory);
	if (category in CATEGORIES && category !== 'miri') return { category: category as Category, subcategory: sub };
	if (f.startsWith('mir')) return { category: 'miri', subcategory: '' };
	if (f.startsWith('nas')) return { category: 'nasi', subcategory: sub };
	if (f.startsWith('parint')) {
		return fold(subcategory).startsWith('nas')
			? { category: 'nasi', subcategory: 'parinti' }
			: { category: 'familie', subcategory: 'parinti' };
	}
	if (f.startsWith('sora') || f.startsWith('frat')) return { category: 'familie', subcategory: 'sora' };
	if (f.startsWith('famil')) return { category: 'familie', subcategory: sub };
	if (f.startsWith('prieten')) return { category: 'prieteni', subcategory: sub };
	if (f.startsWith('coleg')) return { category: 'colegi', subcategory: sub };
	if (f.startsWith('cunost')) return { category: 'cunostinte', subcategory: sub };
	return { category: '', subcategory: sub };
}

export function parseMenu(v: string, isChild: boolean): Menu {
	const f = fold(v);
	if (f.startsWith('vegan')) return 'vegan';
	if (f.startsWith('veget')) return 'vegetarian';
	if (f.startsWith('copil') || (!f && isChild)) return 'copil';
	return 'standard';
}

/** "da", "x", "1"… count as yes; a trailing "?" ("DA?") still counts, and so does a lone "?". */
export function parseYes(v: string): boolean {
	const f = fold(v);
	return f === '?' || ['da', 'x', '1', 'true', 'yes'].includes(f.replace(/\?+$/, ''));
}

export interface ImportedGuest {
	name: string;
	is_child: number;
	menu: Menu;
	dietary: string;
}

export interface ImportedHousehold extends Categorised {
	name: string;
	side: Side;
	phone: string;
	notes: string;
	tbd: number;
	guests: ImportedGuest[];
}

interface Row extends Categorised {
	name: string;
	family: string;
	side: Side;
	phone: string;
	notes: string;
	tbd: boolean;
	guest: ImportedGuest;
}

/** First non-empty value among a column's accepted header spellings. */
const col = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]?.trim()).find(Boolean) ?? '';

function toRow(r: Record<string, string>): Row | undefined {
	const name = col(r, 'nume', 'invitat', 'name');
	if (!name) return undefined;
	const isChild = parseYes(col(r, 'copil'));
	const family = col(r, 'familie', 'familii');
	// The guest sheet names the couple's and the nași's households "Miri" / "Nasi" and leaves their category empty.
	const category = col(r, 'categorie', 'rol') || (/^(miri|nasi+)$/.test(fold(family)) ? family : '');
	return {
		name,
		family,
		side: parseSide(col(r, 'parte', 'din partea')),
		...parseCategory(category, col(r, 'subcategorie')),
		phone: col(r, 'telefon'),
		notes: col(r, 'observatii', 'observații', 'note').replace(/\r\n?/g, '\n'),
		tbd: parseYes(col(r, 'tbd')),
		guest: {
			name,
			is_child: isChild ? 1 : 0,
			menu: parseMenu(col(r, 'meniu'), isChild),
			dietary: col(r, 'restrictii', 'restricții')
		}
	};
}

// Rows that stand for "the partner of the previous person": "Soție Andrei", "Iubit Ana", "Sot", "ea".
const PARTNER: [RegExp, string][] = [
	[/^iubita\/sotie\b/, 'partenera'],
	[/^(sotul|sot)\b/, 'soțul'],
	[/^(sotia|sotie)\b/, 'soția'],
	[/^(iubitul|iubit|partenerul|partener)\b/, 'partenerul'],
	[/^(iubita|partenera)\b/, 'partenera'],
	[/^(ea|el)$/, '']
];
const partnerLabel = (name: string) => PARTNER.find(([re]) => re.test(fold(name)))?.[1];
const isChildPlaceholder = (name: string) => /^copil\b/.test(fold(name));
const FAMILY_ROW = /^fam(?:ilia)?\.?\s+(.+?)\s+(el|ea)$/i;

/** Last word of a real name, ignoring "(Vali)" and "?" — "" for single-word names. */
function surname(name: string): string {
	const words = name.replace(/\(.*?\)/g, '').replace(/\?/g, '').trim().split(/\s+/);
	return words.length > 1 ? fold(words.at(-1)!) : '';
}

interface Draft {
	family: string;
	surname: string;
	/** Set for "Fam X el" + "ea" pairs, which become "Dl. X" / "Dna. X". */
	formal: string;
	partners: string[];
	rows: Row[];
	/** A couple is complete once a partner row joined it: the next named person starts a new household. */
	closed: boolean;
}

function draftName(d: Draft): string {
	if (d.family) return d.family;
	if (d.formal) return `Familia ${d.formal}`;
	const named = d.rows.filter((r) => partnerLabel(r.name) === undefined && !isChildPlaceholder(r.name));
	const adults = named.filter((r) => !r.guest.is_child);
	const lead = adults.length ? adults : named.length ? named : d.rows;
	if (lead.length >= 2 && d.surname && lead.every((r) => surname(r.name) === d.surname)) {
		const last = lead[0].name.trim().split(/\s+/).at(-1);
		if (lead.length > 2) return `Familia ${last}`;
		const first = (r: Row) => r.name.trim().split(/\s+/).slice(0, -1).join(' ');
		return `${first(lead[0])} & ${first(lead[1])} ${last}`;
	}
	const extra = d.partners.filter(Boolean)[0] ?? lead[1]?.name;
	return extra ? `${lead[0].name} & ${extra}` : lead[0].name;
}

/**
 * Groups CSV rows (one per guest) into households.
 * Rows with a `familie` value are grouped by it. Rows without it are inferred from the order of a
 * flat list: consecutive people sharing a surname and side, partner rows ("Soție Andrei", "Sot",
 * "ea"), child rows ("Copil …") and "Fam X el" / "ea" pairs join the household above them.
 */
export function groupCsvRows(raw: Record<string, string>[]): ImportedHousehold[] {
	const drafts: Draft[] = [];
	const byFamily = new Map<string, Draft>();
	let current: Draft | undefined;

	for (const row of raw.map(toRow)) {
		if (!row) continue;
		if (row.family) {
			const key = fold(row.family);
			let d = byFamily.get(key);
			if (!d) {
				d = { family: row.family, surname: '', formal: '', partners: [], rows: [], closed: false };
				byFamily.set(key, d);
				drafts.push(d);
			}
			d.rows.push(row);
			current = undefined;
			continue;
		}

		const formal = row.name.match(FAMILY_ROW);
		const partner = partnerLabel(row.name);
		const sameSide = current && current.rows[0].side === row.side;
		if (formal && formal[2].toLowerCase() === 'el') {
			row.guest.name = `Dl. ${formal[1]}`;
			current = { family: '', surname: fold(formal[1]), formal: formal[1], partners: [], rows: [row], closed: false };
			drafts.push(current);
		} else if (current && sameSide && partner !== undefined) {
			if (current.formal && fold(row.name) === 'ea') row.guest.name = `Dna. ${current.formal}`;
			const last = current.rows.at(-1)!;
			// "Ana Pop, Ion Pop, Laura Pop, Sot Laura": the partner belongs to Laura, so Laura and
			// her partner become their own household instead of growing the Pop family.
			if (!current.formal && current.rows.length >= 2 && !current.closed && partnerLabel(last.name) === undefined) {
				current.rows.pop();
				current = { family: '', surname: surname(last.name), formal: '', partners: [], rows: [last], closed: false };
				drafts.push(current);
			}
			current.partners.push(partner);
			current.rows.push(row);
			current.closed = true;
		} else if (current && sameSide && isChildPlaceholder(row.name)) {
			row.guest.is_child = 1;
			row.guest.menu = 'copil';
			current.rows.push(row);
		} else if (current && sameSide && !current.closed && surname(row.name) && surname(row.name) === current.surname) {
			current.rows.push(row);
		} else {
			current = { family: '', surname: surname(row.name), formal: '', partners: [], rows: [row], closed: false };
			drafts.push(current);
		}
	}

	const used = new Set<string>();
	return drafts.map((d) => {
		let name = draftName(d);
		for (let i = 2; used.has(fold(name)); i++) name = `${draftName(d)} (${i})`;
		used.add(fold(name));
		const first = d.rows[0];
		const categorised = d.rows.find((r) => r.category) ?? d.rows.find((r) => r.subcategory);
		return {
			name,
			side: first.side,
			category: categorised?.category ?? '',
			subcategory: categorised?.subcategory ?? '',
			phone: d.rows.find((r) => r.phone)?.phone ?? '',
			// A note merged over the whole family repeats on every row: keep each distinct one once.
			notes: [...new Set(d.rows.map((r) => r.notes).filter(Boolean))].join('\n'),
			tbd: d.rows.some((r) => r.tbd) ? 1 : 0,
			guests: d.rows.map((r) => r.guest)
		};
	});
}
