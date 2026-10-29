import { describe, expect, it } from 'vitest';
import {
	attendanceShare,
	breakEven,
	budget,
	coveragePct,
	daysBetween,
	formatMoney,
	headcount,
	householdStatus,
	people,
	projectedIncome,
	taskDueDate,
	type Person
} from '../calc.ts';
import type { Expense, Guest } from '../types.ts';

const adults = (n: number, extra: Partial<Person> = {}): Person[] =>
	Array.from({ length: n }, () => ({ is_child: 0, attending: null, ...extra }));

describe('headcount', () => {
	it('plans for everyone confirmed or unanswered, but not the declined', () => {
		const hc = headcount([
			...adults(3, { attending: 1 }),
			...adults(6),
			...adults(1, { attending: 0 }),
			{ is_child: 1, attending: null }
		]);
		expect(hc).toMatchObject({
			invited: 11,
			confirmed: 3,
			pending: 7,
			declined: 1,
			expectedAdults: 9,
			expectedChildren: 1
		});
	});

	it('applies the attendance rate to everyone invited', () => {
		const guests = [
			...adults(30, { attending: 1 }),
			...adults(100),
			...adults(10, { attending: 0 }),
			...Array.from({ length: 10 }, () => ({ is_child: 1, attending: null }))
		];
		const hc = headcount(guests, 0.65);
		expect(hc).toMatchObject({ confirmed: 30, pending: 110, expectedAdults: 91, expectedChildren: 7 });
		expect(hc.payingAdults).toBe(91);
		expect(headcount(guests, 0).expectedAdults).toBe(30);
		expect(headcount(guests).expectedAdults).toBe(130);
	});

	it('keeps the estimate when guests confirm, within the confirmed and not-declined bounds', () => {
		const mix = (yes: number, no: number) => [...adults(yes, { attending: 1 }), ...adults(no, { attending: 0 }), ...adults(100 - yes - no)];
		expect(headcount(mix(0, 0), 0.6).expectedAdults).toBe(60);
		expect(headcount(mix(28, 0), 0.6).expectedAdults).toBe(60);
		expect(headcount(mix(28, 10), 0.6).expectedAdults).toBe(60);
		// More confirmed than the rate: plan for all of them. More declined: plan for who is left.
		expect(headcount(mix(75, 0), 0.6).expectedAdults).toBe(75);
		expect(headcount(mix(0, 50), 0.6).expectedAdults).toBe(50);
	});

	it('reads the attendance setting as a clamped share', () => {
		expect(attendanceShare({ attendance_rate: 65 })).toBe(0.65);
		expect(attendanceShare({ attendance_rate: 140 })).toBe(1);
		expect(attendanceShare({ attendance_rate: -5 })).toBe(0);
	});

	it('excludes nași, parents and the couple from paying adults', () => {
		const hc = headcount([
			...adults(2, { category: 'nasi' }),
			...adults(2, { category: 'familie', subcategory: 'parinti' }),
			...adults(2, { category: 'miri' }),
			...adults(5)
		]);
		expect(hc.expectedAdults).toBe(11);
		expect(hc.payingAdults).toBe(5);
	});

	it("counts the nași's parents and other relatives as paying", () => {
		const hc = headcount([
			...adults(2, { category: 'nasi', subcategory: 'parinti' }),
			...adults(1, { category: 'familie', subcategory: 'sora' }),
			...adults(1, { category: 'cunostinte', subcategory: 'parinti' })
		]);
		expect(hc.payingAdults).toBe(4);
	});

	it('flattens households carrying their category', () => {
		const g = { is_child: 0, attending: null } as Guest;
		const ps = people([{ category: 'colegi', subcategory: 'serviciu', guests: [g, g] }]);
		const p = { is_child: 0, attending: null, category: 'colegi', subcategory: 'serviciu' };
		expect(ps).toEqual([p, p]);
	});
});

describe('budget', () => {
	const e = (kind: Expense['kind'], amount: number, currency: Expense['currency'] = 'RON', paid = 0) => ({
		kind,
		amount,
		currency,
		paid
	});

	it('multiplies per-person prices by the expected headcount and converts EUR', () => {
		const b = budget(
			[e('fixed', 1000), e('per_adult', 10, 'EUR', 100), e('per_child', 50)],
			{ expectedAdults: 100, expectedChildren: 4 },
			5
		);
		expect(b.fixed).toBe(1000);
		expect(b.perGuest).toBe(100 * 10 * 5 + 4 * 50);
		expect(b.paid).toBe(500);
		expect(b.remaining).toBe(b.total - 500);
	});

	// Reproduces the venue's spreadsheet model (all in EUR, rate 1 so lei == €):
	// 100 adults, 2 children, 8 staff menus at −40%.
	it('matches the reference venue budget', () => {
		const hc = { expectedAdults: 100, expectedChildren: 2 };
		const fixed = [1680, 600, 400, 400, 2000, 8 * 143 * 0.6, 4500, 2200, 3 * 80, 2000, 1500, 800];
		const b = budget(
			[
				...fixed.map((a) => e('fixed', a, 'EUR')),
				e('per_adult', 143, 'EUR'),
				e('per_adult', 3.5, 'EUR'),
				e('per_adult', 3, 'EUR'),
				e('per_child', 38, 'EUR')
			],
			hc,
			1
		);
		expect(b.total).toBeCloseTo(32032.4, 1);
		expect(breakEven(b.total, 10000, 94)).toBeCloseTo(234.39, 2);
		expect(projectedIncome(10000, 94, 250) - b.total).toBeCloseTo(1467.6, 1);
	});
});

describe('break-even and coverage', () => {
	it('subtracts the family contribution and never goes negative', () => {
		expect(breakEven(30000, 10000, 100)).toBe(200);
		expect(breakEven(5000, 10000, 100)).toBe(0);
		expect(breakEven(5000, 0, 0)).toBe(0);
	});

	it('reports coverage over 100%', () => {
		expect(coveragePct(150, 100)).toBe(150);
		expect(coveragePct(10, 0)).toBe(0);
	});
});

describe('household status', () => {
	it('is pending until someone answers, yes if anyone comes', () => {
		expect(householdStatus([{ attending: null }, { attending: null }])).toBe('pending');
		expect(householdStatus([{ attending: 0 }, { attending: null }])).toBe('no');
		expect(householdStatus([{ attending: 0 }, { attending: 1 }])).toBe('yes');
		expect(householdStatus([])).toBe('pending');
	});
});

describe('dates', () => {
	it('counts deadlines back from the wedding, across DST changes', () => {
		expect(taskDueDate('2027-09-18', 30)).toBe('2027-08-19');
		expect(taskDueDate('2027-04-03', 7)).toBe('2027-03-27');
		expect(taskDueDate('2027-09-18', -14)).toBe('2027-10-02');
		expect(daysBetween('2026-10-20', '2027-09-18')).toBe(333);
	});
});

describe('formatMoney', () => {
	it('shows RON amounts in the display currency', () => {
		expect(formatMoney(5000, { currency: 'EUR', eur_rate: 5 })).toBe('1.000 €');
		expect(formatMoney(1234.6, { currency: 'RON', eur_rate: 5 })).toBe('1.235 lei');
	});
});
