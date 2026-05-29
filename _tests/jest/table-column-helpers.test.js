import { getDiamondMarkerFret, getDisplayedCellcol } from '../../table-column-helpers.js';

describe('table column helpers', () => {
	test('note and diamond rows share the same displayed cellcol model when a nut is shown', () => {
		expect(getDisplayedCellcol({ frets: 16, reverse: false, nut: true }, 0)).toBe(0);
		expect(getDisplayedCellcol({ frets: 16, reverse: false, nut: true }, 3)).toBe(3);
		expect(getDisplayedCellcol({ frets: 16, reverse: true, nut: true }, 0)).toBe(16);
		expect(getDisplayedCellcol({ frets: 16, reverse: true, nut: true }, 16)).toBe(0);
	});

	test('diamond fret markers continue to resolve to fret locations for nut-bearing tables', () => {
		expect(getDiamondMarkerFret({ frets: 16, reverse: false, nut: true }, 3)).toBe(3);
		expect(getDiamondMarkerFret({ frets: 16, reverse: true, nut: true }, 13)).toBe(3);
	});

	test('diamond fret markers preserve non-nut column semantics', () => {
		expect(getDiamondMarkerFret({ frets: 24, reverse: false, nut: false }, 2)).toBe(3);
		expect(getDiamondMarkerFret({ frets: 24, reverse: true, nut: false }, 21)).toBe(3);
	});
});