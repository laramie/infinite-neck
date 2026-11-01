import {
	MIDI_COLOR_MAP_IDS,
	LAUNCHPAD_MAJOR_COLOR_VELOCITIES,
	resolveLaunchpadVelocityForColorClass
} from '../../templates/midi/midiColorMaps.js';
import { 
    LAUNCHPAD_VELOCITY_DEFAULT 
} from '../../midi-io.js';


describe('midiColorMaps', () => {
	// CYCLE_ORDER (midiColorMaps.js) is deliberately re-tunable by developers as
	// the color maps get tweaked, so these tests avoid asserting any literal
	// velocity produced by a specific wheel position -- only structural
	// properties that must hold true regardless of how CYCLE_ORDER is ordered.
	test('LaunchpadCycleOfColors resolves a direct note-function key ("note4") to a real velocity', () => {
		const velocity = resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note4');
		expect(typeof velocity).toBe('number');
		expect(Number.isFinite(velocity)).toBe(true);
	});

	test('LaunchpadCycleOfColors resolves a note-function key and its equivalent resolved palette colorClass to the same wheel position', () => {
		// note4's colorClass in gDefault_CycleOfColors is "noteBlue1" -- same slot as 'note4',
		// regardless of what velocity CYCLE_ORDER currently assigns to that slot.
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'noteBlue1'))
			.toBe(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note4'));
		// note8's colorClass is "noteRed2" -- same slot as 'note8', regardless of CYCLE_ORDER.
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'noteRed2'))
			.toBe(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note8'));
	});

	test('LaunchpadColors resolves a family+shade colorClass by family base + dimmer band', () => {
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'noteBlue1'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.BLUE);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'noteBlue7'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.BLUE + 2);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'noteRed4'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED + 1);
	});

	test('LaunchpadColors resolves a family with no shade digit (e.g. noteWhite) to the base velocity', () => {
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'noteWhite'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.WHITE);
	});

	test('unresolvable colorClasses fall back to plain red', () => {
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'noteTransparent'))
			.toBe(LAUNCHPAD_VELOCITY_DEFAULT);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, ''))
			.toBe(LAUNCHPAD_VELOCITY_DEFAULT);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, undefined))
			.toBe(LAUNCHPAD_VELOCITY_DEFAULT);
	});

	test('LaunchpadColors still resolves a note-function key via its cycle fallback, matching LaunchpadCycleOfColors', () => {
		// 'note9' has no family+shade match for LaunchpadColors' own resolver, so it must fall
		// back to the SAME wheel position LaunchpadCycleOfColors would resolve it to -- whatever
		// that currently is, per CYCLE_ORDER.
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'note9'))
			.toBe(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note9'));
	});
});

