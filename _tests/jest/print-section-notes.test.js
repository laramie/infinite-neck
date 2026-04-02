function installMinimalBrowserGlobals() {
	global.window = {
		addEventListener() {},
		removeEventListener() {},
		innerWidth: 1280,
		innerHeight: 720
	};
	global.document = {
		addEventListener() {},
		removeEventListener() {}
	};
	global.localStorage = {
		getItem() { return null; },
		setItem() {},
		removeItem() {}
	};
}

async function createFreshV2Song() {
	installMinimalBrowserGlobals();
	const neck = await import('../../infinite-neck-headless.js');
	neck.setupSongTests();
	const song = neck.getSong();
	song.setHeadless(true, true);
	song.setSongfileVersion('V2');
	song.sections = [];
	song.gSectionsCurrentIndex = 0;
	return { song, neck };
}

test('printSectionNotes renders V2 note tables by instrument', async () => {
	const { song, neck } = await createFreshV2Song();

	const firstSection = song.constructSection();
	firstSection.caption = 'Verse';
	firstSection.beats = 4;
	firstSection.rootID = 3;

	const s6 = firstSection.getSectionNotes('tblS6_1');
	s6.namedNotes.C = { colorClass: 'Blue' };
	s6.namedNotes.E = { colorClass: 'Blue' };
	s6.playedNotes.push({ noteName: 'C' }, { noteName: 'E' });
	s6.recordedNotes['2'] = [{ noteName: 'B' }, { noteName: 'G' }, { noteName: 'C' }];
	s6.recordedNotes['1'] = [{ noteName: 'A' }, { noteName: 'B' }, { noteName: 'G' }];

	const p4 = firstSection.getSectionNotes('tblP4_1');
	p4.namedNotes.G = { colorClass: 'Green' };
	p4.playedNotes.push({ noteName: 'G' });
	p4.recordedNotes['3'] = [{ noteName: 'G' }, { noteName: 'A' }];

	song.addSection(firstSection);

	const secondSection = song.constructSection();
	secondSection.caption = 'Bridge';
	secondSection.beats = 3;
	secondSection.rootID = 5;
	secondSection.getSectionNotes('tblS6_1').namedNotes.A = { colorClass: 'Red' };
	song.addSection(secondSection);

	const result = neck.printSectionNotes();

	expect(result).toContain("<th colspan='3'>S6_1</th>");
	expect(result).toContain("<th colspan='3'>P4_1</th>");
	expect(result).toContain("<th>named</th><th>played</th><th>rec</th><th>named</th><th>played</th><th>rec</th>");
	expect(result).toContain("<b style='font-size: 130%;'>Verse</b></td><td>C, E</td><td>C, E</td><td>1: A, B, G 2: B, G, C</td><td>G</td><td>G</td><td>3: G, A</td>");
	expect(result).toContain("<b style='font-size: 130%;'>Bridge</b></td><td>A</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>");
});