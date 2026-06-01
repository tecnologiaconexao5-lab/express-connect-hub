const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

const startIndex = code.indexOf('<TabsContent value="status"');
if (startIndex !== -1) {
  const endIndex = code.indexOf('</Tabs>', startIndex);
  if (endIndex !== -1) {
    const statusBlock = code.substring(startIndex, code.indexOf('</TabsContent>', startIndex) + '</TabsContent>'.length);
    code = code.replace(statusBlock, '');
    
    const statusContent = statusBlock.replace(/<TabsContent[^>]*>/, '').replace('</TabsContent>', '');
    
    // Find resumo end
    const resumoEnd = code.indexOf('</TabsContent>', code.indexOf('<TabsContent value="resumo"'));
    
    const beforeResumoEnd = code.substring(0, resumoEnd);
    const afterResumoEnd = code.substring(resumoEnd);
    
    code = beforeResumoEnd + '\n<div className="mt-6 border-t pt-4 border-slate-200 space-y-4">\n' + statusContent + '\n</div>\n' + afterResumoEnd;
    
    // remove trigger
    code = code.replace(/<TabsTrigger value="status"[^>]*>.*?<\/TabsTrigger>/, '');
    
    fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
    console.log('Status moved');
  }
}
