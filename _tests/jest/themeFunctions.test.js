import { getDefaultTheme, getThemeByIdOrDefault, getThemes, getWidget_SelectThemes } from '../../themeFunctions.js';

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

    test('getThemeByIdOrDefault falls back to Default for missing ids', () => {
        const def = getDefaultTheme();

        expect(getThemeByIdOrDefault()).toBe(def);
        expect(getThemeByIdOrDefault('')).toBe(def);
        expect(getThemeByIdOrDefault('not-a-real-theme')).toBe(def);
    });

    test('getThemeByIdOrDefault returns the requested theme when present', () => {
        const themes = getThemes();
        const nonDefaultId = Object.keys(themes).find((id) => id !== 'Default');

        expect(getThemeByIdOrDefault(nonDefaultId)).toBe(themes[nonDefaultId]);
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
