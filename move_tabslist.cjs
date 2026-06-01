const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// The exact string for the TabsList
const tabsListStr = `<TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dados" className="text-xs"><FileText className="w-3 h-3 mr-1"/>Dados da Alocação</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs"><DollarSign className="w-3 h-3 mr-1"/>Dados Financeiros</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>
                <TabsTrigger value="status" className="text-xs"><Play className="w-3 h-3 mr-1"/>Status da Entrega</TabsTrigger>
              </TabsList>`;

// Remove TabsList from the current location
code = code.replace(tabsListStr, '');

// The exact string for the Tabs start
const tabsStartStr = `<Tabs defaultValue="dados" className="w-full flex flex-col min-h-0">`;

// Insert TabsList right after Tabs start, with some margin
code = code.replace(tabsStartStr, `${tabsStartStr}\n              <div className="mb-4">\n                ${tabsListStr}\n              </div>`);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Fixed TabsList position');
