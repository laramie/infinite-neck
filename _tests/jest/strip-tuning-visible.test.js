import { stripTuningVisibleFromSong } from '../../bin/strip-tuning-visible.js';

describe('strip-tuning-visible helpers', () => {
    test('removes visible only from myTunings and preserves noteTablesLayout visibility', () => {
        const result = stripTuningVisibleFromSong({
            songName: 'cleanup',
            myTunings: [
                { baseID: 'P46_1', fromBaseID: 'P46', visible: false },
                { baseID: 'S6_1', fromBaseID: 'S6' }
            ],
            noteTablesLayout: [
                { tableID: 'tblP46_1', visible: false }
            ]
        });

        expect(result.changed).toBe(true);
        expect(result.data.myTunings).toEqual([
            { baseID: 'P46_1', fromBaseID: 'P46' },
            { baseID: 'S6_1', fromBaseID: 'S6' }
        ]);
        expect(result.data.noteTablesLayout).toEqual([
            { tableID: 'tblP46_1', visible: false }
        ]);
    });

    test('reports unchanged songs', () => {
        const song = {
            myTunings: [{ baseID: 'P46_1', fromBaseID: 'P46' }],
            noteTablesLayout: [{ tableID: 'tblP46_1', visible: true }]
        };
        const result = stripTuningVisibleFromSong(song);

        expect(result.changed).toBe(false);
        expect(result.data).toBe(song);
    });
});
