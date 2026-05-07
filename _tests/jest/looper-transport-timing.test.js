import { jest } from '@jest/globals';
import { createLooperTransportTimingProviders, resolveTransportClock, resolveWindowTransportClock } from '../../looper-transport-timing.js';

describe('looper transport timing providers', () => {
	test('prefers a window transport clock when present', () => {
		const windowObject = {
			transportClock: {
				now: () => 1234
			}
		};
		const resolved = resolveWindowTransportClock(windowObject);
		expect(resolved.label).toBe('window.transportClock.now');
		expect(resolved.now()).toBe(1234);
	});

	test('respects an injected high-resolution now() function', () => {
		let nowMillis = 1000;
		const resolved = resolveTransportClock({ now: () => nowMillis });
		expect(resolved.label).toBe('injected now() function');
		expect(resolved.now()).toBe(1000);
		nowMillis = 1025;
		expect(resolved.now()).toBe(1025);
	});

	test('keeps transport deadlines anchored to clock time', () => {
		let nowMillis = 500;
		const providers = createLooperTransportTimingProviders({
			now: () => nowMillis,
			getMillisForBeatClock: () => 120
		});

		providers.resetTimingState({ reason: 'start-loop', loopKind: 'sections' });
		expect(providers.getTransportDelayMillis({ loopKind: 'sections', defaultDelayMillis: 120 })).toBe(120);

		nowMillis = 680;
		providers.afterBeatTick({ loopKind: 'sections', defaultDelayMillis: 120 });
		expect(providers.getTransportDelayMillis({ loopKind: 'sections', defaultDelayMillis: 120 })).toBe(60);
	});

	test('tracks missed beats when processing runs long', () => {
		let nowMillis = 100;
		const providers = createLooperTransportTimingProviders({
			now: () => nowMillis,
			getMillisForBeatClock: () => 50
		});

		providers.resetTimingState({ reason: 'start-loop', loopKind: 'beats' });
		providers.getTransportDelayMillis({ loopKind: 'beats', defaultDelayMillis: 50 });

		nowMillis = 260;
		providers.afterBeatTick({ loopKind: 'beats', defaultDelayMillis: 50 });
		const state = providers.getTimingState();
		expect(state.missedBeats).toBeGreaterThan(0);
		expect(providers.getTransportDelayMillis({ loopKind: 'beats', defaultDelayMillis: 50 })).toBeGreaterThanOrEqual(0);
	});

	test('declares itself transport-only so visual mode can skip its hooks', () => {
		const providers = createLooperTransportTimingProviders({
			now: () => 0,
			getMillisForBeatClock: () => 100
		});
		expect(providers.supportedTimingModes).toEqual(['transport']);
		const spy = jest.spyOn(providers, 'afterBeatTick');
		providers.afterBeatTick({ timingMode: 'transport', loopKind: 'beats', defaultDelayMillis: 100 });
		expect(spy).toHaveBeenCalledTimes(1);
		spy.mockRestore();
	});
});