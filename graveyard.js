const GraveType = Object.freeze({
        UNKNOWN: "UNKNOWN",
        SONG: "SONG",
        SECTION: "SECTION",
        DISPLAY: "DISPLAY",
        BEAT: "BEAT",
        STYLESHEET: "STYLESHEET",
        THEME: "THEME",
        TUNING: "TUNING",
        DESKTOP: "DESKTOP",
        INSTRUMENT: "INSTRUMENT"
});
function makeGraveyard(flatObj){

    let obj = {
        //FIELDS:
            records: [],
        //METHODS:
            make: construct_graveyard,
            getRecords: getRecords,
            addRecord: addRecord,
            makeRecord: makeRecord,
            dumpGraveyard: dumpGraveyard,
            buildTable: buildTable,
            bury: bury,
            raise: raise
    }
    obj.make(flatObj);
    return obj;

    function construct_graveyard(flatObj){
        if (flatObj){
            this.records = flatObj.records;
        }
    }

    function getRecords(){
        return this.records;
    }

    function dumpGraveyard(){
        return JSON.stringify(this.records, null, 4);
    }

    function makeRecord(){
        var n = Date.now();
        var d = new Date(n);
        var dt = d.toLocaleDateString();
        var t =  d.toLocaleTimeString();
        return {
            "timestamp": n,
            "date": dt,
            "time": t,
            "type": GraveType.UNKNOWN,
            "context": {},
            "json": "",
            "lastRevived": null
        }
    }

    function addRecord(record){
        if (record.type == GraveType.UNKNOWN){
            throw new TypeError("Graveyard.addRecord() :: record.type not set to a GraveType");
        }
        this.records.push(record);
    }

    function bury(graveType, obj, context){
        var rec = this.makeRecord();
        rec.type = graveType;
        rec.context = context;
        rec.json = JSON.stringify(obj,null,4)   //when handed out again, will get separate, new revived clones, not references.
        this.addRecord(rec);
    }

    function raise(indexNum){
        var record = this.records[indexNum];
        if (!record){
            alert("null record in raise("+indexNum+")");
            return;
        }
        switch (record.type) {
            case GraveType.SONG:
                break;
            case GraveType.SECTION:
                record.caption = record.caption + " raised from: "+record.context.SectionIndex +" at "+record.time;
                gSong.addFrame(JSON.parse(record.json));
                break;
            case GraveType.DISPLAY:
            case GraveType.BEAT:
            case GraveType.STYLESHEET:
                var dictkey = record.context.dictkey;
                if (dictkey){
                    var base = dictkey;
                    var i = 1;
                    while (gSong.colorDicts[dictkey]){
                        dictkey = base+'R'+(i++);
                    }
                    gSong.colorDicts[dictkey] = JSON.parse(record.json);
                    chuseStylesheet(dictkey);
                }
                break;
            case GraveType.THEME:
            case GraveType.TUNING:
            case GraveType.DESKTOP:
            case GraveType.INSTRUMENT:
            case GraveType.UNKNOWN:
            default:
                 alert("Graveyard Type not supported:"+record.type+" "+record.context);
                 return;
        }
        record.lastRevived = Date.now();
        showMessages(gSong.graveyard.buildTable());
        fullRepaint();
    }

    function buildTable(){
        var result = [];
        var resultBody = [];
        var SEP = "</td><td>";
        var closeBtn = '<button type="button" onclick="showGraveyard();">Refresh</button>'
                      +'&nbsp;&nbsp;<button type="button" onclick="hideGraveyard();">Close</button>';


        for (k in this.records){
            var record = this.records[k];
            var theContext = JSON.stringify(record.context);
            if (theContext.length > 60){
                theContext = theContext.substring(0,60)+"...";
            }
            var lastRevived = record.lastRevived ? record.lastRevived : "";
            var row = "<tr><td>"+k+SEP+record.type+SEP+record.timestamp+SEP+record.date+SEP+record.time+SEP+theContext+SEP+lastRevived+SEP+"<a href='javascript:gSong.graveyard.raise("+k+");'>raise "+k+"</a></td></tr>";
            var row2 = "<tr><td><span onclick='$(\"#grave"+record.timestamp+"\").toggle();'><u>show/hide</u></span></td><td colspan='6'><div id='grave"+record.timestamp+"' style='display:none;'>"+record.json+"</div></td></tr>";
            resultBody.unshift(row2);
            resultBody.unshift(row);
        }
        result.push("<table class='tblGraveyard'>");
        result.push("<caption>The Graveyard - deleted Sections, Stylesheets etc.  Click <b>raise</b> to revive one.&nbsp;&nbsp;&nbsp;"+closeBtn+" </caption>");
        result.push("<tr><th>id</th><th>type</th><th>timestamp</th><th>date</th><th>time</th><th>context</th><th>lastRevived</th><th>ACTION</th></tr>");
        result.push(resultBody.join(" \n"));
        result.push("</table>");
        return result.join(" \n");
    }
}
