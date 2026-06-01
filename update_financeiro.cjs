const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

const regexFinanceiro = /<TabsContent value=\"financeiro\"[\s\S]*?<\/TabsContent>/;
const matchFinanceiro = code.match(regexFinanceiro);

if (matchFinanceiro) {
  // We'll replace it entirely with a cleanly separated one!
  const novoFinanceiro = `<TabsContent value="financeiro" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                {(() => {
                  const totals = calcularTotalAlocacao();
                  const faturamentoCliente = totals.faturamentoTotal;
                  const repassePrestador = totals.repasseTotal;
                  const margem = faturamentoCliente - repassePrestador;
                  
                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Bloco 1: Faturamento Cliente */}
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                          <h4 className="text-sm font-bold text-blue-800 mb-3 border-b border-blue-100 pb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Faturamento Cliente
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Diária Base</span>
                              <span className="font-medium text-slate-800">{fmtBRL(totals.valorDiaria)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">KM Excedente ({Math.max(kmFinal - kmInicial - (tabelaValores?.km_franquia || 0), 0)}km x {fmtBRL(tabelaValores?.valor_km_excedente || 0)})</span>
                              <span className="font-medium text-slate-800">{fmtBRL(Math.max(kmFinal - kmInicial - (tabelaValores?.km_franquia || 0), 0) * (tabelaValores?.valor_km_excedente || 0))}</span>
                            </div>
                            {ajusteClienteValor !== 0 && (
                              <div className="flex justify-between text-xs">
                                <span className="text-slate-600">Ajuste Manual</span>
                                <span className="font-medium text-slate-800">{fmtBRL(ajusteClienteValor)}</span>
                              </div>
                            )}
                            <div className="pt-2 mt-2 border-t border-blue-100/50 flex justify-between font-bold text-sm">
                              <span className="text-blue-900">Total Cliente</span>
                              <span className="text-blue-700">{fmtBRL(faturamentoCliente)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bloco 2: Repasse Prestador */}
                        <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                          <h4 className="text-sm font-bold text-orange-800 mb-3 border-b border-orange-100 pb-2 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Repasse Prestador
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Diária Motorista</span>
                              <span className="font-medium text-slate-800">{fmtBRL(financeiro.valorDiaria)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">KM Adicional Prestador</span>
                              <span className="font-medium text-slate-800">{fmtBRL(Math.max(kmFinal - kmInicial - (tabelaValores?.km_franquia || 0), 0) * (financeiro.valorKm || 0))}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-orange-100/50 flex justify-between font-bold text-sm">
                              <span className="text-orange-900">Total Prestador</span>
                              <span className="text-orange-700">{fmtBRL(repassePrestador)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Bloco 3: Resultado Operacional */}
                        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                          <h4 className="text-sm font-bold text-emerald-800 mb-3 border-b border-emerald-100 pb-2 flex items-center gap-2">
                            <Wallet className="w-4 h-4" />
                            Resultado Operacional
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Faturamento</span>
                              <span className="font-medium text-emerald-700">{fmtBRL(faturamentoCliente)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600">Custo</span>
                              <span className="font-medium text-rose-600">-{fmtBRL(repassePrestador)}</span>
                            </div>
                            <div className="pt-2 mt-2 border-t border-emerald-100/50 flex justify-between font-bold text-sm">
                              <span className="text-emerald-900">Margem Bruta</span>
                              <span className="text-emerald-700">{fmtBRL(margem)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>`;
  
  code = code.replace(regexFinanceiro, novoFinanceiro);
}

const statusBlock = `
                {/* Aba Acompanhamento Operacional */}
                <div className="mt-8 border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    Acompanhamento Operacional
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Planejada */}
                    <div className="border rounded-xl p-3 bg-white flex flex-col gap-1 relative overflow-hidden group hover:border-slate-300 transition-colors">
                      <div className="absolute top-0 right-0 p-1.5 opacity-10">
                        <Calendar className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Status Inicial</span>
                      <p className="font-medium text-sm text-slate-700">Planejada</p>
                    </div>

                    {/* Aguardando Chegada */}
                    <div className="border rounded-xl p-3 bg-white flex flex-col gap-1 relative overflow-hidden group hover:border-orange-300 transition-colors cursor-pointer"
                         onClick={() => setNovoStatus("aguardando")}>
                      <div className="absolute top-0 right-0 p-1.5 opacity-10">
                        <Clock className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-bold text-orange-400 uppercase">No Pátio</span>
                      <p className="font-medium text-sm text-slate-700">Aguard. Chegada</p>
                      {novoStatus === 'aguardando' && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-400" />}
                    </div>

                    {/* Em Rota */}
                    <div className="border rounded-xl p-3 bg-white flex flex-col gap-1 relative overflow-hidden group hover:border-blue-300 transition-colors cursor-pointer"
                         onClick={() => setNovoStatus("operacao")}>
                      <div className="absolute top-0 right-0 p-1.5 opacity-10">
                        <Truck className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-bold text-blue-400 uppercase">Em Serviço</span>
                      <p className="font-medium text-sm text-slate-700">Em Rota</p>
                      {novoStatus === 'operacao' && <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-500" />}
                    </div>

                    {/* Finalizado */}
                    <div className="border rounded-xl p-3 bg-white flex flex-col gap-1 relative overflow-hidden group hover:border-emerald-300 transition-colors cursor-pointer"
                         onClick={() => setNovoStatus("finalizado")}>
                      <div className="absolute top-0 right-0 p-1.5 opacity-10">
                        <CheckCircle className="w-8 h-8" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">Concluído</span>
                      <p className="font-medium text-sm text-slate-700">Finalizado</p>
                      {novoStatus === 'finalizado' && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500" />}
                    </div>
                  </div>
                </div>
`;

// Insert the statusBlock inside the `resumo` tab just before the `</TabsContent>` of resumo
const indexOfResumo = code.indexOf('<TabsContent value="resumo"');
if (indexOfResumo !== -1) {
  const indexOfResumoEnd = code.indexOf('</TabsContent>', indexOfResumo);
  code = code.substring(0, indexOfResumoEnd) + statusBlock + code.substring(indexOfResumoEnd);
}

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Financeiro e status injetados');
