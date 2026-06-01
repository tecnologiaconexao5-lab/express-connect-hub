const fs = require('fs');

try {
  let original = fs.readFileSync('original_escala.tsx', 'utf16le');
  let current = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

  const tabsContentDadosStart = '<TabsContent value="dados" className="space-y-4 py-4">';
  const tabsContentDadosEnd = '<div className="border-t pt-4 mt-4 space-y-3">';

  const insideTabsContent = original.split(tabsContentDadosStart)[1];

  if (!insideTabsContent) {
    console.log("Nao encontrou tabsContentDadosStart no original_escala.tsx");
    process.exit(1);
  }

  const extractedSidebarContent = insideTabsContent.split(tabsContentDadosEnd)[0];
  const remainingTabsContent = tabsContentDadosEnd + insideTabsContent.split(tabsContentDadosEnd).slice(1).join(tabsContentDadosEnd);
  const remainingTabsContentFinal = remainingTabsContent.split('</TabsContent>')[0];

  current = current.replace('${extractedSidebarContent.trim()}', extractedSidebarContent.trim());
  current = current.replace('${remainingTabsContent}', remainingTabsContentFinal);

  fs.writeFileSync('src/components/operacao/EscalaLista.tsx', current);
  console.log('Restaurado!');
} catch (e) {
  console.error(e);
}
