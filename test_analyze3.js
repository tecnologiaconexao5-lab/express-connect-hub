import { readFileSync } from 'fs';
const f = readFileSync('test_snippet2.ts', 'utf-8');
const lines = f.split('\n');
const l17 = lines[16];
console.log('L17 length:', l17.length);
console.log('L17:', JSON.stringify(l17));
for (let i = 0; i < l17.length; i++) {
  console.log(i + ': ' + JSON.stringify(l17[i]));
}
