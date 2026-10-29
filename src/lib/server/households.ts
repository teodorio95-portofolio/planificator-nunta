import { all, get, newToken, run, transaction } from './db';
import { fold, type ImportedHousehold } from '#lib/guests.ts';
import type { Category, Menu, Side, Subcategory } from '#lib/types.ts';

export function createHousehold(h: {
	name: string;
	side: Side;
	category: Category;
	subcategory: Subcategory;
	phone?: string;
	notes?: string;
	tbd?: number;
	guests: { name: string; is_child: number; menu?: Menu; dietary?: string }[];
}): number {
	return transaction(() => {
		const id = insertHousehold(h);
		for (const g of h.guests) addGuest(id, g);
		return id;
	});
}

function insertHousehold(h: Omit<Parameters<typeof createHousehold>[0], 'guests'>): number {
	return Number(
		run(
			'INSERT INTO households (name, side, category, subcategory, phone, notes, tbd, token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
			h.name,
			h.side,
			h.category,
			h.subcategory,
			h.phone ?? '',
			h.notes ?? '',
			h.tbd ?? 0,
			newToken()
		).lastInsertRowid
	);
}

export function addGuest(
	householdId: number,
	g: { name: string; is_child: number; menu?: Menu; dietary?: string }
) {
	run(
		'INSERT INTO guests (household_id, name, is_child, menu, dietary) VALUES (?, ?, ?, ?, ?)',
		householdId,
		g.name,
		g.is_child,
		g.menu ?? (g.is_child ? 'copil' : 'standard'),
		g.dietary ?? ''
	);
}

/**
 * Idempotent import: households match by name (diacritics- and case-insensitive),
 * guests already present in a household are skipped. An existing household without a category
 * or notes takes the file's ones (what was set in the app is never overwritten).
 * Returns counts for the flash message.
 */
export function importHouseholds(list: ImportedHousehold[]): {
	households: number;
	guests: number;
	categorised: number;
} {
	let households = 0;
	let guests = 0;
	let categorised = 0;
	transaction(() => {
		const existing = new Map(
			all<{ id: number; name: string }>('SELECT id, name FROM households').map((h) => [fold(h.name), h.id])
		);
		for (const h of list) {
			let id = existing.get(fold(h.name));
			if (id !== undefined && h.category) {
				categorised += Number(
					run(
						"UPDATE households SET category = ?, subcategory = ? WHERE id = ? AND category = ''",
						h.category,
						h.subcategory,
						id
					).changes
				);
			}
			if (id !== undefined && h.notes) {
				run("UPDATE households SET notes = ? WHERE id = ? AND notes = ''", h.notes, id);
			}
			if (id === undefined) {
				id = insertHousehold(h);
				existing.set(fold(h.name), id);
				households++;
			}
			const present = new Set(
				all<{ name: string }>('SELECT name FROM guests WHERE household_id = ?', id).map((g) => fold(g.name))
			);
			for (const g of h.guests) {
				if (present.has(fold(g.name))) continue;
				addGuest(id, g);
				present.add(fold(g.name));
				guests++;
			}
		}
	});
	return { households, guests, categorised };
}

/** A menu still on its default follows the child flag; a chosen one (vegetarian…) stays. */
export function setChild(guestId: number, isChild: number) {
	run(
		`UPDATE guests SET is_child = ?,
		 menu = CASE WHEN ? = 1 AND menu = 'standard' THEN 'copil' WHEN ? = 0 AND menu = 'copil' THEN 'standard' ELSE menu END
		 WHERE id = ?`,
		isChild,
		isChild,
		isChild,
		guestId
	);
}

export interface ReplaceResult {
	added: number;
	updated: number;
	removed: number;
	guestsAdded: number;
	guestsRemoved: number;
}

/**
 * Makes the guest list match the file. Households match by name, as in `importHouseholds`; a matched
 * one takes the file's side, category, notes and TBD flag. Members match by name within it, so their
 * answers, menus and seats survive. Members and households missing from the file are deleted.
 */
export function replaceHouseholds(list: ImportedHousehold[]): ReplaceResult {
	const r: ReplaceResult = { added: 0, updated: 0, removed: 0, guestsAdded: 0, guestsRemoved: 0 };
	transaction(() => {
		const existing = new Map(
			all<{ id: number; name: string }>('SELECT id, name FROM households').map((h) => [fold(h.name), h.id])
		);
		for (const h of list) {
			let id = existing.get(fold(h.name));
			existing.delete(fold(h.name));
			if (id === undefined) {
				id = insertHousehold(h);
				r.added++;
			} else {
				run(
					`UPDATE households SET side = ?, category = ?, subcategory = ?, notes = ?, tbd = ?,
					 phone = CASE WHEN ? != '' THEN ? ELSE phone END WHERE id = ?`,
					h.side,
					h.category,
					h.subcategory,
					h.notes,
					h.tbd,
					h.phone,
					h.phone,
					id
				);
				r.updated++;
			}

			const unmatched = all<{ id: number; name: string }>('SELECT id, name FROM guests WHERE household_id = ? ORDER BY id', id);
			for (const g of h.guests) {
				const i = unmatched.findIndex((u) => fold(u.name) === fold(g.name));
				if (i < 0) {
					addGuest(id, g);
					r.guestsAdded++;
					continue;
				}
				// The file decides who is a child.
				setChild(unmatched[i].id, g.is_child);
				unmatched.splice(i, 1);
			}
			for (const u of unmatched) run('DELETE FROM guests WHERE id = ?', u.id);
			r.guestsRemoved += unmatched.length;
		}
		// What is left was not in the file.
		for (const id of existing.values()) {
			r.guestsRemoved += get<{ n: number }>('SELECT COUNT(*) AS n FROM guests WHERE household_id = ?', id)!.n;
			run('DELETE FROM households WHERE id = ?', id);
			r.removed++;
		}
	});
	return r;
}

export const householdExists = (id: number) => !!get('SELECT 1 FROM households WHERE id = ?', id);
