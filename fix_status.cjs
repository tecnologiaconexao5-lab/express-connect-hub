const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 3. Move Status para Resumo
const statusBlockRegex = /<TabsContent value="status" className="space-y-6">([\s\S]*?)<\/TabsContent>\n\s*<\/Tabs>/;
const statusMatch = code.match(statusBlockRegex);
if (statusMatch) {
  console.log("Found status block!");
  const statusHtml = statusMatch[1];
  code = code.replace(statusBlockRegex, '</Tabs>');
  
  // Find where </TabsContent> for "resumo" is.
  // We can just append it before the `</Tabs>` since we know `resumo` is the last one now!
  const tabsEnd = /<\/TabsContent>\n\s*<\/Tabs>/;
  code = code.replace(tabsEnd, `\n<div className="mt-6 border-t pt-4">\n${statusHtml}\n</div>\n</TabsContent>\n            </Tabs>`);
}

// 4. Remove TabsTrigger do Status
code = code.replace(/<TabsTrigger value="status"[^>]*>.*?<\/TabsTrigger>/, '');

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Done moving status');
