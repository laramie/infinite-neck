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
}
.tonalPicker-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    white-space: nowrap;
    gap: 0.5em;
}
.spanTonalMode {
    font-size: 80%;
    padding: 0.4em;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.tonalPicker button {
    font-size: 60%;
    flex: 0 0 auto;
}
ul.tonalMode-list {
    margin: 0;
    padding: 0;
    list-style: none;
    white-space: normal; /* allow normal wrapping in the list */
}
ul.tonalMode-list li {
    margin: 0;
    padding: 0;
    line-height: 1.2;
    font-size: 70%;
    white-space: nowrap; /* prevent wrapping and ignore template whitespace */
}
ul.tonalMode-list li a {
    white-space: nowrap; /* also ensure link text doesn't wrap */
    display: inline-block; /* optional, for more control */
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
export function buildTonalPicker(sectionIdx, dest, valueArray, currentValue){
    currentValue = currentValue || "&lt;choose&gt;";
    registerCSS();
    let linksList = valueArray.map(val => 
        `<li><a href="javascript:pickTonal(${sectionIdx}, '${dest}', '${val}');">${val}</a></li>`
    ).join('\n');

    return `
    <span class="tonalPicker" id="tonalPicker-${dest}-${sectionIdx}">
        <span class="tonalPicker-row">
            <span class="spanTonalMode" id="spanTonalMode-${dest}-${sectionIdx}">${currentValue}</span>
            <button onclick="$('#tonalMode-list-${dest}-${sectionIdx}').show()">modes</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-${dest}-${sectionIdx}" style="display:none;">
            ${linksList}
        </ul>
    </span>
    `;
}

window.pickTonal = function pickTonal(sectionIdx, dest, val){
    $(`#tonalPicker-${dest}-${sectionIdx} > span.spanTonalMode`).text(val);
    $(`#tonalPicker-${dest}-${sectionIdx} > ul`).hide();
    switch (dest) {
        case "chord":
            linkToSectionChartChord(sectionIdx, val);
            break;
        case "mode":
            linkToSectionChartMode(sectionIdx, val);
            break;
    }
}