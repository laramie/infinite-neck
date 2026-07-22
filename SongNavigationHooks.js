let loopSectionFilter = null;

export function setLoopSectionFilter(filterFn = null) {
    loopSectionFilter = typeof filterFn === 'function' ? filterFn : null;
}

export function clearLoopSectionFilter() {
    loopSectionFilter = null;
}

export function filterLoopSectionIndex(candidateIndex, context = {}) {
    if (!loopSectionFilter) {
        return candidateIndex;
    }
    const filtered = loopSectionFilter(candidateIndex, context);
    return Number.isInteger(filtered) ? filtered : candidateIndex;
}

export function applyLoopSectionFilterToSong(song, context = {}) {
    if (!song || typeof song.getSectionsCurrentIndex !== 'function') {
        return false;
    }
    const candidateIndex = song.getSectionsCurrentIndex();
    const filteredIndex = filterLoopSectionIndex(candidateIndex, {
        ...context,
        candidateIndex,
        song
    });
    if (!Number.isInteger(filteredIndex) || filteredIndex === candidateIndex) {
        return false;
    }
    if (typeof song.gotoSection === 'function') {
        song.gotoSection(filteredIndex);
        return true;
    }
    if (typeof song.gotoSectionStateOnly === 'function') {
        return song.gotoSectionStateOnly(filteredIndex);
    }
    return false;
}
