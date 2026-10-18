const fs = require('fs');
const f1 = 'tests/e2e/central-ia-f22-modo-seguro.spec.ts';
const f2 = 'tests/e2e/central-ia-f23-robo-operacional.spec.ts';
const f3 = 'tests/e2e/central-ia-f24-whatsapp-homolog.spec.ts';

function fixFile(path, replacements) {
  let content = fs.readFileSync(path, 'utf8');
  for (const [from, to] of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(path, content, 'utf8');
}

fixFile(f1, [
  ['sucesso`);});', 'sucesso`);}});'],
  ['cancelada`);});', 'cancelada`);}});'],
  ['nulo)`);});', 'nulo)`);}});'],
  ['real`);});', 'real`);}});'],
  ['proibidos`);});', 'proibidos`);}}});'],
  ['registros`);});});', 'registros`);}});});'],
]);

fixFile(f2, [
  ['toBe(true);});', 'toBe(true);}});'],
  ['proibidos`);});', 'proibidos`);}}});'],
  ['real`);});});', 'real`);}});});'],
]);

fixFile(f3, [
  ['sucesso`);});', 'sucesso`);}});'],
  ['aprovada`);});', 'aprovada`);}});'],
  ['registrado");});', 'registrado");}});'],
  ['nulo`);});', 'nulo`);}});'],
  ['key`);});', 'key`);}});'],
  ['detectado`);});', 'detectado`);}});'],
]);

console.log('Done');
