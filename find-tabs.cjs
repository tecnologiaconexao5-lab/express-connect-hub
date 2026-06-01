const fs = require('fs');
const code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');
console.log('financeiro tab:', code.indexOf('TabsContent value="financeiro"'));
console.log('resumo tab:', code.indexOf('TabsContent value="resumo"'));
console.log('tabs list:', code.indexOf('TabsList className="grid'));
