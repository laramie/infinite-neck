export const MODE_NONE = 'none';

export const CHART_CHORD_ALIASES = {
  '4,7': ['', 'M', 'maj'],
  '3,7': ['m', 'min'],
  '4,8': ['aug', '+'],
  '3,6': ['dim', 'o'],
  '3,6,9': ['dim7', 'o7'],
  '3,6,10': ['m7b5', 'half-diminished'],
  '2,7': ['sus2'],
  '5,7': ['sus4', 'sus'],
  '4,7,11': ['maj7', 'M7', 'Maj7'],
  '3,7,10': ['m7', 'min7'],
  '4,7,10': ['7', 'dom', 'dom7'],
  '4,10': ['7no5'],
  '3,7,11': ['m/ma7', 'mMaj7', 'mM7'],
  '3,7,10,14': ['m9'],
  '4,7,9,14': ['6add9', '6/9', '69', 'Madd9']
};

export const CHART_MODE_ALIASES = {
  '0,2,4,5,7,9,11': ['major', 'ionian'],
  '0,2,3,5,7,9,10': ['dorian'],
  '0,1,3,5,7,8,10': ['phrygian'],
  '0,2,4,6,7,9,11': ['lydian'],
  '0,2,4,5,7,9,10': ['mixolydian'],
  '0,2,3,5,7,8,10': ['minor', 'aeolian', 'natural minor'],
  '0,1,3,5,6,8,10': ['locrian'],
  '0,2,4,6,8,10': ['whole tone'],
  '0,3,6,9': ['diminished'],
  '0,3,5,7,10': ['minor pentatonic'],
  '0,2,4,7,9': ['major pentatonic'],
  '0,2,3,5,7,8,11': ['harmonic minor'],
  '0,2,3,5,7,9,11': ['melodic minor'],
  '0,2,4,6,7,9,10': ['lydian dominant'],
  '0,1,4,5,7,8,10': ['gypsy'],
  '0,1,3,5,7,9,11': ['neapolitan major'],
  '0,1,3,5,7,8,11': ['neapolitan minor']
};

export function normalizeAliasKey(text) {
  return `${text || ''}`.trim().toLowerCase();
}

export function normalizeChordAliasKey(text) {
  return `${text || ''}`.trim();
}

export function normalizeChartChord(rawChord) {
  const trimmed = `${rawChord || ''}`.trim();
  if (!trimmed) {
    return '';
  }
  const withoutSlashBass = trimmed.split('/')[0].trim();
  const rootMatch = withoutSlashBass.match(/^([A-Ga-g](?:#{1,2}|b{1,2}|x)?)/);
  const suffix = rootMatch ? withoutSlashBass.slice(rootMatch[0].length).trim() : withoutSlashBass;
  return suffix || 'M';
}

export function normalizeChartMode(rawMode) {
  const trimmed = `${rawMode || ''}`.trim();
  if (!trimmed) {
    return '';
  }
  const tonicMatch = trimmed.match(/^[A-Ga-g](?:#{1,2}|b{1,2}|x)?\s+(.+)$/);
  const modeText = tonicMatch ? tonicMatch[1] : trimmed;
  return normalizeAliasKey(modeText);
}

export function matchChartChordToOption(normalizedChord, options = []) {
  const normalizedKey = normalizeChordAliasKey(normalizedChord);
  return options.find((option) => {
    const aliases = CHART_CHORD_ALIASES[option.value] || [];
    return aliases.some((alias) => normalizeChordAliasKey(alias) === normalizedKey);
  }) || null;
}

export function matchChartModeToOption(normalizedMode, options = []) {
  const normalizedKey = normalizeAliasKey(normalizedMode);
  return options.find((option) => {
    const aliases = CHART_MODE_ALIASES[option.value] || [];
    return aliases.some((alias) => normalizeAliasKey(alias) === normalizedKey);
  }) || null;
}
