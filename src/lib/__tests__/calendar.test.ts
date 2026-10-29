import { describe, expect, it } from 'vitest';
import { calendarFile, googleCalendarUrl } from '../calendar.ts';

const wedding = { date: '2027-05-29', title: 'Nunta Ana & Mihai', location: 'Conacul Verde, Snagov' };

describe('calendarFile', () => {
	const ics = calendarFile(wedding, 'std-abc@example.com', new Date('2026-10-28T12:34:56.789Z'));

	it('is an all-day event ending the next day', () => {
		expect(ics).toContain('DTSTART;VALUE=DATE:20270529\r\n');
		expect(ics).toContain('DTEND;VALUE=DATE:20270530\r\n');
		expect(ics).toContain('DTSTAMP:20261028T123456Z\r\n');
		expect(ics).toContain('UID:std-abc@example.com\r\n');
	});

	it('escapes commas and leaves out what is missing', () => {
		expect(ics).toContain('LOCATION:Conacul Verde\\, Snagov\r\n');
		expect(ics).not.toContain('DESCRIPTION');
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
	});

	it('crosses a month and folds long lines', () => {
		const long = calendarFile({ date: '2027-12-31', title: 'Ă'.repeat(60) }, 'x');
		expect(long).toContain('DTEND;VALUE=DATE:20280101');
		for (const line of long.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
		expect(long.replace(/\r\n /g, '')).toContain(`SUMMARY:${'Ă'.repeat(60)}`);
	});
});

describe('googleCalendarUrl', () => {
	it('opens a new all-day event', () => {
		const url = new URL(googleCalendarUrl(wedding));
		expect(url.searchParams.get('action')).toBe('TEMPLATE');
		expect(url.searchParams.get('dates')).toBe('20270529/20270530');
		expect(url.searchParams.get('text')).toBe('Nunta Ana & Mihai');
		expect(url.searchParams.get('location')).toBe('Conacul Verde, Snagov');
	});
});
