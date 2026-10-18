const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/components/portal-cliente/PortalRoteirizacao.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('File lines:', lines.length);
console.log('Line 534 (0-indexed 533):', JSON.stringify(lines[533]));
console.log('Line 535:', JSON.stringify(lines[534]));
console.log('Line 536:', JSON.stringify(lines[535]));

// Try esbuild
try {
  const esbuild = require('esbuild');
  esbuild.transformSync(content, { loader: 'tsx', sourcefile: 'test.tsx' });
  console.log('\nESBUILD: OK');
} catch(e) {
  console.log('\nESBUILD ERROR:', e.errors[0].text);
  console.log('Line:', e.errors[0].location.line);
  console.log('Column:', e.errors[0].location.column);
  console.log('Line text:', JSON.stringify(e.errors[0].location.lineText));
  
  // Show surrounding lines
  const errLine = e.errors[0].location.line - 1;
  for (let i = Math.max(0, errLine - 3); i < Math.min(lines.length, errLine + 3); i++) {
    const marker = i === errLine ? '>>>' : '   ';
    console.log(marker + ' ' + (i+1) + ': ' + lines[i].substring(0, 120));
  }
}
