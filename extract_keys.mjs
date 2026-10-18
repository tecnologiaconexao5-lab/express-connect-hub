import fs from 'fs';
import path from 'path';

const mapperContent = fs.readFileSync(path.join('src', 'lib', 'dbMappers.ts'), 'utf-8');

const regex = /toOSInsert[\s\S]*?return d;/;
const match = mapperContent.match(regex);
if (match) {
  const code = match[0];
  const keys = new Set();
  const keyRegex = /d\.([a-zA-Z0-9_]+)\s*=/g;
  let result;
  while ((result = keyRegex.exec(code)) !== null) {
    keys.add(result[1]);
  }
  console.log("Keys in toOSInsert:");
  console.log(Array.from(keys));
} else {
  console.log("toOSInsert not found");
}
