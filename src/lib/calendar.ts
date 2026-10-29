// "Add to calendar" for the save the date: the wedding as an all-day event, as an .ics file
// (Apple Calendar, Outlook, most Android apps) and as a Google Calendar link. Pure, for the tests.

export type CalendarEvent = { date: string; title: string; location?: string; description?: string };

/** "2027-05-29" → "20270529", and the day after, since an all-day event ends the next day. */
function days(date: string): [string, string] {
	const [y, m, d] = date.split('-').map(Number);
	const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
	return [date.replaceAll('-', ''), next.replaceAll('-', '')];
}

/** RFC 5545 text: backslash, comma, semicolon and newlines escaped. */
const escape = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n');

/** RFC 5545 lines are at most 75 octets; longer ones continue on lines starting with a space. */
function fold(line: string): string {
	const out: string[] = [];
	let cur = '';
	for (const ch of line) {
		const limit = out.length ? 74 : 75;
		if (new TextEncoder().encode(cur + ch).length > limit) {
			out.push(cur);
			cur = '';
		}
		cur += ch;
	}
	out.push(cur);
	return out.join('\r\n ');
}

/** The .ics file for the event; `uid` keeps a second download from adding a second event. */
export function calendarFile(e: CalendarEvent, uid: string, now = new Date()): string {
	const [start, end] = days(e.date);
	const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//nunta//save the date//RO',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${stamp}`,
		`DTSTART;VALUE=DATE:${start}`,
		`DTEND;VALUE=DATE:${end}`,
		`SUMMARY:${escape(e.title)}`,
		e.location && `LOCATION:${escape(e.location)}`,
		e.description && `DESCRIPTION:${escape(e.description)}`,
		'TRANSP:OPAQUE',
		'END:VEVENT',
		'END:VCALENDAR'
	];
	return lines.filter(Boolean).map((l) => fold(l as string)).join('\r\n') + '\r\n';
}

/** The same event opened in Google Calendar's "new event" screen. */
export function googleCalendarUrl(e: CalendarEvent): string {
	const [start, end] = days(e.date);
	const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${start}/${end}` });
	if (e.location) q.set('location', e.location);
	if (e.description) q.set('details', e.description);
	return `https://calendar.google.com/calendar/render?${q}`;
}
