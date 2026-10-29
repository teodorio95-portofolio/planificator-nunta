import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { db, todayStamp } from '#lib/server/db.ts';
import type { RequestHandler } from './$types';

// VACUUM INTO gives a consistent snapshot even while the app keeps writing (WAL mode).
export const GET: RequestHandler = () => {
	const file = join(tmpdir(), `nunta-backup-${process.pid}-${Date.now()}.db`);
	db().prepare('VACUUM INTO ?').run(file);
	try {
		return new Response(readFileSync(file), {
			headers: {
				'content-type': 'application/vnd.sqlite3',
				'content-disposition': `attachment; filename="nunta-${todayStamp()}.db"`
			}
		});
	} finally {
		rmSync(file, { force: true });
	}
};
