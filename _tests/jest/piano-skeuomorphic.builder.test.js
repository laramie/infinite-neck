import {
    supportsPianoSkeuomorphic,
    isPianoSkeuomorphicEnabled
} from '../../templates/piano/piano-skeuomorphic.builder.js';

describe('piano skeuomorphic helper gating', () => {
    test('supports only one-row Piano tunings', () => {
        expect(supportsPianoSkeuomorphic({
            baseInstrument: 'Piano',
            rowRange: [48]
        })).toBe(true);

        expect(supportsPianoSkeuomorphic({
            baseInstrument: 'Piano',
            rowRange: [48, 36]
        })).toBe(false);

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
        })).toBe(false);
    });
});