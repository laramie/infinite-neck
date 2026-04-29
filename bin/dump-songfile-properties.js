import fs from 'fs';
import { JSONPath } from 'jsonpath-plus';

function dumpSongfileProperty(songObj, selector) {
  const result = JSONPath({
    path: selector,
    json: songObj,
    wrap: true
  });

  console.log(JSON.stringify(result, null, 2));
}

function main() {
  const [, , inputPath, selector] = process.argv;

  if (!inputPath || !selector) {
    console.error('Usage: node bin/dump-songfile-properties.js input.json jsonPathSelector');
    console.error(`Example: node bin/dump-songfile-properties.js songs/progression-on-strat.json '$.sections[*].noteTables'`);
    process.exit(1);
  }

  if (!selector.startsWith('$')) {
    console.error('Selector must be a JSONPath expression starting with "$"');
    process.exit(1);
  }

  const songObj = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  dumpSongfileProperty(songObj, selector);
}

main();