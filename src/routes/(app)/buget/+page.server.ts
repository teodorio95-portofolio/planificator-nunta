import { fail } from '@sveltejs/kit';
import {
	attendanceShare,
	breakEven,
	budget,
	coveragePct,
	expenseTotal,
	giftsTotal,
	headcount,
	people,
	projectedIncome,
	toRon
} from '#lib/calc.ts';
import { getSettings, run } from '#lib/server/db.ts';
import { allExpenses, householdsWithGuests } from '#lib/server/queries.ts';
import { EXPENSE_KINDS, type ExpenseKind } from '#lib/types.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const s = getSettings();
	const households = householdsWithGuests();
	const everyone = people(households);
	const hc = headcount(everyone, attendanceShare(s));
	const family = toRon(s.family_contribution, s.currency, s.eur_rate);
	const expenses = allExpenses();
	const money = budget(expenses, hc, s.eur_rate);
	const gifts = giftsTotal(households, s.eur_rate);
	return {
		hc,
		money,
		maxTotal: budget(expenses, headcount(everyone), s.eur_rate).total,
		gifts,
		coverage: coveragePct(gifts, money.total),
		breakEven: breakEven(money.total, family, hc.payingAdults),
		// The family contribution itself is not sent: only the admin sees it, in Setări.
		income: projectedIncome(family, hc.payingAdults, toRon(s.gift_estimate, s.currency, s.eur_rate)),
		expenses: expenses.map((e) => ({ ...e, total: expenseTotal(e, hc, s.eur_rate) })),
		giftRows: households.map((h) => ({
			id: h.id,
			name: h.name,
			gift_amount: h.gift_amount,
			gift_currency: h.gift_currency,
			gift_method: h.gift_method,
			coming: h.guests.some((g) => g.attending === 1)
		}))
	};
};

const num = (v: FormDataEntryValue | null) => Math.max(0, Number(String(v ?? '').replace(',', '.')) || 0);
const kind = (v: FormDataEntryValue | null) => (String(v) in EXPENSE_KINDS ? String(v) : 'fixed') as ExpenseKind;
const currency = (v: FormDataEntryValue | null) => (v === 'EUR' ? 'EUR' : 'RON');

function expenseFields(f: FormData) {
	return [
		String(f.get('category') ?? 'Altele'),
		String(f.get('name') ?? '').trim(),
		String(f.get('vendor') ?? '').trim(),
		kind(f.get('kind')),
		num(f.get('amount')),
		currency(f.get('currency')),
		num(f.get('paid')),
		String(f.get('due_date') ?? '')
	] as const;
}

export const actions: Actions = {
	addExpense: async ({ request }) => {
		const fields = expenseFields(await request.formData());
		if (!fields[1]) return fail(400, { error: 'Completați descrierea cheltuielii.' });
		run(
			'INSERT INTO expenses (category, name, vendor, kind, amount, currency, paid, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			...fields
		);
	},

	updateExpense: async ({ request }) => {
		const f = await request.formData();
		const fields = expenseFields(f);
		if (!fields[1]) return fail(400, { error: 'Descrierea nu poate fi goală.' });
		run(
			`UPDATE expenses SET category = ?, name = ?, vendor = ?, kind = ?, amount = ?, currency = ?, paid = ?, due_date = ?
			 WHERE id = ?`,
			...fields,
			Number(f.get('id'))
		);
	},

	deleteExpense: async ({ request }) => {
		run('DELETE FROM expenses WHERE id = ?', Number((await request.formData()).get('id')));
	},

	setGift: async ({ request }) => {
		const f = await request.formData();
		const method = String(f.get('gift_method') ?? '');
		run(
			'UPDATE households SET gift_amount = ?, gift_currency = ?, gift_method = ? WHERE id = ?',
			num(f.get('gift_amount')),
			currency(f.get('gift_currency')),
			['numerar', 'transfer'].includes(method) ? method : '',
			Number(f.get('id'))
		);
	}
};
