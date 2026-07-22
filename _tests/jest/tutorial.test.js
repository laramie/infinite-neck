import {
  filterStrictLoopSectionIndex,
  getLoopCaptionModel,
  getProgressBadgeModel,
  normalizeTutorialProgress,
  toggleAllIncludeInLooping,
  toggleBookmarkSection,
  toggleDoneSection
} from '../../Tutorial.js';

function progress(overrides = {}) {
  return normalizeTutorialProgress({ storageKey: 'tutorials/demo', ...overrides }, 12);
}

describe('Tutorial progress helpers', () => {
  test('normalizes sparse done arrays and bookmark indexes', () => {
    expect(progress({ doneSectionIndexes: [4, 1, 1, 99, -1], bookmarkSectionIndex: 6 })).toEqual({
      version: 2,
      storageKey: 'tutorials/demo',
      doneSectionIndexes: [1, 4],
      bookmarkSectionIndex: 6,
      updatedAt: ''
    });
  });

  test('toggles done and bookmark state', () => {
    const withDone = toggleDoneSection(progress(), 2, 12);
    expect(withDone.doneSectionIndexes).toEqual([2]);
    expect(toggleDoneSection(withDone, 2, 12).doneSectionIndexes).toEqual([]);

    const withBookmark = toggleBookmarkSection(progress(), 7, 12);
    expect(withBookmark.bookmarkSectionIndex).toBe(7);
    expect(toggleBookmarkSection(withBookmark, 7, 12).bookmarkSectionIndex).toBeNull();
  });

  test('builds compact progress badge model from song-list tutorial metadata', () => {
    expect(getProgressBadgeModel(
      { href: 'tutorials/course/song.json', tutorial: 'strict', SectionCount: 12 },
      progress({ doneSectionIndexes: [0, 2, 4], bookmarkSectionIndex: 6 })
    )).toEqual({
      highestDoneSectionNumber: 5,
      doneCount: 3,
      sectionCount: 12,
      bookmarkSectionNumber: 7
    });
  });
});

describe('Tutorial IncludeInLooping helpers', () => {
  test('header toggle clears all when all are included and restores all from mixed or empty', () => {
    expect(toggleAllIncludeInLooping([0, 1, 2], 3)).toEqual([]);
    expect(toggleAllIncludeInLooping([0, 2], 3)).toEqual([0, 1, 2]);
    expect(toggleAllIncludeInLooping([], 3)).toEqual([0, 1, 2]);
  });

  test('empty IncludeInLooping behaves as all included for strict loop filtering', () => {
    expect(filterStrictLoopSectionIndex(1, {
      strictTutorial: true,
      beatLooping: false,
      sectionCount: 4,
      includeInLoopingSectionIndexes: []
    })).toBe(1);
  });

  test('strict loop filtering skips to next included section', () => {
    expect(filterStrictLoopSectionIndex(0, {
      strictTutorial: true,
      beatLooping: false,
      sectionCount: 4,
      includeInLoopingSectionIndexes: [1, 2]
    })).toBe(1);
  });

  test('loop caption reports first and last included only while looping', () => {
    expect(getLoopCaptionModel({ looping: false, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('LOOP');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('LOOPING 2..3');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [1, 2, 3, 6, 7, 8], sectionCount: 9 })).toBe('LOOPING 2..9');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [], sectionCount: 4 })).toBe('LOOPING');
  });
});
