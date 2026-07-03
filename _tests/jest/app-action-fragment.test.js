import {
    isAllowedAppActionFragment,
    parseAppActionFragment
} from '../../app-action-fragment.js';

describe('app action fragments', () => {
    test('parses raise and macro superlinks in order', () => {
        expect(parseAppActionFragment('#raise=arpeggio.color,macro=show-instruments')).toEqual({
            items: [
                {
                    action: 'raise',
                    value: 'arpeggio.color',
                    pluginId: 'arpeggio',
                    userKey: 'color'
                },
                {
                    action: 'macro',
                    value: 'show-instruments',
                    macroId: 'show-instruments'
                }
            ],
            errors: []
        });
    });

    test('preserves existing repeated and inherited raise formats', () => {
        expect(parseAppActionFragment('#raise=transpose.blues,raise=arpeggio.firstPosition').items).toEqual([
            expect.objectContaining({ action: 'raise', value: 'transpose.blues' }),
            expect.objectContaining({ action: 'raise', value: 'arpeggio.firstPosition' })
        ]);
        expect(parseAppActionFragment('#raise=transpose.blues,arpeggio.firstPosition').items).toEqual([
            expect.objectContaining({ action: 'raise', value: 'transpose.blues' }),
            expect.objectContaining({ action: 'raise', value: 'arpeggio.firstPosition' })
        ]);
    });

    test('allows macro-only fragments and rejects invalid values', () => {
        expect(isAllowedAppActionFragment('#macro=show-instruments')).toBe(true);
        expect(isAllowedAppActionFragment('#raise=arpeggio.color,macro=show-instruments')).toBe(true);
        expect(isAllowedAppActionFragment('#macro=1bad')).toBe(false);
        expect(isAllowedAppActionFragment('#macro=bad.value')).toBe(false);
        expect(isAllowedAppActionFragment('#raise=bad.value.extra')).toBe(false);
        expect(isAllowedAppActionFragment('http://example.com#macro=show-instruments')).toBe(false);
    });
});
