import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function updateVersionJson(versionPath) {
  const absPath = path.resolve(versionPath);
  const version = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  const gitCommand = version.gitCommand;
  if (!gitCommand) throw new Error('gitCommand not found in version.json');

  // Run the git command
  let gitTag;
  try {
    gitTag = execSync(gitCommand, { encoding: 'utf-8' }).trim();
  } catch (e) {
    throw new Error('Failed to execute git command: ' + e.message);
  }

  // Update gitTag and date
  version.gitTag = gitTag;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  version.date = `${yyyy}${mm}${dd}`;

  fs.writeFileSync(absPath, JSON.stringify(version, null, 4) + '\n');
}

// Usage: node version-update.js ../version.json
if (import.meta.url === `file://${process.argv[1]}`) {
  const versionPath = process.argv[2] || 'version.json';
  updateVersionJson(versionPath);
}
