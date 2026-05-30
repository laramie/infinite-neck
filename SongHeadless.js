import fs from 'fs';


import * as SectionPrinter from './section-printer.js';
import { Song } from './Song.js';
import { ANSIColors } from './bin/ANSIColors.js';
import {
    getTonalForTable
} from './TonalFunctions.js';

function loadSong(songFileRelPath){
    const jsonObj = JSON.parse(fs.readFileSync(songFileRelPath, 'utf8'));
    let song = new Song(jsonObj);
    return song;
}

function main(){
    const SONGFILE = process.argv[2] || './songs/tests/persistence/forward-backward-observers.json';
    let song = loadSong(SONGFILE);
    //console.log("Song round-trip: \n"+JSON.stringify(song, null, 4));
    console.log(JSON.stringify(song, null, 4));
    song.getSections().forEach((s, idx) => {
        console.log(ANSIColors.red("Section["+idx+"]"));
        console.log(ANSIColors.cyan(SectionPrinter.getSectionNotesDisplayString(s)));
        s.getAllSectionNotes().forEach(([tableID]) => {
            console.log(ANSIColors.yellow(`${tableID}: ${JSON.stringify(getTonalForTable(song, s, tableID), null, 4)}`));
        });
    });

    //console.log(ANSIColors.green("Song round-trip w/replacer:"));
    //console.log(JSON.stringify(song, SongPersistence.persistentSongFileReplacer, 4));
}

/** run with something like this: 
    laramie@penguin:~/infinite-neck$ export FORCE_COLOR=1
    laramie@penguin:~/infinite-neck$ node SongHeadless.js
        laramie@penguin:~/infinite-neck$ node SongHeadless.js ./songs/tests/persistence/forward-backward-observers.json
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}