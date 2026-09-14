import { SectionNotes } from '../../SectionNotes.js';
import { Note } from '../../Note.js';

describe('SectionNotes named note mutations', () => {
    test('defaults tonalSourceSet to the empty string for backward compatibility', () => {
        const sectionNotes = new SectionNotes();

        expect(sectionNotes.tonalSourceSet).toBe('');
    });

    test('clearNamedNote removes the key instead of leaving an empty placeholder object', () => {
        const sectionNotes = new SectionNotes();

        sectionNotes.setNamedNote('C', new Note({ noteName: 'C', colorClass: 'noteTransparent', styleNum: 0 }));
        sectionNotes.clearNamedNote('C');

        expect(sectionNotes.namedNotes).toEqual({});
        expect(sectionNotes.namedNotes).not.toHaveProperty('C');
    });

    test('setNamedNote treats an empty object like a removal request', () => {
        const sectionNotes = new SectionNotes({
            namedNotes: {
                B: { noteName: 'B', colorClass: 'noteTransparent', styleNum: 0 }
            }
        });

        sectionNotes.setNamedNote('B', {});

        expect(sectionNotes.namedNotes).toEqual({});
        expect(sectionNotes.namedNotes).not.toHaveProperty('B');
    });
});

describe('SectionNotes removeNotesByOwner', () => {
    test('removes only playedNotes and namedNotes matching the given owner', () => {
        const sectionNotes = new SectionNotes({
            playedNotes: [
                { noteName: 'C', styleNum: 1, owner: 'Momentary' },
                { noteName: 'D', styleNum: 1 }
            ],
            namedNotes: {
                E: { noteName: 'E', colorClass: 'noteRoot', owner: 'Momentary' },
                F: { noteName: 'F', colorClass: 'noteRoot' }
            }
        });

        sectionNotes.removeNotesByOwner('Momentary');

        expect(sectionNotes.playedNotes).toHaveLength(1);
        expect(sectionNotes.playedNotes[0].noteName).toBe('D');
        expect(sectionNotes.namedNotes).not.toHaveProperty('E');
        expect(sectionNotes.namedNotes).toHaveProperty('F');
    });

    test('is a no-op for a falsy owner, never clearing unowned notes', () => {
        const sectionNotes = new SectionNotes({
            playedNotes: [{ noteName: 'C', styleNum: 1 }],
            namedNotes: { E: { noteName: 'E', colorClass: 'noteRoot' } }
        });

        sectionNotes.removeNotesByOwner('');
        sectionNotes.removeNotesByOwner(undefined);

        expect(sectionNotes.playedNotes).toHaveLength(1);
        expect(sectionNotes.namedNotes).toHaveProperty('E');
    });

    test('leaves both collections untouched when no note matches the given owner', () => {
        const sectionNotes = new SectionNotes({
            playedNotes: [{ noteName: 'C', styleNum: 1, owner: 'ArpeggioPlugin' }],
            namedNotes: { E: { noteName: 'E', colorClass: 'noteRoot', owner: 'ArpeggioPlugin' } }
        });

        sectionNotes.removeNotesByOwner('Momentary');

        expect(sectionNotes.playedNotes).toHaveLength(1);
        expect(sectionNotes.namedNotes).toHaveProperty('E');
    });
});