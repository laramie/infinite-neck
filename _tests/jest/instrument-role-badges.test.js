import {
    classifyInstrumentRole,
    getSongInstrumentSummaries,
    renderInstrumentBadge,
    renderSongInstrumentBadges,
    renderSongInstrumentTable
} from '../../InstrumentRoleBadges.js';

describe('InstrumentRoleBadges', () => {
    test('classifies main, listener, and observer roles', () => {
        const wirings = [
            { tablename: 'tblPiano', listenToTablename: 'tblS6', relativeSection: '' },
            { tablename: 'tblS6Ahead', listenToTablename: 'tblS6', relativeSection: '+1' }
        ];

        expect(classifyInstrumentRole('tblS6', wirings)).toBe('Main');
        expect(classifyInstrumentRole('tblPiano', wirings)).toBe('Listener');
        expect(classifyInstrumentRole('tblS6Ahead', wirings)).toBe('Observer');
    });

    test('classifies a listener wired to a notesource distinctly from a real-table listener', () => {
        const wirings = [
            { tablename: 'tblPerfect4ths', listenToTablename: 'nsEveryNamedNote', relativeSection: '' }
        ];

        expect(classifyInstrumentRole('tblPerfect4ths', wirings)).toBe('ListenerNotesource');
    });

    test('renders escaped badge labels and hidden role classes', () => {
        expect(renderInstrumentBadge({ fromBaseID: 'P<46>', wiring: 'Listener', visible: false })).toBe("<span class='songLibraryInstrument instrumentListener instrumentNotVisible'>P&lt;46&gt;</span>");
    });

    test('renders the notesource-listener role class', () => {
        expect(renderInstrumentBadge({ fromBaseID: 'Perfect4ths', wiring: 'ListenerNotesource', visible: true })).toBe("<span class='songLibraryInstrument instrumentListenerNotesource'>Perfect4ths</span>");
    });

    test('builds live song summaries in layout order with duplicates', () => {
        const song = {
            myTunings: [
                { baseID: 'S6_main', fromBaseID: 'S6' },
                { baseID: 'P46_1', fromBaseID: 'P46' },
                { baseID: 'S6_ahead', fromBaseID: 'S6' }
            ],
            noteTablesLayout: [
                { tableID: 'tblP46_1', visible: true },
                { tableID: 'tblS6_main', visible: false },
                { tableID: 'tblS6_ahead', visible: true }
            ],
            wirings: [
                { tablename: 'tblS6_ahead', listenToTablename: 'tblS6_main', relativeSection: '+1' }
            ]
        };

        expect(getSongInstrumentSummaries(song)).toEqual([
            { fromBaseID: 'P46', wiring: 'Main', visible: true },
            { fromBaseID: 'S6', wiring: 'Main', visible: false },
            { fromBaseID: 'S6', wiring: 'Observer', visible: true }
        ]);
        expect(renderSongInstrumentBadges(song)).toBe("<span class='songLibraryInstrument instrumentMain'>P46</span><span class='songLibraryInstrument instrumentMain instrumentNotVisible'>S6</span><span class='songLibraryInstrument instrumentObserver'>S6</span>");
    });

});
