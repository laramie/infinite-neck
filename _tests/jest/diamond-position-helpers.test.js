import { fretToDiamondCellcol, tableHasDiamondNutColumn } from '../../diamond-position-helpers.js';

describe('diamond position helpers', () => {
	test('maps semantic frets to nut-shifted diamond cell columns when a nut column is present', () => {
		expect(fretToDiamondCellcol(0, true)).toBe(-1);
		expect(fretToDiamondCellcol(1, true)).toBe(0);
		expect(fretToDiamondCellcol(4, true)).toBe(3);
	});

	test('leaves semantic frets unchanged when no nut column is present', () => {
		expect(fretToDiamondCellcol(0, false)).toBe(0);
		expect(fretToDiamondCellcol(1, false)).toBe(1);
		expect(fretToDiamondCellcol(4, false)).toBe(4);
	});

	test('detects nut-column availability from the rendered diamond row', () => {
		const findDiamondCell = (tableID, cellcol) => ({
			length: tableID === 'tblARP' && cellcol === '-1' ? 1 : 0
		});

		expect(tableHasDiamondNutColumn(findDiamondCell, 'tblARP')).toBe(true);
		expect(tableHasDiamondNutColumn(findDiamondCell, 'tblNO_NUT')).toBe(false);
	});
});