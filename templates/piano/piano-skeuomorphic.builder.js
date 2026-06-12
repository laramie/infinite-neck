const PIANO_BASE_INSTRUMENT = 'Piano';

function isPianoTuning(tuning) {
    return !!tuning && tuning.baseInstrument === PIANO_BASE_INSTRUMENT;
}

export function supportsPianoSkeuomorphic(tuning) {
    return Boolean(
        isPianoTuning(tuning)
        && Array.isArray(tuning.rowRange)
    );
}

export function normalizePianoLayoutOptions(tuning) {
    if (!tuning || typeof tuning !== 'object') {
        return tuning;
    }
    if (isPianoTuning(tuning)) {
        tuning.nut = false;
        tuning.stringDividerHeight = '0';
    }
    if (tuning.pianoSkeuomorphic === true) {
        tuning.pianoNamesRow = false;
    }
    return tuning;
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