const fs = require('fs');
const path = require('path');

const CONTENT = path.join(__dirname, 'content');
const files = fs.readdirSync(CONTENT).filter(f => f.endsWith('.md'));

for (const file of files) {
  const fp = path.join(CONTENT, file);
  let text = fs.readFileSync(fp, 'utf-8');

  // Split frontmatter from body
  const fmMatch = text.match(/^(---\n[\s\S]*?\n---\n)([\s\S]*)$/);
  if (!fmMatch) { console.log(`  SKIP (no frontmatter): ${file}`); continue; }
  const frontmatter = fmMatch[1];
  let body = fmMatch[2];

  // 1. Unescape backslash-escaped markdown characters
  //    Handle triple escapes first: \\\* -> *, \\\~ -> ~, \\\& -> &
  body = body.replace(/\\\\\\([*~&])/g, '$1');
  //    Handle double escapes: \\* -> *
  body = body.replace(/\\\\([*~&\[\]#])/g, '$1');
  //    Handle single escapes: \* -> *, \[ -> [, \] -> ], \# -> #, \~ -> ~, \& -> &
  body = body.replace(/\\([*\[\]#~&])/g, '$1');

  // 2. Smart quotes -> straight quotes
  body = body.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');
  body = body.replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
  // Smart ellipsis -> three dots
  body = body.replace(/\u2026/g, '...');
  // Em dash / en dash normalization
  body = body.replace(/\u2014/g, ' -- ');
  body = body.replace(/\u2013/g, '-');

  // 3. Collapse excessive blank lines (max 2 consecutive newlines = 1 blank line)
  body = body.replace(/\n{3,}/g, '\n\n');

  // 4. Fix tables missing alignment rows
  //    Pattern: header row (| ... |) followed immediately by data row (| ... |) without | --- | between
  const lines = body.split('\n');
  const fixed = [];
  for (let i = 0; i < lines.length; i++) {
    fixed.push(lines[i]);
    // Check if this line looks like a table header and next line is data (no separator)
    if (
      lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|') &&
      lines[i + 1] && lines[i + 1].trim().startsWith('|') && lines[i + 1].trim().endsWith('|') &&
      !lines[i + 1].match(/^\s*\|[\s:-]+\|/) && // next line is NOT a separator
      (i === 0 || !lines[i - 1] || !lines[i - 1].trim().startsWith('|')) // this is first table row
    ) {
      // Count columns
      const cols = lines[i].split('|').length - 2;
      if (cols > 0) {
        const sep = '| ' + Array(cols).fill('---').join(' | ') + ' |';
        fixed.push(sep);
      }
    }
  }
  body = fixed.join('\n');

  // 5. Trim trailing whitespace on each line
  body = body.split('\n').map(l => l.trimEnd()).join('\n');

  // 6. Ensure file ends with single newline
  body = body.trimEnd() + '\n';

  const result = frontmatter + body;
  fs.writeFileSync(fp, result);
  console.log(`  Cleaned: ${file}`);
}

console.log('\nDone.');
