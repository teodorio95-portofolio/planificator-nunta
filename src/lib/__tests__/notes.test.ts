import { describe, expect, it } from 'vitest';
import { cost, formatAmount, noteTotal, parseAmount, quantity } from '../notes.ts';

describe('note calculator', () => {
	const roses = { per_unit: 7, units: 21, price: 9 };
	const cloths = { per_unit: 1, units: 21, price: 35.5 };

	it('multiplies pieces per unit by the number of units', () => {
		expect(quantity(roses)).toBe(147);
		expect(cost(roses)).toBe(1323);
	});

	it('adds up every line', () => {
		expect(noteTotal([roses, cloths])).toBe(1323 + 745.5);
		expect(noteTotal([])).toBe(0);
	});

	it('reads amounts typed with a comma or a dot', () => {
		expect(parseAmount('8,5')).toBe(8.5);
		expect(parseAmount(' 8.5 ')).toBe(8.5);
		expect(parseAmount('21')).toBe(21);
	});

	it('counts empty, invalid or negative amounts as 0', () => {
		for (const v of ['', 'abc', '-3', null, undefined]) expect(parseAmount(v)).toBe(0);
	});

	it('shows counts the Romanian way, without float noise', () => {
		expect(formatAmount(12.5)).toBe('12,5');
		expect(formatAmount(0.1 * 3)).toBe('0,3');
	});
});
