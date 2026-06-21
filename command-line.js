/*  Copyright (c) 2023, 2024 Laramie Crocker http://LaramieCrocker.com  */

import {
    buildChildMenuCaptionsRow,
    diveMenu,
    gMenuPointer,
    hasNoChildMenus,
    peekParentMenu,
    printMenuStack,
    printMenuStackBreadcrumbs,
    refreshRuntimeChildren,
    resolveMenuValue,
    setMenuAtRoot,
    surfaceOneMenu
} from './menu.js';

let gCmdActionRunner = function () {
    throw new Error('Command action runner not configured');
};

let gCmdLineMenuMode = 'tall';

export function setCmdActionRunner(actionRunner){
    if (typeof actionRunner === 'function') {
        gCmdActionRunner = actionRunner;
    }
}

function applyCmdLineMenuMode(){
    const isOneLine = gCmdLineMenuMode === 'one-line';
    const jCmdMenu = $("#CmdMenu");
    const wasOneLine = jCmdMenu.hasClass("CmdMenuOneLine");
    jCmdMenu.toggleClass("CmdMenuOneLine", isOneLine);

    const jOptionsTable = $("#CmdMenuOptionsTable");
    if (jOptionsTable.length > 0){
        jOptionsTable.toggle(!isOneLine);
    }

    const jStack = $("#CmdMenuStack");
    if (jStack.length === 0){
        return;
    }

    if (!isOneLine){
        if (wasOneLine) {
            const fullStackHtml = jStack.data("fullStackHtml");
            if (typeof fullStackHtml === 'string') {
                jStack.html(fullStackHtml);
            }
        }
        jStack.removeData("fullStackHtml");
        return;
    }

    const fullStackHtml = jStack.html();
    jStack.data("fullStackHtml", fullStackHtml);

    const jPrompt = jStack.find(".cmdPrompt").last().clone();
    const jFallbackPrompt = jStack.find(".cmdPrompt2").last().clone();
    const promptHtml = jPrompt.length > 0
        ? $("<div>").append(jPrompt).html()
        : $("<div>").append(jFallbackPrompt).html();

    if (promptHtml) {
        jStack.html(promptHtml);
    }
}

export function setCmdLineMenuMode(mode){
    if (mode === 'one-line') {
        gCmdLineMenuMode = 'one-line';
    } else if (mode === 'short') {
        gCmdLineMenuMode = 'short';
    } else {
        gCmdLineMenuMode = 'tall';
    }
    applyCmdLineMenuMode();
}

export function showCmdLine(){
    $("#CmdMenu").show();
    $("#txtCmdLine").focus();
}

export function hideCmdLine(){
    $("#CmdMenu").hide();
}

export function toggleCmdLine(){
    var cmdmenu = $("#CmdMenu");
    cmdmenu.toggle();
    if ( cmdmenu.is(":visible") ){
        $("#txtCmdLine").focus();
    }
}

function clearCmdLine(){
    $("#txtCmdLine").val('');
}

function applyMenuPrefKey(prefKey){
    const actionResult = gCmdActionRunner({ action: 'setMenuPrefs' }, { key: prefKey }) || {};
    updateCmdLineView();
    return actionResult;
}

function preloadCmdLineFromInputMenu(inputMenu) {
    if (!inputMenu) {
        return;
    }
    let inputMenuDefaultStr = "";
    let inputMenuDefault = inputMenu.default;
    if (inputMenuDefault && typeof inputMenuDefault === 'object'){
        inputMenuDefaultStr = JSON.stringify(inputMenuDefault);
    } else {
        inputMenuDefaultStr = inputMenuDefault;
    }
    const defaultText = resolveMenuValue(inputMenuDefaultStr);
    const jInput = $("#txtCmdLine");
    jInput.val(defaultText);

    const inputEl = jInput.get(0);
    if (inputEl && defaultText.length > 0) {
        inputEl.focus();
        inputEl.setSelectionRange(0, defaultText.length);
    }
}

function getInputMenuCaption(inputMenu) {
    return resolveMenuValue(inputMenu?.caption || '');
}

export function updateCmdLineView(addedCrumb){
    $("#CmdMenuStack").html(printMenuStack());
    $("#CmdMenuBreadcrumbs").html(printMenuStackBreadcrumbs(addedCrumb));
    $("#CmdMenuResults").html(buildChildMenuCaptionsRow(gMenuPointer));
    applyCmdLineMenuMode();
}

var gCmdResultsCount = 0;

export function addCmdResults(newResultsLine){
    var jO = $(new Option("", gCmdResultsCount++));
    jO.html(newResultsLine);
    $("#dropDownCmdResults").prepend(jO);
    $("#dropDownCmdResults").val($("#dropDownCmdResults option:first").val());
}

export function clearCmdResults(){
    $("#dropDownCmdResults").empty();
}

export function stringifyMenuItem(menuItem){
    function rep(key,val){
        if (key=="parent"){
            return undefined;
        } else {
            return val;
        }
    }
    return JSON.stringify(menuItem, rep, 3);
}


export function txtCmdLine_keypress(e) {
    if (gMenuPointer.type && gMenuPointer.type == "input" && event.keyCode != 13){
        return;
    }
    if (e.keyCode == 13) {  // ENTER key : means value has been entered.
        e.preventDefault();
        var inputval = $("#txtCmdLine").val();
        if (inputval == "X"){
            hideCmdLine();
            clearCmdLine();
            e.preventDefault();
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
            var actionResult = gCmdActionRunner(targetMenu, args) || {};
            if (!actionResult.preserveMenuStack && (targetMenu.popOnBang || actionResult.popOnBang)) {
                surfaceOneMenu();
                surfaceOneMenu();
            }
            var resultSuffix = actionResult.result ? " &raquo; " + actionResult.result : "";
            addCmdResults(getInputMenuCaption(targetMenu.input)+": "+inputval+resultSuffix);
            clearCmdLine();
            updateCmdLineView(inputval);
            return;
        }
    } else {
        if (e.key == "x"){  //every menu gets an automatically generated eXit item.
            hideCmdLine();
            clearCmdLine();
            e.preventDefault();
            return;
        }
        if (e.key == "/"){
            setMenuAtRoot();
            clearCmdResults();
            clearCmdLine();
            e.preventDefault();
            updateCmdLineView();
            return;
        }
    }

    /** we are here, we aren't one of these:   {'/', '..', or  'RETURN'} and we aren't gathering inputs.  **/

    var menu = gMenuPointer;
    refreshRuntimeChildren(menu);
    var children = menu.children;
    children.forEach((child, childIdx) => {
        refreshRuntimeChildren(child);
        //now look in all children to see if user pressed the trigger for the child menu
        if (child.trigger == e.key){
            if (child.action && hasNoChildMenus(child)){
                diveMenu(child,"showing-list-menu");
                if (child.input) {
                    addCmdResults(printMenuStackBreadcrumbs() + " &raquo; " + child.action + " :: " + getInputMenuCaption(child.input) + " : ");
                    diveMenu(child.input, "");
                    updateCmdLineView();
                    preloadCmdLineFromInputMenu(child.input);
                    e.preventDefault();
                    return;
                } else {
                    var actionResult = gCmdActionRunner(child);
                    child.bang = actionResult.suppressBang !== true;
                    surfaceOneMenu();
                    if (actionResult.popOnBang && !actionResult.preserveMenuStack) {
                        surfaceOneMenu();
                    }
                    addCmdResults(printMenuStackBreadcrumbs() + child.trigger + " &raquo; " + child.action + (actionResult.result?" &raquo; "+actionResult.result:""));
                    clearCmdLine();
                    updateCmdLineView(child.trigger);
                    child.bang = false;
                    event.preventDefault();
                    return;
                }
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
                    gCmdActionRunner(menu, args);
                    addCmdResults("! "+menu.caption+"(<b>"+e.key+"</b>)&raquo;"+menu.action);
                    child.bang = true;
                    e.preventDefault();
                    clearCmdLine();
                    updateCmdLineView("(<b>"+e.key+"</b>)");
                    child.bang = false;
                    return;
                } else {
                    if (child.action && child.guardBeforeDive) {
                        var actionResult = gCmdActionRunner(child) || {};
                        if (actionResult.preventDive) {
                            addCmdResults(printMenuStackBreadcrumbs() + " &raquo; " + child.trigger + " &raquo; " + child.action + (actionResult.result?" &raquo; "+ actionResult.result:"") );
                            e.preventDefault();
                            clearCmdLine();
                            updateCmdLineView(child.trigger);
                            return;
                        }
                    }
                   diveMenu(child, childIdx);
                    event.preventDefault();
                    clearCmdLine();
                    updateCmdLineView();
                    return;
                }
            }
        }
    });
}

export function txtCmdLine_keydown(e) {
    if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        e.stopPropagation();
        applyMenuPrefKey('s');
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        applyMenuPrefKey('t');
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        applyMenuPrefKey('o');
    }
}
