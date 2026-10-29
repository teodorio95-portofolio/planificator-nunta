// Disks mounted by a host or a platform (a Linux bind mount, Render, Fly) usually belong to root,
// which the app's `node` user cannot write to. Started as root, hand the data directory to `node`
// (uid/gid 1000 in the official image), then drop privileges for good before loading the app.
import { chownSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const NODE_ID = 1000;
const dataDir = dirname(process.env.DATABASE_PATH ?? '/data/nunta.db');

function chownTree(path) {
	chownSync(path, NODE_ID, NODE_ID);
	for (const entry of readdirSync(path, { withFileTypes: true })) {
		const child = join(path, entry.name);
		if (entry.isDirectory()) chownTree(child);
		else chownSync(child, NODE_ID, NODE_ID);
	}
}

if (process.getuid?.() === 0) {
	mkdirSync(dataDir, { recursive: true });
	chownTree(dataDir);
	process.setgid(NODE_ID);
	process.setuid(NODE_ID);
}

await import('./build/index.js');
