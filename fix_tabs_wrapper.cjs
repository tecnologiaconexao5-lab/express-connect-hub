const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Encontrar onde a coluna direita começa
const rightColStart = '{/* Coluna Direita: Abas operacionais e financeiras */}\\s*<div className="flex-1 overflow-y-auto custom-scrollbar p-6">';
const tabsWrapper = `<Tabs defaultValue="dados" className="w-full flex flex-col min-h-0">`;

// Verifica se TabsWrapper já existe, senão adiciona
if (!code.includes(tabsWrapper)) {
  const rightColRegex = new RegExp('{/\\* Coluna Direita: Abas operacionais e financeiras \\*/}\\s*<div className="flex-1 overflow-y-auto custom-scrollbar p-6">');
  code = code.replace(rightColRegex, `{/* Coluna Direita: Abas operacionais e financeiras */}\n               <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col">\n                 ${tabsWrapper}`);
  
  // Agora temos que fechar a tab
  // O fim da coluna direita era `</div></div><div className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow...`
  // O final das tabs originais era `</TabsContent>` seguido pelo que substituimos
  // Vamos fechar o </Tabs> antes dos dois </div> da col e container principal
  const endMarker = '</div></div><div className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">';
  code = code.replace(endMarker, `</Tabs>\n${endMarker}`);
}

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Tabs wrapper fixed');
