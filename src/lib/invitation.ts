// The invitation (the RSVP page): its countdown to the wedding, the days around it, and which
// drawn icon goes with each moment of the program. Pure, so the page and the tests share it.

/** "15:00" or "15.00" in free text such as "Biserica Sf. Nicolae, ora 15:00". */
const TIME = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/;

/** The first time of day named in the text, as [hours, minutes], or null. */
export function timeIn(text: string): [number, number] | null {
	const m = TIME.exec(text);
	return m ? [Number(m[1]), Number(m[2])] : null;
}

/** The text without its time: "Biserica Sf. Nicolae, ora 15:00" → "Biserica Sf. Nicolae", for the map search. */
export const withoutTime = (text: string) =>
	text
		.replace(/[,;·–-]?\s*(ora|la)?\s*\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/i, '')
		.trim();

/** How far the wall clock in `timeZone` is ahead of UTC at that instant, in ms. */
function zoneOffset(utc: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric'
	}).formatToParts(utc);
	const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
	return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - utc;
}

/**
 * When the wedding starts, in ms since the epoch: the ceremony's time if its text names one, else the
 * start of the day, on the clocks in Romania (so a guest abroad counts down to the same moment).
 */
export function weddingStart(date: string, ceremony = '', timeZone = 'Europe/Bucharest'): number {
	const [y, m, d] = date.split('-').map(Number);
	const [hh, mm] = timeIn(ceremony) ?? [0, 0];
	const wall = Date.UTC(y, m - 1, d, hh, mm);
	return wall - zoneOffset(wall, timeZone);
}

export type Countdown = { days: number; hours: number; minutes: number; seconds: number };

/** What is left until `to`, or null once it has passed. */
export function countdown(to: number, now: number): Countdown | null {
	const left = Math.floor((to - now) / 1000);
	if (left <= 0) return null;
	return {
		days: Math.floor(left / 86_400),
		hours: Math.floor(left / 3600) % 24,
		minutes: Math.floor(left / 60) % 60,
		seconds: left % 60
	};
}

/** The day numbers from two days before the wedding to two days after, for the program's calendar strip. */
export function daysAround(date: string): number[] {
	const [y, m, d] = date.split('-').map(Number);
	return [-2, -1, 0, 1, 2].map((i) => new Date(Date.UTC(y, m - 1, d + i)).getUTCDate());
}

/** The seal's letters: the couple's own monogram if set, else their initials joined by "&" ("A&M"). */
export function monogramOf(partner1: string, partner2: string, monogram = ''): string {
	if (monogram.trim()) return monogram.trim().slice(0, 4);
	return [partner1, partner2]
		.map((n) => n.trim()[0]?.toUpperCase())
		.filter(Boolean)
		.join('&');
}

export const PROGRAM_ICONS = ['biserica', 'sampanie', 'cina', 'tort', 'dans', 'disco', 'luna'] as const;
export type ProgramIcon = (typeof PROGRAM_ICONS)[number];

// First match wins, so "Tortul și artificiile" is the cake, and "Cina festivă" the dinner.
const ICON_WORDS: [ProgramIcon, RegExp][] = [
	['biserica', /biseric|cununi|slujb|ceremoni/],
	['tort', /tort/],
	['dans', /dans|vals/],
	['cina', /cin[aă]|meniu|mas[aă]|preparat|aperitiv|fel/],
	['sampanie', /primir|sosir|cocktail|bun venit|sampani|welcome|toast/],
	['luna', /final|sfarsit|noapte|ramas bun|plecare|artifici/],
	['disco', /petrecer|party|dj|formati|muzic|distractie/]
];

/** The drawn icon for a moment of the program, from its title; null when nothing fits. */
export function programIcon(title: string): ProgramIcon | null {
	const t = title
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{M}/gu, '');
	return ICON_WORDS.find(([, re]) => re.test(t))?.[0] ?? null;
}

/** Whether guests should see a moment unless the couple says otherwise: the ones with a drawn icon
 * (ceremony, welcome, dinner, dance, cake, party, the end), not the make-up, travel or photo shoots. */
export const forGuests = (title: string) => programIcon(title) !== null;
