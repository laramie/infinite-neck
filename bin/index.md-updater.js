
import fs from 'fs';
import path from 'path';

function updateIndex(dir) {
  const indexPath = path.join(dir, 'index.md');
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .sort();

  let notes = {};
  if (fs.existsSync(indexPath)) {
    const lines = fs.readFileSync(indexPath, 'utf-8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\- \[(.+?)\]\(.+?\)\s*\u2014\s*(.*)$/);
      if (match) notes[match[1]] = match[2];
    });
  }

  let out = `# ${path.basename(dir)} Docs Index\n\nBelow is a list of documentation files in this directory. Add or edit notes after each link as needed.\n\n`;
  files.forEach(f => {
    const base = path.basename(f);
    const note = notes[base] || '';
    out += `- [${base}](${base})` + (note ? ` — ${note}` : '') + '\n';
  });
  fs.writeFileSync(indexPath, out);
}

// Usage: node index.md-updater.js _doco/design
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node index.md-updater.js <directory>');
  updateIndex(dir);
}
