function hasJQuery() {
	return typeof $ !== 'undefined';
}

function getButtonCaption(selector, fallbackCaption) {
	if (!hasJQuery()) return fallbackCaption;
	return $(selector).text();
}

function setButtonState(selector, caption, isOn) {
	if (!hasJQuery()) return;
	if (caption !== null) {
		$(selector).html(caption);
	}
	$(selector).toggleClass('ButtonOn', !!isOn);
}
function setLooperLightState(selector, isOn) {
	if (!hasJQuery()) return;
	$(selector).toggleClass('LooperLightOn', !!isOn);
}


function createDefaultLooperProviders() {
	return {
		getMillisForBeatClock: function () { return 0; },
		getSong: function () { return null; },
		getLoopSectionsCaption: function () { return getButtonCaption('#btnLoopSections', 'LOOP'); },
		getLoopBeatsCaption: function () { return getButtonCaption('#btnLoopBeats', 'LOOP BEATS'); },
		setLoopSectionsButton: function (caption, isOn) { 
			setButtonState('#btnLoopSections', caption, isOn); 
			setLooperLightState('.LooperLight', isOn);
		},
		setLoopBeatsButton: function (caption, isOn) { setButtonState('#btnLoopBeats', caption, isOn); },
		setLoopBeatsTransportButton: function (isOn) { setButtonState('#btnLoopBeatsTransport', null, isOn); },
		setLoopInterval: function (handler, millis) {
			if (typeof setInterval !== 'function') return null;
			return setInterval(handler, millis);
		},
		clearLoopInterval: function (pointer) {
			if (pointer === null || typeof pointer === 'undefined') return;
			if (typeof clearInterval === 'function') {
				clearInterval(pointer);
				return;
			}
			if (typeof clearTimeout === 'function') {
				clearTimeout(pointer);
			}
		},
		showBeats: function () {},
		showBPM: function () {}
	};
}

let looperProviders = createDefaultLooperProviders();

export function setLooperProviders(providers){
	if (!providers) return;
	looperProviders = {
		...looperProviders,
		...providers
	};
}

    var showBeatsIntervalPointer = null;

	const LOOPING_FRAMES_CAPTION        = "LOOPING...";
	const LOOPING_FRAMES_CAPTION_RANDOM = "RANDOM....";
	const NOT_LOOPING_FRAMES_CAPTION    = "LOOP";

	const LOOPING_BEATS_CAPTION         = "LOOPING...";
	const NOT_LOOPING_BEATS_CAPTION     = "LOOP BEATS";

	function clearBeatAndSectionLooping(){
		if (showBeatsIntervalPointer !== null) {
			looperProviders.clearLoopInterval(showBeatsIntervalPointer);
		}
		showBeatsIntervalPointer = null;
		looperProviders.setLoopSectionsButton(NOT_LOOPING_FRAMES_CAPTION, false);
		looperProviders.setLoopBeatsButton(NOT_LOOPING_BEATS_CAPTION, false);
		looperProviders.setLoopBeatsTransportButton(false);
	}

	function startLoopSections(){
		looperProviders.showBPM();
		var caption = LOOPING_FRAMES_CAPTION;
		var song = looperProviders.getSong();
		if (song && song.randomLoop){
			caption = LOOPING_FRAMES_CAPTION_RANDOM;
		}
		looperProviders.setLoopSectionsButton(caption, true);
		var millisNextBeat = looperProviders.getMillisForBeatClock();
		showBeatsIntervalPointer = looperProviders.setLoopInterval(showBeatsIntervalHandler, millisNextBeat);
	}
	function startLoopBeats(){
		looperProviders.setLoopBeatsButton(LOOPING_BEATS_CAPTION, true);
		looperProviders.setLoopBeatsTransportButton(true);

		var millisNextBeat = looperProviders.getMillisForBeatClock();
		showBeatsIntervalPointer = looperProviders.setLoopInterval(showBeatsIntervalHandler, millisNextBeat);
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
		return (
			looperProviders.getLoopSectionsCaption() === LOOPING_FRAMES_CAPTION
		) || (
			looperProviders.getLoopSectionsCaption() === LOOPING_FRAMES_CAPTION_RANDOM
		);
	}
	export function beatsLooping(){
		return looperProviders.getLoopBeatsCaption() === LOOPING_BEATS_CAPTION;
	}

	export function tickBeat(song, { sectionsLooping, showBeats }) {
		var beat = song.getBeat();
		var beats = song.getBeats();
		if (beat >= beats) {
			if (sectionsLooping) {
				song.gotoNextSection(true);  //calls showBeats()
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
		var song = looperProviders.getSong();
		if (!song || typeof song.getBeat !== 'function' || typeof song.getBeats !== 'function') {
			return;
		}
		tickBeat(looperProviders.getSong(), {
			sectionsLooping: sectionsLooping(),
			showBeats: looperProviders.showBeats
		});
	}

	export function __resetLooperForTests(){
		showBeatsIntervalPointer = null;
	}

	export function __resetLooperProvidersForTests(){
		looperProviders = createDefaultLooperProviders();
	}
