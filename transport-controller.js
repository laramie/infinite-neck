import EventBus from './event-bus.js';
import {
	beatsLooping,
	clearBeatAndSectionLooping,
	restartLoopBeats,
	restartLoopSections,
	sectionsLooping,
	toggleLoopBeats,
	toggleLoopSections
} from './looper.js';

export class TransportController {
	constructor(providers = {}) {
		this.providers = { ...providers };
	}

	setProviders(nextProviders = {}) {
		this.providers = { ...this.providers, ...nextProviders };
	}

	requireProvider(name) {
		const provider = this.providers[name];
		if (typeof provider !== 'function') {
			throw new Error('TransportController missing provider: ' + name);
		}
		return provider;
	}

	getSong() {
		return this.requireProvider('getSong')();
	}

	clearAndReplaySection() {
		return this.requireProvider('clearAndReplaySection')();
	}

	getSectionsCurrentIndex() {
		return this.requireProvider('getSectionsCurrentIndex')();
	}

	getCurrentSection() {
		return this.requireProvider('getCurrentSection')();
	}

	getBPM() {
		return this.requireProvider('getBPM')();
	}

	setBPMValue(nextBpm) {
		return this.requireProvider('setBPM')(nextBpm);
	}

	replayCurrentSectionView() {
		return this.requireProvider('replayCurrentSectionView')();
	}

	syncSectionUi() {
		return this.requireProvider('syncSectionUi')();
	}

	refreshBeatUi(song = this.getSong()) {
		if (!song) {
			return;
		}
		if (typeof song.publish_UpdateSectionStatus === 'function') {
			song.publish_UpdateSectionStatus();
		}
		if (typeof song.requestUiShowBeats === 'function') {
			song.requestUiShowBeats();
		}
	}

	clearHighlights(song = this.getSong()) {
		if (song && typeof song.requestUiClearHighlights === 'function') {
			song.requestUiClearHighlights();
		}
	}

	replaySectionFromStart(song = this.getSong()) {
		song.gotoFirstBeat();
		this.syncSectionUi();
		this.replayCurrentSectionView();
	}

	emitSongBegin(song = this.getSong()) {
		if (!song) {
			return false;
		}
		const sections = typeof song.getSections === 'function' ? song.getSections() : song.sections;
		EventBus.trigger('DaCapo:OnSongBegin', {
			sectionIndex: song.getSectionsCurrentIndex(),
			sectionCount: Array.isArray(sections) ? sections.length : 0,
			beat: song.getBeat(),
			beats: song.getBeats()
		});
		return true;
	}

	emitSectionBegin(song = this.getSong()) {
		if (!song) {
			return false;
		}
		const sections = typeof song.getSections === 'function' ? song.getSections() : song.sections;
		EventBus.trigger('DaCapo:OnSectionBegin', {
			sectionIndex: song.getSectionsCurrentIndex(),
			sectionCount: Array.isArray(sections) ? sections.length : 0,
			beat: song.getBeat(),
			beats: song.getBeats()
		});
		return true;
	}

	emitSectionBeginIfLooping(song = this.getSong()) {
		if (!sectionsLooping() && !beatsLooping()) {
			return false;
		}
		return this.emitSectionBegin(song);
	}

	emitSongBeginIfSectionLooping(song = this.getSong()) {
		if (!sectionsLooping()) {
			return false;
		}
		return this.emitSongBegin(song);
	}

	getActiveLoopState() {
		return {
			sections: sectionsLooping(),
			beats: beatsLooping()
		};
	}

	restartCapturedLoopState(loopState) {
		if (loopState.sections) {
			restartLoopSections();
		} else if (loopState.beats) {
			restartLoopBeats();
		}
	}

	restartSection() {
		const song = this.getSong();
		song.gotoFirstBeat();
		this.replayCurrentSectionView();
		return {
			result: '' + this.getCurrentSection().currentBeat,
			didEmitSectionBegin: this.emitSectionBeginIfLooping()
		};
	}

	goFirstSection() {
		const song = this.getSong();
		song.firstSectionStateOnly();
		this.replaySectionFromStart(song);
		const didEmitSongBegin = this.emitSongBeginIfSectionLooping(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1),
			didEmitSongBegin,
			didEmitSectionBegin: this.emitSectionBeginIfLooping(song)
		};
	}

	prevSection() {
		const song = this.getSong();
		song.gotoPrevSectionStateOnly(false);
		this.replaySectionFromStart(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1)
		};
	}

	nextSection() {
		const song = this.getSong();
		song.gotoNextSectionStateOnly(false);
		this.replaySectionFromStart(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1)
		};
	}

	lastSection() {
		const song = this.getSong();
		song.lastSectionStateOnly();
		this.replaySectionFromStart(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1)
		};
	}

	gotoSection(sectionIndex) {
		const song = this.getSong();
		if (!song.gotoSectionStateOnly(sectionIndex)) {
			return { result: '' + (this.getSectionsCurrentIndex() + 1), didNavigate: false };
		}
		this.replaySectionFromStart(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1),
			didNavigate: true
		};
	}

	prevBeat() {
		const song = this.getSong();
		this.clearHighlights(song);
		if (song.getBeat() > 1) {
			song.decBeat();
		}
		this.refreshBeatUi(song);
		return {
			result: '' + this.getCurrentSection().currentBeat
		};
	}

	nextBeat() {
		const song = this.getSong();
		this.clearHighlights(song);
		if (song.getBeat() < song.getBeats()) {
			song.incBeat();
		}
		this.refreshBeatUi(song);
		return {
			result: '' + this.getCurrentSection().currentBeat
		};
	}

	gotoLastBeat() {
		const song = this.getSong();
		song.gotoLastBeat();
		this.refreshBeatUi(song);
		return {
			result: '' + this.getCurrentSection().currentBeat
		};
	}

	gotoLastBeatInSong() {
		const song = this.getSong();
		song.lastSectionStateOnly();
		song.gotoLastBeat();
		this.syncSectionUi();
		this.replayCurrentSectionView();
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1) + ':' + this.getCurrentSection().currentBeat
		};
	}

	gotoBeat(targetBeat) {
		const song = this.getSong();
		song.gotoBeat(Math.min(targetBeat, song.getBeats()));
		this.refreshBeatUi(song);
		return {
			result: '' + this.getCurrentSection().currentBeat
		};
	}

	setBPM(nextBpm) {
		const bpm = Number.parseInt(nextBpm, 10);
		if (!Number.isNaN(bpm) && bpm > 0) {
			this.setBPMValue(bpm);
			this.restartCapturedLoopState(this.getActiveLoopState());
		}
		return {
			result: this.getBPM()
		};
	}

	resetSong(hard = false) {
		const song = this.getSong();
		if (!song) {
			return {
				result: hard ? 'reset song (hard) skipped: no song loaded' : 'reset song skipped: no song loaded'
			};
		}

		const loopState = this.getActiveLoopState();
		if (loopState.sections || loopState.beats) {
			clearBeatAndSectionLooping();
		}

		song.firstSectionStateOnly();
		song.gotoFirstBeat();
		EventBus.trigger('Looper:OnResetSong', {
			hard,
			sectionIndex: 0,
			sectionCount: Array.isArray(song.sections) ? song.sections.length : 0,
			beat: 1,
			beats: typeof song.getBeats === 'function' ? song.getBeats() : undefined
		});
		this.syncSectionUi();
		this.replayCurrentSectionView();
		this.restartCapturedLoopState(loopState);

		return {
			result: hard ? 'reset song (hard)' : 'reset song'
		};
	}

	toggleLoopSections() {
		toggleLoopSections();
		const song = this.getSong();
		const randomPrefix = song && song.randomLoop ? 'RANDOM ON, ' : 'RANDOM OFF, ';
		return {
			result: randomPrefix + (sectionsLooping() ? 'LOOP ON' : 'LOOP OFF')
		};
	}

	toggleLoopBeats() {
		toggleLoopBeats();
		return {
			result: beatsLooping() ? 'ON' : 'OFF'
		};
	}
}

export default TransportController;