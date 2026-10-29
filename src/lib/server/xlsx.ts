// Minimal .xlsx reader: the first sheet as rows of strings, no dependencies.
// Merged cells take the top-left value, so a family merged over its members reads on every row.
import { inflateRawSync } from 'node:zlib';

/** The files of a zip archive (stored or deflated), by name. */
function unzip(buf: Buffer): Map<string, Buffer> {
	// End of central directory: the last 0x06054b50 signature, followed by up to 64 KB of comment.
	let eocd = buf.length - 22;
	while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
	if (eocd < 0) throw new Error('not a zip file');
	const count = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	const files = new Map<string, Buffer>();
	for (let i = 0; i < count; i++) {
		if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('corrupt zip directory');
		const method = buf.readUInt16LE(p + 10);
		const size = buf.readUInt32LE(p + 20);
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		const offset = buf.readUInt32LE(p + 42);
		const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
		// The local header repeats the name with its own extra field length.
		const start = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
		const data = buf.subarray(start, start + size);
		if (method === 0) files.set(name, data);
		else if (method === 8) files.set(name, inflateRawSync(data));
		p += 46 + nameLen + extraLen + commentLen;
	}
	return files;
}

const unescapeXml = (s: string) =>
	s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
		if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
		return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]!;
	});

/** All <t> runs of a string item, so rich text ("bold part" + "rest") reads as one string. */
const text = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** "AB12" → [row 11, column 27], both 0-based. */
function cellRef(ref: string): [number, number] {
	const [, letters, digits] = ref.match(/^([A-Z]+)(\d+)$/)!;
	const col = [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
	return [Number(digits) - 1, col - 1];
}

/** The first worksheet of an .xlsx file, as rows of strings ('' for empty cells). */
export function readXlsx(buf: Buffer): string[][] {
	const files = unzip(buf);
	const read = (name: string) => files.get(name)?.toString('utf8') ?? '';

	// The workbook lists sheets in tab order; its relationships map each to a file.
	const first = read('xl/workbook.xml').match(/<sheet\s[^>]*>/)?.[0] ?? '';
	const rid = attr(first, 'r:id');
	const rel = [...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\s[^>]*>/g)].find((m) => attr(m[0], 'Id') === rid);
	const target = rel ? attr(rel[0], 'Target')!.replace(/^\/?(xl\/)?/, '') : 'worksheets/sheet1.xml';
	const sheet = read(`xl/${target}`);
	if (!sheet) throw new Error('no worksheet found');

	const shared = [...read('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => text(m[1]));

	const rows: string[][] = [];
	const set = (r: number, c: number, v: string) => ((rows[r] ??= [])[c] = v);
	for (const m of sheet.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
		const [r, c] = cellRef(attr(` ${m[1]}`, 'r')!);
		const body = m[2] ?? '';
		const type = attr(` ${m[1]}`, 't');
		const v = body.match(/<v>([^<]*)<\/v>/)?.[1];
		if (type === 's') set(r, c, shared[Number(v)] ?? '');
		else if (type === 'inlineStr') set(r, c, text(body));
		else if (type === 'b') set(r, c, v === '1' ? 'TRUE' : 'FALSE');
		else if (v !== undefined) set(r, c, unescapeXml(v));
	}

	for (const m of sheet.matchAll(/<mergeCell\s+ref="([A-Z]+\d+):([A-Z]+\d+)"/g)) {
		const [r1, c1] = cellRef(m[1]);
		const [r2, c2] = cellRef(m[2]);
		const v = rows[r1]?.[c1] ?? '';
		for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) set(r, c, v);
	}

	// Array.from, not map: a row missing from the sheet is a hole that map would keep.
	const width = Math.max(0, ...Array.from(rows, (r) => r?.length ?? 0));
	return Array.from(rows, (r) => Array.from({ length: width }, (_, i) => r?.[i] ?? ''));
}
