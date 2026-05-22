function fallbackNowFactory() {
	const perf = globalThis?.performance;
	if (perf && typeof perf.now === 'function') {
		return {
			label: 'performance.now',
			now: () => perf.now()
		};
	}
	const dateOrigin = Date.now();
	return {
		label: 'Date.now',
		now: () => Date.now() - dateOrigin
	};
}

export function resolveWindowTransportClock(windowObject = globalThis?.window) {
	const candidates = [
		['__INFINITE_NECK_TRANSPORT_CLOCK__', windowObject?.__INFINITE_NECK_TRANSPORT_CLOCK__],
		['transportClock', windowObject?.transportClock],
		['systemClock', windowObject?.systemClock]
	];

	for (const [label, candidate] of candidates) {
		if (!candidate) {
			continue;
		}
		if (typeof candidate === 'function') {
			return {
				label: `window.${label}`,
				now: () => Number(candidate())
			};
		}
		if (typeof candidate.now === 'function') {
			return {
				label: `window.${label}.now`,
				now: () => Number(candidate.now())
			};
		}
		if (typeof candidate.getNow === 'function') {
			return {
				label: `window.${label}.getNow`,
				now: () => Number(candidate.getNow())
			};
		}
	}

	return null;
}

export function resolveTransportClock({ clock = null, windowObject = globalThis?.window, now = null } = {}) {
	if (typeof now === 'function') {
		return {
			label: 'injected now() function',
			now: () => Number(now())
		};
	}

	if (clock) {
		if (typeof clock === 'function') {
			return {
				label: 'injected clock() function',
				now: () => Number(clock())
			};
		}
		if (typeof clock.now === 'function') {
			return {
				label: clock.label || 'injected clock.now()',
				now: () => Number(clock.now())
			};
		}
	}

	return resolveWindowTransportClock(windowObject) || fallbackNowFactory();
}

function createInitialState(clockLabel = 'unknown') {
	return {
		clockLabel,
		activeLoopKind: null,
		beatDurationMillis: null,
		nextTickAtMillis: null,
		lastNowMillis: null,
		lastScheduledDelayMillis: null,
		lastResetReason: 'init',
		lastSectionTransitionAtMillis: null,
		missedBeats: 0
	};
}

function coercePositiveMillis(rawValue, fallbackMillis) {
	if (Number.isFinite(rawValue) && rawValue > 0) {
		return rawValue;
	}
	return fallbackMillis;
}

export function createLooperTransportTimingProviders(options = {}) {
	const {
		clock = null,
		windowObject = globalThis?.window,
		now = null,
		getMillisForBeatClock = () => 0
	} = options;

	const resolvedClock = resolveTransportClock({ clock, windowObject, now });
	let state = createInitialState(resolvedClock.label);

	function readNowMillis() {
		const candidate = Number(resolvedClock.now());
		if (Number.isFinite(candidate)) {
			state.lastNowMillis = candidate;
			return candidate;
		}
		const fallback = 0;
		state.lastNowMillis = fallback;
		return fallback;
	}

	function resetTimingState(context = {}) {
		state = createInitialState(resolvedClock.label);
		state.lastResetReason = context.reason || 'manual-reset';
		state.activeLoopKind = context.loopKind || null;
	}

	function ensureScheduleAnchor(context = {}) {
		const beatDurationMillis = coercePositiveMillis(
			context.defaultDelayMillis,
			coercePositiveMillis(getMillisForBeatClock(), 1)
		);
		const loopKind = context.loopKind || state.activeLoopKind || 'idle';
		const nowMillis = readNowMillis();

		if (state.activeLoopKind !== loopKind) {
			state.activeLoopKind = loopKind;
			state.nextTickAtMillis = null;
			state.missedBeats = 0;
		}

		state.beatDurationMillis = beatDurationMillis;
		if (!Number.isFinite(state.nextTickAtMillis)) {
			state.nextTickAtMillis = nowMillis + beatDurationMillis;
		}
		return { beatDurationMillis, nowMillis };
	}

	function getTransportDelayMillis(context = {}) {
		const { nowMillis } = ensureScheduleAnchor(context);
		return Math.max(0, state.nextTickAtMillis - nowMillis);
	}

	function afterBeatTick(context = {}) {
		const { beatDurationMillis, nowMillis } = ensureScheduleAnchor(context);
		state.nextTickAtMillis += beatDurationMillis;
		while (state.nextTickAtMillis <= nowMillis) {
			state.nextTickAtMillis += beatDurationMillis;
			state.missedBeats += 1;
		}
	}

	function afterScheduleNextTick(context = {}) {
		state.lastScheduledDelayMillis = context.scheduledDelayMillis;
	}

	function afterSectionTransition() {
		state.lastSectionTransitionAtMillis = readNowMillis();
	}

	function getTimingState() {
		return { ...state };
	}

	return {
		supportedTimingModes: ['transport'],
		resetTimingState,
		getTransportDelayMillis,
		afterBeatTick,
		afterScheduleNextTick,
		afterSectionTransition,
		getTimingState
	};
}

export default createLooperTransportTimingProviders;