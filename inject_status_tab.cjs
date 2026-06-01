const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

const statusTab = `
              <TabsContent value="status" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
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
              </TabsContent>
`;

const target = `              </TabsContent>
            </Tabs>
`;

code = code.replace(target, `              </TabsContent>\n${statusTab}\n            </Tabs>\n`);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Injected status tab');
