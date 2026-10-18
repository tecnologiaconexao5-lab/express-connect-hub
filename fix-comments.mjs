import { readFileSync, writeFileSync, readdirSync } from 'fs';

const dir = 'tests/e2e';
const files = readdirSync(dir).filter(f => f.endsWith('.spec.ts'));
let fixed = 0;

for (const file of files) {
  const fp = dir + '/' + file;
  let content = readFileSync(fp, 'utf-8');
  const original = content;

  // Fix 1: Lines with leading = from ==== comment ornament (including indented)
  content = content.replace(/^(\s*)=\s*(await |const |let |var )/gm, '$1$2');

  // Fix 2: Lines with comment-like text before code keywords
  content = content.replace(/^(?:\s*)for\s+\w[\w\s-]+\t+(const|let|await|expect|if)\s/gm, '$1 ');
  content = content.replace(/^(?:\s*)if\s+\w[\w\s-]+\t+(const|let|await|expect)\s/gm, '$1 ');

  // Also handle spaces (4+ spaces as separator)
  content = content.replace(/^(?:\s*)(?:for|if)\s+\w[\w\s-]+\s{4,}(const|let|await|expect|if)\s/gm, '$1 ');
  content = content.replace(/^(?:\s*)for\s+\w[\w\s-]+\s{2,}(const|let|await|expect)\s/gm, '$1 ');

  // Fix 3: Remove leading . before const/let/await (from .    const {) at any indentation
  content = content.replace(/^(\s*)\.\s+const/gm, '$1const');
  content = content.replace(/^(\s*)\.\s+let/gm, '$1let');
  content = content.replace(/^(\s*)\.\s+await/gm, '$1await');

  // Fix 4: Unterminated regex pattern (expect(body).not.toContain(termo.toLowerCase() /)
  content = content.replace(/\.toLowerCase\(\)\s*\/\s*$/gm, '.toLowerCase()');

  if (content !== original) {
    writeFileSync(fp, content, 'utf-8');
    fixed++;
  }
}
console.log('Fixed:', fixed, 'files');
