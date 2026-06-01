const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Insert global fmtBRL helper after the last import (just before any blank line after imports)
// Find the index of the line that imports normalizeClienteNome (last of the initial imports block)
const lines = code.split('\n');
let insertIdx = lines.findIndex(l => l.includes('normalizeClienteNome'));
if (insertIdx === -1) {
  console.error('Could not find normalizeClienteNome import');
  process.exit(1);
}
// Insert after that line (plus one to go after it)
const helperLine = "const fmtBRL = (valor: number | null | undefined) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor ?? 0));";
lines.splice(insertIdx + 1, 0, helperLine);

// 2. Remove the inner local definition inside handleExportPDF (the line that declares const fmtBRL = ... inside the function)
const innerDefPattern = /\s*const fmtBRL = \(v: any\) => Number\(v \?\? 0\)\.toLocaleString\('pt-BR', { style: 'currency', currency: 'BRL' }\);/;
for (let i = 0; i < lines.length; i++) {
  if (innerDefPattern.test(lines[i])) {
    lines.splice(i, 1); // remove the line
    break;
  }
}

// Write back the file
fs.writeFileSync('src/components/operacao/EscalaLista.tsx', lines.join('\n'));
console.log('Inserted global fmtBRL and removed inner definition');
