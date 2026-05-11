const fs = require('fs');
let code = fs.readFileSync('src/components/financeiro/PagamentoPrestadores.tsx', 'utf8');

// Replace empty SelectItem for Cliente
code = code.replace(
  '<SelectItem value="">Nenhum / Vários</SelectItem>',
  ''
);

code = code.replace(
  '<SelectItem value="">Avulso / Sem OS</SelectItem>',
  ''
);

// Check if there are other occurrences
const matches = code.match(/<SelectItem[^>]*value=""[^>]*>/g);
if (matches && matches.length > 0) {
  console.log('Found more empty SelectItems:', matches);
  code = code.replace(/<SelectItem[^>]*value=""[^>]*>.*?<\/SelectItem>/g, '');
}

fs.writeFileSync('src/components/financeiro/PagamentoPrestadores.tsx', code);
console.log('Fixed SelectItem value=""');
