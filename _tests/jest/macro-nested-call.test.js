import { jest } from '@jest/globals';

jest.unstable_mockModule('../../jsonTree80kg/json-tree-80kg.js', () => ({
    jsonTree: jest.fn()
}));

jest.unstable_mockModule('../../themeFunctions.js', () => ({
    setOneCssVar: jest.fn(),
    dumpThemeIds: jest.fn()
}));

jest.unstable_mockModule('../../command-line.js', () => ({
    clearCmdResults: jest.fn(),
    hideCmdLine: jest.fn(),
    setCmdLineMenuMode: jest.fn(),
    setCmdActionRunner: jest.fn(),
    showCmdLine: jest.fn(),
    stringifyMenuItem: jest.fn(() => ''),
    updateCmdLineView: jest.fn()
}));

jest.unstable_mockModule('../../looper.js', () => ({
    sectionsLooping: jest.fn(() => false),
    toggleLoopSections: jest.fn(),
    clearBeatAndSectionLooping: jest.fn()
}));

const menuState = {
    gMenuFile: {},
    gMenuPointer: {}
};

jest.unstable_mockModule('../../menu.js', () => ({
    buildChildMenuCaptionsRow: jest.fn(() => ''),
    diveMenu: jest.fn(),
    dumpMenus: jest.fn(() => ''),
    gMenuFile: menuState.gMenuFile,
    gMenuPointer: menuState.gMenuPointer,
    refreshRuntimeChildren: jest.fn(),
    setMenuRuntimeChildrenResolver: jest.fn(),
    setMenuValueResolver: jest.fn(),
    setMenuAtRoot: jest.fn(),
    gMenuLoaded: '{}'
}));

jest.unstable_mockModule('../../approved-values.js', () => ({
    renderApprovedValuesReferenceHtml: jest.fn(() => ''),
    resolveApprovedValue: jest.fn(() => undefined)
}));

jest.unstable_mockModule('../../userColors.js', () => ({
    gUserColorDict: { dict: {} }
}));

jest.unstable_mockModule('../../infinite-neck.js', () => ({
    showMessagesTab: jest.fn(),
    showDisplayOptions: jest.fn(),
    getVersionString: jest.fn(() => 'vtest'),
    getVersionObject: jest.fn(() => ({ README: 'README.md' })),
    toggleWiringOpenState: jest.fn(),
    toggleTransport: jest.fn(),
    showTransport: jest.fn(),
    toggleSectionDrawer: jest.fn(),
    toggleRandomLoop: jest.fn(),
    setSectionKeysFlats: jest.fn(),
    setSectionKeysSharps: jest.fn(),
    getSong: jest.fn(),
    refreshShowAllNoteNames: jest.fn(),
    buildFloatRectForTable: jest.fn(() => null)
}));

jest.unstable_mockModule('../../event-bus.js', () => ({
    default: {
        trigger: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        setLogEvents: jest.fn(() => false),
        getLogEvents: jest.fn(() => false)
    }
}));

const pluginRuntimeDefault = {
    refreshPluginsMenuNode: jest.fn(),
    getPluginEntry: jest.fn(),
    setPropertyValue: jest.fn(() => ({ result: '' })),
    resolveValue: jest.fn(() => undefined)
};

jest.unstable_mockModule('../../plugins/pluginRuntime.js', () => ({
    default: pluginRuntimeDefault
}));

const { runSongMacroById, setKeyHandlerProviders } = await import('../../key-handlers.js');

function setMacroMenu() {
    menuState.gMenuFile.children = [
        {
            trigger: 'f',
            children: [
                {
                    trigger: 'm',
                    children: [
                        {
                            trigger: 'c',
                            action: 'macroCall',
                            input: { id: 'call' }
                        },
                        {
                            trigger: 'p',
                            action: 'macroLog',
                            input: { id: 'message' }
                        }
                    ]
                }
            ]
        }
    ];
}

function createSong(macros) {
    return {
        macros
    };
}

describe('macro nested calls', () => {
    beforeEach(() => {
        pluginRuntimeDefault.refreshPluginsMenuNode.mockClear();
        setMacroMenu();
    });

    test('allows nested calls up to depth 4 and blocks the 5th call', () => {
        const song = createSong({
            macro1: { lines: ['/fmc {"macro":"macro2","args":{}}'] },
            macro2: { lines: ['/fmc {"macro":"macro3","args":{}}'] },
            macro3: { lines: ['/fmc {"macro":"macro4","args":{}}'] },
            macro4: { lines: ['/fmc {"macro":"macro5","args":{}}'] },
            macro5: { lines: ['/fmp "leaf"'] }
        });

        setKeyHandlerProviders({
            getSong: () => song
        });

        const result = runSongMacroById('macro1');
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Macro call depth exceeded');
        expect(result.error).toContain('macro5');
    });

    test('passes /fmc args into ${name} expansion scope', () => {
        const song = createSong({
            macroA: { lines: ['/fmc {"macro":"macroB","args":{"key":"E"}}'] },
            macroB: { lines: ['/fmp "Key=${key}"'] }
        });

        setKeyHandlerProviders({
            getSong: () => song
        });

        const result = runSongMacroById('macroA');
        expect(result.ok).toBe(true);
    });

    test('fails line when expansion name is unknown', () => {
        const song = createSong({
            macroA: { lines: ['/fmp "${notFound}"'] }
        });

        setKeyHandlerProviders({
            getSong: () => song
        });

        const result = runSongMacroById('macroA');
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Unknown expansion name: notFound');
    });
});
