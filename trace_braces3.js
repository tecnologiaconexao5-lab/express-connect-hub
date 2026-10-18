import { readFileSync } from 'fs';
function traceBraces(content) {
  const lines = content.split('\n');
  let depth = 0;
  let parenDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '/' && line[j+1] === '/' && !inString && !inTemplate) break;
      if (ch === '`' && !inString) { inTemplate = !inTemplate; continue; }
      if ((ch === '"' || ch === "'") && !inTemplate) {
        if (!inString) { inString = true; stringChar = ch; continue; }
        if (ch === stringChar) { inString = false; continue; }
      }
      if (inString || inTemplate) continue;
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (ch === '(') parenDepth++;
      if (ch === ')') parenDepth--;
    }
    if (depth < 0) console.log('L'+(i+1)+': NEGATIVE depth='+depth);
    if (parenDepth < 0) console.log('L'+(i+1)+': NEGATIVE parenDepth='+parenDepth);
  }
  return { depth, parenDepth };
}
const f = readFileSync('tests/e2e/central-ia-f25c-audit.spec.ts', 'utf-8');
const r = traceBraces(f);
console.log('Final depth:', r.depth, 'parenDepth:', r.parenDepth);
