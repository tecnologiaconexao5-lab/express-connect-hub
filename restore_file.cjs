
const fs = require('fs');
const transcriptPath = 'C:/Users/DIEGO BALBINO/.gemini/antigravity/brain/14d5818e-baa0-4a01-bc41-f420195f9d5b/.system_generated/logs/transcript.jsonl';
const targetPath = 'C:/Users/DIEGO BALBINO/Desktop/Pasta Compartilhada/DOCUMENTOS EMPRESA/08_TECNOLOGIA_SISTEMAS/express-connect-hub/src/components/relatorios/RelatoriosEnterprise.tsx';

let lines1 = '';
let lines2 = '';

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line.trim()) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'TOOL_RESPONSE' && typeof data.content === 'string') {
      if (data.content.includes('RelatoriosEnterprise.tsx')) {
        if (data.content.includes('Showing lines 1 to 800')) {
          lines1 = data.content;
        } else if (data.content.includes('Showing lines 800 to 924')) {
          lines2 = data.content;
        }
      }
    }
  } catch (e) {}
}

function clean(text) {
  if (!text) return '';
  let content = text.split('space.\n')[1] || text;
  if (content.includes('The above content does NOT show')) {
    content = content.split('\nThe above content does NOT show')[0];
  } else if (content.includes('The above content shows the entire')) {
    content = content.split('\nThe above content shows the entire')[0];
  }
  return content.replace(/^\d+: /gm, '');
}

const c1 = clean(lines1);
const c2 = clean(lines2);
const full = c1 + (c2 ? '\n' + c2 : '');

fs.writeFileSync(targetPath, full, 'utf8');
console.log('Restored with length: ' + full.length);

