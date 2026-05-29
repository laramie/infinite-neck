export function tableHasDiamondNutColumn(findDiamondCellFn, tableID) {
	if (typeof findDiamondCellFn !== 'function' || !tableID) {
		return false;
	}
	const nutCell = findDiamondCellFn(tableID, '-1');
	return !!(nutCell && nutCell.length > 0);
}

export function fretToDiamondCellcol(fret, hasNutColumn = false) {
	const parsedFret = Number.parseInt(fret, 10);
	if (!Number.isInteger(parsedFret)) {
		return null;
	}
	return hasNutColumn ? parsedFret - 1 : parsedFret;
}