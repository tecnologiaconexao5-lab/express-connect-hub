const fs = require('fs');
const c = fs.readFileSync(__dirname + '/portal-cliente-f20b-pod.spec.ts', 'utf8');

let depth = 0;
let inSingleString = false;
let inDoubleString = false;
let inTemplateString = false;
let inBlockComment = false;
let inLineComment = false;

for (let i = 0; i < c.length; i++) {
  const ch = c[i];
  const next = c[i + 1] || '';

  // Track comment state
  if (inBlockComment) {
    if (ch === '*' && next === '/') { inBlockComment = false; i++; }
    continue;
  }
  if (inLineComment) {
    if (ch === '\n') { inLineComment = false; }
    continue;
  }

  // Track string state
  if (inSingleString) {
    if (ch === '\\' && (next === "'" || next === '\\')) { i++; continue; }
    if (ch === "'") { inSingleString = false; }
    continue;
  }
  if (inDoubleString) {
    if (ch === '\\' && (next === '"' || next === '\\')) { i++; continue; }
    if (ch === '"') { inDoubleString = false; }
    continue;
  }
  if (inTemplateString) {
    if (ch === '\\') { i++; continue; }
    if (ch === '`') { inTemplateString = false; }
    if (ch === '$' && next === '{') { depth++; i++; }
    continue;
  }

  // Check for comment/string starts
  if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
  if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
  if (ch === "'") { inSingleString = true; continue; }
  if (ch === '"') { inDoubleString = true; continue; }
  if (ch === '`') { inTemplateString = true; continue; }

  // Track braces
  if (ch === '{') {
    depth++;
  }
  if (ch === '}') {
    depth--;
    if (depth < 0) {
      const line = c.slice(0, i).split('\n').length;
      console.log('EXTRA } at line', line, 'position', i);
    }
  }
}

console.log('Final depth:', depth);
if (depth > 0) {
  console.log('MISSING', depth, 'closing brace(s)');
}
