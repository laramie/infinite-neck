import { 
    linkToSectionChartChord,
    linkToSectionChartMode
} from './infinite-neck.js';

/* This is a widget
        - span should close up and have an edit/select button
        - default to closed
        - should register functions, hopefully not on window.* but on "on("click"....)"
        - should ensure HEAD has functions under scrit tag <script id="widget.type"....>
        - should ensure that DOM delete cleans up
    - add column for mode, get value from song: see how chord column is refreshed by re-printing.
    - fix /vdf and friends
    - Usage:   
        buildTonalPicker(sectionIdx, "mode", modeArray);
        buildTonalPicker(sectionIdx, "chord", chordArray);
*/

const CSS_TEXT = `
.tonalPicker {
    display: block;
    margin:0;
    padding: 0;
    white-space: normal;
    FOOflex-direction: column;
    border: 1px solid green;
    FOOwidth: 100%;
    FOOmin-width: 0;
    background-color: #fbd094;
}
.tonalPicker-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;
    gap: 0.5em;
}
.spanTonal_modes, 
.spanTonal_chords {
    font-size: 70%;
    padding: 0.4em;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tonalPicker button {
    flex: 0 0 auto;
}
ul.tonalMode-list {
    margin: 0;
    padding: 0;
    list-style: none;
    white-space: normal; /* allow normal wrapping in the list */
}
ul.tonalMode-list li {
    border: 1px dotted gray;
    margin: 0;
    margin-left: 1em;
    padding: 0.3em;
    line-height: 1.2;
    white-space: nowrap; /* prevent wrapping and ignore template whitespace */
}
ul.tonalMode-list li a {
    white-space: nowrap; /* also ensure link text doesn't wrap */
    display: inline-block; /* optional, for more control */
}
ul.tonalMode-list li:nth-child(odd) {
    background-color: #89f9ff;
}

ul.tonalMode-list li:nth-child(even) {
    background-color: #fff42b;
}
.TonalPickerAllChords span:nth-child(odd) {
     background-color: #fe9054;
}
.TonalPickerAllChords span:nth-child(even) {
    background-color: #e9fe45;
}

.spanTonal_chords_all {
    background-color: #acfe75;
    margin-left: 0.2em;
}
`;

const TONAL_PICKER_STYLE_ID = "tonalPicker";

function registerCSS(){
    let jHeadElement = $('head');
    // Check if a style tag with this id already exists
    if (jHeadElement.find('style#'+TONAL_PICKER_STYLE_ID).length === 0) {
        let jStyle = $("<style>");
        jStyle.attr("id", TONAL_PICKER_STYLE_ID);
        jStyle.text(CSS_TEXT);
        jHeadElement.append(jStyle);
    }
}

// dest is either "mode" or "chord".
export function buildTonalPicker(ownerID, sectionIdx, dest, valueArray, currentValue){
    currentValue = currentValue || "&lt;choose&gt;";
    registerCSS();
    let linksList = valueArray
        .map(val => `<li><a href="javascript:pickTonal('${ownerID}', ${sectionIdx}, '${dest}', '${val}');">${val}</a></li>`);
    linksList.push(`<li><a href="javascript:pickTonal('${ownerID}', ${sectionIdx}, '${dest}', 'clear');">&lt;clear&gt;</a></li>`);
    linksList = linksList.join('\n');

    let allChordsList = "";
    let allChordsArray = [];
    if (dest === "chords"){
        let strike = "";
        allChordsArray.push("<span class='TonalPickerAllChords'>");
        valueArray.forEach(val => {
            console.log(`val:${val}, currentValue:${currentValue},`);
            val = (val === currentValue) ? `<b>${val}</b>` : val;
            allChordsArray.push(`<span>${val}</span>`);
        })
        allChordsArray.push("</span>");
        allChordsList = allChordsArray.join("&nbsp;");    
    }

    return `
    <span class="tonalPicker" id="tonalPicker-${ownerID}-${dest}-${sectionIdx}">
        <span class="tonalPicker-row">
            <span class="spanTonal_chords_all">${allChordsList}</span>
            <span class="spanTonal_${dest}">${currentValue}</span>
            <button onclick="$('#tonalMode-list-${ownerID}-${dest}-${sectionIdx}').toggle()">${dest}</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-${ownerID}-${dest}-${sectionIdx}" style="display:none;">
            ${linksList}
        </ul>
    </span>
    `;
}

export const TonalPickerOrientation = Object.freeze({
    VERTICAL: "vertical", 
    HORIZONTAL: "horizontal"
});

/** 
 *  @param orientation is one of TonalPickerOrientation.VERTICAL or TonalPickerOrientation.HORIZONTAL .
 *  @param ownerID is a string to differntiate multiple picker sets on one page, it is not used to find the owner. 
 */
export function buildTonalPickerSet(ownerID, orientation, sectionIdx, chordValueArray, chardChordCurrentValue, modeValueArray, modeCurrentValue){
    let chordPicker = buildTonalPicker(ownerID, sectionIdx, "chords", chordValueArray, chardChordCurrentValue)                                         
    let modePicker =  buildTonalPicker(ownerID, sectionIdx, "modes",  modeValueArray,  modeCurrentValue);
    
    let tbl;
    if  (orientation === TonalPickerOrientation.HORIZONTAL){
        tbl = `<table class='TonalPickerHoriz'><tr><td>${chordPicker}</td><td>${modePicker}</td></tr></table>`;
    } else {
        tbl = `<table class='TonalPickerVert'><tr><td>${chordPicker}</td></tr><tr><td>${modePicker}</td></tr></table>`;
    }
    return tbl;
}

window.pickTonal = function pickTonal(ownerID, sectionIdx, dest, val){
    //$(`#tonalPicker-${ownerID}-${dest}-${sectionIdx} > span.spanTonalMode`).text(val);
    $(`#tonalPicker-${ownerID}-${dest}-${sectionIdx} > ul`).hide();
    if (val === 'clear'){
        val = "";
    }
    switch (dest) {
        case "chords":
            $(`span.spanTonal_${dest}`).text(val);
            linkToSectionChartChord(sectionIdx, val);
            break;
        case "modes":
            $(`span.spanTonal_${dest}`).text(val);
            linkToSectionChartMode(sectionIdx, val);
            break;
    }
}