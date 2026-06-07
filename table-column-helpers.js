export function getDisplayedCellcol(options = {}, columnIndex) {
	const parsedColumnIndex = Number.parseInt(columnIndex, 10);
	if (!Number.isInteger(parsedColumnIndex)) {
		return null;
	}
	const parsedFretCount = Number.parseInt(options.frets, 10);
	if (!Number.isInteger(parsedFretCount)) {
		return parsedColumnIndex;
	}
	return options.reverse ? parsedFretCount - parsedColumnIndex : parsedColumnIndex;
}

export function getDiamondMarkerFret(options = {}, columnIndex) {
	const displayedCellcol = getDisplayedCellcol(options, columnIndex);
	if (!Number.isInteger(displayedCellcol)) {
		return null;
	}
	if (options.nut || options.reverse) {
		return displayedCellcol;
	}
	return displayedCellcol + 1;
}