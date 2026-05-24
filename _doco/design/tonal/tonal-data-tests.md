```
 "sections": [
    {
      "sectionNotesByTable": {
        "tblP46_1": {
          "namedNotes": {
            "C": {
              "noteName": "C",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "E": {
              "noteName": "E",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "G": {
              "noteName": "G",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            }
          },
          "recordedNotes": {},
          "chord": "",
          "mode": "",
          "playedNotes": []
        }
      },
      "caption": "",
      "chartChord": "",
      "chartMode": "",
      "rootID": "3",
      "rootIDLead": "-1",
      "beats": 4,
      "currentBeat": 1,
      "sharps": false
    }
  ]
```
Tonal.js recommends: 
Chords: `['CM', 'Em#5/C']` 
Modes: `['C major pentatonic','C major','C lydian','C mixolydian']`

Widget Code emitted:

```html
<span class="spanTonalDetails" style="display: inline;"><span id="tblP46_1_captionRowTonalInfo" class="captionRowTonalInfo"><table class="TonalPickerHoriz"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-chords-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllChordsBtn" title="Possible chords" onclick="toggleAllChordsButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_chords_all" id="spanTonal_chords_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllChords"><span>CM</span><span>Em#5/C</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_CaptionRowTonal-chords-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-chords-tblP46_1-0').toggle()">chords:2</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'chords')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-chords-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;CM&quot;, [&quot;CM&quot;,&quot;Em#5/C&quot;], &quot;&quot;);">CM</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Em#5/C&quot;, [&quot;CM&quot;,&quot;Em#5/C&quot;], &quot;&quot;);">Em#5/C</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;CM&quot;,&quot;Em#5/C&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-modes-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllModesBtn" title="Possible modes" onclick="toggleAllModesButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_modes_all" id="spanTonal_modes_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllModes"><span>C major pentatonic</span><span>C major</span><span>C lydian</span><span>C mixolydian</span></span></span>
            <span class="spanTonal_modes" id="spanTonal_CaptionRowTonal-modes-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-modes-tblP46_1-0').toggle()">modes:4</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'modes')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-modes-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C major pentatonic&quot;, [&quot;C major pentatonic&quot;,&quot;C major&quot;,&quot;C lydian&quot;,&quot;C mixolydian&quot;], &quot;&quot;);">C major pentatonic</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C major&quot;, [&quot;C major pentatonic&quot;,&quot;C major&quot;,&quot;C lydian&quot;,&quot;C mixolydian&quot;], &quot;&quot;);">C major</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C lydian&quot;, [&quot;C major pentatonic&quot;,&quot;C major&quot;,&quot;C lydian&quot;,&quot;C mixolydian&quot;], &quot;&quot;);">C lydian</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C mixolydian&quot;, [&quot;C major pentatonic&quot;,&quot;C major&quot;,&quot;C lydian&quot;,&quot;C mixolydian&quot;], &quot;&quot;);">C mixolydian</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C major pentatonic&quot;,&quot;C major&quot;,&quot;C lydian&quot;,&quot;C mixolydian&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table></span></span>

```

Here is another note set, adds one NamedNote, which limits the chords and modes from Tonal.js

```
"sections": [
    {
      "sectionNotesByTable": {
        "tblP46_1": {
          "namedNotes": {
            "C": {
              "noteName": "C",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "E": {
              "noteName": "E",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "G": {
              "noteName": "G",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "B": {
              "noteName": "B",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            }
          },
          "recordedNotes": {},
          "chord": "",
          "mode": "",
          "playedNotes": []
        }
      },
      "caption": "",
      "chartChord": "",
      "chartMode": "",
      "rootID": "3",
      "rootIDLead": "-1",
      "beats": 4,
      "currentBeat": 1,
      "sharps": false
    }
  ]
  ```

  Then Tonal.js recommends: 
  Chords: `['Cmaj7']
  Modes: `['C major','C lydian']

  Then widgets emitted: 
  ```
  <span class="spanTonalDetails" style="display: inline;"><span id="tblP46_1_captionRowTonalInfo" class="captionRowTonalInfo"><table class="TonalPickerHoriz"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-chords-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllChordsBtn" title="Possible chords" onclick="toggleAllChordsButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_chords_all" id="spanTonal_chords_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllChords"><span>Cmaj7</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_CaptionRowTonal-chords-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-chords-tblP46_1-0').toggle()">chords:1</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'chords')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-chords-tblP46_1-0" style="">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Cmaj7&quot;, [&quot;Cmaj7&quot;], &quot;&quot;);">Cmaj7</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;Cmaj7&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-modes-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllModesBtn" title="Possible modes" onclick="toggleAllModesButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_modes_all" id="spanTonal_modes_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllModes"><span>C major</span><span>C lydian</span></span></span>
            <span class="spanTonal_modes" id="spanTonal_CaptionRowTonal-modes-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-modes-tblP46_1-0').toggle()">modes:2</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'modes')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-modes-tblP46_1-0" style="">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C major&quot;, [&quot;C major&quot;,&quot;C lydian&quot;], &quot;&quot;);">C major</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C lydian&quot;, [&quot;C major&quot;,&quot;C lydian&quot;], &quot;&quot;);">C lydian</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C major&quot;,&quot;C lydian&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table></span></span>
```

Here is the set [C, D, Eb, F, G, Bb]
```
"sections": [
    {
      "sectionNotesByTable": {
        "tblP46_1": {
          "namedNotes": {
            "C": {
              "noteName": "C",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "D": {
              "noteName": "D",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "Eb": {
              "noteName": "Eb",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "F": {
              "noteName": "F",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "G": {
              "noteName": "G",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            },
            "Bb": {
              "noteName": "Bb",
              "styleNum": 0,
              "colorClass": "noteTransparent"
            }
          },
          "recordedNotes": {},
          "chord": "",
          "mode": "",
          "playedNotes": []
        }
      },
      "caption": "",
      "chartChord": "",
      "chartMode": "",
      "rootID": "3",
      "rootIDLead": "-1",
      "beats": 4,
      "currentBeat": 1,
      "sharps": false
    }
  ]
```
Tonal.js recommends: 
Chords: `['Cm11','Ebmaj13/C','EbM7add13/C','F13sus4/C']`

Modes:  `[C minor', 'C dorian']`

Widgets emitted: 
```
<span class="spanTonalDetails" style="display: inline;"><span id="tblP46_1_captionRowTonalInfo" class="captionRowTonalInfo"><table class="TonalPickerHoriz"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-chords-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllChordsBtn" title="Possible chords" onclick="toggleAllChordsButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_chords_all" id="spanTonal_chords_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllChords"><span>Cm11</span><span>Ebmaj13/C</span><span>EbM7add13/C</span><span>F13sus4/C</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_CaptionRowTonal-chords-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-chords-tblP46_1-0').toggle()">chords:4</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'chords')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-chords-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Cm11&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">Cm11</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Ebmaj13/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">Ebmaj13/C</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;EbM7add13/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">EbM7add13/C</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;F13sus4/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">F13sus4/C</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td><td>
    <span class="tonalPicker" id="tonalPicker-CaptionRowTonal-modes-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllModesBtn" title="Possible modes" onclick="toggleAllModesButtonState('CaptionRowTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_modes_all" id="spanTonal_modes_all-CaptionRowTonal-tblP46_1-0"><span class="TonalPickerAllModes"><span>C minor</span><span>C dorian</span></span></span>
            <span class="spanTonal_modes" id="spanTonal_CaptionRowTonal-modes-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-CaptionRowTonal-modes-tblP46_1-0').toggle()">modes:2</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('CaptionRowTonal', 'tblP46_1', 0, 'modes')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-CaptionRowTonal-modes-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C minor&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">C minor</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C dorian&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">C dorian</a></li>
<li><a href="javascript:pickTonal(&quot;CaptionRowTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table></span></span>
```

The Chords cell in the Chart "Chart Notes" table is: 
```
<div class="SPN_CC">C,D,Eb,F,G,Bb:<table class="TonalPickerVert"><tbody><tr><td>
    <span class="tonalPicker" id="tonalPicker-SectionPrinterTonal-chords-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllChordsBtn" title="Possible chords" onclick="toggleAllChordsButtonState('SectionPrinterTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_chords_all" id="spanTonal_chords_all-SectionPrinterTonal-tblP46_1-0"><span class="TonalPickerAllChords"><span>Cm11</span><span>Ebmaj13/C</span><span>EbM7add13/C</span><span>F13sus4/C</span></span></span>
            <span class="spanTonal_chords" id="spanTonal_SectionPrinterTonal-chords-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-SectionPrinterTonal-chords-tblP46_1-0').toggle()">chords:4</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('SectionPrinterTonal', 'tblP46_1', 0, 'chords')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-SectionPrinterTonal-chords-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Cm11&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">Cm11</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;Ebmaj13/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">Ebmaj13/C</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;EbM7add13/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">EbM7add13/C</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;F13sus4/C&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">F13sus4/C</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;chords&quot;, &quot;clear&quot;, [&quot;Cm11&quot;,&quot;Ebmaj13/C&quot;,&quot;EbM7add13/C&quot;,&quot;F13sus4/C&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr><tr><td>
    <span class="tonalPicker" id="tonalPicker-SectionPrinterTonal-modes-tblP46_1-0">
        <span class="tonalPicker-row">
            <button class="AllModesBtn" title="Possible modes" onclick="toggleAllModesButtonState('SectionPrinterTonal', 'tblP46_1', '0');">可</button><span style="display:inline;" class="spanTonal_modes_all" id="spanTonal_modes_all-SectionPrinterTonal-tblP46_1-0"><span class="TonalPickerAllModes"><span>C minor</span><span>C dorian</span></span></span>
            <span class="spanTonal_modes" id="spanTonal_SectionPrinterTonal-modes-tblP46_1-0" data-tonal-raw-value="">&lt;choose&gt;</span>
            <button onclick="$('#tonalMode-list-SectionPrinterTonal-modes-tblP46_1-0').toggle()">modes:2</button><button class="SaveToChartBtn" title="Save to chart" onclick="saveTonalToChart('SectionPrinterTonal', 'tblP46_1', 0, 'modes')">図</button>
        </span>
        <ul class="tonalMode-list" id="tonalMode-list-SectionPrinterTonal-modes-tblP46_1-0" style="display:none;">
            <li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C minor&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">C minor</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;, &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;C dorian&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">C dorian</a></li>
<li><a href="javascript:pickTonal(&quot;SectionPrinterTonal&quot;,  &quot;tblP46_1&quot;, 0, &quot;modes&quot;, &quot;clear&quot;, [&quot;C minor&quot;,&quot;C dorian&quot;], &quot;&quot;);">&lt;clear&gt;</a></li>
        </ul>
    </span>
    </td></tr></tbody></table></div>
```
    
  