import { describe, expect, it } from 'vitest';
import { SCHEDULE_TEMPLATE } from '../schedule.ts';
import { countdown, daysAround, forGuests, programIcon, timeIn, weddingStart, withoutTime } from '../invitation.ts';

describe('timeIn', () => {
	it('finds the time in the ceremony text', () => {
		expect(timeIn('Biserica Sf. Nicolae, ora 15:00')).toEqual([15, 0]);
		expect(timeIn('ora 9.30, Snagov')).toEqual([9, 30]);
	});

	it('is null without one', () => {
		expect(timeIn('Biserica Sf. Nicolae')).toBeNull();
		expect(timeIn('')).toBeNull();
		expect(timeIn('Str. Lalelelor 25:70')).toBeNull();
	});
});

describe('withoutTime', () => {
	it('leaves the place, for the map search', () => {
		expect(withoutTime('Biserica Sf. Nicolae, ora 15:00')).toBe('Biserica Sf. Nicolae');
		expect(withoutTime('Biserica Sf. Nicolae - 15:00')).toBe('Biserica Sf. Nicolae');
		expect(withoutTime('Biserica Sf. Nicolae')).toBe('Biserica Sf. Nicolae');
	});
});

describe('weddingStart', () => {
	it('is the ceremony time on the clocks in Romania, summer time included', () => {
		// 15:00 EEST (UTC+3) on a September day.
		expect(new Date(weddingStart('2027-09-11', 'Biserica, ora 15:00')).toISOString()).toBe('2027-09-11T12:00:00.000Z');
		// 15:00 EET (UTC+2) in January.
		expect(new Date(weddingStart('2027-01-16', 'ora 15:00')).toISOString()).toBe('2027-01-16T13:00:00.000Z');
	});

	it('falls back to the start of the day', () => {
		expect(new Date(weddingStart('2027-09-11')).toISOString()).toBe('2027-09-10T21:00:00.000Z');
	});
});

describe('countdown', () => {
	const to = Date.UTC(2027, 8, 11, 12);

	it('splits what is left into days, hours, minutes and seconds', () => {
		const now = to - (2 * 86_400 + 3 * 3600 + 4 * 60 + 5) * 1000;
		expect(countdown(to, now)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
	});

	it('is null once the moment has come', () => {
		expect(countdown(to, to)).toBeNull();
		expect(countdown(to, to + 1000)).toBeNull();
	});
});

describe('daysAround', () => {
	it('runs from two days before to two days after, across a month end', () => {
		expect(daysAround('2027-09-12')).toEqual([10, 11, 12, 13, 14]);
		expect(daysAround('2027-08-31')).toEqual([29, 30, 31, 1, 2]);
	});
});

describe('programIcon', () => {
	it('picks the icon from the title, diacritics or not', () => {
		expect(programIcon('Cununia religioasă')).toBe('biserica');
		expect(programIcon('Primirea invitaților')).toBe('sampanie');
		expect(programIcon('Cina festivă')).toBe('cina');
		expect(programIcon('Tortul miresei')).toBe('tort');
		expect(programIcon('Dansul mirilor')).toBe('dans');
		expect(programIcon('Petrecerea')).toBe('disco');
		expect(programIcon('Noapte bună')).toBe('luna');
	});

	it('is null when nothing fits', () => {
		expect(programIcon('Ședința foto')).toBeNull();
	});
});

describe('forGuests', () => {
	it('keeps the couple\'s own moments off the invitation', () => {
		expect(SCHEDULE_TEMPLATE.filter((it) => forGuests(it.title)).map((it) => it.title)).toEqual([
			'Cununia religioasă',
			'Primirea invitaților',
			'Petrecerea'
		]);
	});
});
