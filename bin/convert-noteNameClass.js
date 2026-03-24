// convert-noteNameClass.js
// Node.js script to migrate noteNameClass to noteName in-place for all .json files in a specified directory
// Usage: node bin/convert-noteNameClass.js <directory>

/*
File generated from prompt: 
================================================
Can you please write me a Node.js file utility to rip through every .json file in a given directory, 
and make the following changes?

This file will live in new empty file:

    bin/convert-noteNameClass.js

and be similar to 

    bin/convert-v1-to-v2.js

in that it will be a Node.js command-line utility that is fully ES6 and is run 
from the project root, using import.meta.url etc.

Instead of producing new files, this utility will rewrite the files in place.

Old .json file structure, with other objects and properties removed for clarity: 

{
  "sections": [
    {
        "namedNotes": {
            "F": {
                "noteName": "F",
                "noteNameClass": ".noteF",
            }
        }
    }
  ]
}

Old structure, second allowed flavor: 

{
  "sections": [
    {
        "namedNotes": {
            "F": {
                "noteNameClass": ".noteF",
            }
        }
    }
  ]
}

Preserve all other structure and all other properties.

We are only migrating the property noteNameClass to the property noteName.

The rule is we strip the string value ".note" from the property value.
e.g. ".noteF" becomes "F" 

If the property "noteName" already exists, it takes precedence, and "noteNameClass" just disappears from the structure with a console log line showing the retained value of noteName and the ignored value of noteNameClass.


 New structure :

{
  "sections": [
    {
        "namedNotes": {
            "F": {
                "noteName": "F",
            }
        }
    }
  ]
}

Attached is a full .json file that exemplifies the input files found in the directory.

    songs/three-chord-wonder.json

Thanks!    
================================================
*/

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrateNamedNotes(namedNotes, file, sectionIdx, noteKey) {
  if (!namedNotes) return false;
  let changed = false;
  for (const [key, noteObj] of Object.entries(namedNotes)) {
    if (noteObj && typeof noteObj === 'object' && 'noteNameClass' in noteObj) {
      const classVal = noteObj.noteNameClass;
      if ('noteName' in noteObj) {
        // noteName takes precedence, remove noteNameClass
        console.log(`[${file}] section[${sectionIdx}] namedNotes[${key}]: noteName retained ('${noteObj.noteName}'), noteNameClass ('${classVal}') ignored.`);
        delete noteObj.noteNameClass;
        changed = true;
      } else if (typeof classVal === 'string' && classVal.startsWith('.note')) {
        noteObj.noteName = classVal.replace(/^\.note/, '');
        delete noteObj.noteNameClass;
        changed = true;
      } else {
        // Remove noteNameClass if present but not matching pattern
        console.log(`[${file}] section[${sectionIdx}] namedNotes[${key}]: ==============> ditched: wrong pattern: noteNameClass ('${classVal}') `);
        delete noteObj.noteNameClass;
        changed = true;
      }
    }
  }
  return changed;
}

async function processFile(filePath) {
  let changed = false;
  let data;
  try {
    data = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${filePath}:`, e.message);
    return;
  }
  if (Array.isArray(data.sections)) {
    data.sections.forEach((section, idx) => {
      if (section && typeof section === 'object' && section.namedNotes) {
        if (migrateNamedNotes(section.namedNotes, filePath, idx)) {
          changed = true;
        }
      }
    });
  }
  if (changed) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node bin/convert-noteNameClass.js <directory>');
    process.exit(1);
  }
  const absDir = path.isAbsolute(dir) ? dir : path.join(__dirname, '..', dir);
  let files;
  try {
    files = await fs.readdir(absDir);
  } catch (e) {
    console.error(`Failed to read directory ${absDir}:`, e.message);
    process.exit(1);
  }
  for (const file of files) {
    if (file.endsWith('.json')) {
      await processFile(path.join(absDir, file));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
