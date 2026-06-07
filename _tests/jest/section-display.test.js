import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { Section } from '../../Section.js';
import { getSectionNotesDisplayString,
	     getSectionNotesDisplayData,
	     printSectionsNotes
		} from '../../section-printer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function ensureMinimalJqueryStub() {
	if (typeof globalThis.$ === 'function') {
		return;
	}
	globalThis.$ = () => ({
		length: 0,
		find() {
			return { length: 0 };
		},
		attr() {
			return this;
		},
		text() {
			return this;
		},
		append() {
			return this;
		}
	});
}

test('getSectionNotesDisplayString consolidates notes for display', () => {
	const section = new Section();

	const s6 = section.getSectionNotes('tblS6_1');
	s6.namedNotes.C = { colorClass: 'Blue' };
	s6.namedNotes.G = { colorClass: 'Green' };
	s6.playedNotes.push({ midinum: 60 }, { midinum: 64 });
	s6.recordedNotes['1'] = [{ midinum: 60 }, { midinum: 64 }];
	s6.recordedNotes['2'] = [{ midinum: 67 }];

	const p4Played = section.getSectionNotes('tblP4_2');
	p4Played.namedNotes.E = { colorClass: 'Red' };
	p4Played.namedNotes.C = { colorClass: 'Blue' };
	p4Played.playedNotes.push({ midinum: 52 });

	const p4Recorded = section.getSectionNotes('tblP4_1');
	p4Recorded.recordedNotes['1'] = [{}, {}, {}];
	p4Recorded.recordedNotes['2'] = [{}, {}];
	p4Recorded.recordedNotes['3'] = [{}, {}];

	expect(getSectionNotesDisplayData(section)).toEqual({
		namedNotes: ['C', 'E', 'G'],
		playedNotes: ['tblS6_1:2', 'tblP4_2:1'],
		recordedNotes: ['tblS6_1:3', 'tblP4_1:7']
	});

	expect(getSectionNotesDisplayString(section)).toBe([
		'{',
		'    "namedNotes": [',
		'        "C",',
		'        "E",',
		'        "G"',
		'    ],',
		'    "playedNotes": [',
		'        "tblS6_1:2",',
		'        "tblP4_2:1"',
		'    ],',
		'    "recordedNotes": [',
		'        "tblS6_1:3",',
		'        "tblP4_1:7"',
		'    ]',
		'}'
	].join('\n'));
});

test('printSectionsNotes wraps owner-tagged note output without collapsing duplicate view values', () => {
	ensureMinimalJqueryStub();

	const section = new Section({
		caption: 'Owned notes',
		beats: 4,
		rootID: '3',
		sharps: true
	});
	const sectionNotes = section.getSectionNotes('tblP46_1');
	sectionNotes.namedNotes.C = { owner: 'FillPlugin' };
	sectionNotes.namedNotes.G = { colorClass: 'note2' };
	sectionNotes.playedNotes.push(
		{ noteName: 'C', owner: 'FillPlugin' },
		{ noteName: 'C' },
		{ noteName: 'E' }
	);
	sectionNotes.recordedNotes['1'] = [
		{ noteName: 'D', owner: 'ArpeggioPlugin' },
		{ noteName: 'D' }
		];
	sectionNotes.recordedNotes['2'] = [
		{ noteName: 'F', owner: 'FillPlugin' }
		];

	const song = {
		getCurrentSection() {
			return section;
		},
		noteIDToNoteName() {
			return 'C';
		}
	};

	const html = printSectionsNotes(song, [section]);

	expect(html).toContain("<div class='SPN_NN'><span class='SPN_OWNED'>C</span>,G</div>");
	expect(html).toContain("<div class='SPN_PN'><span class='SPN_OWNED'>C</span>,C,E</div>");
	expect(html).toContain("<div class='SPN_RN'><div class='beats'><div class='beat'><span class='beatNum'>1:</span> <span class='SPN_OWNED'>D</span>,D</div><div class='beat'><span class='beatNum'>2:</span> <span class='SPN_OWNED'>F</span></div></div></div>");
	});

test('section-printer css defines the initial SPN_OWNED style', () => {
	const css = fs.readFileSync(path.join(__dirname, '../../section-printer.css'), 'utf8');
	const ownedBlockMatch = css.match(/\.SPN_OWNED\s*\{([^}]*)\}/);

	expect(ownedBlockMatch).not.toBeNull();
	expect(ownedBlockMatch[1]).toContain('color: magenta;');
	expect(ownedBlockMatch[1]).toContain('font-weight: bold;');
});