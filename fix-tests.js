const { readFileSync, writeFileSync, readdirSync } = require('fs');
const { join } = require('path');

const dir = 'tests/e2e';
const files = readdirSync(dir).filter(f => f.endsWith('.spec.ts'));

let fixed = 0;
let total = 0;

for (const file of files) {
  const fp = join(dir, file);
  let content = readFileSync(fp, 'utf-8');
  const original = content;

  // ------- Fix 1: async async function -> async function -------
  content = content.replace(/async\s+async\s+function/g, 'async function');
  content = content.replace(/\}async\s+async\s+function/g, '}async function');

  // ------- Fix 2: Remove corrupted comment artifacts -------
  // Pattern: "//  Chec\nif there are existing" -> just the valid code
  content = content.replace(/\/\/.*?\n\s*if\s+(?!\()/g, '\n');
  content = content.replace(/\/\/.*?\n\s*for\s+(?!\()/g, '\n');
  
  // Remove line-starting text that is clearly comment text merged into code
  // e.g. "for console errors    const" -> "const"
  content = content.replace(/^for console errors\s+/gm, '');
  content = content.replace(/^if login form is visible\s+/gm, '');
  content = content.replace(/^if there are existing instru.+\s+/gm, '');

  // ------- Fix 3: Add missing closing brace before }); when for/if/while block unclosed -------
  // Pattern: for (...) { ... ; expect(x).toBe(y);});  ->   for (...) { ... ; expect(x).toBe(y);}});
  // Detect lines where a for/if/while block is opened and the next closing is for test/describe
  let changed = true;
  while (changed) {
    changed = false;
    // Find lines with:  for/if/while (...) { ... ; expect(...);}); 
    // where a } is needed before the });
    content = content.replace(
      /(\b(for|if|while)\s*\([^)]*\)\s*\{[^}]*?expect\([^;]+?\);\s*\n?\s*\}\);)/g,
      (match, full, keyword) => {
        return full.replace(/\}\);/g, '}});');
      }
    );
    
    // Simpler: just add } before }); when the preceding block was opened by for/if/while
    // This is a heuristic: find `for|if|while (cond) { ... ; expect(..);});`
    content = content.replace(
      /((?:for|if|while)\s*\([^)]*\)\s*\{[^;{}]*?(?:await\s+)?[^;{}]*?;)\s*(\n?\s*\}\);)/g,
      '$1 }$2'
    );
  }

  // ------- Fix 4: Fix missing } after single-line for/if blocks -------
  // Pattern: for (...) { statement; statement; expect(x).toBe(y);}); 
  content = content.replace(
    /(\b(for|if|while)\s*\([^)]*\)\s*\{[^}]*?)\s*(\n?\s*\}\);)/g,
    (match, before, keyword, after) => {
      // Count braces inside the block
      const opens = (before.match(/\{/g) || []).length;
      const closes = (before.match(/\}/g) || []).length;
      if (opens > closes) {
        return before + ' }' + after;
      }
      return match;
    }
  );

  // ------- Fix 5: Handle unterminated string/template literals from corruption -------
  // Pattern: ${erros.join(";  followed by newline and ")}
  content = content.replace(
    /\$\{([^}]*?)\s*\n\s*([^}]*?)\}/g,
    (match, part1, part2) => {
      // Try to fix broken template expressions
      const cleaned1 = part1.replace(/["';,]\s*$/, '');
      const cleaned2 = part2.replace(/^\s*["';,]/, '');
      if (cleaned1.length + cleaned2.length > 0) {
        return '${' + cleaned1 + cleaned2 + '}';
      }
      return match;
    }
  );

  // ------- Fix 6: Stray dots before code -------
  content = content.replace(/^\.\s+const\s+/gm, 'const ');
  content = content.replace(/^\.\s+let\s+/gm, 'let ');
  content = content.replace(/^\.\s+/gm, '');

  // ------- Fix 7: Unterminated regex (ex: /termo/) -------
  // Replace lines with unterminated regex patterns
  content = content.replace(/\.toLowerCase\(\)\s*\/\s*$/gm, '.toLowerCase()');

  if (content !== original) {
    writeFileSync(fp, content, 'utf-8');
    fixed++;
  }
  total++;
}

console.log(`Total files: ${total}, Fixed: ${fixed}`);
