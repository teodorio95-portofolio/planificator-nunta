import {
	attendanceShare,
	breakEven,
	budget,
	coveragePct,
	giftsTotal,
	headcount,
	householdStatus,
	people,
	projectedIncome,
	taskDueDate,
	toRon
} from '#lib/calc.ts';
import { getSettings } from '#lib/server/db.ts';
import { allExpenses, allTasks, householdsWithGuests } from '#lib/server/queries.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const settings = getSettings();
	const households = householdsWithGuests();
	const everyone = people(households);
	const hc = headcount(everyone, attendanceShare(settings));
	const expenses = allExpenses();
	const money = budget(expenses, hc, settings.eur_rate);
	// The ceiling: what it costs if every guest who has not declined comes.
	const hcMax = headcount(everyone);
	const moneyMax = budget(expenses, hcMax, settings.eur_rate);
	const gifts = giftsTotal(households, settings.eur_rate);

	const nextTasks = settings.wedding_date
		? allTasks()
				.filter((t) => !t.done)
				.map((t) => ({ ...t, due: taskDueDate(settings.wedding_date, t.days_before) }))
				.sort((a, b) => a.due.localeCompare(b.due))
				.slice(0, 4)
		: [];

	const statuses = households.map((h) => householdStatus(h.guests));
	return {
		hc,
		money,
		max: { people: hcMax.expectedAdults + hcMax.expectedChildren, total: moneyMax.total },
		gifts,
		coverage: coveragePct(gifts, money.total),
		breakEven: breakEven(money.total, toRon(settings.family_contribution, settings.currency, settings.eur_rate), hc.payingAdults),
		income: projectedIncome(
			toRon(settings.family_contribution, settings.currency, settings.eur_rate),
			hc.payingAdults,
			toRon(settings.gift_estimate, settings.currency, settings.eur_rate)
		),
		households: {
			total: households.length,
			answered: statuses.filter((s) => s !== 'pending').length,
			inviteSent: households.filter((h) => h.invite_sent).length
		},
		nextTasks,
		tasksLeft: allTasks().filter((t) => !t.done).length
	};
};
