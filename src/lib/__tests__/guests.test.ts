import { describe, expect, it } from 'vitest';
import { groupCsvRows, parseCategory, parseMembers, parseSide, parseSubcategory, parseYes } from '../guests.ts';
import { byCategory, type Category, type Subcategory } from '../types.ts';

const rows = (...r: [string, string?, Record<string, string>?][]) =>
	r.map(([nume, parte = 'Mire', extra = {}]) => ({ nume, parte, ...extra }));

const summary = (list: ReturnType<typeof groupCsvRows>) =>
	list.map((h) => `${h.name}: ${h.guests.map((g) => g.name + (g.is_child ? '*' : '')).join(', ')}`);

describe('parsers', () => {
	it('reads members with a (copil) suffix', () => {
		expect(parseMembers('Ion Pop\n\n  Ana (copil) \n')).toEqual([
			{ name: 'Ion Pop', is_child: 0 },
			{ name: 'Ana', is_child: 1 }
		]);
	});

	it('accepts spreadsheet spellings', () => {
		expect(parseSide('Mireasa')).toBe('mireasa');
		expect(parseSide('mire')).toBe('mire');
		expect(parseSide('')).toBe('comun');
		expect(parseYes('DA?')).toBe(true);
		expect(parseYes('?')).toBe(true);
		expect(parseYes('')).toBe(false);
		expect(parseYes('nu')).toBe(false);
	});

	it("reads the guest sheet's categories and subcategories", () => {
		const cat = (c: string, s = '') => Object.values(parseCategory(c, s)).join('/');
		expect(cat('Mireasa')).toBe('miri/');
		expect(cat('Mire')).toBe('miri/');
		expect(cat('Nasa')).toBe('nasi/');
		expect(cat('Nași')).toBe('nasi/');
		expect(cat('Parinti ')).toBe('familie/parinti');
		expect(cat('Parinti ', 'Nasi')).toBe('nasi/parinti');
		expect(cat('Sora')).toBe('familie/sora');
		expect(cat('Familie', 'Unchi/Matusi')).toBe('familie/unchi_matusi');
		expect(cat('Colegi', 'Serviciu')).toBe('colegi/serviciu');
		expect(cat('Colegi', 'Fost serviciu')).toBe('colegi/fost_serviciu');
		expect(cat('Cunostinte', 'Parinti Mireasa')).toBe('cunostinte/parinti');
		expect(cat('Prieteni')).toBe('prieteni/');
		expect(cat('')).toBe('/');
	});

	it('accepts form keys and display labels for subcategories', () => {
		expect(parseSubcategory('alte_rude')).toBe('alte_rude');
		expect(parseSubcategory('Alte rude')).toBe('alte_rude');
		expect(parseSubcategory('Unchi / Mătuși')).toBe('unchi_matusi');
		expect(parseSubcategory('Veri')).toBe('veri');
		expect(parseSubcategory('Facultate')).toBe('facultate');
		expect(parseSubcategory('Banca X')).toBe('altele');
		expect(parseSubcategory('')).toBe('');
		expect(parseCategory('familie', 'alte_rude')).toEqual({ category: 'familie', subcategory: 'alte_rude' });
	});
});

describe('groupCsvRows', () => {
	it('groups consecutive people sharing a surname and side', () => {
		const out = groupCsvRows(
			rows(['Ana Pop'], ['Ion Pop'], ['Maria Pop', 'Mireasa'], ['Dan Ilie'], ['Eva Ilie'], ['Radu Ilie'])
		);
		expect(summary(out)).toEqual([
			'Ana & Ion Pop: Ana Pop, Ion Pop',
			'Maria Pop: Maria Pop',
			'Familia Ilie: Dan Ilie, Eva Ilie, Radu Ilie'
		]);
	});

	it('attaches partner and child placeholder rows to the person above', () => {
		const out = groupCsvRows(
			rows(['Andrei Stan'], ['Sotie Andrei'], ['Bianca Vlad'], ['Iubit Bianca'], ['Copil Bianca 1'], ['Lia'], ['Sot'])
		);
		expect(summary(out)).toEqual([
			'Andrei Stan & soția: Andrei Stan, Sotie Andrei',
			'Bianca Vlad & partenerul: Bianca Vlad, Iubit Bianca, Copil Bianca 1*',
			'Lia & soțul: Lia, Sot'
		]);
	});

	it('closes a couple once a partner row joins it', () => {
		const out = groupCsvRows(rows(['Dana Iosif'], ['Sot'], ['Ema Iosif'], ['Sot']));
		expect(summary(out)).toEqual(['Dana Iosif & soțul: Dana Iosif, Sot', 'Ema Iosif & soțul: Ema Iosif, Sot']);
	});

	it('splits a later couple off a surname run', () => {
		const out = groupCsvRows(rows(['Dan Toma'], ['Ana Toma'], ['Lia Toma'], ['Sot Lia'], ['Copil Lia']));
		expect(summary(out)).toEqual(['Dan & Ana Toma: Dan Toma, Ana Toma', 'Lia Toma & soțul: Lia Toma, Sot Lia, Copil Lia*']);
	});

	it('turns "Fam X el" / "ea" pairs into a formal household', () => {
		const out = groupCsvRows(rows(['Fam Florea el'], ['ea'], ['Fam Barbu el'], ['ea']));
		expect(summary(out)).toEqual(['Familia Florea: Dl. Florea, Dna. Florea', 'Familia Barbu: Dl. Barbu, Dna. Barbu']);
	});

	it('uses an explicit familie column and keeps the old rol as a category', () => {
		const out = groupCsvRows([
			{ familie: 'Mirii', nume: 'Ana', rol: 'miri' },
			{ familie: 'Mirii', nume: 'Mihai', rol: 'miri' },
			{ familie: 'Pop', nume: 'Ion Pop', rol: 'părinți' },
			{ nume: 'Dan Ilie' }
		]);
		expect(out.map((h) => [h.name, h.category, h.subcategory, h.guests.length])).toEqual([
			['Mirii', 'miri', '', 2],
			['Pop', 'familie', 'parinti', 1],
			['Dan Ilie', '', '', 1]
		]);
	});

	it("takes the household's category from its first categorised member", () => {
		const out = groupCsvRows(
			rows(
				['Alina Popescu', 'Mire', { categorie: 'Parinti' }],
				['Gabriel Popescu', 'Mire', { categorie: 'Parinti' }],
				['Cosmin Stoica', 'Mireasa', { categorie: 'Colegi', subcategorie: 'Serviciu' }]
			)
		);
		expect(out.map((h) => [h.name, h.category, h.subcategory])).toEqual([
			['Alina & Gabriel Popescu', 'familie', 'parinti'],
			['Cosmin Stoica', 'colegi', 'serviciu']
		]);
	});

	it('imports unsure ("?") guests like everyone else', () => {
		const out = groupCsvRows(rows(['Ana Pop', 'Mire', { nesigur: '?' }], ['Ion Pop']));
		expect(out).toEqual([expect.not.objectContaining({ tentative: expect.anything() })]);
		expect(summary(out)).toEqual(['Ana & Ion Pop: Ana Pop, Ion Pop']);
	});

	it('reads alternative headers and child flags', () => {
		const out = groupCsvRows([{ invitat: 'Ana Pop', 'din partea': 'Mireasa', copil: 'DA?' }]);
		expect(out[0]).toMatchObject({ side: 'mireasa', guests: [{ name: 'Ana Pop', is_child: 1, menu: 'copil' }] });
	});

	it("reads the guest sheet's familii, observatii and tbd columns", () => {
		const sheet = (familii: string, invitat: string, extra: Record<string, string> = {}) => ({ familii, invitat, ...extra });
		const out = groupCsvRows([
			sheet('Miri', 'Ana Popescu'),
			sheet('Nasi', 'Alexandra Dobre', { observatii: 'David 4 ani\r\nTudor 1 an' }),
			sheet('Nasi', 'Radu Dobre', { observatii: 'David 4 ani\r\nTudor 1 an' }),
			sheet('Fam. Marin', 'Ioana Marin', { 'din partea': 'Mireasa', categorie: 'Colegi', tbd: '?' }),
			sheet('Fam. Marin', 'Remus Marin', { 'din partea': 'Mireasa', tbd: '?' })
		]);
		expect(out.map((h) => [h.name, h.side, h.category, h.notes, h.tbd, h.guests.length])).toEqual([
			['Miri', 'comun', 'miri', '', 0, 1],
			['Nasi', 'comun', 'nasi', 'David 4 ani\nTudor 1 an', 0, 2],
			['Fam. Marin', 'mireasa', 'colegi', '', 1, 2]
		]);
	});

	it('keeps household names unique', () => {
		const out = groupCsvRows(rows(['Ana Pop'], ['Ion Pop'], ['Dan Ilie'], ['Ana Pop'], ['Ion Pop']));
		expect(out.map((h) => h.name)).toEqual(['Ana & Ion Pop', 'Dan Ilie', 'Ana & Ion Pop (2)']);
	});
});

describe('byCategory', () => {
	it('orders the couple, nași, family, friends, colleagues, acquaintances, then the uncategorised', () => {
		const h = (name: string, category: Category, subcategory: Subcategory = '') => ({ name, category, subcategory });
		const sorted = [
			h('Ana', ''),
			h('Bia', 'colegi', 'fost_serviciu'),
			h('Cris', 'cunostinte'),
			h('Dan', 'familie', 'parinti'),
			h('Ema', 'prieteni'),
			h('Fani', 'colegi', 'serviciu'),
			h('Gabi', 'familie'),
			h('Ion', 'nasi', 'parinti'),
			h('Lia', 'miri'),
			h('Mia', 'nasi')
		].sort(byCategory);
		expect(sorted.map((x) => x.name)).toEqual(['Lia', 'Mia', 'Ion', 'Gabi', 'Dan', 'Ema', 'Fani', 'Bia', 'Cris', 'Ana']);
	});
});
