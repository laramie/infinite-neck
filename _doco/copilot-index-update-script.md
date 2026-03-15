# Copilot Index Update Script

This script scans a documentation directory, lists all `.md` files, and updates the `index.md` file with links and preserves any custom notes after each link. Run this as part of your dev flow to keep your index up to date.

## Sample Script (Node.js)

```js
const fs = require('fs');
const path = require('path');

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

// Usage: node update-index.js _doco/design
if (require.main === module) {
  const dir = process.argv[2];
  if (!dir) throw new Error('Usage: node update-index.js <directory>');
  updateIndex(dir);
}
```

- Place this script in your repo (e.g., `scripts/update-index.js`).
- Run with: `node scripts/update-index.js _doco/design` or `_doco/lifecycle`.
- Developers can add notes after the dash in the index file; the script will preserve them.
