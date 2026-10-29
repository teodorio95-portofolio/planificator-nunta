// The wedding-day timeline: pure time math on "HH:MM" strings, shared by the page and the tests.
import type { ScheduleItem } from './types';

const DAY = 24 * 60;
/** The day "starts" at 05:00, so 01:30 at the party sorts after 22:00, not before the make-up. */
const DAY_START = 5 * 60;

export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

export function toMinutes(t: string): number {
	const [h, m] = t.split(':').map(Number);
	return h * 60 + m;
}

export function fromMinutes(min: number): string {
	const m = ((min % DAY) + DAY) % DAY;
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutes since 05:00 of the wedding day; times after midnight come last. */
export function dayMinutes(t: string): number {
	return (toMinutes(t) - DAY_START + DAY) % DAY;
}

export const shiftTime = (t: string, delta: number) => (t ? fromMinutes(toMinutes(t) + delta) : t);

export function sortSchedule<T extends Pick<ScheduleItem, 'id' | 'start_time'>>(items: T[]): T[] {
	return [...items].sort((a, b) => dayMinutes(a.start_time) - dayMinutes(b.start_time) || a.id - b.id);
}

/** Length in minutes, or null without an end time. An end before the start runs past midnight. */
export function duration(start: string, end: string): number | null {
	if (!end) return null;
	return (toMinutes(end) - toMinutes(start) + DAY) % DAY || null;
}

export function formatDuration(min: number): string {
	const h = Math.floor(min / 60);
	const m = min % 60;
	return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(' ');
}

/** Ids of items that start before the previous item has ended (in a sorted list). */
export function overlaps(sorted: Pick<ScheduleItem, 'id' | 'start_time' | 'end_time'>[]): Set<number> {
	const out = new Set<number>();
	let busyUntil = -1;
	for (const it of sorted) {
		const start = dayMinutes(it.start_time);
		if (start < busyUntil) out.add(it.id);
		const len = duration(it.start_time, it.end_time);
		if (len !== null) busyUntil = Math.max(busyUntil, start + len);
	}
	return out;
}

/** The item happening at `now` ("HH:MM"): the last one started, unless it has an end that passed. */
export function currentId(sorted: Pick<ScheduleItem, 'id' | 'start_time' | 'end_time'>[], now: string): number | null {
	const at = dayMinutes(now);
	const started = sorted.filter((it) => dayMinutes(it.start_time) <= at).at(-1);
	if (!started) return null;
	const len = duration(started.start_time, started.end_time);
	return len === null || at < dayMinutes(started.start_time) + len ? started.id : null;
}

// A typical Romanian wedding day to start from. Times are a first guess, meant to be edited on the page.
export const SCHEDULE_TEMPLATE: Omit<ScheduleItem, 'id' | 'on_invite'>[] = [
	{ start_time: '08:00', end_time: '10:30', title: 'Machiaj și coafură', place: '', people: 'Mireasa', notes: '' },
	{
		start_time: '10:30',
		end_time: '13:00',
		title: 'Pregătiri și fotografii de la pregătire',
		place: '',
		people: 'Fotograf, videograf',
		notes: ''
	},
	{ start_time: '15:00', end_time: '16:00', title: 'Cununia religioasă', place: 'Biserica', people: 'Nașii', notes: '' },
	{
		start_time: '16:15',
		end_time: '17:45',
		title: 'Ședința foto oficială',
		place: '',
		people: 'Fotograf, videograf',
		notes: ''
	},
	{ start_time: '18:30', end_time: '19:30', title: 'Primirea invitaților', place: '', people: '', notes: '' },
	{ start_time: '19:30', end_time: '', title: 'Petrecerea', place: '', people: '', notes: '' }
];
