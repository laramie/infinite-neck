/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

export class Layout {
    constructor(jsonObj){
        this.screenList = {};
        this.screenList.fullscreen = {
            name: "fullscreen",
            CaptionRow: true,
            SongTitle: true,
            SongWidgets: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
        };
        
        this.screenList.escaped = {
            name: "escaped",
            CaptionRow: true,
            SongTitle: true,
            SongWidgets: true,
            WidgetRow: true,
            InstrumentCaptions: true,
            LeftRails: true,
            CaptionLooperLayout: 'column'
        };
        this.screen = this.screenList.escaped;
        if (jsonObj){
            Object.assign(this, jsonObj);
        }
        // Older song files have no SongWidgets flag in their persisted screens: default it to shown.
        [...Object.values(this.screenList || {}), this.screen].forEach((screen) => {
            if (screen && screen.SongWidgets === undefined) {
                screen.SongWidgets = true;
            }
        });
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

    /** Persists the User's choice (not the element's display, which is also hidden whenever the
     *  Song Widgets are empty), then applies it.  Called with no argument, flips the current choice. */
    toggleSongWidgets(visible){
        this.screen.SongWidgets = typeof visible === 'boolean' ? visible : this.screen.SongWidgets === false;
        this.applySongWidgetsVisibility();
    }

    /** #lblSongWidgets shows only when it has content AND the current screen's SongWidgets flag is on. */
    applySongWidgetsVisibility(){
        const jSongWidgets = $('#lblSongWidgets');
        const hasContent = (jSongWidgets.html() || '').trim().length > 0;
        jSongWidgets.toggle(hasContent && this.screen.SongWidgets !== false);
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
        this.toggleSongWidgets(this.screen.SongWidgets);
        this.toggleWidgetRow(this.screen.WidgetRow);
        this.toggleInstrumentCaptions(this.screen.InstrumentCaptions);
        this.toggleLeftRails(this.screen.LeftRails);
        this.toggleCaptionLooperLayout(this.screen.CaptionLooperLayout);
    }

} 
