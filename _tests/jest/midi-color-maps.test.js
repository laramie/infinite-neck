import {
	MIDI_COLOR_MAP_IDS,
	LAUNCHPAD_MAJOR_COLOR_VELOCITIES,
	resolveLaunchpadVelocityForColorClass
} from '../../templates/midi/midiColorMaps.js';

describe('midiColorMaps', () => {
	// gDefault_CycleOfColors.dict order is note1..note12; CYCLE_ORDER was
	// manually re-ordered (see midiColorMaps.js's "Numbers re-ordered by
	// Laramie, 20260901" comment), so these expectations follow that current
	// positional pairing, not the original note1->RED assumption.
	test('LaunchpadCycleOfColors resolves a direct note-function key ("note4") to its wheel position', () => {
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note1'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.LIGHT_BLUE);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note4'))
			.toBe(79);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'note12'))
			.toBe(75);
	});

	test('LaunchpadCycleOfColors resolves the equivalent resolved palette colorClass to the same wheel position', () => {
		// note4's colorClass in gDefault_CycleOfColors is "noteBlue1" -- same slot as 'note4'.
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'noteBlue1'))
			.toBe(79);
		// note8's colorClass is "noteRed2".
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, 'noteRed2'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED);
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
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, ''))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED);
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS, undefined))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED);
	});

	test('LaunchpadColors still resolves a note-function key via its cycle fallback', () => {
		expect(resolveLaunchpadVelocityForColorClass(MIDI_COLOR_MAP_IDS.LAUNCHPAD_COLORS, 'note9'))
			.toBe(LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW + 2);
	});
});
