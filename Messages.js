import { jsonTree } from './jsonTree80kg/json-tree-80kg.js';
import { hideCmdLine } from './command-line.js';


export class Messages {

    static scrollToMessages(){
        var scrollDiv = document.getElementById("divMessageAndJsonTree").offsetTop;
        window.scrollTo({ top: scrollDiv, behavior: 'smooth'});
    }
    static showMessagesJSON(json, preamble = ""){
        Messages.showMessages(preamble+json);
        const div = document.getElementById('divJsonTree');
        div.innerHTML = '';
        let data = JSON.parse(json);
        jsonTree(data, div);
    }
    static showMessages(html){
        $("#divMessageAndJsonTree").show();
        $("#divMessages").show();
        $("#divMessages").html(html);
        Messages.showMessagesTab("Messages");
        hideCmdLine();
        Messages.scrollToMessages();
    }
    static  hideMessages(){
        $("#divMessages").hide();
        $("#divMessageAndJsonTree").hide();
    }

    static showMessagesTab(which) {
        var showMsgs = which !== 'JsonTree' && which !== 'UserLog';
        var showJsonTree = which === 'JsonTree';
        var showUserLog = which === 'UserLog';
        $('#divMessages').toggle(showMsgs);
        $('#divJsonTree').toggle(showJsonTree);
        $('#divUserLog').toggle(showUserLog);
        let selector = '#btnMessagesTab, #btnJsonTreeTab, #btnUserLog, #btnHideMessagesJsonTree';
        $(selector).css('display', 'inline-block');

        $('#btnMessagesTab')
            .toggleClass('BtnPunchedIn', showMsgs)
            .toggleClass('BtnPunchedOut', !showMsgs);
        $('#btnJsonTreeTab')
            .toggleClass('BtnPunchedIn', showJsonTree)
            .toggleClass('BtnPunchedOut', !showJsonTree);
        $('#btnUserLog')
            .toggleClass('BtnPunchedIn', showUserLog)
            .toggleClass('BtnPunchedOut', !showUserLog);
    }
    
}