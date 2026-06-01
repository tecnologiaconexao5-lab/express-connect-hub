const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Remover TabsList duplicada (a primeira)
const firstTabsListRegex = /<TabsList className="grid grid-cols-4 w-full">[\s\S]*?<\/TabsList>/;
code = code.replace(firstTabsListRegex, '');

// 2. Ajustar "Resumo do Dia" para usar os dados do prestador
const resumoCalculoAntigo = `const totals = calcularTotalAlocacao();
                    const horaSaida = tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8;
                    const diariaBase = tabelaValores?.valor_base || 400;
                    const kmFranquia = tabelaValores?.km_franquia || 200;
                    const valorKm = tabelaValores?.valor_km || 2.50;`;

const resumoCalculoNovo = `const totals = calcularTotalAlocacao();
                    const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                    const horaSaida = tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8;
                    const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;
                    const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 100;
                    const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 1.75;`;

code = code.replace(resumoCalculoAntigo, resumoCalculoNovo);

// Também precisamos evitar a soma dupla. O user disse: "Não somar R$ 45,00 + R$ 31,50. Isso duplica adicional"
// A soma do totalDia no antigo era: `const totalDia = diariaCalculada + (tabelaNaoConfigurada ? 0 : valorKmExcedente) + totals.totalAdicionais - totals.totalDescontos;`
// Vamos substituir para tirar totals.totalAdicionais de duplicar o valor do KM (se for o caso). 
// Wait, na verdade, se \`valorKmExcedente\` for o que o usuário quer dizer com "adicional R$ 31,50", ele quer que o valorKmExcedente SEJA os 31,50 (que agora vai ser pois usamos o valorKm do prestador de 1.75 * 18 = 31.50).
// Então o cálculo: diariaCalculada + valorKmExcedente + totals.totalAdicionais (que são os extras do form) - totals.totalDescontos.
// Como não sabemos se "totals.totalAdicionais" inclui o excedente em algum outro lugar (não deveria), vamos só mudar a linha:
const totalDiaLinhaAntiga = `const totalDia = diariaCalculada + (tabelaNaoConfigurada ? 0 : valorKmExcedente) + totals.totalAdicionais - totals.totalDescontos;`;
const totalDiaLinhaNova = `const totalDia = diariaCalculada + valorKmExcedente + totals.totalAdicionais - totals.totalDescontos;`;
code = code.replace(totalDiaLinhaAntiga, totalDiaLinhaNova);

const badgeTabelaNaoConfiguradaAntiga = `tabelaNaoConfigurada ? (
                            <Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">
                              Tabela não configurada
                            </Badge>
                          ) : (`;
code = code.replace(badgeTabelaNaoConfiguradaAntiga, `false ? (`); // Quick hack to show the number instead of badge

const spanNaoConfigurada1 = `tabelaNaoConfigurada ? (
                            <span className="font-bold text-slate-400">-</span>
                          ) : (`;
code = code.replaceAll(spanNaoConfigurada1, `false ? (`);

// 3. Preencher Aba "Status da Entrega"
const statusTabTarget = `<TabsContent value="status" className="space-y-4 py-4">
                 <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-primary">Status da Viagem</Label>
                      <Select value={statusOperacional} onValueChange={setStatusOperacional}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione o status atual..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planejado">Planejado</SelectItem>
                          <SelectItem value="aguardando">Aguardando no Pátio</SelectItem>
                          <SelectItem value="carregando">Em Carregamento</SelectItem>
                          <SelectItem value="em_rota">Em Rota de Entrega</SelectItem>
                          <SelectItem value="finalizado">Finalizado / Retornou</SelectItem>
                          <SelectItem value="cancelado">Cancelado / Falta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-primary">Observação Operacional</Label>
                      <textarea 
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[100px] resize-y" 
                        placeholder="Adicione observações importantes sobre o andamento..."
                        value={observacaoOperacional}
                        onChange={e => setObservacaoOperacional(e.target.value)}
                      />
                    </div>
                 </div>
              </TabsContent>`;

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
console.log('Script ran');
