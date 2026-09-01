import EventBus from './event-bus.js';
import * as InfiniteNeck from './infinite-neck.js';
import { createLooperTransportTimingProviders } from './looper-transport-timing.js';
import { applyLoopSectionFilterToSong } from './SongNavigationHooks.js';

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

	function updateRealtimeTickStart(text){
		InfiniteNeck.updateRealtimeTickStart(text);
	}

	/** HH:MM:SS.mmm local wall-clock string -- millisecond resolution is needed to see the
	 *  ~100-250ms hiccups reported at section-boundary ticks. See logRealtimeTick(). */
	function formatRealtimeTick(nowMillis){
		const d = new Date(nowMillis);
		const hh = String(d.getHours()).padStart(2, '0');
		const mm = String(d.getMinutes()).padStart(2, '0');
		const ss = String(d.getSeconds()).padStart(2, '0');
		const ms = String(d.getMilliseconds()).padStart(3, '0');
		return `${hh}:${mm}:${ss}.${ms}`;
	}

	/** Logs sectionIndex/beat/current-time to the console, and mirrors the same time into the
	 *  #realtimeTickStart span (divQuick, index.html), for every beat tick -- called right as the
	 *  scheduled timer fires, BEFORE tickBeat() runs (tickBeat is what may trigger a heavy
	 *  section-transition table rebuild). Comparing successive log-line/span timestamps against the
	 *  LooperLight's paint flash is meant to reveal whether a perceived delay comes from the timer
	 *  itself firing late, or from synchronous work done after the timer fires blocking the browser's
	 *  paint of the new beat. */
	function logRealtimeTick(song, loopKind){
		const nowMillis = Date.now();
		const sectionIndex = song.getSectionsCurrentIndex();
		const beat = song.getBeat();
		const nowText = formatRealtimeTick(nowMillis);
		console.log(`[LooperRealtimeTick] ${nowMillis}  s:${sectionIndex}:${beat}`);
		updateRealtimeTickStart(nowText);
	}

	function emitSectionBeginForCurrentSong(song, payload = {}){
		if (!song) {
			return;
		}
		EventBus.trigger('DaCapo:OnSectionBegin', {
			sectionIndex: song.getSectionsCurrentIndex(),
			sectionCount: song.getSections().length,
			beat: song.getBeat(),
			beats: song.getBeats(),
			...payload
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
		logRealtimeTick(song, loopKind);
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
        var song = getSong();
	    EventBus.trigger('Looper:OnLoopSectionsStart');
    
        if (song) {
            EventBus.trigger('DaCapo:OnSongBegin', {
                sectionIndex: song.getSectionsCurrentIndex(),
                sectionCount: song.getSections().length,
                beat: song.getBeat(),
                beats: song.getBeats()
            });
			emitSectionBeginForCurrentSong(song, {
				transportAction: 'StartLoopSections',
				reuseRandomSequence: true
			});
        }

		scheduleNextBeatTick('sections');
    }

	function startLoopBeats(){
		isSectionsLooping = false;
		isBeatsLooping = true;
		const song = getSong();
		callTimingHook('resetTimingState', { reason: 'start-loop', loopKind: 'beats' }, { ignoreTimingMode: true });
		EventBus.trigger('Looper:OnLoopBeatsStart');

		if (song) {
			emitSectionBeginForCurrentSong(song, {
				transportAction: 'StartLoopBeats',
				reuseRandomSequence: true
			});
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
				applyLoopSectionFilterToSong(song, {
					sectionLooping: true,
					beatLooping: false,
					previousSectionIndex: currentSectionIndex,
					sectionCount
				});
				result.sectionTransition = true;
				if (isLastSection) {
					EventBus.trigger('DaCapo:OnSongBegin', {
						sectionIndex: song.getSectionsCurrentIndex(),
						sectionCount: song.getSections().length,
						beat: song.getBeat(),
						beats: song.getBeats()
					});
				}
    
				emitSectionBeginForCurrentSong(song, {
					transportAction: 'LoopSectionsTransition',
					regenerateRandomSequence: true
				});
				callTimingHook('afterSectionTransition', {
					...result,
					song,
					nextSectionIndex: song.getSectionsCurrentIndex(),
					nextBeat: song.getBeat(),
					nextBeats: song.getBeats()
				});
            } else {
                song.incBeatLoop();
				emitSectionBeginForCurrentSong(song, {
					transportAction: 'LoopBeatsWrap',
					reuseRandomSequence: true
				});
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
