const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// Fix 1: prestadorSelecionado has already been declared
const regexDup = /const prestadorSelecionado = prestadores\.find\(p => p\.id === \(novoPrestadorId \|\| prestadorAtivo\?\.id\)\);\s*const diariaBase = prestadorSelecionado\?\.financeiro_real\?\.valor_diaria \|\| 350;\s*const prestadorSelecionado = prestadores\.find\(p => p\.id === \(novoPrestadorId \|\| prestadorAtivo\?\.id\)\);/g;
code = code.replace(regexDup, 
`const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                      const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;`);

// Fix 2: Expected ":" but found "}"
// The error line 2346 is:
// 2344|                            {false ? (
// 2345|                              <span className="font-bold text-slate-800">{kmFranquia} km</span>
// 2346|                            )}
// Let's replace `{false ? (` with empty string and `)}` with empty string for these exact blocks.

code = code.replace(/\{false \? \(\s*<span className="font-bold text-slate-800">\{kmFranquia\} km<\/span>\s*\)\}/g, 
  `<span className="font-bold text-slate-800">{kmFranquia} km</span>`);

code = code.replace(/\{false \? \(\s*<span className="font-bold text-orange-600">\{kmExcedente\} km<\/span>\s*\)\}/g, 
  `<span className="font-bold text-orange-600">{kmExcedente} km</span>`);

code = code.replace(/\{false \? \(\s*<span className="font-bold text-slate-800">R\$ \{valorKm\.toFixed\(2\)\}<\/span>\s*\)\}/g, 
  `<span className="font-bold text-slate-800">R$ {valorKm.toFixed(2)}</span>`);

code = code.replace(/\{false \? \(\s*<span className="font-bold text-slate-800">R\$ \{valorKmExcedente\.toFixed\(2\)\}<\/span>\s*\)\}/g, 
  `<span className="font-bold text-slate-800">R$ {valorKmExcedente.toFixed(2)}</span>`);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fixed syntax!');
