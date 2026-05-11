const fs = require('fs');

let web = fs.readFileSync('src/components/operacao/RoteirizadorWeb.tsx', 'utf8');

// 1. Modificar o botão Gerar Roteiros Inteligentes e modo
const uiDistribuicao = `
  const [distribuicaoGerada, setDistribuicaoGerada] = useState<ReturnType<typeof distribuirPedidosEntreVeiculos>>([]);
  const [isGerando, setIsGerando] = useState(false);

  const handleGerarRoteiros = () => {
    setIsGerando(true);
    setTimeout(() => {
      try {
        const veiculosParaUso = modoRoteirizacao === 'sugestao' ? veiculosSugeridos as any : veiculos;
        const res = distribuirPedidosEntreVeiculos(pedidos, veiculosParaUso, modoRoteirizacao);
        setDistribuicaoGerada(res);
        toast.success("Roteiros gerados com sucesso!");
        setActiveTab("roteiros");
      } catch (err: any) {
        toast.error("Erro ao gerar roteiros: " + err.message);
      } finally {
        setIsGerando(false);
      }
    }, 500);
  };

  const distribuicao = distribuicaoGerada.length > 0 ? distribuicaoGerada : distribuirPedidosEntreVeiculos(pedidos, veiculos, modoRoteirizacao);
  const resumo = gerarResumoRoteirizacao(distribuicao, pedidos);
`;

web = web.replace(
  'const distribuicao = distribuirPedidosEntreVeiculos(pedidos, veiculos);',
  uiDistribuicao
);
web = web.replace(
  'const resumo = gerarResumoRoteirizacao(distribuicao, pedidos);',
  ''
);

// Adicionar botão no topbar e no Card de Modo Roteirização
web = web.replace(
  '<Button size="sm">\n            <Upload className="w-4 h-4 mr-2" />\n            Importar Planilha\n          </Button>',
  '<Button size="sm" onClick={() => setActiveTab("importar")}>\n            <Upload className="w-4 h-4 mr-2" />\n            Importar Planilha\n          </Button>\n          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleGerarRoteiros} disabled={isGerando}>\n            <Route className="w-4 h-4 mr-2" />\n            {isGerando ? "Gerando..." : "Gerar Roteiros Inteligentes"}\n          </Button>'
);

// Mostrar pedidos não alocados na aba roteiros
const roteirosContent = `
        <TabsContent value="roteiros" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Roteiros Gerados</CardTitle>
                <CardDescription>Distribuição inteligente dos pedidos entre os veículos</CardDescription>
              </div>
              <Button onClick={handleGerarRoteiros} disabled={isGerando}>
                 <Route className="w-4 h-4 mr-2"/>
                 {isGerando ? "Recalculando..." : "Atualizar Roteiros"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {distribuicao.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                    <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum roteiro gerado.</p>
                    <p className="text-sm text-slate-500">Clique em "Gerar Roteiros Inteligentes" para distribuir a carga.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Rotas Geradas</p>
                         <p className="text-2xl font-bold">{distribuicao.length}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Pedidos Alocados</p>
                         <p className="text-2xl font-bold text-green-600">{resumo.totalPedidos - resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Não Alocados</p>
                         <p className="text-2xl font-bold text-red-600">{resumo.pedidosNaoAlocados}</p>
                       </div>
                       <div className="bg-white p-4 border rounded-lg shadow-sm">
                         <p className="text-sm text-muted-foreground">Ocupação Média</p>
                         <p className="text-2xl font-bold text-blue-600">{resumo.ocupacaoMedia.toFixed(1)}%</p>
                       </div>
                    </div>

                    {resumo.pedidosNaoAlocados > 0 && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                        <div className="flex items-start gap-3">
                           <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                           <div>
                             <h4 className="font-bold text-red-800">Atenção: {resumo.pedidosNaoAlocados} pedidos não alocados</h4>
                             <p className="text-sm text-red-600 mb-2">Estes pedidos excederam a capacidade da frota ou não possuem veículos compatíveis (ex: falta de refrigerado).</p>
                             <div className="bg-white/60 p-2 rounded text-sm text-red-800 font-medium border border-red-100">
                               Sugestão Extra: {
                                 sugerirVeiculosNecessarios(
                                   pedidos.filter(p => !distribuicao.some(d => d.pedidos.some(dp => dp.id === p.id))),
                                   ['seco', 'refrigerado']
                                 ).map(s => \`\${s.quantidade}x \${getNomeTipoVeiculo(s.tipo)}\`).join(', ') || 'Nenhuma'
                               }
                             </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {distribuicao.map((resultado, idx) => {
                      const pesoUsado = resultado.pedidos.reduce((acc, p) => acc + (p.pesoKg || 0), 0);
                      const cubagemUsada = resultado.pedidos.reduce((acc, p) => acc + calcularCubagemPedido(p), 0);
                      const ocupacaoPeso = resultado.veiculo.capacidadePesoKg > 0 ? (pesoUsado / resultado.veiculo.capacidadePesoKg) * 100 : 0;
                      const ocupacaoCubagem = resultado.veiculo.capacidadeCubagemM3 > 0 ? (cubagemUsada / resultado.veiculo.capacidadeCubagemM3) * 100 : 0;
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 p-4 border-b">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <div className="text-3xl bg-white w-12 h-12 flex items-center justify-center rounded-lg shadow-sm border">
                                  {getIconeTipoVeiculo(resultado.veiculo.tipoVeiculo)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg text-slate-800">{getNomeTipoVeiculo(resultado.veiculo.tipoVeiculo)}</h3>
                                    <Badge variant="outline" className="font-mono bg-white">{resultado.veiculo.placa || 'S/PLACA'}</Badge>
                                    {resultado.veiculo.tipoOperacao === 'refrigerado' && (
                                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200"><Thermometer className="w-3 h-3 mr-1"/> Refrig.</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-slate-500">{resultado.veiculo.motorista || 'Sem motorista vinculado'}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={ocupacaoPeso > 90 || ocupacaoCubagem > 90 ? 'destructive' : ocupacaoPeso > 70 || ocupacaoCubagem > 70 ? 'default' : 'outline'} className="text-sm px-3 py-1">
                                  {Math.max(ocupacaoPeso, ocupacaoCubagem).toFixed(0)}% Ocupação Máx
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Paradas / Entregas</p>
                                <p className="font-bold text-slate-700">{resultado.pedidos.length}</p>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Peso (kg)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{pesoUsado.toFixed(1)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadePesoKg}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={\`h-full \${ocupacaoPeso > 90 ? 'bg-red-500' : 'bg-green-500'}\`} style={{ width: \`\${Math.min(ocupacaoPeso, 100)}%\` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Cubagem (m³)</p>
                                <div className="flex items-end justify-between">
                                  <p className="font-bold text-slate-700">{cubagemUsada.toFixed(2)} <span className="text-xs font-normal text-slate-400">/ {resultado.veiculo.capacidadeCubagemM3}</span></p>
                                </div>
                                <div className="w-full bg-slate-100 h-1.5 mt-1 rounded-full overflow-hidden">
                                  <div className={\`h-full \${ocupacaoCubagem > 90 ? 'bg-red-500' : 'bg-blue-500'}\`} style={{ width: \`\${Math.min(ocupacaoCubagem, 100)}%\` }}></div>
                                </div>
                              </div>
                              <div className="bg-white p-2 rounded border">
                                <p className="text-slate-500 text-xs uppercase font-semibold">Região Principal</p>
                                <p className="font-bold text-slate-700 truncate" title={resultado.veiculo.regiaoBase || 'Diversa'}>
                                  {resultado.veiculo.regiaoBase || 'Diversa'} (CEP: {resultado.veiculo.cepBasePrestador || '-'})
                                </p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                            <Table>
                              <TableHeader className="bg-slate-50 sticky top-0">
                                <TableRow>
                                  <TableHead className="w-12 text-center">#</TableHead>
                                  <TableHead>Pedido</TableHead>
                                  <TableHead>CEP</TableHead>
                                  <TableHead>Destinatário / Cidade</TableHead>
                                  <TableHead className="text-right">Peso</TableHead>
                                  <TableHead className="text-right">Cubagem</TableHead>
                                  <TableHead className="text-center">Tipo</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {resultado.pedidos.map((pedido, i) => (
                                  <TableRow key={pedido.id} className="hover:bg-slate-50">
                                    <TableCell className="text-center text-slate-500">{i + 1}</TableCell>
                                    <TableCell className="font-medium text-xs">
                                      {pedido.numeroPedido}
                                      {pedido.prioridade === 'urgente' && <Badge variant="destructive" className="ml-2 text-[10px] px-1 py-0 h-4">URGENTE</Badge>}
                                    </TableCell>
                                    <TableCell className="text-xs font-mono">{pedido.cep}</TableCell>
                                    <TableCell className="text-xs">
                                      <p className="font-medium truncate max-w-[150px]" title={pedido.destinatario}>{pedido.destinatario}</p>
                                      <p className="text-slate-500 truncate max-w-[150px]">{pedido.cidade}/{pedido.estado}</p>
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{pedido.pesoKg} kg</TableCell>
                                    <TableCell className="text-right text-xs">{calcularCubagemPedido(pedido).toFixed(3)} m³</TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={pedido.secoOuRefrigerado === 'refrigerado' ? 'blue' : 'outline'} className="text-[10px]">
                                        {pedido.secoOuRefrigerado === 'refrigerado' ? 'Refri' : 'Seco'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
`;

web = web.replace(/<TabsContent value="roteiros" className="space-y-4">[\s\S]*?(?=<TabsContent value="mapa" className="space-y-4">)/, roteirosContent);

fs.writeFileSync('src/components/operacao/RoteirizadorWeb.tsx', web);
console.log('Done Web');
