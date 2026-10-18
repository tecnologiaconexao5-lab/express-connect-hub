import { readFileSync, writeFileSync } from 'fs';

const overFixed = [
  'central-ia-f25b-bloqueio-envios-diretos.spec.ts',
  'central-ia-f25b-config-robos.spec.ts',
  'central-ia-f25c-ui-final.spec.ts',
  'central-ia-f25d-regras-operacionais.spec.ts',
  'central-ia-f25e-gatilhos.spec.ts',
];

for (const file of overFixed) {
  const fp = 'tests/e2e/' + file;
  let content = readFileSync(fp, 'utf-8');
  const orig = content;
  
  // These files have 1 extra }. Remove the first occurrence of \}\} that, 
  // when replaced with just \}, makes the brace diff become 0.
  // Strategy: try removing one } from each }}}); or }}}) pattern
  
  // First check: replace }}}); with }}); 
  content = content.replace('}}});', '}});');
  
  if (content !== orig) {
    const opens = (content.match(/\{/g) || []).length;
    const closes = (content.match(/\}/g) || []).length;
    if (opens === closes) {
      writeFileSync(fp, content, 'utf-8');
      console.log(`Fixed ${file}: removed 1 extra }`);
    } else {
      // Restore and try next pattern
      content = orig;
      // Try }}}) -> }})
      content = content.replace('}}});', '}});');
      // No wait, same as above. Try different approach:
      content = orig;
      // Find all }}} patterns and remove one }
      // Replace the LAST occurrence of }}} before )}; with }}
      const idx = content.lastIndexOf('}}});');
      if (idx >= 0) {
        content = content.substring(0, idx) + '}});' + content.substring(idx + 5);
      }
      const opens2 = (content.match(/\{/g) || []).length;
      const closes2 = (content.match(/\}/g) || []).length;
      if (opens2 === closes2) {
        writeFileSync(fp, content, 'utf-8');
        console.log(`Fixed ${file}: removed 1 extra } (alt approach)`);
      } else {
        console.log(`Failed to fix ${file}: opens=${opens2} closes=${closes2}`);
      }
    }
  }
}
