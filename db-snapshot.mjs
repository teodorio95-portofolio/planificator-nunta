// Consistent copy of the live SQLite database (safe while the app writes): node db-snapshot.mjs <out>
import { DatabaseSync } from 'node:sqlite';

const out = process.argv[2];
if (!out) throw new Error('usage: node db-snapshot.mjs <output.db>');
new DatabaseSync(process.env.DATABASE_PATH ?? 'data/nunta.db').prepare('VACUUM INTO ?').run(out);
console.log(`snapshot written to ${out}`);
