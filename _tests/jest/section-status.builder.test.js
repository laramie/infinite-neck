import { normalizeSectionStatusBeatState } from '../../templates/SectionStatus/section-status.builder.js';

describe('SectionStatus beat-state normalization', () => {
    test('shows a positive beat number when the counter is enabled', () => {
        expect(normalizeSectionStatusBeatState({ showBeatCounter: true, beatNumber: 3 })).toEqual({
            showBeatCounter: true,
            beatNumberText: '3'
        });
    });

    test('hides beat text when the counter is disabled', () => {
        expect(normalizeSectionStatusBeatState({ showBeatCounter: false, beatNumber: 3 })).toEqual({
            showBeatCounter: false,
            beatNumberText: ''
        });
    });

    test('preserves prior show state across partial beat-only updates', () => {
        expect(normalizeSectionStatusBeatState(
            { beatNumber: 4 },
            { showBeatCounter: true, beatNumberText: '2' }
        )).toEqual({
            showBeatCounter: true,
            beatNumberText: '4'
        });
    });

    test('drops invalid beat numbers even when the counter is enabled', () => {
        expect(normalizeSectionStatusBeatState({ showBeatCounter: true, beatNumber: 'bogus' })).toEqual({
            showBeatCounter: true,
            beatNumberText: ''
        });
    });
});