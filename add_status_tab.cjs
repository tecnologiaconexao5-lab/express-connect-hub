const fs = require('fs');
let code = fs.readFileSync('src/components/operacao/EscalaLista.tsx', 'utf8');

// 1. Add states
const stateTarget = `const [kmFinal, setKmFinal] = useState<number>(0);`;
code = code.replace(stateTarget, `${stateTarget}\n  const [statusOperacional, setStatusOperacional] = useState("planejado");\n  const [observacaoOperacional, setObservacaoOperacional] = useState("");`);

// 2. Load state
const loadTarget = `setKmFinal(existing.kmFinal);\n      else setKmFinal(0);`;
code = code.replace(loadTarget, `${loadTarget}\n      if (existing.metadata?.statusOperacional) setStatusOperacional(existing.metadata.statusOperacional);\n      else setStatusOperacional("planejado");\n      if (existing.metadata?.observacaoOperacional) setObservacaoOperacional(existing.metadata.observacaoOperacional);\n      else setObservacaoOperacional("");`);

// 3. Save state
const saveTarget = `metadata: { financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? 'pendente' : 'fallback') : 'ok' }`;
code = code.replace(saveTarget, `metadata: { financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? 'pendente' : 'fallback') : 'ok', statusOperacional, observacaoOperacional }`);

// 4. Update TabsList with Status da Entrega
const tabsListTarget = `<TabsList className="grid grid-cols-3 w-full">`;
code = code.replace(tabsListTarget, `<TabsList className="grid grid-cols-4 w-full">`);

const tabsTriggerResumoTarget = `<TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>`;
code = code.replace(tabsTriggerResumoTarget, `${tabsTriggerResumoTarget}\n                <TabsTrigger value="status" className="text-xs"><Play className="w-3 h-3 mr-1"/>Status da Entrega</TabsTrigger>`);

// 5. Add TabsContent for status
const endTabsTarget = `</TabsContent>\n            </Tabs>`;
const newTabContent = `
              <TabsContent value="status" className="space-y-4 py-4">
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
              </TabsContent>
`;
code = code.replace(endTabsTarget, `</TabsContent>\n${newTabContent}\n            </Tabs>`);

fs.writeFileSync('src/components/operacao/EscalaLista.tsx', code);
console.log('Script ran successfully');
