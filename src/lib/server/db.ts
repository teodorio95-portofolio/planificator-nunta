import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { forGuests } from '#lib/invitation.ts';
import { SCHEDULE_TEMPLATE } from '#lib/schedule.ts';
import { TASK_TEMPLATE } from '#lib/tasks-template.ts';
import type { Settings } from '#lib/types.ts';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS households (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	side TEXT NOT NULL DEFAULT 'comun' CHECK (side IN ('mire', 'mireasa', 'comun')),
	-- Free text checked by the app (types.ts CATEGORIES / SUBCATEGORIES), so the lists can grow without a table rebuild.
	category TEXT NOT NULL DEFAULT '',
	subcategory TEXT NOT NULL DEFAULT '',
	token TEXT NOT NULL UNIQUE,
	phone TEXT NOT NULL DEFAULT '',
	-- The guest sheet's "Observatii" and "TBD" ("?": not sure yet whether to invite them; still counted).
	notes TEXT NOT NULL DEFAULT '',
	tbd INTEGER NOT NULL DEFAULT 0,
	invite_sent INTEGER NOT NULL DEFAULT 0,
	rsvp_note TEXT NOT NULL DEFAULT '',
	responded_at TEXT,
	gift_amount REAL NOT NULL DEFAULT 0,
	gift_currency TEXT NOT NULL DEFAULT 'RON' CHECK (gift_currency IN ('RON', 'EUR')),
	gift_method TEXT NOT NULL DEFAULT '' CHECK (gift_method IN ('', 'numerar', 'transfer'))
);

CREATE TABLE IF NOT EXISTS tables (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	capacity INTEGER NOT NULL DEFAULT 10,
	shape TEXT NOT NULL DEFAULT 'rotunda' CHECK (shape IN ('rotunda', 'dreptunghiulara')),
	x REAL NOT NULL DEFAULT 50,
	y REAL NOT NULL DEFAULT 50
);

-- Non-seating things drawn on the floor plan (dance floor, band, entrance…). Units: % of the plan.
CREATE TABLE IF NOT EXISTS floor_items (
	id INTEGER PRIMARY KEY,
	label TEXT NOT NULL,
	x REAL NOT NULL DEFAULT 50,
	y REAL NOT NULL DEFAULT 50,
	w REAL NOT NULL DEFAULT 20,
	h REAL NOT NULL DEFAULT 15
);

CREATE TABLE IF NOT EXISTS guests (
	id INTEGER PRIMARY KEY,
	household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	is_child INTEGER NOT NULL DEFAULT 0,
	attending INTEGER,
	menu TEXT NOT NULL DEFAULT 'standard',
	dietary TEXT NOT NULL DEFAULT '',
	table_id INTEGER REFERENCES tables(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS guests_household ON guests(household_id);

CREATE TABLE IF NOT EXISTS expenses (
	id INTEGER PRIMARY KEY,
	category TEXT NOT NULL,
	name TEXT NOT NULL,
	vendor TEXT NOT NULL DEFAULT '',
	kind TEXT NOT NULL DEFAULT 'fixed' CHECK (kind IN ('fixed', 'per_adult', 'per_child')),
	amount REAL NOT NULL DEFAULT 0,
	currency TEXT NOT NULL DEFAULT 'RON' CHECK (currency IN ('RON', 'EUR')),
	paid REAL NOT NULL DEFAULT 0,
	due_date TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL,
	category TEXT NOT NULL DEFAULT 'Organizare',
	days_before INTEGER NOT NULL DEFAULT 0,
	done INTEGER NOT NULL DEFAULT 0
);

-- The wedding-day timeline. Times are "HH:MM" on the wedding date; end_time '' = open-ended.
-- on_invite: also shown to guests, in the program on the RSVP page.
CREATE TABLE IF NOT EXISTS schedule (
	id INTEGER PRIMARY KEY,
	start_time TEXT NOT NULL,
	end_time TEXT NOT NULL DEFAULT '',
	title TEXT NOT NULL,
	place TEXT NOT NULL DEFAULT '',
	people TEXT NOT NULL DEFAULT '',
	notes TEXT NOT NULL DEFAULT '',
	on_invite INTEGER NOT NULL DEFAULT 0
);

-- The couple's working notes (admins only). updated_by: the e-mail of whoever last changed one.
CREATE TABLE IF NOT EXISTS notes (
	id INTEGER PRIMARY KEY,
	title TEXT NOT NULL,
	body TEXT NOT NULL DEFAULT '',
	pinned INTEGER NOT NULL DEFAULT 0,
	updated_by TEXT NOT NULL DEFAULT '',
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- A note's calculator: per_unit pieces on each of the units (7 roses × 21 vases), at price RON a piece.
CREATE TABLE IF NOT EXISTS note_rows (
	id INTEGER PRIMARY KEY,
	note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
	item TEXT NOT NULL,
	per_unit REAL NOT NULL DEFAULT 1,
	unit TEXT NOT NULL DEFAULT '',
	units REAL NOT NULL DEFAULT 1,
	price REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS note_rows_note ON note_rows(note_id);

-- Readers the admin added from Setări, on top of READER_EMAILS. E-mails are stored lowercased.
CREATE TABLE IF NOT EXISTS readers (
	email TEXT PRIMARY KEY,
	added_by TEXT NOT NULL DEFAULT '',
	added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Google sign-in sessions. The cookie holds a random token; only its SHA-256 is stored.
CREATE TABLE IF NOT EXISTS sessions (
	id INTEGER PRIMARY KEY,
	token_hash TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL,
	user_agent TEXT NOT NULL DEFAULT '',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	expires_at TEXT NOT NULL
);
`;

const DEFAULTS: Settings = {
	partner1: '',
	partner2: '',
	monogram: '',
	wedding_date: '',
	venue: '',
	venue_address: '',
	ceremony: '',
	rsvp_deadline: '',
	currency: 'RON',
	eur_rate: 5,
	budget_total: 0,
	family_contribution: 0,
	gift_estimate: 0,
	attendance_rate: 100
};

let instance: DatabaseSync | undefined;

/** Opened lazily so `vite build` (which imports server code) never touches the file. */
export function db(): DatabaseSync {
	if (instance) return instance;
	const path = process.env.DATABASE_PATH ?? 'data/nunta.db';
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	instance = new DatabaseSync(path);
	instance.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
	instance.exec(SCHEMA);
	addColumn(instance, 'tables', 'x', 'REAL NOT NULL DEFAULT 50');
	addColumn(instance, 'tables', 'y', 'REAL NOT NULL DEFAULT 50');
	addColumn(instance, 'households', 'category', "TEXT NOT NULL DEFAULT ''");
	addColumn(instance, 'households', 'subcategory', "TEXT NOT NULL DEFAULT ''");
	addColumn(instance, 'households', 'notes', "TEXT NOT NULL DEFAULT ''");
	addColumn(instance, 'households', 'tbd', 'INTEGER NOT NULL DEFAULT 0');
	if (addColumn(instance, 'schedule', 'on_invite', 'INTEGER NOT NULL DEFAULT 0')) {
		// The first time: put on the invitation the moments that are the guests' too.
		const show = instance.prepare('UPDATE schedule SET on_invite = 1 WHERE id = ?');
		for (const it of instance.prepare('SELECT id, title FROM schedule').all() as { id: number; title: string }[]) {
			if (forGuests(it.title)) show.run(it.id);
		}
	}
	migrateRole(instance);
	// Lista B is gone: everyone is on the one guest list.
	dropColumn(instance, 'households', 'tentative');
	const seeded = instance.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number };
	if (seeded.n === 0) {
		const ins = instance.prepare('INSERT INTO tasks (title, category, days_before) VALUES (?, ?, ?)');
		for (const t of TASK_TEMPLATE) ins.run(t.title, t.category, t.days);
	}
	const planned = instance.prepare('SELECT COUNT(*) AS n FROM schedule').get() as { n: number };
	if (planned.n === 0) {
		const ins = instance.prepare(
			'INSERT INTO schedule (start_time, end_time, title, place, people, notes, on_invite) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);
		for (const s of SCHEDULE_TEMPLATE) {
			ins.run(s.start_time, s.end_time, s.title, s.place, s.people, s.notes, forGuests(s.title) ? 1 : 0);
		}
	}
	return instance;
}

/** Tiny forward-only migration: databases created before a column existed get it added. True if it was. */
function addColumn(d: DatabaseSync, table: string, column: string, decl: string): boolean {
	const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (cols.some((c) => c.name === column)) return false;
	d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
	return true;
}

/** Its counterpart for a column the app no longer uses. */
function dropColumn(d: DatabaseSync, table: string, column: string) {
	const cols = d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
	if (cols.some((c) => c.name === column)) d.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
}

/** The old households.role (nasi / parinti / miri) became category + subcategory. */
function migrateRole(d: DatabaseSync) {
	const cols = d.prepare('PRAGMA table_info(households)').all() as { name: string }[];
	if (!cols.some((c) => c.name === 'role')) return;
	d.exec(`BEGIN;
		UPDATE households SET
			category = CASE role WHEN 'parinti' THEN 'familie' ELSE role END,
			subcategory = CASE role WHEN 'parinti' THEN 'parinti' ELSE subcategory END
		WHERE role != '' AND category = '';
		ALTER TABLE households DROP COLUMN role;
		COMMIT;`);
}

/** Directory next to the database, for uploaded files such as the floor plan photo. */
export function dataDir(): string {
	const path = process.env.DATABASE_PATH ?? 'data/nunta.db';
	return path === ':memory:' ? 'data' : dirname(path);
}

/** The uploaded floor plan photo; the browser sniffs JPG/PNG/WebP from the bytes. */
export const planImagePath = () => join(dataDir(), 'plan-sala.img');

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
	return db().prepare(sql).all(...params) as unknown as T[];
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
	return db().prepare(sql).get(...params) as unknown as T | undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
	return db().prepare(sql).run(...params);
}

export function transaction<T>(fn: () => T): T {
	db().exec('BEGIN');
	try {
		const result = fn();
		db().exec('COMMIT');
		return result;
	} catch (e) {
		db().exec('ROLLBACK');
		throw e;
	}
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);

export function newToken(): string {
	return randomBytes(9).toString('base64url');
}

export function getSettings(): Settings {
	const rows = all<{ key: string; value: string }>('SELECT key, value FROM settings');
	const s: Settings = { ...DEFAULTS };
	for (const { key, value } of rows) {
		if (!(key in s)) continue;
		const k = key as keyof Settings;
		(s as unknown as Record<string, string | number>)[k] =
			typeof DEFAULTS[k] === 'number' ? Number(value) || 0 : value;
	}
	return s;
}

export function saveSettings(s: Partial<Settings>) {
	transaction(() => {
		for (const [k, v] of Object.entries(s)) {
			if (!(k in DEFAULTS) || v === undefined) continue;
			run(
				'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
				k,
				String(v)
			);
		}
	});
}
