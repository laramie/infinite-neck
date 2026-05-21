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

	replayCurrentSectionView() {
		return this.requireProvider('replayCurrentSectionView')();
	}

	syncSectionUi() {
		return this.requireProvider('syncSectionUi')();
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
		song.gotoFirstBeat();
		this.syncSectionUi();
		this.replayCurrentSectionView();
		const didEmitSongBegin = this.emitSongBegin(song);
		return {
			result: '' + (this.getSectionsCurrentIndex() + 1),
			didEmitSongBegin,
			didEmitSectionBegin: this.emitSectionBegin(song)
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