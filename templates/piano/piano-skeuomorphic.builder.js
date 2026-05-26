const PIANO_BASE_INSTRUMENT = 'Piano';

export function supportsPianoSkeuomorphic(tuning) {
    return Boolean(
        tuning
        && tuning.baseInstrument === PIANO_BASE_INSTRUMENT
        && Array.isArray(tuning.rowRange)
        && tuning.rowRange.length === 1
    );
}

export function isPianoSkeuomorphicEnabled(tuning) {
    return supportsPianoSkeuomorphic(tuning) && tuning.pianoSkeuomorphic === true;
}

export function decoratePianoSkeuomorphicTable(table, tuning) {
    if (!isPianoSkeuomorphicEnabled(tuning)) {
        return false;
    }
    table.addClass('pianoSkeuomorphicTable');
    table.attr('data-piano-skeuomorphic', 'true');
    table.attr('data-piano-row-count', String(tuning.rowRange.length));
    table.attr('data-base-instrument', tuning.baseInstrument);
    return true;
}