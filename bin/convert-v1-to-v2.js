// convert-v1-to-v2.js
// Node.js script to convert V1 song JSON to V2 format as described
// Usage: node convert-v1-to-v2.js input.json output.json

import fs from 'fs';
import path from 'path';

function convertSectionV1toV2(section) {
  const v1NoteTables = section.noteTables || {};
  const v1NamedNotes = section.namedNotes || {};
  const v1RecordedNotes = section.recordedNotes || {};
  const v2SectionNotes = {};

  // For each noteTable in V1, create V2 structure under sectionNotes
  for (const [tableId, playedNotesArr] of Object.entries(v1NoteTables)) {
    v2SectionNotes[tableId] = {
      playedNotes: Array.isArray(playedNotesArr) ? playedNotesArr : [],
      namedNotes: { ...v1NamedNotes },
      recordedNotes: { ...v1RecordedNotes }
    };
  }

  // Copy all other properties except noteTables, namedNotes, recordedNotes
  const {
    noteTables, // eslint-disable-line no-unused-vars
    namedNotes, // eslint-disable-line no-unused-vars
    recordedNotes, // eslint-disable-line no-unused-vars
    ...rest
  } = section;

  return {
    ...rest,
    sectionNotes: v2SectionNotes
  };
}

function convertV1toV2(v1) {
  const v2 = { ...v1 };
  v2.sections = (v1.sections || []).map(convertSectionV1toV2);
  return v2;
}

function main() {
  const [,, inputPath, outputDir] = process.argv;
  if (!inputPath || !outputDir) {
    console.error('Usage: node convert-v1-to-v2.js input.json output-directory');
    process.exit(1);
  }

  // Check if outputDir exists and is a directory
  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    console.error(`Error: Output directory '${outputDir}' does not exist or is not a directory.`);
    process.exit(1);
  }


  const inputAbs = path.resolve(inputPath);
  const outputAbs = path.resolve(outputDir);

  // If input is a directory, process all files in it (no recursion)
  if (fs.statSync(inputAbs).isDirectory()) {
    if (inputAbs === outputAbs) {
      console.error('Error: Output directory must not be the same as the input directory.');
      process.exit(1);
    }
    const files = fs.readdirSync(inputAbs);
    let convertedCount = 0;
    for (const file of files) {
      const filePath = path.join(inputAbs, file);
      if (fs.statSync(filePath).isFile()) {
        try {
          const v1 = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const v2 = convertV1toV2(v1);
          v2.songfileVersion = 'V2';
          const outputFile = path.join(outputAbs, file);
          fs.writeFileSync(outputFile, JSON.stringify(v2, null, 2), 'utf8');
          console.log(`Converted ${filePath} to ${outputFile}`);
          convertedCount++;
        } catch (err) {
          console.error(`Failed to convert ${filePath}: ${err.message}`);
        }
      }
    }
    if (convertedCount === 0) {
      console.warn('No files were converted.');
    }
    return;
  }

  // Single file mode
  if (path.dirname(inputAbs) === outputAbs) {
    console.error('Error: Output directory must not be the same as the input file\'s directory.');
    process.exit(1);
  }
  const outputFile = path.join(outputAbs, path.basename(inputPath));
  const v1 = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const v2 = convertV1toV2(v1);
  v2.songfileVersion = 'V2';
  fs.writeFileSync(outputFile, JSON.stringify(v2, null, 2), 'utf8');
  console.log(`Converted ${inputPath} to ${outputFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
