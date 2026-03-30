import EventBus from '../event-bus.js';
import { transposeSong } from '../infinite-neck.js';

function toHookEventName(hookPoint) {
	switch (hookPoint) {
		case DaCapo.ON_SECTION_BEGIN:
			return 'DaCapo:OnSectionBegin';
		case DaCapo.ON_SECTION_END:
			return 'DaCapo:OnSectionEnd';
		case DaCapo.ON_SONG_BEGIN:
			return 'DaCapo:OnSongBegin';
		case DaCapo.ON_SONG_END:
			return 'DaCapo:OnSongEnd';
		default:
			return null;
	}
}

function normalizeStringParam(value, fallback) {
	if (typeof value === 'string') {
		return value;
	}
	if (value === null || typeof value === 'undefined') {
		return fallback;
	}
	return String(value);
}

export class DaCapo {
	static ON_SECTION_BEGIN = 'ON_SECTION_BEGIN';
	static ON_SECTION_END = 'ON_SECTION_END';
	static ON_SONG_BEGIN = 'ON_SONG_BEGIN';
	static ON_SONG_END = 'ON_SONG_END';

	constructor({ eventBus = EventBus, transposeSongAction = transposeSong, logger = console } = {}) {
		this.eventBus = eventBus;
		this.transposeSongAction = transposeSongAction;
		this.logger = logger;
		this.installedHooks = new Map();
	}

	installHook(hookPoint, amount = '0', sections = '[]') {
		const eventName = toHookEventName(hookPoint);
		if (!eventName) {
			throw new Error('DaCapo.installHook() unsupported hook point: ' + hookPoint);
		}

		this.uninstallHook(hookPoint);

		const hookConfig = {
			hookPoint,
			eventName,
			amount: normalizeStringParam(amount, '0'),
			sections: normalizeStringParam(sections, '[]')
		};

		const handler = (payload) => {
			this.handleHook(hookConfig, payload);
		};

		this.eventBus.on(eventName, handler);
		this.installedHooks.set(hookPoint, {
			...hookConfig,
			handler
		});

		return hookConfig;
	}

	uninstallHook(hookPoint) {
		const installed = this.installedHooks.get(hookPoint);
		if (!installed) {
			return false;
		}
		this.eventBus.off(installed.eventName, installed.handler);
		this.installedHooks.delete(hookPoint);
		return true;
	}

	clearHooks() {
		Array.from(this.installedHooks.keys()).forEach((hookPoint) => {
			this.uninstallHook(hookPoint);
		});
	}

	dispose() {
		this.clearHooks();
	}

	handleHook(hookConfig, payload) {
		switch (hookConfig.hookPoint) {
			case DaCapo.ON_SONG_END:
				this.handleSongEnd(hookConfig, payload);
				return;
			case DaCapo.ON_SECTION_BEGIN:
			case DaCapo.ON_SECTION_END:
			case DaCapo.ON_SONG_BEGIN:
				return;
			default:
				this.warn('DaCapo.handleHook() unsupported hook point: ' + hookConfig.hookPoint);
		}
	}

	handleSongEnd(hookConfig, payload) {
		const amount = this.parseAmount(hookConfig.amount);
		const sections = this.parseSections(hookConfig.sections);

		if (sections.length > 0) {
			this.warn('DaCapo ON_SONG_END currently ignores sections filter: ' + hookConfig.sections);
		}

        this.logger.log("========= in handleSongEnd===== \n ==== hookConfig:\n"+JSON.stringify(hookConfig)+"   \n ==== payload:\n"+JSON.stringify(payload));
		this.transposeSongAction(amount);
		return {
			amount,
			sections,
			payload
		};
	}

	parseAmount(amountSpec) {
		const parsed = Number.parseInt(normalizeStringParam(amountSpec, '0'), 10);
		if (Number.isNaN(parsed)) {
			throw new Error('DaCapo amount must be an integer string. Received: ' + amountSpec);
		}
		return parsed;
	}

	parseSections(sectionsSpec) {
		const normalized = normalizeStringParam(sectionsSpec, '[]').trim();
		if (normalized.length === 0) {
			return [];
		}

		let parsed;
		try {
			parsed = JSON.parse(normalized);
		} catch (err) {
			throw new Error('DaCapo sections must be a JSON array string. Received: ' + sectionsSpec);
		}

		if (!Array.isArray(parsed)) {
			throw new Error('DaCapo sections must decode to an array. Received: ' + sectionsSpec);
		}

		return parsed.map((value) => Number.parseInt(String(value), 10)).filter((value) => !Number.isNaN(value));
	}

	warn(message) {
		if (this.logger && typeof this.logger.warn === 'function') {
			this.logger.warn(message);
		}
	}

	static emit(hookPoint, payload = {}, eventBus = EventBus) {
		const eventName = toHookEventName(hookPoint);
		if (!eventName) {
			throw new Error('DaCapo.emit() unsupported hook point: ' + hookPoint);
		}
		eventBus.trigger(eventName, payload);
	}
}

export default DaCapo;
