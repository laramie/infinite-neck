let gMenuValueResolver = function () {
  return undefined;
};

export function setMenuValueResolver(resolverFn) {
  if (typeof resolverFn === 'function') {
    gMenuValueResolver = resolverFn;
  }
}

export function resolveMenuValue(value) {
    if (value === undefined || value === null) {
        return "";
    }

    const resolved = gMenuValueResolver(value);
    if (resolved === undefined || resolved === null) {
        return "" + value;
    }

    return "" + resolved;
}

export var gMenuFile =    {
  "name": "root",
  "parent": null,
  "tall": true,
  "caption": "<b>/</b>",
  "trigger": "/",
  "children": [
    {
      "caption": "<b>f</b>ile",
      "trigger": "f",
      "children": [
        {
          "caption": "<b>o</b>pen",
          "trigger": "o",
          "action": "setupOpenFile"
        },
        {
          "caption": "<b>d</b>ownload",
          "trigger": "d",
          "action": "downloadPlayedNotes"
        },
        {
          "caption": "<b>i</b>nfo",
          "trigger": "i",
          "action": "showDialog-info"
        },
        {
          "name": "name",
          "caption": "<b>n</b>ame",
          "trigger": "n",
          "action": "setSongName",
          "input": {
            "type": "input",
            "caption": "(string)",
            "default": "getSongName",
            "datatype": "string",
            "id": "name"
          }
        },
        {
          "name": "bpm",
          "caption": "<b>b</b>pm",
          "trigger": "b",
          "action": "setBPM",
          "input": {
            "type": "input",
            "caption": "1-240",
            "default": "getBPM",
            "datatype": "int",
            "id": "bpm"
          }
        },
        {
          "caption": "<b>g</b>raveyard",
          "trigger": "g",
          "action": "showGraveyard"
        },
        {
          "caption": "<b>m</b>ap spacebar",
          "trigger": "m",
          "children": [
            {
              "caption": "current: [${spacebarActionName}]",
              "vars": [
                    "spacebarActionName"
              ]
            },
            {
              "caption": "<b>R</b>estart song",
              "trigger": "R",
              "action": "mapSpacebar_restartSong"
            },
            {
              "caption": "<b>r</b>estart section",
              "trigger": "r",
              "action": "mapSpacebar_gotoFirstBeat"
            },
            {
              "caption": "<b>z</b> reset song",
              "trigger": "z",
              "action": "mapSpacebar_resetSong"
            },
            {
              "caption": "<b>Z</b> reset song hard",
              "trigger": "Z",
              "action": "mapSpacebar_resetSongHard"
            },
            {
              "caption": "<b>u</b>nset spacebar",
              "trigger": "u",
              "action": "mapSpacebar_unsetSpacebarAction"
            },
            {
              "caption": "<b>s</b>ection",
              "trigger": "s",
              "children": [
                {
                  "caption": "<b>s</b>ection loop",
                  "trigger": "s",
                  "action": "mapSpacebar_toggleLoopSections"
                },
                {
                  "caption": "<b>f</b>irst",
                  "trigger": "f",
                  "action": "mapSpacebar_firstSection"
                },
                {
                  "caption": "<b>p</b>rev",
                  "trigger": "p",
                  "action": "mapSpacebar_prevSection"
                },
                {
                  "caption": "<b>n</b>ext",
                  "trigger": "n",
                  "action": "mapSpacebar_nextSection"
                },
                {
                  "caption": "<b>l</b>ast",
                  "trigger": "l",
                  "action": "mapSpacebar_lastSection"
                },
                {
                  "caption": "<b>L</b>ast beat in song",
                  "trigger": "L",
                  "action": "mapSpacebar_gotoLastBeatInSong"
                }
              ]
            },
            {
              "caption": "<b>b</b>eats",
              "trigger": "b",
              "children": [
                {
                  "caption": "<b>b</b>eat loop",
                  "trigger": "b",
                  "action": "mapSpacebar_toggleLoopBeats"
                },
                {
                  "caption": "<b>f</b>irst",
                  "trigger": "f",
                  "action": "mapSpacebar_gotoFirstBeat"
                },
                {
                  "caption": "<b>p</b>rev",
                  "trigger": "p",
                  "action": "mapSpacebar_prevBeat"
                },
                {
                  "caption": "<b>n</b>ext",
                  "trigger": "n",
                  "action": "mapSpacebar_nextBeat"
                },
                {
                  "caption": "<b>l</b>ast",
                  "trigger": "l",
                  "action": "mapSpacebar_gotoLastBeat"
                }
              ]
            }
          ]
        },
        {
          "caption": "<b>C</b>lear graveyard, with backup",
          "trigger": "C",
          "children": [
                {
                  "caption": "<b>Y</b>es: CLEAR ${graveyardRecordCount} graveyard records !",
                  "trigger": "Y",
                  "action": "downloadBackupThenClearGraveyard",
                  "vars": [
                    "graveyardRecordCount"
                  ],
                  "popOnBang": true
                },
                {
                  "caption": "<b>n</b>o: keep graveyard.",
                  "trigger": "n",
                  "action": "noAction",
                  "popOnBang": true
                }
              ]
        },
        {
          "name": "lock",
          "caption": "<b>l</b>ock",
          "trigger": "l",
          "action": "lock",
        },
        {
          "name": "unlock",
          "caption": "<b>u</b>nlock",
          "trigger": "u",
          "action": "unlock",
        },
        {
          "name": "version",
          "caption": "<b>v</b>ersion info",
          "trigger": "v",
          "action": "version",
        },
        {
          "name": "versionMore",
          "caption": "<b>V</b>ersion as Show Message",
          "trigger": "V",
          "action": "versionMore",
        },
        {
          "caption": "<b>a</b>dvanced",
          "trigger": "a",
          "children": [
            {
              "name": "transposeSong",
              "caption": "<b>t</b>ransposeSong",
              "trigger": "t",
              "action": "transposeSong",
              "input": {
                "type": "input",
                "caption": "-12...12",
                "default": "0",
                "datatype": "int",
                "id": "transposeSong"
              }
          },
          {
              "name": "transposeSongKeys",
              "caption": "transpose song <b>k</b>eys",
              "trigger": "k",
              "action": "transposeSongKeys",
              "input": {
                "type": "input",
                "caption": "-12...12",
                "default": "0",
                "datatype": "int",
                "id": "transposeSongKeys"
              }
          }
          ]
        },
        {
          "name": "pluginsRuntime",
          "runtimeChildren": "pluginManager",
          "caption": "<b>p</b>lugins",
          "trigger": "p"
        },
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-song"
        }
      ]
    },
    {
    "caption": "<b>c</b>hart",
    "trigger": "c",
    "children": [
        {
          "caption": "<b>s</b>ummary",
          "trigger": "s",
          "action": "printSectionsSummary"
        },
        {
          "caption": "<b>n</b>otes",
          "trigger": "n",
          "action": "printSectionsNotes"
        },
        {
          "caption": "<b>d</b>etails",
          "trigger": "d",
          "action": "printSectionsDetails"
        }            
      ]
    },
    {
      "caption": "<b>s</b>ection",
      "trigger": "s",
      "children": [
        {
          "caption": "<b>a</b>dd",
          "trigger": "a",
          "action": "sectionAdd"
        },
        {
          "caption": "<b>n</b>av",
          "trigger": "n",
          "children": [
            {
              "caption": "<b>f</b>irst",
              "trigger": "f",
              "action": "firstSection"
            },
            {
              "caption": "<b>p</b>rev",
              "trigger": "p",
              "action": "prevSection"
            },
            {
              "caption": "<b>n</b>ext",
              "trigger": "n",
              "action": "nextSection"
            },
            {
              "caption": "<b>l</b>ast",
              "trigger": "l",
              "action": "lastSection"
            },
            {
              "caption": "<b>g</b>oto",
              "trigger": "g",
              "action": "gotoSection",
              "input": {
                "type": "input",
                "caption": "n+1",
                "default": "currentSectionCardinal",
                "datatype": "int",
                "id": "sectionNumber"
              }
            }
          ]
        },
        {
          "caption": "<b>e</b>dit<small>[${currentSectionCardinal}/${sectionCount}]</small>",
          "trigger": "e",
          "vars": [
            "currentSectionCardinal",
            "sectionCount"
          ],
          "children": [
            {
              "caption": "<b>d</b>elete",
              "trigger": "d",
              "children": [
                {
                  "caption": "<b>Y</b>es: DELETE section ${currentSectionCardinal}/${sectionCount} !",
                  "trigger": "Y",
                  "action": "sectionDelete",
                  "vars": [
                    "currentSectionCardinal",
                    "sectionCount"
                  ],
                  "popOnBang": true
                },
                {
                  "caption": "<b>n</b>o: keep section.",
                  "trigger": "n",
                  "action": "sectionKeep",
                  "popOnBang": true
                }
              ]
            },
            {
              "caption": "<b>a</b>dd",
              "trigger": "a",
              "action": "sectionAdd"
            },
            {
              "caption": "<b>s</b>hallow clone",
              "trigger": "s",
              "action": "sectionAddShallowClone"
            },
            {
              "caption": "<b>c</b>lone",
              "trigger": "c",
              "action": "sectionAddDeepClone"
            }
          ]
        },
        {
          "name": "caption",
          "caption": "<b>c</b>aption",
          "trigger": "c",
          "action": "setSectionCaption",
          "input": {
            "type": "input",
            "caption": "(string)",
            "default": "getSectionCaption",
            "datatype": "string",
            "id": "caption"
          }
        },


        {
          "caption": "<b>s</b>harps",
          "trigger": "s",
          "action": "setSectionSharps"
        },
        {
          "caption": "<b>f</b>lats",
          "trigger": "f",
          "action": "setSectionFlats"
        },






        {
          "name": "key",
          "caption": "<b>k</b>ey",
          "trigger": "k",
          "children": [
            {
            "caption": "<b>w</b>hite keys",
            "trigger": "w",
            "children": [
              {
              "caption": "<b>a</b>",
              "trigger": "a",
              "action": "setSectionKeyWhite"        
              },
              {
              "caption": "<b>b</b>",
              "trigger": "b",
              "action": "setSectionKeyWhite"
              },
              {
              "caption": "<b>c</b>",
              "trigger": "c",
              "action": "setSectionKeyWhite"
              },
              {
              "caption": "<b>d</b>",
              "trigger": "d",
              "action": "setSectionKeyWhite"
              },
              {
              "caption": "<b>e</b>",
              "trigger": "e",
              "action": "setSectionKeyWhite"
              },
              {
              "caption": "<b>f</b>",
              "trigger": "f",
              "action": "setSectionKeyWhite"
              },
              {
              "caption": "<b>g</b>",
              "trigger": "g",
              "action": "setSectionKeyWhite"
              }
            ]
            },
            {
            "caption": "<b>b</b>lack keys",
            "trigger": "b",
            "children": [
              {
              "caption": "<b>a</b>&flat;",
              "trigger": "a",
              "action": "setSectionKeyBlack"    
              },
              {
              "caption": "<b>b</b>&flat;",
              "trigger": "b",
              "action": "setSectionKeyBlack"
              },
              {
              "caption": "<b>d</b>&flat;",
              "trigger": "d",
              "action": "setSectionKeyBlack"
              },
              {
              "caption": "<b>e</b>&flat;",
              "trigger": "e",
              "action": "setSectionKeyBlack"
              },
              {
              "caption": "<b>g</b>&flat;",
              "trigger": "g",
              "action": "setSectionKeyBlack"
              }
            ]
            }


          ] 
        },
        {
          "name": "leadkey",
          "caption": "<b>l</b>eadKey",
          "trigger": "l",
          "children": [
            {
            "caption": "<b>w</b>hite keys",
            "trigger": "w",
            "children": [
              {
              "caption": "<b>a</b>",
              "trigger": "a",
              "action": "setSectionLeadKeyWhite"        
              },
              {
              "caption": "<b>b</b>",
              "trigger": "b",
              "action": "setSectionLeadKeyWhite"
              },
              {
              "caption": "<b>c</b>",
              "trigger": "c",
              "action": "setSectionLeadKeyWhite"
              },
              {
              "caption": "<b>d</b>",
              "trigger": "d",
              "action": "setSectionLeadKeyWhite"
              },
              {
              "caption": "<b>e</b>",
              "trigger": "e",
              "action": "setSectionLeadKeyWhite"
              },
              {
              "caption": "<b>f</b>",
              "trigger": "f",
              "action": "setSectionLeadKeyWhite"
              },
              {
              "caption": "<b>g</b>",
              "trigger": "g",
              "action": "setSectionLeadKeyWhite"
              }
            ]
            },
            {
            "caption": "<b>b</b>lack keys",
            "trigger": "b",
            "children": [
              {
              "caption": "<b>a</b>&flat;",
              "trigger": "a",
              "action": "setSectionLeadKeyBlack"    
              },
              {
              "caption": "<b>b</b>&flat;",
              "trigger": "b",
              "action": "setSectionLeadKeyBlack"
              },
              {
              "caption": "<b>d</b>&flat;",
              "trigger": "d",
              "action": "setSectionLeadKeyBlack"
              },
              {
              "caption": "<b>e</b>&flat;",
              "trigger": "e",
              "action": "setSectionLeadKeyBlack"
              },
              {
              "caption": "<b>g</b>&flat;",
              "trigger": "g",
              "action": "setSectionLeadKeyBlack"
              }
            ]
            }


          ] 
        },


        {
          "caption": "<b>b</b>eats<small>[${currentBeat}/${beats}]</small>",
          "trigger": "b",
          "vars": [
            "currentBeat",
            "beats"
          ],
          "children": [
            {
              "caption": "<b>f</b>irst",
              "trigger": "f",
              "action": "gotoFirstBeat"
            },
            {
              "caption": "<b>n</b>ext",
              "trigger": "n",
              "action": "nextBeat"
            },
            {
              "caption": "<b>p</b>rev",
              "trigger": "p",
              "action": "prevBeat"
            },
            {
              "caption": "<b>a</b>dd (last)",
              "trigger": "a",
              "action": "addBeat"
            },
            {
              "caption": "<b>l</b>ast",
              "trigger": "l",
              "action": "gotoLastBeat"
            },
            {
              "caption": "<b>g</b>oto",
              "trigger": "g",
              "action": "gotoBeat",
              "input": {
                "type": "input",
                "caption": "n+1",
                "default": "currentBeat",
                "datatype": "int",
                "id": "beatNumber"
              }
            },
            {
              "caption": "<b>d</b>elete",
              "trigger": "d",
              "action": "deleteBeat"
            },
            {
              "caption": "insert <b>0</b> first",
              "trigger": "0",
              "action": "insertFirstBeat"
            },
            {
              "caption": "<b>i</b>nsert beat",
              "trigger": "i",
              "action": "insertBeat"
            }
          ]
        },
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-section"
        }
      ]
    },
    {
      "caption": "<b>v</b>iew",
      "trigger": "v",
      "children": [
        {
          "caption": "<b>m</b>enu prefs",
          "trigger": "m",
          "action": "setMenuPrefs",
          "children": [
            {
              "caption": "<b>s</b>hort",
              "trigger": "s"
            },
            {
              "caption": "<b>o</b>ne-line",
              "trigger": "o"
            },
            {
              "caption": "<b>t</b>all",
              "trigger": "t"
            }
          ]
        },
        {
          "caption": "<b>h</b>ide",
          "trigger": "h",
          "children": [
            {
              "caption": "<b>a</b>ll note names",
              "trigger": "a",
              "action": "hideAllNoteNames"
            },
            {
              "caption": "<b>n</b>amedNotes",
              "trigger": "n",
              "action": "hideNamedNotes"
            },
            {
              "caption": "<b>s</b>ingleNotes",
              "trigger": "s",
              "action": "hideSingleNotes"
            },
            {
              "caption": "<b>t</b>inyNotes",
              "trigger": "t",
              "action": "hideTinyNotes"
            },
            {
              "caption": "<b>f</b>ingering",
              "trigger": "f",
              "action": "hideFingering"
            }
          ]
        },
        {
          "caption": "<b>s</b>how",
          "trigger": "s",
          "children": [
            {
              "caption": "<b>a</b>ll note names",
              "trigger": "a",
              "action": "showAllNoteNames"
            },
            {
              "caption": "<b>n</b>amedNotes",
              "trigger": "n",
              "action": "showNamedNotes"
            },
            {
              "caption": "<b>s</b>ingleNotes",
              "trigger": "s",
              "action": "showSingleNotes"
            },
            {
              "caption": "<b>t</b>inyNotes",
              "trigger": "t",
              "action": "showTinyNotes"
            },
            {
              "caption": "<b>f</b>ingering",
              "trigger": "f",
              "action": "showFingering"
            }
          ]
        },
        {
          "caption": "<b>o</b>pacity",
          "trigger": "o",
          "children": [
            {
              "name": "namedNoteOpacity",
              "caption": "<b>n</b>amed note",
              "trigger": "n",
              "action": "setNamedNoteOpacity",
              "input": {
                "type": "input",
                "caption": "0-100",
                "default": "getNamedNoteOpacity",
                "datatype": "int",
                "id": "namedNoteOpacity"
              }
            },
            {
              "name": "singleNoteOpacity",
              "caption": "<b>s</b>ingle note",
              "trigger": "s",
              "action": "setSingleNoteOpacity",
              "input": {
                "type": "input",
                "caption": "0-100",
                "default": "getSingleNoteOpacity",
                "datatype": "int",
                "id": "singleNoteOpacity"
              }
            },
            {
              "name": "tinyNoteOpacity",
              "caption": "<b>t</b>iny note",
              "trigger": "t",
              "action": "setTinyNoteOpacity",
              "input": {
                "type": "input",
                "caption": "0-100",
                "default": "getTinyNoteOpacity",
                "datatype": "int",
                "id": "tinyNoteOpacity"
              }
            }
          ]
        },
        {
          "caption": "<b>d</b>iagnostics",
          "trigger": "d",
          "children": [
            {
              "caption": "<b>e</b>vent log to console",
              "trigger": "e",
              "action": "showViewDiagnosticsLogEvents",
              "input": {
                "type": "input",
                "caption": "JSON",
                "default": "{\"stack\":false, \"data\":false, \"filter\":[\"DaCapo\", \"Looper\"]}",
                "datatype": "string",
                "id": "eventLogToConsoleOptions"
              },
              "popOnBang": true 
            },
            {
              "caption": "song <b>f</b>ile format",
              "trigger": "f",
              "action": "showViewDiagnosticsSongFileFormat"
            },
            {
              "caption": "<b>s</b>ong model",
              "trigger": "s",
              "action": "showViewDiagnosticsFullModel"
            },
            {
              "caption": "<b>i</b>n-memory model",
              "trigger": "i",
              "action": "showViewDiagnostics"
            },
            {
              "caption": "<b>m</b>enu dump",
              "trigger": "m",
              "action": "showViewDiagnosticsMenu"
            },
            {
              "caption": "menu <b>j</b>son",
              "trigger": "j",
              "action": "showViewDiagnosticsMenuJson"
            },
            {
              "caption": "user <b>c</b>olors",
              "trigger": "c",
              "action": "showViewDiagnosticsUserColorDict"
            },
            {
              "caption": "<b>d</b>isplayOptions",
              "trigger": "d",
              "action": "showViewDiagnosticsDisplayOptions"
            },
            {
              "caption": "<b>v</b>ariables",
              "trigger": "v",
              "action": "showViewDiagnosticsVariables"
            },
            {
              "caption": "<b>h</b>ide",
              "trigger": "h",
              "action": "hideViewMessages"
            }
          ]
        },
        {
          "caption": "<b>f</b>ullscreen",
          "trigger": "f",
          "action": "viewFullscreen"
        },
        {
          "caption": "<b>t</b>oggle fullscreen",
          "trigger": "t",
          "action": "toggleFullscreen"
        },
        {
          "caption": "<b>w</b>indow",
          "trigger": "w",
          "children": [
            {
              "caption": "<b>c</b>leanup",
              "trigger": "c",
              "action": "disposeAllDockables"
            },
            {
              "caption": "<b>d</b>ock all",
              "trigger": "d",
              "action": "dockAllDockables"
            },
            {
              "caption": "<b>g</b>ather",
              "trigger": "g",
              "action": "gatherAllDockables"
            },
            {
              "caption": "<b>v</b>iewport",
              "trigger": "v",
              "action": "clampAllDockablesToViewport"
            },
            {
              "caption": "<b>p</b>ark transport",
              "trigger": "p",
              "action": "parkTransport"
            }
          ]
        },
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-view"
        }
      ]
    },
    {
      "caption": "th<b>e</b>mes",
      "trigger": "e",
      "children": [
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-themes"
        }
      ]
    },
    {
      "caption": "<b>t</b>unings",
      "trigger": "t",
      "children": [
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-tunings"
        }
      ]
    },
    {
      "caption": "f<b>i</b>ll",
      "trigger": "i",
      "children": [
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-fill"
        }
      ]
    },
    {
      "caption": "<b>p</b>alette",
      "trigger": "p",
      "children": [
        {
          "caption": "<b>n</b>ote",
          "trigger": "n",
          "action": "selectRadioNoteType",
          "children": [
            {
              "caption": "<b>n</b>amed",
              "trigger": "n"
            },
            {
              "caption": "<b>s</b>ingle",
              "trigger": "s"
            },
            {
              "caption": "<b>t</b>iny",
              "trigger": "t"
            },
            {
              "caption": "<b>b</b>end",
              "trigger": "b",
              "children": [
                {
                  "caption": "<b>s</b>emitone",
                  "trigger": "s",
                  "children": [
                    {
                      "name": "semitone1",
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "semitone2",
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "semitone3",
                      "caption": "<b>3</b>&nbsp;frets",
                      "trigger": "3",
                      "action": "selectBendType",
                      "popOnBang": true
                    }
                  ]
                },
                {
                  "caption": "<b>p</b>rebend",
                  "trigger": "p",
                  "children": [
                    {
                      "name": "prebend1",
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "prebend2",
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "prebend3",
                      "caption": "<b>3</b>&nbsp;frets",
                      "trigger": "3",
                      "action": "selectBendType",
                      "popOnBang": true
                    }
                  ]
                },
                {
                  "caption": "<b>u</b>p-down",
                  "trigger": "u",
                  "children": [
                    {
                      "name": "updown1",
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "updown2",
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "name": "updown3",
                      "caption": "<b>3</b>&nbsp;frets",
                      "trigger": "3",
                      "action": "selectBendType",
                      "popOnBang": true
                    }
                  ]
                }
              ]
            },
            {
              "caption": "<b>p</b>itch",
              "trigger": "p"
            },
            {
              "caption": "<b>h</b>ighlight",
              "trigger": "h"
            },
            {
              "caption": "<b>k</b>eep",
              "trigger": "k"
            },
            {
              "caption": "<b>c</b>lear",
              "trigger": "c"
            },
            {
              "caption": "<b>f</b>ind color",
              "trigger": "f"
            }
          ]
        },
        {
          "caption": "<b>f</b>ingering",
          "trigger": "f",
          "action": "selectFingering",
          "children": [
            {
              "caption": "<b>o</b>",
              "trigger": "o"
            },
            {
              "caption": "<b>1</b>",
              "trigger": "1"
            },
            {
              "caption": "<b>2</b>",
              "trigger": "2"
            },
            {
              "caption": "<b>3</b>",
              "trigger": "3"
            },
            {
              "caption": "<b>4</b>",
              "trigger": "4"
            },
            {
              "caption": "<b>5</b>",
              "trigger": "5"
            },
            {
              "caption": "<b>t</b>humb",
              "trigger": "t"
            }
          ]
        },
        {
          "caption": "<b>r</b>ole",
          "trigger": "r",
          "action": "selectRole",
          "children": [
            {
              "caption": "<b>t</b>ransparent",
              "trigger": "t"
            },
            {
              "caption": "<b>a</b>utomatic",
              "trigger": "a"
            },
            {
              "caption": "<b>s</b>cale",
              "trigger": "s"
            },
            {
              "caption": "<b>r</b>oot",
              "trigger": "r"
            },
            {
              "caption": "<b>c</b>hord",
              "trigger": "c",
              "action": "selectRoleChord",
              "children": [
                {
                  "caption": "<b>1</b> - Chord",
                  "trigger": "1"
                },
                {
                  "caption": "<b>2</b> - Ch2",
                  "trigger": "2"
                },
                {
                  "caption": "<b>3</b> - Ch3",
                  "trigger": "3"
                }
              ]
            },
            {
              "caption": "c<b>h</b>romatic",
              "trigger": "h"
            },
            {
              "caption": "<b>p</b>assing",
              "trigger": "p"
            },
            {
              "caption": "c<b>o</b>lornote",
              "trigger": "o",
              "action": "selectRoleColornote",
              "children": [
                {
                  "caption": "<b>1</b> - Colornote",
                  "trigger": "1"
                },
                {
                  "caption": "<b>2</b> - C2",
                  "trigger": "2"
                },
                {
                  "caption": "<b>3</b> - C3",
                  "trigger": "3"
                }
              ]
            },
            {
              "caption": "a<b>v</b>oid",
              "trigger": "v",
              "action": "selectRoleAvoid",
              "children": [
                {
                  "caption": "<b>1</b> - Avoid",
                  "trigger": "1"
                },
                {
                  "caption": "<b>2</b> - Avoid",
                  "trigger": "2"
                },
                {
                  "caption": "<b>3</b> - Avoid",
                  "trigger": "3"
                }
              ]
            },
            {
              "caption": "<b>b</b>ass",
              "trigger": "b"
            },
            {
              "caption": "<b>l</b>ead",
              "trigger": "l",
              "action": "selectRoleLead",
              "children": [
                {
                  "caption": "<b>1</b> - Lead",
                  "trigger": "1"
                },
                {
                  "caption": "<b>2</b> - Lead 2",
                  "trigger": "2"
                }
              ]
            }
          ]
        },
        {
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-palette"
        }
      ]
    },
    {
      "caption": "<b>r</b>un",
      "trigger": "r",
      "children": [
        {
          "caption": "<b>t</b>oggle transport",
          "trigger": "t",
          "action": "toggleTransport"
        },
        {
          "caption": "<b>p</b>ark transport",
          "trigger": "p",
          "action": "parkTransport"
        },
        {
          "caption": "<b>P</b>ark transport top right",
          "trigger": "P",
          "action": "parkTransportTopRight"
        },
        {
          "caption": "<b>l</b>oop",
          "trigger": "l",
          "action": "toggleLoopSections"
        },
        {
          "caption": "loop b<b>e</b>ats",
          "trigger": "e",
          "action": "toggleLoopBeats"
        },
        {
          "caption": "<b>r</b>ec",
          "trigger": "r",
          "action": "toggleRecording"
        },
        {
          "caption": "r<b>a</b>ndom loop",
          "trigger": "a",
          "action": "toggleRandomLoop"
        },
        {
          "caption": "<b>s</b>ection<small>[${currentSectionCardinal}/${sectionCount}]</small>",
          "vars": [
            "currentSectionCardinal",
            "sectionCount"
          ],
          "trigger": "s",
          "children": [
            {
              "caption": "<b>f</b>irst",
              "trigger": "f",
              "action": "firstSection"
            },
            {
              "caption": "<b>p</b>rev",
              "trigger": "p",
              "action": "prevSection"
            },
            {
              "caption": "<b>n</b>ext",
              "trigger": "n",
              "action": "nextSection"
            },
            {
              "caption": "<b>l</b>ast",
              "trigger": "l",
              "action": "lastSection"
            },
            {
              "caption": "<b>L</b>ast beat in song",
              "trigger": "L",
              "action": "gotoLastBeatInSong"
            },
            {
              "caption": "<b>0</b> restart song",
              "trigger": "0",
              "action": "firstSection"
            },
            {
              "caption": "<b>r</b>eset song",
              "trigger": "r",
              "action": "resetSong"
            },
            {
              "caption": "<b>R</b>eset song hard",
              "trigger": "R",
              "action": "resetSongHard"
            },
            {
              "caption": "<b>g</b>oto",
              "trigger": "g",
              "action": "gotoSection",
              "input": {
                "type": "input",
                "caption": "n+1",
                "default": "currentSectionCardinal",
                "datatype": "int",
                "id": "sectionNumber"
              }
            }
          ]
        },
        {
          "caption": "<b>b</b>eats<small>[${currentBeat}/${beats}]</small>",
          "trigger": "b",
          "vars": [
            "currentBeat",
            "beats"
          ],
          "children": [
            {
              "caption": "<b>f</b>irst",
              "trigger": "f",
              "action": "gotoFirstBeat"
            },
            {
              "caption": "<b>n</b>ext",
              "trigger": "n",
              "action": "nextBeat"
            },
            {
              "caption": "<b>p</b>rev",
              "trigger": "p",
              "action": "prevBeat"
            },
            {
              "caption": "<b>l</b>ast",
              "trigger": "l",
              "action": "gotoLastBeat"
            },
            {
              "caption": "<b>g</b>oto",
              "trigger": "g",
              "action": "gotoBeat",
              "input": {
                "type": "input",
                "caption": "n+1",
                "default": "currentBeat",
                "datatype": "int",
                "id": "beatNumber"
              }
            }
          ]
        }
      ]
    },
    {
      "caption": "<b>h</b>elp",
      "trigger": "h",
      "action": "showHelp"
    }
  ]
}
/*******Comments in JSON frowned upon, so they are here.
  "popOnBang": true
  *** "NOTE": "this item will be popped up two menus
        to the one that asked the original question,
        not the Y/n confirmation, so the performCmdAction sets actionResult.popOnBang."
  *****/

export const gMenuLoaded = JSON.stringify(gMenuFile, null, 4);

export var gMenuPointer = gMenuFile;
var gCurrentMenuStack = [];


export function setMenuAtRoot(){
    gMenuPointer = gMenuFile;
    gCurrentMenuStack = [gMenuPointer];
}

export function diveMenu(menu, childIdx){
    menu.parent = gMenuPointer;
    gMenuPointer = menu;
    gCurrentMenuStack.push(menu);
}
export function peekParentMenu(){
    var parentMenu = gCurrentMenuStack[gCurrentMenuStack.length-2];
    if (parentMenu){
        return parentMenu;
    }
    return null;
}
export function surfaceOneMenu(){
    var parent = gMenuPointer.parent;
    if (parent){
        gMenuPointer = parent;
        //l("surfacing to new menu:"+gMenuPointer.caption);
        return;
    }

    var pointer = gCurrentMenuStack.pop();
    if (pointer){
        gMenuPointer = pointer;
    } else {
        gMenuPointer = gMenuFile;
    }
}

export function buildChildMenuCaptionsRow(menu){
    var children = menu.children;
    if (!children){
        return "";
    }
    var result = "";


    var totalCaption = "";
      children.forEach(child => {
        totalCaption += child.caption;
      });
    var vert = true;
    if (totalCaption.length < 70){  //if total number of characters is small, it is a list of small items.
        vert = false;
    } else if (children.length > 4) { // 4 menu items: horizontal; 5 items: vertical
        vert = true;
    }
    if (gMenuFile.tall == false){
        vert = false;
    } else if (gMenuFile.tall == true) {
        vert = true;
    }

      children.forEach(child => {
        var bang = "";
        if (child && child.bang && child.bang == true){
          bang = "!&nbsp;";
        }
        var theCaption = expandCaption(child);
        if (vert){
          result = result+bang+theCaption+"<br />";
        } else {
          result = result+"<td>"+bang+theCaption+"</td>";
        }
      });
    const exit = "e<b>x</b>it";
    if (vert){
         result = "<td>"+result+"<br>"+exit+"</td>";
     } else {
         result = result+"<td width='100%'>"+exit+"</td>";
     }
    return result;
}

export function printMenuStack(){
    var result = "";
    var defaultValue = "";
    var doLargeItem = false;
    if (gMenuPointer.type && gMenuPointer.type == "input"){
        doLargeItem = true;
      defaultValue = "["+gMenuValueResolver(gMenuPointer.default)+"]";
    }
    var menuCaption = expandCaption(gMenuPointer);
    result = "<div class='cmdPrompt'>"+menuCaption+defaultValue+":</div>";
    var parent = gMenuPointer.parent;
    while(parent){
        if (doLargeItem){
            result = "<div class='cmdPrompt2'>"+expandCaption(parent)+"::</div>"+result;
            doLargeItem = false;
        } else {
            result = "<br>"+expandCaption(parent)+""+result;
        }
        parent = parent.parent;
    }
    return result;
}

function printMenuStackByStackWalk(){
    var result = "";
    var kmax = gCurrentMenuStack.length-1;
    var caption;
      gCurrentMenuStack.forEach((stackItem, k) => {
        caption = stackItem.caption;
        if (kmax == k){
          result = result + "<br><span class='cmdPrompt'>"+caption+":</span>";
        } else {
          result = result + "<br>"+caption;
        }
      });
    return result;
}

export function printMenuStackBreadcrumbs(addedCrumb){
    function triggerOrCaption(menuPointer){
        var result = "";
        var trigger = menuPointer.trigger;
        if (trigger){
            result = "<b>"+trigger+"</b>";
        } else {
            if (addedCrumb) {
                result = "["+addedCrumb+"]";
            } else {
                result = "["+menuPointer.caption+"]";
            }
        }
        return result;
    }
    var result = triggerOrCaption(gMenuPointer);

    var parent = gMenuPointer.parent;
    while(parent!=null){
        result = triggerOrCaption(parent)+result;
        parent = parent.parent;
    }
    result = result+"</b>";
    //if (addedCrumb) {
    //    result = result + "["+addedCrumb+"]";
    //}
    return result;
}

function printMenuStackBreadcrumbsByStack(){
    var result = "<b>";
    gCurrentMenuStack.forEach(stackItem => {
      var s = stackItem.trigger;
      if (!s){
        s = "</b>["+stackItem.caption+"]<b>";
      }
      result = result + ""+s;
    });
    return result+"</b>";
}
function printMenuStackBreadcrumbCaptions(sep){
    var result = "";
    gCurrentMenuStack.forEach((stackItem, k) => {
      var theSep = (k<=1) ? "" : sep;
      result = result + theSep + stackItem.caption;
    });
    return result;
}

export function dumpMenus(){
    var menu = gMenuFile;
    var result = showChildMenusRecursively(menu, 0);
    return `<pre class="menuDump">${result}</pre>`;
}

function showChildMenusRecursively(menu, level){  
    level++;
    var indent = "";
    for (var i = 0; i < level; i++) {
        //indent += '&nbsp;&nbsp;&nbsp;&nbsp;';
        indent += '  ';
    }
    var result = indent + menu.caption;
    var children = menu.children;
    if (children){
      children.forEach(child => {
        var childrenMenus = showChildMenusRecursively(child, level);
        result = result + "\n" + childrenMenus;
      });
    }
    return result;
}

export function hasNoChildMenus(menu){
	var noChildren = true;
	if (menu.children){
		noChildren = false;
	}
	if (menu.children && menu.children.length == 0){
		noChildren = true;
	}
	return noChildren;
}

function expandCaption(menuItem){
    //   "caption": "<b>Y</b>es: DELETE section ${currentSectionIndex}/${sectionCount} !"
    //   "vars": ["currentSectionIndex","sectionCount"]
    var caption = menuItem.caption;
    var vars = menuItem.vars;
    if (vars && caption){
      vars.forEach(str => {
        var strValue = gMenuValueResolver(str);
        if (strValue != undefined){
          caption = caption.replaceAll("${"+str+"}", ""+strValue);
        }
      });
    }
    return caption;
}



/** DESIGN NOTES

    menu: file, song,
        file:
            open: clicks file-open button.
            download: clicks file-download button.
        song:
            Bpm -- sets the BPM to the number typed [menu input]
            Name -- sets name to the text typed [menu input]
            ! Options -- show options as bang menu
            -> Options -- show submenu
        -! section:
            -- show section&nbsp;dialog
        -! tuning:
            -- show tunings table
        -! palette:
            -- show palette

        bang: true -- or lack of child elements, but will just do the action and not display any more menus.

menuModel = JSON.parse("menu.json");


function displayCmdMenu(pointer)
    from the current pointer, show its menu items.
    when an option is clicked that is ->, follow the pointer to the new menu item obj and ask for its menu.

function eatWord() :: kicked off by single-letter mode, or inputing text/number mode, or some other grammar/symbol stop.
  -- eats the input, performs the action, clears the txtCmdLine, updates the full, running command and the breadcrumbs.

displayCurrMenu ==> dumps the words, and the big letter of each menu, in a walk back up the menu to root.

    ESC - just hides the menu, but your place is preserved
    x   - eXits the menu one layer
    /   - brings up the menu, either brings you to the root, or two // brings you to the rootID

    **/
