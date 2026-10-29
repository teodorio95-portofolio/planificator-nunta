import { all, get } from './db';
import { sortSchedule } from '#lib/schedule.ts';
import {
	byCategory,
	type Expense,
	type Guest,
	type Household,
	type Note,
	type NoteRow,
	type ScheduleItem,
	type Task
} from '#lib/types.ts';

export type HouseholdWithGuests = Household & { guests: Guest[] };
export type NoteWithRows = Note & { rows: NoteRow[] };

/** Pinned first, then newest first, so editing a note never moves it; lines in the order they were added. */
export function allNotes(): NoteWithRows[] {
	const rows = all<NoteRow>('SELECT * FROM note_rows ORDER BY id');
	return all<Note>('SELECT * FROM notes ORDER BY pinned DESC, id DESC').map((n) => ({
		...n,
		rows: rows.filter((r) => r.note_id === n.id)
	}));
}

export const allGuests = () => all<Guest>('SELECT * FROM guests ORDER BY household_id, id');

export const allExpenses = () => all<Expense>('SELECT * FROM expenses ORDER BY category, id');

export const allTasks = () => all<Task>('SELECT * FROM tasks ORDER BY days_before DESC, id');

/** In the order of the day; SQL cannot sort 01:00 after 23:00. */
export const allSchedule = () => sortSchedule(all<ScheduleItem>('SELECT * FROM schedule'));

/** In CATEGORIES order (couple, nași, family…), then by subcategory, then alphabetically. */
export function householdsWithGuests(): HouseholdWithGuests[] {
	const households = all<Household>('SELECT * FROM households ORDER BY name COLLATE NOCASE').sort(byCategory);
	const byHousehold = Map.groupBy(allGuests(), (g) => g.household_id);
	return households.map((h) => ({ ...h, guests: byHousehold.get(h.id) ?? [] }));
}

export function householdById(id: number): HouseholdWithGuests | undefined {
	const h = get<Household>('SELECT * FROM households WHERE id = ?', id);
	if (!h) return undefined;
	return { ...h, guests: all<Guest>('SELECT * FROM guests WHERE household_id = ? ORDER BY id', id) };
}

export function householdByToken(token: string): HouseholdWithGuests | undefined {
	const h = get<Household>('SELECT * FROM households WHERE token = ?', token);
	return h && householdById(h.id);
}
