import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { validateSongFileSchema } from './SongFileV2Schema.js';

const mockRuntime = {
	song: null
};

jest.unstable_mockModule('../../infinite-neck.js', () => ({
	getSong: () => mockRuntime.song
}));

jest.unstable_mockModule('../../event-bus.js', () => ({
	default: {
		trigger: jest.fn()
	}
}));

const Constants = await import('../../Constants.js');
const { Note } = await import('../../Note.js');
const { createLookupContext, lookupClassForNote } = await import('../../colorFunctions.js');
const EventBus = (await import('../../event-bus.js')).default;
const { ArpeggioPlugin } = await import('../../plugins/arpeggio/ArpeggioPlugin.js');

const MANUAL_BACH_FIXTURE = path.resolve(process.cwd(), 'songs/tests/arpeggio-bach-sec2-manual.json');
const DUPLICATE_END_NOTE_FIXTURE = path.resolve(process.cwd(), 'songs/tests/arpeggio-bach-sec2-manual-duplicate-end-note.json');
const LOW_TO_HIGH_FALSE_DUPLICATE_FIXTURE = path.resolve(process.cwd(), 'songs/tests/arpeggio-bach-lowToHigh-false-repeats-C.json');

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

function makeContext({ beats = 6, rowRange = [40, 45], frets = 2, namedNotes = null, playedNotes = [], rootID = 3, currentBeat = 1, chartChord = '', chartMode = '' } = {}) {
	const plugin = new ArpeggioPlugin();
	const tuning = {
		baseID: 'ARP',
		frets,
		rowRange
	};
	const tableID = plugin.getTableID(tuning);
	const sectionNotes = {
		namedNotes: namedNotes || makeNamedNotesForRange(rowRange, 0, frets),
		playedNotes,
		recordedNotes: {}
	};
	const section = {
		beats,
		rootID,
		chartChord,
		chartMode,
		currentBeat,
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
		getCurrentSection: jest.fn(() => section),
		getBeat: jest.fn(() => section.currentBeat),
		requestUiShowBeats: jest.fn()
	};
	mockRuntime.song = song;
	plugin.setPropertyValue('maxFret', frets, { song });
	return { plugin, song, section, sectionNotes, tuning };
}

function expectNamedNoteEvent(payload) {
	expect(EventBus.trigger).toHaveBeenCalledWith('NoteTable:ShowNamedNotesAtCells', payload);
}

function expectDiamondRangeEvent(payload) {
	expect(EventBus.trigger).toHaveBeenCalledWith('NoteTable:ShowDiamondPositionRange', payload);
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

function loadLowToHighFalseDuplicateFixture() {
	return JSON.parse(fs.readFileSync(LOW_TO_HIGH_FALSE_DUPLICATE_FIXTURE, 'utf8'));
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
	beforeEach(() => {
		EventBus.trigger.mockClear();
	});

	test('help and summary use user-facing table and fret terminology', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3 });
		plugin.setPropertyValue('showNoteName', 'played', { song });

		const help = plugin.buildHelpMessage(song);

		expect(plugin.buildSummary()).toContain('fret range=0..3');
		expect(plugin.buildSummary()).toContain('upper/lower string limit=1..1');
		expect(plugin.buildSummary()).toContain('type=NamedNote');
		expect(plugin.buildSummary()).toContain('show note names=played');
		expect(help).toContain('target table = tblARP');
		expect(help).toContain('max fret limit = 3');
		expect(help).toContain('upper/lower string limit = 1..1');
		expect(help).toContain('type = NamedNote, SingleNote, AutoChartChord, AutoChartMode, or AutoChartChordMode');
	});

		test('menu includes type before show note name', () => {
		const { plugin } = makeContext({ beats: 4, rowRange: [40, 45, 50, 55, 59, 64], frets: 12 });

		const children = plugin.getVisibleMenuChildren();
		const names = children.map((child) => child.name);
		const positionsNode = children.find((child) => child.name === 'positions');
		const stringsNode = children.find((child) => child.name === 'strings');

		expect(names).toEqual([
			'targetTable',
			'apply',
			'clear',
			'positions',
			'strings',
			'lowToHigh',
			'upOnly',
			'style',
			'type',
			'showNoteName',
			'colorNotes',
			'flashcard',
			'help'
		]);
		expect(positionsNode.children.map((child) => child.name)).toEqual([
			'minFret',
			'maxFret',
			'positions:clearAllSections',
			'positions:clearCurrentSection',
			'positions:copyToAllSections',
			'positions:copyToUnsetSections',
			'positions:refreshCurrentSection',
			'positions:setCurrentSection',
			'songLoopsPerPositionPair'
		]);
		expect(stringsNode.children.map((child) => child.name)).toEqual([
			'minRow',
			'maxRow'
		]);
	});

	test('type defaults to NamedNote', () => {
		const { plugin } = makeContext({ beats: 4, rowRange: [40], frets: 3 });

		expect(plugin.getProperty('type').getValue()).toBe('NamedNote');
		expect(plugin.getSourceType()).toBe('NamedNote');
	});

	test('string limits display as 1-based values while persisting zero-based rows', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40, 45, 50, 55, 59, 64], frets: 12 });

		expect(plugin.resolveValue('minRow', { song })).toBe(1);
		expect(plugin.resolveValue('maxRow', { song })).toBe(6);

		plugin.setPropertyValue('minRow', 2, { song });
		plugin.setPropertyValue('maxRow', 5, { song });

		expect(plugin.getProperty('minRow').getValue()).toBe(1);
		expect(plugin.getProperty('maxRow').getValue()).toBe(4);
		expect(plugin.resolveValue('minRow', { song })).toBe(2);
		expect(plugin.resolveValue('maxRow', { song })).toBe(5);
	});

	test('switching target instrument resets string limits to the new instrument full range', () => {
		const plugin = new ArpeggioPlugin();
		const pianoTuning = {
			baseID: 'P1',
			frets: 12,
			rowRange: [48]
		};
		const guitarTuning = {
			baseID: 'P46_1',
			frets: 12,
			rowRange: [40, 45, 50, 55, 59, 64]
		};
		const section = {
			beats: 4,
			rootID: 3,
			currentBeat: 1,
			sectionNotesByTable: {},
			getSectionNotes: jest.fn(() => ({ namedNotes: {}, playedNotes: [], recordedNotes: {} })),
			getBeats: jest.fn(() => 4)
		};
		const song = {
			myTunings: [pianoTuning, guitarTuning],
			wirings: [],
			sections: [section],
			getCurrentSection: jest.fn(() => section),
			getBeat: jest.fn(() => 1),
			requestUiShowBeats: jest.fn()
		};
		const pianoTableID = plugin.getTableID(pianoTuning);
		const guitarTableID = plugin.getTableID(guitarTuning);

		mockRuntime.song = song;
		plugin.setManager({ song });

		plugin.setPropertyValue('targetTable', guitarTableID, { song });
		plugin.setPropertyValue('minRow', 2, { song });
		plugin.setPropertyValue('maxRow', 3, { song });
		expect(plugin.resolveValue('minRow', { song })).toBe(2);
		expect(plugin.resolveValue('maxRow', { song })).toBe(3);

		plugin.setPropertyValue('targetTable', pianoTableID, { song });
		expect(plugin.resolveValue('minRow', { song })).toBe(1);
		expect(plugin.resolveValue('maxRow', { song })).toBe(1);

		plugin.setPropertyValue('targetTable', guitarTableID, { song });

		expect(plugin.getProperty('minRow').getValue()).toBe(0);
		expect(plugin.getProperty('maxRow').getValue()).toBe(5);
		expect(plugin.resolveValue('minRow', { song })).toBe(1);
		expect(plugin.resolveValue('maxRow', { song })).toBe(6);
	});

	test('loadSongState preserves persisted zero-based string limits', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40, 45, 50, 55, 59, 64], frets: 12 });

		plugin.loadSongState({ minRow: 1, maxRow: 4 }, { song });

		expect(plugin.getProperty('minRow').getValue()).toBe(1);
		expect(plugin.getProperty('maxRow').getValue()).toBe(4);
		expect(plugin.resolveValue('minRow', { song })).toBe(2);
		expect(plugin.resolveValue('maxRow', { song })).toBe(5);
	});

	test('registers reset event alongside section-begin and beat display events', () => {
		const plugin = new ArpeggioPlugin();

		expect(plugin.getEventNames()).toEqual(['DaCapo:OnSectionBegin', 'DaCapo:OnSongEnd', 'SongUiShowBeats', 'Looper:OnResetSong']);
	});

	test('song loops per position pair defaults to 1 and rejects values below 1', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 6 });

		expect(plugin.getProperty('songLoopsPerPositionPair').getValue()).toBe(1);
		plugin.setPropertyValue('songLoopsPerPositionPair', 3, { song });
		expect(plugin.getProperty('songLoopsPerPositionPair').getValue()).toBe(3);
		EventBus.trigger.mockClear();
		plugin.setPropertyValue('songLoopsPerPositionPair', 0, { song });
		expect(plugin.getProperty('songLoopsPerPositionPair').getValue()).toBe(1);
		expect(EventBus.trigger).toHaveBeenCalledWith('UserLog', {
			subSystem: 'ArpeggioPlugin',
			message: 'songLoopsPerPositionPair must be greater than or equal to 1'
		});
	});

	test('result strings use user-facing skip terminology', () => {
		const plugin = new ArpeggioPlugin();

		expect(plugin.clearGeneratedNotesInSong(null).result).toBe('Arpeggio clear skipped: no song loaded');
		expect(plugin.applyToSection({ song: null }).result).toBe('Arpeggio skipped: no song loaded');
	});

	test('style=random excludes duplicate string/fret positions and reshuffles on cycle exhaustion', () => {
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
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.0);

		expect(plugin.expandRandomSequence(duplicateCandidates, 5).map((candidate) => candidate.midinum)).toEqual([
			36, 38, 40, 40, 36
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

	test('string limits restrict candidate rows inclusively', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 4, rowRange: [40, 45, 50], frets: 1 });
		plugin.setPropertyValue('minRow', 2, { song });
		plugin.setPropertyValue('maxRow', 3, { song });
		plugin.setPropertyValue('style', 'every', { song });
		plugin.setPropertyValue('lowToHigh', true, { song });
		plugin.setPropertyValue('upOnly', true, { song });

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=4');
		expect(getBeatMidinums(sectionNotes, 4)).toEqual([50, 51, 45, 46]);
	});

	test('style=random ignores lowToHigh and reshuffles after exhausting one cycle', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 6, rowRange: [40, 45], frets: 1 });
		plugin.setPropertyValue('style', 'random', { song });
		plugin.setPropertyValue('lowToHigh', false, { song });
		plugin.setPropertyValue('upOnly', false, { song });
		const randomSpy = jest.spyOn(plugin, 'getRandomNumber')
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.75)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0);

		const result = plugin.applyToSection({ song, clearSectionFirst: true });

		expect(result.result).toContain('generated=6');
		expect(getBeatMidinums(sectionNotes, 6)).toEqual([45, 41, 46, 40, 41, 45]);
		expect(randomSpy).toHaveBeenCalledTimes(8);
		randomSpy.mockRestore();
	});

	test('flashcard one-mode with random reveals the exact previous highlighted cell', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('style', 'random', { song });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPropertyValue('flashcard', true, { song });
		const randomSpy = jest.spyOn(plugin, 'getRandomNumber')
			.mockReturnValueOnce(0.75)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0);

		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(2);
		song.getCurrentSection().currentBeat = 2;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '3', colorClass: 'noteTransparent' }]
		});
		// One random shuffle for the section sequence; display refresh must reuse it.
		expect(randomSpy).toHaveBeenCalledTimes(4);
		randomSpy.mockRestore();
	});

	test('DaCapo section-begin reuse paths keep the existing random sequence and notes', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 6, rowRange: [40, 45], frets: 1, currentBeat: 4 });
		plugin.setPropertyValue('style', 'random', { song });
		const randomSpy = jest.spyOn(plugin, 'getRandomNumber')
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.9)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.75)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0)
			.mockReturnValueOnce(0.0);

		plugin.handleEvent('DaCapo:OnSectionBegin', { regenerateRandomSequence: true }, { song });
		const beforeRestartSection = JSON.parse(JSON.stringify(sectionNotes.recordedNotes));
		const randomCallsAfterGenerate = randomSpy.mock.calls.length;

		plugin.handleEvent('DaCapo:OnSectionBegin', {
			transportAction: 'RestartSection',
			reuseRandomSequence: true
		}, { song });
		expect(sectionNotes.recordedNotes).toEqual(beforeRestartSection);
		expect(randomSpy.mock.calls.length).toBe(randomCallsAfterGenerate);

		plugin.handleEvent('DaCapo:OnSectionBegin', {
			transportAction: 'LoopBeatsWrap',
			reuseRandomSequence: true
		}, { song });
		expect(sectionNotes.recordedNotes).toEqual(beforeRestartSection);
		expect(randomSpy.mock.calls.length).toBe(randomCallsAfterGenerate);

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

	test('applyToSection requests a current-beat highlight refresh for the visible section', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3 });

		plugin.applyToSection({ song, clearSectionFirst: true });

		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
	});

	test('applyToSection requests named-note display for the current beat cell', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 2 });
		plugin.setPropertyValue('showNoteName', 'one', { song });

		plugin.applyToSection({ song, clearSectionFirst: true });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '1', colorClass: 'noteTransparent' }]
		});
	});

	test('colorNotes=true uses the AutoColor class instead of noteTransparent', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 2 });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPropertyValue('colorNotes', true, { song });

		plugin.applyToSection({ song, clearSectionFirst: true });

		const expectedColorClass = lookupClassForNote({
			noteName: 'F',
			styleNum: 0,
			midinum: '41',
			row: '0'
		}, createLookupContext({ section: song.getCurrentSection(), autoColor: true }))?.colorClass;

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '1', colorClass: expectedColorClass }]
		});
		expect(expectedColorClass).toBeTruthy();
		expect(expectedColorClass).not.toBe('noteTransparent');
	});

	test('SongUiShowBeats advances one-mode named-note display to the current beat', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(3);
		song.getCurrentSection().currentBeat = 3;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' }]
		});
	});

	test('flashcard one-mode hides note-name display on the first beat', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPropertyValue('flashcard', true, { song });

		plugin.applyToSection({ song, clearSectionFirst: true });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: []
		});
	});

	test('flashcard one-mode reveals the previous beat on SongUiShowBeats', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPropertyValue('flashcard', true, { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(3);
		song.getCurrentSection().currentBeat = 3;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '1', colorClass: 'noteTransparent' }]
		});
	});

	test('flashcard one-mode reveals previous and current notes on the last beat', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPropertyValue('flashcard', true, { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(4);
		song.getCurrentSection().currentBeat = 4;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [
				{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '3', colorClass: 'noteTransparent' }
			]
		});
	});

	test('applyToSection shows all generated note names when showNoteName=all', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 2 });
		plugin.setPropertyValue('showNoteName', 'all', { song });

		plugin.applyToSection({ song, clearSectionFirst: true });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [
				{ tableID: 'tblARP', cellrow: '0', cellcol: '0', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '1', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '3', colorClass: 'noteTransparent' }
			]
		});
	});

	test('SongUiShowBeats accumulates current-beat note names when showNoteName=played', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'played', { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(3);
		song.getCurrentSection().currentBeat = 3;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: false,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' }]
		});
	});

	test('flashcard all-mode reveals all notes starting on beat two', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'all', { song });
		plugin.setPropertyValue('flashcard', true, { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(2);
		song.getCurrentSection().currentBeat = 2;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [
				{ tableID: 'tblARP', cellrow: '0', cellcol: '0', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '1', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '3', colorClass: 'noteTransparent' }
			]
		});
	});

	test('flashcard played-mode accumulates previous beats and reveals the last beat note', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3, currentBeat: 1 });
		plugin.setPropertyValue('showNoteName', 'played', { song });
		plugin.setPropertyValue('flashcard', true, { song });
		plugin.applyToSection({ song, clearSectionFirst: true });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		song.getBeat.mockReturnValue(4);
		song.getCurrentSection().currentBeat = 4;
		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: false,
			cells: [
				{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' },
				{ tableID: 'tblARP', cellrow: '0', cellcol: '3', colorClass: 'noteTransparent' }
			]
		});
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
		const rotatedTail = canonicalCycle.slice(secondOctaveIndex);
		const rotatedHead = canonicalCycle.slice(0, secondOctaveIndex);
		const expectedRotatedCycle = plugin.getCandidatePositionKey(rotatedTail[rotatedTail.length - 1]) === plugin.getCandidatePositionKey(rotatedHead[0])
			? [...rotatedTail, ...rotatedHead.slice(1)]
			: [...rotatedTail, ...rotatedHead];

		expect(rotatedCycle).toEqual(expectedRotatedCycle);
	});

	test('type=SingleNote derives candidate note names only from STYLENUM_SINGLE notes on the selected table', () => {
		const { plugin, song } = makeContext({
			beats: 4,
			rowRange: [48],
			frets: 2,
			namedNotes: {},
			playedNotes: [
				{ noteName: 'C', styleNum: Note.STYLENUM_SINGLE },
				{ noteName: 'C', styleNum: Note.STYLENUM_SINGLE },
				{ noteName: 'D', styleNum: Note.STYLENUM_SINGLE },
				{ noteName: 'E', styleNum: Note.STYLENUM_TINY },
				{ noteName: 'F', styleNum: Note.STYLENUM_BEND },
				{ noteName: 'G', styleNum: Note.STYLENUM_FINGERING },
				{ noteName: '', styleNum: Note.STYLENUM_SINGLE }
			]
		});
		plugin.setPropertyValue('type', 'SingleNote', { song });

		const candidateNames = Array.from(plugin.collectCandidateNoteNames(song.getCurrentSection().getSectionNotes('tblARP'))).sort();
		const candidates = plugin.collectCandidatesForSection(song.getCurrentSection(), song.myTunings[0], { lowToHigh: true });

		expect(candidateNames).toEqual(['C', 'D']);
		expect([...new Set(candidates.map((candidate) => candidate.noteName))]).toEqual(['C', 'D']);
	});

	test('type=NamedNote preserves current candidate collection even when SingleNotes exist', () => {
		const { plugin, song } = makeContext({
			beats: 4,
			rowRange: [53],
			frets: 2,
			namedNotes: makeNamedNotesFromNames(['F', 'G']),
			playedNotes: [
				{ noteName: 'C', styleNum: Note.STYLENUM_SINGLE },
				{ noteName: 'D', styleNum: Note.STYLENUM_SINGLE }
			]
		});

		const candidateNames = Array.from(plugin.collectCandidateNoteNames(song.getCurrentSection().getSectionNotes('tblARP'))).sort();
		const candidates = plugin.collectCandidatesForSection(song.getCurrentSection(), song.myTunings[0], { lowToHigh: true });

		expect(candidateNames).toEqual(['F', 'G']);
		expect([...new Set(candidates.map((candidate) => candidate.noteName))]).toEqual(['F', 'G']);
	});

	test('type property persists through export and load song state', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 3 });
		plugin.setPropertyValue('type', 'AutoChartMode', { song });

		const exported = plugin.exportSongState();
		plugin.loadSongState({ type: 'NamedNote' }, { song });
		plugin.loadSongState(exported, { song });

		expect(exported.type).toBe('AutoChartMode');
		expect(plugin.getProperty('type').getValue()).toBe('AutoChartMode');
	});

	test('type=AutoChartChord derives candidate note names from chartChord and transposed section root', () => {
		const { plugin, song, section } = makeContext({
			beats: 4,
			rowRange: [48],
			frets: 12,
			namedNotes: {},
			playedNotes: [],
			rootID: 2,
			chartChord: 'Gbmaj7'
		});
		plugin.setPropertyValue('type', 'AutoChartChord', { song });

		const candidateNames = Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section)).sort();

		expect(candidateNames).toEqual(['B', 'Bb', 'Eb', 'Gb']);
	});

	test('type=AutoChartMode derives candidate note names from chartMode and transposed section root', () => {
		const { plugin, song, section } = makeContext({
			beats: 4,
			rowRange: [48],
			frets: 12,
			namedNotes: {},
			playedNotes: [],
			rootID: 2,
			chartMode: 'Gb harmonic minor'
		});
		plugin.setPropertyValue('type', 'AutoChartMode', { song });

		const candidateNames = Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section)).sort();

		expect(candidateNames).toEqual(['B', 'Bb', 'D', 'Db', 'E', 'G', 'Gb']);
	});

	test('type=AutoChartChordMode unions chord and mode candidate note names', () => {
		const { plugin, song, section } = makeContext({
			beats: 4,
			rowRange: [48],
			frets: 12,
			namedNotes: {},
			playedNotes: [],
			rootID: 2,
			chartChord: 'Gbmaj7',
			chartMode: 'Gb harmonic minor'
		});
		plugin.setPropertyValue('type', 'AutoChartChordMode', { song });

		const candidateNames = Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section)).sort();

		expect(candidateNames).toEqual(['B', 'Bb', 'D', 'Db', 'E', 'Eb', 'G', 'Gb']);
	});

	test('auto chart source types treat empty, none, and percent as unresolved', () => {
		const { plugin, song, section } = makeContext({
			beats: 4,
			rowRange: [48],
			frets: 12,
			namedNotes: {},
			playedNotes: [],
			rootID: 5
		});

		plugin.setPropertyValue('type', 'AutoChartChord', { song });
		section.chartChord = '';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);
		section.chartChord = 'none';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);
		section.chartChord = '%';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);

		plugin.setPropertyValue('type', 'AutoChartMode', { song });
		section.chartMode = '';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);
		section.chartMode = 'none';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);
		section.chartMode = '%';
		expect(Array.from(plugin.collectCandidateNoteNames(section.getSectionNotes('tblARP'), section))).toEqual([]);
	});

	test('style=bach with lowToHigh=false does not repeat the rotated seam note', () => {
		const fixture = loadLowToHighFalseDuplicateFixture();
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

		expect(result.result).toContain('generated=32');
		expect(actualSequence.slice(14, 18)).toEqual([
			{ noteName: 'C', midinum: 48, row: 4 },
			{ noteName: 'E', midinum: 52, row: 3 },
			{ noteName: 'D', midinum: 50, row: 4 },
			{ noteName: 'F', midinum: 53, row: 3 }
		]);
		expect(actualSequence[14]).not.toEqual(actualSequence[15]);
	});

	test('clearGeneratedNotesInSong requests a current-beat highlight refresh when it clears the visible section', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 4, rowRange: [40], frets: 3 });
		plugin.applyToSection({ song, clearSectionFirst: true });
		song.requestUiShowBeats.mockClear();
		expect(Object.keys(sectionNotes.recordedNotes).length).toBeGreaterThan(0);

		const result = plugin.clearGeneratedNotesInSong(song);

		expect(result.result).toContain('removed');
		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(sectionNotes.recordedNotes).toEqual({});
	});

	test('Looper:OnResetSong clears generated notes in song', () => {
		const { plugin, song, sectionNotes } = makeContext({ beats: 4, rowRange: [40], frets: 3 });
		plugin.applyToSection({ song, clearSectionFirst: true });
		song.requestUiShowBeats.mockClear();

		const result = plugin.handleEvent('Looper:OnResetSong', { hard: false }, { song });

		expect(result.result).toContain('removed');
		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(sectionNotes.recordedNotes).toEqual({});
	});

	test('top-level clear resets all section indexes and refreshes current section status', () => {
		const { plugin, song, section, sectionNotes } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		const secondSectionNotes = {
			namedNotes: makeNamedNotesForRange([40], 0, 6),
			playedNotes: [],
			recordedNotes: {}
		};
		const secondSection = {
			beats: 4,
			rootID: 3,
			currentBeat: 1,
			sectionNotesByTable: {
				tblARP: secondSectionNotes
			},
			getSectionNotes: jest.fn(() => secondSectionNotes),
			getBeats: jest.fn(() => 4)
		};
		song.sections = [section, secondSection];
		plugin.setSectionPositions(section, [[0, 3], [3, 5]]);
		plugin.setSectionPositions(secondSection, [[3, 5], [5, 7]]);
		plugin.setLastPositionIndex(section, 1);
		plugin.setLastPositionIndex(secondSection, 1);
		plugin.applyToSection({ song, clearSectionFirst: true });
		song.requestUiShowBeats.mockClear();
		EventBus.trigger.mockClear();

		const result = plugin.invokeAction('clear', { song });

		expect(result.result).toContain('removed');
		expect(result.result).toContain('reset 2 position counters');
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(0);
		expect(secondSection.pluginData.arpeggio.lastPositionIndex).toBe(-1);
		expect(sectionNotes.recordedNotes).toEqual({});
		expect(song.requestUiShowBeats).toHaveBeenCalledTimes(1);
		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('<span class="arpeggioPositionsStatus"><table><tr><td class="arpeggioStringRange"><span class="arpeggioLowerString">1</span>:<span class="arpeggioUpperString">1</span></td><td class="arpeggioCurrentPositionPair">0</td><td class="arpeggioCurrentPositionPair">3</td><td>3</td><td>5</td></tr></table></span>');
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
	});

	test('positions semicolon shorthand normalizes and resets current-section index to zero', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 12 });

		const result = plugin.setPositionsForCurrentSection(song, '0,3;2,5;6');

		expect(result.result).toBe('positions=[[0,3],[2,5],[6,10]]');
		expect(section.pluginData.arpeggio.positions).toEqual([[0, 3], [2, 5], [6, 10]]);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(-1);
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
	});

	test('clear current-section positions refreshes status for the visible section', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setPositionsForCurrentSection(song, '0,2;3,5');
		EventBus.trigger.mockClear();

		const result = plugin.clearPositionsForCurrentSection(song);

		expect(result.result).toBe('positions cleared for current section');
		expect(plugin.getSectionPositions(section)).toBeNull();
		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('');
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
	});

	test('copying positions resets target indexes and refreshes the current section index', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 8 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		const secondSectionNotes = {
			namedNotes: makeNamedNotesForRange([40], 0, 8),
			playedNotes: [],
			recordedNotes: {}
		};
		const secondSection = {
			beats: 4,
			rootID: 3,
			currentBeat: 1,
			sectionNotesByTable: {
				tblARP: secondSectionNotes
			},
			getSectionNotes: jest.fn(() => secondSectionNotes),
			getBeats: jest.fn(() => 4)
		};
		song.sections = [section, secondSection];
		plugin.setPositionsForCurrentSection(song, '0,3;3,5;5,8');
		plugin.setLastPositionIndex(section, 1);
		plugin.setLastPositionIndex(secondSection, 2);
		EventBus.trigger.mockClear();

		const result = plugin.copyPositionsToSections(song, { onlyUnset: false });

		expect(result.result).toBe('positions copied to 1 sections');
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(0);
		expect(secondSection.pluginData.arpeggio.positions).toEqual([[0, 3], [3, 5], [5, 8]]);
		expect(secondSection.pluginData.arpeggio.lastPositionIndex).toBe(-1);
		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('<span class="arpeggioPositionsStatus"><table><tr><td class="arpeggioStringRange"><span class="arpeggioLowerString">1</span>:<span class="arpeggioUpperString">1</span></td><td class="arpeggioCurrentPositionPair">0</td><td class="arpeggioCurrentPositionPair">3</td><td>3</td><td>5</td><td>5</td><td>8</td></tr></table></span>');
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
	});

	test('positions boundary shorthand normalizes to adjacent ranges', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 12 });

		plugin.setPositionsForCurrentSection(song, '0,3,5,9');

		expect(section.pluginData.arpeggio.positions).toEqual([[0, 3], [3, 5], [5, 9]]);
	});

	test('positions odd-count boundary shorthand normalizes to adjacent ranges', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 12 });

		const result = plugin.setPositionsForCurrentSection(song, '0,3,5');

		expect(result.result).toBe('positions=[[0,3],[3,5]]');
		expect(section.pluginData.arpeggio.positions).toEqual([[0, 3], [3, 5]]);
	});

	test('positions reject out-of-range values and preserve the prior section value', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 5 });
		plugin.setPositionsForCurrentSection(song, '0,3;4,5');

		const result = plugin.setPositionsForCurrentSection(song, '0,6');

		expect(result.result).toBe('positions rejected');
		expect(result.message).toContain('Attempted: 0,6');
		expect(section.pluginData.arpeggio.positions).toEqual([[0, 3], [4, 5]]);
	});

	test('DaCapo section-begin uses current song-loop position while DaCapo song-end advances and wraps', () => {
		const { plugin, song, section } = makeContext({ beats: 2, rowRange: [40], frets: 4 });
		plugin.setSectionPositions(section, [[0, 0], [2, 2]]);

		plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });
		let beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
		expect(Number.parseInt(beatOne.col, 10)).toBe(0);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(0);

		plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
		plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });
		beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
		expect(Number.parseInt(beatOne.col, 10)).toBe(2);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(1);

		plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
		plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });
		beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
		expect(Number.parseInt(beatOne.col, 10)).toBe(0);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(0);
	});

	test('manual apply uses the current song-loop position and does not advance it', () => {
		const { plugin, song, section } = makeContext({ beats: 2, rowRange: [40], frets: 4 });
		plugin.setPositionsForCurrentSection(song, '0,0;2,2');
		plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });

		plugin.invokeAction('apply', { song });

		const beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
		expect(Number.parseInt(beatOne.col, 10)).toBe(2);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(1);
		plugin.invokeAction('apply', { song });
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(1);
	});

	test('SongUiShowBeats uses current song-loop position without advancing it', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 4, currentBeat: 1 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setPropertyValue('showNoteName', 'one', { song });
		plugin.setPositionsForCurrentSection(song, '0,0;2,2');
		plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
		plugin.skipNextSongUiShowBeats = false;
		EventBus.trigger.mockClear();

		plugin.handleEvent('SongUiShowBeats', {}, { song });

		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(1);
		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: [{ tableID: 'tblARP', cellrow: '0', cellcol: '2', colorClass: 'noteTransparent' }]
		});
		expectDiamondRangeEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			tableID: 'tblARP',
			minFret: 2,
			maxFret: 2
		});
	});

	test('loadSongState resets persisted section position indexes to not-played-yet', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		section.pluginData = {
			arpeggio: {
				positions: [[0, 2], [3, 5]],
				lastPositionIndex: 7
			}
		};

		plugin.loadSongState({}, { song });

		expect(section.pluginData.arpeggio.positions).toEqual([[0, 2], [3, 5]]);
		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(-1);
	});

	test('Looper:OnResetSong resets section position indexes to not-played-yet', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setPositionsForCurrentSection(song, '0,2;3,5');
		plugin.setLastPositionIndex(section, 1);

		plugin.handleEvent('Looper:OnResetSong', { hard: false }, { song });

		expect(section.pluginData.arpeggio.lastPositionIndex).toBe(-1);
		expect(plugin.songLoopCountForPositionPair).toBe(0);
	});

	test('song loops per position pair delays pair advance until loop threshold', () => {
		const { plugin, song, section } = makeContext({ beats: 2, rowRange: [40], frets: 4 });
		plugin.setPropertyValue('songLoopsPerPositionPair', 3, { song });
		plugin.setSectionPositions(section, [[0, 0], [2, 2]]);

		for (let loopIdx = 0; loopIdx < 2; loopIdx += 1) {
			plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
			plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });
			const beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
			expect(Number.parseInt(beatOne.col, 10)).toBe(0);
		}

		plugin.handleEvent('DaCapo:OnSongEnd', {}, { song });
		plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });
		const beatOne = section.sectionNotesByTable.tblARP.recordedNotes['1'][0];
		expect(Number.parseInt(beatOne.col, 10)).toBe(2);
	});

	test('arpeggioPositionsStatus highlights the first pair when reset leaves positions not-played-yet', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setSectionPositions(section, [[0, 2], [3, 5]]);
		plugin.setLastPositionIndex(section, -1);

		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('<span class="arpeggioPositionsStatus"><table><tr><td class="arpeggioStringRange"><span class="arpeggioLowerString">1</span>:<span class="arpeggioUpperString">1</span></td><td class="arpeggioCurrentPositionPair">0</td><td class="arpeggioCurrentPositionPair">2</td><td>3</td><td>5</td></tr></table></span>');
	});

	test('positions current-section display resolves to canonical JSON or unset', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 6 });

		expect(plugin.resolveValue('positionsCurrentSection', { song })).toBe('[]');
		plugin.setPositionsForCurrentSection(song, '0,2;3,5');
		expect(plugin.resolveValue('positionsCurrentSection', { song })).toBe('[[0,2],[3,5]]');
	});

	test('arpeggioPositionsStatus shows the current-section pairs and highlights the active pair', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setSectionPositions(section, [[0, 2], [3, 5]]);
		plugin.setLastPositionIndex(section, 1);

		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('<span class="arpeggioPositionsStatus"><table><tr><td class="arpeggioStringRange"><span class="arpeggioLowerString">1</span>:<span class="arpeggioUpperString">1</span></td><td>0</td><td>2</td><td class="arpeggioCurrentPositionPair">3</td><td class="arpeggioCurrentPositionPair">5</td></tr></table></span>');
	});

	test('DaCapo section-begin requests a section-status refresh after advancing the position index', () => {
		const { plugin, song, section } = makeContext({ beats: 2, rowRange: [40], frets: 4 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setSectionPositions(section, [[0, 0], [2, 2]]);
		EventBus.trigger.mockClear();

		plugin.handleEvent('DaCapo:OnSectionBegin', {}, { song });

		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
		expectDiamondRangeEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			tableID: 'tblARP',
			minFret: 0,
			maxFret: 0
		});
		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('<span class="arpeggioPositionsStatus"><table><tr><td class="arpeggioStringRange"><span class="arpeggioLowerString">1</span>:<span class="arpeggioUpperString">1</span></td><td class="arpeggioCurrentPositionPair">0</td><td class="arpeggioCurrentPositionPair">0</td><td>2</td><td>2</td></tr></table></span>');
	});

	test('disable clears any transient diamond-position highlight', () => {
		const { plugin } = makeContext({ beats: 4, rowRange: [40], frets: 6 });

		plugin.disable();

		expectDiamondRangeEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			tableID: '',
			minFret: null,
			maxFret: null
		});
	});

	test('enable requests immediate section-status refresh for the current section', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: true })
		});
		plugin.setSectionPositions(section, [[0, 2], [3, 5]]);
		plugin.setLastPositionIndex(section, -1);
		EventBus.trigger.mockClear();

		const result = plugin.enable({ song });

		expect(result).toBe('Arpeggio enabled');
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
		expectDiamondRangeEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			tableID: 'tblARP',
			minFret: 0,
			maxFret: 2
		});
	});

	test('disable requests immediate section-status refresh and clears transient displays', () => {
		const { plugin, song } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: false })
		});
		EventBus.trigger.mockClear();

		const result = plugin.disable({ song });

		expect(result).toBe('Arpeggio disabled');
		expectNamedNoteEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			cells: []
		});
		expectDiamondRangeEvent({
			owner: 'ArpeggioPlugin',
			clearExisting: true,
			tableID: '',
			minFret: null,
			maxFret: null
		});
		expect(EventBus.trigger).toHaveBeenCalledWith('UpdateSectionStatus', { sectionIndex: undefined });
	});

	test('arpeggioPositionsStatus is empty when Arpeggio is not enabled', () => {
		const { plugin, song, section } = makeContext({ beats: 4, rowRange: [40], frets: 6 });
		plugin.setManager({
			song,
			getPluginEntry: () => ({ enabled: false })
		});
		plugin.setSectionPositions(section, [[0, 2], [3, 5]]);

		expect(plugin.getApprovedCaptionValue('arpeggioPositionsStatus', { song, section })).toBe('');
	});

	test('song file schema accepts optional section.pluginData.arpeggio positions data', () => {
		const songJson = {
			myTunings: [{
				baseID: 'ARP',
				baseInstrument: 'guitar',
				caption: 'ARP',
				nStrings: 1,
				rowRange: [40],
				frets: 12,
				nut: true,
				reverse: false,
				visible: true
			}],
			rootID: 3,
			sections: [{
				sectionNotesByTable: {},
				pluginData: {
					arpeggio: {
						positions: [[0, 3], [4, 7]],
						lastPositionIndex: 0
					}
				},
				beats: 4,
				currentBeat: 1,
				rootID: 3,
				sharps: false
			}],
			songName: 'positions schema',
			songfileVersion: 'V2'
		};

		expect(validateSongFileSchema(songJson)).toEqual({ valid: true, errors: [] });
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