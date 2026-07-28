import {
    ROOT_DIRECTORY_KEY,
    normalizeSongListEntries,
    buildSongLibraryModel,
    renderSongLibraryHtml
} from '../../SongLibrary.js';

describe('SongLibrary model', () => {
    test('normalizeSongListEntries supports strings and href objects', () => {
        const result = normalizeSongListEntries({
            songs: [
                'dir-a/song-a.json',
                {
                    href: 'dir-b/song-b.json',
                    description: '<i>desc</i>',
                    instruments: [
                        { fromBaseID: 'P46', wiring: 'Main', visible: true },
                        { fromBaseID: 'S6', wiring: 'Observer', visible: false },
                        { fromBaseID: '', wiring: 'Listener', visible: true }
                    ],
                    tutorial: 'strict',
                    SectionCount: 12
                },
                { href: 'song-at-root.json', description: 'root desc' },
                { href: '', description: 'skip me' },
                { description: 'skip me too' },
                null
            ]
        });

        expect(result.map((entry) => entry.href)).toEqual([
            'dir-a/song-a.json',
            'dir-b/song-b.json',
            'song-at-root.json'
        ]);
        expect(result[1].description).toBe('<i>desc</i>');
        expect(result[1].instruments).toEqual([
            { fromBaseID: 'P46', wiring: 'Main', visible: true },
            { fromBaseID: 'S6', wiring: 'Observer', visible: false }
        ]);
        expect(result[1].tutorial).toBe('strict');
        expect(result[1].SectionCount).toBe(12);
        expect(result[2].directory).toBe(ROOT_DIRECTORY_KEY);
    });

    test('renderSongLibraryHtml emits tutorial progress badge from song-list metadata and local storage', () => {
        const store = new Map();
        globalThis.localStorage = {
            getItem(key) {
                return store.get(key) || null;
            }
        };
        store.set('infinite-neck:tutorial-progress:tutorials/course/song-a', JSON.stringify({
            version: 2,
            storageKey: 'tutorials/course/song-a',
            doneSectionIndexes: [0, 2, 4],
            bookmarkSectionIndex: 6
        }));

        const html = renderSongLibraryHtml({
            songs: [
                {
                    href: 'tutorials/course/song-a.json',
                    description: 'Tutorial',
                    tutorial: 'strict',
                    SectionCount: 12
                }
            ]
        });

        expect(html).toContain("<span class='songLibraryTutorialProgressBadge'>");
        expect(html).toContain("<span class='songLibraryTutorialHighestDone'>&sect;5</span>");
        expect(html).toContain("<span class='songLibraryTutorialDoneCount'>(3/12)</span>");
        expect(html).toContain("<span class='songLibraryTutorialBookmark'>&#x261E;7</span>");
        expect(html).not.toContain('songLibraryTutorialProgressBadge songLibraryInstrument');
    });

    test('buildSongLibraryModel includes intro-only directories and root intros', () => {
        const model = buildSongLibraryModel({
            songs: [
                'sprint-121/song-a.json',
                { href: 'sprint-121/song-b.json', description: 'b' }
            ],
            directoryIntros: [
                { introFor: 'root', html: 'Root intro html' },
                { introFor: 'sprint-121', html: 'Sprint intro html' },
                { introFor: 'practice', html: 'Practice intro html only' }
            ]
        });

        expect(model.root.label).toBe('Song Library');
        expect(model.root.introHtml).toBe('Root intro html');
        expect(model.directories.map((directory) => directory.key)).toEqual([
            'sprint-121',
            'practice'
        ]);
        expect(model.directories[1].songs).toEqual([]);
    });

    test('renderSongLibraryHtml emits top-level and directory details blocks', () => {
        const html = renderSongLibraryHtml({
            songs: [
                {
                    href: 'sprint-121/song-a.json',
                    description: 'A <b>bold</b> desc',
                    instruments: [
                        { fromBaseID: 'P46', wiring: 'Main', visible: true },
                        { fromBaseID: 'S6', wiring: 'Listener', visible: false },
                        { fromBaseID: 'Bass4', wiring: 'Observer', visible: true }
                    ]
                },
                { href: 'song-root.json', description: 'Root desc' }
            ],
            directoryIntros: [
                { introFor: 'sprint-121', html: 'Sprint intro' },
                { introFor: 'root', html: 'Root intro' }
            ]
        });

        expect(html).toContain("<details class='songLibraryRootDetails'>");
        expect(html).toContain("<summary class='songLibrarySummary'>Song Library</summary>");
        expect(html).toContain("name='songLibraryDirectoryGroup'");
        expect(html).toContain('Root intro');
        expect(html).toContain('Sprint intro');
        expect(html).toContain("data-action='loadSong'");
        expect(html).toContain("data-action-args='[\"sprint-121/song-a.json\"]'");
        expect(html).toContain('song-a.json');
        expect(html).toContain('song-root.json');
        expect(html).toContain('A <b>bold</b> desc');
        expect(html).toContain("<div class='songLibraryCell songLibraryCellInstruments'>");
        expect(html).toContain("<span class='songLibraryInstrument instrumentMain'>P46</span>");
        expect(html).toContain("<span class='songLibraryInstrument instrumentListener instrumentNotVisible'>S6</span>");
        expect(html).toContain("<span class='songLibraryInstrument instrumentObserver'>Bass4</span>");
    });

    test('renderSongLibraryHtml keeps an empty instrument cell when instruments are missing', () => {
        const html = renderSongLibraryHtml({
            songs: [
                { href: 'demo/song-a.json', description: 'No generated instruments yet' }
            ]
        });

        expect(html).toContain("<div class='songLibraryCell songLibraryCellInstruments'></div>");
    });
});
