import EventBus from './event-bus.js';
import * as InfiniteNeck from './infinite-neck.js';

	let isSectionsLooping = false;
	let isBeatsLooping = false;

    var showBeatsIntervalPointer = null;

	const LOOPING_FRAMES_CAPTION        = "LOOPING...";
	const LOOPING_FRAMES_CAPTION_RANDOM = "RANDOM....";

	const LOOPING_BEATS_CAPTION         = "LOOPING...";

	function getSong(){
		return InfiniteNeck.getSong();
	}

	function getMillisForBeatClock(){
		return InfiniteNeck.getMillisForBeatClock();
	}

	function showBeats(){
		InfiniteNeck.showBeats();
	}

	function showBPM(){
		InfiniteNeck.showBPM();
	}

	function startLoopInterval(handler, millis){
		if (typeof setInterval !== 'function') return null;
		return setInterval(handler, millis);
	}

	function stopLoopInterval(pointer){
		if (pointer === null || typeof pointer === 'undefined') return;
		if (typeof clearInterval === 'function') {
			clearInterval(pointer);
			return;
		}
		if (typeof clearTimeout === 'function') {
			clearTimeout(pointer);
		}
	}

	function clearBeatAndSectionLooping(){
		const wasSectionsLooping = isSectionsLooping;
		const wasBeatsLooping = isBeatsLooping;
		isSectionsLooping = false;
		isBeatsLooping = false;
		if (showBeatsIntervalPointer !== null) {
			stopLoopInterval(showBeatsIntervalPointer);
		}
		showBeatsIntervalPointer = null;
		if (wasSectionsLooping) {
			EventBus.trigger('Looper:OnLoopSectionsStop');
		}
		if (wasBeatsLooping) {
			EventBus.trigger('Looper:OnLoopBeatsStop');
		}
	}

    function startLoopSections(){
		isSectionsLooping = true;
		isBeatsLooping = false;
	        showBPM();
        var caption = LOOPING_FRAMES_CAPTION;
        var song = getSong();
        if (song && song.randomLoop){
            caption = LOOPING_FRAMES_CAPTION_RANDOM;
        }
	    EventBus.trigger('Looper:OnLoopSectionsStart', {
			caption
		});
    
        if (song) {
            EventBus.trigger('DaCapo:OnSongBegin', {
                sectionIndex: song.getSectionsCurrentIndex(),
                sectionCount: song.getSections().length,
                beat: song.getBeat(),
                beats: song.getBeats()
            });
        }
    
		var millisNextBeat = getMillisForBeatClock();
		showBeatsIntervalPointer = startLoopInterval(showBeatsIntervalHandler, millisNextBeat);
    }

	function startLoopBeats(){
		isSectionsLooping = false;
		isBeatsLooping = true;
		EventBus.trigger('Looper:OnLoopBeatsStart', {
			caption: LOOPING_BEATS_CAPTION
		});

		var millisNextBeat = getMillisForBeatClock();
		showBeatsIntervalPointer = startLoopInterval(showBeatsIntervalHandler, millisNextBeat);
	}

	export function toggleLoopSections(){
		var sectionsLoopingBool = sectionsLooping();
	    if(showBeatsIntervalPointer){
			clearBeatAndSectionLooping();
	    }
		if (!sectionsLoopingBool){
			startLoopSections()
		}
	}

	export function restartLoopSections(){
		if (sectionsLooping()){
			clearBeatAndSectionLooping();
			startLoopSections();
		} else {
			startLoopSections();
		}
	}

	export function toggleLoopBeats(){
	    var beatsLoopingBool = beatsLooping();
	    if(showBeatsIntervalPointer){
			clearBeatAndSectionLooping();
	    }
		if (!beatsLoopingBool){
			startLoopBeats()
		}
	}
	export function sectionsLooping(){
		return isSectionsLooping;
	}
	export function beatsLooping(){
		return isBeatsLooping;
	}

    export function tickBeat(song, { sectionsLooping, showBeats }) {
        var beat = song.getBeat();
        var beats = song.getBeats();
    
        if (beat >= beats) {
            const currentSectionIndex = song.getSectionsCurrentIndex();
            const sectionCount = song.getSections().length;
            const isLastSection = currentSectionIndex >= (sectionCount - 1);
    
            EventBus.trigger('DaCapo:OnSectionEnd', {
                sectionIndex: currentSectionIndex,
                sectionCount,
                beat,
                beats
            });
    
            if (sectionsLooping) {
                if (isLastSection) {
                    EventBus.trigger('DaCapo:OnSongEnd', {
                        sectionIndex: currentSectionIndex,
                        sectionCount,
                        beat,
                        beats
                    });
                }
    
                song.gotoNextSection(true);  //calls showBeats()
    
                EventBus.trigger('DaCapo:OnSectionBegin', {
                    sectionIndex: song.getSectionsCurrentIndex(),
                    sectionCount: song.getSections().length,
                    beat: song.getBeat(),
                    beats: song.getBeats()
                });
            } else {
                song.incBeatLoop();
                showBeats();
            }
        } else {
            song.incBeatLoop();
            showBeats();
        }
    }

	function showBeatsIntervalHandler(){
		var song = getSong();
		if (!song || typeof song.getBeat !== 'function' || typeof song.getBeats !== 'function') {
			return;
		}
		tickBeat(song, {
			sectionsLooping: sectionsLooping(),
			showBeats
		});
	}

	export function __resetLooperForTests(){
		showBeatsIntervalPointer = null;
		isSectionsLooping = false;
		isBeatsLooping = false;
	}
