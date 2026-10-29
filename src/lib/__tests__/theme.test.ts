import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODE_COOKIE, modeCookie, modeFrom, THEME_COOKIE, themeCookie, themeFrom } from '../theme.ts';

describe('themeFrom', () => {
	it('knows the wedding palette', () => {
		expect(themeFrom('nunta')).toBe('nunta');
	});
	it('falls back to the original for no cookie or an unknown one', () => {
		expect(themeFrom(undefined)).toBe('');
		expect(themeFrom('')).toBe('');
		expect(themeFrom('"><script>')).toBe('');
	});
});

describe('modeFrom', () => {
	it('knows light and dark', () => {
		expect(modeFrom('light')).toBe('light');
		expect(modeFrom('dark')).toBe('dark');
	});
	it('follows the device for no cookie or an unknown one', () => {
		expect(modeFrom(undefined)).toBe('');
		expect(modeFrom('nunta')).toBe('');
	});
});

describe('cookies', () => {
	it('keep a choice for a year and clear the default', () => {
		expect(themeCookie('nunta')).toBe(`${THEME_COOKIE}=nunta; path=/; max-age=31536000; samesite=lax`);
		expect(themeCookie('')).toBe(`${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`);
		expect(modeCookie('dark')).toBe(`${MODE_COOKIE}=dark; path=/; max-age=31536000; samesite=lax`);
		expect(modeCookie('')).toBe(`${MODE_COOKIE}=; path=/; max-age=0; samesite=lax`);
	});
});

describe('app.css', () => {
	// Each dark block is written twice: once chosen, once automatic on a dark device.
	const css = readFileSync(new URL('../../app.css', import.meta.url), 'utf8');
	const body = (selector: string) => {
		const start = css.indexOf(`${selector} {`);
		expect(start, selector).toBeGreaterThan(-1);
		return css
			.slice(start + selector.length + 2, css.indexOf('}', start))
			.replace(/\s+/g, ' ')
			.trim();
	};
	it('has the same chosen and automatic dark colours', () => {
		expect(body(":root:not([data-mode='light'])")).toBe(body(":root[data-mode='dark']"));
		expect(body(":root[data-theme='nunta']:not([data-mode='light'])")).toBe(
			body(":root[data-theme='nunta'][data-mode='dark']")
		);
	});
});
