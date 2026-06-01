const fs = require('fs');
const code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');
console.log('Contains 2.50:', code.includes('2.50'));
console.log('TabsContent value="status" count:', (code.match(/TabsContent value="status"/g) || []).length);
