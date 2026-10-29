import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'node:fs';
import { planImagePath } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	if (!existsSync(planImagePath())) error(404, 'Nu există o imagine a sălii.');
	const bytes = readFileSync(planImagePath());
	// Signature check instead of storing the upload's MIME type.
	const type = bytes[0] === 0x89 ? 'image/png' : bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : 'image/jpeg';
	return new Response(bytes, { headers: { 'content-type': type, 'cache-control': 'no-cache' } });
};
