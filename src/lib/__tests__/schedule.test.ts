import { describe, expect, it } from 'vitest';
import {
	currentId,
	duration,
	formatDuration,
	isTime,
	overlaps,
	SCHEDULE_TEMPLATE,
	shiftTime,
	sortSchedule
} from '../schedule.ts';

const item = (id: number, start_time: string, end_time = '') => ({ id, start_time, end_time });

describe('isTime', () => {
	it('accepts HH:MM from <input type="time"> and nothing else', () => {
		expect(isTime('08:05')).toBe(true);
		expect(isTime('23:59')).toBe(true);
		expect(isTime('24:00')).toBe(false);
		expect(isTime('8:05')).toBe(false);
		expect(isTime('')).toBe(false);
	});
});

describe('sortSchedule', () => {
	it('keeps after-midnight times at the end of the day', () => {
		const sorted = sortSchedule([item(1, '01:30'), item(2, '18:00'), item(3, '08:00'), item(4, '23:00')]);
		expect(sorted.map((i) => i.start_time)).toEqual(['08:00', '18:00', '23:00', '01:30']);
	});

	it('breaks ties by id so the order is stable', () => {
		expect(sortSchedule([item(5, '10:00'), item(2, '10:00')]).map((i) => i.id)).toEqual([2, 5]);
	});
});

describe('shiftTime', () => {
	it('moves a time and wraps around midnight', () => {
		expect(shiftTime('10:30', 15)).toBe('10:45');
		expect(shiftTime('08:00', -30)).toBe('07:30');
		expect(shiftTime('23:50', 20)).toBe('00:10');
		expect(shiftTime('00:10', -20)).toBe('23:50');
	});

	it('leaves an empty end time empty', () => {
		expect(shiftTime('', 15)).toBe('');
	});
});

describe('duration', () => {
	it('is null without an end, and crosses midnight', () => {
		expect(duration('18:00', '')).toBeNull();
		expect(duration('08:00', '10:30')).toBe(150);
		expect(duration('22:00', '02:00')).toBe(240);
	});

	it('formats hours and minutes', () => {
		expect(formatDuration(150)).toBe('2 h 30 min');
		expect(formatDuration(60)).toBe('1 h');
		expect(formatDuration(45)).toBe('45 min');
	});
});

describe('overlaps', () => {
	it('flags an item that starts before the previous one ends', () => {
		const sorted = sortSchedule([item(1, '08:00', '10:30'), item(2, '10:00', '11:00'), item(3, '11:00')]);
		expect([...overlaps(sorted)]).toEqual([2]);
	});

	it('finds no overlap in the default plan', () => {
		const sorted = sortSchedule(SCHEDULE_TEMPLATE.map((t, i) => ({ ...t, id: i + 1 })));
		expect(overlaps(sorted).size).toBe(0);
	});
});

describe('currentId', () => {
	const day = sortSchedule([item(1, '08:00', '10:30'), item(2, '15:00', '16:00'), item(3, '18:00')]);

	it('is the item in progress', () => {
		expect(currentId(day, '09:15')).toBe(1);
		expect(currentId(day, '15:00')).toBe(2);
	});

	it('is nothing before the day starts or in a gap', () => {
		expect(currentId(day, '07:00')).toBeNull();
		expect(currentId(day, '12:00')).toBeNull();
	});

	it('keeps an open-ended item going past midnight', () => {
		expect(currentId(day, '01:00')).toBe(3);
	});
});
