import { fail } from '@sveltejs/kit';
import { accessLists, cleanEmail, ROLE_LABELS } from '#lib/access.ts';
import { headcount, people } from '#lib/calc.ts';
import {
	activeSessions,
	addedReaders,
	addReader,
	googleEnabled,
	passwordEnabled,
	removeReader,
	revokeSession,
	roleOf
} from '#lib/server/auth.ts';
import { saveSettings } from '#lib/server/db.ts';
import { isMediaKind, MEDIA_MAX_BYTES, mediaUrls, removeMedia, saveMedia, sniff } from '#lib/server/media.ts';
import { householdsWithGuests } from '#lib/server/queries.ts';
import type { Actions, PageServerLoad } from './$types';

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const money = (f: FormData, k: string) => Math.max(0, Number(text(f, k).replace(',', '.')) || 0);
/** A whole percentage; empty or invalid means 100 (plan for everyone). */
const percent = (f: FormData, k: string) => {
	const v = Number(text(f, k).replace(',', '.').replace('%', ''));
	return text(f, k) && Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 100;
};

// Admin-only, like everything under /setari (see #lib/access.ts).
export const load: PageServerLoad = ({ cookies }) => {
	const everyone = people(householdsWithGuests());
	const hc = headcount(everyone);
	return {
		sessions: activeSessions(cookies),
		media: mediaUrls(),
		access: accessLists(),
		google: googleEnabled(),
		password: passwordEnabled(),
		addedReaders: addedReaders(),
		// For the live "≈ N persoane" next to the attendance rate, worked out as Acasă and Buget do.
		everyone,
		answers: { invited: hc.invited, confirmed: hc.confirmed, declined: hc.declined }
	};
};

export const actions: Actions = {
	uploadMedia: async ({ request }) => {
		const f = await request.formData();
		const kind = text(f, 'kind');
		const file = f.get('file');
		if (!isMediaKind(kind) || !(file instanceof File) || !file.size) return fail(400, { error: 'Alegeți un fișier.' });
		if (file.size > MEDIA_MAX_BYTES[kind])
			return fail(400, { error: `Fișierul e prea mare (maxim ${MEDIA_MAX_BYTES[kind] / 1024 / 1024} MB).` });
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (!sniff(kind, bytes))
			return fail(400, { error: kind === 'cover' ? 'Doar JPG, PNG sau WebP.' : 'Doar MP3 sau M4A.' });
		saveMedia(kind, bytes);
		return { message: kind === 'cover' ? 'Poza a fost încărcată.' : 'Muzica a fost încărcată.' };
	},
	removeMedia: async ({ request }) => {
		const kind = text(await request.formData(), 'kind');
		if (isMediaKind(kind)) removeMedia(kind);
		return { message: 'Fișierul a fost șters.' };
	},
	revoke: async ({ request }) => {
		revokeSession(Number((await request.formData()).get('id')));
		return { message: 'Dispozitivul a fost deconectat.' };
	},
	addReader: async ({ request, locals }) => {
		const typed = text(await request.formData(), 'email');
		const email = cleanEmail(typed);
		if (!email) return fail(400, { error: 'Scrieți adresa contului Google, ex. nume@gmail.com.', email: typed });
		const role = roleOf(email);
		if (role) return fail(400, { error: `${email} are deja acces: ${ROLE_LABELS[role]}.`, email: typed });
		addReader(email, locals.user!.email);
		return { message: `${email} poate intra acum, doar cu citire.` };
	},
	removeReader: async ({ request }) => {
		const email = text(await request.formData(), 'email');
		removeReader(email);
		const still = roleOf(email);
		return { message: still ? `${email} a fost scos, dar e încă pe o listă din .env.` : `${email} nu mai are acces.` };
	},
	save: async ({ request }) => {
		const f = await request.formData();
		saveSettings({
			partner1: text(f, 'partner1'),
			partner2: text(f, 'partner2'),
			monogram: text(f, 'monogram').slice(0, 4),
			wedding_date: text(f, 'wedding_date'),
			venue: text(f, 'venue'),
			venue_address: text(f, 'venue_address'),
			ceremony: text(f, 'ceremony'),
			rsvp_deadline: text(f, 'rsvp_deadline'),
			currency: text(f, 'currency') === 'EUR' ? 'EUR' : 'RON',
			eur_rate: money(f, 'eur_rate') || 5,
			budget_total: money(f, 'budget_total'),
			family_contribution: money(f, 'family_contribution'),
			gift_estimate: money(f, 'gift_estimate'),
			attendance_rate: percent(f, 'attendance_rate')
		});
		return { message: 'Setările au fost salvate.' };
	}
};
