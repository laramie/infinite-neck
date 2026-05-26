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