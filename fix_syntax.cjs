const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// Fix 1: prestadorSelecionado has already been declared
const regexDup = /const prestadorSelecionado = prestadores\.find[\s\S]*?const prestadorSelecionado = prestadores\.find.*?\n/g;
code = code.replace(regexDup, (match) => {
   return match.split('\n')[0] + '\n' + match.split('\n')[1] + '\n';
});

// Fix duplicate manually if regex failed:
code = code.replace(/const prestadorSelecionado = prestadores\.find\(p => p\.id === \(novoPrestadorId \|\| prestadorAtivo\?\.id\)\);\s*const diariaBase = prestadorSelecionado\?\.financeiro_real\?\.valor_diaria \|\| 350;\s*const prestadorSelecionado = prestadores\.find\(p => p\.id === \(novoPrestadorId \|\| prestadorAtivo\?\.id\)\);/g, 
`const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                      const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;`);


// Fix 2: Expected ":" but found "}"
// This happened because the original code was:
/*
{tabelaNaoConfigurada ? (
  <span className="font-bold text-slate-400">-</span>
) : (
  <span className="font-bold text-orange-600">{kmExcedente} km</span>
)}
*/
// My code replaced `tabelaNaoConfigurada ? (` AND the inside content up to `) : (` with `false ? (`!
// Oh wait! `tabelaNaoConfigurada ? (\n <Badge...>\n) : (` was replaced with `false ? (`.
// So the result became:
// {false ? (
//    <span className="font-bold text-slate-800">{kmFranquia} km</span>
// )}
// This is invalid syntax in JS ternary: `{false ? (<span>) }` -> missing `: (null)`
// Let's replace `{false ? (` with empty string, and `)}` below it.
// Actually, I can just replace `false \? \([\s\S]*?\)}` and restore it properly.

// Let's find all `{false ? (` in the code.
code = code.replace(/\{false \? \([\s\S]*?<\/span>\s*\)\s*}/g, (match) => {
   // Just return the content of the `span` or `Badge` that we actually want!
   // We want the inner span from the truthy/falsy branch.
   // Or better, just restore the original and delete the ternary condition?
   return match;
});
