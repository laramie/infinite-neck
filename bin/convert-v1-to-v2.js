// convert-v1-to-v2.js
// Node.js script to convert V1 song JSON to V2 format as described
// Usage: node convert-v1-to-v2.js input.json output.json

import fs from 'fs';

function convertSectionV1toV2(section) {
  const v1NoteTables = section.noteTables || {};
  const v1NamedNotes = section.namedNotes || {};
  const v1RecordedNotes = section.recordedNotes || {};
  const v2NoteTables = {};

  // For each noteTable in V1, create V2 structure
  for (const [tableId, playedNotesArr] of Object.entries(v1NoteTables)) {
    v2NoteTables[tableId] = {
      playedNotes: Array.isArray(playedNotesArr) ? playedNotesArr : [],
      namedNotes: { ...v1NamedNotes },
      recordedNotes: { ...v1RecordedNotes }
    };
  }

  // If there are noteTables in V2 that weren't in V1, ensure they're empty
  // (not needed for this conversion, but could be added for resilience)

  // Copy all other properties except noteTables, namedNotes, recordedNotes
  const {
    noteTables, // eslint-disable-line no-unused-vars
    namedNotes, // eslint-disable-line no-unused-vars
    recordedNotes, // eslint-disable-line no-unused-vars
    ...rest
  } = section;

  return {
    ...rest,
    noteTables: v2NoteTables
  };
}

function convertV1toV2(v1) {
  const v2 = { ...v1 };
  v2.sections = (v1.sections || []).map(convertSectionV1toV2);
  return v2;
}

function main() {
  const [,, inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node convert-v1-to-v2.js input.json output.json');
    process.exit(1);
  }
  const v1 = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const v2 = convertV1toV2(v1);
  fs.writeFileSync(outputPath, JSON.stringify(v2, null, 2), 'utf8');
  console.log(`Converted ${inputPath} to ${outputPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
