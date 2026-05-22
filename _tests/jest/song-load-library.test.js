import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { logVerbose, INFINITE_NECK_VERBOSE, VERBOSE_MODE, VERBOSE_MODE_INT } from './LogVerboseJest.js';
import { validateSongFileSchema } from './SongFileV2Schema.js';
import { Song } from '../../Song.js';


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

function getSectionRootIDs(data) {
    if (!Array.isArray(data.sections)) return [];
    return data.sections.map(section => {
        expect(section).toHaveProperty('rootID');
        return section.rootID;
    });
}

function getSectionNotesByTableSummary(sectionNotesByTable) {
    if (!sectionNotesByTable || typeof sectionNotesByTable !== 'object') return 'null';
    const tableKeys = Object.keys(sectionNotesByTable);
    if (tableKeys.length === 0) return ':0';
    return (
        '['
        + tableKeys.map((tableKey) => {
            const sectionNotes = sectionNotesByTable[tableKey] || {};
            const played = Array.isArray(sectionNotes.playedNotes) ? sectionNotes.playedNotes.length : 0;
            const named = sectionNotes.namedNotes && typeof sectionNotes.namedNotes === 'object'
                ? Object.keys(sectionNotes.namedNotes).length
                : 0;
            const recorded = sectionNotes.recordedNotes && typeof sectionNotes.recordedNotes === 'object'
                ? Object.values(sectionNotes.recordedNotes).reduce((count, notes) => count + (Array.isArray(notes) ? notes.length : 0), 0)
                : 0;
            return `${tableKey}:p${played}/n${named}/r${recorded}`;
        }).join(',')
        + ']'
    );
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
        logVerbose(2, '🡆  In song ⠶ ' + file
            + LF + "    • expectedFailure:" + songTestOptions.expectedFailure
            + LF + "    • summary:" + JSON.stringify({ expectedSections, sectionRootIDs, song_rootID: data.rootID })
            + LF + "    • songTestOptions:" + JSON.stringify(songTestOptions));

        const schemaResult = validateSongFileSchema(data);
        summaryInfo.schemaValid = schemaResult.valid;
        summaryInfo.schemaErrors = schemaResult.errors.length;
        if (!schemaResult.valid) {
            throw new Error(`Song file does not match V2 schema:\n${schemaResult.errors.join('\n')}`);
        }

        const song = new Song(data);
        song.setHeadless(true, true);
        song.ensureDefaultSection();
        song.fixupCurrentIndexForLoadedSong();

        expect(song.getSections().length).toBe(expectedSections);
        expect(data).toHaveProperty('rootID');
        if (Array.isArray(data.sections)) {
            data.sections.forEach((section, i) => {
                currentSectionIndex = i;
                summaryInfo.currentSectionIndex = i;
                currentObjectDump = JSON.stringify(section, null, 4);
                expect(section).toHaveProperty('sectionNotesByTable');
                const sectionNotesSummary = getSectionNotesByTableSummary(section.sectionNotesByTable);
                logVerbose(3, `sections[${i}]➝  sectionNotesByTable${sectionNotesSummary}  •  《${sectionRootIDs}》 `);
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
        const errorMsg = `\n🛑 Failure in file: ${file} :: sections[${currentSectionIndex}]\n    • Summary: ${summaryStr}`
            + LF + "    • expectedFailure:" + songTestOptions.expectedFailure
            + LF + `    • failed: ${failed}`
            + `\n✴   Jest Exception: \n❮❮❮\n ${jestException}\n❯❯❯\n\n`;
        if (VERBOSE_MODE > 0) {
            errorSummary = errorMsg;
            let dump = "";
            if (VERBOSE_MODE > 2) {
                dump = LF + LF + "⮮‾‾‾‾‾ Current Object" + LF + currentObjectDump + LF + "⮬______";  //
            }
            logVerbose(2, errorMsg + dump);
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

//const describeSongFileLoading = RUN_WHOLE_SONG_LIBRARY_TESTS ? describe : describe.skip;
const describeSongFileLoading = describe;

describeSongFileLoading('Song file and getSong() loading validation', () => {
    let accumFilename = [];
    logVerbose(2, "🛈  Song Files to be tested with songTestOptions: " + LF + JSON.stringify(songFiles, null, 4));
    songFiles.forEach(({ file, songTestOptions }) => {
        const filePath = path.join(__dirname, '../../songs', file);
        let data;
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
        const schemaMode = '| schema:V2';
        const rootIDsLabel = (VERBOSE_MODE > 0) ? `${rootIDs}` : '';
        const testLabel = `${SONGSDIR}${file}`
            + ` | list:${songTestOptions.list}`
            + ` | sections:${sectionCount}${rootIDsLabel}`
            + ` ${strictMode}`
            + ` ${schemaMode}`
            + (songTestOptions.expectedFailure ? ' (expected failure🍌)' : '')
            + ` | reason:${songTestOptions.reason}`;
        test(testLabel, () => {
            runSongValidation(file, data, songTestOptions);
        });
    });
});
