const fs = require('fs');
const path = require('path');
const target = process.argv[2] || 'portal-cliente-f20b-pod.spec.ts';
const c = fs.readFileSync(path.join(__dirname, target), 'utf8');
const fileLines = c.split('\n');

let depth = 0;
let inSingle = false, inDouble = false, inTemplate = false;
let inBlockComment = false, inLineComment = false;
let lineNum = 1;

for (let i = 0; i < c.length; i++) {
  const ch = c[i];
  const next = c[i + 1] || '';

  // Find which file line we're on
  const fileLine = c.slice(0, i).split('\n').length;

  if (inBlockComment) {
    if (ch === '*' && next === '/') { inBlockComment = false; i++; }
    continue;
  }
  if (inLineComment) {
    if (ch === '\n') { inLineComment = false; }
    continue;
  }

  if (inSingle) {
    if (ch === '\\') { i++; continue; }
    if (ch === "'") { inSingle = false; }
    continue;
  }
  if (inDouble) {
    if (ch === '\\') { i++; continue; }
    if (ch === '"') { inDouble = false; }
    continue;
  }
  if (inTemplate) {
    if (ch === '\\') { i++; continue; }
    if (ch === '`') { inTemplate = false; }
    if (ch === '$' && next === '{') { depth++; i++; }
    continue;
  }

  if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
  if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
  if (ch === "'") { inSingle = true; continue; }
  if (ch === '"') { inDouble = true; continue; }
  if (ch === '`') { inTemplate = true; continue; }

  if (ch === '{') { depth++; }
  if (ch === '}') { depth--; if (depth < 0) console.log('EXTRA } at char', i, 'file line', fileLine); }
  if (ch === '\n') { if (depth !== 0) console.log('After line', lineNum, '(file line', fileLine, ') depth:', depth); lineNum++; }
}

console.log('Final depth:', depth, '(parser line', lineNum, ')');
