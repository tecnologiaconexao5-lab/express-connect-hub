import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Download, RefreshCw, FileText, Truck, Calendar, MapPin, Clock, DollarSign,
  ChevronDown, ChevronUp, Snowflake
} from "lucide-react";
import { toast } from "sonner";
import { exportClienteAgregadoRefrigeradoToExcel } from "@/utils/excelExport";
import { gerarPDFRelatorioOperacional } from "@/utils/pdfRelatorioOperacional";

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v: number) => (v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtData = (d: string) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "-";
const fmtHora = (h: string) => h ? h.slice(0, 5) : "-";

interface LinhaRelatorio {
  id: string;
  data_viagem: string;
  numero_oc: string;
  placa: string;
  tipo_veiculo: string;
 motorista: string;
  observacao: string;
  horario_chegada: string;
  horario_saida: string;
  diaria: number;
  diaria_formatada: string;
  km_total: number;
  km_excedente: number;
  vlr_km: number;
  vlr_km_formatado: string;
  vlr_total: number;
  vlr_total_formatado: string;
  obs: string;
  cliente_id: string;
  prestador_id: string;
  cliente_nome: string;
  prestador_nome: string;
  regra_especial: boolean;
}

interface TabelaValores {
  id: string;
  valor_base: number;
  valor_km: number;
  km_franquia: number;
  tipo_veiculo: string;
  cliente_id: string;
  universal: boolean;
}

interface Prestador {
  id: string;
  nome: string;
  cpf_cnpj: string;
  veiculo_tipo: string;
}

interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social: string;
}

export default function RelatorioClienteAgregadoRefrigerado() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<LinhaRelatorio[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [tabelaValores, setTabelaValores] = useState<TabelaValores | null>(null);
  const [filtroAberto, setFiltroAberto] = useState(true);
  const [regraEspecialAtiva, setRegraEspecialAtiva] = useState(false);

  const [filtros, setFiltros] = useState({
    dataInicial: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    dataFinal: new Date().toISOString().split("T")[0],
    cliente: "",
    prestador: "",
  });

  const carregarClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social")
      .eq("status", "ativo")
      .order("nome_fantasia", { ascending: true })
      .limit(100);
    
    if (!error && data) {
      setClientes(data);
    }
  }, []);

  const carregarPrestadores = useCallback(async () => {
    const { data, error } = await supabase
      .from("prestadores")
      .select("id, nome, cpf_cnpj, veiculo_tipo")
      .eq("status", "ativo")
      .order("nome", { ascending: true })
      .limit(100);
    
    if (!error && data) {
      setPrestadores(data);
    }
  }, []);

  const buscarTabelaValores = useCallback(async (clienteId: string) => {
    const { data, error } = await supabase
      .from("tabelas_valores")
      .select("id, valor_base, valor_km, km_franquia, tipo_veiculo, cliente_id, universal")
      .eq("cliente_id", clienteId)
      .eq("tipo_veiculo", "hr")
      .single();

    if (!error && data) {
      setTabelaValores(data);
      setRegraEspecialAtiva(true);
      return data;
    }

    const { data: universalData } = await supabase
      .from("tabelas_valores")
      .select("id, valor_base, valor_km, km_franquia, tipo_veiculo, cliente_id, universal")
      .eq("universal", true)
      .eq("tipo_veiculo", "hr")
      .single();

    if (universalData) {
      setTabelaValores(universalData);
      setRegraEspecialAtiva(false);
      return universalData;
    }

    setTabelaValores(null);
    setRegraEspecialAtiva(false);
    return null;
  }, []);

  const carregarDados = useCallback(async () => {
    if (!filtros.cliente || !filtros.prestador) {
      toast.error("Selecione o cliente e o prestador");
      return;
    }

    setLoading(true);
    try {
      const tabela = await buscarTabelaValores(filtros.cliente);
      
      const { data: ordens, error: ordensError } = await supabase
        .from("ordens_servico")
        .select(`
          id,
          numero,
          data_coleta,
          data_finalizacao,
          placa,
          tipo_veiculo,
          prestador_id,
          cliente_id,
          km_previsto,
          valor_total,
          valor_prestador,
          dados_app_prestador
        `)
        .eq("cliente_id", filtros.cliente)
        .eq("prestador_id", filtros.prestador)
        .gte("data_coleta", filtros.dataInicial)
        .lte("data_coleta", filtros.dataFinal)
        .in("status", ["finalizada", "concluida", "entregue"])
        .order("data_coleta", { ascending: true });

      if (ordensError) throw ordensError;

      const linhas: LinhaRelatorio[] = (ordens || []).map((os: any) => {
        const dadosApp = os.dados_app_prestador || {};
        const horaSaida = dadosApp.hora_saida || dadosApp.horario_saida || "";
        const horaChegada = dadosApp.hora_chegada || dadosApp.horario_chegada || "";
        
        const kmTotal = os.km_previsto || 0;
        const diariaBase = tabela?.valor_base || 400;
        const kmFranquia = tabela?.km_franquia || 200;
        const valorKm = tabela?.valor_km || 2.50;
        
        const horaNum = horaSaida ? parseInt(horaSaida.split(":")[0]) : 0;
        let diariaCalc = diariaBase;
        let observacao = "";
        
        if (regraEspecialAtiva) {
          if (horaNum <= 11) {
            diariaCalc = diariaBase;
            observacao = "SAÍDA ATÉ 11:00 = DIÁRIA BASE";
          } else if (horaNum <= 14) {
            diariaCalc = diariaBase * 1.50;
            observacao = `50% = ${fmtBRL(diariaCalc)}`;
          } else if (horaNum <= 16) {
            diariaCalc = diariaBase * 1.70;
            observacao = `70% = ${fmtBRL(diariaCalc)}`;
          } else {
            diariaCalc = diariaBase * 1.85;
            observacao = `85% = ${fmtBRL(diariaCalc)}`;
          }
          
          if (dadosApp.observacao?.includes("entregas dia anterior") || dadosApp.observacao?.includes("TÉRMINO")) {
            observacao = "TÉRMINO DAS ENTREGAS DO DIA ANTERIOR";
            diariaCalc = diariaBase * 0.50;
          }
        } else {
          diariaCalc = diariaBase;
        }
        
        const kmExcedente = Math.max(kmTotal - kmFranquia, 0);
        const valorKmExcedente = kmExcedente * valorKm;
        const valorTotal = diariaCalc + valorKmExcedente;

        const clienteNome = clientes.find(c => c.id === filtros.cliente)?.nome_fantasia || "N/D";
        const prestadorNome = prestadores.find(p => p.id === filtros.prestador)?.nome || "N/D";

        return {
          id: os.id,
          data_viagem: os.data_coleta,
          numero_oc: os.numero,
          placa: os.placa || "-",
          tipo_veiculo: os.tipo_veiculo || "-",
          motorista: prestadorNome,
          observacao: observacao,
          horario_chegada: horaChegada,
          horario_saida: horaSaida,
          diaria: diariaCalc,
          diaria_formatada: fmtBRL(diariaCalc),
          km_total: kmTotal,
          km_excedente: kmExcedente,
          vlr_km: valorKmExcedente,
          vlr_km_formatado: fmtBRL(valorKmExcedente),
          vlr_total: valorTotal,
          vlr_total_formatado: fmtBRL(valorTotal),
          obs: dadosApp.observacao || "-",
          cliente_id: os.cliente_id,
          prestador_id: os.prestador_id,
          cliente_nome: clienteNome,
          prestador_nome: prestadorNome,
          regra_especial: regraEspecialAtiva,
        };
      });

      setDados(linhas);
      toast.success(`${linhas.length} operações encontradas`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [filtros, clientes, prestadores, regraEspecialAtiva, buscarTabelaValores]);

  useState(() => {
    carregarClientes();
    carregarPrestadores();
  });

  const totais = {
    diaria: dados.reduce((s, d) => s + d.diaria, 0),
    kmExcedente: dados.reduce((s, d) => s + d.km_excedente, 0),
    vlrKm: dados.reduce((s, d) => s + d.vlr_km, 0),
    vlrTotal: dados.reduce((s, d) => s + d.vlr_total, 0),
  };

  const handleExportExcel = () => {
    if (dados.length === 0) return toast.error("Sem dados para exportar");
    try {
      const clienteNome = clientes.find(c => c.id === filtros.cliente)?.nome_fantasia || "";
      const prestadorNome = prestadores.find(p => p.id === filtros.prestador)?.nome || "";
      exportClienteAgregadoRefrigeradoToExcel(
        dados,
        clienteNome,
        prestadorNome,
        `${filtros.dataInicial}_a_${filtros.dataFinal}`
      );
      toast.success("Excel gerado com sucesso");
    } catch {
      toast.error("Erro ao gerar Excel");
    }
  };

  const clienteSelecionado = clientes.find(c => c.id === filtros.cliente);
  const prestadorSelecionado = prestadores.find(p => p.id === filtros.prestador);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center shadow-sm">
            <Snowflake className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Relatório Cliente — Agregado Refrigerado</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cálculo automático com diária progressiva e km excedente
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading || dados.length === 0}>
            <FileText className="w-4 h-4 mr-1.5" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || dados.length === 0}
            onClick={() => {
              gerarPDFRelatorioOperacional({
                titulo: "Relatório Cliente — Agregado Refrigerado",
                colunas: ["Data", "Nº OC", "Placa", "Motorista", "Saída", "Diária", "KM Total", "KM Exc.", "Vlr KM", "Vlr Total"],
                linhas: dados.map(d => [
                  fmtData(d.data_viagem),
                  d.numero_oc,
                  d.placa,
                  d.motorista,
                  fmtHora(d.horario_saida),
                  d.diaria_formatada,
                  String(d.km_total),
                  String(d.km_excedente),
                  d.vlr_km_formatado,
                  d.vlr_total_formatado,
                ]),
                subtitulo: `Cliente: ${clienteSelecionado?.nome_fantasia || "-"} | Motorista: ${prestadorSelecionado?.nome || "-"} | ${filtros.dataInicial} a ${filtros.dataFinal}`,
              });
              toast.success("PDF gerado com sucesso!");
            }}
          >
            <Download className="w-4 h-4 mr-1.5" /> PDF
          </Button>
        </div>
      </div>

      {regraEspecialAtiva && (
        <Card className="border-cyan-200 bg-cyan-50 dark:bg-cyan-900/20">
          <CardContent className="p-3 flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-cyan-600" />
            <span className="text-xs font-medium text-cyan-800 dark:text-cyan-300">
              Regra especial ativa para este cliente (HR Refrigerado: {fmtBRL(tabelaValores?.valor_base || 400)} base)
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm">
        <div className="flex items-center justify-between p-4 cursor-pointer select-none" onClick={() => setFiltroAberto(!filtroAberto)}>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Filtros</span>
          </div>
          <Button variant="ghost" size="sm" className="p-1 h-auto">
            {filtroAberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
        {filtroAberto && (
          <CardContent className="pt-0 pb-4 px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Período Inicial</Label>
                <Input type="date" value={filtros.dataInicial} onChange={(e) => setFiltros({ ...filtros, dataInicial: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Período Final</Label>
                <Input type="date" value={filtros.dataFinal} onChange={(e) => setFiltros({ ...filtros, dataFinal: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Cliente</Label>
                <Select value={filtros.cliente} onValueChange={(v) => setFiltros({ ...filtros, cliente: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Prestador / Motorista</Label>
                <Select value={filtros.prestador} onValueChange={(v) => setFiltros({ ...filtros, prestador: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {prestadores.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs gap-1" onClick={carregarDados} disabled={loading}>
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Carregando..." : "Buscar"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {clienteSelecionado && prestadorSelecionado && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Diárias</p>
              <p className="text-lg font-bold text-cyan-600">{fmtBRL(totais.diaria)}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">KM Excedente</p>
              <p className="text-lg font-bold text-orange-600">{fmtNum(totais.kmExcedente)}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Valor KM</p>
              <p className="text-lg font-bold text-blue-600">{fmtBRL(totais.vlrKm)}</p>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Geral</p>
              <p className="text-lg font-bold text-emerald-600">{fmtBRL(totais.vlrTotal)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {[
                  "DATA", "Nº OC", "PLACA", "TIPO", "MOTORISTA", "CHEGADA", "SAÍDA",
                  "DIÁRIA", "KM TOT", "KM EXC", "VLR KM", "VLR TOTAL"
                ].map((h) => (
                  <TableHead key={h} className="text-[10px] font-semibold uppercase whitespace-nowrap">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" />
                  </TableCell>
                </TableRow>
              ) : dados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    Selecione cliente e prestador, depois clique em "Buscar"
                  </TableCell>
                </TableRow>
              ) : (
                dados.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/40 transition-colors border-b border-border/50">
                    <TableCell className="text-xs font-medium whitespace-nowrap">{fmtData(d.data_viagem)}</TableCell>
                    <TableCell className="text-xs font-mono">{d.numero_oc}</TableCell>
                    <TableCell className="text-xs font-medium">{d.placa}</TableCell>
                    <TableCell className="text-xs">{d.tipo_veiculo}</TableCell>
                    <TableCell className="text-xs">{d.motorista}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtHora(d.horario_chegada)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{fmtHora(d.horario_saida)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold text-cyan-600">{d.diaria_formatada}</TableCell>
                    <TableCell className="text-xs text-right">{d.km_total}</TableCell>
                    <TableCell className="text-xs text-right text-orange-600">{d.km_excedente}</TableCell>
                    <TableCell className="text-xs text-right">{d.vlr_km_formatado}</TableCell>
                    <TableCell className="text-xs text-right font-bold text-emerald-600">{d.vlr_total_formatado}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}