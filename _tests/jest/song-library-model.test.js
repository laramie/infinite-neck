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
                { href: 'dir-b/song-b.json', description: '<i>desc</i>' },
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
        expect(result[2].directory).toBe(ROOT_DIRECTORY_KEY);
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
                { href: 'sprint-121/song-a.json', description: 'A <b>bold</b> desc' },
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
    });
});
