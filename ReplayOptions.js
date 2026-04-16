class ReplayOptions {
    // Properties with default values
    type = '';
    tablename = '';
    listenToTablename = '';
    currSection = null;
    sectionIndex = 0;
    relativeSection = '';
    directionType = '';
    sharps = '';
    rootID = '';
    rootIDLead = '';
    hideNamedNotes = false;
    hideTinyNotes = false;
    hideSingleNotes = false;
    hideFingering = false;
}

// Type constants
ReplayOptions.Type = Object.freeze({
    RELATIVE: 'RELATIVE',
    SELF: 'SELF',
    LISTENER: 'LISTENER'
});

export { ReplayOptions };
