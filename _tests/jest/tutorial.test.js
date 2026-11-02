import {
  filterIncludedLoopSectionIndex,
  getLoopCaptionModel,
  getProgressBadgeModel,
  isLoopSubsetInEffect,
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

  test('empty IncludeInLooping behaves as all included for loop filtering', () => {
    expect(filterIncludedLoopSectionIndex(1, {
      tutorialActive: true,
      beatLooping: false,
      sectionCount: 4,
      includeInLoopingSectionIndexes: []
    })).toBe(1);
  });

  test('loop filtering skips to next included section', () => {
    expect(filterIncludedLoopSectionIndex(0, {
      tutorialActive: true,
      beatLooping: false,
      sectionCount: 4,
      includeInLoopingSectionIndexes: [1, 2]
    })).toBe(1);
  });

  test('loop filtering wraps past the last included section', () => {
    expect(filterIncludedLoopSectionIndex(3, {
      tutorialActive: true,
      sectionCount: 4,
      includeInLoopingSectionIndexes: [1, 2]
    })).toBe(1);
  });

  test('loop filtering is off when no tutorial is active and for beat looping', () => {
    const options = { sectionCount: 4, includeInLoopingSectionIndexes: [1, 2] };
    expect(filterIncludedLoopSectionIndex(0, { ...options, tutorialActive: false })).toBe(0);
    expect(filterIncludedLoopSectionIndex(0, { ...options, tutorialActive: true, beatLooping: true })).toBe(0);
    expect(filterIncludedLoopSectionIndex(0, options)).toBe(0);
  });

  test('isLoopSubsetInEffect is true only for a non-empty set smaller than all Sections', () => {
    expect(isLoopSubsetInEffect(null, 4)).toBe(false);
    expect(isLoopSubsetInEffect(undefined, 4)).toBe(false);
    expect(isLoopSubsetInEffect([], 4)).toBe(false);
    expect(isLoopSubsetInEffect([0, 1, 2, 3], 4)).toBe(false);
    expect(isLoopSubsetInEffect([1], 4)).toBe(true);
    expect(isLoopSubsetInEffect([0, 2, 3], 4)).toBe(true);
    expect(isLoopSubsetInEffect([0], 0)).toBe(false);
  });

  test('the dashed-border predicate agrees with the loop caption range', () => {
    [null, [], [0, 1, 2, 3], [1], [1, 2], [0, 3]].forEach((include) => {
      const caption = getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: include, sectionCount: 4 });
      expect(isLoopSubsetInEffect(include, 4)).toBe(/\d/.test(caption));
    });
  });

  test('loop caption reports first and last included only while looping', () => {
    expect(getLoopCaptionModel({ looping: false, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('LOOP');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('LOOPING 2..3');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [1, 2, 3, 6, 7, 8], sectionCount: 9 })).toBe('LOOPING 2..9');
    expect(getLoopCaptionModel({ looping: true, includeInLoopingSectionIndexes: [], sectionCount: 4 })).toBe('LOOPING');
  });

  test('loop caption composes random with full and partial section ranges', () => {
    expect(getLoopCaptionModel({ looping: true, random: true, includeInLoopingSectionIndexes: [], sectionCount: 4 })).toBe('RANDOM');
    expect(getLoopCaptionModel({ looping: true, random: true, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('RANDOM 2..3');
    expect(getLoopCaptionModel({ looping: false, random: true, includeInLoopingSectionIndexes: [1, 2], sectionCount: 4 })).toBe('LOOP');
  });
});
