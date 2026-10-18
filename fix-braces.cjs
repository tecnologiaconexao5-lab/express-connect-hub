const { readFileSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');

const dir = 'tests/e2e';
const files = readdirSync(dir).filter(f => f.endsWith('.spec.ts'));

let fixed = 0;

for (const file of files) {
  const fp = join(dir, file);
  let content = readFileSync(fp, 'utf-8');
  const original = content;

  // Walk through and insert missing } before }); when for/if/while blocks are open
  let result = '';
  let i = 0;
  const forDepths = []; // stack of { depth, forDepthAtOpen }
  let forDepth = 0;
  let braceDepth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let insertCount = 0;

  while (i < content.length) {
    const c = content[i];
    const next = content[i + 1] || '';

    // String/comment tracking
    if (inLineComment) {
      if (c === '\n') inLineComment = false;
      result += c;
      i++;
      continue;
    }
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; result += '*/'; i += 2; continue; }
      result += c;
      i++;
      continue;
    }
    if (inSingleQuote) {
      if (c === '\\') { result += c + (next || ''); i += 2; continue; }
      if (c === "'") inSingleQuote = false;
      result += c;
      i++;
      continue;
    }
    if (inDoubleQuote) {
      if (c === '\\') { result += c + (next || ''); i += 2; continue; }
      if (c === '"') inDoubleQuote = false;
      result += c;
      i++;
      continue;
    }
    if (inTemplate) {
      if (c === '\\') { result += c + (next || ''); i += 2; continue; }
      if (c === '`') inTemplate = false;
      if (c === '$' && next === '{') { result += '${'; i += 2; continue; }
      result += c;
      i++;
      continue;
    }

    // Comments
    if (c === '/' && next === '/') { inLineComment = true; result += '//'; i += 2; continue; }
    if (c === '/' && next === '*') { inBlockComment = true; result += '/*'; i += 2; continue; }

    // Strings
    if (c === "'") { inSingleQuote = true; result += c; i++; continue; }
    if (c === '"') { inDoubleQuote = true; result += c; i++; continue; }
    if (c === '`') { inTemplate = true; result += c; i++; continue; }

    // Track braces
    if (c === '{') {
      const before = content.slice(Math.max(0, i - 60), i);
      const isForBlock = /for\s*\([^)]*\)\s*$/.test(before) ||
                         /if\s*\([^)]*\)\s*$/.test(before) ||
                         /while\s*\([^)]*\)\s*$/.test(before);
      forDepths.push({ braceDepth, forDepth, isForBlock });
      if (isForBlock) forDepth++;
      braceDepth++;
      result += c;
      i++;
      continue;
    }

    if (c === '}') {
      // Before closing, check if we have open for/if/while blocks
      // that should be closed at this level
      const popped = forDepths.pop();
      if (popped && popped.isForBlock && forDepth > 0) {
        const expectedCloseForDepth = forDepth;
        // Check if the next characters are closing a function/test
        // If so, we need to insert missing } for the for block
        const after = content.slice(i + 1, i + 5);
        if (/^\s*\)/.test(after) || /^\s*\}\)/.test(after)) {
          // We're closing a test/describe but the for block hasn't been closed
          // Only insert if there's a forDepth that needs closing
          result += '}';
          insertCount++;
        }
        forDepth--;
      }
      if (popped && popped.isForBlock) {
        forDepth--;
      }
      braceDepth--;
      result += c;
      i++;
      continue;
    }

    result += c;
    i++;
  }

  if (insertCount > 0) {
    writeFileSync(fp, result, 'utf-8');
    fixed++;
    console.log(`Fixed ${file}: inserted ${insertCount} braces`);
  }
}

console.log(`\nTotal files fixed: ${fixed}`);
