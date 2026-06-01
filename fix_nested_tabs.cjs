const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// remove duplicate inner tab start
const innerTabRegex = /<Tabs defaultValue="dados" className="w-full">/;
code = code.replace(innerTabRegex, '');

// remove one of the </Tabs> at the end
const endTabsRegex = /<\/Tabs>\s*<\/Tabs>/;
code = code.replace(endTabsRegex, '</Tabs>');

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fixed nested tabs');
