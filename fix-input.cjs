const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

const brokenStr = `  <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> Setup da Viagem</h3>
                       placeholder="Pesquisar prestador (nome, placa, veículo)..."`;

const fixedStr = `  <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> Setup da Viagem</h3>

                <div className="space-y-1">
                   <Label className="text-xs font-bold text-primary">Prestador *</Label>
                   <div className="relative">
                     <Input 
                       placeholder="Pesquisar prestador (nome, placa, veículo)..."`;

if (code.includes(brokenStr)) {
  code = code.replace(brokenStr, fixedStr);
  fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
  console.log('Fixed broken Input');
} else {
  console.log('Not found string');
}
