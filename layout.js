/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

export class Layout {
    constructor(jsonObj){
        this.screenList = {};
        this.screenList.fullscreen = {
            name: "fullscreen",
            CaptionRow: true,
            SongTitle: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
        };
        
        this.screenList.escaped = {
            name: "escaped",
            CaptionRow: true,
            SongTitle: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
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

    /** @direction is 'row' or 'column' which behave as setters, or undefined, which behaves as a toggle. */
    toggleCaptionLooperLayout(direction){
        let newDirection = 'column';
        let $lrs = $('.leftRailStack');
        if (direction){
            $lrs.css('flex-direction', direction);
            newDirection = direction;
        } else {
            let fd = $lrs.css('flex-direction');
            if (fd == 'column'){
                $lrs.css('flex-direction','row');
                newDirection =  'row';
            } else {
                $lrs.css('flex-direction','column');
                newDirection =  'column';
            }
        }
        this.setCaptionLooperLayout(newDirection);
        return newDirection;
    }

    setCaptionLooperLayout(direction){
        this.screen.CaptionLooperLayout = direction;
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
        this.toggleCaptionRow(this.screen.CaptionRow);
        this.toggleSongTitle(this.screen.SongTitle);
        this.toggleWidgetRow(this.screen.WidgetRow);
        this.toggleInstrumentCaptions(this.screen.InstrumentCaptions);
        this.toggleLeftRails(this.screen.LeftRails);
        this.toggleCaptionLooperLayout(this.screen.CaptionLooperLayout);
    }

} 
