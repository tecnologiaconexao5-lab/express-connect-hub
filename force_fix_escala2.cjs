const fs = require('fs');
let lines = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8').split('\n');

let insideStatus = false;
let newLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];

  // Fix 1: Dados da Alocação (around 1825)
  if (line.includes('const kmFranquia = tabelaValores?.km_franquia || 200;')) {
    newLines.push('                     const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));');
    newLines.push('                     const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 0;');
    continue;
  }
  if (line.includes('const valorKm = tabelaValores?.valor_km || 2.50;') && !line.includes('//')) {
    if (newLines[newLines.length - 1].includes('const kmFranquia')) {
      newLines.push('                     const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 0;');
    } else {
      // Fix 2: Resumo do dia
      newLines.push('                     const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 1.75;');
    }
    continue;
  }
  if (line.includes('const diariaBase = tabelaValores?.valor_base || 400;')) {
    newLines.push('                     const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));');
    newLines.push('                     const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;');
    continue;
  }
  if (line.includes('const totalDia = diariaCalculada + (tabelaNaoConfigurada ? 0 : valorKmExcedente) + totals.totalAdicionais - totals.totalDescontos;')) {
    newLines.push('                     const totalDia = diariaCalculada + valorKmExcedente + totals.totalAdicionais - totals.totalDescontos;');
    continue;
  }
  if (line.includes('<Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">')) {
     if (lines[i-1].includes('tabelaNaoConfigurada ? (')) {
        newLines[newLines.length - 1] = newLines[newLines.length - 1].replace('tabelaNaoConfigurada ? (', 'false ? (');
     }
  }
  if (line.includes('<span className="font-bold text-slate-400">-</span>')) {
     if (lines[i-1].includes('tabelaNaoConfigurada ? (')) {
        newLines[newLines.length - 1] = newLines[newLines.length - 1].replace('tabelaNaoConfigurada ? (', 'false ? (');
     }
  }

  // Fix 3: Aba Status
  if (line.includes('<TabsContent value="status"')) {
    insideStatus = true;
    newLines.push(`              <TabsContent value="status" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                 {/* Status Visual Grid */}
                 <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                   {[
                     { id: 'planejado', label: 'Planejado', icon: CalendarIcon },
                     { id: 'aguardando', label: 'Aguardando', icon: Clock },
                     { id: 'carregando', label: 'Carregando', icon: Package },
                     { id: 'em_rota', label: 'Em Rota', icon: Truck },
                     { id: 'finalizado', label: 'Finalizado', icon: CheckCircle },
                     { id: 'cancelado', label: 'Cancelado', icon: AlertTriangle }
                   ].map(st => {
                      const isActive = statusOperacional === st.id;
                      const Icon = st.icon;
                      return (
                        <div 
                          key={st.id} 
                          onClick={() => setStatusOperacional(st.id)}
                          className={\`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-2 text-center transition-all \${isActive ? 'bg-indigo-50 border-indigo-500 shadow-md ring-1 ring-indigo-500 ring-offset-1' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}\`}
                        >
                          <Icon className={\`w-5 h-5 \${isActive ? 'text-indigo-600' : 'text-slate-400'}\`} />
                          <span className={\`text-[10px] uppercase font-bold \${isActive ? 'text-indigo-700' : 'text-slate-500'}\`}>{st.label}</span>
                        </div>
                      )
                   })}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Cronograma Visual */}
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                     <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Timeline Operacional</h4>
                     <div className="space-y-4">
                       {[
                         { label: "Alocado", time: horarioInicio || "--:--", done: !!horarioInicio },
                         { label: "Chegada no Pátio", time: tempoChegadaPatio || "--:--", done: !!tempoChegadaPatio },
                         { label: "Início Carregamento", time: tempoInicioCarregamento || "--:--", done: !!tempoInicioCarregamento },
                         { label: "Fim Carregamento", time: tempoFimCarregamento || "--:--", done: !!tempoFimCarregamento },
                         { label: "Saída (Em Rota)", time: tempoSaidaRua || "--:--", done: !!tempoSaidaRua },
                         { label: "Entregas Finalizadas", time: tempoFinalizacaoEntregas || "--:--", done: !!tempoFinalizacaoEntregas }
                       ].map((step, idx, arr) => (
                         <div key={idx} className="flex items-start gap-4 relative">
                           {idx !== arr.length - 1 && <div className={\`absolute left-[11px] top-6 w-0.5 h-6 \${step.done ? 'bg-indigo-500' : 'bg-slate-200'}\`}></div>}
                           <div className={\`w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 bg-white \${step.done ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 text-slate-300'}\`}>
                             {step.done ? <Check className="w-3 h-3 font-bold"/> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300"/>}
                           </div>
                           <div className="flex-1 flex justify-between items-center pt-1">
                             <span className={\`text-xs font-bold \${step.done ? 'text-slate-800' : 'text-slate-400'}\`}>{step.label}</span>
                             <span className={\`text-xs font-mono \${step.done ? 'text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md' : 'text-slate-400'}\`}>{step.time}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Observação */}
                   <div className="space-y-2">
                     <Label className="text-xs font-bold text-primary">Observação Operacional</Label>
                     <textarea 
                       className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[200px] resize-y custom-scrollbar" 
                       placeholder="Adicione observações importantes, ocorrências ou detalhes sobre o andamento da viagem..."
                       value={observacaoOperacional}
                       onChange={e => setObservacaoOperacional(e.target.value)}
                     />
                   </div>
                 </div>
              </TabsContent>`);
    continue;
  }
  if (insideStatus && line.includes('</TabsContent>')) {
    insideStatus = false;
    continue;
  }
  if (insideStatus) {
    continue;
  }

  newLines.push(line);
}

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', newLines.join('\n'));
console.log('Script done line by line');
