import { SectionNotes } from '../../SectionNotes.js';
import { Note } from '../../Note.js';

describe('SectionNotes named note mutations', () => {
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