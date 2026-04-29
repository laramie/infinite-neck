import EventBus from './event-bus.js';
import { chuseStylesheet } from './colorFunctions.js';
import { Section } from './Section.js';

export const GraveType = Object.freeze({
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

export class Graveyard {
    constructor(jsonObj){
        this.records = []; //just in case.
        Object.assign(this, jsonObj); //jsonObj.records is an array, no methods needed.   
        this.song = null; //set by SongPersistence after construction.
    }

    setSong(song){
        this.song = song;
    }

    toJSON() {
        const { song, ...rest } = this;  // Exclude this.song from serialization
        return rest;
    }

    getRecords(){
        return this.records;
    }

    getRecordCount(){
        return this.records.length;
    }

    dumpGraveyard(){
        return JSON.stringify(this.records, null, 4);
    }

    makeRecord(){
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

    addRecord(record){
        if (record.type == GraveType.UNKNOWN){
            throw new TypeError("Graveyard.addRecord() :: record.type not set to a GraveType");
        }
        this.records.push(record);
    }

    bury(graveType, obj, context){
        var rec = this.makeRecord();
        rec.type = graveType;
        rec.context = context;
        rec.json = JSON.stringify(obj,null,4)   //when handed out again, will get separate, new revived clones, not references.
        this.addRecord(rec);
    }

    raise(indexNum){
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
                //getSong().addSection(JSON.parse(record.json));
                this.song.addSection(new Section(JSON.parse(record.json)));
                break;
            case GraveType.DISPLAY:
            case GraveType.BEAT:
            case GraveType.STYLESHEET:
                var dictkey = record.context.dictkey;
                if (dictkey){
                    var base = dictkey;
                    var i = 1;
                    while (this.song.colorDicts[dictkey]){
                        dictkey = base+'R'+(i++);
                    }
                    this.song.colorDicts[dictkey] = JSON.parse(record.json);
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
        //EventBus.trigger('ShowMessages', { html: getSong().graveyard.buildGraveyardTable() });
        EventBus.trigger('ShowMessages', { html: this.buildGraveyardTable() });
        EventBus.trigger('SongUiFullRepaint');
    }

    /* Hose the records, emptying the graveyard.  
       Useful for reducing file size and cleaning it up.
       Be sure to call to download a backup in the UI first.
    */
    clear(){
        var removed = this.records.length;
        this.records.length = 0;        // JS engine clears reference to the array (better than records=[]);
        return removed;                 
    }

    buildGraveyardTable(){
        var result = [];
        var resultBody = [];
        var SEP = "</td><td>";
        var closeBtn = '<button type="button" data-action="showGraveyard">Refresh</button>'
                      +'&nbsp;&nbsp;<button type="button" data-action="hideGraveyard">Close</button>';


        Object.keys(this.records).forEach(k => {
            var record = this.records[k];
            var theContext = JSON.stringify(record.context);
            if (theContext.length > 60){
                theContext = theContext.substring(0,60)+"...";
            }
            var lastRevived = record.lastRevived ? record.lastRevived : "";
            var row = "<tr><td>"+k+SEP+record.type+SEP+record.timestamp+SEP+record.date+SEP+record.time+SEP+theContext+SEP+lastRevived+SEP+"<a href='#' class='graveyard-raise-link' data-grave-index='"+k+"'>raise "+k+"</a></td></tr>";
            var row2 = "<tr><td><span class='graveyard-toggle-json' data-target='#grave"+record.timestamp+"'><u>show/hide</u></span></td><td colspan='6'><div id='grave"+record.timestamp+"' style='display:none;'>"+record.json+"</div></td></tr>";
            resultBody.unshift(row2);
            resultBody.unshift(row);
        });
           
        result.push("<table class='tblGraveyard'>");
        result.push("<caption>The Graveyard - deleted Sections, Stylesheets etc.  Click <b>raise</b> to revive one.&nbsp;&nbsp;&nbsp;"+closeBtn+" </caption>");
        result.push("<tr><th>id</th><th>type</th><th>timestamp</th><th>date</th><th>time</th><th>context</th><th>lastRevived</th><th>ACTION</th></tr>");
        result.push(resultBody.join(" \n"));
        result.push("</table>");
        return result.join(" \n");
    }
}
