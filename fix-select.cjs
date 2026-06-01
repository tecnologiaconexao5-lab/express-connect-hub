const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

code = code.replace(
  'select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal, valor_diaria, valor_saida, fixo_mensal, franquia_km, valor_km, tipo_pagamento")',
  'select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal, valor_diaria, valor_saida, fixo_mensal, franquia_km, valor_km, forma_preferencial")'
);

code = code.replace(
  'tipo_pagamento: p.tipo_pagamento,',
  'tipo_pagamento: p.forma_preferencial,'
);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fixed supabase select column');
