const fs = require('fs');

function applyPremiumLayout() {
  let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

  // 1. DialogContent
  code = code.replace(
    '<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">',
    '<DialogContent className="w-[90vw] max-w-[1200px] xl:max-w-[1400px] bg-slate-50/90 backdrop-blur-xl border-slate-200/60 shadow-2xl h-[90vh] flex flex-col overflow-hidden rounded-3xl p-0">'
  );

  // 2. DialogHeader
  code = code.replace(
    '<DialogHeader>',
    '<DialogHeader className="flex-none bg-white px-6 py-4 border-b border-slate-200 flex flex-col gap-1 z-20 shadow-sm">'
  );

  // 3. TabsList wrapper
  const tabsListRegex = /<TabsList className="grid grid-cols-3 w-full">[\s\S]*?<\/TabsList>/;
  code = code.replace(tabsListRegex, 
  `<TabsList className="grid grid-cols-3 w-full bg-slate-200/50 p-1 rounded-xl h-11 mb-6">
                <TabsTrigger value="dados" className="text-xs h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm transition-all"><FileText className="w-4 h-4 mr-2"/>Dados Base</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm transition-all"><DollarSign className="w-4 h-4 mr-2"/>Motor Financeiro</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs h-full rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-sm transition-all"><Activity className="w-4 h-4 mr-2"/>Jornada & Pátio</TabsTrigger>
              </TabsList>`);

  // 4. Mudar Tabs wrapper para a coluna da direita
  code = code.replace(
    '<Tabs defaultValue="dados" className="w-full">',
    '<div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/30">\n  <!-- COLUNA_ESQUERDA -->\n  <div className="flex-1 overflow-y-auto custom-scrollbar p-6">\n    <Tabs defaultValue="dados" className="w-full max-w-[900px] mx-auto">'
  );

  // 5. Pegar o conteúdo da aba de dados que vai pra esquerda
  const dadosStart = '<TabsContent value="dados" className="space-y-4 py-4">';
  const contentBeforeSplit = code.split(dadosStart)[1];
  
  if (contentBeforeSplit) {
    // We split exactly at the `<div className="border-t pt-4 mt-4 space-y-3">` which starts "Controle de KM"
    const splitPointStr = '<div className="border-t pt-4 mt-4 space-y-3">';
    const splitIndex = contentBeforeSplit.indexOf(splitPointStr);
  
    if (splitIndex !== -1) {
      const leftColContent = contentBeforeSplit.substring(0, splitIndex);
      
      const leftColHTML = `<div className="flex-none w-full lg:w-[400px] bg-white border-r border-slate-200 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">\n` +
                          `  <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> Setup da Viagem</h3>\n` +
                          leftColContent + `\n</div>`;
      
      code = code.replace('<!-- COLUNA_ESQUERDA -->', leftColHTML);
      
      const newTabsContent = `<TabsContent value="dados" className="space-y-6">\n` + contentBeforeSplit.substring(splitIndex);
      
      code = code.replace(dadosStart + contentBeforeSplit, newTabsContent);
    } else {
        console.log("Ponto de divisão não encontrado.");
    }
  } else {
      console.log("TabsContent dados não encontrado.");
  }

  // 6. Fechar as colunas antes do footer
  code = code.replace(
    '</Tabs>\n\n            <DialogFooter>',
    '</Tabs>\n  </div>\n</div>\n\n            <DialogFooter className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">'
  );
  
  // Se ainda tiver <DialogFooter> sem class
  code = code.replace(
    '<DialogFooter>',
    '<DialogFooter className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">'
  );

  fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
  console.log('Layout Premium aplicado com sucesso.');
}

applyPremiumLayout();
