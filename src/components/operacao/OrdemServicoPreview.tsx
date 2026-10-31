import { useRef, useState, useEffect } from "react";
import { ArrowLeft, Download, FileText, Truck, MapPin, Package, Phone, Mail, Copy as CopyIcon, Send, Printer, Clock, User, Users, DollarSign, TrendingDown, Activity, Calendar, Route, CopyPlus, FileSpreadsheet, Stamp, ShieldCheck, AlertTriangle, Eye, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { gerarMensagemWhatsAppOS, generatePDFCliente, generatePDFPrestador } from "@/lib/pdfGenerator";
import { enviarMensagem as WhatsAppEnviar } from "@/services/integracoes/whatsappService";
import type { OrdemServico, OSEndereco, OSCarga, OSStatus } from "./osTypes";
import { STATUS_CORES, obterStatusGlobalOS } from "./osTypes";
import { HistoricoOS, type HistoricoOSItem } from "./HistoricoOS";
import { STATUS_GLOBAL_INFO } from "./statusGlobal";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/formatDates";
import { clienteVeioDeCotacao } from "@/lib/clienteCotacao";
import { obterAgendamentoClienteOS } from "@/lib/cotacaoOS";
import { ehCadastroIncompletoCliente, ehCadastroIncompletoPrestador } from "@/lib/cadastroRapido";
import { BadgeCadastroIncompleto } from "@/components/ui/BadgeCadastroIncompleto";

interface Props {
  os: OrdemServico;
  onVoltar: () => void;
}

const PASSOS_RASTREIO = [
  { key: "pendente", label: "Pendente", icon: Clock },
  { key: "alocado", label: "Alocado", icon: User },
  { key: "coletado", label: "Coletado", icon: Package },
  { key: "transito", label: "Em Trânsito", icon: Truck },
  { key: "entregue", label: "Entregue", icon: MapPin },
] as const;

/** Índice do passo atual no rastreio (0..4). -1 = cancelada. */
function indiceRastreio(status?: string): number {
  const s = (status || "").toLowerCase();
  if (s === "cancelada" || s === "cancelado") return -1;
  if (["entregue", "finalizada", "finalizado", "faturada", "paga", "concluida"].includes(s)) return 4;
  if (["em_rota", "em_transito", "em_transito", "ocorrencia", "saiu_para_entrega", "em_entrega"].includes(s)) return 3;
  if (["coletado", "coletada", "carregando", "em_andamento", "em_execucao"].includes(s)) return 2;
  if (["agendada", "agendado", "alocada", "alocado", "programada"].includes(s)) return 1;
  return 0;
}

function TimelineRastreio({ status }: { status?: string }) {
  const idx = indiceRastreio(status);
  const cancelada = idx < 0;
  const atual = cancelada ? "Cancelada" : PASSOS_RASTREIO[idx]?.label || "Pendente";

  return (
    <Card className="overflow-hidden border-none shadow-md rounded-2xl">
      <CardContent className="p-0">
        <div className="flex flex-col gap-2 border-b border-orange-100 bg-gradient-to-r from-orange-50 via-amber-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">Rastreio da operação</p>
            <h2 className="text-lg font-black text-slate-800">Linha do tempo</h2>
          </div>
          <span
            className={cn(
              "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide",
              cancelada ? "bg-red-100 text-red-700" : "bg-orange-500 text-white shadow-sm shadow-orange-500/30",
            )}
          >
            {cancelada ? <AlertTriangle className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
            {atual}
          </span>
        </div>
        <div className="overflow-x-auto px-4 pb-5 pt-6">
          <div className="flex min-w-[620px] items-start">
            {PASSOS_RASTREIO.map((passo, i) => {
              const concluido = !cancelada && i < idx;
              const ativo = !cancelada && i === idx;
              const Icone = passo.icon;
              return (
                <div key={passo.key} className="flex flex-1 items-start last:flex-none">
                  <div className="flex w-24 flex-col items-center gap-2 text-center">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                        concluido && "border-emerald-500 bg-emerald-500 text-white",
                        ativo && "border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100",
                        !concluido && !ativo && "border-slate-200 bg-white text-slate-400",
                      )}
                    >
                      {concluido ? <Check className="h-5 w-5" /> : <Icone className="h-5 w-5" />}
                    </div>
                    <span
                      className={cn(
                        "text-[11px] font-bold leading-tight",
                        ativo ? "text-orange-700" : concluido ? "text-emerald-700" : "text-slate-400",
                      )}
                    >
                      {passo.label}
                    </span>
                    {ativo && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
                        Atual
                      </span>
                    )}
                  </div>
                  {i < PASSOS_RASTREIO.length - 1 && (
                    <div
                      className={cn(
                        "mt-5 h-1 flex-1 rounded-full",
                        concluido ? "bg-emerald-400" : "bg-slate-200",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrdemServicoPreview({ os, onVoltar }: Props) {
  const [fiscalData, setFiscalData] = useState<any>({ ctes: [], mdfes: [], nfses: [], xmls: [], timeline: [] });
  const [fiscalLoading, setFiscalLoading] = useState(true);
  // FIX UUID — resolve nome do prestador/cliente quando o registro traz o id.
  const [nomesResolvidos, setNomesResolvidos] = useState<{ prestador?: string; cliente?: string; prestadorIncompleto?: boolean; clienteIncompleto?: boolean }>({});

  useEffect(() => {
    const ehUuid = (v?: string) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));
    let ativo = true;
    (async () => {
      const consultas: PromiseLike<void>[] = [];
      if (ehUuid(os.prestador)) {
        consultas.push(
          supabase
            .from("prestadores")
            .select("nome_completo, metadata, origem, cpf_cnpj, telefone, whatsapp")
            .eq("id", os.prestador)
            .maybeSingle()
            .then(({ data }) => {
              const row = data as { nome_completo?: string } | null;
              const nome = row?.nome_completo;
              if (ativo && nome) setNomesResolvidos((prev) => ({ ...prev, prestador: nome, prestadorIncompleto: ehCadastroIncompletoPrestador(row) }));
            }),
        );
      }
      if (ehUuid(os.cliente)) {
        consultas.push(
          supabase
            .from("clientes")
            .select("nome_fantasia, razao_social, status, origem_comercial, cnpj")
            .eq("id", os.cliente)
            .maybeSingle()
            .then(({ data }) => {
              const row = data as { nome_fantasia?: string; razao_social?: string } | null;
              const nome = row?.nome_fantasia || row?.razao_social;
              if (ativo && nome) setNomesResolvidos((prev) => ({ ...prev, cliente: nome, clienteIncompleto: ehCadastroIncompletoCliente(row) }));
            }),
        );
      }
      await Promise.all(consultas);
    })();
    return () => { ativo = false; };
  }, [os.prestador, os.cliente]);

  const ehUuidTexto = (v?: string) => Boolean(v && /^[0-9a-f-]{36}$/i.test(v));
  const prestadorNome = nomesResolvidos.prestador || (ehUuidTexto(os.prestador) ? "" : os.prestador || "");
  const clienteNome = nomesResolvidos.cliente || (ehUuidTexto(os.cliente) ? "" : os.cliente || "");
  const clienteCotacao = clienteVeioDeCotacao({
    origemCotacao: (os.carga as { origem_cotacao?: unknown } | undefined)?.origem_cotacao,
    observacoes: os.observacoesGerais,
  });
  // Agendamento vindo da cotação (data/hora desejadas) — extraído de carga/observações.
  const agendamentoCotacao = obterAgendamentoClienteOS({
    carga: os.carga,
    observacoes: os.observacoesGerais,
  });

  useEffect(function() {
    if (!os?.id) { setFiscalLoading(false); return; }
    fetchFiscalData();
  }, [os?.id]);

  const fetchFiscalData = async function() {
    setFiscalLoading(true);
    const [ctesRes, nfsesRes, xmlsRes, eventsRes, historicoRes] = await Promise.all([
      supabase.from("fiscal_ctes").select("*").eq("ordem_servico_id", os.id).order("created_at",{ascending:false}),
      supabase.from("fiscal_nfse").select("*").eq("ordem_servico_id", os.id).order("created_at",{ascending:false}),
      supabase.from("fiscal_documentos_vinculados").select("*").eq("ordem_servico_id", os.id),
      supabase.from("fiscal_events").select("*").eq("documento_id", os.id).order("created_at",{ascending:false}).limit(20),
      supabase.from("fiscal_historico_status").select("*").eq("documento_id", os.id).order("created_at",{ascending:false}).limit(10),
    ]);

    const ctes = ctesRes.data || [];
    const nfses = nfsesRes.data || [];
    const xmls = xmlsRes.data || [];

    // Buscar MDF-es que contenham CT-es desta OS
    let mdfes: any[] = [];
    if (ctes.length > 0) {
      const cteIds = ctes.map(function(c:any){return c.id;});
      const { data: allMdfes } = await supabase.from("fiscal_mdfes").select("*").order("created_at",{ascending:false});
      mdfes = (allMdfes || []).filter(function(m:any){
        const vinc = m.metadata?.ctes_vinculados || [];
        return vinc.some(function(v:any){return cteIds.includes(v.cte_id);});
      });
    }

    // Montar timeline
    const timeline: any[] = [];
    for (const e of eventsRes.data || []) {
      timeline.push({ data: e.created_at, tipo: e.tipo_evento, desc: e.descricao, origem: "evento" });
    }
    for (const h of historicoRes.data || []) {
      timeline.push({ data: h.created_at, tipo: "STATUS", desc: (h.status_anterior||"?")+" → "+h.status_novo, origem: "historico" });
    }
    if (xmls.length > 0) {
      for (const x of xmls) {
        timeline.push({ data: x.created_at, tipo: "XML_IMPORTADO", desc: "XML NF-e importado: "+(x.emitente_nome||x.id?.substring(0,8)), origem: "xml" });
      }
    }
    timeline.sort(function(a:any,b:any){return new Date(b.data).getTime() - new Date(a.data).getTime();});

    setFiscalData({ ctes, mdfes, nfses, xmls, timeline });
    setFiscalLoading(false);
  };

  const semaforo = (function() {
    const enderecos = Array.isArray(os.enderecos) ? os.enderecos : [];
    let cidadeOrigem: string | null = null, ufOrigem: string | null = null;
    let cidadeDestino: string | null = null, ufDestino: string | null = null;
    for (const e of enderecos) {
      const t = (e.tipo||"").toLowerCase();
      if (t.includes("origem")||t.includes("coleta")||t.includes("retirada")) {
        if (!cidadeOrigem) { cidadeOrigem = e.cidade||null; ufOrigem = e.uf||null; }
      } else if (t.includes("destino")||t.includes("entrega")) {
        if (!cidadeDestino) { cidadeDestino = e.cidade||null; ufDestino = e.uf||null; }
      }
    }
    if (!cidadeOrigem && enderecos.length>=1) { cidadeOrigem = enderecos[0].cidade||null; ufOrigem = enderecos[0].uf||null; }
    if (!cidadeDestino && enderecos.length>=2) { cidadeDestino = enderecos[1].cidade||null; ufDestino = enderecos[1].uf||null; }

    let classificacao = "indefinido";
    let exige_cte = false, exige_mdfe = false, exige_nfse = false;

    if (cidadeOrigem && ufOrigem && cidadeDestino && ufDestino) {
      const mesmoMunicipio = cidadeOrigem.toUpperCase() === cidadeDestino.toUpperCase();
      const mesmaUf = ufOrigem === ufDestino;
      if (mesmoMunicipio && mesmaUf) { classificacao = "municipal"; exige_cte = false; exige_mdfe = false; exige_nfse = true; }
      else if (mesmaUf) { classificacao = "intermunicipal"; exige_cte = true; exige_mdfe = false; exige_nfse = false; }
      else { classificacao = "interestadual"; exige_cte = true; exige_mdfe = true; exige_nfse = false; }
    }

    const hasCte = fiscalData.ctes.length > 0;
    const hasMdfe = fiscalData.mdfes.length > 0;
    const hasNfse = fiscalData.nfses.length > 0;
    const ctesProntos = fiscalData.ctes.filter(function(c:any){return c.metadata?.pronto_para_emissao;}).length;
    const ctesOk = !exige_cte || (hasCte && ctesProntos === fiscalData.ctes.length);
    const mdfesOk = !exige_mdfe || (hasMdfe && fiscalData.mdfes.every(function(m:any){return m.metadata?.pronto_para_emissao;}));
    const nfsesOk = !exige_nfse || (hasNfse && fiscalData.nfses.every(function(n:any){return n.metadata?.pronto_para_emissao;}));

    const algumExigido = exige_cte || exige_mdfe || exige_nfse;
    const algumDocumento = hasCte || hasMdfe || hasNfse || fiscalData.xmls.length > 0;

    if (!algumExigido) return { cor: "gray", label: "Sem exigencias fiscais", icon: AlertTriangle, classificacao, exige_cte, exige_mdfe, exige_nfse };
    if (!algumDocumento) return { cor: "red", label: "Documentos obrigatorios ausentes", icon: AlertTriangle, classificacao, exige_cte, exige_mdfe, exige_nfse };
    if ((exige_cte && !hasCte) || (exige_mdfe && !hasMdfe) || (exige_nfse && !hasNfse)) return { cor: "red", label: "Documento obrigatorio ausente", icon: AlertTriangle, classificacao, exige_cte, exige_mdfe, exige_nfse };
    if (!ctesOk || !mdfesOk || !nfsesOk) return { cor: "amber", label: "Pendencias fiscais", icon: AlertTriangle, classificacao, exige_cte, exige_mdfe, exige_nfse };
    return { cor: "green", label: "Fiscal em dia", icon: ShieldCheck, classificacao, exige_cte, exige_mdfe, exige_nfse };
  })();
  const copiarWhatsApp = () => {
    const msg = gerarMensagemWhatsAppOS(os);
    navigator.clipboard.writeText(msg);
    toast.success("Mensagem copiada!");
  };

  const enviarWhatsAppPrestador = async () => {
    if (!os.prestador) {
      toast.error("Prestador não identificado nesta OS");
      return;
    }
    try {
      const { data: prestadorData } = await supabase
        .from("prestadores")
        .select("telefone")
        .eq("nome", os.prestador)
        .single();
      
      if (!prestadorData?.telefone) {
        toast.error("Telefone do prestador não cadastrado");
        return;
      }
      
      const telefone = prestadorData.telefone.replace(/\D/g, "");
      const msg = gerarMensagemWhatsAppOS(os);
      const result = await WhatsAppEnviar(telefone, msg);
      
      if (result.ok) {
        toast.success(`WhatsApp enviado para ${prestadorData.telefone}`);
      } else {
        toast.error(`Falha ao enviar: ${result.error || "Erro desconhecido"}`);
      }
    } catch (e: any) {
      toast.error("Erro ao enviar WhatsApp: " + e.message);
    }
  };

  const formatarData = (data?: string) => formatarDataBR(data) || "—";

  const formatarValor = (valor?: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
  };

  const getStatusBadge = (status?: string) => {
    const globalStatus = obterStatusGlobalOS(status || "rascunho");
    const label = STATUS_GLOBAL_INFO[globalStatus]?.label || status || "Rascunho";
    const cores = STATUS_CORES[status as OSStatus];
    return <Badge className={cores?.twClass || "bg-gray-500"}>{label}</Badge>;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Header Fixo */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm z-50 sticky top-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onVoltar}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-lg font-bold">OS {os.numero}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copiarWhatsApp}>
            <CopyIcon className="w-4 h-4 mr-2" /> Copiar WhatsApp
          </Button>
          <Button variant="outline" onClick={enviarWhatsAppPrestador}>
            <Send className="w-4 h-4 mr-2" /> Enviar WhatsApp
          </Button>
          <Button variant="outline" onClick={() => toast.info("Duplicação de OS em desenvolvimento")}>
            <CopyPlus className="w-4 h-4 mr-2" /> Duplicar OS
          </Button>
          <Button variant="outline" onClick={() => generatePDFCliente(os)}>
            <FileText className="w-4 h-4 mr-2" /> PDF Cliente
          </Button>
          <Button variant="outline" onClick={() => generatePDFPrestador(os)}>
            <Truck className="w-4 h-4 mr-2" /> PDF Prestador
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          {/* Linha do tempo do rastreio — sempre no topo, 100% da largura */}
          <div className="xl:col-span-2 xl:row-start-1">
            <TimelineRastreio status={os.status} />
          </div>

          {/* Cabeçalho da OS */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-1 xl:row-start-2">
            <CardHeader className="bg-orange-50 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-orange-600">ORDEM DE SERVIÇO</CardTitle>
                  <p className="text-sm text-muted-foreground">Nº {os.numero}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(os.status)}
                  <p className="text-xs text-muted-foreground mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {formatarData(os.data)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <LabelRow label="Cliente">{clienteNome || "—"}</LabelRow>
                  <div className="-mt-2 mb-3 flex flex-wrap gap-1.5">
                    {clienteCotacao && (
                      <Badge className="border border-violet-200 bg-violet-100 text-[9px] font-bold uppercase text-violet-700">
                        Cliente Cotação
                      </Badge>
                    )}
                    {agendamentoCotacao.agendada && (
                      <Badge className="gap-1 border border-amber-200 bg-amber-100 text-[9px] font-bold uppercase text-amber-800">
                        <Clock className="h-3 w-3" /> Agendado · {agendamentoCotacao.dataHora}
                      </Badge>
                    )}
                  </div>
                  <LabelRow label="Unidade">{os.unidade || "—"}</LabelRow>
                  <LabelRow label="Tipo de Operação">{os.tipoOperacao || "—"}</LabelRow>
                </div>
                <div>
                  <LabelRow label="Responsável">{os.responsavel || "—"}</LabelRow>
                  <LabelRow label="Prioridade">{os.prioridade || "normal"}</LabelRow>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resumo Operacional — coluna lateral direita */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-start-2 xl:row-start-2 xl:grid-cols-2">
            <Card className="border-none shadow-md rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Users className="h-3.5 w-3.5" /> Cliente
                </div>
                <p className="mt-1 truncate text-sm font-bold text-slate-800" title={clienteNome || undefined}>{clienteNome || "Cliente não informado"}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <p className="text-[11px] text-slate-500">{os.unidade || "Unidade não definida"}</p>
                  {nomesResolvidos.clienteIncompleto && <BadgeCadastroIncompleto />}
                  {clienteCotacao && (
                    <Badge className="border border-violet-200 bg-violet-100 px-1.5 py-0 text-[9px] font-bold uppercase text-violet-700">
                      Cliente Cotação
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Truck className="h-3.5 w-3.5" /> Prestador
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <p className={`truncate text-sm font-bold ${prestadorNome ? "text-slate-800" : "text-red-600"}`} title={prestadorNome || undefined}>
                    {prestadorNome || "Sem prestador"}
                  </p>
                  {nomesResolvidos.prestadorIncompleto && <BadgeCadastroIncompleto />}
                </div>
                <p className="text-[11px] text-slate-500">{os.veiculoPlaca || os.veiculoTipo || "Veículo não alocado"}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <DollarSign className="h-3.5 w-3.5" /> Receita
                </div>
                <p className="mt-1 text-sm font-bold text-emerald-700">{formatarValor(os.valorCliente)}</p>
                <p className="text-[11px] text-slate-500">{os.statusFaturamento || "A faturar"}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <TrendingDown className="h-3.5 w-3.5" /> Custo
                </div>
                <p className="mt-1 text-sm font-bold text-rose-700">{formatarValor(os.custoPrestador)}</p>
                <p className="text-[11px] text-slate-500">Margem: {formatarValor((os.valorCliente || 0) - (os.custoPrestador || 0))}</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-md rounded-2xl">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Activity className="h-3.5 w-3.5" /> Status
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {getStatusBadge(os.status)}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatarData(os.data)} · prioridade {os.prioridade || "normal"}
                </p>
              </CardContent>
            </Card>

            {agendamentoCotacao.agendada && (
              <Card className="border border-amber-200 bg-amber-50/70 shadow-sm rounded-2xl">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    <Clock className="h-3.5 w-3.5" /> Chamado agendado
                  </div>
                  <p className="mt-1 text-sm font-bold text-amber-900">{agendamentoCotacao.dataHora}</p>
                  <p className="text-[11px] text-amber-700">Data/hora informadas pelo cliente na cotação.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Dados do Veículo */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-1 xl:row-start-3">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="w-4 h-4" /> Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{os.veiculoTipo || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Placa</p>
                  <p className="font-semibold">{os.veiculoPlaca || "Pendente"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Carroceria</p>
                  <p className="font-semibold">{os.veiculoCarroceria || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Térmica</p>
                  <p className="font-semibold">{os.veiculoTermica || "seco"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Carga */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-1 xl:row-start-4">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="w-4 h-4" /> Carga
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Tipo</p>
                  <p className="font-semibold">{os.carga?.tipo || "Seca"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Volumes</p>
                  <p className="font-semibold">{os.carga?.volumes || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Peso</p>
                  <p className="font-semibold">{os.carga?.peso || 0} kg</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cubagem</p>
                  <p className="font-semibold">{os.carga?.cubagem || 0} m³</p>
                </div>
              </div>
              {os.carga?.descricao && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Descrição</p>
                  <p className="text-sm">{os.carga.descricao}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Itinerário */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-1 xl:row-start-5">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Route className="w-4 h-4" /> Itinerário
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {os.enderecos?.map((endereco: OSEndereco, idx: number) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-600">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{endereco.tipo}</Badge>
                        <span className="font-semibold">{endereco.nomeLocal || "Local não identificado"}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{endereco.endereco || "Endereço não informado"}</p>
                      {endereco.telefone && (
                        <p className="text-sm mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {endereco.telefone}
                        </p>
                      )}
                      {endereco.contato && (
                        <p className="text-sm flex items-center gap-1">
                          <User className="w-3 h-3" /> {endereco.contato}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-4">
                <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600">Distância</p>
                  <p className="font-bold text-blue-800">{os.distanciaKm || 0} km</p>
                </div>
                <div className="flex-1 p-3 bg-blue-50 rounded-lg text-center">
                  <p className="text-xs text-blue-600">Tempo Estimado</p>
                  <p className="font-bold text-blue-800">{os.tempoEstimado || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prestador */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-2 xl:row-start-3">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <User className="w-4 h-4" /> Prestador / Motorista
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {prestadorNome ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="font-semibold">{prestadorNome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Veículo</p>
                    <p className="font-semibold">{os.veiculoAlocado || "—"}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Prestador não asignado</p>
              )}
            </CardContent>
          </Card>

          {/* Valores */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-2 xl:row-start-4">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <span className="text-green-600">R$</span> Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Cliente</p>
                  <p className="font-bold text-lg">{formatarValor(os.valorCliente)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo Prestador</p>
                  <p className="font-bold text-lg">{formatarValor(os.custoPrestador)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedágio</p>
                  <p className="font-bold text-lg">{formatarValor(os.pedagio)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instruções */}
          {os.instrucoesOperacionaisOS && (
            <Card className="border-none shadow-md rounded-2xl xl:col-start-2 xl:row-start-5">
              <CardHeader className="bg-slate-50 border-b py-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span className="text-orange-600">📝</span> Instruções
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-sm whitespace-pre-wrap">{os.instrucoesOperacionaisOS}</p>
              </CardContent>
            </Card>
          )}

          {/* Histórico */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-2 xl:row-start-6">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <HistoricoOS historico={os.historico as HistoricoOSItem[] | undefined} />
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card className="border-none shadow-md rounded-2xl xl:col-start-1 xl:row-start-6">
            <CardHeader className="bg-slate-50 border-b py-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Documentos e Comprovantes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {os.documentos && os.documentos.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {os.documentos.map((doc: any, i: number) => (
                    <div key={i} className="p-3 border rounded-lg flex items-center gap-3 bg-white">
                       <FileText className="w-5 h-5 text-blue-600"/>
                       <div className="flex-1 min-w-0">
                         <p className="text-xs font-semibold truncate">{doc.nome || "Documento"}</p>
                         <p className="text-[10px] text-muted-foreground uppercase">{doc.tipo || "anexo"}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="w-3 h-3"/></Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg bg-slate-50">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-20"/>
                  <p className="text-sm">Nenhum documento anexado</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* FISCAL */}
          {!fiscalLoading && (
            <div className="space-y-6 xl:col-span-2 xl:row-start-7">
              {/* SEMÁFORO */}
              <Card className="border-none shadow-md rounded-2xl">
                <CardHeader className="bg-slate-50 border-b py-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Fiscal</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={"w-4 h-4 rounded-full " + (semaforo.cor==="green"?"bg-green-500":semaforo.cor==="amber"?"bg-amber-500":semaforo.cor==="red"?"bg-red-500":"bg-gray-400")} />
                    <span className="font-semibold text-sm">{semaforo.label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Classificacao: <span className="font-semibold">{semaforo.classificacao}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] mb-3">
                    <div className={"p-1 rounded text-center "+(semaforo.exige_cte?"bg-blue-50 font-semibold":"bg-gray-50 text-muted-foreground")}>CT-e {semaforo.exige_cte?"Sim":"Nao"}</div>
                    <div className={"p-1 rounded text-center "+(semaforo.exige_mdfe?"bg-purple-50 font-semibold":"bg-gray-50 text-muted-foreground")}>MDF-e {semaforo.exige_mdfe?"Sim":"Nao"}</div>
                    <div className={"p-1 rounded text-center "+(semaforo.exige_nfse?"bg-green-50 font-semibold":"bg-gray-50 text-muted-foreground")}>NFS-e {semaforo.exige_nfse?"Sim":"Nao"}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-blue-50 rounded"><span>CT-es</span><span className="font-bold">{fiscalData.ctes.length}</span></div>
                    <div className="flex justify-between p-2 bg-purple-50 rounded"><span>MDF-es</span><span className="font-bold">{fiscalData.mdfes.length}</span></div>
                    <div className="flex justify-between p-2 bg-green-50 rounded"><span>NFS-es</span><span className="font-bold">{fiscalData.nfses.length}</span></div>
                    <div className="flex justify-between p-2 bg-orange-50 rounded"><span>XMLs</span><span className="font-bold">{fiscalData.xmls.length}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* DOCUMENTOS FISCAIS */}
              <Card className="border-none shadow-md rounded-2xl">
                <CardHeader className="bg-slate-50 border-b py-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Documentos Fiscais</CardTitle></CardHeader>
                <CardContent className="p-3 space-y-2">
                  {fiscalData.ctes.map(function(ct:any){return <DocRow key={ct.id} tipo="CT-e" numero={ct.numero} status={ct.status} pronto={ct.metadata?.pronto_para_emissao} icon={FileSpreadsheet} href={"/fiscal?tab=cte"} />;})}
                  {fiscalData.mdfes.map(function(m:any){return <DocRow key={m.id} tipo="MDF-e" numero={m.numero} status={m.status} pronto={m.metadata?.pronto_para_emissao} icon={Truck} href={"/fiscal?tab=mdfe"} />;})}
                  {fiscalData.nfses.map(function(n:any){return <DocRow key={n.id} tipo="NFS-e" numero={n.numero} status={n.status} pronto={n.metadata?.pronto_para_emissao} icon={Stamp} href={"/fiscal?tab=nfse"} />;})}
                  {fiscalData.xmls.map(function(x:any){return <DocRow key={x.id} tipo="XML" numero={x.chave_acesso?.substring(0,10)+"..."} status={x.status} icon={FileText} href={"/fiscal?tab=cte"} />;})}
                  {fiscalData.ctes.length===0&&fiscalData.mdfes.length===0&&fiscalData.nfses.length===0&&fiscalData.xmls.length===0&&<p className="text-xs text-muted-foreground text-center py-2">Nenhum documento fiscal vinculado.</p>}
                </CardContent>
              </Card>

              {/* TIMELINE FISCAL */}
              {fiscalData.timeline.length > 0 && (
                <Card className="border-none shadow-md rounded-2xl">
                  <CardHeader className="bg-slate-50 border-b py-3"><CardTitle className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline Fiscal</CardTitle></CardHeader>
                  <CardContent className="p-3">
                    <div className="space-y-2">
                      {fiscalData.timeline.slice(0,10).map(function(e:any,i:number){return (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <span className="text-muted-foreground">{formatarDataHoraBR(e.data)}</span>
                            <p className="font-medium">{e.tipo}</p>
                            <p className="text-muted-foreground truncate">{e.desc}</p>
                          </div>
                        </div>
                      );})}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({ tipo, numero, status, pronto, icon: Icon, href }: { tipo: string; numero?: string; status?: string; pronto?: boolean; icon: any; href: string }) {
  return (
    <div className="flex items-center justify-between p-2 border rounded text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="font-medium">{tipo}</span>
        <span className="font-mono text-muted-foreground truncate">{numero||"S/N"}</span>
        {pronto===true && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">Pronto</Badge>}
        {pronto===false && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pendente</Badge>}
        {status && pronto===undefined && <Badge variant="outline" className="text-[10px]">{status}</Badge>}
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={function(){ window.location.href = href; }}><Eye className="w-3 h-3" /></Button>
    </div>
  );
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="font-medium">{children}</p>
    </div>
  );
}
