/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

function showCmdLine(){
    $("#CmdMenu").show();
    $("#txtCmdLine").focus();
}
function hideCmdLine(){
    $("#CmdMenu").hide();
}
function toggleCmdLine(){
    var cmdmenu = $("#CmdMenu");
    cmdmenu.toggle();
    if ( cmdmenu.is(":visible") ){
        $("#txtCmdLine").focus();
    }
}
function clearCmdLine(){
    $("#txtCmdLine").val('');
}

function updateCmdLineView(addedCrumb){
    $("#CmdMenuStack").html(printMenuStack());
    $("#CmdMenuBreadcrumbs").html(printMenuStackBreadcrumbs(addedCrumb));
    $("#CmdMenuResults").html(buildChildMenuCaptionsRow(gMenuPointer));
}

var gCmdResultsCount = 0;

function addCmdResults(newResultsLine){
    var jO = $(new Option("", gCmdResultsCount++));
    jO.html(newResultsLine);
    $("#dropDownCmdResults").prepend(jO);
    $("#dropDownCmdResults").val($("#dropDownCmdResults option:first").val());
}

function clearCmdResults(){
    $("#dropDownCmdResults").empty();
}

function stringifyMenuItem(menuItem){
    function rep(key,val){
        if (key=="parent"){
            return undefined;
        } else {
            return val;
        }
    }
    return JSON.stringify(menuItem, rep, 3);
}

function checkRB(id){
    $(id).prop("checked", true);
}

function txtCmdLine_keypress(e) {
    if (gMenuPointer.type && gMenuPointer.type == "input" && event.keyCode != 13){
        return;
    }
    if (event.keyCode == 13) {  // ENTER key : means value has been entered.
        event.preventDefault();
        var inputval = $("#txtCmdLine").val();
        if (inputval == "X"){
            hideCmdLine();
            clearCmdLine();
            event.preventDefault();
            return;
        } else if (inputval == "..") {
            clearCmdLine();
            surfaceOneMenu();
            updateCmdLineView();
            return;
        } else if (inputval.length==0) {
            //means they hit ENTER twice: input is empty: they want to go "up".
            var doTwoPops = false;
            if (gMenuPointer.type == "input"){
                doTwoPops = true;
            }
            surfaceOneMenu();
            if (doTwoPops){
                surfaceOneMenu();
            }
            addCmdResults("ENTER twice whilst on .input");
            updateCmdLineView();
            return;
        }

        var doingInput = false;
        var targetMenu = gMenuPointer;
        if (gMenuPointer.action && gMenuPointer.input) {
            //.doingThisMenuAsHavingChildWith_input
            doingInput = true;
            targetMenu = gMenuPointer;
        } else {
            //doing one where we "push()'d" the child.input as the menu item: an input field.
            var parentMenu = peekParentMenu();
            if (parentMenu != null && parentMenu.action && parentMenu.input){
                doingInput = true;
                targetMenu = parentMenu;
            }
        }
        if (doingInput) {
            var args = {};
            args[targetMenu.input.id] = inputval;
            performCmdAction(targetMenu, args);
            addCmdResults(targetMenu.input.caption+": "+inputval);
            clearCmdLine();
            updateCmdLineView(inputval);
            return;
        }
    } else {
        if (e.key == "x"){  //every menu gets an automatically generated eXit item.
            hideCmdLine();
            clearCmdLine();
            event.preventDefault();
            return;
        }
        if (e.key == "/"){
            setMenuAtRoot();
            clearCmdResults();
            clearCmdLine();
            event.preventDefault();
            updateCmdLineView();
            return;
        }
    }

    /** we are here, we aren't one of these:   {'/', '..', or  'RETURN'} and we aren't gathering inputs.  **/

    var menu = gMenuPointer;
    var children = menu.children;
    for (var childIdx in children){
        //now look in all children to see if user pressed the trigger for the child menu
        var child = children[childIdx];
        if (child.trigger == e.key){
            if (child.action && hasNoChildMenus(child)){
                diveMenu(child,"showing-list-menu");
                if(child.input){
                    gMenuPointer = child;
                    addCmdResults(printMenuStackBreadcrumbs()+"==>"+child.action+" :: "+child.input.caption+" : ");
                    diveMenu(child.input,"");
                } else {
                    var actionResult = performCmdAction(child);
                    child.bang = true;
                    surfaceOneMenu();
                    if (actionResult.popOnBang){
                        surfaceOneMenu();
                    }
                    addCmdResults(printMenuStackBreadcrumbs()+"->"+child.trigger+"==>"+child.action+" >> "+actionResult.result);
                    clearCmdLine();
                    updateCmdLineView(child.trigger);
                    child.bang = false;
                    event.preventDefault();
                    return;

                }
                event.preventDefault();
                clearCmdLine();
                updateCmdLineView();
                return;
            } else {
                var noChildren = hasNoChildMenus(child);
                var noAction = true;
                if (child.action && child.action.length>0){
                    noAction = false;
                }
                if ( noChildren && noAction){
                    //then you are a BANG-MENU, you just go off when selected!
                    //  we execute the action of the parent, i.e. our current menu
                    var args = {};
                    args["key"] = e.key;
                    performCmdAction(menu, args);
                    addCmdResults("! "+menu.caption+"(<b>"+e.key+"</b>)===>"+menu.action);
                    child.bang = true;
                    e.preventDefault();
                    clearCmdLine();
                    updateCmdLineView("(<b>"+e.key+"</b>)");
                    child.bang = false;
                    return;
                } else {
                    diveMenu(child, childIdx);
                    event.preventDefault();
                    clearCmdLine();
                    updateCmdLineView();
                    return;
                }
            }
        }
    }
}
