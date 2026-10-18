import { useState, useEffect, useCallback } from "react";
import { Building2, MapPin, Package, CheckCircle, AlertTriangle, DollarSign, FileText, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Search, Calendar, X, ArrowLeft, Eye, Phone, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { buscarFiliaisCliente, buscarDetalheFilial, type FilialClienteResumo, type FilialComparativo, type FilialDetalhe } from "@/services/portalCliente/portalClienteService";

interface PortalMultiFilialProps {
  clienteId?: string;
}

const PERIODOS = [
  { value: "7dias", label: "Últimos 7 dias" },
  { value: "30dias", label: "Últimos 30 dias" },
  { value: "60dias", label: "Últimos 60 dias" },
  { value: "mes_atual", label: "Mês Atual" },
];

export function PortalMultiFilial({ clienteId }: PortalMultiFilialProps) {
  const [filiais, setFiliais] = useState<FilialClienteResumo[]>([]);
  const [comparativo, setComparativo] = useState<FilialComparativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("30dias");
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState("visao_geral");
  const [selectedFilialNome, setSelectedFilialNome] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<FilialDetalhe | null>(null);
  const [loadingDetalhe, setLoadingDetalhe] = useState(false);

  const carregar = useCallback(async () => {
    if (!clienteId) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await buscarFiliaisCliente(clienteId, { periodo });
      setFiliais(result.filiais);
      setComparativo(result.comparativo);
    } catch {
      setFiliais([]);
      setComparativo([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, periodo]);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirDetalhe = async (nome: string) => {
    setSelectedFilialNome(nome);
    setLoadingDetalhe(true);
    try {
      const d = await buscarDetalheFilial(clienteId!, nome, { periodo });
      setDetalhe(d);
    } catch {
      setDetalhe(null);
    } finally {
      setLoadingDetalhe(false);
    }
  };

  const filtered = filiais.filter((f) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return f.nome.toLowerCase().includes(q);
  });

  const totalOS = filiais.reduce((a, f) => a + f.total_os, 0);
  const totalFaturamento = filiais.reduce((a, f) => a + f.faturamento, 0);
  const totalOcorrencias = filiais.reduce((a, f) => a + f.ocorrencias, 0);
  const totalPendentes = filiais.reduce((a, f) => a + f.pendentes_financeiro, 0);

  if (!clienteId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-[#111827]">Multi Filial</h2>
        <Card className="bg-amber-50 border-amber-200 rounded-2xl">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto text-amber-500 mb-2" />
            <p className="text-sm text-amber-800">Cliente não identificado. Faça login como cliente para acessar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#111827]">Multi Filial</h2>
        <div className="flex items-center gap-2 text-sm text-[#475569]">
          {!loading && (
            <>
              <span>{filiais.length} filial(is)</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={carregar}>
                <Calendar className="w-3 h-3 mr-1" /> Atualizar
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white border-[#E5E7EB] rounded-2xl animate-pulse">
              <CardContent className="p-4"><div className="h-4 bg-slate-200 rounded w-1/3 mb-3" /><div className="h-3 bg-slate-100 rounded w-2/3" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <Building2 className="w-5 h-5 mx-auto text-[#F97316] mb-1" />
                <p className="text-xl font-bold text-[#111827]">{filiais.length}</p>
                <p className="text-[10px] text-[#64748B]">Filiais</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <Package className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{totalOS}</p>
                <p className="text-[10px] text-[#64748B]">Operações</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <DollarSign className="w-5 h-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{totalFaturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}</p>
                <p className="text-[10px] text-[#64748B]">Faturamento</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <AlertTriangle className="w-5 h-5 mx-auto text-amber-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{totalPendentes}</p>
                <p className="text-[10px] text-[#64748B]">Títulos Pendentes</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#E5E7EB] rounded-2xl">
              <CardContent className="p-3 text-center">
                <FileText className="w-5 h-5 mx-auto text-red-600 mb-1" />
                <p className="text-xl font-bold text-[#111827]">{totalOcorrencias}</p>
                <p className="text-[10px] text-[#64748B]">Ocorrências</p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="w-full">
            <TabsList className="bg-[#F8FAFC] border border-[#E5E7EB] p-1 rounded-xl">
              <TabsTrigger value="visao_geral" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#F97316] data-[state=active]:shadow-sm rounded-lg">Visão Geral</TabsTrigger>
              <TabsTrigger value="comparativo" className="text-xs data-[state=active]:bg-white data-[state=active]:text-[#F97316] data-[state=active]:shadow-sm rounded-lg">Comparativo</TabsTrigger>
            </TabsList>

            <TabsContent value="visao_geral" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#64748B]" />
                  <Select value={periodo} onValueChange={(v) => { setPeriodo(v); }}>
                    <SelectTrigger className="w-40 h-8 text-sm bg-white border-[#E5E7EB]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PERIODOS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <Input placeholder="Buscar filial..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8 h-8 text-sm bg-white border-[#E5E7EB]" />
                </div>
              </div>

              {filtered.length === 0 ? (
                <Card className="bg-white border-[#E5E7EB] rounded-2xl">
                  <CardContent className="p-12 text-center">
                    <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-medium text-[#111827] mb-1">Nenhuma filial encontrada</h3>
                    <p className="text-sm text-[#64748B]">Nenhum registro de filial para o período e filtros selecionados.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((filial) => (
                    <Card
                      key={filial.nome}
                      className="bg-white border-[#E5E7EB] hover:border-[#CBD5E1] transition-all cursor-pointer rounded-2xl"
                      onClick={() => abrirDetalhe(filial.nome)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] flex items-center justify-center">
                              <Building2 className="w-5 h-5 text-[#F97316]" />
                            </div>
                            <div>
                              <p className="font-medium text-[#111827] text-sm">{filial.nome}</p>
                              <p className="text-xs text-[#64748B]">{filial.cidade}{filial.uf ? `, ${filial.uf}` : ""}</p>
                            </div>
                          </div>
                          <Badge className={`text-xs ${filial.sla >= 90 ? "bg-emerald-100 text-emerald-700" : filial.sla >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                            SLA {filial.sla}%
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="p-2 bg-[#F8FAFC] rounded-lg">
                            <p className="text-[10px] text-[#64748B]">Operações</p>
                            <p className="text-sm text-[#111827]">{filial.total_os} ({filial.abertas} abertas)</p>
                          </div>
                          <div className="p-2 bg-[#F8FAFC] rounded-lg">
                            <p className="text-[10px] text-[#64748B]">Faturamento</p>
                            <p className="text-sm text-[#111827]">{filial.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}</p>
                          </div>
                          <div className="p-2 bg-[#F8FAFC] rounded-lg">
                            <p className="text-[10px] text-[#64748B]">Pendentes</p>
                            <p className="text-sm text-[#111827]">{filial.pendentes_financeiro}</p>
                          </div>
                          <div className="p-2 bg-[#F8FAFC] rounded-lg">
                            <p className="text-[10px] text-[#64748B]">Ocorrências</p>
                            <p className="text-sm text-[#111827]">{filial.ocorrencias}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-[#64748B]">
                          <span>{filial.contratos_ativos} contrato(s)</span>
                          <span className="flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            {filial.tem_pod} POD
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="comparativo" className="mt-4">
              {comparativo.length === 0 ? (
                <Card className="bg-white border-[#E5E7EB] rounded-2xl">
                  <CardContent className="p-12 text-center">
                    <TrendingUp className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-medium text-[#111827] mb-1">Sem dados comparativos</h3>
                    <p className="text-sm text-[#64748B]">Selecione um período com dados para visualizar a comparação entre filiais.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB]">
                        <th className="text-left py-2 px-3 text-[#64748B] font-medium">Filial</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Operações</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">No Prazo</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Atrasos</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">SLA</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Faturamento</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Ocorrências</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">POD</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Reversas</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Evolução</th>
                        <th className="text-right py-2 px-3 text-[#64748B] font-medium">Contratos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativo.map((f) => (
                        <tr key={f.nome} className="border-b border-[#E5E7EB] hover:bg-[#F8FAFC] cursor-pointer" onClick={() => abrirDetalhe(f.nome)}>
                          <td className="py-2 px-3 font-medium text-[#111827]">{f.nome}</td>
                          <td className="text-right py-2 px-3">{f.total_os}</td>
                          <td className="text-right py-2 px-3 text-emerald-600">{f.entregas_no_prazo}</td>
                          <td className="text-right py-2 px-3 text-red-600">{f.atrasos}</td>
                          <td className="text-right py-2 px-3">
                            <Badge className={`text-[10px] ${f.sla >= 90 ? "bg-emerald-100 text-emerald-700" : f.sla >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                              {f.sla}%
                            </Badge>
                          </td>
                          <td className="text-right py-2 px-3">{f.faturamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}</td>
                          <td className="text-right py-2 px-3">{f.ocorrencias}</td>
                          <td className="text-right py-2 px-3">{f.tem_pod}</td>
                          <td className="text-right py-2 px-3">{f.reversas}</td>
                          <td className="text-right py-2 px-3">
                            <span className={`flex items-center justify-end gap-1 ${f.evolucao_periodo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {f.evolucao_periodo >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {f.evolucao_periodo}%
                            </span>
                          </td>
                          <td className="text-right py-2 px-3">{f.contratos_ativos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <Dialog open={!!selectedFilialNome} onOpenChange={(open) => { if (!open) { setSelectedFilialNome(null); setDetalhe(null); } }}>
        <DialogContent className="max-w-3xl bg-white border-[#E5E7EB] shadow-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-[#111827]">
              <Building2 className="w-5 h-5 text-[#F97316]" />
              {selectedFilialNome}
            </DialogTitle>
          </DialogHeader>

          {loadingDetalhe ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-slate-200 animate-pulse rounded w-full" />)}
            </div>
          ) : detalhe ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] text-[#64748B]">Operações</p>
                  <p className="text-lg font-bold text-[#111827]">{detalhe.resumo.total_os}</p>
                  <p className="text-xs text-[#64748B]">{detalhe.resumo.abertas} abertas / {detalhe.resumo.concluidas} concluídas</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] text-[#64748B]">SLA</p>
                  <p className={`text-lg font-bold ${detalhe.resumo.sla >= 90 ? "text-emerald-600" : detalhe.resumo.sla >= 70 ? "text-amber-600" : "text-red-600"}`}>
                    {detalhe.resumo.sla}%
                  </p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] text-[#64748B]">Faturamento</p>
                  <p className="text-lg font-bold text-[#111827]">{detalhe.financeiro.faturado.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}</p>
                </div>
                <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] text-[#64748B]">A Receber</p>
                  <p className="text-lg font-bold text-amber-600">{detalhe.financeiro.a_receber.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 })}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <div>
                  <p className="text-[10px] text-[#64748B]">PODs</p>
                  <p className="text-sm text-[#111827]">{detalhe.pods}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">Contratos Ativos</p>
                  <p className="text-sm text-[#111827]">{detalhe.contratos}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">Títulos Pendentes</p>
                  <p className="text-sm text-[#111827]">{detalhe.financeiro.pendente} ({detalhe.financeiro.vencido} vencidos)</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#64748B]">Ocorrências</p>
                  <p className="text-sm text-[#111827]">{detalhe.ocorrencias.length}</p>
                </div>
              </div>

              {detalhe.operacoes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Operações ({detalhe.operacoes.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {detalhe.operacoes.slice(0, 20).map((op) => (
                      <div key={op.id} className="p-2 bg-white border border-[#E5E7EB] rounded-lg flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-[#64748B]" />
                          <span className="font-medium text-[#111827]">#{op.numero}</span>
                          <span className="text-[#64748B]">{op.origem} → {op.destino}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-[10px] ${op.status === "entregue" || op.status === "finalizada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {op.status}
                          </Badge>
                          {op.valor > 0 && <span className="text-[#64748B]">{op.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detalhe.financeiro.pendente > 0 && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    {detalhe.financeiro.pendente} título(s) pendente(s) ({detalhe.financeiro.vencido} vencido(s)) — {detalhe.financeiro.a_receber.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>
              )}

              {detalhe.ocorrencias.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#64748B] uppercase mb-2">Últimas Ocorrências</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {detalhe.ocorrencias.slice(0, 10).map((oc) => (
                      <div key={oc.id} className="p-2 bg-red-50 rounded-lg border border-red-100">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-red-800">{oc.tipo}</p>
                          <p className="text-[10px] text-[#64748B]">{new Date(oc.data).toLocaleDateString("pt-BR")}</p>
                        </div>
                        {oc.descricao && <p className="text-xs text-red-700 mt-1">{oc.descricao}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#64748B] py-4 text-center">Não foi possível carregar os detalhes da filial.</p>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => { setSelectedFilialNome(null); setDetalhe(null); }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
