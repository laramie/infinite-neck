import { 
    linkToSectionChartChord,
    linkToSectionChartMode
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
    padding: 0.1em;
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
    padding: 0;
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

export function format_allChordsButton(ownerID, tableID, sectionIdx, dest){
    if (dest === "chords"){
        let style = "style='padding:0;font-size:60%;'"
        let btn = `<button ${style} onclick="toggleAllChordsButtonState('${ownerID}', '${tableID}', '${sectionIdx}');">&#x2505;</button>`;
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


// dest is either "mode" or "chord".
export function buildTonalPicker(ownerID, tableID, sectionIdx, dest, valueArray, currentValue){
    if (!currentValue){
        currentValue = "&lt;choose&gt;";
    } else {
         if (valueArray.includes(currentValue)) {
            currentValue = '<b>' + currentValue + '</b>';
        } else {
            currentValue = '<s>' + currentValue + '</s>';
        }
    }
    registerCSS();
    let valueArrayString = JSON.stringify(valueArray);
    let linksList = valueArray
        .map(val => `<li><a href='javascript:pickTonal("${ownerID}", "${tableID}", ${sectionIdx}, "${dest}", "${val}", ${valueArrayString});'>${val}</a></li>`);
    linksList.push(`<li><a href='javascript:pickTonal("${ownerID}",  "${tableID}", ${sectionIdx}, "${dest}", "clear", ${valueArrayString});'>&lt;clear&gt;</a></li>`);
    linksList = linksList.join('\n');

    let allChordsHTML =   format_allChordsSpan  (ownerID, tableID, sectionIdx, dest, valueArray, currentValue);
    let allChordsButton = format_allChordsButton(ownerID, tableID, sectionIdx, dest);

    return `
    <span class="tonalPicker" id="tonalPicker-${ownerID}-${dest}-${tableID}-${sectionIdx}">
        <span class="tonalPicker-row">
            ${allChordsButton}${allChordsHTML}
            <span class="spanTonal_${dest}" id="spanTonal_${ownerID}-${dest}-${tableID}-${sectionIdx}">${currentValue}</span>
            <button onclick="$('#tonalMode-list-${ownerID}-${dest}-${tableID}-${sectionIdx}').toggle()">${dest}:${valueArray.length}</button>
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
export function buildTonalPickerSet(ownerID, orientation, tableID, sectionIdx, chordValueArray, chardChordCurrentValue, modeValueArray, modeCurrentValue){
    let chordPicker = buildTonalPicker(ownerID, tableID, sectionIdx, "chords", chordValueArray, chardChordCurrentValue)                                         
    let modePicker =  buildTonalPicker(ownerID, tableID, sectionIdx, "modes",  modeValueArray,  modeCurrentValue);
    
    let tbl;
    if  (orientation === TonalPickerOrientation.HORIZONTAL){
        tbl = `<table class='TonalPickerHoriz'><tr><td>${chordPicker}</td><td>${modePicker}</td></tr></table>`;
    } else {
        tbl = `<table class='TonalPickerVert'><tr><td>${chordPicker}</td></tr><tr><td>${modePicker}</td></tr></table>`;
    }
    return tbl;
}

window.pickTonal = function pickTonal(ownerID, tableID, sectionIdx, dest, val, valueArray){
    //$(`#tonalPicker-${ownerID}-${dest}-${sectionIdx} > span.spanTonalMode`).text(val);
    $(`#tonalPicker-${ownerID}-${dest}-${tableID}-${sectionIdx} > ul`).hide();
    if (val === 'clear'){
        val = "";
    }
    let valHTML;
    if (!val) {
        valHTML = '&lt;choose&gt;';
    } else {
        if (valueArray.includes(val)) {
            valHTML = '<b>' + val + '</b>';
        } else {
            valHTML = '<s>' + val + '</s>';
        }
    }
     $(`#spanTonal_${ownerID}-${dest}-${tableID}-${sectionIdx}`).html(valHTML); 
    switch (dest) {
        case "chords":
            linkToSectionChartChord(sectionIdx, val);
            let allChords = format_allChords(dest, valueArray, val);
            $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).html(allChords);
            break;
        case "modes":
            linkToSectionChartMode(sectionIdx, val);
            break;
    }
}

window.toggleAllChordsButtonState = function(ownerID, tableID, sectionIdx){
    console.log("toggleAllChordsButtonState:"+JSON.stringify(window.tonalChordsButtonStates));
    let state = window.getTonalAllChordsButtonState(tableID);
    if (state === "show"){
        $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).hide();
        setTonalAllChordsButtonState(tableID, "hide");
        console.log("toggleAllChordsButtonState:hide");
    } else if (state === "hide"){
        $(`#spanTonal_chords_all-${ownerID}-${tableID}-${sectionIdx}`).show();
        setTonalAllChordsButtonState(tableID, "show");
        console.log("toggleAllChordsButtonState:show");
    }
}

/** @param state === "show" | "hide" */
window.setTonalAllChordsButtonState = function(tableID, state){
    if (!window.tonalChordsButtonStates){
        window.tonalChordsButtonStates = {};
    }
    window.tonalChordsButtonStates[tableID] = state;
}

window.getTonalAllChordsButtonState = function(tableID){
    if (!window.tonalChordsButtonStates){
        return "show";
    }
    let oneState = window.tonalChordsButtonStates[tableID];
    if (!oneState){
        return "show";
    }
    return oneState;
}