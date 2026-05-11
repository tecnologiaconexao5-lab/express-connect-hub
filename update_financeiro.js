const fs = require('fs');
let code = fs.readFileSync('src/components/financeiro/PagamentoPrestadores.tsx', 'utf8');

// 1. Interfaces
code = code.replace(
  'interface PagamentoManual {',
  'interface ExtratoContaCorrente {\n  id: string;\n  data: string;\n  origem: string;\n  descricao: string;\n  credito: number;\n  debito: number;\n  saldo: number;\n  status: string;\n}\n\ninterface PagamentoManual {'
);
code = code.replace(
  'status_pagamento: string;\n  elegivel_lote: boolean;',
  'status_pagamento: string;\n  status_aprovacao?: string;\n  elegivel_lote: boolean;\n  lote_id?: string;'
);

// 2. States and imports
code = code.replace(
  'const [aba, setAba] = useState(searchParams.get("aba") || "listagem");',
  'const [aba, setAba] = useState(searchParams.get("aba") || "listagem");\n  const [prestadorCC, setPrestadorCC] = useState<string>("");\n  const [extratoCC, setExtratoCC] = useState<ExtratoContaCorrente[]>([]);'
);

// 3. fetchExtratoContaCorrente
const fetchExtratoStr = `
  useEffect(() => {
    if (prestadorCC && aba === 'conta-corrente') {
      fetchExtratoContaCorrente(prestadorCC);
    }
  }, [prestadorCC, aba]);

  const fetchExtratoContaCorrente = async (prestadorId: string) => {
    try {
      // Puxar OS finalizadas
      const { data: osData, error: osError } = await supabase
        .from('ordens_servico')
        .select('id, numero, custo_prestador, pedagio, adicionais, descontos, data, status')
        .eq('prestador_id', prestadorId)
        .in('status', ['finalizada', 'concluida'])
        .order('data', { ascending: true });

      // Puxar pagamentos_prestadores (manuais/fechamentos)
      const { data: pagData, error: pagError } = await supabase
        .from('pagamentos_prestadores')
        .select('*')
        .eq('prestador_id', prestadorId)
        .order('data_competencia', { ascending: true });

      if (osError || pagError) throw osError || pagError;

      let saldoAcumulado = 0;
      const extrato: ExtratoContaCorrente[] = [];

      (osData || []).forEach(os => {
        const totalCred = (os.custo_prestador || 0) + (os.pedagio || 0) + (os.adicionais || 0);
        const totalDeb = (os.descontos || 0);
        saldoAcumulado += totalCred - totalDeb;
        extrato.push({
          id: os.id,
          data: os.data || '',
          origem: 'OS Finalizada',
          descricao: \`OS \${os.numero}\`,
          credito: totalCred,
          debito: totalDeb,
          saldo: saldoAcumulado,
          status: os.status
        });
      });

      (pagData || []).forEach(pag => {
        if (pag.origem_lancamento === 'manual') {
           const isCredito = pag.natureza === 'credito';
           saldoAcumulado += isCredito ? pag.valor : -pag.valor;
           extrato.push({
             id: pag.id,
             data: pag.data_competencia || pag.created_at,
             origem: pag.tipo_lancamento,
             descricao: pag.observacao || pag.tipo_lancamento,
             credito: isCredito ? pag.valor : 0,
             debito: !isCredito ? pag.valor : 0,
             saldo: saldoAcumulado,
             status: pag.status_pagamento
           });
        }
      });

      extrato.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
      
      let saldoCron = 0;
      extrato.forEach(e => {
        saldoCron += e.credito - e.debito;
        e.saldo = saldoCron;
      });

      setExtratoCC(extrato);
    } catch (e: any) {
      console.error('Erro ao buscar extrato', e);
    }
  };

  const handleAtualizarStatus = async (id: string, updates: any) => {
    try {
      const { error } = await supabase.from('pagamentos_prestadores').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Status atualizado!');
      fetchPagamentosManuais();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };
`;

code = code.replace(
  'const verificarElegibilidadeLote = (prestadorId: string): boolean => {',
  fetchExtratoStr + '\n  const verificarElegibilidadeLote = (prestadorId: string): boolean => {'
);

// 4. Update Fechamento Automático
const fechamentoAntigo = /try \{\s+const \{ data: pagamento, error \} = await supabase\s+\.from\("pagamentos_prestadores"\)\s+\.insert\(\[\{[\s\S]*?\}\]\)\s+\.select\(\)\s+\.single\(\);/m;
const novoFechamento = `try {
      const { data: existente } = await supabase
        .from("pagamentos_prestadores")
        .select("id")
        .eq("prestador_id", selectedPrestador.id)
        .eq("tipo_pagamento", "fechamento")
        .eq("periodo_inicio", dataInicio)
        .eq("periodo_fim", dataFim)
        .maybeSingle();

      if (existente) {
        if (!window.confirm("Já existe um fechamento para este prestador neste período. Deseja atualizar os valores?")) {
           return;
        }
      }

      const payload = {
          prestador_id: selectedPrestador.id,
          prestador_nome: selectedPrestador.nome_completo,
          prestador_documento: selectedPrestador.cpf_cnpj,
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          qtd_os: total.quantidade,
          valor_servicos: total.servicos,
          valor_reembolsos: ajustes.reembolso,
          valor_bonus: ajustes.bonus,
          valor_descontos: total.descontos + ajustes.desconto,
          valor_adiantamentos: 0,
          valor_liquido: total.liquido,
          status_conferencia: "em_aberto",
          status_pagamento: "pendente",
          status_aprovacao: "aguardando_aprovacao",
          tipo_pagamento: "fechamento",
          origem_lancamento: "fechamento",
          impacto_dre: true,
          impacto_fluxo_caixa: true,
          data_competencia: dataFim
      };

      let pagamentoId = existente?.id;
      if (existente) {
        const { error } = await supabase.from("pagamentos_prestadores").update(payload).eq("id", existente.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pagamentos_prestadores").insert([payload]).select().single();
        if (error) throw error;
        pagamentoId = data.id;
      }`;
code = code.replace(fechamentoAntigo, novoFechamento);

// 5. Update UI Tabs
code = code.replace(
  '<div className="space-y-4">\n      <div className="flex items-center justify-between">',
  '<div className="space-y-4">\n      <div className="flex items-center justify-between">'
);

const uiAntigo = /<Card>\s*<CardHeader className="pb-3">/;
const uiNovo = `<Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="listagem">Fechamentos e Pagamentos</TabsTrigger>
          <TabsTrigger value="conta-corrente">Conta Corrente</TabsTrigger>
        </TabsList>
        <TabsContent value="listagem" className="space-y-4">
      <Card>
        <CardHeader className="pb-3">`;
code = code.replace(uiAntigo, uiNovo);

code = code.replace(
  '<Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>',
  `        </TabsContent>
        <TabsContent value="conta-corrente" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conta Corrente do Prestador</CardTitle>
              <CardDescription>Extrato financeiro com entradas, saídas e saldo acumulado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-1/3">
                <Label>Selecionar Prestador</Label>
                <Select value={prestadorCC} onValueChange={setPrestadorCC}>
                  <SelectTrigger><SelectValue placeholder="Escolha um prestador..." /></SelectTrigger>
                  <SelectContent>
                    {prestadores.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {prestadorCC && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Crédito (+)</TableHead>
                        <TableHead className="text-right">Débito (-)</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {extratoCC.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-4">Nenhum lançamento encontrado</TableCell></TableRow>
                      ) : (
                        extratoCC.map(e => (
                          <TableRow key={e.id}>
                            <TableCell>{new Date(e.data).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell><Badge variant="outline">{e.origem}</Badge></TableCell>
                            <TableCell>{e.descricao}</TableCell>
                            <TableCell className="text-right text-green-600">{e.credito > 0 ? e.credito.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</TableCell>
                            <TableCell className="text-right text-red-600">{e.debito > 0 ? e.debito.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}) : '-'}</TableCell>
                            <TableCell className={\`text-right font-bold \${e.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}\`}>{e.saldo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</TableCell>
                            <TableCell><Badge variant="secondary">{e.status}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>`
);

// Update Actions in Pagamentos Manuais
const actionsAntigo = `                        {p.status_conferencia !== 'conferido' && (
                          <Button size="icon" variant="ghost" title="Marcar Conferido" onClick={async () => {
                            await supabase.from('pagamentos_prestadores').update({ status_conferencia: 'conferido', elegivel_lote: verificarElegibilidadeLote(p.prestador_id) && p.status_pagamento === 'pendente' && (p.natureza === 'credito' ? p.valor : -p.valor) > 0 }).eq('id', p.id);
                            fetchPagamentosManuais();
                          }}>
                            <FileCheck className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {p.status_pagamento === "pendente" && p.status_conferencia === 'conferido' && (
                          <Button size="icon" variant="ghost" title="Marcar Pago" onClick={() => handleMarcarPago(p.id)}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Ver Detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {p.status_pagamento !== "pago" && p.status_pagamento !== "cancelado" && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={async () => {
                            await supabase.from('pagamentos_prestadores').update({ status_pagamento: 'cancelado' }).eq('id', p.id);
                            fetchPagamentosManuais();
                          }}>
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        )}`;

const actionsNovo = `                        {p.status_conferencia !== 'conferido' && (
                          <Button size="icon" variant="ghost" title="Marcar Conferido" onClick={() => handleAtualizarStatus(p.id, { status_conferencia: 'conferido', elegivel_lote: verificarElegibilidadeLote(p.prestador_id) })}>
                            <FileCheck className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {p.status_conferencia === 'conferido' && (p.status_aprovacao === 'aguardando_aprovacao' || !p.status_aprovacao) && (
                          <>
                            <Button size="icon" variant="ghost" title="Aprovar Pagamento" onClick={() => handleAtualizarStatus(p.id, { status_aprovacao: 'aprovado' })}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Rejeitar Pagamento" onClick={() => handleAtualizarStatus(p.id, { status_aprovacao: 'rejeitado' })}>
                              <FileX className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {p.status_aprovacao === 'aprovado' && p.status_pagamento === 'pendente' && p.elegivel_lote && (
                          <Button size="sm" variant="outline" className="text-xs py-0 h-8" title="Liberar Lote" onClick={() => handleAtualizarStatus(p.id, { status_pagamento: 'em_lote' })}>
                            Lote
                          </Button>
                        )}
                        {p.status_pagamento === 'pendente' || p.status_pagamento === 'em_lote' ? (
                           <Button size="icon" variant="ghost" title="Marcar Pago" onClick={() => handleMarcarPago(p.id)}>
                             <DollarSign className="w-4 h-4 text-green-600" />
                           </Button>
                        ) : null}
                        <Button size="icon" variant="ghost" title="Ver Detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {p.status_pagamento !== "pago" && p.status_pagamento !== "cancelado" && (
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={() => handleAtualizarStatus(p.id, { status_pagamento: 'cancelado' })}>
                            <X className="w-4 h-4 text-red-600" />
                          </Button>
                        )}`;
code = code.replace(actionsAntigo, actionsNovo);

// 6. Append export function gerarLancamentosPrestadorPorOS
const funcExport = `
export async function gerarLancamentosPrestadorPorOS(os: any) {
  if (!os || os.status !== 'finalizada' || !os.prestador_id) return;
  
  // Evitar duplicidade
  const { data: existente } = await supabase
    .from('pagamentos_prestadores')
    .select('id')
    .eq('os_id', os.id)
    .eq('origem_lancamento', 'os')
    .maybeSingle();
    
  if (existente) return;
  
  const totalCred = (os.custo_prestador || 0) + (os.pedagio || 0) + (os.adicionais || 0);
  const totalDeb = (os.descontos || 0);
  const valorLiquido = totalCred - totalDeb;
  
  const payload = {
    prestador_id: os.prestador_id,
    os_id: os.id,
    os_numero: os.numero,
    tipo_lancamento: 'Serviço OS',
    natureza: valorLiquido >= 0 ? 'credito' : 'debito',
    valor: Math.abs(valorLiquido),
    valor_liquido: valorLiquido,
    valor_servicos: os.custo_prestador || 0,
    valor_pedagio: os.pedagio || 0,
    valor_adicionais: os.adicionais || 0,
    valor_descontos: os.descontos || 0,
    data_competencia: os.data || new Date().toISOString().split('T')[0],
    status_conferencia: 'em_aberto',
    status_aprovacao: 'aguardando_aprovacao',
    status_pagamento: 'pendente',
    origem_lancamento: 'os',
    impacto_dre: true,
    impacto_fluxo_caixa: true,
    categoria_financeira: 'Custo Logístico'
  };
  
  await supabase.from('pagamentos_prestadores').insert([payload]);
}
`;

code = code + '\n' + funcExport;

fs.writeFileSync('src/components/financeiro/PagamentoPrestadores.tsx', code);
console.log('Done modifying.');
