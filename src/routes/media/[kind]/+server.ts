import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'node:fs';
import { byteRange, isMediaKind, mediaPath, sniff } from '#lib/server/media.ts';
import type { RequestHandler } from './$types';

// Public: the guests' pages show the cover photo and play the music. Ranges, because Safari will
// not play audio from a server that does not answer them.
export const GET: RequestHandler = ({ params, url, request }) => {
	if (!isMediaKind(params.kind) || !existsSync(mediaPath(params.kind))) error(404, 'Fișierul nu există.');
	const bytes = readFileSync(mediaPath(params.kind));
	const headers: Record<string, string> = {
		'content-type': sniff(params.kind, bytes) ?? 'application/octet-stream',
		'accept-ranges': 'bytes',
		// The URLs Setări hands out carry ?v=<mtime>: a new upload is a new URL.
		'cache-control': url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache'
	};
	const range = byteRange(request.headers.get('range'), bytes.length);
	if (!range) return new Response(bytes, { headers: { ...headers, 'content-length': String(bytes.length) } });
	const [start, end] = range;
	return new Response(bytes.subarray(start, end + 1), {
		status: 206,
		headers: {
			...headers,
			'content-range': `bytes ${start}-${end}/${bytes.length}`,
			'content-length': String(end - start + 1)
		}
	});
};
