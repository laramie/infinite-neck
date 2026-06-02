import { format_allModes } from '../../tonalPicker.js';

describe('tonalPicker inline all-modes rendering', () => {
  test('shows up to six selectable mode spans without an overflow marker', () => {
    const html = format_allModes('modes', ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian'], 'lydian');

    expect(html).toContain("<span class='TonalPickerAllModes'>");
    expect((html.match(/<span/g) || []).length).toBe(7);
    expect(html).toContain('<span class="selectedMode">lydian</span>');
    expect(html).not.toContain('more...');
    expect(html).toContain('<span>aeolian</span>');
  });

  test('replaces the seventh inline mode span with an n more summary span', () => {
    const html = format_allModes(
      'modes',
      ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian', 'whole tone'],
      'dorian'
    );

    expect(html).toContain('<span class="selectedMode">dorian</span>');
    expect(html).toContain('<span>2 more...</span>');
    expect(html).not.toContain('<span>locrian</span>');
    expect(html).not.toContain('<span>whole tone</span>');
    expect((html.match(/<span/g) || []).length).toBe(8);
  });

  test('leaves non-mode render requests unchanged', () => {
    expect(format_allModes('chords', ['major', 'minor'], 'major')).toBe('');
  });
});
