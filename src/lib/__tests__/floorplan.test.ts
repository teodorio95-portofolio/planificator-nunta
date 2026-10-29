import { describe, expect, it } from 'vitest';
import { HALL_SLOTS, hallLayout, split, tableCapacities } from '../floorplan.ts';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('tableCapacities', () => {
	it('uses as few tables of 8 as the estimate needs', () => {
		expect(tableCapacities(80, 8)).toEqual(Array(10).fill(8));
		expect(tableCapacities(81, 8)).toEqual(Array(11).fill(8));
		expect(tableCapacities(0, 8)).toEqual([]);
	});

	it('adds a seat to some tables when the hall has no more slots', () => {
		const caps = tableCapacities(103, 8);
		expect(caps).toHaveLength(HALL_SLOTS);
		expect(caps.filter((c) => c === 9)).toHaveLength(7);
		expect(caps.filter((c) => c === 8)).toHaveLength(5);
		expect(sum(caps)).toBe(103);
	});

	it('never goes below the chosen size', () => {
		expect(tableCapacities(90, 8).every((c) => c === 8)).toBe(true);
	});
});

describe('split', () => {
	it('splits evenly, larger parts first', () => {
		expect(split(7, 2)).toEqual([4, 3]);
		expect(split(12, 2)).toEqual([6, 6]);
	});
});

describe('hallLayout', () => {
	it('puts half the tables above the floor and half below, nearest the floor first', () => {
		const t = hallLayout(Array(10).fill(8));
		const above = t.filter((s) => s.y < 50);
		const below = t.filter((s) => s.y > 50);
		expect([above.length, below.length]).toEqual([5, 5]);
		// Three next to the floor on each side, two by the wall, centred on the middle column.
		expect(above.filter((s) => s.y === 36).map((s) => s.x)).toEqual([30, 50, 70]);
		expect(above.filter((s) => s.y === 18).map((s) => s.x)).toEqual([40, 60]);
	});

	it('fills all twelve slots on the three columns and names tables top to bottom', () => {
		const t = hallLayout(tableCapacities(103, 8));
		expect(t).toHaveLength(12);
		expect(new Set(t.map((s) => s.x))).toEqual(new Set([30, 50, 70]));
		expect(t.map((s) => s.name)).toEqual(Array.from({ length: 12 }, (_, i) => `Masa ${i + 1}`));
		expect(t.map((s) => s.y)).toEqual([...t.map((s) => s.y)].sort((a, b) => a - b));
		expect(sum(t.map((s) => s.capacity))).toBe(103);
	});

	it('puts an odd table above the floor', () => {
		const t = hallLayout(Array(7).fill(8));
		expect(t.filter((s) => s.y < 50)).toHaveLength(4);
	});
});
