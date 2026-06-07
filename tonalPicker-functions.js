import {
  linkToSectionChartChord,
  linkToSectionChartMode,
  linkToSectionChangedTonal,
  linkToSectionTableChord,
  linkToSectionTableMode
} from './infinite-neck.js';
import { getTonalForTable } from './TonalFunctions.js';

export const TonalAutoWrite = Object.freeze({
  TABLE: 'table',
  CHART_AND_TABLE: 'chart+table'
});

export const TONAL_SUGGESTION_LIMIT = 9;
const TONAL_CHORD_SUMMARY_VISIBLE_LIMIT = 3;
const TONAL_MODE_SUMMARY_VISIBLE_LIMIT = 3;

function formatCommandCheckmark() {
  return `<span class='commandCheckmark'>&check;</span>`;
}

function normalizeKind(kind = '') {
  return `${kind}`.toLowerCase().startsWith('chord') ? 'chord' : 'mode';
}

function normalizeArray(values) {
  return Array.isArray(values) ? values.filter((value) => `${value || ''}` !== '') : [];
}

export function resolveStoredTonalValue(kind, state = {}) {
  const normalizedKind = normalizeKind(kind);
  if (normalizedKind === 'chord') {
    return state.autoWrite === TonalAutoWrite.TABLE
      ? `${state.tableChord || ''}`
      : `${state.chartChord || ''}`;
  }
  return state.autoWrite === TonalAutoWrite.TABLE
    ? `${state.tableMode || ''}`
    : `${state.chartMode || ''}`;
}

export function getTonalSuggestionState(song, section, tableID, options = {}) {
  const autoWrite = options.autoWrite || TonalAutoWrite.CHART_AND_TABLE;
  const limit = Number.isInteger(options.limit) ? options.limit : TONAL_SUGGESTION_LIMIT;

  if (!song || !section || !tableID) {
    return {
      tableID: tableID || '',
      autoWrite,
      chordSuggestions: [],
      modeSuggestions: [],
      hiddenChordCount: 0,
      hiddenModeCount: 0,
      extraModeSuggestions: [],
      tableChord: '',
      tableMode: '',
      chartChord: '',
      chartMode: '',
      tonalSourceSet: ''
    };
  }

  const filtered = getTonalForTable(song, section, tableID);
  const unfiltered = getTonalForTable(song, section, tableID, { filterWesternScales: false });
  const allChordSuggestions = normalizeArray(filtered.chords);
  const allModeSuggestions = normalizeArray(filtered.scale);
  const extraModeSuggestions = normalizeArray(unfiltered.scale);

  return {
    tableID,
    autoWrite,
    tonalSourceSet: filtered.tonalSourceSet,
    tableChord: filtered.chord || '',
    tableMode: filtered.mode || '',
    chartChord: section.chartChord || '',
    chartMode: section.chartMode || '',
    chordSuggestions: allChordSuggestions.slice(0, limit),
    modeSuggestions: allModeSuggestions.slice(0, limit),
    hiddenChordCount: Math.max(0, allChordSuggestions.length - limit),
    hiddenModeCount: Math.max(0, allModeSuggestions.length - limit),
    allChordSuggestions,
    allModeSuggestions,
    extraModeSuggestions
  };
}

export function formatTonalSuggestionSummary(kind, state = {}) {
  const normalizedKind = normalizeKind(kind);
  const suggestions = normalizedKind === 'chord' ? state.chordSuggestions || [] : state.modeSuggestions || [];
  const hiddenCount = normalizedKind === 'chord' ? state.hiddenChordCount || 0 : state.hiddenModeCount || 0;
  const visibleLimit = normalizedKind === 'chord' ? TONAL_CHORD_SUMMARY_VISIBLE_LIMIT : TONAL_MODE_SUMMARY_VISIBLE_LIMIT;
  if (suggestions.length === 0) {
    return '[]';
  }
  const storedValue = resolveStoredTonalValue(normalizedKind, state);
  const visibleSuggestions = suggestions.slice(0, visibleLimit).map((suggestion) => (
    storedValue === suggestion ? `${formatCommandCheckmark()}${suggestion}` : suggestion
  ));
  const remainingCount = Math.max(0, (suggestions.length - visibleSuggestions.length) + hiddenCount);
  const moreSuffix = remainingCount > 0 ? `, ${remainingCount} more` : '';
  return `[${visibleSuggestions.join(', ')}${moreSuffix}]`;
}

export function buildOverflowResultSuffix(kind, hiddenCount) {
  const normalizedKind = normalizeKind(kind);
  if (!hiddenCount) {
    return '';
  }
  return `; ${hiddenCount} more ${normalizedKind === 'chord' ? 'chords' : 'modes'}, see Tonal picker`;
}

function ensureSectionNotes(song, sectionIndex, tableID) {
  const section = song?.sections?.[sectionIndex] || null;
  if (section && typeof section.getSectionNotes === 'function') {
    section.getSectionNotes(tableID);
  }
}

export function applyTonalSelection({ song = null, sectionIndex = 0, tableID = '', kind = 'chord', value = '', autoWrite = TonalAutoWrite.CHART_AND_TABLE, doSectionChanged = true } = {}) {
  if (!tableID) {
    return false;
  }

  const normalizedKind = normalizeKind(kind);
  const nextValue = `${value || ''}`;
  ensureSectionNotes(song, sectionIndex, tableID);

  if (normalizedKind === 'chord') {
    linkToSectionTableChord(sectionIndex, tableID, nextValue, false);
    if (autoWrite === TonalAutoWrite.CHART_AND_TABLE) {
      linkToSectionChartChord(sectionIndex, nextValue, false);
    }
  } else {
    linkToSectionTableMode(sectionIndex, tableID, nextValue, false);
    if (autoWrite === TonalAutoWrite.CHART_AND_TABLE) {
      linkToSectionChartMode(sectionIndex, nextValue, false);
    }
  }

  if (doSectionChanged) {
    linkToSectionChangedTonal();
  }
  return true;
}

export function writeTonalValueToChart({ sectionIndex = 0, kind = 'chord', value = '', doSectionChanged = true } = {}) {
  const normalizedKind = normalizeKind(kind);
  const nextValue = `${value || ''}`;
  if (normalizedKind === 'chord') {
    linkToSectionChartChord(sectionIndex, nextValue, doSectionChanged);
  } else {
    linkToSectionChartMode(sectionIndex, nextValue, doSectionChanged);
  }
}