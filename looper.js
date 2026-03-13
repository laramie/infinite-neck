let looperProviders = {
	getMillisForBeatClock: function () { return 0; },
	getSong: function () { return null; },
	showBeats: function () {},
	showBPM: function () {}
};

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
		window.clearTimeout(showBeatsIntervalPointer);
		showBeatsIntervalPointer = null;
		$("#btnLoopSections").html(NOT_LOOPING_FRAMES_CAPTION).removeClass("ButtonOn");    //css({"background": "white"});
		$("#btnLoopBeats").html(NOT_LOOPING_BEATS_CAPTION).removeClass("ButtonOn");      //.css({"background": "white"});
		$("#btnLoopBeatsTransport").removeClass("ButtonOn");      //.css({"background": "white"});
	}

	function startLoopSections(){
		looperProviders.showBPM();
		var caption = LOOPING_FRAMES_CAPTION;
		if (looperProviders.getSong().randomLoop){
			caption = LOOPING_FRAMES_CAPTION_RANDOM;
		}
		$("#btnLoopSections").html(caption).addClass("ButtonOn");    //.css({"background": "magenta"});
		var millisNextBeat = looperProviders.getMillisForBeatClock();
		showBeatsIntervalPointer = window.setInterval(showBeatsIntervalHandler, millisNextBeat);
	}
	function startLoopBeats(){
		$("#btnLoopBeats").html(LOOPING_BEATS_CAPTION).addClass("ButtonOn");    //.css({"background": "magenta"});
		$("#btnLoopBeatsTransport").addClass("ButtonOn");                       //.css({"background": "magenta"});

		var millisNextBeat = looperProviders.getMillisForBeatClock();
		showBeatsIntervalPointer = window.setInterval(showBeatsIntervalHandler, millisNextBeat);
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
			$("#btnLoopSections").text() === LOOPING_FRAMES_CAPTION
		) || (
			$("#btnLoopSections").text() === LOOPING_FRAMES_CAPTION_RANDOM
		);
	}
	export function beatsLooping(){
		return $("#btnLoopBeats").text() === LOOPING_BEATS_CAPTION;
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
		tickBeat(looperProviders.getSong(), {
			sectionsLooping: sectionsLooping(),
			showBeats: looperProviders.showBeats
		});
	}
