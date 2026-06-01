const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Fix null nome in map
code = code.replace(
  /nome: p\.nome_completo,/g,
  'nome: p.nome_completo || "Sem Nome",'
);

// 2. Fix filter logic in render just in case
code = code.replace(
  /p\.nome\.toLowerCase\(\)/g,
  '(p.nome || "").toLowerCase()'
);

// 3. Fix buscarTabelaValoresCliente
// from: .eq("tipo_veiculo", tipoVeiculo);
// to: .ilike("tipo_veiculo", tipoVeiculo);
code = code.replace(
  /\.eq\("tipo_veiculo", tipoVeiculo\);/g,
  '.ilike("tipo_veiculo", tipoVeiculo);'
);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fix applied');
