import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NoteTableModel, NoteTableRegistry } from '../../NoteTableModel.js';
import { makeSongFromData } from '../../song.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readSong(relativePath) {
    const fullPath = path.join(__dirname, '../../', relativePath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

describe('NoteTableModel contracts', () => {
    test('observer capabilities derive from relativeSection', () => {
        const active = new NoteTableModel({ tableId: 'tblNate', relativeSection: '' });
        const observer = new NoteTableModel({ tableId: 'tblMyra', relativeSection: '^2' });

        expect(active.isObserver()).toBe(false);
        expect(active.allowsCellEditing()).toBe(true);
        expect(active.allowsBeatPlayback()).toBe(true);
        expect(active.allowsBeatRecording()).toBe(true);

        expect(observer.isObserver()).toBe(true);
        expect(observer.allowsCellEditing()).toBe(false);
        expect(observer.allowsBeatPlayback()).toBe(false);
        expect(observer.allowsBeatRecording()).toBe(false);
    });

    test('resolveSectionIndex uses Song relative resolver', () => {
        const data = readSong('songs/tests/display-options.json');
        const song = makeSongFromData(data, { headless: true, quiet: true, fixIndex: true });
        song.gotoSection(2);

        const model = new NoteTableModel({ tableId: 'tblP46', relativeSection: '^1' });
        expect(model.resolveSectionIndex(song)).toBe(1);

        model.setRelativeSection('');
        expect(model.resolveSectionIndex(song)).toBe(song.getSectionsCurrentIndex());
    });
});

describe('NoteTableRegistry contracts', () => {
    test('hydrates from visibleNoteTables when noteTableModels is missing', () => {
        const registry = new NoteTableRegistry();
        registry.hydrateFromFile({ visibleNoteTables: ['tblNate', 'tblMyra'] });

        const snapshot = registry.toSnapshot();
        expect(Object.keys(snapshot).sort()).toEqual(['tblMyra', 'tblNate']);
        expect(snapshot.tblNate.relativeSection).toBe('');
        expect(snapshot.tblNate.enabled).toBe(true);
    });

    test('hydrates explicit noteTableModels payload', () => {
        const registry = new NoteTableRegistry();
        registry.hydrateFromFile({
            noteTableModels: {
                tblNate: { relativeSection: '', caption: 'Nate', enabled: true },
                tblMyra: { relativeSection: '&1', caption: 'Myra', enabled: true }
            }
        });

        expect(registry.get('tblMyra').isObserver()).toBe(true);
        expect(registry.isObserverTable('tblNate')).toBe(false);
        expect(registry.get('tblMyra').caption).toBe('Myra');
    });
});

describe('Song integration with NoteTableRegistry (P0)', () => {
    test('makeSongFromData hydrates registry from visible tables and keeps it out of JSON persistence', () => {
        const data = readSong('songs/tests/display-options.json');
        const song = makeSongFromData(data, { headless: true, quiet: true, fixIndex: true });

        const snapshot = song.getNoteTableModelsSnapshot();
        expect(Object.keys(snapshot)).toEqual(data.visibleNoteTables);

        const persisted = JSON.parse(JSON.stringify(song));
        expect(persisted.noteTableRegistry).toBeUndefined();
    });
});
