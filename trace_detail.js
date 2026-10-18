import { readFileSync } from 'fs';
const f = readFileSync('tests/e2e/central-ia-f25c-audit.spec.ts', 'utf-8');
let depth = 0;
let lineNum = 1;
let colNum = 0;
for (let i = 0; i < f.length; i++) {
  const ch = f[i];
  colNum++;
  if (ch === '\n') { lineNum++; colNum = 0; continue; }
  if (ch === '{') {
    depth++;
    console.log(`L${lineNum}:${colNum} OPEN depth=${depth} context: ${f.substring(Math.max(0,i-20), i+5).replace(/\n/g,'\\n')}`);
  }
  if (ch === '}') {
    depth--;
    if (depth < 0) console.log(`L${lineNum}:${colNum} NEGATIVE! depth=${depth}`);
    if (depth < 0) depth = 0;
  }
}
console.log('Final:', depth);
