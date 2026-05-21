import { 
    linkToSectionChartChord,
    linkToSectionChartMode,
    linkToSectionTableChord,
    linkToSectionTableMode,
    linkToSectionChangedTonal
} from './infinite-neck.js';

const CSS_TEXT = `
.spanTonalDetails,
.TonalPickerHoriz,
.captionRowTonalInfo {
    padding: 0;
    margin: 0;
}
.tonalPicker {
    font-size: 70%;
    display: block;
    margin:0;
    padding: 0;
    white-space: normal;
    border: 1px solid green;
    background-color: #fbd094;
}
.tonalPicker-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;
    gap: 0.5em;
    padding: 0.4em;
}
.spanTonal_modes, 
.spanTonal_chords {
    padding: 0.01em;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.spanTonal_modes{
    padding-left: 0.4em;
}

.tonalPicker button {
    flex: 0 0 auto;
    padding-top: 0.3em;
    padding-bottom: 0.3em;
    padding-left: 0.4em;
    padding-right: 0.4em;
    border-radius: 1px;
    border: 1px solid gray;
    box-shadow: 2px 1px 4px black;
    transition: all 0.1s ease;
    
}
.tonalPicker button:active {
    flex: 0 0 auto;
    box-shadow: 2px 1px 3px rgb(31, 62, 0);
    transform: translateY(3px); /* Move the button down slightly */
}
.tonalPicker button.AllChordsBtn {
    padding-top: 0;padding-bottom: 0;font-size:120%;padding-left: 0.4em;padding-right: 0.4em;
}
.tonalPicker button.AllModesBtn {
    padding-top: 0;padding-bottom: 0;font-size:120%;padding-left: 0.4em;padding-right: 0.4em;
}
.tonalPicker button.SaveToChartBtn {
    padding-top: 0;padding-bottom: 0;font-size:120%;padding-left: 0.4em;padding-right: 0.4em;
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
    background-color: #09e7f3;
}


.TonalPickerAllChords {
   
}
    
.TonalPickerAllChords span:nth-child(odd) {
    border: 1px solid black;
    background-color: #fe9054;
    padding-left: 0.4em;
    padding-right: 0.4em;
}
.TonalPickerAllChords span:nth-child(even) {
    border: 1px solid black;
    background-color: #fd6765;
    padding-right: 0.4em;
    padding-left: 0.4em;
}
.TonalPickerAllChords span.selectedChord {
    border: 1px solid black;
    background-color: #e9fe45;
    padding-right: 0.4em;
    padding-left: 0.4em;
    font-weight: bold;
}

.TonalPickerAllModes {
   
}
    
.TonalPickerAllModes span:nth-child(odd) {
    border: 1px solid black;
    background-color: #fe9054;
    padding-left: 0.4em;
    padding-right: 0.4em;
}
.TonalPickerAllModes span:nth-child(even) {
    border: 1px solid black;
    background-color: #fd6765;
    padding-right: 0.4em;
    padding-left: 0.4em;
}
.TonalPickerAllModes span.selectedMode {
    border: 1px solid black;
    background-color: #e9fe45;
    padding-right: 0.4em;
    padding-left: 0.4em;
    font-weight: bold;
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


function format_saveToChartButton(ownerID, tableID, sectionIdx, dest){
    return `<button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('${ownerID}', '${tableID}', ${sectionIdx}, '${dest}')">&#x56F3;</button>`;  //&#x56F3; Kanji means "Map, Drawing, Plan, Diagram, Picture, Illustration", which we use to mean "Chart".
}
export function format_allChordsButton(ownerID, tableID, sectionIdx, dest){
    if (dest === "chords"){
        let btn = `<button class="AllChordsBtn" title="Possible chords" onclick="toggleAllChordsButtonState('${ownerID}', '${tableID}', '${sectionIdx}');">&#x53EF;</button>`;   // &#x53EF; mean "possible,feasable,good", pronounced kě. was &#x2505;
        return btn;
    }
    return "";
}
export function format_allModesButton(ownerID, tableID, sectionIdx, dest){
    if (dest === "modes"){
        let btn = `<button class="AllModesBtn" title="Possible modes" onclick="toggleAllModesButtonState('${ownerID}', '${tableID}', '${sectionIdx}');">&#x53EF;</button>`;   // &#x53EF; mean "possible,feasable,good", pronounced kě. was &#x2505;
        return btn;
    }
    return "";
}
export function format_allChordsSpan(ownerID, tableID, sectionIdx, dest, valueArray, currentValue){
    let allChordsHTML = "";
    if (dest === "chords"){
        let state = getTonalAllChordsButtonState(tableID);
        let style = "";
        if (state === "hide"){
            style = "style='display:none;'";
        } else {
            style = "style='display:inline;'";
        }
        let allChordsList = format_allChords(dest, valueArray, currentValue);
        //TODO: add class for spanTonal_chords_all-${ownerID}-${tableID} so you can turn off all in /spn for that column of table.
        allChordsHTML = `<span ${style} class="spanTonal_chords_all" id="spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}">${allChordsList}</span>`;
    }
    return allChordsHTML;

}
export function format_allModesSpan(ownerID, tableID, sectionIdx, dest, valueArray, currentValue){
    let allModesHTML = "";
    if (dest === "modes"){
        let state = getTonalAllModesButtonState(tableID);
        let style = "";
        if (state === "hide"){
            style = "style='display:none;'";
        } else {
            style = "style='display:inline;'";
        }
        let allModesList = format_allModes(dest, valueArray, currentValue);
        //TODO: add class for spanTonal_modes_all-${ownerID}-${tableID} so you can turn off all in /spn for that column of table.
        allModesHTML = `<span ${style} class="spanTonal_modes_all" id="spanTonal_modes_all-${ownerID}-${tableID}-${sectionIdx}">${allModesList}</span>`;
    }
    return allModesHTML;

}
export function format_allChords(dest, valueArray, currentValue){
    let allChordsList = "";
    if (dest === "chords"){
        let allChordsArray = [];
        allChordsArray.push("<span class='TonalPickerAllChords'>");
        valueArray.forEach(val => {
            let span;
            if (val === currentValue) {
                span = `<span class="selectedChord">${val}</span>`;
            } else { 
                span =  `<span>${val}</span>`;
            }
            allChordsArray.push(span);
        })
        allChordsArray.push("</span>");
        allChordsList = allChordsArray.join("");   
    }
    return allChordsList;
}
export function format_allModes(dest, valueArray, currentValue){
    let allModesList = "";
    if (dest === "modes"){
        let allModesArray = [];
        allModesArray.push("<span class='TonalPickerAllModes'>");
        valueArray.forEach(val => {
            let span;
            if (val === currentValue) {
                span = `<span class="selectedMode">${val}</span>`;
            } else { 
                span =  `<span>${val}</span>`;
            }
            allModesArray.push(span);
        })
        allModesArray.push("</span>");
        allModesList = allModesArray.join("");   
    }
    return allModesList;
}

function formatTonalCurrentValue(chartCurrentValue, tableCurrentValue){
    if (!tableCurrentValue){
        return "&lt;choose&gt;";
    }
    if (!chartCurrentValue){
        return tableCurrentValue;
    }
    if (tableCurrentValue === chartCurrentValue){
        return '<b>' + tableCurrentValue + '</b>';
    }
    return '<s>' + tableCurrentValue + '</s>';
}


function getSpanTonalSelector(ownerID, tableID, sectionIdx, dest){
    return `#spanTonal_${ownerID}-${dest}-${tableID}-${sectionIdx}`;
}

function getCurrentTonalRawValue(ownerID, tableID, sectionIdx, dest){
    return $(getSpanTonalSelector(ownerID, tableID, sectionIdx, dest)).attr('data-tonal-raw-value') || "";
}


// dest is either "mode" or "chord".
export function buildTonalPicker(ownerID, tableID, sectionIdx, dest, valueArray, chartCurrentValue, tableCurrentValue){
    registerCSS();
    let valueArrayString = JSON.stringify(valueArray);
    let chartCurrentValueString = JSON.stringify(chartCurrentValue || "");
    let displayCurrentValue = formatTonalCurrentValue(chartCurrentValue, tableCurrentValue);
    let rawCurrentValue = tableCurrentValue || "";
    let linksList = valueArray
        .map(val => `<li><a href='javascript:pickTonal("${ownerID}", "${tableID}", ${sectionIdx}, "${dest}", ${JSON.stringify(val)}, ${valueArrayString}, ${chartCurrentValueString});'>${val}</a></li>`);
    linksList.push(`<li><a href='javascript:pickTonal("${ownerID}",  "${tableID}", ${sectionIdx}, "${dest}", "clear", ${valueArrayString}, ${chartCurrentValueString});'>&lt;clear&gt;</a></li>`);
    linksList = linksList.join('\n');

    let allChordsHTML =   format_allChordsSpan  (ownerID, tableID, sectionIdx, dest, valueArray, rawCurrentValue);
    let allChordsButton = format_allChordsButton(ownerID, tableID, sectionIdx, dest);
    let allModesHTML =    format_allModesSpan   (ownerID, tableID, sectionIdx, dest, valueArray, rawCurrentValue);
    let allModesButton =  format_allModesButton (ownerID, tableID, sectionIdx, dest);
    let saveToChartButton = format_saveToChartButton(ownerID, tableID, sectionIdx, dest);

    return `
    <span class="tonalPicker" id="tonalPicker-${ownerID}-${dest}-${tableID}-${sectionIdx}">
        <span class="tonalPicker-row">
            ${allChordsButton}${allChordsHTML}${allModesButton}${allModesHTML}
            <span class="spanTonal_${dest}" id="spanTonal_${ownerID}-${dest}-${tableID}-${sectionIdx}" data-tonal-raw-value="${rawCurrentValue}">${displayCurrentValue}</span>
            <button onclick="$('#tonalMode-list-${ownerID}-${dest}-${tableID}-${sectionIdx}').toggle()">${dest}:${valueArray.length}</button>${saveToChartButton}
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-${ownerID}-${dest}-${tableID}-${sectionIdx}" style="display:none;">
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
export function buildTonalPickerSet(ownerID, orientation, tableID, sectionIdx, chordValueArray, chardChordCurrentValue, modeValueArray, modeCurrentValue, tableChordCurrentValue, tableModeCurrentValue){
    let chordPicker = buildTonalPicker(ownerID, tableID, sectionIdx, "chords", chordValueArray, chardChordCurrentValue, tableChordCurrentValue)                                         
    let modePicker =  buildTonalPicker(ownerID, tableID, sectionIdx, "modes",  modeValueArray,  modeCurrentValue, tableModeCurrentValue);
    
    let tbl;
    if  (orientation === TonalPickerOrientation.HORIZONTAL){
        tbl = `<table class='TonalPickerHoriz'><tr><td>${chordPicker}</td><td>${modePicker}</td></tr></table>`;
    } else {
        tbl = `<table class='TonalPickerVert'><tr><td>${chordPicker}</td></tr><tr><td>${modePicker}</td></tr></table>`;
    }
    return tbl;
}

globalThis.pickTonal = function pickTonal(ownerID, tableID, sectionIdx, dest, val, valueArray, chartCurrentValue){
    //$(`#tonalPicker-${ownerID}-${dest}-${sectionIdx} > span.spanTonalMode`).text(val);
    $(`#tonalPicker-${ownerID}-${dest}-${tableID}-${sectionIdx} > ul`).hide();
    if (val === 'clear'){
        val = "";
    }
    let nextChartCurrentValue = chartCurrentValue;
    switch (dest) {
        case "chords":
            linkToSectionTableChord(sectionIdx, tableID, val, false);
            if (!chartCurrentValue){
                linkToSectionChartChord(sectionIdx, val, false);
                nextChartCurrentValue = val;
            }
            $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).html(format_allChords(dest, valueArray, val));
            break;
        case "modes":
            linkToSectionTableMode(sectionIdx, tableID, val, false);
            if (!chartCurrentValue){
                linkToSectionChartMode(sectionIdx, val, false);
                nextChartCurrentValue = val;
            }
            $(`#spanTonal_modes_all-${ownerID}-${tableID}-${sectionIdx}`).html(format_allModes(dest, valueArray, val));
            break;
    }
    $(getSpanTonalSelector(ownerID, tableID, sectionIdx, dest))
        .attr('data-tonal-raw-value', val)
        .html(formatTonalCurrentValue(nextChartCurrentValue, val));
    linkToSectionChangedTonal();
}

globalThis.saveTonalToChart = function saveTonalToChart(ownerID, tableID, sectionIdx, dest){
    let rawValue = getCurrentTonalRawValue(ownerID, tableID, sectionIdx, dest);
    switch (dest) {
        case "chords":
            linkToSectionChartChord(sectionIdx, rawValue);
            break;
        case "modes":
            linkToSectionChartMode(sectionIdx, rawValue);
            break;
    }
}

globalThis.toggleAllChordsButtonState = function(ownerID, tableID, sectionIdx){
    //console.log("toggleAllChordsButtonState:"+JSON.stringify(globalThis.tonalChordsButtonStates));
    let state = globalThis.getTonalAllChordsButtonState(tableID);
    if (state === "show"){
        $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).hide();
        setTonalAllChordsButtonState(tableID, "hide");
        //console.log("toggleAllChordsButtonState:hide");
    } else if (state === "hide"){
        $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).show();
        setTonalAllChordsButtonState(tableID, "show");
        //console.log("toggleAllChordsButtonState:show");
    }
}

globalThis.toggleAllModesButtonState = function(ownerID, tableID, sectionIdx){
    //console.log("toggleAllModesButtonState:"+JSON.stringify(globalThis.tonalModesButtonStates));
    let state = globalThis.getTonalAllModesButtonState(tableID);
    if (state === "show"){
        $(`#spanTonal_modes_all-${ownerID}-${tableID}-${sectionIdx}`).hide();
        setTonalAllModesButtonState(tableID, "hide");
        //console.log("toggleAllModesButtonState:hide");
    } else if (state === "hide"){
        $(`#spanTonal_modes_all-${ownerID}-${tableID}-${sectionIdx}`).show();
        setTonalAllModesButtonState(tableID, "show");
        //console.log("toggleAllModesButtonState:show");
    }
}

/** @param state === "show" | "hide" */
globalThis.setTonalAllChordsButtonState = function(tableID, state){
    if (!globalThis.tonalChordsButtonStates){
        globalThis.tonalChordsButtonStates = {};
    }
    globalThis.tonalChordsButtonStates[tableID] = state;
}

globalThis.getTonalAllChordsButtonState = function(tableID){
    if (!globalThis.tonalChordsButtonStates){
        return "show";
    }
    let oneState = globalThis.tonalChordsButtonStates[tableID];
    if (!oneState){
        return "show";
    }
    return oneState;
}

/** @param state === "show" | "hide" */
globalThis.setTonalAllModesButtonState = function(tableID, state){
    if (!globalThis.tonalModesButtonStates){
        globalThis.tonalModesButtonStates = {};
    }
    globalThis.tonalModesButtonStates[tableID] = state;
}

globalThis.getTonalAllModesButtonState = function(tableID){
    if (!globalThis.tonalModesButtonStates){
        return "show";
    }
    let oneState = globalThis.tonalModesButtonStates[tableID];
    if (!oneState){
        return "show";
    }
    return oneState;
}