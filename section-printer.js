import * as Constants from './Constants.js';
import {
    toInt
} from './utils.js';    
import {
    getTonalForTable
} from './TonalFunctions.js';

import { buildTonalPicker } from './tonalPicker.js';


const { Chord } = globalThis.Tonal?.Chord
    ? globalThis.Tonal
    : await import('tonal');

export function printSections(theSong, theSections, showDetails) {
    let result = "<table class='sectionPrintNotes'><tr><th>ID</th><th>beats</th><th>KEY</th><th>&sharp;/&flat;</th><th>Chord</th><th>Caption</th>"
        + (showDetails ? "<th>Details</th>" : "")
        + "</tr>";
    let details;
    theSections.forEach((section, idx) => {
        details = "<pre style='margin:0'>" + getSectionNotesDisplayString(section) + "</pre>";
        const SEP = "</td><td>";
        result += "<tr><td>"
            + "<a href='#' data-action='linkToSection' data-action-args='[" + idx + "]'>" + (toInt(idx, 0) + 1) + "</a>" + SEP
            + section.beats + SEP
            + "<B style='font-size: 130%;'>" + theSong.noteIDToNoteName(section.rootID) + (section.rootIDLead != -1 ? "/" + theSong.noteIDToNoteName(section.rootIDLead) : "") + "</B>" + SEP
            + (section.sharps ? " &sharp; " : " &flat; ") + SEP
            + (section.chartChord ? section.chartChord : "&nbsp;") + SEP
            + "<b style='font-size: 130%;'>" + section.caption + "</b>"
            + (showDetails ? (SEP + details) : "")
            + "</td></tr>";
    });
    return result + "</table>";
}

export function printSectionsNotes(theSong, theSections){
    const instrumentTableIDs = [];
    const seenTableIDs = new Set();

    function addInstrumentTableID(tableID) {
        if (!seenTableIDs.has(tableID)) {
            seenTableIDs.add(tableID);
            instrumentTableIDs.push(tableID);
        }
    }

    function stripTablePrefix(tableID) {
        if (tableID && tableID.startsWith(Constants.TABLE_ID_PREFIX)) {
            return tableID.substring(Constants.TABLE_ID_PREFIX.length);
        }
        return tableID || '';
    }

    function getNoteName(note) {
        if (note && note.noteName) {
            return note.noteName;
        }
        if (note && note.midinum !== undefined) {
            return TableBuilder.midinumToNoteName(parseInt(note.midinum, 10));
        }
        return '';
    }

    function formatNamedNotes(namedNotes) {
        return Object.entries(namedNotes || {})
            .filter(([_, v]) => v && Object.keys(v).length > 0)
            .map(([k]) => k)
            .join(',');
    }
    function formatPlayedNotes(playedNotes) {
        return (playedNotes || [])
            .map((note) => getNoteName(note))
            .filter((noteName) => !!noteName)
            .join(',');
    }

    function formatRecordedNotes(recordedNotes) {
        const beatMarkup = Object.keys(recordedNotes || {})
            .sort((left, right) => toInt(left, 0) - toInt(right, 0))
            .map((beat) => {
                const noteNames = (recordedNotes[beat] || [])
                    .map((note) => getNoteName(note))
                    .filter((noteName) => !!noteName)
                    .join(',');
                return noteNames ? `<div class='beat'><span class='beatNum'>${beat}:</span> ${noteNames}</div>` : '';
            })
            .filter((beatNotes) => !!beatNotes)
            .join('');

        return beatMarkup ? `<div class='beats'>${beatMarkup}</div>` : '';
    }

    theSections.forEach((section) => {
        section.getAllSectionNotes().forEach(([tableID]) => {
            addInstrumentTableID(tableID);
        });
    });

    let result = "<table class='sectionPrintNotes'><tr>"
        + "<th class='SPN_TH' rowspan='2'>ID</th>"
        + "<th class='SPN_TH' rowspan='2'>beats</th>"
        + "<th class='SPN_TH' rowspan='2'>KEY</th>"
        + "<th class='SPN_TH' rowspan='2'>&sharp;/&flat;</th>"
        + "<th class='SPN_TH' rowspan='2'>Chord</th>"
        + "<th class='SPN_TH' rowspan='2'>Mode</th>"
        + "<th class='SPN_TH' rowspan='2'>Caption</th>";

    let colorAlt = true;  
    let theClass = "";  
    instrumentTableIDs.forEach((tableID) => {
        theClass = colorAlt ? "SPN_evenColn" : "SPN_oddColn"; 
        result += "<th class='"+theClass+"' colspan='4'>" + stripTablePrefix(tableID) + "</th>";
        colorAlt = !colorAlt;
    });
    result += "</tr><tr>";
    colorAlt = true;
    instrumentTableIDs.forEach(() => {
        theClass = colorAlt ? "SPN_evenCol" : "SPN_oddCol"; 
        result += "<th class='"+theClass+"n'>named</th><th class='"+theClass+"p'>played</th><th class='"+theClass+"r'>rec</th><th class='"+theClass+"c'>Chords</th>";
        colorAlt = !colorAlt;
    });
    result += "</tr>";

    theSections.forEach((section, idx) => {
        result += "<tr><td>"
            + "<a href='#' data-action='linkToSection' data-action-args='[" + idx + "]'>" + (toInt(idx, 0) + 1) + "</a>"
            + "</td><td>" + section.beats
            + "</td><td><B style='font-size: 130%;'>" + theSong.noteIDToNoteName(section.rootID) + (section.rootIDLead != -1 ? "/" + theSong.noteIDToNoteName(section.rootIDLead) : "") + "</B>"
            + "</td><td>" + (section.sharps ? " &sharp; " : " &flat; ")
            + "</td><td>" + (section.chartChord ? section.chartChord : "&nbsp;") 
            + "</td><td>" + (section.mode ? section.mode : "&nbsp;") 
            + "</td><td><b style='font-size: 130%;'>" + section.caption + "</b></td>";

        instrumentTableIDs.forEach((tableID) => {
            const sn = section.sectionNotesByTable[tableID];
            if (!sn) {
                result += "<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>";
                return;
            }
            result += "<td><div class='SPN_NN'>" + (formatNamedNotes(sn.namedNotes) || "&nbsp;") + "</div></td>";
            result += "<td><div class='SPN_PN'>" + (formatPlayedNotes(sn.playedNotes) || "&nbsp;") + "</div></td>";
            result += "<td><div class='SPN_RN'>" + (formatRecordedNotes(sn.recordedNotes) || "&nbsp;") + "</div></td>";
            
            let chartChordsResult = getTonalForTable(theSong, section, tableID);
            let chartChordsNotes = chartChordsResult.normalizedNamedNotes.join(',');
            //let links = chartChordsResult.chords.map(ch => `<a href='#' data-action='linkToSectionChartChord' data-action-args='["${idx}","${ch}"]'>${ch}</a>`)
            //                             .join('<br>');
            let chordLinks = buildTonalPicker(idx, "chords", chartChordsResult.chords, section.chartChord)                                         
            let modeLinks = buildTonalPicker(idx, "modes", chartChordsResult.scale, section.mode);
            result += "<td><div class='SPN_CC'>" 
                     +chartChordsNotes+':'
                     +chordLinks
                     +modeLinks+"</div></td>";
        });

        result += "</tr>";
    });

    return result + "</table>";
}


export function getSectionNotesDisplayData(section) {
    const namedNotes = new Set();
    const playedNotes = [];
    const recordedNotes = [];

    section.getAllSectionNotes().forEach(([tableID, sn]) => {
        Object.keys(sn?.namedNotes || {}).forEach((noteName) => {
            namedNotes.add(noteName);
        });

        const playedCount = Array.isArray(sn?.playedNotes) ? sn.playedNotes.length : 0;
        if (playedCount > 0) {
            playedNotes.push(`${tableID}:${playedCount}`);
        }

        const recordedCount = Object.values(sn?.recordedNotes || {}).reduce((count, notesForBeat) => {
            return count + (Array.isArray(notesForBeat) ? notesForBeat.length : 0);
        }, 0);
        if (recordedCount > 0) {
            recordedNotes.push(`${tableID}:${recordedCount}`);
        }
    });

    return {
        namedNotes: Array.from(namedNotes).sort((left, right) => left.localeCompare(right)),
        playedNotes,
        recordedNotes
    };
}

export function getSectionNotesDisplayString(section) {
    const details = getSectionNotesDisplayData(section);
    return JSON.stringify(details, null, 4);
}


