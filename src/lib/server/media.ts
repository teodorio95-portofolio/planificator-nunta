// The couple's own files for the guest pages: a cover photo (invitation, save the date, Acasă, link
// previews) and an optional music clip for the envelope. They live next to the database, so a copy of
// the data directory backs them up too. Uploaded from Setări, served publicly under /media/<kind>.
import { existsSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from '#lib/server/db.ts';

export const MEDIA_KINDS = ['cover', 'music'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const isMediaKind = (v: string): v is MediaKind => (MEDIA_KINDS as readonly string[]).includes(v);

/** Upload limits: a phone photo, a minute or two of music. BODY_SIZE_LIMIT must allow them. */
export const MEDIA_MAX_BYTES: Record<MediaKind, number> = { cover: 8 * 1024 * 1024, music: 10 * 1024 * 1024 };

const FILES: Record<MediaKind, string> = { cover: 'coperta.img', music: 'muzica.audio' };

export const mediaPath = (kind: MediaKind) => join(dataDir(), FILES[kind]);

/** The type from the first bytes, or null when it is not one we serve (the upload's own type is not trusted). */
export function sniff(kind: MediaKind, bytes: Uint8Array): string | null {
	const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
	if (kind === 'cover') {
		if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
		if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
		if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
		return null;
	}
	if (ascii(0, 3) === 'ID3' || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
	if (ascii(4, 8) === 'ftyp') return 'audio/mp4';
	return null;
}

/** Its URL with a version, so browsers may cache it for good; null when nothing is uploaded. */
export function mediaUrl(kind: MediaKind): string | null {
	const path = mediaPath(kind);
	if (!existsSync(path)) return null;
	return `/media/${kind}?v=${Math.floor(statSync(path).mtimeMs)}`;
}

export const mediaUrls = () => ({ cover: mediaUrl('cover'), music: mediaUrl('music') });

export function saveMedia(kind: MediaKind, bytes: Uint8Array) {
	writeFileSync(mediaPath(kind), bytes);
}

export function removeMedia(kind: MediaKind) {
	rmSync(mediaPath(kind), { force: true });
}

/** A single `bytes=a-b` range within `size`, or null for none or one we cannot serve. */
export function byteRange(header: string | null, size: number): [number, number] | null {
	const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
	if (!m || (!m[1] && !m[2])) return null;
	const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
	const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
	return start <= end && start < size ? [start, end] : null;
}
