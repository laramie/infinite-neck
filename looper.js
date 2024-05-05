	var showBeatsIntervalPointer = null;

	const LOOPING_FRAMES_CAPTION        = "LOOPING...";
	const LOOPING_FRAMES_CAPTION_RANDOM = "RANDOM....";
	const NOT_LOOPING_FRAMES_CAPTION    = "LOOP";

	const LOOPING_BEATS_CAPTION         = "LOOPING...";
	const NOT_LOOPING_BEATS_CAPTION     = "LOOP BEATS";

	function clearBeatAndFrameLooping(){
		window.clearTimeout(showBeatsIntervalPointer);
		showBeatsIntervalPointer = null;
		$("#btnLoopFrames").html(NOT_LOOPING_FRAMES_CAPTION).removeClass("ButtonOn");    //css({"background": "white"});
		$("#btnLoopBeats").html(NOT_LOOPING_BEATS_CAPTION).removeClass("ButtonOn");      //.css({"background": "white"});
		$("#btnLoopBeatsTransport").removeClass("ButtonOn");      //.css({"background": "white"});
	}

	function startLoopFrames(){
		showBPM();
		if (getSong().randomLoop){
			CAPTION = LOOPING_FRAMES_CAPTION_RANDOM;
		} else {
			CAPTION = LOOPING_FRAMES_CAPTION;
		}
		$("#btnLoopFrames").html(CAPTION).addClass("ButtonOn");    //.css({"background": "magenta"});
		var millisNextBeat = getMillisForBeatClock();
		showBeatsIntervalPointer = window.setInterval(showBeatsIntervalHandler, millisNextBeat);
	}
	function startLoopBeats(){
		$("#btnLoopBeats").html(LOOPING_BEATS_CAPTION).addClass("ButtonOn");    //.css({"background": "magenta"});
		$("#btnLoopBeatsTransport").addClass("ButtonOn");                       //.css({"background": "magenta"});

		var millisNextBeat = getMillisForBeatClock();
		showBeatsIntervalPointer = window.setInterval(showBeatsIntervalHandler, millisNextBeat);
	}

	function toggleLoopFrames(){
		var framesLoopingBool = framesLooping();
	    if(showBeatsIntervalPointer){
			clearBeatAndFrameLooping();
	    }
		if (!framesLoopingBool){
			startLoopFrames()
		}
	}

	function restartLoopFrames(){
		if (framesLooping()){
			clearBeatAndFrameLooping();
			startLoopFrames();
		} else {
			startLoopFrames();
		}
	}

	function toggleLoopBeats(){
	    var beatsLoopingBool = beatsLooping();
	    if(showBeatsIntervalPointer){
			clearBeatAndFrameLooping();
	    }
		if (!beatsLoopingBool){
			startLoopBeats()
		}
	}
	function framesLooping(){
		return (
			$("#btnLoopFrames").text() === LOOPING_FRAMES_CAPTION
		) || (
			$("#btnLoopFrames").text() === LOOPING_FRAMES_CAPTION_RANDOM
		);
	}
	function beatsLooping(){
		return $("#btnLoopBeats").text() === LOOPING_BEATS_CAPTION;
	}

	function showBeatsIntervalHandler(){
		var beat = gSong.getBeat();
		var beats = gSong.getBeats();
	    if (beat >= beats){
			if (framesLooping()){
				gSong.gotoNextFrame(true);  //calls showBeats()
			} else {
				gSong.incBeatLoop();
				showBeats();
			}
		} else {
			gSong.incBeatLoop();
			showBeats();
		}
	}
