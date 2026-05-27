import { getDefaultTheme, getThemes, getWidget_SelectThemes } from '../../themeFunctions.js';

describe('themeFunctions baseline contracts', () => {
    test('getDefaultTheme returns the Default theme object', () => {
        const themes = getThemes();
        const def = getDefaultTheme();

        expect(def).toBe(themes.Default);
        expect(def).toBeTruthy();
        expect(def.id).toBe('Default');
        expect(def.caption).toBe('Default');
    });

    test('themes registry contains multiple themes with ids', () => {
        const themes = getThemes();
        const ids = Object.keys(themes);

        expect(ids.length).toBeGreaterThan(3);
        ids.forEach((id) => {
            expect(themes[id]).toHaveProperty('id');
            expect(themes[id].id).toBe(id);
            expect(themes[id]).toHaveProperty('caption');
        });
    });

    test('themes expose corrected key font contrast pairs for representative variants', () => {
        const themes = getThemes();

        expect(themes.Default.noteWhiteKeyFontColor).toBe('black');
        expect(themes.Default.noteBlackKeyFontColor).toBe('white');
        expect(themes.Reverse.noteWhiteKeyFontColor).toBe('white');
        expect(themes.Reverse.noteBlackKeyFontColor).toBe('black');
        expect(themes.Matrix.noteWhiteKeyFontColor).toBe('chartreuse');
        expect(themes.Matrix.noteBlackKeyFontColor).toBe('chartreuse');
    });

    test('default theme still defines spacing inputs used by piano skeuomorphic insets', () => {
        const themes = getThemes();

        expect(themes.Default.notePadding).toBe('8pt');
        expect(themes.Default.cellSpacing).toBe('6pt');
    });

    test('getWidget_SelectThemes includes all theme ids in the select HTML', () => {
        const themes = getThemes();
        const widget = getWidget_SelectThemes();

        expect(widget).toContain("<select class='selThemesClass' id='selThemes'");

        Object.keys(themes).forEach((id) => {
            expect(widget).toContain("value='" + id + "'");
        });
    });
});
