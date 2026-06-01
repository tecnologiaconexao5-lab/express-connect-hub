const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Add statusOperacional state
code = code.replace(
  'const [tempoFimCarregamento, setTempoFimCarregamento] = useState("09:30");',
  `const [tempoFimCarregamento, setTempoFimCarregamento] = useState("09:30");
  const [statusOperacional, setStatusOperacional] = useState("aberto/planejado");`
);

// 2. Rename tab trigger
code = code.replace(
  'Jornada & Pátio</TabsTrigger>',
  'Posição da Viagem</TabsTrigger>'
);

// 3. Edit where the existing metadata is loaded to load statusOperacional
code = code.replace(
  'setAjusteClienteMotivo(existing.metadata?.ajuste_motivo || "");',
  `setAjusteClienteMotivo(existing.metadata?.ajuste_motivo || "");
        setStatusOperacional(existing.metadata?.statusOperacional || "aberto/planejado");`
);

// 4. Edit where metadata is saved to include statusOperacional
// Wait, we need to be careful with the exact string. Let's just find `metadata:` block inside `const novaAlocacao`
code = code.replace(
  'metadata: { financeiro_status: financeiroStatus }',
  'metadata: { financeiro_status: financeiroStatus, statusOperacional }'
);
code = code.replace(
  'metadata: { financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? \'pendente\' : \'fallback\') : \'ok\' }',
  'metadata: { statusOperacional, financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? \'pendente\' : \'fallback\') : \'ok\' }'
);

// Rewrite the "resumo" Tab content
const resumoTabRegex = /<TabsContent value="resumo"[\s\S]*?<\/TabsContent>/;
const newResumoContent = `<TabsContent value="resumo" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* 1. STATUS OPERACIONAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                    <span>Posição Operacional</span>
                  </div>
                  <div className="space-y-1">
                     <Label className="text-xs text-slate-500 font-semibold">Status da Viagem</Label>
                     <Select value={statusOperacional} onValueChange={setStatusOperacional}>
                       <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o status" /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="aberto/planejado">Aberto/Planejado</SelectItem>
                         <SelectItem value="aguardando">Aguardando</SelectItem>
                         <SelectItem value="carregando">Carregando</SelectItem>
                         <SelectItem value="em rota">Em Rota</SelectItem>
                         <SelectItem value="finalizado/fechado">Finalizado/Fechado</SelectItem>
                         <SelectItem value="cancelado">Cancelado</SelectItem>
                       </SelectContent>
                     </Select>
                  </div>
                </div>

                {/* 2. REGISTRO DE KM E REPASSE PRESTADOR */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                    <span>Controle de KM e Repasse</span>
                    <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 font-bold text-[10px]">PRESTADOR</Badge>
                  </div>
                  
                  {(() => {
                    const totals = calcularTotalAlocacao();
                    const det = totals.prestador.detalhes;
                    
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">KM Inicial</Label>
                            <Input 
                              type="number" 
                              value={kmInicial} 
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setKmInicial(val);
                                setFinanceiro(f => ({ ...f, kmRodados: Math.max(kmFinal - val, 0) }));
                              }}
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">KM Final</Label>
                            <Input 
                              type="number" 
                              value={kmFinal} 
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setKmFinal(val);
                                setFinanceiro(f => ({ ...f, kmRodados: Math.max(val - kmInicial, 0) }));
                              }}
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">KM Total (Realizado):</span>
                          <span className="font-bold text-slate-800">{Math.max(kmFinal - kmInicial, 0)} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Franquia Prestador:</span>
                          <span className="font-bold text-slate-800">{Math.max(kmFinal - kmInicial, 0) - det.km.excedente} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">KM Excedente:</span>
                          <span className="font-bold text-orange-600">{det.km.excedente} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Valor KM Prestador:</span>
                          <span className="font-bold text-slate-800">R$ {det.km.valorKm.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Total KM Excedente:</span>
                          <span className="font-bold text-slate-800">R$ {det.km.totalExcedente.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Diária Prestador:</span>
                          <span className="font-bold text-slate-800">R$ {totals.prestador.valorBase.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs py-1 border-t-2 mt-2 pt-2 bg-orange-50/50 p-2 rounded">
                          <span className="text-orange-900 font-bold">Total Prestador:</span>
                          <span className="font-bold text-orange-600 text-sm">R$ {totals.prestador.total.toFixed(2)}</span>
                        </div>

                      </div>
                    );
                  })()}
                </div>
              </TabsContent>`;

code = code.replace(resumoTabRegex, newResumoContent);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Script 1 done');
