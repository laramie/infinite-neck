/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

// gNoteNamesArr is defined in infinite-neck.js
const TABLE_ID_PREFIX = "tbl";
const TABLEDIV_ID_PREFIX = "div";

function buildTable(options){
	if (options.visible==false){
		//console.log("NOT building invisible table: "+options.caption);
		return null;
	}
    var midinum;
    var nutClass = "";
    var noteName = "";
    var colDisplay = 0;
    var numRows = options.rowRange.length;

    var table = $('<table>');
    table.attr("border", "0");
    table.attr("cellpadding", "0");
    table.attr("cellspacing", "4");
    table.attr("id", TABLE_ID_PREFIX+options.baseID);
    table.attr("rowRange", '['+options.rowRange.toString()+']');
    table.attr("reversed", options.reverse);
    table.attr("fretTableBuilt", true);
    table.addClass("fretTable");
	if (options.leftmargin){
		table.addClass("leftmarginInstrument");
	}
	var doNamesRow = options.pianoNamesRow;
	var stringDividerHeight = options.stringDividerHeight;
	var doStringDivider = false;
	if (stringDividerHeight && (""+stringDividerHeight) != "0"){
		doStringDivider = true;
	}
    var tuningNoteNames = "";
    for(var r=0; r<numRows; r++){
        tuningNoteNames = midinumToNoteName(options.rowRange[r])+tuningNoteNames;
        var row = $('<tr>');
        row.addClass("stringRow");
		var namesRow = $("<tr>");
		var dividerRow = $("<tr>");
		dividerRow.addClass('stringDividerTR');
        var nCols = options.nut ? options.frets+1 : options.frets;
		var banjoNut = options.banjoNut ? options.banjoNut[r] : undefined;

		for(var c=0; c<nCols; c++){
			var deadCell = false;
			if (banjoNut){
				nutClass = "";
				if (options.reverse){
					if ( c == (nCols-banjoNut-1) ){
						nutClass = "nutR";
					} else if ( c > (nCols-banjoNut-1) ){
						deadCell = true;
					}
				} else {
					if ( c == banjoNut ){
						nutClass = "nut";
					} else if (c < banjoNut){
						deadCell = true;
					}
				}
			} else if ((c==0) && options.nut && !options.reverse){
                nutClass = "nut";
            } else if ((c==options.frets) && options.nut && options.reverse) {
                nutClass = "nutR";
            } else {
                nutClass = "";
            }

            if (options.reverse){
                midinum = options.rowRange[r] + options.frets- c;
                colDisplay = options.frets-c;
            } else {
                midinum = options.rowRange[r] + c;
                colDisplay = c;
            }
            noteName = midinumToNoteName(midinum);
            var noteClass = "note"+noteName;//"noteD";
			var notePinkClass = "";
			if (options.pinkKey && noteName==options.pinkKey){
				notePinkClass = " notePinkKey";
			}
            var tdline = '<td class="note '+ noteClass+notePinkClass +' '+nutClass+'" noteName="'+noteName+'">';
            var cell = $(tdline).html("");
              cell.attr("midiNum", ""+midinum);
	          cell.attr("cellrow", r);
	          cell.attr("cellcol", colDisplay);
	          cell.attr("celltable", TABLE_ID_PREFIX+options.baseID);
			  cell.html(""+noteName);
            if (deadCell){
				cell = $('<td class="note" style="min-width: 1em; background-color: #222;">');
			}
			row.append(cell);
			if (doNamesRow){
				var sHeight = "";
				var namesRowHeight = options.pianoNamesRowHeight;
				if (namesRowHeight){
					sHeight = ' style="height: '+namesRowHeight+'" ';
				}
				var namesTdline = '<td class="namesRowCell" >';
				var colorArea = $('<div class="'+noteClass+'" '+sHeight+' >');
				colorArea.html(noteName);
				var namesCell = $(namesTdline);
				namesCell.append(colorArea);
				namesRow.append(namesCell);
			}
			if (doStringDivider && r>0){
				var dividerCell = $("<td class='stringDividerTD'>");
				dividerRow.append(dividerCell);
			}
        } //end for-loop columns
		if (doStringDivider){
			dividerRow.css({"height": stringDividerHeight});
			table.append(dividerRow);
		}
		if (doNamesRow){
			table.append(namesRow);
		}


        table.append(row);
    } //end for-loop rows

	if(options.diamonds){
        var diamondRow = diamondsRow(options);
        if (diamondRow!=null){
            table.append(diamondRow);
        }
	} else {
		if (doStringDivider){
			dividerRow.css({"height": stringDividerHeight});
			table.append(dividerRow);
		}
	}

    var div = $('<div>');
    div.addClass("instrumentBackground");
    div.attr("id", TABLEDIV_ID_PREFIX+options.baseID);
    var exportButton = "&nbsp;&nbsp;<button class='exportButton' tabindex='-1' onclick='exportFromTable(\""+TABLE_ID_PREFIX+options.baseID+"\")'>Export Highlights</button>";
	var hamburger = "<button id='btnHamburger"+options.baseID+"' class='HamburgerInstrumentClass showsubcaption' type='button' tabindex='-1'>&equiv;</button>";

	var spanLeadDifferentFromRoot = "&nbsp;<span class='spanLeadDifferentFromRoot'></span>";
	var spanRootID = "&nbsp;&nbsp;&nbsp;<span class='lblRootID'></span>";
    var joniTuning = "<span class='joniTuning'><small>Joni:</small>"+getJoniTuning(options)+"</span>";
	var noteClickedCaption = "<span class='lblNoteClickedCaption'></span>";
	var p = $("<p>");
    p.addClass("captionRow");
    var reverse = options.reverse ? '&nbsp;&nbsp;<span class="tuningReverseCaption">Left-Handed</span>' : '';
	var S = "&nbsp;&nbsp;";
    p.html('<b>'+options.caption+'</b>&nbsp;&nbsp;&nbsp;<span class="subcaption">'
	            +options.nStrings+'-string '
				+options.baseInstrument
				+'&nbsp;&nbsp;&nbsp;['+rowRangeToNoteNames(options.rowRange, options)+']'+S
				+joniTuning
				+reverse
				+exportButton+S
				+spanRootID
				+spanLeadDifferentFromRoot+S
				+noteClickedCaption
				+"<span class='currentColorDict'></span>"+S
				+'</span>'
			    +hamburger+S+S
			);
	div.append(p);
    div.append(table);
    return  div;
}

function getJoniTuning(options){
	var len = options.rowRange.length;
	var last = len-1;  //zero-based.
	//First, bottom string:
	var tuningNoteNames = "";
	var firstStringNum = options.rowRange[last];
	if (options.banjoNut && options.banjoNut[last]){
		firstStringNum = firstStringNum + options.banjoNut[last];
	}
	var prevStringNum = firstStringNum;
	for(var r=last; r>=0; r--){
		var currStringNum = options.rowRange[r];
		var semitones = currStringNum - prevStringNum;
		if (r==last){
			tuningNoteNames = midinumToNoteName(firstStringNum);
    	} else {
			var st = (semitones < 0) ? '('+semitones+')' : semitones;
    		tuningNoteNames = tuningNoteNames + st;
    	}
		prevStringNum = currStringNum;
	}
 	var result = '['+tuningNoteNames+']' ;
   	return result;
}

function diamondsRow(options){
        var arr = options.diamonds; //[3,5,7,9,15,17,19,21]
        var dblArr = options.doubleDiamonds; //[12,24];
		if (!dblArr){
			dblArr = [];
		}
        var singleDiamond = "&#9672;";
        var doubleDiamonds = '<table cellpadding="0" cellspacing="0" border="0" width="100%"><tr class="diamondsRow" ><td class="doubleDiamonds">&#9672;</td>'
                             +'</tr><tr><td class="doubleDiamonds">&#9672;</td></tr></table>';
        var diamondRow = $("<tr  class='diamondsRow' >");
        //diamondRow.addClass('diamonds');
        diamondRow.addClass('NotAString');
        var nCols = options.nut ? options.frets+1 : options.frets;
        var dcwn;
        for (var dc = 0; dc<nCols; dc++){
            var td = $('<td>');
			td.addClass('diamonds');
            dcwn = dc;  //short for DiamondColumnWithNut
            if (options.reverse){
                if (options.nut){
                    dcwn = (options.frets-1) - dc;
					if (dc==(nCols-1)) td.addClass("diamondRowSupernut");
                } else {
                    dcwn = options.frets - dc;
                }
            } else {
                if (options.nut){
                    dcwn = dc - 1;
					if (dc==0) td.addClass("diamondRowSupernut");
                } else {
                    dcwn = dc;
                }
            }
            if (dblArr.includes(dcwn+1)){  //user reads JSON file value as 1-based.
                td.html(doubleDiamonds);
            } else if (arr.includes(dcwn+1)){
                td.html(singleDiamond);
            } else {
                td.html("&nbsp;");
            }
            diamondRow.append(td);
        }
        return diamondRow;
}

function midinumToNoteName(midinum){
    if (midinum <=9){
        midinum += 12;
    }
    var index = (midinum - 9) % 12;
    return gNoteNamesArr[index];
  // 21 == A0
  // 9 == A, 8 Ab, 7 G, 6 Gb, 5 F, 4 E, 3 Eb, 2 D, 1 Db, 0 C
}

function rowRangeToNoteNames(rowRange, options){
    var numRows = rowRange.length;
    var tuningNoteNames = "";
    for(var r=0; r<numRows; r++){
		var midi = rowRange[r];
		if (options.banjoNut && options.banjoNut[r]){
			var nCols = options.nut ? options.frets+1 : options.frets;
			var banjoNut = options.banjoNut[r];
			midi += banjoNut;
		}
        tuningNoteNames = midinumToNoteName(midi)+tuningNoteNames;

    }
    return tuningNoteNames;

}

function dumpTuningsToTable(tuningsInMemoryHash){
      var table = $("<table class='tuningsTable'>");
      var trh = $("<tr>");
      trh.html("<th>Tuning</th><th>ID</th><th>Strings</th><th>Instrument</th><th>Notes&nbsp;&uarr;</th><th>MIDI&nbsp;&darr;</th>"
              +"<th>Right/Left</th><th>PianoNames</th><th>Frets</th><th>Divider</th><th>InMem</th>");
      table.append(trh);
      var sval = "";
      var rows = allTunings.tunings.length;
	    for (var r=0; r<rows; r++){
	        var tun = allTunings.tunings[r];
	        var checkedVisible = tun.visible ? " checked " : "";
	        var btnStr = '<label for="cb'+tun.baseID+'"><nobr><input id="cb'+tun.baseID+'" '
	                    +' type="checkbox" class="cbTuningVisible" '
	                    +' name="cbn'+tun.baseID+'" value="'+tun.baseID+'" '
	                    + checkedVisible +' >'
	                    +tun.caption+'</nobr></label>';

			var checkedLH = tun.reverse ? " checked " : "";
	        var checkboxLH = '<label for="cbLH'+tun.baseID+'"><nobr>'
	                    +'<input class="checkboxLH"   id="cbLH'+tun.baseID+'" '
	                    +' type="checkbox" name="cbnLH'+tun.baseID+'" value="'
	                    +tun.baseID+'" '+checkedLH+'>Left-Handed</nobr></label>';

			var checkedPN = tun.pianoNamesRow ? " checked " : "";
	        var checkboxPN = '<label for="cbPN'+tun.baseID+'"><nobr>'
	                    +'<input class="checkboxPN"   id="cbPN'+tun.baseID+'" '
	                    +' type="checkbox" name="cbnPN'+tun.baseID+'" value="'
	                    +tun.baseID+'" '+checkedPN+'>PianoNamesRow</nobr></label>';

			var selectBlock = generateSelect(tun.baseID, tun.frets);
			var selectStringDividerHt = generateSelectStringDividerHt(tun.baseID, tun.stringDividerHeight);

	        var tr = $("<tr>");
	        tr.append($("<td>").html(btnStr));
	        tr.append($("<td>").html(tun.baseID));
	        tr.append($("<td>").html(tun.nStrings+"-string"));
	        tr.append($("<td>").html(tun.baseInstrument));
	        tr.append($("<td>").html(rowRangeToNoteNames(tun.rowRange, tun)));
	        tr.append($("<td>").html(""+tun.rowRange));
	        tr.append($("<td>").html(checkboxLH));
	        tr.append($("<td>").html(checkboxPN));
	        tr.append($("<td>").html(selectBlock));
	        tr.append($("<td>").html(selectStringDividerHt));
	        sval = "";
	        if (tuningsInMemoryHash[tun.baseID]){
	            var val = tuningsInMemoryHash[tun.baseID];
	            if (val && val > 0){
	                sval = ""+val;
	            }
	        }
	        tr.append($("<td>").html("<b>"+sval+"</b>"));
	        table.append(tr);
	    }
	    return table;
}

const SELECT_FRETS_PFX = "selFrets";
const SELECT_STRINGDIVIDER_PFX = "selDivider";

function generateSelect(ID, frets){
    var sel = "<select class='selectFrets' id='"+SELECT_FRETS_PFX+ID+"'>";
    for (var r=1; r<=NUM_FRETS_MAX; r++){  // NUM_FRETS_MAX from infinite-neck.js
        var selected = "";
        if (r==frets){
            selected = " selected ";
        }
        var opt = "<option value='"+r+"' "+selected+"> "+r+" </option>";
        sel = sel +opt;

    }
    sel = sel + "</select>";
    return sel;
}

function generateSelectStringDividerHt(ID, sHeightValue){
    var sel = "<select class='selectStringDividerHt' id='"+SELECT_STRINGDIVIDER_PFX+ID+"'>";
	var opt = "<option value='0'>0</option>";
	sel = sel +opt;
    for (var r=1; r<=8; r++){
		var ht = "0."+r+"em";
        var selected = "";
        if(ht == sHeightValue){
			selected = " selected ";
        }
        opt = "<option value='"+ht+"' "+selected+"> "+ht+" </option>";
        sel = sel +opt;

    }
    sel = sel + "</select>";
    return sel;
}

//================ Public functions to manage tunings ==========================

function findTuning(oneBaseID){
  for (i in allTunings.tunings){
	  var baseID = allTunings.tunings[i].baseID;
	  if (baseID === oneBaseID){
		  return allTunings.tunings[i];
	  }
  }
}

/** name includes the string TABLE_ID_PREFIX, currently "tbl" **/
function findTuningForName(tableID){
	var tuningID = tableID.substring(TABLE_ID_PREFIX.length);
	return findTuningForID(tuningID);
}

function findTuningForID(id){
      var rows = allTunings.tunings.length;
	    for (var r=0; r<rows; r++){
	        var tun = allTunings.tunings[r];
	        var baseID = tun.baseID;
	        if (baseID === id){
	            return tun;
	        }
	    }
	    return null;
}

function getTunings(tableNamesArr){
    var result = [];
    for (var idx in tableNamesArr){
        var tableID = tableNamesArr[idx];
        var tuningID = tableID.substring(TABLE_ID_PREFIX.length);
        var tuning = findTuningForID(tuningID);
        result.push(tuning);
    }
    return result;
}





  function showDefaultTuning(){
      //if none, then show for newbies or browsers that clear checkboxes:
	    var numShowing = showhideTunings();
	    if (numShowing==0){
	        $("#cbP4").prop("checked", true);
	        showHideTuning(true, "P4");
	    }
	    return numShowing;
	 }

	function showhideTunings() {
	    var tuningsCheckboxes = $(".cbTuningVisible");
	    tuningsCheckboxes.each( function(index, element) {
              var theCB= $(element)
              var show = theCB.prop('checked');
	            var basekey = theCB.val();
	            showHideTuning(show, basekey);
	            //console.log("showhideTuning: idx:"+index+" ["+basekey+"] "+show);
      });
	    var numTunings = $(".cbTuningVisible:checked").length;
	    //console.log("showhideTunings num: "+numTunings);
	    return numTunings;
	}


	function hideTuning(tablekey){
	    showHideTuning(false, tablekey);
	}
	function showTuning(tablekey){
	    showHideTuning(true, tablekey);
	}
	function showHideTuning(show, basekey){
	    //console.log("showHideTuning:"+show+":"+basekey);
	    var cbKey = "#cb"+basekey;
	    var divKey = "#"+TABLEDIV_ID_PREFIX+basekey;
	    var jcb = $(cbKey);
	    var jdiv = $(divKey);
	    jcb.prop("checked", show);
		//jcb.click();
	    if (show){
	        jdiv.show();
	    } else {
	        jdiv.hide();
	    }
	}

	function showTuningsForTablesInFile(){
	     var numFound = 0;
	     for (frame in getSong().frames){
	         var tables = getSong().frames[frame].tables;
	         for (tablekey in tables){
	             var tablearr = tables[tablekey];
	             if (tablearr && tablearr.length>0) {
	                  var basekey = tablekey.substring(TABLE_ID_PREFIX.length);
	                  showTuning(basekey);
	                  numFound++;
	             }
	         }
	     }
	     for (visTableIdx in getSong().visibleTables){
	         var visbasekey = getSong().visibleTables[visTableIdx].substring(TABLE_ID_PREFIX.length);

			 var tuning = findTuning(visbasekey);
	         if (tuning){
	             tuning.visible = true;
	         } else {
	             console.log("tuning not found for basekey: "+basekey);
	         }
	 		 resinstallAllTuningsTables();

	         showTuning(visbasekey);
	         numFound++;
	     }
	     return numFound;
	}

	function hideAllTunings(){
	    for (i in allTunings.tunings){
	        hideTuning(allTunings.tunings[i].baseID);
	    }
	}

//===================== event binding =======================================
	//One dependency: the existence of a form called "#frmTunings" with our tuningstable.

function bindFormTuningsEvents(){
	$('#frmTunings .cbTuningVisible').change(function() {
        var show = this.checked;
        var basekey = this.value;
        var tuning = findTuning(basekey);
        if (tuning){
            tuning.visible = show;
        } else {
            console.log("tuning not found for basekey: "+basekey);
        }
		resinstallAllTuningsTables();
        showHideTuning(show, basekey);
        showhideTunings();
    });
    $('#frmTunings .checkboxLH').change(function() {
        var tuningID = this.value;
        var tuning = findTuningForID(tuningID);
        tuning.reverse = this.checked;
        resinstallAllTuningsTables();
    });
    $('#frmTunings .selectFrets').change(function() {
        var tuningID = this.id.substring(SELECT_FRETS_PFX.length);
        var tuning = findTuningForID(tuningID);
        tuning.frets = parseInt(this.value);
        resinstallAllTuningsTables();
    });
	$('#frmTunings .selectStringDividerHt').change(function() {
        var tuningID = this.id.substring(SELECT_STRINGDIVIDER_PFX.length);
        var tuning = findTuningForID(tuningID);
        tuning.stringDividerHeight = this.value;
        resinstallAllTuningsTables();
    });
	$('#frmTunings .checkboxPN').change(function() {
        var tuningID = this.value;
		var tuning = findTuningForID(tuningID);
        tuning.pianoNamesRow = this.checked;//TODO
        resinstallAllTuningsTables();
    });
}
