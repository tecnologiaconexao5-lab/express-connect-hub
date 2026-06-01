const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Dados da Alocação (around line 1826)
// const kmFranquia = tabelaValores?.km_franquia || 200;
// const valorKm = tabelaValores?.valor_km || 2.50;
const block1Regex = /const kmFranquia = tabelaValores\?.km_franquia \|\| 200;\s*const valorKm = tabelaValores\?.valor_km \|\| 2\.50;/g;
const block1Replace = `const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                     const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 0;
                     const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 0;`;
code = code.replace(block1Regex, block1Replace);

// 2. Resumo do Dia (around line 2266)
// const diariaBase = tabelaValores?.valor_base || 400;
// const kmFranquia = tabelaValores?.km_franquia || 200;
// const valorKm = tabelaValores?.valor_km || 2.50;
const block2Regex = /const diariaBase = tabelaValores\?.valor_base \|\| 400;\s*const kmFranquia = tabelaValores\?.km_franquia \|\| 200;\s*const valorKm = tabelaValores\?.valor_km \|\| 2\.50;/g;
const block2Replace = `const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                    const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;
                    const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 100;
                    const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 1.75;`;
code = code.replace(block2Regex, block2Replace);

// Fix duplicidade in Resumo do dia: totalDia calculation
const block3Regex = /const totalDia = diariaCalculada \+ \(tabelaNaoConfigurada \? 0 : valorKmExcedente\) \+ totals\.totalAdicionais - totals\.totalDescontos;/g;
const block3Replace = `const totalDia = diariaCalculada + valorKmExcedente + totals.totalAdicionais - totals.totalDescontos;`;
code = code.replace(block3Regex, block3Replace);

// Also remove the "tabelaNaoConfigurada" logic from kmExcedente rendering
const badgeTabelaNaoConfiguradaAntiga = /tabelaNaoConfigurada \? \(\s*<Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-\[10px\] border-0">\s*Tabela não configurada\s*<\/Badge>\s*\) : \(/g;
code = code.replace(badgeTabelaNaoConfiguradaAntiga, `false ? (`);

const spanNaoConfigurada1 = /tabelaNaoConfigurada \? \(\s*<span className="font-bold text-slate-400">-<\/span>\s*\) : \(/g;
code = code.replace(spanNaoConfigurada1, `false ? (`);


// 3. Status Tab 
const statusTabTarget = /<TabsContent value="status" className="space-y-4 py-4">[\s\S]*?<\/TabsContent>/g;
const newStatusTab = `<TabsContent value="status" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
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
              </TabsContent>`;

code = code.replace(statusTabTarget, newStatusTab);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);

console.log('Regex matched block1:', block1Regex.test(fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8')));
console.log('Tabs status done');
