import fs from 'fs';
import path from 'path';

const versionPath = path.resolve(path.dirname(import.meta.url.replace('file://', '')), '../version.json');

function readVersion() {
  return JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
}

export const version = readVersion();

export function getVersion() {
  return version;
}

// Usage: node version-read.js
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(getVersion(), null, 2));
}
