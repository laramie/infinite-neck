/*  Copyright (c) 2026 Laramie Crocker http://LaramieCrocker.com  */

// Sprint 143 (midi-note-in), Iteration 3 follow-up: see
// _doco/design/sprints/143-midi-note-in/143-design-3.md for the device model
// this supports ("device.colorMap" selects one of the map IDs below).
//
// Provides device-specific color->velocity resolution ("algorithm objects" per
// the design discussion), organized similarly to themes.js/userColors.js:
// plain, DOM-free lookup tables plus small resolver functions. Kept in
// templates/midi/ (not the repo root) since this is MIDI-device-specific, not
// a core app concern -- mirrors how templates/piano/ and templates/mobile-keyboard/
// hold feature-scoped, non-core code.
//
// Pure and unit-tested (_tests/jest/midi-color-maps.test.js); no DOM/navigator
// access.

import { gDefault_CycleOfColors } from '../../userColors.js';
import { LAUNCHPAD_VELOCITY_RED } from '../../midi-io.js';

export const MIDI_COLOR_MAP_IDS = Object.freeze({
	LAUNCHPAD_CYCLE_OF_COLORS: 'LaunchpadCycleOfColors',
	LAUNCHPAD_COLORS: 'LaunchpadColors'
});

// Launchpad Pro's major color velocity values, per 143-design-3.md's device
// documentation excerpt. Each has two dimmer variants at +1/+2 (not modeled
// individually here -- see resolveLaunchpadVelocityForFamilyColorClass()).
export const LAUNCHPAD_MAJOR_COLOR_VELOCITIES = Object.freeze({
	WHITE: 3, // exception value, not part of the 12-color wheel
	RED: 5,
	ORANGE: 9,
	YELLOW_AMBER: 13,
	YELLOW: 17,
	YELLOW_GREEN: 21,
	GREEN: 25,
	TURQUOISE: 29,
	LIGHT_BLUE: 33,
	BLUE: 37,
	PURPLE: 41,
	MAGENTA: 45,
	PINK: 49
});

// "LaunchpadCycleOfColors": a positional 1:1 pairing of the Launchpad's 12
// major colors with this repo's 12 CycleOfColors note-function slots
// (note1..note12, see gDefault_CycleOfColors in userColors.js) -- a note
// colored via the note-function scheme lights the device at the matching
// wheel position.
// Numbers re-ordered by Laramie, 20260901
//     x LAUNCHPAD_MAJOR_COLOR_VELOCITIES.PURPLE,
//     x LAUNCHPAD_MAJOR_COLOR_VELOCITIES.TURQUOISE,       //   II
//     x LAUNCHPAD_MAJOR_COLOR_VELOCITIES.PINK           //   Say
//       LAUNCHPAD_MAJOR_COLOR_VELOCITIES.BLUE,          //   Was III , a lovely light blue.  Very close to the I.
//       LAUNCHPAD_MAJOR_COLOR_VELOCITIES.MAGENTA+2,       //  Tau MAGENTA==45
//     81, //LAUNCHPAD_MAJOR_COLOR_VELOCITIES.MAGENTA,       //   II
//       LAUNCHPAD_MAJOR_COLOR_VELOCITIES.TURQUOISE+2,           //   dom GREEN + 1 GREEN + 2
//       LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_GREEN+2    //   Say 
    
//  Numbers used below are launchpad numbers

const CYCLE_ORDER = [
    3, //white //57, // spec. LAUNCHPAD_MAJOR_COLOR_VELOCITIES.LIGHT_BLUE,         //   I
	51,                                                  //   Tau MAGENTA==45
	59, //good-pink:53,                                                  //   II
	47,                                                  //   m
	79,               //   III
	11, //60, //pumpkin for IV. 84, //LAUNCHPAD_MAJOR_COLOR_VELOCITIES.ORANGE,             //   IV
	60, //127, //more subtle. 9, //84, //More agressive yellow-orange for tritone. 83, //62, //OR: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.ORANGE+2,           //   Tri
	7, //blood-red.  //120 PURE red. //blood-red:7, //LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED,                //   V
	15, //LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW+2,           //   sa
	LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_AMBER,       //   6
	35, //forest green. LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW_GREEN+1,     //   dom
	21//37,//spec.   75,                                                  //   Say 
];

function buildCycleOfColorsVelocityByNoteKey() {
	const noteKeys = Object.keys(gDefault_CycleOfColors.dict); // note1..note12, in declared order
	const map = {};
	noteKeys.forEach((noteKey, index) => {
		map[noteKey] = CYCLE_ORDER[index % CYCLE_ORDER.length];
	});
    console.log("buildCycleOfColorsVelocityByNoteKey:"+JSON.stringify(map));
	return map;
}
const LAUNCHPAD_CYCLE_OF_COLORS_VELOCITY_BY_NOTE_KEY = buildCycleOfColorsVelocityByNoteKey();

// colorClass strings coming from the model are often space-separated compound
// CSS classes (e.g. gUserColorDict's noteRoot="noteBlack noteHatchedRoot", or
// a hatched overlay like "noteHatched4 noteBlue7") -- inspect every token
// rather than requiring the whole string to match a single known class.
function tokenize(colorClass) {
	return `${colorClass || ''}`.split(/\s+/).filter(Boolean);
}

function resolveLaunchpadVelocityForCycleColorClass(colorClass) {
	// colorClass may already be a direct note-function key ("note4", set by
	// NoteTableController's automatic-color path), or the palette colorClass
	// that key maps to in gDefault_CycleOfColors ("noteBlue1") -- both should
	// resolve to the same wheel position.
	const tokens = tokenize(colorClass);
	for (const token of tokens) {
		if (LAUNCHPAD_CYCLE_OF_COLORS_VELOCITY_BY_NOTE_KEY[token] !== undefined) {
			return LAUNCHPAD_CYCLE_OF_COLORS_VELOCITY_BY_NOTE_KEY[token];
		}
	}
	for (const token of tokens) {
		const noteKey = Object.keys(gDefault_CycleOfColors.dict).find(
			(key) => gDefault_CycleOfColors.dict[key].colorClass === token
		);
		if (noteKey) {
			return LAUNCHPAD_CYCLE_OF_COLORS_VELOCITY_BY_NOTE_KEY[noteKey];
		}
	}
	return null;
}

// "LaunchpadColors": approximates any of this repo's note<Family><Shade> color
// classes (see colorPickerColors.js) by family + a coarse brightness band,
// using the major-color base velocity plus the +1/+2 dimmer offsets
// documented in 143-design-3.md. This is a best-effort prototype mapping (a
// simple deterministic formula), not a curated per-class lookup table.
const FAMILY_BASE_VELOCITY = Object.freeze({
	Red: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.RED,
	Brown: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.ORANGE,
	Pink: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.PINK,
	Blue: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.BLUE,
	Green: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.GREEN,
	Yellow: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.YELLOW,
	White: LAUNCHPAD_MAJOR_COLOR_VELOCITIES.WHITE
});
const COLOR_CLASS_PATTERN = /^note(Red|Brown|Pink|Blue|Green|Yellow|White)(\d+)?$/;

function resolveLaunchpadVelocityForFamilyColorClass(colorClass) {
	for (const token of tokenize(colorClass)) {
		const match = COLOR_CLASS_PATTERN.exec(token);
		if (!match) {
			continue;
		}
		const [, family, shadeText] = match;
		const base = FAMILY_BASE_VELOCITY[family];
		if (base === undefined) {
			continue;
		}
		const shade = Number.parseInt(shadeText, 10) || 1; // 1-7
		const dimmerOffset = Math.min(2, Math.floor(((shade - 1) * 3) / 7)); // bands 7 shades into 0/1/2
		return base + dimmerOffset;
	}
	return null;
}

// Resolves a played note's colorClass (e.g. "noteBlue2", "note4", "noteRoot")
// to a Launchpad NOTE ON velocity, per the device's configured colorMap.
// Falls back to LAUNCHPAD_VELOCITY_RED (plain red) when the colorClass isn't
// resolvable by either scheme -- e.g. "noteTransparent"/"noteAutomatic"
// placeholder classes, or families not covered by FAMILY_BASE_VELOCITY.
export function resolveLaunchpadVelocityForColorClass(colorMapID, colorClass) {
	if (colorMapID === MIDI_COLOR_MAP_IDS.LAUNCHPAD_CYCLE_OF_COLORS) {
		return resolveLaunchpadVelocityForCycleColorClass(colorClass)
			?? resolveLaunchpadVelocityForFamilyColorClass(colorClass)
			?? LAUNCHPAD_VELOCITY_RED;
	}
	return resolveLaunchpadVelocityForFamilyColorClass(colorClass)
		?? resolveLaunchpadVelocityForCycleColorClass(colorClass)
		?? LAUNCHPAD_VELOCITY_RED;
}
