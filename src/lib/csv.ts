// Minimal RFC 4180 CSV. Detects `;` (Excel with Romanian locale) or `,` from the header line.

export function parseCsv(text: string): Record<string, string>[] {
	text = text.replace(/^﻿/, '');
	const firstLine = text.slice(0, text.search(/\r?\n|$/));
	const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === delim) {
			row.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || row.length) {
		row.push(field);
		rows.push(row);
	}
	return toRecords(rows);
}

/** Header row → lowercase keys; blank rows are skipped and missing trailing fields read as ''. Shared with the .xlsx import. */
export function toRecords(rows: string[][]): Record<string, string>[] {
	const [header, ...body] = rows.filter((r) => r.some((f) => f.trim() !== ''));
	if (!header) return [];
	const keys = header.map((h) => h.trim().toLowerCase());
	return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

function escape(v: string | number): string {
	const s = String(v);
	return /[;",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon-separated with a BOM, so Excel opens diacritics correctly. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
	return '﻿' + [header, ...rows].map((r) => r.map(escape).join(';')).join('\r\n') + '\r\n';
}
