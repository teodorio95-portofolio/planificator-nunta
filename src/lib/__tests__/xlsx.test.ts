import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { toRecords } from '../csv.ts';
import { readXlsx } from '../server/xlsx.ts';

/** A zip with deflated entries: just enough structure for the reader (no CRCs, which it never checks). */
function zip(files: Record<string, string>): Buffer {
	const locals: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;
	for (const [name, content] of Object.entries(files)) {
		const data = deflateRawSync(Buffer.from(content));
		const n = Buffer.from(name);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(8, 8);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt16LE(n.length, 26);
		const dir = Buffer.alloc(46);
		dir.writeUInt32LE(0x02014b50, 0);
		dir.writeUInt16LE(8, 10);
		dir.writeUInt32LE(data.length, 20);
		dir.writeUInt16LE(n.length, 28);
		dir.writeUInt32LE(offset, 42);
		locals.push(local, n, data);
		central.push(dir, n);
		offset += 30 + n.length + data.length;
	}
	const size = central.reduce((s, b) => s + b.length, 0);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(Object.keys(files).length, 10);
	end.writeUInt32LE(size, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, ...central, end]);
}

const book = (sheet: string, strings: string[]) =>
	zip({
		'xl/workbook.xml': '<workbook><sheets><sheet name="Familii" sheetId="1" r:id="rId1"/></sheets></workbook>',
		'xl/_rels/workbook.xml.rels':
			'<Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
		'xl/sharedStrings.xml': `<sst>${strings.map((s) => `<si>${s}</si>`).join('')}</sst>`,
		'xl/worksheets/sheet1.xml': `<worksheet><sheetData>${sheet}</sheetData></worksheet>`
	});

describe('readXlsx', () => {
	it('reads shared, rich and inline strings, numbers and line breaks', () => {
		const buf = book(
			`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
			 <row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="inlineStr"><is><t>Ana &amp; Ion</t></is></c><c r="C2"><v>2</v></c></row>`,
			['<t>Familii</t>', '<r><t>Invi</t></r><r><t xml:space="preserve">tat</t></r>', '<t>Nr</t>', '<t>Nasi&#10;2</t>']
		);
		expect(readXlsx(buf)).toEqual([
			['Familii', 'Invitat', 'Nr'],
			['Nasi\n2', 'Ana & Ion', '2']
		]);
	});

	it('copies a merged cell to every row it covers and leaves gaps empty', () => {
		const buf = book(
			`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
			 <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>
			 <row r="3"><c r="A3" s="1"/><c r="B3" t="s"><v>4</v></c></row>
			 <row r="5"><c r="B5" t="s"><v>5</v></c></row>
			 </sheetData><mergeCells count="1"><mergeCell ref="A2:A3"/></mergeCells><sheetData>`,
			['<t>Familii</t>', '<t>Invitat</t>', '<t>Fam. Pop</t>', '<t>Ana Pop</t>', '<t>Ion Pop</t>', '<t>Dan</t>']
		);
		expect(toRecords(readXlsx(buf))).toEqual([
			{ familii: 'Fam. Pop', invitat: 'Ana Pop' },
			{ familii: 'Fam. Pop', invitat: 'Ion Pop' },
			{ familii: '', invitat: 'Dan' }
		]);
	});

	it('rejects files that are not zips', () => {
		expect(() => readXlsx(Buffer.from('nume;familie\n'))).toThrow();
	});
});
