import { Section } from '../../Section.js';

test('getSectionNotesDisplayString consolidates V2 notes for display', () => {
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

	expect(section.getSectionNotesDisplayData()).toEqual({
		namedNotes: ['C', 'E', 'G'],
		playedNotes: ['tblS6_1:2', 'tblP4_2:1'],
		recordedNotes: ['tblS6_1:3', 'tblP4_1:7']
	});

	expect(section.getSectionNotesDisplayString()).toBe([
		'{',
		'    namedNotes: ["C","E","G"],',
		'    playedNotes: ["tblS6_1:2","tblP4_2:1"],',
		'    recordedNotes: ["tblS6_1:3","tblP4_1:7"]',
		'}'
	].join('\n'));
});