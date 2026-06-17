import {
    supportsPianoSkeuomorphic,
    isPianoSkeuomorphicEnabled,
    normalizePianoLayoutOptions
} from '../../templates/piano/piano-skeuomorphic.builder.js';

describe('piano skeuomorphic helper gating', () => {
    test('supports Piano tunings regardless of row count', () => {
        expect(supportsPianoSkeuomorphic({
            baseInstrument: 'Piano',
            rowRange: [48]
        })).toBe(true);

        expect(supportsPianoSkeuomorphic({
            baseInstrument: 'Piano',
            rowRange: [48, 36]
        })).toBe(true);

        expect(supportsPianoSkeuomorphic({
            baseInstrument: 'Guitar',
            rowRange: [48]
        })).toBe(false);
    });

    test('requires the pianoSkeuomorphic opt-in flag', () => {
        expect(isPianoSkeuomorphicEnabled({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoSkeuomorphic: true
        })).toBe(true);

        expect(isPianoSkeuomorphicEnabled({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoSkeuomorphic: false
        })).toBe(false);

        expect(isPianoSkeuomorphicEnabled({
            baseInstrument: 'Piano',
            rowRange: [48, 36],
            pianoSkeuomorphic: true
        })).toBe(true);
    });

    test('turns off PianoNames when PianoSkeuo is enabled', () => {
        expect(normalizePianoLayoutOptions({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoNamesRow: true,
            nut: true,
            stringDividerHeight: '0.6em',
            pianoSkeuomorphic: true
        })).toEqual({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoNamesRow: false,
            nut: false,
            stringDividerHeight: '0',
            pianoSkeuomorphic: true
        });

        expect(normalizePianoLayoutOptions({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoNamesRow: true,
            nut: true,
            stringDividerHeight: '0.6em',
            pianoSkeuomorphic: false
        })).toEqual({
            baseInstrument: 'Piano',
            rowRange: [48],
            pianoNamesRow: true,
            nut: false,
            stringDividerHeight: '0',
            pianoSkeuomorphic: false
        });

        expect(normalizePianoLayoutOptions({
            baseInstrument: 'Guitar',
            rowRange: [64, 59, 55, 50, 45, 40],
            pianoNamesRow: true,
            nut: true,
            stringDividerHeight: '0.6em',
            pianoSkeuomorphic: false
        })).toEqual({
            baseInstrument: 'Guitar',
            rowRange: [64, 59, 55, 50, 45, 40],
            pianoNamesRow: true,
            nut: true,
            stringDividerHeight: '0.6em',
            pianoSkeuomorphic: false
        });
    });
});