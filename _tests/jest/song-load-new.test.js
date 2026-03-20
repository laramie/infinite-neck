import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { logVerbose, INFINITE_NECK_VERBOSE, VERBOSE_MODE, VERBOSE_MODE_INT } from './LogVerboseJest.js';
import { 
    setupSongTests, 
    getSong, 
    readVersionHeadless 
} from '../../infinite-neck-headless.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LF = "\n";
const LFWS = "\n    ";
const LFWS2 = "\n        ";

const INFINITE_NECK_SONG = process.env.INFINITE_NECK_SONG || "";
const INFINITE_NECK_SONGLIST = process.env.INFINITE_NECK_SONGLIST || "";


const INFINITE_NECK_SUITE = process.env.INFINITE_NECK_SUITE;
const INFINITE_NECK_SUITE_INPUT = parseInt(INFINITE_NECK_SUITE, 10);
const SUITE = isNaN(INFINITE_NECK_SUITE_INPUT) ? 0 : INFINITE_NECK_SUITE_INPUT;
const MORE_THRESHOLD = VERBOSE_MODE > 1 ? 100 : 10;

function printVerboseModeMessage() {
    function getHelpMsg() {
        return LF + LFWS + 'INFINITE_NECK_VERBOSE values:'
            + LFWS2 + '-1 : Ultra-terse: no console logs at all'
            + LFWS2 + ' 0 : Terse: only minimal Jest output'
            + LFWS2 + ' 1 : Verbose: summary info, flat context objects, <10 rootIDs, show Help'
            + LFWS2 + ' 2 : More-verbose: pretty context objects, songList dump'
            + LFWS2 + ' 3 : Ultra-verbose: pretty Section objects, per-loop logs, <100 rootIDs, debug info';
    }
    function getSnarky() {
        return LF + LFWS + 'In bash this sets Verbose value of 1:'
            + LF
            + LFWS + '    export INFINITE_NECK_VERBOSE=1'
            + LF;
    }
    function showEnvVarOptions() {
        return LF + LF + '🛈  ENV vars passed in: '
            + LFWS2 + 'INFINITE_NECK_SUITE=' + INFINITE_NECK_SUITE
            + LFWS2 + 'INFINITE_NECK_SONG=' + INFINITE_NECK_SONG
            + LFWS2 + 'INFINITE_NECK_SONGLIST=' + INFINITE_NECK_SONGLIST
            + LFWS2 + 'INFINITE_NECK_VERBOSE=' + INFINITE_NECK_VERBOSE
            + LFWS2 + 'INFINITE_NECK_VERBOSE(calculated)=' + VERBOSE_MODE;
    }
    if (VERBOSE_MODE > 0) {
        logVerbose(0, '🛈  Verbose mode because INFINITE_NECK_VERBOSE=' + VERBOSE_MODE
            + getHelpMsg()
            + showEnvVarOptions()
        );
    } else if (VERBOSE_MODE === -1) {
        //Nothing.  Stock Jest test. No messages, not even this one.
    } else if (isNaN(VERBOSE_MODE_INT)) {
        logVerbose(0, '🛈  Terse mode because INFINITE_NECK_VERBOSE=' + INFINITE_NECK_VERBOSE
            + '\r\n   Run with -1 to suppress this message, or 1 to show Help.'
            + getHelpMsg()
            + getSnarky()
            + showEnvVarOptions()
        );
    } else {
        logVerbose(0, '🛈  Terse mode because INFINITE_NECK_VERBOSE=' + INFINITE_NECK_VERBOSE
            + '\r\n   Run with -1 to suppress this message, or 1 to show Help'
            + showEnvVarOptions()
        );
    }
}

const ALLOWED_NOTE_NAMES = ["A", "Bb", "B", "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab"];
const SONGS_DIR = path.join(__dirname, '../../songs');
const SONGSDIR = 'songs/';
const SONGSTEST_RELDIR = 'tests/';
const SONGSTESTDIR = SONGSDIR + SONGSTEST_RELDIR;

function setUpMaster_songTestOptions_Array() {
    return [
        {
            expectedFailure: false,
            strictFile_styleNum: false,
            list: SONGSDIR + 'song-list.json',
            dir: SONGSDIR,
            reason: "library-songs👍pass"
        },
        {
            expectedFailure: false,
            strictFile_styleNum: false,
            list: SONGSTESTDIR + 'test-song-list.json',
            dir: SONGSTESTDIR,
            reason: "test-songs👍pass"
        },
        {
            expectedFailure: true,
            strictFile_styleNum: true,
            list: SONGSTESTDIR + 'failure-test-song-list.json',
            dir: SONGSTESTDIR,
            reason: "test-songs👍should-fail"
        },
        {
            expectedFailure: true,
            strictFile_styleNum: true,
            list: SONGSTESTDIR + 'failure-strict-test-song-list.json',
            dir: SONGSTESTDIR,
            reason: "test-songs👍should-fail-strict"
        }
    ];
}

function setupHarsh_songTestOptions_Array() {
    return [
        {
            expectedFailure: false,
            strictFile_styleNum: true,
            list: SONGSDIR + 'song-list-harsh-test.json',
            dir: SONGSDIR,
            reason: "harsh-mode-songs👍fail"
        }
    ];
}

function setupTestdirHarsh_songTestOptions_Array() {
    return [
        {
            expectedFailure: true,
            strictFile_styleNum: true,
            list: SONGSTESTDIR + 'test-song-list-harsh-test.json',
            dir: SONGSTESTDIR,
            reason: "harsh-mode-songs👍fail"
        }
    ];
}

function createSongList(theSongListFile, relDir = null) {
    logVerbose(3, "   🦊 attempting to open file in createSongList: "+theSongListFile);
    const songListPath = path.join(__dirname, '../../', theSongListFile);
    let theSongList = JSON.parse(fs.readFileSync(songListPath, 'utf8')).songs;
    if (relDir) {
        theSongList = theSongList.map(f => `${relDir}${f}`);
    }
    return theSongList;
}

function createSongFilesArray_Refactored(masterListArray) {
    let theSongFilesArray = [];
    masterListArray.forEach(songTestOptions => {
        if (!songTestOptions.list || !songTestOptions.dir) return;
        let relDir = null;
        if (songTestOptions.dir === SONGSTESTDIR) {
            relDir = SONGSTEST_RELDIR;
        }
        const songList = createSongList(songTestOptions.list, relDir);
        songList.forEach(f => {
            theSongFilesArray.push({
                file: f,
                songTestOptions: { ...songTestOptions }
            });
        });
    });
    return theSongFilesArray;
}

function setup_songTestOptions_Array_FromNamed(songlist) {
    const listFilename = SONGSDIR + songlist;
    const listPath = path.join(__dirname, '../../', listFilename);
    let fileContents;
    logVerbose(0, "🛈  Reading named file from env: " + INFINITE_NECK_SONGLIST
        + LFWS2 + " found: " + listPath);
    try {
        fileContents = fs.readFileSync(listPath, 'utf8');
    } catch (e) {
        logVerbose(1, `🛑 Error reading songTestOptions file: ${listPath}`);
        throw e;
    }
    let parsed;
    try {
        parsed = JSON.parse(fileContents);
        logVerbose(3, "  🦊  song file read in setup_songTestOptions_Array_FromNamed: "+LF+JSON.stringify(parsed,null,2));  
    } catch (e) {
        logVerbose(1, `🛑 Error parsing JSON in songTestOptions file: ${listPath}`);
        throw e;
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.songTestOptions || typeof parsed.songTestOptions !== 'object' || !Array.isArray(parsed.songs)) {
        logVerbose(1, `🛑 Strict structure violation in songTestOptions file: ${listPath}`);
        throw new Error('setup_songTestOptions_Array_FromNamed: JSON file must contain { songTestOptions: {...}, songs: [...] }');
    }
    return parsed.songs.map(songFile => ({
        file: (parsed.songTestOptions.dir === SONGSTESTDIR ? SONGSTEST_RELDIR : '') + songFile,
        songTestOptions: {
            ...parsed.songTestOptions,
            list: listFilename,
            dir: parsed.songTestOptions.dir || SONGSDIR,
            reason: parsed.songTestOptions.reason || ''
        }
    }));
}

let songFiles = null;
if (INFINITE_NECK_SONGLIST) {
    logVerbose(0, "Running INFINITE_NECK_SONGLIST="+INFINITE_NECK_SONGLIST);
    songFiles = setup_songTestOptions_Array_FromNamed(INFINITE_NECK_SONGLIST);
} else if (SUITE===2) {
    logVerbose(0, "Running INFINITE_NECK_SUITE=2");
    songFiles = createSongFilesArray_Refactored(setupHarsh_songTestOptions_Array());
} else if (SUITE===3) {
    logVerbose(0, "Running INFINITE_NECK_SUITE=3");
    songFiles = createSongFilesArray_Refactored(setupTestdirHarsh_songTestOptions_Array());
} else {  
    logVerbose(0, "Running INFINITE_NECK_SUITE=1, Default, Master.");
    songFiles = createSongFilesArray_Refactored(setUpMaster_songTestOptions_Array());
}
logVerbose(3, "  🦊 createSongFilesArray--->songFiles : " +LF+ JSON.stringify(songFiles, null, 4));

if (INFINITE_NECK_SONG) {
    songFiles = songFiles.filter(entry => entry.file === INFINITE_NECK_SONG);
}

function getNoteTableSummary(noteTables) {
    if (!noteTables) return 'null';
    if (typeof noteTables !== 'object') return 'not-an-object';
    const keys = Object.keys(noteTables);
    if (keys.length === 0) return ':0';
    return (
        '[' +
        keys.map(key => `${key}:${Array.isArray(noteTables[key]) ? noteTables[key].length : 0}`).join(',') +
        ']'
    );
}

function getNamedNotesCount(namedNotes) {
    if (!namedNotes || typeof namedNotes !== 'object') return 0;
    return Object.keys(namedNotes).length;
}

function validateNamedNotes(namedNotes, songTestOptions = {}, summaryInfo) {
    for (const key of Object.keys(namedNotes)) {
        summaryInfo.namedNoteKey = key;
        expect(ALLOWED_NOTE_NAMES).toContain(key);
        const note = namedNotes[key];
        if (Object.keys(note).length === 0) {  // allow empty note entries like "G":{}
            continue;
        }
        summaryInfo.note = VERBOSE_MODE > 1 ? note : JSON.stringify(note);
        expect(note).toHaveProperty('noteName');
        expect(note).toHaveProperty('colorClass');
        validateStyleNum(note, songTestOptions);
        expect(note.noteName).toBe(key);
        expect(typeof note.colorClass === 'string' && note.colorClass.length > 0).toBe(true);
    }
    summaryInfo.note = "";
    summaryInfo.namedNoteKey = "";
}

function validateNoteTables(noteTables, songTestOptions = {}, summaryInfo) {
    expect(typeof noteTables).toBe('object');
    for (const tblnameKey of Object.keys(noteTables)) {
        summaryInfo.tableName = tblnameKey;
        const oneTable = noteTables[tblnameKey];
        if (!Array.isArray(oneTable)) continue;
        oneTable.forEach((note, idx) => {
            summaryInfo.noteTableIndex = idx;
            summaryInfo.note = VERBOSE_MODE > 1 ? note : JSON.stringify(note);
            expect(note).toHaveProperty('noteName');
            expect(note).toHaveProperty('colorClass');
            validateStyleNum(note, songTestOptions);
            expect(typeof note.colorClass === 'string' && note.colorClass.length > 0).toBe(true);
        });
        summaryInfo.noteTableIndex = "";
        summaryInfo.note = "";
    }
    summaryInfo.tableName = "";
}

function validateStyleNum(obj, songTestOptions = {}) {
    if (songTestOptions.strictFile_styleNum) {
        expect(obj).toHaveProperty('styleNum');
        expect(typeof obj.styleNum === 'number' && Number.isInteger(obj.styleNum)).toBe(true);
    } else {
        if (obj.hasOwnProperty('styleNum')) {
            expect(typeof obj.styleNum === 'number' && Number.isInteger(obj.styleNum)).toBe(true);
        }
    }
}

function validateSectionDictionaries(data) {
    if (!Array.isArray(data.sections)) return;
    data.sections.forEach((section, idx) => {
        expect(section).toHaveProperty('namedNotes');
        expect(typeof section.namedNotes).toBe('object');
        expect(section).toHaveProperty('noteTables');
        expect(typeof section.noteTables).toBe('object');
    });
}

function getSectionRootIDs(data) {
    if (!Array.isArray(data.sections)) return [];
    return data.sections.map(section => {
        expect(section).toHaveProperty('rootID');
        return section.rootID;
    });
}

function runSongValidation(file, data, songTestOptions = {}) {
    const expectedSections = Array.isArray(data.sections) ? data.sections.length : 0;
    const sectionRootIDsArr = getSectionRootIDs(data);
    const sectionRootIDsArrStr = rootIDsMore(sectionRootIDsArr);
    const sectionRootIDs = VERBOSE_MODE > 0 ? `${sectionRootIDsArrStr}` : `${sectionRootIDsArr.length}`;
    let failed = false;
    let errorSummary = '';
    let summaryInfo = { expectedSections, sectionRootIDs, song_rootID: data.rootID };
    let currentSectionIndex = -1;
    let currentObjectDump = "";
    try {
        logVerbose(1, '🡆  In song ⠶ ' + file
            + LF + "    • expectedFailure:" + songTestOptions.expectedFailure
            + LF + "    • summary:" + JSON.stringify({ expectedSections, sectionRootIDs, song_rootID: data.rootID })
            + LF + "    • songTestOptions:" + JSON.stringify(songTestOptions));
        setupSongTests();
        getSong().addSections(data);
        expect(getSong().getSections().length).toBe(expectedSections);
        expect(data).toHaveProperty('rootID');
        validateSectionDictionaries(data, file);
        if (Array.isArray(data.sections)) {
            data.sections.forEach((section, i) => {
                currentSectionIndex = i;
                summaryInfo.currentSectionIndex = i;
                currentObjectDump = JSON.stringify(section, null, 4);
                expect(section).toHaveProperty('noteTables');
                expect(section).toHaveProperty('namedNotes');
                validateNoteTables(section.noteTables, songTestOptions, summaryInfo);
                validateNamedNotes(section.namedNotes, songTestOptions, summaryInfo);
                const noteTableSummary = getNoteTableSummary(section.noteTables);
                const namedNotesCount = getNamedNotesCount(section.namedNotes);
                logVerbose(3, `sections[${i}]➝  noteTables${noteTableSummary}  •  namedNotes:${namedNotesCount}  •  《${sectionRootIDs}》 `);
            });
        }
        logVerbose(3, '👉   leaving test block ⠶ ' + file
            + LF + "   • expectedFailure:" + songTestOptions.expectedFailure
            + LF + "     • songTestOptions:" + JSON.stringify(songTestOptions));
    } catch (e) {
        logVerbose(3, '👉   caught exception ⠶ ' + file
            + LF + "     • expectedFailure:" + songTestOptions.expectedFailure
            + LF + "     • songTestOptions:" + JSON.stringify(songTestOptions));
        failed = true;
        const summaryStr = VERBOSE_MODE > 1 ? JSON.stringify(summaryInfo, null, 4) : JSON.stringify(summaryInfo);
        const jestException = VERBOSE_MODE > 1 ? `${e.message}\n${e.stack}` : `${e.message}\n`;
        errorMsg = `\n🛑 Failure in file: ${file} :: sections[${currentSectionIndex}]\n    • Summary: ${summaryStr}`
            + LF + "    • expectedFailure:" + songTestOptions.expectedFailure
            + LF + `    • failed: ${failed}`
            + `\n✴   Jest Exception: \n❮❮❮\n ${jestException}\n❯❯❯\n\n`;
        if (VERBOSE_MODE > 0) {
            errorSummary = errorMsg;
            let dump = "";
            if (VERBOSE_MODE > 2) {
                dump = LF + LF + "⮮‾‾‾‾‾ Current Object" + LF + currentObjectDump + LF + "⮬______";  //
            }
            logVerbose(1, errorMsg + dump);
        } else {
            errorSummary = '';
        }
    }
    logVerbose(3, '🎄   preparing to run final expect ⠶ ' + file
        + LF + "  • expectedFailure:" + songTestOptions.expectedFailure
        + LF + `  • failed: ${failed}`
        + LF + "  • songTestOptions:" + JSON.stringify(songTestOptions));

    if (songTestOptions.expectedFailure) {
        expect(failed).toBe(true);
    } else {
        expect(failed).toBe(false);
    }
    return { expectedSections, sectionRootIDs, song_rootID: data.rootID, errorSummary };
}

function rootIDsMore(sectionRootIDsArr) {
    const sectionRootIDsArrStr = sectionRootIDsArr.length < MORE_THRESHOLD
        ? `[${sectionRootIDsArr.join(",")}]`
        : `[${sectionRootIDsArr.slice(0, MORE_THRESHOLD).join(",")}...${sectionRootIDsArr.length - MORE_THRESHOLD} more]`;
    return sectionRootIDsArrStr;
}

printVerboseModeMessage();

describe('getSong() test_getRelativeSectionWithWrap', () => {
    test('should run test_getRelativeSectionWithWrap without errors', () => {
        setupSongTests();
        getSong().setHeadless(true, true/*quiet*/);
        logVerbose(1, "Build Version: \n"+JSON.stringify(readVersionHeadless(),null,4));
        //songs always have the "Miranda" section as sections[0].
        getSong().sections[0].caption = 'Section 1 (default)';
        getSong().sections[0].rootID = '1';
        getSong().addSection(getSong().constructSection());
        getSong().addSection(getSong().constructSection());
        getSong().addSection(getSong().constructSection());
        getSong().sections[1].caption = 'Section 2';
        getSong().sections[1].rootID = '2';
        getSong().sections[2].caption = 'Section 3';
        getSong().sections[2].rootID = '3';
        getSong().sections[3].caption = 'Section 4';
        getSong().sections[3].rootID = '4';
        expect(() => {
            const testResult = getSong().test_getRelativeSectionWithWrap(false);
            if (testResult.warnings && testResult.warnings.length>0){
                logVerbose(1, "test_getRelativeSectionWithWrap should kick back some foo/bar (and +/- without digit) validation errors: \n"+testResult.warnings.join("\n"));
            }
            if (testResult.infos && testResult.infos.length>0){
                logVerbose(1, "test_getRelativeSectionWithWrap should kick back some infos which mean 'PASS': \n"+testResult.infos.join("\n"));
            }
            if (testResult.terse && testResult.terse.length>0){
                logVerbose(1, "test_getRelativeSectionWithWrap should kick back some terse results which mean 'PASS': \n"+testResult.terse.join("\n"));
            }
        }).not.toThrow();
    });
});

describe('Song file and getSong() loading validation', () => {
    let accumFilename = [];
    let data = null;
    logVerbose(2, "🛈  Song Files to be tested with songTestOptions: " + LF + JSON.stringify(songFiles, null, 4));
    songFiles.forEach(({ file, songTestOptions }) => {
        const filePath = path.join(__dirname, '../../songs', file);
        accumFilename.push(`${filePath}`);
        logVerbose(3, "  🦊 atempting to read song: "+filePath);
        logVerbose(3, "  🦊 with options: "+LF+JSON.stringify(songTestOptions,null,4));
        try {
            data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            logVerbose(1, `🛈 File list so far: ${LF}${accumFilename.join(LF)}`)
            logVerbose(1, `🛑 Error reading file: ${filePath}`);
            throw e;
        }
        const sectionCount = Array.isArray(data.sections) ? data.sections.length : 0;
        const rootIDs = Array.isArray(data.sections) ? rootIDsMore(data.sections.map(s => s.rootID)) : '';
        const strictMode = songTestOptions.strictFile_styleNum ? '| fmt:strict🧐' : '';
        const rootIDsLabel = (VERBOSE_MODE > 0) ? `${rootIDs}` : '';
        const testLabel = `${SONGSDIR}${file}`
            + ` | list:${songTestOptions.list}`
            + ` | sections:${sectionCount}${rootIDsLabel}`
            + ` ${strictMode}`
            + (songTestOptions.expectedFailure ? ' (expected failure🍌)' : '')
            + ` | reason:${songTestOptions.reason}`;
        test(testLabel, () => {
            runSongValidation(file, data, songTestOptions);
        });
    });
});
