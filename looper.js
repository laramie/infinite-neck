import EventBus from './event-bus.js';
import * as InfiniteNeck from './infinite-neck.js';
import { createLooperTransportTimingProviders } from './looper-transport-timing.js';

	let isSectionsLooping = false;
	let isBeatsLooping = false;

	let showBeatsTimerPointer = null;

	export const LoopTimingMode = Object.freeze({
		VISUAL: 'visual',
		TRANSPORT: 'transport'
	});

	const defaultTimingProviders = Object.freeze({
		resetTimingState() {},
		beforeScheduleNextTick() {},
		afterScheduleNextTick() {},
		beforeBeatTick() {},
		afterBeatTick() {},
		beforeSectionTransition() {},
		afterSectionTransition() {},
		getVisualDelayMillis() { return undefined; },
		getTransportDelayMillis() { return undefined; }
	});

	let looperTimingMode = LoopTimingMode.VISUAL;
	let looperTimingProviders = { ...defaultTimingProviders };

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
		const song = getSong();
		if (song && typeof song.requestUiShowBeats === 'function') {
			song.requestUiShowBeats();
			return;
		}
		InfiniteNeck.showBeats();
	}

	function showBPM(){
		InfiniteNeck.showBPM();
	}

	function emitSectionBeginForCurrentSong(song){
		if (!song) {
			return;
		}
		EventBus.trigger('DaCapo:OnSectionBegin', {
			sectionIndex: song.getSectionsCurrentIndex(),
			sectionCount: song.getSections().length,
			beat: song.getBeat(),
			beats: song.getBeats()
		});
	}

	export function getLoopTimingMode() {
		return looperTimingMode;
	}

	export function setLoopTimingMode(nextMode = LoopTimingMode.VISUAL) {
		if (!Object.values(LoopTimingMode).includes(nextMode)) {
			throw new Error(`Unknown loop timing mode: ${nextMode}`);
		}
		looperTimingMode = nextMode;
	}

	export function setLooperTimingProviders(nextProviders = {}) {
		looperTimingProviders = { ...looperTimingProviders, ...nextProviders };
	}

	export function installTransportTiming(options = {}) {
		const providers = createLooperTransportTimingProviders({
			getMillisForBeatClock,
			...options
		});
		setLooperTimingProviders(providers);
		setLoopTimingMode(LoopTimingMode.TRANSPORT);
		return providers;
	}

	function startLoopTimer(handler, millis){
		if (typeof setTimeout !== 'function') return null;
		return setTimeout(handler, millis);
	}

	function stopLoopTimer(pointer){
		if (pointer === null || typeof pointer === 'undefined') return;
		if (typeof clearTimeout === 'function') {
			clearTimeout(pointer);
			return;
		}
		if (typeof clearInterval === 'function') {
			clearInterval(pointer);
			return;
		}
	}

	function getLoopKind() {
		if (isSectionsLooping) {
			return 'sections';
		}
		if (isBeatsLooping) {
			return 'beats';
		}
		return 'idle';
	}

	function isLoopKindActive(loopKind) {
		return (loopKind === 'sections' && isSectionsLooping)
			|| (loopKind === 'beats' && isBeatsLooping);
	}

	function buildTimingContext({ loopKind, song, defaultDelayMillis = null, tickResult = null } = {}) {
		return {
			loopKind,
			timingMode: looperTimingMode,
			song,
			defaultDelayMillis,
			tickResult
		};
	}

	function providerSupportsTimingMode(timingMode = looperTimingMode) {
		const supportedTimingModes = looperTimingProviders.supportedTimingModes;
		if (!Array.isArray(supportedTimingModes) || supportedTimingModes.length === 0) {
			return true;
		}
		return supportedTimingModes.includes(timingMode);
	}

	function callTimingHook(hookName, context, { ignoreTimingMode = false } = {}) {
		if (!ignoreTimingMode && !providerSupportsTimingMode(context?.timingMode || looperTimingMode)) {
			return undefined;
		}
		const hook = looperTimingProviders[hookName];
		if (typeof hook !== 'function') {
			return undefined;
		}
		return hook(context);
	}

	function getEffectiveBeatDelayMillis(context) {
		const defaultDelayMillis = context.defaultDelayMillis;
		const providerName = looperTimingMode === LoopTimingMode.TRANSPORT
			? 'getTransportDelayMillis'
			: 'getVisualDelayMillis';
		const candidate = callTimingHook(providerName, context);
		if (Number.isFinite(candidate) && candidate >= 0) {
			return candidate;
		}
		return defaultDelayMillis;
	}

	function scheduleNextBeatTick(loopKind) {
		if (!isLoopKindActive(loopKind)) {
			return null;
		}
		const song = getSong();
		const timingContext = buildTimingContext({
			loopKind,
			song,
			defaultDelayMillis: getMillisForBeatClock()
		});
		const delayMillis = getEffectiveBeatDelayMillis(timingContext);
		callTimingHook('beforeScheduleNextTick', timingContext);
		showBeatsTimerPointer = startLoopTimer(() => runScheduledBeatTick(loopKind), delayMillis);
		callTimingHook('afterScheduleNextTick', { ...timingContext, scheduledDelayMillis: delayMillis });
		return showBeatsTimerPointer;
	}

	function runScheduledBeatTick(loopKind) {
		showBeatsTimerPointer = null;
		if (!isLoopKindActive(loopKind)) {
			return;
		}
		const song = getSong();
		if (!song || typeof song.getBeat !== 'function' || typeof song.getBeats !== 'function') {
			return;
		}
		const timingContext = buildTimingContext({ loopKind, song });
		callTimingHook('beforeBeatTick', timingContext);
		const tickResult = tickBeat(song, {
			sectionsLooping: loopKind === 'sections',
			showBeats
		});
		callTimingHook('afterBeatTick', { ...timingContext, tickResult });
		if (isLoopKindActive(loopKind)) {
			scheduleNextBeatTick(loopKind);
		}
	}

	export function clearBeatAndSectionLooping(){
		const wasSectionsLooping = isSectionsLooping;
		const wasBeatsLooping = isBeatsLooping;
		const loopKind = getLoopKind();
		isSectionsLooping = false;
		isBeatsLooping = false;
		if (showBeatsTimerPointer !== null) {
			stopLoopTimer(showBeatsTimerPointer);
		}
		showBeatsTimerPointer = null;
		callTimingHook('resetTimingState', { reason: 'stop-loop', loopKind }, { ignoreTimingMode: true });
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
		callTimingHook('resetTimingState', { reason: 'start-loop', loopKind: 'sections' }, { ignoreTimingMode: true });
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
			emitSectionBeginForCurrentSong(song);
        }

		scheduleNextBeatTick('sections');
    }

	function startLoopBeats(){
		isSectionsLooping = false;
		isBeatsLooping = true;
		const song = getSong();
		callTimingHook('resetTimingState', { reason: 'start-loop', loopKind: 'beats' }, { ignoreTimingMode: true });
		EventBus.trigger('Looper:OnLoopBeatsStart', {
			caption: LOOPING_BEATS_CAPTION
		});

		if (song) {
			const isSongBegin = song.getSectionsCurrentIndex() === 0 && song.getBeat() === 1;
			if (isSongBegin) {
				EventBus.trigger('DaCapo:OnSongBegin', {
					sectionIndex: song.getSectionsCurrentIndex(),
					sectionCount: song.getSections().length,
					beat: song.getBeat(),
					beats: song.getBeats()
				});
			}
			emitSectionBeginForCurrentSong(song);
		}

		scheduleNextBeatTick('beats');
	}

	export function toggleLoopSections(){
		var sectionsLoopingBool = sectionsLooping();
	    if(showBeatsTimerPointer){
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

	export function restartLoopBeats(){
		if (beatsLooping()){
			clearBeatAndSectionLooping();
			startLoopBeats();
		} else {
			startLoopBeats();
		}
	}

	export function toggleLoopBeats(){
	    var beatsLoopingBool = beatsLooping();
	    if(showBeatsTimerPointer){
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

	export function notifySectionRestartIfLooping(){
		if (!sectionsLooping() && !beatsLooping()) {
			return;
		}
		emitSectionBeginForCurrentSong(getSong());
	}

    export function tickBeat(song, { sectionsLooping, showBeats }) {
        var beat = song.getBeat();
        var beats = song.getBeats();
		const result = {
			beat,
			beats,
			sectionTransition: false,
			songEnd: false,
			timingMode: looperTimingMode,
			loopKind: sectionsLooping ? 'sections' : 'beats'
		};
    
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
						callTimingHook('beforeSectionTransition', {
						...result,
						song,
						sectionIndex: currentSectionIndex,
						sectionCount
						});
                if (isLastSection) {
						result.songEnd = true;
                    EventBus.trigger('DaCapo:OnSongEnd', {
                        sectionIndex: currentSectionIndex,
                        sectionCount,
                        beat,
                        beats
                    });
                }
    
                song.gotoNextSection(true);  //calls showBeats()
				result.sectionTransition = true;
    
				emitSectionBeginForCurrentSong(song);
				callTimingHook('afterSectionTransition', {
					...result,
					song,
					nextSectionIndex: song.getSectionsCurrentIndex(),
					nextBeat: song.getBeat(),
					nextBeats: song.getBeats()
				});
            } else {
                song.incBeatLoop();
				emitSectionBeginForCurrentSong(song);
                showBeats();
            }
        } else {
            song.incBeatLoop();
            showBeats();
        }
		return result;
    }

	export function __resetLooperForTests(){
		showBeatsTimerPointer = null;
		isSectionsLooping = false;
		isBeatsLooping = false;
		looperTimingMode = LoopTimingMode.VISUAL;
		looperTimingProviders = { ...defaultTimingProviders };
	}
