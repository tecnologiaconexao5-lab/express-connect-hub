import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Car, Wrench, Fuel, FileText, Shield, PieChart, Plus, CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listarVeiculos, listarManutencoes, listarAbastecimentos, obterMetricasFrota, listarCustosVeiculo, type VeiculoFrota, type DespesaOperacional, type MetricasFrota, type CustoVeiculo } from "@/services/frota/frotaService";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_VEICULO_MAP: Record<string, { label: string; color: string }> = {
  ativo: { label: "Ativo", color: "text-green-600" },
  inativo: { label: "Inativo", color: "text-gray-500" },
  manutencao: { label: "Em Manutenção", color: "text-orange-600" },
  bloqueado: { label: "Bloqueado", color: "text-red-600" },
};

export default function Frota() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "manutencao";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [veiculos, setVeiculos] = useState<VeiculoFrota[]>([]);
  const [manutencoes, setManutencoes] = useState<DespesaOperacional[]>([]);
  const [abastecimentos, setAbastecimentos] = useState<DespesaOperacional[]>([]);
  const [metricas, setMetricas] = useState<MetricasFrota | null>(null);
  const [custos, setCustos] = useState<CustoVeiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setLoading(true);
    setError(null);
    try {
      const [v, manut, abast, metr, cust] = await Promise.all([
        listarVeiculos().catch(() => [] as VeiculoFrota[]),
        listarManutencoes().catch(() => [] as DespesaOperacional[]),
        listarAbastecimentos().catch(() => [] as DespesaOperacional[]),
        obterMetricasFrota().catch(() => null),
        listarCustosVeiculo().catch(() => [] as CustoVeiculo[]),
      ]);
      setVeiculos(v);
      setManutencoes(manut);
      setAbastecimentos(abast);
      setMetricas(metr);
      setCustos(cust);
    } catch (err) {
      setError("Erro ao carregar dados da frota");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <ProgressiveBlocksLoader size="page" />;
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Car className="w-8 h-8 text-primary" /> Gestão de Frota e Veículos
          </h1>
          <p className="text-muted-foreground">Controle, custos e abastecimento da frota.</p>
        </div>
        <Button variant="outline" size="sm" onClick={carregarDados}>
          Atualizar Dados
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Metricas cards */}
      {metricas && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card><CardContent className="p-3 text-center"><p className="text-xs font-bold text-slate-500 uppercase">Veículos</p><p className="text-xl font-bold mt-0.5">{metricas.total_veiculos}</p><p className="text-[10px] text-green-600">{metricas.veiculos_ativos} ativos</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs font-bold text-slate-500 uppercase">Em Manutenção</p><p className="text-xl font-bold mt-0.5 text-orange-600">{metricas.veiculos_manutencao}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs font-bold text-slate-500 uppercase">Combustível (mês)</p><p className="text-lg font-bold mt-0.5 text-orange-600">{fmtFin(metricas.gasto_combustivel_mes)}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs font-bold text-slate-500 uppercase">Manutenção (mês)</p><p className="text-lg font-bold mt-0.5 text-blue-600">{fmtFin(metricas.gasto_manutencao_mes)}</p></CardContent></Card>
          <Card><CardContent className="p-3 text-center"><p className="text-xs font-bold text-slate-500 uppercase">Gasto Total (mês)</p><p className="text-lg font-bold mt-0.5 text-red-600">{fmtFin(metricas.gasto_total_mes)}</p></CardContent></Card>
        </div>
      )}

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 justify-start overflow-x-auto flex-wrap">
          <TabsTrigger value="manutencao" className="gap-2"><Wrench className="w-4 h-4"/>Manutenção</TabsTrigger>
          <TabsTrigger value="abastecimento" className="gap-2"><Fuel className="w-4 h-4"/>Abastecimento</TabsTrigger>
          <TabsTrigger value="documentos" className="gap-2"><FileText className="w-4 h-4"/>Documentos</TabsTrigger>
          <TabsTrigger value="seguros" className="gap-2"><Shield className="w-4 h-4"/>Seguros</TabsTrigger>
          <TabsTrigger value="custos" className="gap-2"><PieChart className="w-4 h-4"/>Custos por Veículo</TabsTrigger>
        </TabsList>

        {/* MANUTENCAO */}
        <TabsContent value="manutencao" className="pt-2">
          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Histórico de Manutenções</CardTitle><CardDescription>Registros de despesas de manutenção da frota.</CardDescription></div>
              <Button className="bg-blue-600" disabled><Plus className="w-4 h-4 mr-1"/> Nova OS Oficina</Button>
            </CardHeader>
            <CardContent className="p-0">
              {manutencoes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum registro de manutenção encontrado.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {manutencoes.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-bold">{m.placa || "N/I"}</TableCell>
                        <TableCell><Badge variant="outline" className="border-blue-200 text-blue-700">{m.subcategoria || "Geral"}</Badge></TableCell>
                        <TableCell className="text-sm">{m.descricao}</TableCell>
                        <TableCell>{new Date(m.data_competencia).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-medium text-red-600">{fmtFin(m.valor)}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold flex items-center gap-1 ${m.status === "pago" ? "text-green-600" : "text-orange-600"}`}>
                            {m.status === "pago" ? <><CheckCircle className="w-3 h-3"/> Pago</> : <><AlertTriangle className="w-3 h-3"/> {m.status}</>}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABASTECIMENTO */}
        <TabsContent value="abastecimento" className="pt-2">
          {metricas && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card className="border-l-4 border-l-orange-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Gasto em Abastecimento (Mês)</p><p className="text-2xl font-bold mt-1 text-orange-600">{fmtFin(metricas.gasto_combustivel_mes)}</p></CardContent></Card>
              <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Veículos Ativos</p><p className="text-2xl font-bold mt-1 text-blue-600">{metricas.veiculos_ativos}</p></CardContent></Card>
              <Card className="border-l-4 border-l-green-500"><CardContent className="p-4"><p className="text-sm font-bold text-slate-500 uppercase">Gasto Total (Mês)</p><p className="text-2xl font-bold mt-1 text-green-600">{fmtFin(metricas.gasto_total_mes)}</p></CardContent></Card>
            </div>
          )}
          <Card>
            <CardHeader className="flex flex-row justify-between items-center py-4">
              <div><CardTitle>Registros de Abastecimento</CardTitle></div>
              <Button variant="outline" disabled><Plus className="w-4 h-4 mr-1"/> Lançar Cupom Fiscal</Button>
            </CardHeader>
            <CardContent className="p-0">
              {abastecimentos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum registro de abastecimento encontrado.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Veículo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {abastecimentos.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{new Date(a.data_competencia).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="font-bold">{a.placa || "N/I"}</TableCell>
                        <TableCell className="text-sm">{a.descricao}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">{fmtFin(a.valor)}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-bold ${a.status === "pago" ? "text-green-600" : "text-orange-600"}`}>{a.status}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* DOCUMENTOS */}
        <TabsContent value="documentos" className="pt-2">
          <Card>
            <CardHeader className="py-4">
              <CardTitle>Vencimentos Centralizados e CRLV</CardTitle>
              <CardDescription>Documentos dos veículos da frota.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {veiculos.filter(v => v.validade_documental).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum documento registrado para os veículos.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Placa</TableHead><TableHead>Vencimento</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {veiculos.filter(v => v.validade_documental).map((v) => {
                      const venc = new Date(v.validade_documental!);
                      const hoje = new Date();
                      const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      const statusDoc = diasRestantes < 0 ? "vencido" : diasRestantes < 30 ? "proximo" : "em_dia";
                      return (
                        <TableRow key={v.id} className={statusDoc === "proximo" ? "bg-orange-50/50" : ""}>
                          <TableCell className="font-bold">{v.marca} {v.modelo}</TableCell>
                          <TableCell>{v.placa}</TableCell>
                          <TableCell className={statusDoc === "vencido" ? "text-red-600 font-bold" : ""}>
                            {venc.toLocaleDateString("pt-BR")}
                            {statusDoc === "proximo" && <span className="ml-2 text-xs text-orange-600">({diasRestantes}d)</span>}
                          </TableCell>
                          <TableCell>
                            {statusDoc === "em_dia" && <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Em dia</Badge>}
                            {statusDoc === "proximo" && <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300"><AlertTriangle className="w-3 h-3 mr-1"/>Vence em {diasRestantes}d</Badge>}
                            {statusDoc === "vencido" && <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1"/>Vencido</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEGUROS */}
        <TabsContent value="seguros" className="pt-2">
          <Card>
            <CardHeader className="py-4 justify-between flex flex-row">
              <div><CardTitle>Apólices de Seguro</CardTitle><CardDescription>Seguros registrados por veículo.</CardDescription></div>
              <Button className="bg-blue-600" disabled><Plus className="w-4 h-4 mr-1"/> Adicionar Apólice</Button>
            </CardHeader>
            <CardContent className="p-0">
              {veiculos.filter(v => v.seguro_apolice).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma apólice de seguro registrada.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Veículo</TableHead><TableHead>Placa</TableHead><TableHead>Apólice</TableHead><TableHead>Rastreador</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {veiculos.filter(v => v.seguro_apolice).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-bold">{v.marca} {v.modelo}</TableCell>
                        <TableCell>{v.placa}</TableCell>
                        <TableCell className="font-mono text-sm">{v.seguro_apolice}</TableCell>
                        <TableCell>{v.rastreador || "N/I"}</TableCell>
                        <TableCell><span className={`text-sm font-bold flex items-center gap-1 ${STATUS_VEICULO_MAP[v.status]?.color || ""}`}>{STATUS_VEICULO_MAP[v.status]?.label || v.status}</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CUSTOS */}
        <TabsContent value="custos" className="pt-2">
          <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center py-6">
              <PieChart className="w-12 h-12 mx-auto mb-3 text-purple-600" />
              <CardTitle className="text-xl">Custos por Veículo</CardTitle>
              <CardDescription>Despesas operacionais agregadas por veículo.</CardDescription>
            </CardHeader>
            <CardContent>
              {custos.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum custo registrado para os veículos.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow>
                    <TableHead>Placa</TableHead><TableHead className="text-right">Combustível</TableHead>
                    <TableHead className="text-right">Manutenções</TableHead><TableHead className="text-right">Outros</TableHead>
                    <TableHead className="text-right bg-red-50 font-bold">CUSTO TOTAL</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {custos.map((c) => (
                      <TableRow key={c.veiculo_id}>
                        <TableCell className="font-bold text-slate-700">{c.placa}</TableCell>
                        <TableCell className="text-right">{fmtFin(c.total_combustivel)}</TableCell>
                        <TableCell className="text-right">{fmtFin(c.total_manutencao)}</TableCell>
                        <TableCell className="text-right">{fmtFin(c.total_outros)}</TableCell>
                        <TableCell className="text-right bg-red-50 text-red-600 font-black">{fmtFin(c.total_geral)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
