import { readFileSync, writeFileSync, readdirSync } from 'fs';

const dir = 'tests/e2e';
const files = readdirSync(dir).filter(f => f.endsWith('.spec.ts'));

let modified = 0;

for (const file of files) {
  const fp = dir + '/' + file;
  let content = readFileSync(fp, 'utf-8');
  const original = content;

  // 1. Fix: async async function -> async function
  content = content.replace(/async\s+async\s+function/g, 'async function');

  // 2. Fix: Remove leading = from === comment ornaments (indented)
  // Pattern: "    =    await" -> "    await"
  content = content.replace(/^(\s*)=\s*(await |const |let |var |expect )/gm, '$1$2');
  // Also handle = followed by { 
  content = content.replace(/^(\s*)=\s*(\{)/gm, '$1$2');

  // 3. Fix: Comment text that consumed code at start of line
  content = content.replace(/^for\s+\w[\w\s-äçãõéíóú]+\s{4,}(const|let|await|expect|var|if)\s/gm, '$1 ');
  content = content.replace(/^if\s+\w[\w\s-äçãõéíóú]+\s{4,}(const|let|await|expect|var)\s/gm, '$1 ');

  // 4. Fix: Remove leading "." before keywords  
  content = content.replace(/^(\s*)\.\s+(const|let|await|expect)/gm, '$1$2');

  // 5. Fix: Unterminated regex .toLowerCase() / at end of line
  content = content.replace(/\.toLowerCase\(\)\s*\/\s*$/gm, '.toLowerCase()');

  // 6. Fix: Unterminated template strings - join broken template expressions
  // Pattern: ${something;\n"} -> ${something;}
  content = content.replace(/\$\{([^}]*?)\s*;\s*$/gm, '$${$1}');
  
  // 7. Fix: Orphaned § and other special chars from comments
  content = content.replace(/^(\s*)§.*$/gm, '$1// [removed § character]');

  // 8. Fix: Lines with just "});" after the file should be properly closed
  // Check for extra "});" at end of file
  content = content.replace(/\n\s*\n\s*\n\s*\n\s*\n\s*\n\s*\n\s*$/g, '\n\n');

  // 9. Fix: Broken strings with quotes inside template literals  
  content = content.replace(/\$\{([^}]*?)"\s*$/gm, (m, inner) => '${' + inner.trim() + '}');

  // 10. Fix: Lines starting with stray '})' patterns
  content = content.replace(/^\)\s*$/gm, '');

  if (content !== original) {
    writeFileSync(fp, content, 'utf-8');
    modified++;
  }
}
console.log(`Modified: ${modified} files`);
