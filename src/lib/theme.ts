// How the app looks on this device: its colours (the original greens and golds, or the wedding
// palette of pastel pink, lilac, peach, apricot, ivory and sage) and light or dark mode, or the
// device's own mode. Kept in cookies so the server renders the page that way from the first paint;
// app.css holds the colours, under html[data-theme] and html[data-mode].
import { createContext } from 'svelte';

export const THEME_COOKIE = 'nunta_theme';
export const THEMES = ['', 'nunta'] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = { '': 'Clasică', nunta: 'Pastel' };

export const MODE_COOKIE = 'nunta_mode';
/** '' follows the device. */
export const MODES = ['', 'light', 'dark'] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = { '': 'Automat', light: 'Luminos', dark: 'Întunecat' };

/** The browser bar's colour: the page background, or the header's tint with the wedding theme. */
export const THEME_COLORS: Record<Theme, Record<'light' | 'dark', string>> = {
	'': { light: '#faf7f2', dark: '#1a1816' },
	nunta: { light: '#fbf2ef', dark: '#231e21' }
};

const pick = <T extends string>(options: readonly T[], cookie: string | undefined) =>
	options.find((o) => o && o === cookie);

/** The cookie's theme; anything else, or none, is the original. */
export const themeFrom = (cookie: string | undefined): Theme => pick(THEMES, cookie) ?? '';

/** The cookie's mode; anything else, or none, follows the device. */
export const modeFrom = (cookie: string | undefined): Mode => pick(MODES, cookie) ?? '';

/** Sets a cookie from the browser: kept a year, or cleared for the default. */
const cookie = (name: string, value: string) =>
	`${name}=${value}; path=/; max-age=${value ? 60 * 60 * 24 * 365 : 0}; samesite=lax`;

export const themeCookie = (theme: Theme) => cookie(THEME_COOKIE, theme);
export const modeCookie = (mode: Mode) => cookie(MODE_COOKIE, mode);

/** The current look, shared by the root layout (which applies it) and the header (which changes it). */
export type Appearance = { theme: Theme; mode: Mode };
export const [getAppearance, setAppearance] = createContext<Appearance>();
