import * as Constants from './Constants.js';
import { Note } from './Note.js';
import { lookupClassForNote } from './colorFunctions.js';

export const TARGET_TABLE_OPTION_LIMIT = 9;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toInt(value, fallback = null) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function rowKey(row, col) {
  return `${row}:${col}`;
}

function shouldRecalculateColor(colorClass) {
  return /^note([1-9]|1[0-2])$/.test(`${colorClass || ''}`);
}

export function getTableID(tuning) {
  return `${Constants.TABLE_ID_PREFIX}${tuning.baseID}`;
}

export function getTuningCompatibilityID(tuning) {
  return `${tuning?.fromBaseID || tuning?.baseID || ''}`;
}

export function getTuningStringCount(tuning = {}) {
  const explicitCount = toInt(tuning?.nStrings, null);
  if (Number.isInteger(explicitCount) && explicitCount > 0) {
    return explicitCount;
  }
  return Array.isArray(tuning?.rowRange) ? tuning.rowRange.length : 0;
}

export function canMidiPasteBetweenTunings(sourceTuning = {}, targetTuning = {}) {
  const sourceStringCount = getTuningStringCount(sourceTuning);
  const targetStringCount = getTuningStringCount(targetTuning);

  return sourceTuning?.baseInstrument === 'Guitar'
    && targetTuning?.baseInstrument === 'Guitar'
    && sourceStringCount === 6
    && targetStringCount === 6
    && Array.isArray(sourceTuning?.rowRange)
    && Array.isArray(targetTuning?.rowRange)
    && sourceTuning.rowRange.length === 6
    && targetTuning.rowRange.length === 6;
}

export function getEligibleTargetTunings(song = {}) {
  if (!song || !Array.isArray(song.myTunings)) {
    return [];
  }
  const wiredTableNames = new Set((song.wirings || []).map((wiring) => wiring?.tablename).filter(Boolean));
  return song.myTunings.filter((tuning) => !wiredTableNames.has(getTableID(tuning)));
}

export function buildTargetTableOptions(song = {}, limit = TARGET_TABLE_OPTION_LIMIT) {
  return getEligibleTargetTunings(song)
    .slice(0, limit)
    .map((tuning, index) => ({
      value: getTableID(tuning),
      caption: `${index + 1}) ${tuning.baseID}`,
      trigger: `${index + 1}`
    }));
}

export function createTuningLayout(tuning = {}) {
  const fretCount = Math.max(0, toInt(tuning.frets, 0));
  const rowRange = Array.isArray(tuning.rowRange) ? tuning.rowRange : [];
  const totalColumns = tuning.nut ? fretCount + 1 : fretCount;
  const cells = [];
  const byRowCol = new Map();
  const byRowMidi = new Map();
  const byMidi = new Map();
  const rows = [];

  rowRange.forEach((openMidiRaw, rowIndex) => {
    const openMidi = toInt(openMidiRaw, 0);
    const rowCells = [];
    const rowByCol = new Map();
    const rowByMidi = new Map();
    const banjoNut = tuning?.banjoNut?.[rowIndex];

    for (let colIndex = 0; colIndex < totalColumns; colIndex += 1) {
      let deadCell = false;
      let isNut = false;

      if (banjoNut != null) {
        if (tuning.reverse) {
          if (colIndex === (totalColumns - banjoNut - 1)) {
            isNut = true;
          } else if (colIndex > (totalColumns - banjoNut - 1)) {
            deadCell = true;
          }
        } else if (colIndex === banjoNut) {
          isNut = true;
        } else if (colIndex < banjoNut) {
          deadCell = true;
        }
      } else if ((colIndex === 0) && tuning.nut && !tuning.reverse) {
        isNut = true;
      } else if ((colIndex === fretCount) && tuning.nut && tuning.reverse) {
        isNut = true;
      }

      if (deadCell) {
        continue;
      }

      const col = tuning.reverse ? fretCount - colIndex : colIndex;
      const midinum = tuning.reverse ? openMidi + fretCount - colIndex : openMidi + colIndex;
      const cell = {
        row: rowIndex,
        col,
        midinum,
        noteName: Constants.midinumToNoteName(midinum),
        isNut
      };

      cells.push(cell);
      rowCells.push(cell);
      rowByCol.set(col, cell);
      rowByMidi.set(midinum, cell);
      byMidi.set(midinum, [...(byMidi.get(midinum) || []), cell]);
    }

    rows[rowIndex] = {
      row: rowIndex,
      cells: rowCells,
      byCol: rowByCol,
      byMidi: rowByMidi,
      nutCell: rowCells.find((cell) => cell.isNut) || rowCells[0] || null
    };
    byRowCol.set(rowIndex, rowByCol);
    byRowMidi.set(rowIndex, rowByMidi);
  });

  return {
    tuning,
    cells,
    rows,
    byRowCol,
    byRowMidi,
    byMidi
  };
}

export function getCellByRowCol(layout, row, col) {
  return layout?.byRowCol?.get(row)?.get(col) || null;
}

export function getCellByRowMidi(layout, row, midinum) {
  return layout?.byRowMidi?.get(row)?.get(midinum) || null;
}

export function getPreferredCellForMidi(layout, midinum, preferredRow = null) {
  if (preferredRow != null) {
    const preferred = getCellByRowMidi(layout, preferredRow, midinum);
    if (preferred) {
      return preferred;
    }
  }
  return (layout?.byMidi?.get(midinum) || [])[0] || null;
}

export function isNutCell(layout, row, col) {
  return !!getCellByRowCol(layout, row, col)?.isNut;
}

export function isBendLandingLegal(layout, row, col) {
  return !isNutCell(layout, row, col);
}

function getJumpDelta(layout, row, direction) {
  const currentNut = layout?.rows?.[row]?.nutCell?.midinum;
  if (!Number.isInteger(currentNut)) {
    return 0;
  }
  if (direction === 'up') {
    const previous = layout?.rows?.[row - 1]?.nutCell?.midinum;
    if (Number.isInteger(previous)) {
      return previous - currentNut;
    }
    const next = layout?.rows?.[row + 1]?.nutCell?.midinum;
    if (Number.isInteger(next)) {
      return currentNut - next;
    }
    return 0;
  }

  const next = layout?.rows?.[row + 1]?.nutCell?.midinum;
  if (Number.isInteger(next)) {
    return next - currentNut;
  }
  const previous = layout?.rows?.[row - 1]?.nutCell?.midinum;
  if (Number.isInteger(previous)) {
    return currentNut - previous;
  }
  return 0;
}

function buildOverflowSearchRows(rowCount, sourceRow, ascending) {
  const rows = [];
  for (let offset = 1; offset < rowCount; offset += 1) {
    rows.push(ascending
      ? (sourceRow + offset) % rowCount
      : (sourceRow - offset + rowCount) % rowCount);
  }
  return rows;
}

function buildDropReason(candidate, motion, reason) {
  if (reason) {
    return reason;
  }
  const row = candidate.sourceRow;
  switch (motion) {
    case 'j':
      return `no string above row ${row}`;
    case 'J':
      return `no string below row ${row}`;
    case 'u':
      return 'no fret above legal range';
    case 'd':
      return 'no fret below legal range';
    default:
      return 'no legal landing place';
  }
}

function buildDropEntry(candidate, logContext, reason) {
  return {
    Note: clone(candidate.note),
    algorithm: logContext.algorithm,
    reason,
    optionsSummary: logContext.optionsSummary,
    applyNumber: logContext.applyNumber,
    beat: candidate.beat ?? null,
    tableID: candidate.tableID,
    storageKind: candidate.storageKind
  };
}

function normalizeMovedColor(note, lookupContext) {
  if (!note?.colorClass || !shouldRecalculateColor(note.colorClass)) {
    return note?.colorClass;
  }
  const lookedUp = lookupClassForNote(note, lookupContext);
  return lookedUp?.colorClass || note.colorClass;
}

function reconstructMovedNote(candidate, cell, lookupContext) {
  const moved = clone(candidate.note);
  moved.midinum = `${cell.midinum}`;
  moved.noteName = Constants.midinumToNoteName(cell.midinum);
  moved.row = `${cell.row}`;

  if (candidate.styleNum === Note.STYLENUM_MIDIPITCHES) {
    delete moved.col;
  } else {
    moved.col = `${cell.col}`;
  }

  moved.colorClass = normalizeMovedColor(moved, lookupContext);
  return moved;
}

function getCellKeyForNote(layout, note) {
  const row = toInt(note?.row);
  const col = toInt(note?.col);
  if (Number.isInteger(row) && Number.isInteger(col)) {
    return rowKey(row, col);
  }
  const midinum = toInt(note?.midinum);
  if (Number.isInteger(row) && Number.isInteger(midinum)) {
    const cell = getCellByRowMidi(layout, row, midinum);
    if (cell) {
      return rowKey(cell.row, cell.col);
    }
  }
  return null;
}

function createScratch() {
  return {
    playedNotes: [],
    recordedNotes: {},
    playedSingleCells: new Set(),
    playedTinyBendCells: new Set(),
    playedAnyCells: new Set(),
    recordedSingleCellsByBeat: new Map(),
    recordedTinyBendCellsByBeat: new Map(),
    recordedHighlightSingleCellsByBeat: new Map(),
    recordedHighlightPitchBeat: new Set()
  };
}

function getBeatSet(map, beat) {
  if (!map.has(beat)) {
    map.set(beat, new Set());
  }
  return map.get(beat);
}

function getCollisionDescriptor(layout, note, storageKind, beat) {
  const styleNum = toInt(note?.styleNum);
  const cellKey = getCellKeyForNote(layout, note);

  if (storageKind === 'played') {
    if (styleNum === Note.STYLENUM_SINGLE && cellKey) {
      return { kind: 'playedSingle', key: cellKey, anyCell: cellKey };
    }
    if ((styleNum === Note.STYLENUM_TINY || styleNum === Note.STYLENUM_BEND) && cellKey) {
      return { kind: 'playedTinyBend', key: cellKey, anyCell: cellKey };
    }
    if (cellKey) {
      return { kind: 'playedAny', key: cellKey, anyCell: cellKey };
    }
    return null;
  }

  if (styleNum === Note.STYLENUM_SINGLE && cellKey) {
    return { kind: 'recordedSingle', key: `${beat}:${cellKey}`, cellKey };
  }
  if ((styleNum === Note.STYLENUM_TINY || styleNum === Note.STYLENUM_BEND) && cellKey) {
    return { kind: 'recordedTinyBend', key: `${beat}:${cellKey}`, cellKey };
  }
  if (styleNum === Note.STYLENUM_MIDIPITCHESSINGLE && cellKey) {
    return { kind: 'recordedHighlightSingle', key: `${beat}:${cellKey}`, cellKey };
  }
  if (styleNum === Note.STYLENUM_MIDIPITCHES) {
    return { kind: 'recordedHighlightPitch', key: `${beat}` };
  }
  if (cellKey) {
    return { kind: 'recordedAny', key: `${beat}:${cellKey}`, cellKey };
  }
  return null;
}

function addScratchNote(scratch, layout, note, storageKind, beat, dropReason = 'moved note already played') {
  const descriptor = getCollisionDescriptor(layout, note, storageKind, beat);

  if (storageKind === 'recorded' && descriptor?.cellKey && scratch.playedAnyCells.has(descriptor.cellKey)) {
    return { accepted: false, reason: 'played note takes precedence' };
  }

  switch (descriptor?.kind) {
    case 'playedSingle':
      if (scratch.playedSingleCells.has(descriptor.key)) {
        return { accepted: false, reason: dropReason };
      }
      scratch.playedSingleCells.add(descriptor.key);
      scratch.playedAnyCells.add(descriptor.anyCell);
      break;
    case 'playedTinyBend':
      if (scratch.playedTinyBendCells.has(descriptor.key)) {
        return { accepted: false, reason: dropReason };
      }
      scratch.playedTinyBendCells.add(descriptor.key);
      scratch.playedAnyCells.add(descriptor.anyCell);
      break;
    case 'playedAny':
      scratch.playedAnyCells.add(descriptor.anyCell);
      break;
    case 'recordedSingle': {
      const set = getBeatSet(scratch.recordedSingleCellsByBeat, beat);
      if (set.has(descriptor.cellKey)) {
        return { accepted: false, reason: dropReason };
      }
      set.add(descriptor.cellKey);
      break;
    }
    case 'recordedTinyBend': {
      const set = getBeatSet(scratch.recordedTinyBendCellsByBeat, beat);
      if (set.has(descriptor.cellKey)) {
        return { accepted: false, reason: dropReason };
      }
      set.add(descriptor.cellKey);
      break;
    }
    case 'recordedHighlightSingle': {
      const set = getBeatSet(scratch.recordedHighlightSingleCellsByBeat, beat);
      if (set.has(descriptor.cellKey)) {
        return { accepted: false, reason: dropReason };
      }
      set.add(descriptor.cellKey);
      break;
    }
    case 'recordedHighlightPitch':
      if (scratch.recordedHighlightPitchBeat.has(`${beat}`)) {
        return { accepted: false, reason: dropReason };
      }
      scratch.recordedHighlightPitchBeat.add(`${beat}`);
      break;
    default:
      break;
  }

  if (storageKind === 'played') {
    scratch.playedNotes.push(note);
  } else {
    scratch.recordedNotes[`${beat}`] = scratch.recordedNotes[`${beat}`] || [];
    scratch.recordedNotes[`${beat}`].push(note);
  }
  return { accepted: true };
}

function shouldMoveStyle(styleNum, storageKind, include) {
  if (storageKind === 'played' && !include.played) {
    return false;
  }
  if (storageKind === 'recorded' && !include.recorded) {
    return false;
  }
  if (styleNum === Note.STYLENUM_SINGLE) {
    return include.single;
  }
  if (styleNum === Note.STYLENUM_TINY || styleNum === Note.STYLENUM_BEND) {
    return include.tiny;
  }
  if ((styleNum === Note.STYLENUM_MIDIPITCHESSINGLE || styleNum === Note.STYLENUM_MIDIPITCHES) && storageKind === 'recorded') {
    return include.highlights;
  }
  return false;
}

function collectSectionData(sectionNotes, include) {
  const candidates = [];
  const untouchedPlayed = [];
  const untouchedRecorded = [];

  (sectionNotes?.playedNotes || []).forEach((note, index) => {
    const styleNum = toInt(note?.styleNum, Note.STYLENUM_TINY);
    const candidate = {
      tableID: null,
      storageKind: 'played',
      beat: null,
      styleNum,
      note,
      sourceRow: toInt(note?.row),
      sourceCol: toInt(note?.col),
      sourceMidinum: toInt(note?.midinum),
      sourceNoteName: note?.noteName || '',
      sourceIndex: index
    };
    if (shouldMoveStyle(styleNum, 'played', include)) {
      candidates.push(candidate);
    } else {
      untouchedPlayed.push(note);
    }
  });

  Object.entries(sectionNotes?.recordedNotes || {}).forEach(([beat, notesForBeat]) => {
    (notesForBeat || []).forEach((note, index) => {
      const styleNum = toInt(note?.styleNum, Note.STYLENUM_TINY);
      const candidate = {
        tableID: null,
        storageKind: 'recorded',
        beat: `${beat}`,
        styleNum,
        note,
        sourceRow: toInt(note?.row),
        sourceCol: toInt(note?.col),
        sourceMidinum: toInt(note?.midinum),
        sourceNoteName: note?.noteName || '',
        sourceIndex: index
      };
      if (shouldMoveStyle(styleNum, 'recorded', include)) {
        candidates.push(candidate);
      } else {
        untouchedRecorded.push({ beat: `${beat}`, note });
      }
    });
  });

  return { candidates, untouchedPlayed, untouchedRecorded };
}

function sortCandidates(candidates, motion) {
  return [...candidates].sort((left, right) => {
    if (left.storageKind !== right.storageKind) {
      return left.storageKind === 'played' ? -1 : 1;
    }
    if (motion === 'j') {
      return (left.sourceRow ?? 0) - (right.sourceRow ?? 0) || left.sourceIndex - right.sourceIndex;
    }
    if (motion === 'J') {
      return (right.sourceRow ?? 0) - (left.sourceRow ?? 0) || left.sourceIndex - right.sourceIndex;
    }
    return left.sourceIndex - right.sourceIndex;
  });
}

function resolveCellBoundMovement(candidate, layout, motion, algorithm) {
  const sourceRow = candidate.sourceRow;
  const sourceMidinum = candidate.sourceMidinum;
  const sourceCol = candidate.sourceCol;

  if (!Number.isInteger(sourceMidinum)) {
    return { drop: true, reason: 'malformed note had no midinum' };
  }
  if (!Number.isInteger(sourceRow)) {
    return { drop: true, reason: 'malformed note had no row' };
  }
  if (!Number.isInteger(sourceCol)) {
    const sourceCell = getCellByRowMidi(layout, sourceRow, sourceMidinum);
    if (!sourceCell) {
      return { drop: true, reason: 'malformed note had no col' };
    }
    candidate.sourceCol = sourceCell.col;
  }

  if (motion === 'u' || motion === 'd') {
    const delta = motion === 'u' ? 1 : -1;
    const failedDirectMidi = sourceMidinum + delta;
    const directCell = getCellByRowMidi(layout, sourceRow, failedDirectMidi);
    if (directCell) {
      return { cell: directCell };
    }
    if (algorithm === 'drop') {
      return { drop: true, reason: buildDropReason(candidate, motion) };
    }

    const overflowMidi = motion === 'u' ? failedDirectMidi - 12 : failedDirectMidi + 12;
    const sameRowCell = getCellByRowMidi(layout, sourceRow, overflowMidi);
    if (sameRowCell) {
      return { cell: sameRowCell };
    }
    if (algorithm === 'string') {
      return { drop: true, reason: buildDropReason(candidate, motion) };
    }

    const ascending = motion === 'u';
    const rows = buildOverflowSearchRows(layout.rows.length, sourceRow, ascending);
    for (const row of rows) {
      const cell = getCellByRowMidi(layout, row, overflowMidi);
      if (cell) {
        return { cell };
      }
    }
    return { drop: true, reason: buildDropReason(candidate, motion) };
  }

  const rowDelta = motion === 'j' ? -1 : 1;
  const targetRow = sourceRow + rowDelta;
  const directCell = getCellByRowCol(layout, targetRow, candidate.sourceCol);
  if (directCell) {
    return { cell: directCell };
  }

  if (algorithm === 'string') {
    const wrappedRow = motion === 'j' ? layout.rows.length - 1 : 0;
    const wrappedOnlyBecauseOfOverflow = (motion === 'j' && targetRow < 0)
      || (motion === 'J' && targetRow >= layout.rows.length);
    if (wrappedOnlyBecauseOfOverflow) {
      const wrappedCell = getCellByRowCol(layout, wrappedRow, candidate.sourceCol);
      if (wrappedCell) {
        return { cell: wrappedCell };
      }
    }
    return { drop: true, reason: buildDropReason(candidate, motion) };
  }

  const failedDirectMidi = sourceMidinum + getJumpDelta(layout, sourceRow, motion === 'j' ? 'up' : 'down');
  if (algorithm !== 'octave') {
    return { drop: true, reason: buildDropReason(candidate, motion) };
  }

  const overflowMidi = motion === 'j' ? failedDirectMidi - 12 : failedDirectMidi + 12;
  const rows = buildOverflowSearchRows(layout.rows.length, sourceRow, motion === 'j');
  for (const row of rows) {
    const cell = getCellByRowMidi(layout, row, overflowMidi);
    if (cell) {
      return { cell };
    }
  }
  return { drop: true, reason: buildDropReason(candidate, motion) };
}

function resolveHighlightPitchMovement(candidate, layout, motion) {
  const sourceMidinum = candidate.sourceMidinum;
  if (!Number.isInteger(sourceMidinum)) {
    return { drop: true, reason: 'malformed note had no midinum' };
  }
  const preferredRow = Number.isInteger(candidate.sourceRow) ? candidate.sourceRow : null;

  let nextMidi = sourceMidinum;
  if (motion === 'u') {
    nextMidi += 1;
  } else if (motion === 'd') {
    nextMidi -= 1;
  } else if (motion === 'j') {
    nextMidi += getJumpDelta(layout, preferredRow ?? 0, 'up');
  } else if (motion === 'J') {
    nextMidi += getJumpDelta(layout, preferredRow ?? 0, 'down');
  }

  const cell = getPreferredCellForMidi(layout, nextMidi, preferredRow);
  if (!cell) {
    return { drop: true, reason: 'no legal landing place' };
  }
  return { cell };
}

function resolveLanding(candidate, layout, motion, algorithm) {
  if (candidate.styleNum === Note.STYLENUM_MIDIPITCHES) {
    return resolveHighlightPitchMovement(candidate, layout, motion);
  }
  return resolveCellBoundMovement(candidate, layout, motion, algorithm);
}

export function applyMovePlan({
  tableID,
  sectionNotes,
  tuning,
  motion,
  algorithm,
  include,
  lookupContext,
  logContext
}) {
  const layout = createTuningLayout(tuning);
  const { candidates, untouchedPlayed, untouchedRecorded } = collectSectionData(sectionNotes, include);
  const scratch = createScratch();
  const droppedEntries = [];
  let movedCount = 0;

  untouchedPlayed.forEach((note) => {
    const result = addScratchNote(scratch, layout, clone(note), 'played', null, 'audit repair');
    if (!result.accepted) {
      droppedEntries.push(buildDropEntry({ tableID, storageKind: 'played', beat: null, note }, logContext, result.reason));
    }
  });

  untouchedRecorded.forEach(({ beat, note }) => {
    const result = addScratchNote(scratch, layout, clone(note), 'recorded', beat, 'audit repair');
    if (!result.accepted) {
      droppedEntries.push(buildDropEntry({ tableID, storageKind: 'recorded', beat, note }, logContext, result.reason));
    }
  });

  sortCandidates(candidates.map((candidate) => ({ ...candidate, tableID })), motion).forEach((candidate) => {
    const landing = resolveLanding(candidate, layout, motion, algorithm);
    if (landing.drop) {
      droppedEntries.push(buildDropEntry(candidate, logContext, landing.reason));
      return;
    }

    if (candidate.styleNum === Note.STYLENUM_BEND && !isBendLandingLegal(layout, landing.cell.row, landing.cell.col)) {
      droppedEntries.push(buildDropEntry(candidate, logContext, 'bend cannot land on nut'));
      return;
    }

    const movedNote = reconstructMovedNote(candidate, landing.cell, lookupContext);
    const addResult = addScratchNote(scratch, layout, movedNote, candidate.storageKind, candidate.beat, 'moved note already played');
    if (!addResult.accepted) {
      droppedEntries.push(buildDropEntry(candidate, logContext, addResult.reason));
      return;
    }

    movedCount += 1;
  });

  return {
    playedNotes: scratch.playedNotes,
    recordedNotes: scratch.recordedNotes,
    droppedEntries,
    movedCount,
    candidateCount: candidates.length
  };
}