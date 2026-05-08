import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const mockRuntime = {
	song: null
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
	getSong: () => mockRuntime.song
}));

const Constants = await import('../../Constants.js');
const { ArpeggioPlugin } = await import('../../plugins/arpeggio/ArpeggioPlugin.js');

const MANUAL_BACH_FIXTURE = path.resolve(process.cwd(), 'songs/tests/arpeggio-bach-sec2-manual.json');
const DUPLICATE_END_NOTE_FIXTURE = path.resolve(process.cwd(), 'songs/tests/arpeggio-bach-sec2-manual-duplicate-end-note.json');

function makeNamedNotesForRange(rowRange, minFret, maxFret) {
	const namedNotes = {};
	rowRange.forEach((openMidiRaw) => {
		const openMidi = Number.parseInt(openMidiRaw, 10);
		for (let fret = minFret; fret <= maxFret; fret += 1) {
			const noteName = Constants.midinumToNoteName(openMidi + fret);
			namedNotes[noteName] = { enabled: true };
		}
	});
	return namedNotes;
}

function makeNamedNotesFromNames(noteNames) {
	return Object.fromEntries(noteNames.map((noteName) => [noteName, { enabled: true }]));
}

function makeContext({ beats = 6, rowRange = [40, 45], frets = 2, namedNotes = null, rootID = 3 } = {}) {
	const plugin = new ArpeggioPlugin();
	const tuning = {
		baseID: 'ARP',
		frets,
		rowRange
	};
	const tableID = plugin.getTableID(tuning);
	const sectionNotes = {
		namedNotes: namedNotes || makeNamedNotesForRange(rowRange, 0, frets),
		recordedNotes: {}
	};
	const section = {
		beats,
		rootID,
		sectionNotesByTable: {
			[tableID]: sectionNotes
		},
		getSectionNotes: jest.fn(() => sectionNotes),
		getBeats: jest.fn(() => beats)
	};
	const song = {
		myTunings: [tuning],
		wirings: [],
		sections: [section],
		getCurrentSection: jest.fn(() => section)
	};
	mockRuntime.song = song;
	plugin.setPropertyValue('maxFret', frets, { song });
	return { plugin, song, sectionNotes };
}

function getBeatMidinums(sectionNotes, beatCount) {
	return Array.from({ length: beatCount }, (_, idx) => {
		const beatKey = `${idx + 1}`;
		return Number.parseInt(sectionNotes.recordedNotes[beatKey]?.[0]?.midinum, 10);
	});
}

function loadManualBachFixture() {
	return JSON.parse(fs.readFileSync(MANUAL_BACH_FIXTURE, 'utf8'));
}

function loadDuplicateEndNoteFixture() {
	return JSON.parse(fs.readFileSync(DUPLICATE_END_NOTE_FIXTURE, 'utf8'));
}

function extractRecordedSequence(sectionNotes, beatCount, owner = null) {
	return Array.from({ length: beatCount }, (_, idx) => {
		const beatKey = `${idx + 1}`;
		const notesInBeat = sectionNotes.recordedNotes[beatKey] || [];
		const note = owner
			? (notesInBeat.find((candidate) => candidate.owner === owner) || null)
			: (notesInBeat[0] || null);
		return note
			? {
				noteName: note.noteName,
				midinum: Number.parseInt(note.midinum, 10),
				row: Number.parseInt(note.row, 10)
			}
			: null;
	});
}

describe('ArpeggioPlugin sequencing', () => {
	test('style=random excludes duplicate string/fret positions before repeating the cycle', () => {
		const { plugin } = makeContext();
		const duplicateCandidates = [
			{ noteName: 'C', midinum: 36, row: 0, col: 0 },
			{ noteName: 'C', midinum: 36, row: 0, col: 0 },
			{ noteName: 'D', midinum: 38, row: 0, col: 2 },
			{ noteName: 'E', midinum: 40, row: 0, col: 4 }
		];
		const randomSpy = jest.spyOn(plugin, 'getRandomNumber')
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0);

		expect(plugin.expandRandomSequence(duplicateCandidates, 5).map((candidate) => candidate.midinum)).toEqual([
			36, 38, 40, 36, 38
		]);

		randomSpy.mockRestore();
	});

	test('lowToHigh=false traverses upper strings from max fret downward', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 6, rowRange: [40, 45], frets: 2 });
		plugin.setPropertyValue('lowToHigh', false, { song });
		plugin.setPropertyValue('style', 'every', { song });
		plugin.setPropertyValue('upOnly', true, { song });

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=6');
		expect(getBeatMidinums(sectionNotes, 6)).toEqual([42, 41, 40, 47, 46, 45]);
	});

	test('style=random ignores lowToHigh and repeats the chosen random order after exhaustion', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 6, rowRange: [40, 45], frets: 1 });
		plugin.setPropertyValue('style', 'random', { song });
		plugin.setPropertyValue('lowToHigh', false, { song });
		plugin.setPropertyValue('upOnly', false, { song });
		const randomSpy = jest.spyOn(plugin, 'getRandomNumber')
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0);

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=6');
		expect(getBeatMidinums(sectionNotes, 6)).toEqual([45, 41, 46, 40, 45, 41]);
		randomSpy.mockRestore();
	});

	test('style=alternate uses odd positions up, then even positions down', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 8, rowRange: [40, 45], frets: 2 });
		plugin.setPropertyValue('style', 'alternate', { song });
		plugin.setPropertyValue('lowToHigh', true, { song });
		plugin.setPropertyValue('upOnly', false, { song });

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=8');
		expect(getBeatMidinums(sectionNotes, 8)).toEqual([45, 47, 41, 42, 40, 46, 45, 47]);
	});

		test('style=alternate with upOnly=true uses the rolling alternate pattern', () => {
			const { plugin, song, sectionNotes } = makeContext({ beats: 21, rowRange: [40], frets: 6 });
			plugin.setPropertyValue('style', 'alternate', { song });
			plugin.setPropertyValue('lowToHigh', true, { song });
			plugin.setPropertyValue('upOnly', true, { song });

			const result = plugin.applyToSection({ song, clearSectionFirst: true });

			expect(result.result).toContain('generated=21');
			expect(getBeatMidinums(sectionNotes, 21)).toEqual([
				40, 42, 41, 43, 42, 44, 43, 45, 44, 46,
				45, 46, 44, 45, 43, 44, 42, 43, 41, 42, 40
			]);
		});

	test('style=alternate respects lowToHigh=false logical ordering', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 6, rowRange: [40, 45], frets: 2 });
		plugin.setPropertyValue('style', 'alternate', { song });
		plugin.setPropertyValue('lowToHigh', false, { song });
		plugin.setPropertyValue('upOnly', false, { song });

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=6');
		expect(getBeatMidinums(sectionNotes, 6)).toEqual([42, 40, 46, 45, 47, 41]);
	});

	test('style=bach matches the attached manual fixture sequence', () => {
		const fixture = loadManualBachFixture();
		const plugin = new ArpeggioPlugin();
		const song = {
			...fixture,
			getCurrentSection: jest.fn(() => fixture.sections[0])
		};
		const section = fixture.sections[0];
		const tuning = fixture.myTunings[0];
		const tableID = plugin.getTableID(tuning);
		section.getSectionNotes = jest.fn((requestedTableID) => section.sectionNotesByTable[requestedTableID]);
		mockRuntime.song = song;
		plugin.loadSongState(fixture.plugins.arpeggio.properties);

		const result = plugin.applyToSection({ song, clearSectionFirst: true });
		const actualSequence = extractRecordedSequence(section.sectionNotesByTable[tableID], 24);
		const expectedSequence = extractRecordedSequence(fixture.sections[1].sectionNotesByTable[tableID], 24);

		expect(result.result).toContain('generated=24');
		expect(actualSequence).toEqual(expectedSequence);
	});

	test('style=bach does not repeat the actingRoot at the cycle boundary', () => {
		const fixture = loadDuplicateEndNoteFixture();
		const plugin = new ArpeggioPlugin();
		const song = {
			...fixture,
			getCurrentSection: jest.fn(() => fixture.sections[0])
		};
		const section = fixture.sections[0];
		const tuning = fixture.myTunings[0];
		const tableID = plugin.getTableID(tuning);
		section.getSectionNotes = jest.fn((requestedTableID) => section.sectionNotesByTable[requestedTableID]);
		mockRuntime.song = song;
		plugin.loadSongState(fixture.plugins.arpeggio.properties);

		const result = plugin.applyToSection({ song, clearSectionFirst: true });
		const actualSequence = extractRecordedSequence(section.sectionNotesByTable[tableID], 32, 'ArpeggioPlugin');
		const expectedSequence = extractRecordedSequence(fixture.sections[1].sectionNotesByTable[tableID], 32, 'manualExample');

		expect(result.result).toContain('generated=32');
		expect(actualSequence).toEqual(expectedSequence);
		expect(actualSequence[28]).toMatchObject({ noteName: 'C', midinum: 48 });
		expect(actualSequence[29]).toMatchObject({ noteName: 'E', midinum: 52 });
	});

	test('style=bach with lowToHigh=false rotates the same cycle to the second octave hit', () => {
		const { plugin, song } = makeContext({
			beats: 16,
			rowRange: [36],
			frets: 12,
			namedNotes: makeNamedNotesFromNames(['C', 'D', 'E', 'F', 'G', 'A', 'B']),
			rootID: 3
		});
		plugin.setPropertyValue('style', 'bach', { song });
		plugin.setPropertyValue('upOnly', false, { song });

		plugin.setPropertyValue('lowToHigh', true, { song });
		const ascendingCandidates = plugin.collectCandidatesForSection(song.getCurrentSection(), song.myTunings[0], { lowToHigh: true });
		const canonicalCycle = plugin.buildBachCycle(ascendingCandidates, song.getCurrentSection(), song);

		plugin.setPropertyValue('lowToHigh', false, { song });
		const rotatedCycle = plugin.buildBachCycle(ascendingCandidates, song.getCurrentSection(), song);
		const octaveKey = plugin.getCandidatePositionKey(canonicalCycle.find((candidate, idx, cycle) => idx > 0 && candidate.noteName === canonicalCycle[0].noteName && candidate.midinum === canonicalCycle[0].midinum + 12));
		const secondOctaveIndex = canonicalCycle
			.map((candidate, idx) => ({ candidate, idx }))
			.filter(({ candidate }) => plugin.getCandidatePositionKey(candidate) === octaveKey)
			.map(({ idx }) => idx)[1];

		expect(rotatedCycle).toEqual([
			...canonicalCycle.slice(secondOctaveIndex),
			...canonicalCycle.slice(0, secondOctaveIndex)
		]);
	});

	test('bach builds its actingRoot, octave, and terminal note from concrete traversal order', () => {
		const { plugin, song } = makeContext({ rootID: 3 });
		const section = song.getCurrentSection();
		const candidates = [
			{ noteName: 'E', midinum: 40, row: 0, col: 0 },
			{ noteName: 'G', midinum: 43, row: 0, col: 3 },
			{ noteName: 'C', midinum: 48, row: 0, col: 8 },
			{ noteName: 'D', midinum: 50, row: 0, col: 10 },
			{ noteName: 'E', midinum: 52, row: 0, col: 12 },
			{ noteName: 'F', midinum: 53, row: 1, col: 0 },
			{ noteName: 'G', midinum: 55, row: 1, col: 2 },
			{ noteName: 'B', midinum: 59, row: 1, col: 6 },
			{ noteName: 'C', midinum: 60, row: 1, col: 7 },
			{ noteName: 'D', midinum: 62, row: 1, col: 9 }
		];
		const bachContext = plugin.buildBachContext(candidates, section, song);

		expect(bachContext.actingRoot.midinum).toBe(48);
		expect(bachContext.octave.midinum).toBe(60);
		expect(bachContext.belowOctave.midinum).toBe(59);
		expect(bachContext.aboveOctave.midinum).toBe(62);
		expect(bachContext.ascentCandidates.map((candidate) => candidate.midinum)).toEqual([
			48, 50, 52, 53, 55, 59
		]);
	});

	test('bach inserts octave, below-octave, above-octave, then octave again at the top of the up sequence', () => {
		const { plugin, song } = makeContext({ rootID: 3 });
		const section = song.getCurrentSection();
		const candidates = [
			{ noteName: 'C', midinum: 36, row: 0, col: 0 },
			{ noteName: 'D', midinum: 38, row: 0, col: 2 },
			{ noteName: 'E', midinum: 40, row: 0, col: 4 },
			{ noteName: 'F', midinum: 41, row: 0, col: 5 },
			{ noteName: 'G', midinum: 43, row: 0, col: 7 },
			{ noteName: 'A', midinum: 45, row: 0, col: 9 },
			{ noteName: 'B', midinum: 47, row: 0, col: 11 },
			{ noteName: 'C', midinum: 48, row: 0, col: 12 },
			{ noteName: 'D', midinum: 50, row: 1, col: 2 }
		];

		expect(plugin.expandBachSequence(candidates, 15, { section, song }).map((candidate) => candidate.midinum)).toEqual([
			36, 40, 38, 41, 40, 43, 41, 45, 43, 47, 45, 48, 47, 50, 48
		]);
	});
});