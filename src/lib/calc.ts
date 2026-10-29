// Pure planning math, shared by server loads and tests. All money results are in RON.
import type { Category, Currency, Expense, Guest, Household, RsvpStatus, Settings, Subcategory } from './types';

export function toRon(amount: number, currency: Currency, eurRate: number): number {
	return currency === 'EUR' ? amount * eurRate : amount;
}

export interface Headcount {
	invited: number;
	adults: number;
	children: number;
	confirmed: number;
	declined: number;
	pending: number;
	/** Confirmed, plus the share of not-yet-answered expected to come: the number the venue should plan for. */
	expectedAdults: number;
	expectedChildren: number;
	/** Expected adults who give a regular gift: everyone except nași, parents and the couple. */
	payingAdults: number;
}

export interface Person {
	is_child: number;
	attending: number | null;
	category?: Category;
	subcategory?: Subcategory;
}

/** The couple, the nași themselves (not their parents) and the couple's parents give no regular gift. */
export function isNonPaying(p: { category?: Category; subcategory?: Subcategory }): boolean {
	if (p.category === 'miri') return true;
	if (p.category === 'nasi') return !p.subcategory;
	return p.category === 'familie' && p.subcategory === 'parinti';
}

/** Flattens households into people carrying their household's category. */
export function people(households: (Pick<Household, 'category' | 'subcategory'> & { guests: Guest[] })[]): Person[] {
	return households.flatMap((h) =>
		h.guests.map((g) => ({
			is_child: g.is_child,
			attending: g.attending,
			category: h.category,
			subcategory: h.subcategory
		}))
	);
}

/**
 * People to plan for in one group: `attendance` (0–1) of everyone invited, never fewer than those who
 * confirmed nor more than those who have not declined. Within those bounds answers do not move it, so
 * marking one more guest as coming leaves a 60% estimate where it is. At 100% it is everyone not declined.
 */
export const expectedOf = (invited: number, confirmed: number, declined: number, attendance: number) =>
	Math.min(invited - declined, Math.max(confirmed, Math.round(invited * attendance)));

/** Expected numbers are worked out separately for adults, children and paying adults (see `expectedOf`). */
export function headcount(guests: Person[], attendance = 1): Headcount {
	const h: Headcount = {
		invited: guests.length,
		adults: 0,
		children: 0,
		confirmed: 0,
		declined: 0,
		pending: 0,
		expectedAdults: 0,
		expectedChildren: 0,
		payingAdults: 0
	};
	const group = () => ({ invited: 0, confirmed: 0, declined: 0 });
	const adults = group();
	const children = group();
	const paying = group();
	for (const g of guests) {
		if (g.is_child) h.children++;
		else h.adults++;
		if (g.attending === 1) h.confirmed++;
		else if (g.attending === 0) h.declined++;
		else h.pending++;
		for (const t of g.is_child ? [children] : isNonPaying(g) ? [adults] : [adults, paying]) {
			t.invited++;
			if (g.attending === 1) t.confirmed++;
			else if (g.attending === 0) t.declined++;
		}
	}
	const expected = (t: ReturnType<typeof group>) => expectedOf(t.invited, t.confirmed, t.declined, attendance);
	h.expectedAdults = expected(adults);
	h.expectedChildren = expected(children);
	h.payingAdults = expected(paying);
	return h;
}

/** The attendance setting (a percentage, 100 when unset) as the 0–1 share `headcount` takes. */
export const attendanceShare = (s: Pick<Settings, 'attendance_rate'>) =>
	Math.min(100, Math.max(0, s.attendance_rate)) / 100;

export function expenseTotal(
	e: Pick<Expense, 'kind' | 'amount' | 'currency'>,
	hc: Pick<Headcount, 'expectedAdults' | 'expectedChildren'>,
	eurRate: number
): number {
	const units =
		e.kind === 'per_adult' ? hc.expectedAdults : e.kind === 'per_child' ? hc.expectedChildren : 1;
	return toRon(e.amount * units, e.currency, eurRate);
}

export interface BudgetSummary {
	total: number;
	fixed: number;
	perGuest: number;
	paid: number;
	remaining: number;
}

export function budget(
	expenses: Pick<Expense, 'kind' | 'amount' | 'currency' | 'paid'>[],
	hc: Pick<Headcount, 'expectedAdults' | 'expectedChildren'>,
	eurRate: number
): BudgetSummary {
	let fixed = 0;
	let perGuest = 0;
	let paid = 0;
	for (const e of expenses) {
		const t = expenseTotal(e, hc, eurRate);
		if (e.kind === 'fixed') fixed += t;
		else perGuest += t;
		paid += toRon(e.paid, e.currency, eurRate);
	}
	const total = fixed + perGuest;
	return { total, fixed, perGuest, paid, remaining: Math.max(0, total - paid) };
}

export function giftsTotal(
	households: Pick<Household, 'gift_amount' | 'gift_currency'>[],
	eurRate: number
): number {
	return households.reduce((s, h) => s + toRon(h.gift_amount || 0, h.gift_currency, eurRate), 0);
}

/**
 * "Darul de echilibru": the average gift each regular adult guest would need to give so the
 * wedding breaks even, after the nași + parents contribution. Children, nași, parents and the
 * couple count as cost but not as regular givers.
 */
export function breakEven(totalCost: number, familyContribution: number, payingAdults: number): number {
	return payingAdults > 0 ? Math.max(0, totalCost - familyContribution) / payingAdults : 0;
}

/** Expected income before the wedding: family contribution plus the average gift per paying adult. */
export function projectedIncome(familyContribution: number, payingAdults: number, giftEstimate: number): number {
	return familyContribution + payingAdults * giftEstimate;
}

/** Share of total cost covered by gifts, as a percentage (can exceed 100). */
export function coveragePct(gifts: number, totalCost: number): number {
	return totalCost > 0 ? (gifts / totalCost) * 100 : 0;
}

export function householdStatus(members: Pick<Guest, 'attending'>[]): RsvpStatus {
	if (members.length === 0 || members.every((g) => g.attending === null)) return 'pending';
	return members.some((g) => g.attending === 1) ? 'yes' : 'no';
}

/** Parses YYYY-MM-DD as a UTC date, so day arithmetic is immune to DST shifts. */
function parseDay(iso: string): number {
	const [y, m, d] = iso.split('-').map(Number);
	return Date.UTC(y, m - 1, d);
}

const DAY = 86_400_000;

export function isoDay(ms: number): string {
	return new Date(ms).toISOString().slice(0, 10);
}

export function taskDueDate(weddingDate: string, daysBefore: number): string {
	return isoDay(parseDay(weddingDate) - daysBefore * DAY);
}

export function daysBetween(fromIso: string, toIso: string): number {
	return Math.round((parseDay(toIso) - parseDay(fromIso)) / DAY);
}

export function todayIso(now = new Date()): string {
	return isoDay(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const whole = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

/** Formats an amount held in RON in the wedding's display currency. */
export function formatMoney(ron: number, s: Pick<Settings, 'currency' | 'eur_rate'>): string {
	if (s.currency === 'EUR' && s.eur_rate > 0) return `${whole.format(Math.round(ron / s.eur_rate))} €`;
	return `${whole.format(Math.round(ron))} lei`;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
	if (!iso) return '';
	return new Intl.DateTimeFormat('ro-RO', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC',
		...opts
	}).format(parseDay(iso));
}
