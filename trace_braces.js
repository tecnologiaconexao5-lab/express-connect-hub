import { readFileSync } from 'fs';
const f = readFileSync('test_snippet2.ts', 'utf-8');
const lines = f.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let inString = false;
  let stringChar = '';
  let inTemplate = false;
  let inRegex = false;
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    const next = line[j+1] || '';
    if (!inString && !inTemplate && !inRegex) {
      if (ch === '/' && next === '/') break; // line comment
      if (ch === '/' && next === '*') { j++; continue; } // block comment start (simplified)
    }
    if (ch === '"' || ch === "'") {
      if (!inString) { inString = true; stringChar = ch; }
      else if (ch === stringChar) inString = false;
    }
    if (ch === '`' && !inString) inTemplate = !inTemplate;
    if (ch === '{' && !inString && !inTemplate) depth++;
    if (ch === '}' && !inString && !inTemplate) depth--;
  }
  if (depth < 0) console.log('L'+(i+1)+': NEGATIVE depth='+depth);
}
console.log('Final depth:', depth);
