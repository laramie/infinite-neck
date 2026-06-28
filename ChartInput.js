import * as Constants from './Constants.js';
import EventBus from './event-bus.js';

const tonalNamespace = globalThis.Tonal?.ChordType
  ? globalThis.Tonal
  : await import('tonal');
const { ChordType } = tonalNamespace;

export const CHART_INPUT_KIND = Object.freeze({
  CHORD: 'chord',
  MODE: 'mode'
});

const CHART_INPUT_NONE = 'none';
const CHART_INPUT_ACTION_NEW_SECTION = 'newSection';
const FIELD_SELECTORS = Object.freeze({
  chord: '#txtChartInputChord',
  mode: '#txtChartInputMode'
});

function normalizeText(value = '') {
  return `${value || ''}`.trim();
}

function compactText(value = '') {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9#bx+/-]+/g, '');
}

function escapeHtml(value = '') {
  return `${value || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function uniqueValues(values = []) {
  return [...new Set(values.filter((value) => `${value || ''}` !== ''))];
}

function sortNoteNamesLongestFirst(noteNames = []) {
  return uniqueValues(noteNames).sort((left, right) => right.length - left.length || left.localeCompare(right));
}

function normalizeKind(kind = CHART_INPUT_KIND.CHORD) {
  return `${kind || ''}`.toLowerCase().startsWith('mode') ? CHART_INPUT_KIND.MODE : CHART_INPUT_KIND.CHORD;
}

function getModeValues(modeOptions = Constants.FILL_SCALE_OPTIONS) {
  return uniqueValues(modeOptions.map((option) => `${option?.value || ''}`.trim()).filter(Boolean));
}

function getPreferredRootName(section = null) {
  const rootID = Number.parseInt(section?.rootID ?? 0, 10);
  const normalizedRootID = Number.isFinite(rootID) ? ((rootID % 12) + 12) % 12 : 0;
  const prefersSharps = section?.sharps === true || (section?.sharps !== false && Constants.noteIdPrefersSharps(normalizedRootID));
  const noteNames = prefersSharps ? Constants.NOTE_NAMES_ARRAY_SHARPS : Constants.NOTE_NAMES_ARRAY;
  return noteNames[normalizedRootID] || Constants.NOTE_NAMES_ARRAY[normalizedRootID] || Constants.NOTE_NAMES_ARRAY[0];
}

function orderedNoteNamesForSection(section = null) {
  const rootID = Number.parseInt(section?.rootID ?? 0, 10);
  const normalizedRootID = Number.isFinite(rootID) ? ((rootID % 12) + 12) % 12 : 0;
  const prefersSharps = section?.sharps === true || (section?.sharps !== false && Constants.noteIdPrefersSharps(normalizedRootID));
  const primary = prefersSharps ? Constants.NOTE_NAMES_ARRAY_SHARPS : Constants.NOTE_NAMES_ARRAY;
  const secondary = prefersSharps ? Constants.NOTE_NAMES_ARRAY : Constants.NOTE_NAMES_ARRAY_SHARPS;
  return uniqueValues([...primary, ...secondary]);
}

function makeEntry(value, searchValues = [], metadata = {}) {
  const rawValue = normalizeText(value);
  const display = metadata.display || rawValue;
  const searchTexts = uniqueValues([display, rawValue, ...searchValues].map(normalizeText));
  return {
    value: rawValue,
    display,
    action: metadata.action || '',
    root: metadata.root || '',
    specifier: metadata.specifier || '',
    keyName: metadata.keyName || '',
    keyID: metadata.keyID,
    leadKeyName: metadata.leadKeyName || '',
    leadKeyID: metadata.leadKeyID,
    compact: compactText(display),
    searchTexts,
    searchCompacts: uniqueValues([display, ...searchValues].map(compactText))
  };
}

function normalizeNoteInput(rawValue = '') {
  const text = normalizeText(rawValue).replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!text) {
    return '';
  }
  const noteNames = [...Constants.NOTE_NAMES_ARRAY, ...Constants.NOTE_NAMES_ARRAY_SHARPS];
  return noteNames.find((noteName) => noteName.toLowerCase() === text.toLowerCase()) || '';
}

export function noteNameToChartInputNoteID(rawValue = '') {
  const noteName = normalizeNoteInput(rawValue);
  if (!noteName) {
    return -1;
  }
  const flatIndex = Constants.NOTE_NAMES_ARRAY.findIndex((candidate) => candidate.toLowerCase() === noteName.toLowerCase());
  if (flatIndex >= 0) {
    return flatIndex;
  }
  return Constants.NOTE_NAMES_ARRAY_SHARPS.findIndex((candidate) => candidate.toLowerCase() === noteName.toLowerCase());
}

export function parseNewSectionCommand(rawValue = '', options = {}) {
  const text = normalizeText(rawValue);
  if (!text.startsWith('!')) {
    return null;
  }

  const defaultKeyName = normalizeNoteInput(options.defaultKeyName || 'C') || 'C';
  const body = text.slice(1).trim();
  let rawLeadKey = '';
  let rawKey = '';

  if (body.includes('/')) {
    const parts = body.split('/');
    rawLeadKey = normalizeText(parts[0]);
    rawKey = normalizeText(parts[1]);
  } else {
    rawKey = body;
  }

  const leadKeyName = normalizeNoteInput(rawLeadKey);
  const parsedKeyName = normalizeNoteInput(rawKey);
  if (rawKey && !parsedKeyName) {
    return null;
  }
  const keyName = parsedKeyName || defaultKeyName;
  const keyID = noteNameToChartInputNoteID(keyName);
  const leadKeyID = leadKeyName ? noteNameToChartInputNoteID(leadKeyName) : -1;

  if (keyID < 0 || (rawLeadKey && leadKeyID < 0)) {
    return null;
  }

  const display = leadKeyName
    ? `Create new Section in Key of ${keyName} with LeadKey of ${leadKeyName}`
    : `Create new Section in Key of ${keyName}`;

  return {
    action: CHART_INPUT_ACTION_NEW_SECTION,
    value: text,
    display,
    keyName,
    keyID,
    leadKeyName,
    leadKeyID
  };
}

function buildNewSectionSuggestion(rawValue = '') {
  const command = parseNewSectionCommand(rawValue);
  if (!command) {
    return [];
  }
  return [makeEntry(command.value, [command.display], command)];
}

export function buildChordSuggestionCatalog({ chordTypes = ChordType.symbols().sort(), noteNamesFlat = Constants.NOTE_NAMES_ARRAY, noteNamesSharp = Constants.NOTE_NAMES_ARRAY_SHARPS } = {}) {
  const noteNames = uniqueValues([...noteNamesFlat, ...noteNamesSharp]);
  const chordSuffixes = uniqueValues(chordTypes.map(normalizeText)).sort();
  const entries = [makeEntry(CHART_INPUT_NONE, ['clear'])];

  noteNames.forEach((noteName) => {
    chordSuffixes.forEach((suffix) => {
      entries.push(makeEntry(`${noteName}${suffix}`, [suffix], { root: noteName, specifier: suffix }));
    });
  });

  return entries;
}

export function buildModeSuggestionCatalog({ modeOptions = Constants.FILL_SCALE_OPTIONS, noteNamesFlat = Constants.NOTE_NAMES_ARRAY, noteNamesSharp = Constants.NOTE_NAMES_ARRAY_SHARPS } = {}) {
  const noteNames = uniqueValues([...noteNamesFlat, ...noteNamesSharp]);
  const modeValues = getModeValues(modeOptions).sort();
  const entries = [makeEntry(CHART_INPUT_NONE, ['clear'])];

  noteNames.forEach((noteName) => {
    modeValues.forEach((modeName) => {
      entries.push(makeEntry(`${noteName} ${modeName}`, [modeName], { root: noteName, specifier: modeName }));
    });
  });

  return entries;
}

export function parseChartInputQuery(rawValue = '', kind = CHART_INPUT_KIND.CHORD, options = {}) {
  const text = normalizeText(rawValue);
  const normalizedKind = normalizeKind(kind);
  const noteNames = sortNoteNamesLongestFirst(options.noteNames || [...Constants.NOTE_NAMES_ARRAY, ...Constants.NOTE_NAMES_ARRAY_SHARPS]);
  const matchedRoot = noteNames.find((noteName) => text.toLowerCase().startsWith(noteName.toLowerCase())) || '';
  const specifier = matchedRoot ? text.slice(matchedRoot.length).trim() : text;
  return {
    kind: normalizedKind,
    text,
    root: matchedRoot,
    specifier,
    hasRoot: !!matchedRoot,
    hasSpecifier: compactText(specifier).length > 0,
    compactText: compactText(text),
    compactSpecifier: compactText(specifier)
  };
}

function buildSectionScopedEntries(kind, section = null) {
  const normalizedKind = normalizeKind(kind);
  const rootName = getPreferredRootName(section);
  if (normalizedKind === CHART_INPUT_KIND.CHORD) {
    return buildChordSuggestionCatalog({ noteNamesFlat: [rootName], noteNamesSharp: [] });
  }
  return buildModeSuggestionCatalog({ noteNamesFlat: [rootName], noteNamesSharp: [] });
}

function rankEntry(entry, query) {
  if (!query.compactText) {
    return null;
  }
  if (entry.value === CHART_INPUT_NONE && compactText(CHART_INPUT_NONE).startsWith(query.compactText)) {
    return 0;
  }

  const textCandidates = entry.searchTexts || [entry.display];
  const rawCandidates = uniqueValues([query.text, query.specifier].map(normalizeText).filter(Boolean));
  if (rawCandidates.some((rawCandidate) => textCandidates.some((candidate) => candidate === rawCandidate))) {
    return 1;
  }
  if (rawCandidates.some((rawCandidate) => textCandidates.some((candidate) => candidate.startsWith(rawCandidate)))) {
    return 2;
  }

  const candidates = entry.searchCompacts || [entry.compact];
  if (candidates.some((candidate) => candidate.startsWith(query.compactText))) {
    return 3;
  }
  if (query.compactSpecifier && candidates.some((candidate) => candidate.startsWith(query.compactSpecifier))) {
    return 4;
  }
  if (candidates.some((candidate) => candidate.includes(query.compactText))) {
    return 5;
  }
  if (query.compactSpecifier && candidates.some((candidate) => candidate.includes(query.compactSpecifier))) {
    return 6;
  }
  return null;
}

export function filterChartInputSuggestions(rawValue = '', catalog = [], kind = CHART_INPUT_KIND.CHORD, options = {}) {
  const query = parseChartInputQuery(rawValue, kind, options);
  if (normalizeKind(kind) === CHART_INPUT_KIND.CHORD && query.text.startsWith('!')) {
    return buildNewSectionSuggestion(query.text);
  }
  if (!query.compactText) {
    return [];
  }
  if (query.hasRoot && !query.hasSpecifier && query.compactText !== compactText(CHART_INPUT_NONE)) {
    return [];
  }

  const sectionScopedEntries = query.hasRoot ? [] : buildSectionScopedEntries(kind, options.section || null);
  const entries = query.hasRoot
    ? catalog.filter((entry) => !entry.root || entry.root.toLowerCase() === query.root.toLowerCase())
    : sectionScopedEntries;
  return entries
    .map((entry, index) => ({ entry, index, rank: rankEntry(entry, query) }))
    .filter((item) => item.rank !== null)
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .map((item) => item.entry);
}

export function cycleSuggestion(currentIndex = -1, suggestions = []) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return -1;
  }
  return (currentIndex + 1 + suggestions.length) % suggestions.length;
}

export function formatSuggestionColumns(suggestions = [], currentIndex = 0, options = {}) {
  const maxColumns = Number.isInteger(options.maxColumns) ? options.maxColumns : 5;
  const defaultItemsPerColumn = Number.isInteger(options.itemsPerColumn) ? options.itemsPerColumn : 5;
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return [];
  }
  const itemsPerColumn = Math.ceil(suggestions.length / defaultItemsPerColumn) > maxColumns
    ? Math.ceil(suggestions.length / maxColumns)
    : defaultItemsPerColumn;
  const columns = [];
  for (let index = 0; index < suggestions.length; index += itemsPerColumn) {
    columns.push(suggestions.slice(index, index + itemsPerColumn).map((suggestion, offset) => ({
      ...suggestion,
      index: index + offset,
      current: index + offset === currentIndex
    })));
  }
  return columns;
}

export function resolveAcceptedSuggestion(rawValue = '', suggestions = [], currentIndex = 0) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return null;
  }
  return suggestions[currentIndex] || suggestions[0] || null;
}

export function buildChartInputHtml() {
  return "<div id='divChartInput' class='chartInputPanel'>"
    + "<div class='chartInputToolbar'><button id='btnFloatChartInput' type='button' class='BtnPunchedOut'>Float</button></div>"
    + "<div class='chartInputCurrentValues'><span class='lblSectionChartChord'></span><span class='lblSectionMode'></span></div>"
    + "<div id='chartInputSuggestions' class='chartInputSuggestionList' aria-live='polite'></div>"
    + "<div class='chartInputRow'>"
    + "<label for='txtChartInputChord'>chord: </label><input id='txtChartInputChord' class='chartInputField' data-chart-input-kind='chord' type='text' autocomplete='off'>"
    + "<label for='txtChartInputMode'>mode: </label><input id='txtChartInputMode' class='chartInputField' data-chart-input-kind='mode' type='text' autocomplete='off'>"
    + '</div>'
    + '</div>';
}

function renderSuggestionColumnsHtml(suggestions = [], currentIndex = 0) {
  const columns = formatSuggestionColumns(suggestions, currentIndex);
  return columns.map((column) => {
    const items = column.map((suggestion) => {
      const currentClass = suggestion.current ? ' chartInputSuggestion--current' : '';
      return `<div class='chartInputSuggestion${currentClass}' data-chart-input-suggestion-index='${suggestion.index}'>${escapeHtml(suggestion.display)}</div>`;
    }).join('');
    return `<div class='chartInputSuggestionColumn'>${items}</div>`;
  }).join('');
}

export function createChartInputController(deps = {}) {
  const state = {
    initialized: false,
    activeKind: CHART_INPUT_KIND.CHORD,
    currentIndex: 0,
    suggestions: [],
    chordCatalog: buildChordSuggestionCatalog(),
    modeCatalog: buildModeSuggestionCatalog()
  };

  function getSong() {
    return typeof deps.getSong === 'function' ? deps.getSong() : null;
  }

  function getCurrentSectionIndex() {
    return typeof deps.getSectionsCurrentIndex === 'function' ? deps.getSectionsCurrentIndex() : 0;
  }

  function getCurrentSection() {
    const song = getSong();
    return typeof song?.getCurrentSection === 'function' ? song.getCurrentSection() : song?.sections?.[getCurrentSectionIndex()] || null;
  }

  function getFocusedField() {
    const active = typeof document !== 'undefined' ? document.activeElement : null;
    return active?.classList?.contains('chartInputField') ? active : null;
  }

  function getField(kind) {
    if (typeof document === 'undefined') {
      return null;
    }
    return document.querySelector(FIELD_SELECTORS[normalizeKind(kind)]);
  }

  function getCatalog(kind) {
    return normalizeKind(kind) === CHART_INPUT_KIND.CHORD ? state.chordCatalog : state.modeCatalog;
  }

  function getStoredValue(kind) {
    const section = getCurrentSection();
    return normalizeKind(kind) === CHART_INPUT_KIND.CHORD
      ? `${section?.chartChord || ''}`
      : `${section?.chartMode || ''}`;
  }

  function isDirtyField(field) {
    if (!field) {
      return false;
    }
    const kind = normalizeKind(field.dataset.chartInputKind);
    return `${field.value || ''}` !== getStoredValue(kind);
  }

  function logDiscardedEdit(field) {
    if (!isDirtyField(field)) {
      return;
    }
    const kind = normalizeKind(field.dataset.chartInputKind);
    EventBus.trigger('UserLog', {
      subSystem: 'ChartInput',
      message: `Discarded unaccepted ${kind} edit: ${field.value}`
    });
  }

  function updateSuggestionsForField(field) {
    const suggestionHost = typeof document !== 'undefined' ? document.getElementById('chartInputSuggestions') : null;
    if (!field || !suggestionHost) {
      return;
    }
    const kind = normalizeKind(field.dataset.chartInputKind);
    state.activeKind = kind;
    state.suggestions = filterChartInputSuggestions(field.value, getCatalog(kind), kind, {
      section: getCurrentSection(),
      noteNames: orderedNoteNamesForSection(getCurrentSection())
    });
    state.currentIndex = state.suggestions.length > 0 ? 0 : -1;
    suggestionHost.innerHTML = renderSuggestionColumnsHtml(state.suggestions, state.currentIndex);
  }

  function rerenderSuggestions() {
    const suggestionHost = typeof document !== 'undefined' ? document.getElementById('chartInputSuggestions') : null;
    if (!suggestionHost) {
      return;
    }
    suggestionHost.innerHTML = renderSuggestionColumnsHtml(state.suggestions, state.currentIndex);
  }

  function refreshFromSection() {
    const chordField = getField(CHART_INPUT_KIND.CHORD);
    const modeField = getField(CHART_INPUT_KIND.MODE);
    if (chordField) {
      chordField.value = getStoredValue(CHART_INPUT_KIND.CHORD);
    }
    if (modeField) {
      modeField.value = getStoredValue(CHART_INPUT_KIND.MODE);
    }
    const focusedField = getFocusedField();
    if (focusedField) {
      updateSuggestionsForField(focusedField);
    } else {
      const suggestionHost = typeof document !== 'undefined' ? document.getElementById('chartInputSuggestions') : null;
      if (suggestionHost) {
        suggestionHost.innerHTML = '';
      }
      state.suggestions = [];
      state.currentIndex = -1;
    }
  }

  function acceptCurrentSuggestion(field) {
    const accepted = resolveAcceptedSuggestion(field.value, state.suggestions, state.currentIndex);
    if (!accepted) {
      return;
    }
    const kind = normalizeKind(field.dataset.chartInputKind);
    if (kind === CHART_INPUT_KIND.CHORD && accepted.action === CHART_INPUT_ACTION_NEW_SECTION) {
      if (typeof deps.createNewSectionAfterCurrent === 'function') {
        deps.createNewSectionAfterCurrent({
          rootID: accepted.keyID,
          rootIDLead: accepted.leadKeyID
        });
      }
      refreshFromSection();
      field.focus();
      return;
    }
    const value = accepted.value === CHART_INPUT_NONE ? '' : accepted.value;
    const sectionIndex = getCurrentSectionIndex();
    if (kind === CHART_INPUT_KIND.CHORD && typeof deps.linkToSectionChartChord === 'function') {
      deps.linkToSectionChartChord(sectionIndex, value);
    } else if (kind === CHART_INPUT_KIND.MODE && typeof deps.linkToSectionChartMode === 'function') {
      deps.linkToSectionChartMode(sectionIndex, value);
    }
    refreshFromSection();
    field.focus();
  }

  function navigateFromField(field, key) {
    logDiscardedEdit(field);
    if (key === ',' && typeof deps.prevSection === 'function') {
      deps.prevSection();
    } else if (key === '.' && typeof deps.nextSection === 'function') {
      deps.nextSection();
    } else if (key === '<' && typeof deps.firstSection === 'function') {
      deps.firstSection();
    } else if (key === '>' && typeof deps.lastSection === 'function') {
      deps.lastSection();
    }
    refreshFromSection();
    field.focus();
  }

  function handleKeydown(event) {
    const field = event.target?.classList?.contains('chartInputField') ? event.target : null;
    if (!field) {
      return;
    }

    if (event.key === ' ' && !event.shiftKey) {
      if (state.suggestions.length > 0) {
        event.preventDefault();
        state.currentIndex = cycleSuggestion(state.currentIndex, state.suggestions);
        rerenderSuggestions();
      }
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      acceptCurrentSuggestion(field);
      return;
    }

    if ([',', '.', '<', '>'].includes(event.key)) {
      event.preventDefault();
      navigateFromField(field, event.key);
    }
  }

  function handleInput(event) {
    const field = event.target?.classList?.contains('chartInputField') ? event.target : null;
    if (field) {
      updateSuggestionsForField(field);
    }
  }

  function handleFocus(event) {
    const field = event.target?.classList?.contains('chartInputField') ? event.target : null;
    if (field) {
      updateSuggestionsForField(field);
    }
  }

  function handleFloatClick(event) {
    const button = event.target?.closest?.('#btnFloatChartInput');
    if (!button) {
      return;
    }
    event.preventDefault();
    if (typeof window !== 'undefined' && typeof window.makeDivDockable === 'function') {
      window.makeDivDockable('divChartInput');
    }
  }

  function bindEvents() {
    if (state.initialized || typeof document === 'undefined') {
      return;
    }
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('input', handleInput);
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('click', handleFloatClick);
    state.initialized = true;
  }

  function ensurePanel(containerSelector = '#divChartInputTab') {
    if (typeof document === 'undefined') {
      return;
    }
    const container = document.querySelector(containerSelector);
    const existingPanel = document.getElementById('divChartInput');
    if (container && !existingPanel) {
      container.innerHTML = buildChartInputHtml();
    }
    bindEvents();
    refreshFromSection();
  }

  return {
    ensurePanel,
    refreshFromSection,
    updateSuggestionsForField,
    getState: () => ({ ...state })
  };
}
