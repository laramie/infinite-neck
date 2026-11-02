import {
  applyPromptToSectionTutorial,
  canEditTutorialPrompt,
  filterIncludedLoopSectionIndex,
  getLoopCaptionModel,
  getProgressBadgeModel,
  isLoopSubsetInEffect,
  normalizeTutorialProgress,
  promptTextToPrompt,
  promptToEditText,
  toggleAllIncludeInLooping,
  toggleBookmarkSection,
  toggleDoneSection
} from '../../Tutorial.js';

describe('Tutorial prompt editing helpers (sprint 152 it3)', () => {
  test('canEditTutorialPrompt: wizard only, and not with "use caption for tutorial"', () => {
    expect(canEditTutorialPrompt({ tutorial: { level: 'wizard' } })).toBe(true);
    expect(canEditTutorialPrompt({ tutorial: { level: 'wizard', useCaptionForSectionCaption: true } })).toBe(false);
    expect(canEditTutorialPrompt({ tutorial: { level: 'strict' } })).toBe(false);
    expect(canEditTutorialPrompt({ tutorial: { level: 'none' } })).toBe(false);
    expect(canEditTutorialPrompt({})).toBe(false);
  });

  test('promptToEditText joins the existing lines, and is empty without a prompt', () => {
    expect(promptToEditText({ lines: ['<p>a</p>', '<p>b</p>'] })).toBe('<p>a</p>\n<p>b</p>');
    expect(promptToEditText(undefined)).toBe('');
    expect(promptToEditText({})).toBe('');
  });

  test('promptTextToPrompt sanitizes the whole text and keeps it as one entry', () => {
    const seen = [];
    const upper = (text) => { seen.push(text); return text.toUpperCase(); };
    expect(promptTextToPrompt('<p>a\r\nb</p>', upper)).toEqual({ lines: ['<P>A\nB</P>'] });
    expect(seen).toEqual(['<p>a\nb</p>']);
  });

  test('promptTextToPrompt returns null for empty text or text the sanitizer empties', () => {
    expect(promptTextToPrompt('')).toBeNull();
    expect(promptTextToPrompt('  \n ')).toBeNull();
    expect(promptTextToPrompt('<script>x</script>', () => '')).toBeNull();
    expect(promptTextToPrompt(undefined)).toBeNull();
  });

  test('applyPromptToSectionTutorial sets and removes the prompt without touching the caption', () => {
    const prompt = { lines: ['<p>x</p>'] };
    expect(applyPromptToSectionTutorial({ caption: 'Cap' }, prompt)).toEqual({ caption: 'Cap', prompt });
    expect(applyPromptToSectionTutorial(undefined, prompt)).toEqual({ prompt });
    expect(applyPromptToSectionTutorial({ caption: 'Cap', prompt }, null)).toEqual({ caption: 'Cap' });
    expect(applyPromptToSectionTutorial({ prompt }, null)).toBeUndefined();
    expect(applyPromptToSectionTutorial(undefined, null)).toBeUndefined();
  });

  test('applyPromptToSectionTutorial does not mutate its input', () => {
    const original = { caption: 'Cap', prompt: { lines: ['a'] } };
    applyPromptToSectionTutorial(original, null);
    expect(original).toEqual({ caption: 'Cap', prompt: { lines: ['a'] } });
  });
});

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
