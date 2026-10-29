import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '../csv.ts';

describe('parseCsv', () => {
	it('detects semicolons, strips the BOM and lowercases headers', () => {
		expect(parseCsv('﻿Nume;Copil\r\nIon Pop;da\r\n')).toEqual([{ nume: 'Ion Pop', copil: 'da' }]);
	});

	it('handles quoted fields with delimiters, quotes and newlines', () => {
		const rows = parseCsv('nume,restrictii\n"Pop, Ion","fără ""gluten""\nși lactoză"\n');
		expect(rows).toEqual([{ nume: 'Pop, Ion', restrictii: 'fără "gluten"\nși lactoză' }]);
	});

	it('skips blank lines and fills missing trailing fields', () => {
		expect(parseCsv('nume,copil\n\nAna\n,,\n')).toEqual([{ nume: 'Ana', copil: '' }]);
	});

	it('returns nothing for empty input', () => {
		expect(parseCsv('')).toEqual([]);
	});
});

describe('toCsv', () => {
	it('round-trips through parseCsv', () => {
		const csv = toCsv(['nume', 'nota'], [['Ana; Maria', 'spune "da"']]);
		expect(csv.startsWith('﻿')).toBe(true);
		expect(parseCsv(csv)).toEqual([{ nume: 'Ana; Maria', nota: 'spune "da"' }]);
	});
});
