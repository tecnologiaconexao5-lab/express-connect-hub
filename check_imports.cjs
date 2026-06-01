const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

const importMatch = code.match(/import {([^}]+)} from ["']lucide-react["']/);
if (!importMatch) {
  console.log('No lucide-react import found');
  process.exit(1);
}

const imports = importMatch[1].split(',').map(s => s.trim().split(' as ')[0]);
const tags = code.match(/<([A-Z][a-zA-Z0-9]+)/g).map(s => s.substring(1));
const uniqueTags = [...new Set(tags)];

const missing = [];
for (let tag of uniqueTags) {
  // if tag is one of the ones we injected or standard ones but not in imports
  // Actually let's just see all uniqueTags not imported and see if they look like Lucide icons
  if (!imports.includes(tag) && !code.includes(`import ${tag}`) && !code.includes(`import { ${tag}`)) {
    missing.push(tag);
  }
}
console.log('Missing components?', missing);
