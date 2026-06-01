const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Alterar DialogContent
code = code.replace(
  '<DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">',
  '<DialogContent className="w-[90vw] max-w-[1200px] xl:max-w-[1400px] bg-slate-50/90 backdrop-blur-xl border-slate-200/60 shadow-2xl h-[90vh] flex flex-col overflow-hidden rounded-3xl p-0">'
);

// 2. Alterar DialogHeader
code = code.replace(
  '<DialogHeader>',
  '<div className="flex-none bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-20 shadow-sm"><DialogHeader>'
);
code = code.replace(
  '</DialogHeader>',
  '</DialogHeader></div>'
);

// 3. Extrair conteúdo do "Setup da Viagem" (Prestador, Cliente, OS) do TabsContent="dados"
const t_start = '<Tabs defaultValue="dados" className="w-full">';
const c_start = '<TabsContent value="dados" className="space-y-4 py-4">';
const c_end = '<div className="border-t pt-4 mt-4 space-y-3">';

const p1 = code.split(c_start)[0];
const rest1 = code.split(c_start)[1];
const setupContent = rest1.split(c_end)[0];
const remainingContent = c_end + rest1.split(c_end).slice(1).join(c_end);

// 4. Substituir a estrutura do Tabs
// Fechar o header (já fechado no replace 2), agora o BODY:
const newLayoutStart = `
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/30">
               {/* Coluna Esquerda: Setup da Viagem */}
               <div className="flex-none w-full lg:w-[400px] bg-white border-r border-slate-200 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
                 <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> Setup da Viagem</h3>
                 ${setupContent.trim()}
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-primary">Turno Operacional</Label>
                   <Select value={novoTurno} onValueChange={setNovoTurno}>
                     <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="madrugada">Madrugada</SelectItem>
                       <SelectItem value="manha">Manhã</SelectItem>
                       <SelectItem value="tarde">Tarde</SelectItem>
                       <SelectItem value="noite">Noite</SelectItem>
                       <SelectItem value="integral">Integral (24h)</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>

               {/* Coluna Direita: Abas operacionais e financeiras */}
               <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                 ${t_start}
`;

// Precisamos remover o t_start de onde ele estava
code = code.replace(t_start, '');
// e remover a definition do setup de onde estava e colocar o newLayoutStart no lugar onde o t_start estava
code = code.replace(c_start + setupContent, newLayoutStart + '\n<TabsContent value="dados" className="space-y-6">\n');

// 5. Ajustar o footer para fechar as colunas
const f_start = '<DialogFooter className="flex justify-between items-center sm:justify-between mt-4">';
const f_new = '</div></div><div className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]"><DialogFooter className="flex justify-between items-center sm:justify-between w-full">';
code = code.replace(f_start, f_new);
code = code.replace('</DialogFooter>', '</DialogFooter></div>');

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Layout premium aplicado!');
