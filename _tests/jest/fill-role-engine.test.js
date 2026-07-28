import {
  computeRoleNoteSets,
  buildNamedRolePlan,
  applyNamedPlanToSectionNotes,
  legacyFillColorToRoleMode,
  MODE_KEEP,
  MODE_ROLE
} from '../../fill/fill-role-engine.js';

function createSectionNotes(initialNamedNotes = {}) {
  return {
    namedNotes: { ...initialNamedNotes },
    setNamedNote(noteName, note) {
      this.namedNotes[noteName] = note;
    },
    clearNamedNote(noteName) {
      delete this.namedNotes[noteName];
    }
  };
}

describe('fill role engine', () => {
  test('builds named plan with root/chord/scale precedence', () => {
    const roleNoteSets = computeRoleNoteSets({
      rootID: 3, // C
      chordSource: 'M',
      modeSource: 'major',
      useSectionChart: false
    });

    const plan = buildNamedRolePlan(roleNoteSets, {
      getModeForRole: () => MODE_ROLE,
      getColorForRole: (roleName) => {
        if (roleName === 'root') {
          return 'noteRoot';
        }
        if (roleName === 'chord') {
          return 'noteChord';
        }
        return 'noteScale';
      },
      buildNamedNote: (noteName, colorClass) => ({ noteName, colorClass })
    });

    const notesByName = Object.fromEntries(plan.notePlans.map((item) => [item.noteName, item.outputNote?.colorClass]));
    expect(notesByName.C).toBe('noteRoot');
    expect(notesByName.E).toBe('noteChord');
    expect(notesByName.G).toBe('noteChord');
    expect(notesByName.D).toBe('noteScale');
    expect(notesByName.B).toBe('noteScale');
  });

  test('keep mode preserves existing notes', () => {
    const roleNoteSets = {
      root: new Set(['C']),
      chord: new Set(['C', 'E', 'G']),
      scale: new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B'])
    };

    const sectionNotes = createSectionNotes({
      C: { noteName: 'C', colorClass: 'noteExisting' }
    });

    const plan = buildNamedRolePlan(roleNoteSets, {
      getModeForRole: (roleName) => (roleName === 'root' ? MODE_KEEP : MODE_ROLE),
      getColorForRole: (roleName) => (roleName === 'chord' ? 'noteChord' : 'noteScale'),
      buildNamedNote: (noteName, colorClass) => ({ noteName, colorClass })
    });

    const counts = applyNamedPlanToSectionNotes(sectionNotes, plan);
    expect(counts.kept).toBe(1);
    expect(sectionNotes.namedNotes.C.colorClass).toBe('noteExisting');
    expect(sectionNotes.namedNotes.E.colorClass).toBe('noteChord');
    expect(sectionNotes.namedNotes.D.colorClass).toBe('noteScale');
  });

  test('legacy fill color mode maps keep/clear/highlight to keep semantics', () => {
    expect(legacyFillColorToRoleMode('noteKeep')).toBe(MODE_KEEP);
    expect(legacyFillColorToRoleMode('noteClear')).toBe(MODE_KEEP);
    expect(legacyFillColorToRoleMode('noteHighlightSingle')).toBe(MODE_KEEP);
    expect(legacyFillColorToRoleMode('noteScale')).toBe(MODE_ROLE);
  });

  test('chart-sourced chord notes transpose to section root', () => {
    const roleNoteSets = computeRoleNoteSets({
      rootID: 6, // Eb
      chordSource: 'Bb11',
      modeSource: '',
      useSectionChart: true
    });

    expect(roleNoteSets.chord.has('C')).toBe(false);
    expect(roleNoteSets.chord.has('Db')).toBe(true);
  });
});
