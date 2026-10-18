import { readFileSync } from 'fs';
const f = readFileSync('tests/e2e/central-ia-f25c-audit.spec.ts', 'utf-8');
const lines = f.split('\n');
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const ch = line[j];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
  }
  if (depth < 0) console.log('L'+(i+1)+': NEGATIVE depth='+depth);
}
console.log('Final depth:', depth);
