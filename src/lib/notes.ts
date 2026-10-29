// The Notițe calculator: how many pieces a line needs and what they cost. Pure, for the page and the tests.
import type { NoteRow } from './types.ts';

type Line = Pick<NoteRow, 'per_unit' | 'units' | 'price'>;

/** Pieces in all: 7 roses a vase × 21 vases = 147. */
export const quantity = (r: Line) => r.per_unit * r.units;

/** What the line costs, in RON. */
export const cost = (r: Line) => quantity(r) * r.price;

export const noteTotal = (rows: Line[]) => rows.reduce((sum, r) => sum + cost(r), 0);

/** A typed amount, "8,5" or "8.5"; empty, invalid or negative counts as 0. */
export function parseAmount(v: unknown): number {
	const n = Number(String(v ?? '').trim().replace(',', '.'));
	return Number.isFinite(n) && n > 0 ? n : 0;
}

const amount = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 });

/** 147 or 12,5: counts need not be whole (half a bunch of greenery). */
export const formatAmount = (n: number) => amount.format(n);
