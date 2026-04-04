import {
    setupSongTests,
    getSong
} from '../../infinite-neck-headless.js';

function createFreshHeadlessSong() {
    setupSongTests();
    getSong().setHeadless(true, true);
    return getSong();
}

test('cycleThruKeysAllSections transposes each section rootID with wrap', () => {
    const song = createFreshHeadlessSong();
    song.setSongfileVersion("V2");
    song.sections = [];
    song.gSectionsCurrentIndex = 0;

    // Uses Section v1 for now via song.constructSection()
    const s1 = song.constructSection();
    const s2 = song.constructSection();
    const s3 = song.constructSection();
    s1.rootID = 0;
    s2.rootID = '11';
    s3.rootID = 5;
    song.addSection(s1);
    song.addSection(s2);
    song.addSection(s3);

    song.cycleThruKeysAllSections(2);

    expect(song.getSections()[0].rootID).toBe(2);
    expect(song.getSections()[1].rootID).toBe(1);
    expect(song.getSections()[2].rootID).toBe(7);
    //console.log("SectionV2 dump: \n"+song.dump(false));
});