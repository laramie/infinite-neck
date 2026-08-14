/* This code is not live.  
 *  It is a sketch of an idea to have fullscreen mode remember which layout elements are visible.
 */   

export class Layout {
    constructor(jsonObj){
        this.screenList = {};
        this.screenList.fullscreen = {
            name: "fullscreen",
            CaptionRow: true,
            SongTitle: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true
        };

        this.screenList.escaped = {
            name: "escaped",
            CaptionRow: true,
            SongTitle: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true
        };
        this.screen = this.screenList.escaped;
        if (jsonObj){
            Object.assign(this, jsonObj);
        }
    }

    toggleCaptionRow(visible){
        this.screen.CaptionRow = $('#topControlsCaptions').toggle(visible).css('display') !== 'none';
    }

    toggleSongTitle(visible){
        this.screen.SongTitle = $('.lblSongName').toggle(visible).css('display') !== 'none'; 
    }
    
    toggleWidgetRow(visible){
        this.screen.WidgetRow = $('.SongTitleLeadSheet').toggle(visible).css('display') !== 'none'; 
    }

    toggleInstrumentCaptions(visible){
        this.screen.InstrumentCaptions = $('.captionRow').toggle(visible).css('display') !== 'none';
    }

    toggleLeftRails(visible){
        this.screen.LeftRails = $('.leftRailStack').toggle(visible).css('display') !== 'none'; 
        if (this.screen.LeftRails){
            $(".LeftRailLayoutButtons button").removeClass("grayed-out-button").prop("disabled", false);
        } else {
            $(".LeftRailLayoutButtons button").addClass("grayed-out-button").prop("disabled", true);
        }
    }
    
    enterFullscreen(){
        this.screen = this.screenList.fullscreen;
        this.doToggles();
    }

    leaveFullscreen(){
        this.screen = this.screenList.escaped;
        this.doToggles();
    }

    doToggles(){  
        console.log("Layout:\n"+JSON.stringify(this.screen, null, 4));  
        //toggleTransport(this.screen.Transport);
        this.toggleCaptionRow(this.screen.CaptionRow);
        this.toggleSongTitle(this.screen.SongTitle);
        this.toggleWidgetRow(this.screen.WidgetRow);
        this.toggleInstrumentCaptions(this.screen.InstrumentCaptions);
        //toggleWirings(this.screen.Wiring);
        this.toggleLeftRails(this.screen.LeftRails);
    }

} 
