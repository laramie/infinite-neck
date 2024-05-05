var gMenuFile =    {
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
          "caption": "<b>;</b>&nbsp;dialog",
          "trigger": ";",
          "action": "showDialog-song"
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
            }
          ]
        },
        {
          "caption": "<b>l</b>ist<small>[$currentFrameCardinal/$frameCount]</small>",
          "trigger": "l",
          "vars": [
            "currentFrameCardinal",
            "frameCount"
          ],
          "children": [
            {
              "caption": "<b>d</b>elete",
              "trigger": "d",
              "children": [
                {
                  "caption": "<b>Y</b>es: DELETE section $currentFrameCardinal/$frameCount !",
                  "trigger": "Y",
                  "action": "sectionDelete",
                  "vars": [
                    "currentFrameCardinal",
                    "frameCount"
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
            },
            {
              "caption": "<b>p</b>rint",
              "trigger": "p",
              "action": "printSections"
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
          "caption": "<b>b</b>eats<small>[$currentBeat/$beats]</small>",
          "trigger": "b",
          "vars": [
            "currentBeat",
            "beats"
          ],
          "children": [
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
              "caption": "<b>a</b>dd",
              "trigger": "a",
              "action": "addBeat"
            },
            {
              "caption": "<b>d</b>elete",
              "trigger": "d",
              "action": "deleteBeat"
            },
            {
              "caption": "<b>i</b>nsert first",
              "trigger": "i",
              "action": "moveBeatsLater"
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
          "caption": "<b>h</b>ide",
          "trigger": "h",
          "children": [
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
              "caption": "<b>h</b>ide",
              "trigger": "h",
              "action": "hideViewMessages"
            }
          ]
        },
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
              "caption": "<b>t</b>all",
              "trigger": "t"
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
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
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
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
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
                      "caption": "<b>1</b>&nbsp;fret",
                      "trigger": "1",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
                      "caption": "<b>2</b>&nbsp;frets",
                      "trigger": "2",
                      "action": "selectBendType",
                      "popOnBang": true
                    },
                    {
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
          "trigger": "r"
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
          "caption": "<b>s</b>ection<small>[$currentFrameCardinal/$frameCount]</small>",
          "vars": [
            "currentFrameCardinal",
            "frameCount"
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
            }
          ]
        },
        {
          "caption": "<b>b</b>eats<small>[$currentBeat/$beats]</small>",
          "trigger": "b",
          "vars": [
            "currentBeat",
            "beats"
          ],
          "children": [
            {
              "caption": "<b>n</b>ext",
              "trigger": "n",
              "action": "nextBeat"
            },
            {
              "caption": "<b>p</b>rev",
              "trigger": "p",
              "action": "prevBeat"
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


var gMenuPointer = gMenuFile;
var gCurrentMenuStack = [];


function setMenuAtRoot(){
    gMenuPointer = gMenuFile;
    gCurrentMenuStack = [gMenuPointer];
}

function diveMenu(menu, childIdx){
    menu.parent = gMenuPointer;
    gMenuPointer = menu;
    gCurrentMenuStack.push(menu);
}
function peekParentMenu(){
    var parentMenu = gCurrentMenuStack[gCurrentMenuStack.length-2];
    if (parentMenu){
        return parentMenu;
    }
    return null;
}
function surfaceOneMenu(){
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

function buildChildMenuCaptionsRow(menu){
    var children = menu.children;
    if (!children){
        return "";
    }
    var result = "";


    var totalCaption = "";
    for (var childIdx in children){
        totalCaption += children[childIdx].caption;
    }
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

    for (var childIdx in children){
        var child = children[childIdx];
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
    }
    const exit = "e<b>x</b>it";
    if (vert){
         result = "<td>"+result+"<br>"+exit+"</td>";
     } else {
         result = result+"<td width='100%'>"+exit+"</td>";
     }
    return result;
}

function printMenuStack(){
    var result = "";
    var defaultValue = "";
    var doLargeItem = false;
    if (gMenuPointer.type && gMenuPointer.type == "input"){
        doLargeItem = true;
        defaultValue = "["+getValue(gMenuPointer.default)+"]";
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
    for (var k in gCurrentMenuStack){
        caption = gCurrentMenuStack[k].caption;
        if (kmax == k){
            result = result + "<br><span class='cmdPrompt'>"+caption+":</span>";
        } else {
            result = result + "<br>"+caption;
        }
    }
    return result;
}

function printMenuStackBreadcrumbs(addedCrumb){
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
    for (var k in gCurrentMenuStack){
        var s = gCurrentMenuStack[k].trigger;
        if (!s){
            s = "</b>["+gCurrentMenuStack[k].caption+"]<b>";
        }
        result = result + ""+s;
    }
    return result+"</b>";
}
function printMenuStackBreadcrumbCaptions(sep){
    var result = "";
    for (var k in gCurrentMenuStack){
        var theSep = (k<=1) ? "" : sep;
        result = result + theSep + gCurrentMenuStack[k].caption;
    }
    return result;
}

function dumpMenus(){
    var menu = gMenuFile;
    var result = showChildMenusRecursively(menu, 0);
    //l("result:"+result);
    return result;
}

function showChildMenusRecursively(menu, level){
    level++;
    var indent = "";
    for(var i=0;i<level;i++){indent=indent+'----';}
    var result = indent+menu.caption+":>";
    //l(""+level+":menu.caption:"+menu.caption);
    var children = menu.children;
    for (var childIdx in children){
        var child = children[childIdx];
        var childrenMenus = showChildMenusRecursively(child, level);
        result = result+"<br>"+childrenMenus;
        //l(""+level+":children::"+childrenMenus);
    }
    return result;
}

function hasNoChildMenus(menu){
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
    //   "caption": "<b>Y</b>es: DELETE section $currentFrameIndex/$frameCount !"
    //   "vars": ["currentFrameIndex","frameCount"]
    var caption = menuItem.caption;
    var vars = menuItem.vars;
    if (vars && caption){
        for (idx in vars){
            var str = vars[idx];
            var strValue = getValue(str);
            if ((strValue != undefined) && (""+strValue).length>0){
                caption = caption.replaceAll("$"+str, ""+strValue);
            }
        }
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
