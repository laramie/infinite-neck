import {
    buildVisibilityMap,
    classifyWiring,
    extractInstrumentSummaries,
    tableIDForBaseID,
    updateSongListData
} from '../../bin/update-song-list.js';

describe('update-song-list helpers', () => {
    test('classifyWiring maps main, listener, and observer roles', () => {
        const wirings = [
            { tablename: 'tblPiano', listenToTablename: 'tblS6', relativeSection: '' },
            { tablename: 'tblS6LookAhead', listenToTablename: 'tblS6', relativeSection: '+1' }
        ];

        expect(classifyWiring('tblS6', wirings)).toBe('Main');
        expect(classifyWiring('tblPiano', wirings)).toBe('Listener');
        expect(classifyWiring('tblS6LookAhead', wirings)).toBe('Observer');
    });

    test('extractInstrumentSummaries uses noteTablesLayout, exact fromBaseID, and duplicate badges', () => {
        const warnings = [];
        const songJson = {
            songName: 'badge-test',
            myTunings: [
                { baseID: 'P46_1', fromBaseID: 'P46', visible: true },
                { baseID: 'S6_main', fromBaseID: 'S6', visible: true },
                { baseID: 'S6_ahead', fromBaseID: 'S6', visible: true },
                { baseID: 'NoLineage', visible: true }
            ],
            noteTablesLayout: [
                { tableID: 'tblP46_1', visible: true },
                { tableID: 'tblS6_main', visible: false },
                { tableID: 'tblS6_ahead', visible: true },
                { tableID: 'tblNoLineage', visible: true }
            ],
            wirings: [
                { tablename: 'tblP46_1', listenToTablename: 'tblS6_main', relativeSection: '' },
                { tablename: 'tblS6_ahead', listenToTablename: 'tblS6_main', relativeSection: '+1' }
            ]
        };

        expect(extractInstrumentSummaries(songJson, warnings)).toEqual([
            { fromBaseID: 'P46', wiring: 'Listener', visible: true },
            { fromBaseID: 'S6', wiring: 'Main', visible: false },
            { fromBaseID: 'S6', wiring: 'Observer', visible: true }
        ]);
        expect(warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('tblS6_main tuning.visible=true conflicts with noteTablesLayout=false'),
            expect.stringContaining('tblNoLineage has no fromBaseID')
        ]));
    });

    test('buildVisibilityMap warns when noteTablesLayout is missing an owned tuning', () => {
        const warnings = [];
        const visibility = buildVisibilityMap({
            songName: 'missing-layout',
            myTunings: [
                { baseID: 'P46_1', fromBaseID: 'P46', visible: false }
            ],
            noteTablesLayout: []
        }, warnings);

        expect(visibility.get('tblP46_1')).toBe(false);
        expect(warnings[0]).toContain('has no noteTablesLayout entry for tblP46_1');
    });

    test('tableIDForBaseID uses the app table prefix', () => {
        expect(tableIDForBaseID('P46_1')).toBe('tblP46_1');
    });

    test('updateSongListData preserves display order, updates object entries, and warns on legacy strings', () => {
        const songByHref = new Map([
            ['demo/song-a.json', {
                songName: 'song-a',
                myTunings: [{ baseID: 'P46_1', fromBaseID: 'P46', visible: true }],
                noteTablesLayout: [{ tableID: 'tblP46_1', visible: true }],
                wirings: []
            }],
            ['demo/song-b.json', {
                songName: 'song-b',
                myTunings: [{ baseID: 'S6_1', fromBaseID: 'S6', visible: true }],
                noteTablesLayout: [{ tableID: 'tblS6_1', visible: false }],
                wirings: [{ tablename: 'tblS6_1', listenToTablename: 'tblP46_1', relativeSection: '+1' }]
            }]
        ]);
        const result = updateSongListData({
            songs: [
                { href: 'demo/song-a.json', description: 'A' },
                'demo/legacy-song.json',
                { href: 'demo/song-b.json', description: 'B' }
            ]
        }, {
            songListPath: '/repo/songs/song-list.json',
            readSongJson: (songPath) => songByHref.get(songPath.replace('/repo/songs/', ''))
        });

        expect(result.data.songs.map((entry) => typeof entry === 'string' ? entry : entry.href)).toEqual([
            'demo/song-a.json',
            'demo/legacy-song.json',
            'demo/song-b.json'
        ]);
        expect(result.data.songs[0].instruments).toEqual([
            { fromBaseID: 'P46', wiring: 'Main', visible: true }
        ]);
        expect(result.data.songs[2].instruments).toEqual([
            { fromBaseID: 'S6', wiring: 'Observer', visible: false }
        ]);
        expect(result.warnings).toEqual(expect.arrayContaining([
            expect.stringContaining('legacy string')
        ]));
        expect(result.changed).toBe(true);
    });
});
