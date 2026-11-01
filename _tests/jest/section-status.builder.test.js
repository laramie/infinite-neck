import {
    applySectionStatusKeyModeClasses,
    getSectionStatusKeyModeClass,
    normalizeSectionStatusBeatState
} from '../../templates/SectionStatus/section-status.builder.js';

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

describe('SectionStatus key-mode class helpers', () => {
    test('maps replay key modes to caption/key CSS classes', () => {
        expect(getSectionStatusKeyModeClass('RELATIVE')).toBe('ssKey_relative');
        expect(getSectionStatusKeyModeClass('LISTENER')).toBe('ssKey_listener');
        expect(getSectionStatusKeyModeClass('SELF')).toBe('');
        expect(getSectionStatusKeyModeClass(undefined)).toBe('');
    });

    test('maps a notesource-wired listener to its own key CSS class', () => {
        expect(getSectionStatusKeyModeClass('LISTENER', true)).toBe('ssKey_listener_notesource');
        expect(getSectionStatusKeyModeClass('RELATIVE', true)).toBe('ssKey_relative');
    });

    test('removes prior role classes and applies listener/relative class', () => {
        const calls = [];
        const targets = {
            length: 1,
            removeClass: (classes) => calls.push(['removeClass', classes]),
            addClass: (classes) => calls.push(['addClass', classes])
        };

        applySectionStatusKeyModeClasses(targets, 'RELATIVE');
        expect(calls).toEqual([
            ['removeClass', 'ssKey_relative ssKey_listener ssKey_listener_notesource'],
            ['addClass', 'ssKey_relative']
        ]);
    });

    test('applies the notesource-listener class when isNotesourceListener is set', () => {
        const calls = [];
        const targets = {
            length: 1,
            removeClass: (classes) => calls.push(['removeClass', classes]),
            addClass: (classes) => calls.push(['addClass', classes])
        };

        applySectionStatusKeyModeClasses(targets, 'LISTENER', true);
        expect(calls).toEqual([
            ['removeClass', 'ssKey_relative ssKey_listener ssKey_listener_notesource'],
            ['addClass', 'ssKey_listener_notesource']
        ]);
    });
});