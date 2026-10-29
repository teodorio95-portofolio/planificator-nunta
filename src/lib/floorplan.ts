// Pure layout math for the Mese room template, a common banquet-hall shape:
// three columns of round tables, two rows above the dance floor and two below it, the couple's
// table at the top in line with the middle column, and the fixed features around them.
// Positions are centres in % of the floor plan (16:10), like the `tables` table stores them.

export interface Spot {
	x: number;
	y: number;
}

export interface PlannedTable extends Spot {
	name: string;
	capacity: number;
}

const COLUMNS = [30, 50, 70];
/** Rows on each side, nearest the dance floor first: guests sit close to the floor before the walls. */
// A round table of 8 is ~18% of the plan high and the couple's long table ~10%, so the rows are
// packed between the couple's table at the top and the strip of rooms along the bottom wall.
const SIDES = [
	[36, 18],
	[67, 85]
];
/** Every table spot in the hall. */
export const HALL_SLOTS = COLUMNS.length * SIDES.length * SIDES[0].length;

/** Above the middle table of the top rows. */
export const HEAD_TABLE: Spot = { x: 50, y: 5.5 };

export interface FloorFeature extends Spot {
	label: string;
	w: number;
	h: number;
}

/** The band stands on the floor, at its right end; the others sit where the hall has no tables. */
export const BAND: FloorFeature = { label: 'Formație / DJ', x: 67, y: 51, w: 8, h: 9 };
export const FEATURES: FloorFeature[] = [
	{ label: 'Ring de dans', x: 50, y: 51, w: 44, h: 12 },
	{ label: 'Intrare', x: 21, y: 51, w: 9, h: 9 },
	// In line with the right column's floor-side row, where the hall has no table.
	{ label: 'Ieșire terasă', x: 90, y: 36, w: 10, h: 10 },
	// Next to the left table of the bottom floor-side row.
	{ label: 'Gelato bar', x: 10, y: 67, w: 11, h: 10 },
	// Along the bottom wall, under the middle and right columns.
	{ label: 'Camera mirilor', x: 50, y: 97, w: 14, h: 6 },
	{ label: 'Toaletă', x: 70, y: 97, w: 10, h: 6 }
];

/** Splits `n` into `parts` sizes that differ by at most one, larger first: (7, 2) → [4, 3]. */
export const split = (n: number, parts: number) =>
	Array.from({ length: parts }, (_, i) => Math.floor(n / parts) + (i < n % parts ? 1 : 0));

/**
 * Seats per table for `people` (after the couple's table): as few tables of `base` seats as needed,
 * up to the hall's slots; when even a full hall is short, some tables take one or more extra seats.
 * 103 people, base 8, 12 slots → seven tables of 9 and five of 8 (exactly 103 seats).
 */
export function tableCapacities(people: number, base: number, slots = HALL_SLOTS): number[] {
	if (people <= 0 || base <= 0) return [];
	const n = Math.min(slots, Math.ceil(people / base));
	const each = Math.max(base, Math.floor(people / n));
	const extra = Math.max(0, people - each * n);
	return Array.from({ length: n }, (_, i) => each + (i < extra ? 1 : 0));
}

/** Centres for `k` tables in one row, on the hall's columns: 3 → 30/50/70, 2 → 40/60, 1 → 50. */
function rowXs(k: number): number[] {
	const gap = COLUMNS[1] - COLUMNS[0];
	return Array.from({ length: k }, (_, i) => 50 + gap * (i - (k - 1) / 2));
}

/**
 * Places the tables half above and half below the dance floor (an odd one above), filling the row
 * next to the floor before the one by the wall. Names run in reading order, top to bottom.
 */
export function hallLayout(capacities: number[]): PlannedTable[] {
	const perRow = COLUMNS.length;
	const halves = split(Math.min(capacities.length, HALL_SLOTS), SIDES.length);
	const spots = SIDES.flatMap((rows, s) => {
		const near = Math.min(perRow, halves[s]);
		const [nearY, farY] = rows;
		return [
			...rowXs(near).map((x) => ({ x, y: nearY })),
			...rowXs(halves[s] - near).map((x) => ({ x, y: farY }))
		];
	});
	return spots
		.sort((a, b) => a.y - b.y || a.x - b.x)
		.map((spot, i) => ({ ...spot, name: `Masa ${i + 1}`, capacity: capacities[i] }));
}
