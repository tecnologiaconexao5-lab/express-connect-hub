import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DollarSign, Calendar, Users, Truck, FileCheck, FileX, RefreshCw, Download, Plus, Search, Filter, Eye, Edit, Check, X, Clock, CreditCard, Landmark, Package, AlertTriangle, ChevronDown, ChevronUp, Printer, FileText, Layers, Copy, RotateCcw, MoreHorizontal, Inbox, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS_CLIENTES_VALUE = "__todos_clientes__";
const TODOS_PRESTADORES_VALUE = "__todos_prestadores__";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaginationBar from "@/components/ui/PaginationBar";
import { fmtDateLocal, fmtPeriodo, nomeOuNaoInformado } from "@/helpers/periodoHelper";
import { normalizarPagamento, resumirFilaAprovacao, ordenarFilaAprovacao, estaPendenteAprovacao } from "@/helpers/pagamentoPrestadorView";
import { calcularFilaValores, filtrarFilaLiquidacao, resumoFilaLiquidacao as calcularResumoFilaLiquidacao } from "@/helpers/filaLiquidacaoHelper";
import { isAptoLote, resumoLoteSelecionado, loteIdCurto, filtrarAptosLote, totalLiquidoAptos, type LinhaLote } from "@/helpers/lotePagamentoHelper";
import { toast } from "sonner";
import { criarPagamento, criarLancamentoManualPrestador, atualizarStatusPagamento, confirmarPagamento, liberarPagamentoPrestador, criarFechamento, atualizarFechamento, vincularItensFechamento, gerarLotePagamentos, reprovarPagamento, cancelarPagamento, estornarPagamento, type GerarLoteResult } from "@/services/financeiro/pagamentoPrestadorService";
import { criarFechamento as criarFechamentoService, buscarFechamento, listarFechamentos, conferirFechamento, aprovarFechamento, pagarFechamento, cancelarFechamento, type FechamentoDetalhado, type CriarFechamentoInput } from "@/services/financeiro/fechamentoService";
import { escalaParaItemRepasse, isAlocacaoFaturavel, type ItemRepasseEscala } from "@/services/escala/escalaFinanceiroAdapter";
import { mapearBancoParaLocal } from "@/services/escala/escalaMapper";
import { calcularRepassePrestador } from "@/helpers/calculoRepassePrestador";
import { registrarAuditoria } from "@/services/financeiro/auditoriaPrestadorService";
import { getStatusComprovanteInfo, FILTRO_COMPROVANTE_OPCOES, type StatusComprovante } from "@/helpers/statusComprovante";
import { buscarPODsDeAlocacoes } from "@/services/comprovantes/comprovantesService";
import { calcularStatusFinanceiro, getMotivoBloqueio, podeAprovar, type StatusFinanceiroPrestador, type DadosStatusFinanceiro } from "@/helpers/statusFinanceiroPrestador";
import { getFechamentoStatusInfo, extrairDivergencias } from "@/helpers/fechamentoHelper";
import { podeReprovarPagamento, podeCancelarPagamento, podeEstornarPagamento } from "@/helpers/acoesPagamentoPrestador";
import { gerarLinhasRelatorio, exportarCSV, imprimirRelatorio, filtrarLinhasRelatorio, paginarLinhas, type FiltrosLinhaRelatorio } from "@/helpers/relatorioPrestadorHelper";
import { getPagamentoStatusInfo, getTimelineSteps, detectarTipoPagamento, getTipoPagamentoBadge } from "@/helpers/pagamentoHelper";
import { calcularKPIPrestador, gerarAlertas, calcularDistribuicaoStatus } from "@/helpers/dashboardPrestadorHelper";
import { supabase } from "@/lib/supabase";
import { mascararCPF, mascararTelefone } from "@/lib/masking";
import ExtratoPrestadorService, { ExtratoFechamentoPrestador } from "@/services/financeiro/extratoPrestadorService";
import { generateExtratoPrestadorPDF } from "@/lib/pdf/extratoPrestadorReport";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Prestador {
  id: string;
  nome_completo: string;
  cpf_cnpj: string;
  tipo_parceiro: string;
  status: string;
  telefone?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  chave_pix?: string;
}

interface Cliente {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
}

interface OS {
  id: string;
  numero: string;
  prestador?: string;
  custo_prestador?: number;
  pedagio?: number;
  adicionais?: number;
  valor_descontos?: number;
  status: string;
  data?: string;
  tipo_operacao?: string;
  veiculo_tipo?: string;
}

interface PagamentoItem {
  id: string;
  pagamento_id: string;
  os_id: string;
  os_numero: string;
  valor_servico: number;
  pedagio: number;
  adicional: number;
  valor_reembolso: number;
  valor_bonus: number;
  valor_desconto: number;
  status: string;
}

interface Pagamento {
  id: string;
  prestador_id: string;
  prestador_nome: string;
  prestador_documento: string;
  quantidade_os: number;
  valor_servicos: number;
  valor_reembolsos: number;
  valor_bonus: number;
  valor_descontos: number;
  valor_adiantamentos: number;
  valor_liquido: number;
  valor_pedagio?: number;
  status: string;
  status_conferencia?: string;
  status_aprovacao?: string;
  status_pagamento?: string;
  tipo_pagamento?: string;
  periodo_inicio: string;
  periodo_fim: string;
  data_programada_pagamento?: string;
  data_competencia?: string;
  data_pagamento?: string;
  observacao?: string;
  origem_lancamento?: string;
  tipo_lancamento?: string;
  elegivel_lote?: boolean;
  lote_id?: string;
  is_teste?: boolean;
  created_at?: string;
}

interface DadosBancarios {
  banco?: string;
  agencia?: string;
  conta?: string;
  tipo_conta?: string;
  chave_pix?: string;
}

interface DadosProfissionais {
  telefone?: string;
}

interface ExtratoContaCorrente {
  id: string;
  data: string;
  origem: string;
  descricao: string;
  credito: number;
  debito: number;
  saldo: number;
  status: string;
}

interface PagamentoManual {
  id: string;
  prestador_id: string;
  prestador_nome: string;
  prestador_documento?: string;
  cliente_id?: string;
  cliente_nome?: string;
  os_id?: string;
  os_numero?: string;
  tipo_lancamento: string;
  natureza: string;
  valor?: number;
  valor_liquido: number;
  data_competencia: string;
  data_prevista_pagamento?: string;
  forma_pagamento: string;
  conta_pagamento?: string;
  observacao?: string;
  status_conferencia: string;
  status_pagamento: string;
  status_aprovacao?: string;
  elegivel_lote: boolean;
  lote_id?: string;
  categoria_financeira?: string;
  centro_custo?: string;
  conta_contabil?: string;
  origem_lancamento: string;
  created_at?: string;
  updated_at?: string;
  data_pagamento?: string;
  arquivo?: string;
}

// 05D.7B.3 — linha da fila unificada "Aptos para Lote" (todas as origens)
interface AptoLote {
  id: string;
  prestador_id: string | null;
  prestador_nome: string | null;
  os_id: string | null;
  os_numero: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  data_competencia: string | null;
  valor_servicos: number | null;
  pedagio: number | null;
  adicionais: number | null;
  valor_liquido: number | null;
  status_conferencia: string | null;
  status_aprovacao: string | null;
  status_pagamento: string | null;
  status: string | null;
  elegivel_lote: boolean | null;
  lote_id: string | null;
  is_teste: boolean | null;
  tipo_pagamento: string | null;
  origem_lancamento: string | null;
}

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  banco: string;
  agencia: string;
  numero_conta: string;
  ativa: boolean;
  saldo: number;
}

const STATUS_COLORS = {
  pendente: "bg-yellow-100 text-yellow-800",
  confirmado: "bg-blue-100 text-blue-800",
  processando: "bg-purple-100 text-purple-800",
  pago: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800"
};

const STATUS_LABELS = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  processando: "Processando",
  pago: "Pago",
  cancelado: "Cancelado"
};

interface ValoresAjustados {
  reembolso: number;
  bonus: number;
  desconto: number;
}

type ValoresMap = { [key: string]: ValoresAjustados };

const fmtMoeda = (v: number | null | undefined): string =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// PP-UX-02 — nomenclatura profissional de origem (apenas EXIBIÇÃO; não altera banco).
const ORIGEM_LABEL: Record<string, string> = {
  os_direta: "OS Direta",
  os_finalizada: "OS Direta",
  ordem_servico: "OS Direta",
  escala_direta: "Programação Operacional",
  escala_operacional: "Programação Operacional",
  escala: "Programação Operacional",
  manual: "Manual",
  fechamento: "Fechamento",
};

const labelOrigem = (origem?: string | null): string => {
  if (!origem) return "—";
  return ORIGEM_LABEL[origem] || origem;
};

const STATUS_CC_LABEL: Record<string, string> = {
  pago: "Pago",
  pendente: "Pendente",
  confirmado: "Confirmado",
  processando: "Processando",
  cancelado: "Cancelado",
  em_lote: "Em Lote",
  programado: "Programado",
  agendado: "Agendado",
};

const labelStatusGenerico = (status?: string | null): string => {
  if (!status) return "—";
  return STATUS_CC_LABEL[status] || status;
};

export default function PagamentoPrestadores() {
  const [searchParams, setSearchParams] = useSearchParams();
  // REFORMULACAO-UI-PAGAMENTOS — "Fila de Liquidação" é a visão primária.
  const [aba, setAba] = useState(searchParams.get("aba") || "fila");
  // Sub-navegação interna de "Fechamentos e Pagamentos"
  const [subAba, setSubAba] = useState("pendentes");
  const [prestadorCC, setPrestadorCC] = useState<string>("");
  const [extratoCC, setExtratoCC] = useState<ExtratoContaCorrente[]>([]);

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [oss, setOss] = useState<OS[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  // FIN-BUG-06 — Caixa de Entrada: array INDEPENDENTE do filtro de período.
  // Alimenta o badge E a tabela da aba "Pendentes de Aprovação" (mesma fonte).
  const [pendentesAprovacao, setPendentesAprovacao] = useState<Pagamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filtroPeriodo, setFiltroPeriodo] = useState("mes");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [filtroComprovante, setFiltroComprovante] = useState<string>("todos");

  const [selectedPrestador, setSelectedPrestador] = useState<Prestador | null>(null);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [showFechamento, setShowFechamento] = useState(false);
  const [showNovoPagamento, setShowNovoPagamento] = useState(false);
  const [fechamentoExpandido, setFechamentoExpandido] = useState<Record<string, boolean>>({});
  const [showJustificativa, setShowJustificativa] = useState(false);
  const [justificativaAlvo, setJustificativaAlvo] = useState<{ id: string; updates: any; prestadorId?: string; prestadorNome?: string } | null>(null);
  const [justificativaTexto, setJustificativaTexto] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pagamentosManuais, setPagamentosManuais] = useState<PagamentoManual[]>([]);
  const [escalaRepasse, setEscalaRepasse] = useState<ItemRepasseEscala[]>([]);
  const [escalaRepasseLoading, setEscalaRepasseLoading] = useState(false);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);

  // FIN-PP-FUNC-01 — Estado do "Novo Lançamento" (obrigação manual de prestador)
  const TIPOS_LANCAMENTO_MANUAL = ["Serviço Avulso", "Ajuste", "Reembolso", "Adiantamento"];
  const [criandoLancamento, setCriandoLancamento] = useState(false);
  // FIN-BUG-04 — linha da Caixa de Entrada em aprovação (anti duplo-clique)
  const [aprovandoFilaId, setAprovandoFilaId] = useState<string | null>(null);
  const [novoPagamento, setNovoPagamento] = useState({
    prestadorId: "",
    tipoLancamento: "Serviço Avulso",
    valor: 0,
    dataCompetencia: new Date().toISOString().split("T")[0],
    descricao: "",
    formaPagamento: "PIX",
    contaPagamento: "",
  });

  const [valoresAjustados, setValoresAjustados] = useState<ValoresMap>({});
  const [extratoSelecionado, setExtratoSelecionado] = useState<ExtratoFechamentoPrestador | null>(null);
  const [showExtrato, setShowExtrato] = useState(false);
  const [extratoLoading, setExtratoLoading] = useState(false);

  // FIN-P1-04: Fechamento real via fechamentoService
  const [fechamentosReais, setFechamentosReais] = useState<FechamentoDetalhado[]>([]);
  const [fechamentosLoading, setFechamentosLoading] = useState(false);
  const [fechamentoSelecionado, setFechamentoSelecionado] = useState<FechamentoDetalhado | null>(null);
  const [showConferirFechamento, setShowConferirFechamento] = useState(false);
  const [showAprovarFechamento, setShowAprovarFechamento] = useState(false);
  const [showPagarFechamento, setShowPagarFechamento] = useState(false);
  const [showCancelarFechamento, setShowCancelarFechamento] = useState(false);
  const [pagarData, setPagarData] = useState({ dataPagamento: new Date().toISOString().split("T")[0], contaFinanceiraId: "", valorEfetivo: 0 });
  const [cancelarMotivo, setCancelarMotivo] = useState("");
  const [fechamentoAcaoLoading, setFechamentoAcaoLoading] = useState(false);

  // FIN-MOT-2H — filtros unificados (painel + extrato). Mesmos estados:
  // prestador/cliente/origem aqui e no extrato; datas compartilham dataInicio/dataFim.
  const [filtroPrestadorId, setFiltroPrestadorId] = useState<string>(TODOS_PRESTADORES_VALUE);
  const [filtroClienteId, setFiltroClienteId] = useState<string>(TODOS_CLIENTES_VALUE);
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");

  // FIN-P1-02: Navegação por mês
  const [mesOffset, setMesOffset] = useState(0);

  // 05D.6D — paginação real (padrão do sistema) + filtro de status do Relatório
  const PAGE_SIZE_PAGTO = 25;
  const [pagePeriodo, setPagePeriodo] = useState(1);
  const [pageRelatorio, setPageRelatorio] = useState(1);
  const [filtroStatusRelatorio, setFiltroStatusRelatorio] = useState("todos");
  const [ppClientes, setPpClientes] = useState<Record<string, { clienteId: string; clienteNome: string }>>({});
  const [imprimindoRelatorio, setImprimindoRelatorio] = useState(false);
  // 05D.7B.2 — seleção para GERAR LOTE (unico caminho; RPC e a autoridade)
  const [selecionadosLote, setSelecionadosLote] = useState<Set<string>>(new Set());
  const [showModalLote, setShowModalLote] = useState(false);
  const [gerandoLote, setGerandoLote] = useState(false);
  const [loteResultado, setLoteResultado] = useState<GerarLoteResult | null>(null);
  const [aptosLote, setAptosLote] = useState<AptoLote[]>([]);
  const [pageAptos, setPageAptos] = useState(1);

  // REFORMULACAO-UI-PAGAMENTOS — Fila de Liquidação (OS/Programação finalizadas).
  const [pageFilaLiquidacao, setPageFilaLiquidacao] = useState(1);
  const [liberandoFilaId, setLiberandoFilaId] = useState<string | null>(null);

  // PP-UX-02C1C — ações oficiais de prestador (reprovar / cancelar nao pago / estornar integral).
  // Controlam modal + motivo + avisos retornados pelas RPCs. SOMENTE via service (RPC), sem DML.
  const [acaoPagamento, setAcaoPagamento] = useState<any | null>(null);
  const [showReprovarPagamento, setShowReprovarPagamento] = useState(false);
  const [showCancelarPagamento, setShowCancelarPagamento] = useState(false);
  const [showEstornarPagamento, setShowEstornarPagamento] = useState(false);
  const [motivoAcaoPagamento, setMotivoAcaoPagamento] = useState("");
  const [acaoPagamentoLoading, setAcaoPagamentoLoading] = useState(false);
  const [acaoPagamentoAviso, setAcaoPagamentoAviso] = useState<string | null>(null);

  const mesAtualStr = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  }, [mesOffset]);

  const mesAtualCodigo = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  }, [mesOffset]);

  useEffect(() => {
    const now = new Date();
    now.setMonth(now.getMonth() + mesOffset);
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const iniStr = inicio.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const fimStr = fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    setDataInicio(iniStr);
    setDataFim(fimStr);
  }, [mesOffset]);

  useEffect(() => {
    setPagePeriodo(1);
    setPageRelatorio(1);
    setPageAptos(1);
    fetchPrestadores();
    fetchOss();
    fetchPagamentos();
    fetchClientes();
    fetchPagamentosManuais();
    fetchEscalaRepasse();
    fetchContasFinanceiras();
    fetchFechamentos();
    fetchAptosLote();
  }, [dataInicio, dataFim, filtroPrestadorId, filtroOrigem]);

  // FIN-BUG-06 — Caixa de Entrada carregada UMA vez (não depende do período).
  // Revalidação acontece no botão "Atualizar" e após aprovar/criar lançamento.
  useEffect(() => {
    fetchPendentesAprovacao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIN-BUG-04/06 — Mapa id → nome (resolve "Prestador Fantasma" pelo cadastro).
  const nomePrestadorPorId = useMemo(() => {
    const mapa: Record<string, string> = {};
    for (const p of prestadores) mapa[p.id] = p.nome_completo || "";
    return mapa;
  }, [prestadores]);

  // FIN-BUG-06 — A fila da Caixa de Entrada NÃO usa `pagamentos` (que é
  // recortado por dataInicio/dataFim): usa `pendentesAprovacao`, buscado SEM
  // filtro de período. Badge e tabela consomem ESTE array — o mesmo length.
  const filaAprovacao = useMemo(
    () => ordenarFilaAprovacao((pendentesAprovacao || []).filter(estaPendenteAprovacao)),
    [pendentesAprovacao],
  );

  // Resumo GLOBAL da inbox (pendentes/bloqueados/fantasmas) — mesma fonte do badge.
  const resumoFila = useMemo(
    () => resumirFilaAprovacao(pendentesAprovacao || [], nomePrestadorPorId),
    [pendentesAprovacao, nomePrestadorPorId],
  );

  // Resumo do PERÍODO (aprovados a pagar / pago no mês) — segue os filtros da barra.
  const resumoPeriodo = useMemo(
    () => resumirFilaAprovacao(pagamentos || [], nomePrestadorPorId),
    [pagamentos, nomePrestadorPorId],
  );

  // FIN-PP-UX-FIX — o Dashboard deve respeitar rigorosamente o período selecionado.
  // `pagamentosManuais` é buscado globalmente (sem período) para as visões de Manuais
  // e Relatório; aqui derivamos um recorte por `data_competencia` apenas para os KPIs
  // e a distribuição do Dashboard, evitando somar lançamentos fora do período.
  const pagamentosManuaisPeriodo = useMemo(() => {
    if (!dataInicio && !dataFim) return pagamentosManuais;
    return (pagamentosManuais || []).filter((m) => {
      const d = String(m.data_competencia || "").slice(0, 10);
      if (!d) return true;
      if (dataInicio && d < dataInicio) return false;
      if (dataFim && d > dataFim) return false;
      return true;
    });
  }, [pagamentosManuais, dataInicio, dataFim]);

  // 05D.6D — re-paginar ao alterar busca/status
  useEffect(() => { setPagePeriodo(1); }, [filtroBusca]);
  useEffect(() => { setPageRelatorio(1); }, [filtroBusca, filtroStatusRelatorio, filtroClienteId]);
  useEffect(() => { setPageAptos(1); }, [filtroBusca, filtroClienteId, filtroOrigem, filtroPrestadorId, dataInicio, dataFim]);
  useEffect(() => { setPageFilaLiquidacao(1); }, [filtroBusca, filtroPrestadorId]);

  const fetchPrestadores = async () => {
    try {
      const { data, error } = await supabase
        .from("prestadores")
        .select("id, nome_completo, cpf_cnpj, tipo_parceiro, status, telefone")
        .eq("status", "ativo")
        .order("nome_completo");

      if (error) {
        console.warn("[PagamentoPrestadores] Erro ao buscar prestadores (colunas opcionais):", error.message);
      }
      setPrestadores(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar prestadores:", e);
      setPrestadores([]);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social, cnpj")
        .order("nome_fantasia");

      if (error && error.code !== "42P01") throw error;
      setClientes(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar clientes:", e);
    }
  };

  const fetchContasFinanceiras = async () => {
    try {
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("id, nome, tipo, banco, agencia, numero_conta, ativa, saldo")
        .eq("ativa", true)
        .order("nome");
      if (error) throw error;
      setContasFinanceiras(data || []);
    } catch (e) {
      console.warn("[PagamentoPrestadores] Erro ao buscar contas financeiras:", e);
      setContasFinanceiras([]);
    }
  };

  const fetchPagamentosManuais = async () => {
    try {
      let query = supabase
        .from("pagamentos_prestadores")
        .select("*")
        .eq("origem_lancamento", "manual")
        .eq("is_teste", false)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error && error.code !== "42P01") {
        // Fallback: buscar sem filtro de origem
        const { data: data2 } = await supabase
          .from("pagamentos_prestadores")
          .select("*")
          .eq("is_teste", false)
          .order("periodo_inicio", { ascending: false });
        setPagamentosManuais(data2 || []);
      } else {
        setPagamentosManuais(data || []);
      }
    } catch (e: any) {
      console.error("Erro ao buscar pagamentos manuais:", e);
      setPagamentosManuais([]);
    }
  };

  
  useEffect(() => {
    if (prestadorCC && aba === 'conta-corrente') {
      fetchExtratoContaCorrente(prestadorCC);
    }
  }, [prestadorCC, aba]);

  const fetchExtratoContaCorrente = async (prestadorId: string) => {
    try {
      // FIN-P1-02: Conta Corrente derivada de pagamentos_prestadores (ordens_servico vazio)
      const { data: pagData, error: pagError } = await supabase
        .from('pagamentos_prestadores')
        .select('id, prestador_nome, valor_servicos, pedagio, adicionais, descontos, valor_liquido, valor_reembolsos, valor_bonus, status, status_pagamento, origem_lancamento, tipo_lancamento, natureza, periodo_inicio, data_competencia, created_at, observacao, is_teste')
        .eq('prestador_id', prestadorId)
        .eq('is_teste', false)
        .neq('status', 'cancelado')
        .order('periodo_inicio', { ascending: true });

      if (pagError) throw pagError;

      const extrato: ExtratoContaCorrente[] = [];

      // FIN-P1-02: Regra contábil da Conta Corrente
      // Cada pagamento = CRÉDITO ao prestador (valor devido)
      // Cada pagamento pago = ENTRADA (saída de caixa) = DÉBITO na CC
      (pagData || []).forEach(pag => {
        const isCredito = pag.natureza === 'credito';
        // FIN-BUG-04 — valor exibível normalizado: valor_liquido; se 0 (legado),
        // usa valor_servicos, evitando crédito "R$ 0,00" no extrato.
        const valorLiquido = normalizarPagamento(pag).valor;
        const dataRef = pag.periodo_inicio || pag.data_competencia || pag.created_at;

        // 1. Linha de crédito: serviço/repasse devido ao prestador
        extrato.push({
          id: pag.id,
          data: dataRef,
          origem: pag.tipo_lancamento || pag.origem_lancamento || 'Servi\u00e7o',
          descricao: pag.observacao || pag.tipo_lancamento || `Servi\u00e7o ${pag.os_numero || ''}`.trim(),
          credito: isCredito ? valorLiquido : 0,
          debito: !isCredito ? valorLiquido : 0,
          saldo: 0, // calculado abaixo
          status: pag.status_pagamento || pag.status,
        });

        // 2. Se está pago, registrar débito (saída de caixa / pagamento realizado)
        if (pag.status === 'pago') {
          extrato.push({
            id: `${pag.id}-pgto`,
            data: pag.data_competencia || dataRef,
            origem: 'Pagamento',
            descricao: `Pagamento realizado - ${pag.tipo_lancamento || 'Servi\u00e7o'}`,
            credito: 0,
            debito: valorLiquido,
            saldo: 0,
            status: 'pago',
          });
        }
      });

      extrato.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

      // Calcular saldo acumulado cronologicamente
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

  const handleAtualizarStatus = async (id: string, updates: any, prestadorId?: string, prestadorNome?: string, motivo?: string) => {
    try {
      const { data: antes } = await supabase.from('pagamentos_prestadores').select('*').eq('id', id).maybeSingle();
      if (!antes) { toast.error("Registro não encontrado"); return; }
      // M013: centralizado via pagamentoPrestadorService

      if (updates.status_aprovacao === 'aprovado') {
        const statusFinanceiro = calcularStatusFinanceiro({
          statusConferencia: antes.status_conferencia,
          statusAprovacao: antes.status_aprovacao,
          valorLiquido: antes.valor_liquido,
        });
        if (!podeAprovar(statusFinanceiro)) {
          setJustificativaAlvo({ id, updates, prestadorId: prestadorId || antes.prestador_id, prestadorNome: prestadorNome || antes.prestador_nome });
          setJustificativaTexto("");
          setShowJustificativa(true);

          registrarAuditoria({
            acao: 'reprovar_pagamento',
            entidade_tipo: 'pagamento_prestador',
            entidade_id: id,
            prestador_id: prestadorId || antes.prestador_id,
            prestador_nome: prestadorNome || antes.prestador_nome,
            valor_anterior: antes.valor_liquido,
            detalhes: { status_anterior: antes.status_pagamento, motivo_bloqueio: getMotivoBloqueio(statusFinanceiro), bloqueio_automatico: true },
          });
          return;
        }
      }

      await atualizarStatusPagamento(id, updates, motivo);
      toast.success('Status atualizado!');
      fetchPagamentosManuais();
      fetchPagamentos();
      fetchPendentesAprovacao();

      const acao = updates.status_conferencia === 'conferido' ? 'marcar_conferido'
        : updates.status_aprovacao === 'aprovado' ? 'aprovar_pagamento'
        : updates.status_aprovacao === 'rejeitado' ? 'reprovar_pagamento'
        : updates.status_pagamento === 'em_lote' ? 'marcar_em_lote'
        : updates.status_pagamento === 'cancelado' ? 'cancelar_pagamento'
        : 'atualizar_status';

      registrarAuditoria({
        acao,
        entidade_tipo: 'pagamento_prestador',
        entidade_id: id,
        prestador_id: prestadorId || antes?.prestador_id,
        prestador_nome: prestadorNome || antes?.prestador_nome,
        valor_anterior: antes?.valor_liquido,
        valor_novo: updates.valor_liquido ?? antes?.valor_liquido,
        detalhes: { status_anterior: antes?.status_pagamento, status_novo: updates.status ?? updates.status_pagamento, motivo },
      });
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  // FIN-BUG-04 — Aprovação pela Caixa de Entrada: confere + aprova + elegível a
  // lote em UMA RPC oficial (f_aprovar_pagamento_prestadores), via service.
  // Nunca executa pagamento/baixa. Registros fantasma/valor 0 são recusados
  // localmente com mensagem clara (mesmo vocabulário das RPCs).
  const aprovarDaFila = async (p: Pagamento) => {
    if (aprovandoFilaId) return;
    const nv = normalizarPagamento(p, nomePrestadorPorId);
    if (!nv.podeAprovar) {
      toast.error(
        nv.motivoBloqueio === "SEM_PRESTADOR"
          ? "Lançamento sem prestador vinculado — não pode ser aprovado."
          : "Lançamento com valor inválido (R$ 0,00) — não pode ser aprovado.",
      );
      return;
    }
    setAprovandoFilaId(p.id);
    try {
      await handleAtualizarStatus(
        p.id,
        { status_conferencia: "conferido", elegivel_lote: verificarElegibilidadeLote(p.prestador_id) },
        p.prestador_id,
        nv.prestadorNome || p.prestador_nome,
      );
      fetchPagamentos();
      fetchPagamentosManuais();
      fetchPendentesAprovacao();
    } finally {
      setAprovandoFilaId(null);
    }
  };

  const handleLiberarComJustificativa = async () => {
    if (!justificativaAlvo || !justificativaTexto.trim()) {
      toast.error("Informe a justificativa para liberar");
      return;
    }
    setShowJustificativa(false);
    await handleAtualizarStatus(
      justificativaAlvo.id,
      { ...justificativaAlvo.updates, liberado_com_justificativa: true },
      justificativaAlvo.prestadorId,
      justificativaAlvo.prestadorNome,
      `Liberação manual: ${justificativaTexto.trim()}`
    );
    setJustificativaAlvo(null);
    setJustificativaTexto("");
  };

  const verificarElegibilidadeLote = (prestadorId: string): boolean => {
    const prestador = prestadores.find(p => p.id === prestadorId);
    if (!prestador) return false;
    
    // Simplificando verificação pois os campos de banco foram transferidos para o JSON/Tabela separada
    const hasDocumento = prestador.cpf_cnpj && prestador.cpf_cnpj.length >= 11;
    
    return hasDocumento;
  };

  const fetchOss = async () => {
    if (!dataInicio || !dataFim) return;
    try {
      // FIN-P1-02: Fonte real = pagamentos_prestadores (ordens_servico tem 0 registros em produção)
      let query = supabase
        .from("pagamentos_prestadores")
        .select("id, prestador_id, prestador_nome, os_numero, valor_servicos, pedagio, adicionais, descontos, valor_liquido, valor_reembolsos, valor_bonus, status, periodo_inicio, periodo_fim, origem_lancamento, tipo_lancamento, natureza, is_teste, data_competencia")
        .eq("is_teste", false)
        .neq("status", "cancelado")
        .neq("tipo_pagamento", "fechamento")
        .lte("periodo_inicio", dataFim)
        .or(`periodo_fim.gte.${dataInicio},periodo_fim.is.null`);

      // FIN-P1-02: Filtros por prestador, cliente e origem
      if (filtroPrestadorId !== TODOS_PRESTADORES_VALUE) {
        query = query.eq("prestador_id", filtroPrestadorId);
      }
      if (filtroOrigem !== "todos") {
        const origemMap: Record<string, string> = {
          ordem_servico: "os_direta",
          escala: "escala_direta",
          manual: "manual",
        };
        if (origemMap[filtroOrigem]) query = query.eq("origem_lancamento", origemMap[filtroOrigem]);
      }

      const { data, error } = await query.order("periodo_inicio", { ascending: false });
      if (error) throw error;

      // Mapear para interface OS (compatibilidade com ossAgrupadas/totaisPorPrestador)
      const mapped: OS[] = (data || []).map((p: any) => ({
        id: p.id,
        numero: p.os_numero || p.id?.slice(0, 8) || "",
        prestador: (p.prestador_nome || "").trim()
          || prestadores.find(x => x.id === p.prestador_id)?.nome_completo
          || "Sem prestador",
        custo_prestador: p.valor_servicos || 0,
        pedagio: p.pedagio || 0,
        adicionais: (p.adicionais || 0) + (p.valor_reembolsos || 0) + (p.valor_bonus || 0),
        valor_descontos: p.descontos || 0,
        status: p.status,
        data: p.periodo_inicio,
        tipo_operacao: p.origem_lancamento,
      }));
      setOss(mapped);
    } catch (e: any) {
      console.error("Erro ao buscar pagamentos do período:", e);
    }
  };

  const fetchEscalaRepasse = async () => {
    setEscalaRepasseLoading(true);
    try {
      let query = supabase
        .from("alocacoes_escala")
        .select("*")
        .eq("finalizada", true)
        .eq("is_teste", false);
      if (dataInicio) query = query.gte("data_escala", dataInicio);
      if (dataFim) query = query.lte("data_escala", dataFim);
      const { data, error } = await query.order("data_escala", { ascending: false });
      if (error) throw error;
      const faturaveis = (data || [])
        .map(mapearBancoParaLocal)
        .filter(isAlocacaoFaturavel);

      // MISSÃO A23-D: POD real via entregas_protocolo (fonte oficial)
      const alocIds = faturaveis.map((a: any) => a.id).filter(Boolean);
      const podMap = await buscarPODsDeAlocacoes(alocIds);

      const items = faturaveis.map((a: any) => escalaParaItemRepasse(a, podMap.get(a.id) || null));
      setEscalaRepasse(items);
    } catch (e) {
      console.warn("[PagamentoPrestadores] Erro ao buscar repasses da Escala:", e);
      setEscalaRepasse([]);
    } finally {
      setEscalaRepasseLoading(false);
    }
  };

  // FIN-BUG-06 — Busca da Caixa de Entrada: SEM filtro de período (dataInicio/
  // dataFim), sem filtro de prestador/origem. Uma pendência permanece visível
  // até ser aprovada ou reprovada, independentemente da data do lançamento.
  // Somente leitura (SELECT) — nenhuma mudança de schema/RPC/trigger.
  const fetchPendentesAprovacao = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_prestadores")
        .select("*")
        .eq("is_teste", false)
        .eq("status_aprovacao", "aguardando_aprovacao")
        .order("data_competencia", { ascending: false });
      if (error && error.code !== "42P01") throw error;
      setPendentesAprovacao((data || []) as Pagamento[]);
    } catch (e) {
      console.warn("[PagamentoPrestadores] Erro ao buscar pendentes de aprovação:", e);
      setPendentesAprovacao([]);
    }
  };

  const fetchPagamentos = async () => {
    try {
      let query = supabase
        .from("pagamentos_prestadores")
        .select("*")
        .eq("is_teste", false)
        .neq("status", "cancelado")
        .order("periodo_inicio", { ascending: false });

      // FIN-P1-02: Filtro de período
      if (dataInicio) query = query.gte("periodo_inicio", dataInicio);
      if (dataFim) query = query.lte("periodo_inicio", dataFim);

      // FIN-P1-02: Filtros por prestador e origem
      if (filtroPrestadorId !== TODOS_PRESTADORES_VALUE) {
        query = query.eq("prestador_id", filtroPrestadorId);
      }
      if (filtroOrigem !== "todos") {
        const origemMap: Record<string, string> = {
          ordem_servico: "os_direta",
          escala: "escala_direta",
          manual: "manual",
        };
        if (origemMap[filtroOrigem]) query = query.eq("origem_lancamento", origemMap[filtroOrigem]);
      }

      const { data, error } = await query;
      if (error && error.code !== "42P01") throw error;
      setPagamentos(data || []);

      // 05D.6D.1 — cliente REAL por vínculo operacional (os_id -> OS/alocação -> cliente_id)
      const osIds = Array.from(new Set((data || []).map((p: any) => p.os_id).filter(Boolean)));
      const osParaCliente: Record<string, string> = {};
      if (osIds.length > 0) {
        const [{ data: osData }, { data: alocData }] = await Promise.all([
          supabase.from("ordens_servico").select("id, cliente_id").in("id", osIds),
          supabase.from("alocacoes_escala").select("id, cliente_id").in("id", osIds),
        ]);
        (osData || []).forEach((o: any) => { if (o.cliente_id) osParaCliente[o.id] = o.cliente_id; });
        (alocData || []).forEach((a: any) => { if (a.cliente_id && !osParaCliente[a.id]) osParaCliente[a.id] = a.cliente_id; });
      }
      const cliIds = Array.from(new Set(Object.values(osParaCliente).filter(Boolean)));
      const nomePorCliente: Record<string, string> = {};
      if (cliIds.length > 0) {
        const { data: cliData } = await supabase.from("clientes").select("id, razao_social, nome_fantasia").in("id", cliIds);
        (cliData || []).forEach((c: any) => { nomePorCliente[c.id] = c.nome_fantasia || c.razao_social || ""; });
      }
      const mapa: Record<string, { clienteId: string; clienteNome: string }> = {};
      (data || []).forEach((p: any) => {
        const cliId = p.os_id ? osParaCliente[p.os_id] : "";
        mapa[p.id] = cliId ? { clienteId: cliId, clienteNome: nomePorCliente[cliId] || "" } : { clienteId: "", clienteNome: "" };
      });
      setPpClientes(mapa);
    } catch (e: any) {
      console.error("Erro ao buscar pagamentos:", e);
    }
  };

  // 05D.7B.3 — Fila unificada "Aptos para Lote" (todas as origens elegiveis)
  const fetchAptosLote = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_prestadores")
        .select("id, prestador_id, prestador_nome, os_id, os_numero, periodo_inicio, periodo_fim, data_competencia, valor_servicos, pedagio, adicionais, valor_liquido, status_conferencia, status_aprovacao, status_pagamento, status, elegivel_lote, lote_id, is_teste, tipo_pagamento, origem_lancamento")
        .eq("status_conferencia", "conferido")
        .eq("status_aprovacao", "aprovado")
        .eq("elegivel_lote", true)
        .is("lote_id", null)
        .eq("is_teste", false)
        .neq("tipo_pagamento", "fechamento")
        .not("status_pagamento", "in", "(pago,cancelado)")
        .order("periodo_inicio", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = (data || []) as unknown as AptoLote[];

      // cliente REAL por vinculo operacional (os_id -> OS/alocacao -> cliente)
      const osIds = Array.from(new Set(rows.map((r) => r.os_id).filter(Boolean))) as string[];
      const osParaCliente: Record<string, string> = {};
      if (osIds.length > 0) {
        const [{ data: osData }, { data: alocData }] = await Promise.all([
          supabase.from("ordens_servico").select("id, cliente_id").in("id", osIds),
          supabase.from("alocacoes_escala").select("id, cliente_id").in("id", osIds),
        ]);
        (osData || []).forEach((o: any) => { if (o.cliente_id) osParaCliente[o.id] = o.cliente_id; });
        (alocData || []).forEach((a: any) => { if (a.cliente_id && !osParaCliente[a.id]) osParaCliente[a.id] = a.cliente_id; });
      }
      const cliIds = Array.from(new Set(Object.values(osParaCliente).filter(Boolean)));
      const nomePorCliente: Record<string, string> = {};
      if (cliIds.length > 0) {
        const { data: cliData } = await supabase.from("clientes").select("id, razao_social, nome_fantasia").in("id", cliIds);
        (cliData || []).forEach((c: any) => { nomePorCliente[c.id] = c.nome_fantasia || c.razao_social || ""; });
      }
      setAptosLote(rows.map((r) => {
        const cliId = r.os_id ? osParaCliente[r.os_id] || null : null;
        return { ...r, cliente_id: cliId, cliente_nome: cliId ? nomePorCliente[cliId] || "" : "" };
      }));
    } catch (e: any) {
      console.error("[PagamentoPrestadores] Erro ao buscar aptos para lote:", e);
      setAptosLote([]);
    }
  };

  // FIN-P1-04: Buscar fechamentos REAIS (tipo_pagamento='fechamento')
  const fetchFechamentos = async () => {
    setFechamentosLoading(true);
    try {
      const params: { prestador_id?: string; periodo_inicio?: string; periodo_fim?: string } = {};
      if (filtroPrestadorId !== TODOS_PRESTADORES_VALUE) params.prestador_id = filtroPrestadorId;
      if (dataInicio) params.periodo_inicio = dataInicio;
      if (dataFim) params.periodo_fim = dataFim;
      const data = await listarFechamentos(params);
      setFechamentosReais(data);
    } catch (e: any) {
      console.error("Erro ao buscar fechamentos:", e);
      setFechamentosReais([]);
    } finally {
      setFechamentosLoading(false);
    }
  };

  // FIN-P1-04: Criar fechamento via fechamentoService
  const handleCriarFechamentoService = async (prestadorId: string, prestadorNome: string, prestadorDoc: string, itensIds: string[]) => {
    toast.error("Ação indisponível: criação de fechamento pendente de RPC oficial (S2).");
    return;
    // eslint-disable-next-line no-unreachable
    try {
      setFechamentoAcaoLoading(true);
      const input: CriarFechamentoInput = {
        prestador_id: prestadorId,
        prestador_nome: prestadorNome,
        prestador_documento: prestadorDoc,
        periodo_inicio: dataInicio,
        periodo_fim: dataFim,
        itens_ids: itensIds,
      };
      const resultado = await criarFechamentoService(input);
      toast.success(`Fechamento criado: ${resultado.quantidade_itens} itens, ${resultado.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
      await fetchFechamentos();
      await fetchPagamentos();
      await fetchOss();
      return resultado;
    } catch (e: any) {
      toast.error(`Erro ao criar fechamento: ${e.message}`);
      throw e;
    } finally {
      setFechamentoAcaoLoading(false);
    }
  };

  // FIN-P1-04: Conferir fechamento (RPC f_conferir_fechamento)
  const handleConferirFechamento = async () => {
    if (!fechamentoSelecionado) return;
    try {
      setFechamentoAcaoLoading(true);
      await conferirFechamento(fechamentoSelecionado.id);
      toast.success("Fechamento conferido!");
      setShowConferirFechamento(false);
      await fetchFechamentos();
    } catch (e: any) {
      toast.error(`Erro ao conferir: ${e.message}`);
    } finally {
      setFechamentoAcaoLoading(false);
    }
  };

  // FIN-P1-04: Aprovar fechamento (RPC f_aprovar_fechamento)
  const handleAprovarFechamento = async () => {
    if (!fechamentoSelecionado) return;
    try {
      setFechamentoAcaoLoading(true);
      await aprovarFechamento(fechamentoSelecionado.id);
      toast.success("Fechamento aprovado!");
      setShowAprovarFechamento(false);
      await fetchFechamentos();
    } catch (e: any) {
      toast.error(`Erro ao aprovar: ${e.message}`);
    } finally {
      setFechamentoAcaoLoading(false);
    }
  };

  // FIN-P1-04: Pagar fechamento (idempotente)
  const handlePagarFechamento = async () => {
    if (!fechamentoSelecionado) return;
    try {
      setFechamentoAcaoLoading(true);
      await pagarFechamento(fechamentoSelecionado.id, pagarData.dataPagamento, pagarData.contaFinanceiraId || undefined);
      toast.success("Pagamento registrado! (idempotente: segunda chamada = no-op)");
      setShowPagarFechamento(false);
      await fetchFechamentos();
      await fetchPagamentos();
      if (prestadorCC) fetchExtratoContaCorrente(prestadorCC);
    } catch (e: any) {
      toast.error(`Erro ao pagar: ${e.message}`);
    } finally {
      setFechamentoAcaoLoading(false);
    }
  };

  // FIN-P1-04: Cancelar fechamento (RPC f_cancelar_fechamento)
  const handleCancelarFechamento = async () => {
    if (!fechamentoSelecionado || !cancelarMotivo.trim()) {
      toast.error("Informe o motivo do cancelamento");
      return;
    }
    try {
      setFechamentoAcaoLoading(true);
      await cancelarFechamento(fechamentoSelecionado.id, cancelarMotivo.trim());
      toast.success("Fechamento cancelado!");
      setShowCancelarFechamento(false);
      setCancelarMotivo("");
      await fetchFechamentos();
      await fetchPagamentos();
      await fetchOss();
    } catch (e: any) {
      toast.error(`Erro ao cancelar: ${e.message}`);
    } finally {
      setFechamentoAcaoLoading(false);
    }
  };

  // FIN-P1-04: Abrir dialog de detalhe de fechamento real
  const handleAbrirFechamento = async (fechamentoId: string) => {
    try {
      const detalhado = await buscarFechamento(fechamentoId);
      setFechamentoSelecionado(detalhado);
      setPagarData({ dataPagamento: new Date().toISOString().split("T")[0], contaFinanceiraId: "", valorEfetivo: detalhado.valor_liquido });
    } catch (e: any) {
      toast.error(`Erro ao buscar fechamento: ${e.message}`);
    }
  };

  // FIN-PP-UX-FIX — Filtro de busca + cliente. O Cliente é resolvido por vínculo
  // operacional (os_id -> OS/alocação -> cliente) em `ppClientes`; aplicado aqui
  // para a Visão do Período (Aptos já filtra via filtrarAptosLote).
  const ossFiltrados = useMemo(() => {
    let base = oss;
    if (filtroClienteId && filtroClienteId !== TODOS_CLIENTES_VALUE) {
      base = base.filter(os => (ppClientes[os.id]?.clienteId || "") === filtroClienteId);
    }
    const q = filtroBusca.trim().toLowerCase();
    if (!q) return base;
    return base.filter(os =>
      (os.prestador || "").toLowerCase().includes(q) ||
      (os.numero || "").toLowerCase().includes(q)
    );
  }, [oss, filtroBusca, filtroClienteId, ppClientes]);

  const ossAgrupadas = useMemo(() => {
    const grupos: { [key: string]: OS[] } = {};
    (ossFiltrados || []).forEach(os => {
      const key = os.prestador || "sem_prestador";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(os);
    });
    return grupos;
  }, [ossFiltrados]);

  const totaisPorPrestador = useMemo(() => {
    const totais: { [key: string]: { quantidade: number; servicos: number; pedagio: number; adicionais: number; descontos: number; liquido: number } } = {};

    Object.entries(ossAgrupadas || {}).forEach(([prestador, osList]) => {
      const ajustados = valoresAjustados[prestador] || { reembolso: 0, bonus: 0, desconto: 0 };
      const totals = {
        quantidade: (osList || []).length,
        servicos: (osList || []).reduce((sum, os) => sum + (os.custo_prestador || 0), 0),
        pedagio: (osList || []).reduce((sum, os) => sum + (os.pedagio || 0), 0),
        adicionais: (osList || []).reduce((sum, os) => sum + (os.adicionais || 0), 0),
        descontos: (osList || []).reduce((sum, os) => sum + (os.descontos || 0), 0),
        liquido: 0
      };
      const resultado = calcularRepassePrestador({
        custo_prestador: totals.servicos,
        pedagio: totals.pedagio,
        adicionais: totals.adicionais,
        descontos: totals.descontos,
        reembolso: ajustados.reembolso,
        bonus: ajustados.bonus,
        descontoManual: ajustados.desconto,
      });
      totals.liquido = resultado.totalLiquido;
      totais[prestador] = totals;
    });

    return totais;
  }, [ossAgrupadas, valoresAjustados]);

  // 05D.6D — paginação da Visão do Período (sobre o conjunto COMPLETO filtrado)
  const prestadorRows = useMemo(() => Object.entries(totaisPorPrestador), [totaisPorPrestador]);
  const prestadorRowsPag = useMemo(() => {
    const inicio = (pagePeriodo - 1) * PAGE_SIZE_PAGTO;
    return prestadorRows.slice(inicio, inicio + PAGE_SIZE_PAGTO);
  }, [prestadorRows, pagePeriodo]);

  // 05D.6D — Relatório Financeiro: filtros sobre o conjunto COMPLETO antes de paginar
  const linhasRelatorio = useMemo(
    () => gerarLinhasRelatorio(
      pagamentos as any,
      pagamentosManuais as any,
      (p) => ppClientes[String(p.id)] || { clienteId: String(p.cliente_id || ""), clienteNome: String(p.cliente_nome || "") }
    ),
    [pagamentos, pagamentosManuais, ppClientes]
  );
  const nomePrestadorFiltro = useMemo(() => {
    if (filtroPrestadorId === TODOS_PRESTADORES_VALUE) return null;
    const p = prestadores.find((x) => x.id === filtroPrestadorId);
    return p?.nome_completo || null;
  }, [filtroPrestadorId, prestadores]);
  const filtrosRelatorio = useMemo<FiltrosLinhaRelatorio>(() => ({
    dataInicio,
    dataFim,
    prestadorNome: nomePrestadorFiltro,
    clienteId: filtroClienteId !== TODOS_CLIENTES_VALUE ? filtroClienteId : null,
    origem: filtroOrigem,
    status: filtroStatusRelatorio,
    busca: filtroBusca,
  }), [dataInicio, dataFim, nomePrestadorFiltro, filtroClienteId, filtroOrigem, filtroStatusRelatorio, filtroBusca]);
  const linhasRelatorioFiltradas = useMemo(
    () => filtrarLinhasRelatorio(linhasRelatorio, filtrosRelatorio),
    [linhasRelatorio, filtrosRelatorio]
  );
  const linhasRelatorioPagina = useMemo(
    () => paginarLinhas(linhasRelatorioFiltradas, pageRelatorio, PAGE_SIZE_PAGTO),
    [linhasRelatorioFiltradas, pageRelatorio]
  );

  // 05D.7B.3 — fila "Aptos para Lote": filtros (antes do slice) + paginacao
  const aptosFiltrados = useMemo(
    () => filtrarAptosLote(aptosLote as unknown as LinhaLote[], {
      dataInicio, dataFim,
      prestadorId: filtroPrestadorId !== TODOS_PRESTADORES_VALUE ? filtroPrestadorId : null,
      clienteId: filtroClienteId !== TODOS_CLIENTES_VALUE ? filtroClienteId : null,
      origem: filtroOrigem,
      busca: filtroBusca,
    }),
    [aptosLote, dataInicio, dataFim, filtroPrestadorId, filtroClienteId, filtroOrigem, filtroBusca]
  );
  const aptosPag = useMemo(() => paginarLinhas(aptosFiltrados, pageAptos, PAGE_SIZE_PAGTO), [aptosFiltrados, pageAptos]);
  const totalAptosLiquido = useMemo(() => totalLiquidoAptos(aptosFiltrados), [aptosFiltrados]);

  // ── REFORMULACAO-UI-PAGAMENTOS — FILA DE LIQUIDAÇÃO ─────────────────────
  // Lista as OSs e Programações Operacionais (origens os_direta / escala_direta)
  // FINALIZADAS no App e ainda aguardando liberação financeira (não pagas).
  // Somente leitura; a liberação usa as RPCs oficiais via service.
  const filaLiquidacaoFiltrada = useMemo(
    () =>
      filtrarFilaLiquidacao(pagamentos as any[], {
        prestadorId: filtroPrestadorId !== TODOS_PRESTADORES_VALUE ? filtroPrestadorId : null,
        busca: filtroBusca,
      }),
    [pagamentos, filtroBusca, filtroPrestadorId]
  );

  const resumoFilaLiquidacao = useMemo(
    () => calcularResumoFilaLiquidacao(filaLiquidacaoFiltrada),
    [filaLiquidacaoFiltrada]
  );

  const filaLiquidacaoPag = useMemo(
    () => paginarLinhas(filaLiquidacaoFiltrada, pageFilaLiquidacao, PAGE_SIZE_PAGTO),
    [filaLiquidacaoFiltrada, pageFilaLiquidacao]
  );

  // Libera o pagamento da fila: aprova (se preciso) e executa a baixa financeira
  // pelas RPCs oficiais, sem DML direto.
  const handleLiberarPagamentoFila = async (item: any) => {
    if (liberandoFilaId) return;
    setLiberandoFilaId(item.id);
    try {
      await liberarPagamentoPrestador(item.id, new Date().toISOString().split("T")[0]);
      toast.success("Pagamento liberado e baixado com sucesso!");
      registrarAuditoria({
        acao: "marcar_pago",
        entidade_tipo: "pagamento_prestador",
        entidade_id: item.id,
        prestador_id: item.prestador_id,
        prestador_nome: item.prestador_nome,
        valor_novo: item.valor_liquido,
        detalhes: {
          origem: "fila_liquidacao",
          os_numero: item.os_numero,
          origem_lancamento: item.origem_lancamento,
        },
      });
      await fetchPagamentos();
      await fetchPendentesAprovacao();
      await fetchAptosLote();
    } catch (e: any) {
      toast.error(`Erro ao liberar pagamento: ${e.message}`);
    } finally {
      setLiberandoFilaId(null);
    }
  };

  // 05D.7B.2/7B.3 — seleção e formação de lote (a RPC decide) — fila unificada
  const itensLoteSelecionados = useMemo(
    () => aptosLote.filter((p) => selecionadosLote.has(p.id)) as unknown as LinhaLote[],
    [aptosLote, selecionadosLote]
  );
  const resumoLote = useMemo(() => resumoLoteSelecionado(itensLoteSelecionados), [itensLoteSelecionados]);
  const toggleLote = (id: string, apto: boolean) => {
    if (!apto) return;
    setSelecionadosLote((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const handleGerarLote = async () => {
    if (itensLoteSelecionados.length === 0) return;
    setGerandoLote(true);
    try {
      const res = await gerarLotePagamentos(itensLoteSelecionados.map((p) => p.id));
      setLoteResultado(res);
      if (res.bloqueados > 0) {
        const motivos = Array.isArray(res.detalhes)
          ? Array.from(new Set((res.detalhes as any[]).map((d) => d?.motivo).filter(Boolean)))
          : [];
        toast.error(`Lote não gerado. Bloqueios: ${res.bloqueados}${motivos.length ? " — " + motivos.join(", ") : ""}`);
      } else if (res.lote_id) {
        toast.success(`Lote gerado com sucesso — ${res.lote_id.slice(0, 8)} · ${res.incluidos} pagamento(s)`);
        setSelecionadosLote(new Set());
        await fetchPagamentosManuais();
        await fetchPagamentos();
        await fetchAptosLote();
      } else if (res.ja_em_lote > 0) {
        toast.info(`Itens já pertencem ao lote ${String(res.lote_id || "").slice(0, 8)}`);
        setSelecionadosLote(new Set());
      }
    } catch (e: any) {
      toast.error(`Erro ao gerar lote: ${e.message}`);
    } finally {
      setGerandoLote(false);
    }
  };

  const handleAbrirDetalhe = (prestador: string) => {
    const p = prestadores.find(pr => pr.nome_completo === prestador);
    setSelectedPrestador(p || null);
    setShowDetalhe(true);
  };

  const handleGerarFechamento = async () => {
    if (!selectedPrestador || Object.keys(totaisPorPrestador[selectedPrestador.nome_completo] || {}).length === 0) {
      toast.error("Selecione um prestador com serviços no período");
      return;
    }

    const osDoPrestador = ossAgrupadas[selectedPrestador.nome_completo] || [];
    const itensIds = osDoPrestador.map(o => o.id).filter(Boolean);

    if (itensIds.length === 0) {
      toast.error("Nenhum item elegível para fechamento");
      return;
    }

    try {
      await handleCriarFechamentoService(
        selectedPrestador.id,
        selectedPrestador.nome_completo,
        selectedPrestador.cpf_cnpj,
        itensIds
      );

      registrarAuditoria({
        acao: 'gerar_fechamento',
        entidade_tipo: 'fechamento',
        prestador_id: selectedPrestador.id,
        prestador_nome: selectedPrestador.nome_completo,
        valor_novo: totaisPorPrestador[selectedPrestador.nome_completo]?.liquido || 0,
        detalhes: {
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          qtd_os: osDoPrestador.length,
          itens_ids: itensIds,
        },
      });

      setShowFechamento(false);
      setShowDetalhe(false);
    } catch (e: any) {
      console.error("Erro ao gerar fechamento:", e);
    }
  };

  const handleAtualizarAjuste = (prestador: string, tipo: "reembolso" | "bonus" | "desconto", valor: number) => {
    setValoresAjustados(prev => ({
      ...prev,
      [prestador]: {
        ...(prev[prestador] || { reembolso: 0, bonus: 0, desconto: 0 }),
        [tipo]: valor
      }
    }));
  };

  const handleConfirmarPagamento = async (pagamentoId: string) => {
    try {
      const { data: antes } = await supabase.from('pagamentos_prestadores').select('*').eq('id', pagamentoId).maybeSingle();
      if (!antes) { toast.error("Registro não encontrado"); return; }

      const sf = calcularStatusFinanceiro({
        statusConferencia: antes.status_conferencia,
        statusAprovacao: antes.status_aprovacao,
        valorLiquido: antes.valor_liquido,
      });
      if (!podeAprovar(sf)) {
        setJustificativaAlvo({ id: pagamentoId, updates: { status: "pago", data_pagamento: new Date().toISOString().split("T")[0] }, prestadorId: antes.prestador_id, prestadorNome: antes.prestador_nome });
        setJustificativaTexto("");
        setShowJustificativa(true);
        registrarAuditoria({
          acao: 'reprovar_pagamento', entidade_tipo: 'fechamento', entidade_id: pagamentoId,
          prestador_id: antes.prestador_id, prestador_nome: antes.prestador_nome,
          valor_anterior: antes.valor_liquido,
          detalhes: { status_anterior: antes.status, motivo_bloqueio: getMotivoBloqueio(sf), bloqueio_automatico: true },
        });
        return;
      }

      await confirmarPagamento(pagamentoId, new Date().toISOString().split("T")[0]);
      toast.success("Pagamento confirmado!");
      fetchPagamentos();

      registrarAuditoria({
        acao: 'marcar_pago',
        entidade_tipo: 'fechamento',
        entidade_id: pagamentoId,
        prestador_id: antes?.prestador_id,
        prestador_nome: antes?.prestador_nome,
        valor_anterior: antes?.valor_liquido,
        valor_novo: antes?.valor_liquido,
        detalhes: { status_anterior: antes?.status, status_novo: 'pago' },
      });
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  const handleSalvarNovoPagamento = async () => {
    if (criandoLancamento) return; // anti duplo-clique
    // Validações (espelham a RPC; erro local rápido antes de chamar o banco)
    if (!novoPagamento.prestadorId) {
      toast.error("Selecione um prestador");
      return;
    }
    if (!TIPOS_LANCAMENTO_MANUAL.includes(novoPagamento.tipoLancamento)) {
      toast.error("Selecione um tipo de lançamento válido");
      return;
    }
    if (!novoPagamento.dataCompetencia) {
      toast.error("Informe a data do lançamento");
      return;
    }
    if (!novoPagamento.valor || novoPagamento.valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }
    if (!novoPagamento.descricao.trim()) {
      toast.error("Informe a descrição do lançamento");
      return;
    }

    const prestadorSelecionado = prestadores.find(p => p.id === novoPagamento.prestadorId);
    if (!prestadorSelecionado) {
      toast.error("Prestador não encontrado");
      return;
    }
    const contaSelecionada = contasFinanceiras.find(c => c.id === novoPagamento.contaPagamento);
    // Chave de idempotência por submissão: retry do mesmo clique não duplica.
    const idempotencyKey = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setCriandoLancamento(true);
    try {
      // UI → service → RPC oficial (FP + PP atômicos). Zero DML direto.
      const resultado = await criarLancamentoManualPrestador({
        prestador_id: novoPagamento.prestadorId,
        tipo_lancamento: novoPagamento.tipoLancamento,
        data: novoPagamento.dataCompetencia,
        valor: novoPagamento.valor,
        descricao: novoPagamento.descricao,
        forma_pagamento: novoPagamento.formaPagamento || undefined,
        conta_pagamento: contaSelecionada ? contaSelecionada.nome : undefined,
        idempotencyKey,
      });

      toast.success(resultado.idempotente ? "Lançamento já registrado." : "Lançamento criado com sucesso!");

      // FIN-BUG-04 — verificação defensiva pós-gravação (somente leitura):
      // se o registro voltar sem prestador ou sem valor, avisa imediatamente em
      // vez de deixar a tela exibir "Não informado / R$ 0,00" depois.
      if (resultado.pagamento_prestador_id) {
        const { data: criadoRow } = await supabase
          .from("pagamentos_prestadores")
          .select("prestador_id, prestador_nome, valor_liquido, valor_servicos")
          .eq("id", resultado.pagamento_prestador_id)
          .maybeSingle();
        if (criadoRow && !normalizarPagamento(criadoRow).podeAprovar) {
          toast.warning("Lançamento gravado com dados incompletos (prestador/valor). Confira a Caixa de Entrada.");
        }
      }

      registrarAuditoria({
        acao: 'criar_pagamento',
        entidade_tipo: 'pagamento_prestador',
        entidade_id: resultado.pagamento_prestador_id || undefined,
        prestador_id: novoPagamento.prestadorId,
        prestador_nome: prestadorSelecionado.nome_completo,
        valor_novo: novoPagamento.valor,
        detalhes: {
          tipo_lancamento: novoPagamento.tipoLancamento,
          tipo_pagamento: novoPagamento.formaPagamento,
          descricao: novoPagamento.descricao,
          financeiro_pagar_id: resultado.financeiro_pagar_id,
          idempotente: resultado.idempotente,
        },
      });

      setShowNovoPagamento(false);
      setNovoPagamento({
        prestadorId: "",
        tipoLancamento: "Serviço Avulso",
        valor: 0,
        dataCompetencia: new Date().toISOString().split("T")[0],
        descricao: "",
        formaPagamento: "PIX",
        contaPagamento: "",
      });
      fetchPagamentosManuais();
      fetchPagamentos();
      // FIN-BUG-06 — o lançamento recém-criado entra imediatamente na fila
      // (mesma fonte do badge), sem depender do período selecionado.
      fetchPendentesAprovacao();
    } catch (e: any) {
      const mensagem = e?.message || e?.details || "Erro desconhecido ao salvar lançamento";
      console.error("[PagamentoPrestadores] Erro ao salvar lançamento manual:", mensagem, e);
      toast.error(`Erro ao salvar: ${mensagem}`);
    } finally {
      setCriandoLancamento(false);
    }
  };

  const handleMarcarPago = async (pagamentoId: string) => {
    try {
      const { data: antes } = await supabase.from('pagamentos_prestadores').select('*').eq('id', pagamentoId).maybeSingle();
      if (!antes) { toast.error("Registro não encontrado"); return; }

      const sf = calcularStatusFinanceiro({
        statusConferencia: antes.status_conferencia,
        statusAprovacao: antes.status_aprovacao,
        valorLiquido: antes.valor_liquido,
      });
      if (!podeAprovar(sf)) {
        setJustificativaAlvo({ id: pagamentoId, updates: { status: "pago", data_pagamento: new Date().toISOString().split("T")[0] }, prestadorId: antes.prestador_id, prestadorNome: antes.prestador_nome });
        setJustificativaTexto("");
        setShowJustificativa(true);
        registrarAuditoria({
          acao: 'reprovar_pagamento', entidade_tipo: 'pagamento_prestador', entidade_id: pagamentoId,
          prestador_id: antes.prestador_id, prestador_nome: antes.prestador_nome,
          valor_anterior: antes.valor_liquido,
          detalhes: { status_anterior: antes.status_pagamento, motivo_bloqueio: getMotivoBloqueio(sf), bloqueio_automatico: true },
        });
        return;
      }

      await confirmarPagamento(pagamentoId, new Date().toISOString().split("T")[0]);
      toast.success("Marcado como pago!");
      fetchPagamentos();

      registrarAuditoria({
        acao: 'marcar_pago',
        entidade_tipo: 'pagamento_prestador',
        entidade_id: pagamentoId,
        prestador_id: antes?.prestador_id,
        prestador_nome: antes?.prestador_nome,
        valor_anterior: antes?.valor_liquido,
        valor_novo: antes?.valor_liquido,
        detalhes: { status_anterior: antes?.status_pagamento, status_novo: 'pago' },
      });
    } catch (e: any) {
      toast.error(`Erro: ${e.message}`);
    }
  };

  // ── PP-UX-02C1C — Ações oficiais (reprovar / cancelar nao pago / estornar integral) ──
  const refetchAcaoPagamento = () => {
    fetchPagamentosManuais();
    fetchPagamentos();
    fetchOss();
  };

  const abrirReprovarPagamento = (p: any) => {
    setAcaoPagamento(p);
    setMotivoAcaoPagamento("");
    setAcaoPagamentoAviso(null);
    setShowReprovarPagamento(true);
  };

  const abrirCancelarPagamento = (p: any) => {
    setAcaoPagamento(p);
    setMotivoAcaoPagamento("");
    setAcaoPagamentoAviso(null);
    setShowCancelarPagamento(true);
  };

  const abrirEstornarPagamento = (p: any) => {
    setAcaoPagamento(p);
    setMotivoAcaoPagamento("");
    setAcaoPagamentoAviso(null);
    setShowEstornarPagamento(true);
  };

  const handleReprovarPagamento = async () => {
    if (!acaoPagamento) return;
    setAcaoPagamentoLoading(true);
    try {
      const res = await reprovarPagamento(acaoPagamento.id, motivoAcaoPagamento.trim() || undefined);
      if (!res.sucesso) {
        toast.error(res.mensagem || "Nao foi possivel reprovar o pagamento.");
        return;
      }
      toast.success("Pagamento reprovado.");
      registrarAuditoria({
        acao: "reprovar_pagamento",
        entidade_tipo: "pagamento_prestador",
        entidade_id: acaoPagamento.id,
        prestador_id: acaoPagamento.prestador_id,
        prestador_nome: acaoPagamento.prestador_nome,
        valor_anterior: acaoPagamento.valor_liquido,
        detalhes: { status_novo: "reprovado", motivo: motivoAcaoPagamento.trim() || null },
      });
      setShowReprovarPagamento(false);
      setAcaoPagamento(null);
      setMotivoAcaoPagamento("");
      refetchAcaoPagamento();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setAcaoPagamentoLoading(false);
    }
  };

  const handleCancelarPagamento = async () => {
    if (!acaoPagamento) return;
    setAcaoPagamentoLoading(true);
    try {
      const res = await cancelarPagamento(acaoPagamento.id, motivoAcaoPagamento.trim() || undefined);
      if (!res.sucesso) {
        if (res.mensagem === "NECESSARIO_ESTORNO") {
          setAcaoPagamentoAviso("Existe pagamento/baixa registrada para esta obrigacao. O cancelamento nao se aplica — utilize ESTORNAR PAGAMENTO.");
          toast.error("Nao e possivel cancelar: existe baixa registrada. Utilize Estornar pagamento.");
          return;
        }
        toast.error(res.mensagem || "Nao foi possivel cancelar o pagamento.");
        return;
      }
      toast.success("Pagamento cancelado.");
      registrarAuditoria({
        acao: "cancelar_pagamento",
        entidade_tipo: "pagamento_prestador",
        entidade_id: acaoPagamento.id,
        prestador_id: acaoPagamento.prestador_id,
        prestador_nome: acaoPagamento.prestador_nome,
        valor_anterior: acaoPagamento.valor_liquido,
        detalhes: { status_novo: "cancelado", motivo: motivoAcaoPagamento.trim() || null },
      });
      setShowCancelarPagamento(false);
      setAcaoPagamento(null);
      setMotivoAcaoPagamento("");
      refetchAcaoPagamento();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setAcaoPagamentoLoading(false);
    }
  };

  const handleEstornarPagamento = async () => {
    if (!acaoPagamento) return;
    if (!motivoAcaoPagamento.trim()) {
      toast.error("Informe o motivo do estorno.");
      return;
    }
    setAcaoPagamentoLoading(true);
    try {
      const res = await estornarPagamento(acaoPagamento.id, motivoAcaoPagamento.trim());
      if (!res.sucesso) {
        if (res.mensagem === "BLOCKED_PAGAMENTO_PARCIAL") {
          setAcaoPagamentoAviso("Pagamento parcial requer tratamento especifico e nao pode ser estornado por esta acao.");
          toast.error("Pagamento parcial requer tratamento especifico e nao pode ser estornado por esta acao.");
          return;
        }
        toast.error(res.mensagem || "Nao foi possivel estornar o pagamento.");
        return;
      }
      toast.success("Pagamento estornado. Obrigacao financeira reaberta.");
      registrarAuditoria({
        acao: "estornar_pagamento",
        entidade_tipo: "pagamento_prestador",
        entidade_id: acaoPagamento.id,
        prestador_id: acaoPagamento.prestador_id,
        prestador_nome: acaoPagamento.prestador_nome,
        valor_anterior: acaoPagamento.valor_liquido,
        detalhes: { status_novo: "pendente", motivo: motivoAcaoPagamento.trim(), baixa_id: res.baixa_id ?? null, fp_status: res.fp_status ?? null },
      });
      setShowEstornarPagamento(false);
      setAcaoPagamento(null);
      setMotivoAcaoPagamento("");
      refetchAcaoPagamento();
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setAcaoPagamentoLoading(false);
    }
  };

  const totalGeral = useMemo(() => {
    return Object.values(totaisPorPrestador).reduce((acc, t) => acc + t.liquido, 0);
  }, [totaisPorPrestador]);

  const totalOS = useMemo(() => {
    return ossFiltrados.length;
  }, [ossFiltrados]);

  const ossNumeros = useMemo(() => new Set((ossFiltrados || []).map(o => o.numero)), [ossFiltrados]);

  const escalaRepasseDedup = useMemo(() => {
    return (escalaRepasse || []).filter(item => !ossNumeros.has(item.os));
  }, [escalaRepasse, ossNumeros]);

  const escalaAgrupada = useMemo(() => {
    const grupos: { [key: string]: ItemRepasseEscala[] } = {};
    (escalaRepasseDedup || []).forEach(item => {
      const key = item.prestadorNome || "sem_prestador";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(item);
    });
    return grupos;
  }, [escalaRepasseDedup]);

  const totalEscalaRepasse = useMemo(() => {
    return (escalaRepasseDedup || []).reduce((acc, item) => acc + item.valorTotal, 0);
  }, [escalaRepasseDedup]);

  // ── FIN-MOT-1H2: extrato a partir do fechamento REAL (fonte: pagamentos_prestadores) ──
  const mascararDocumentoH2 = (doc?: string) => {
    if (!doc) return "";
    if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    return doc;
  };

  const formatarMoedaH2 = (v: number | null | undefined) =>
    (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatarDataH2 = (d?: string) => fmtDateLocal(d);

  const statusPagamentoLabelH2 = (p: any) => {
    if (p.status === "pago" || p.status_pagamento === "pago") return "Pago";
    if (p.status_pagamento === "em_lote") return "Em Lote";
    if (p.status_pagamento === "programado") return "Programado";
    if (p.status_pagamento === "cancelado" || p.status === "cancelado") return "Cancelado";
    return "Pendente";
  };

  const handleVerExtrato = async (pagamento: any) => {
    setExtratoLoading(true);
    setShowExtrato(true);
    try {
      const extrato = await ExtratoPrestadorService.construirExtratoDeFechamento(pagamento);
      setExtratoSelecionado(extrato);
    } catch (e: any) {
      console.error("[PagamentoPrestadores] Erro ao montar extrato:", e);
      toast.error(`Erro ao montar extrato: ${e.message}`);
      setExtratoSelecionado(null);
    } finally {
      setExtratoLoading(false);
    }
  };

  const handleGerarPDFExtrato = async (pagamento: any) => {
    try {
      let extrato = extratoSelecionado;
      if (pagamento && (!extrato || extrato.id !== pagamento.id)) {
        extrato = await ExtratoPrestadorService.construirExtratoDeFechamento(pagamento);
      }
      if (!extrato) throw new Error("Não foi possível montar o extrato");
      await generateExtratoPrestadorPDF(enriquecerExtratoComClientes(extrato));
      toast.success("PDF gerado com sucesso!");
    } catch (e: any) {
      console.error("[PagamentoPrestadores] Erro ao gerar PDF:", e);
      toast.error(`Erro ao gerar PDF: ${e.message}`);
    }
  };

  // FIN-MOT-2K — resolve o NOME REAL do cliente a partir da lista já carregada,
  // substituindo UUID/placeholder no extrato ANTES de montar o PDF.
  const enriquecerExtratoComClientes = (extrato: ExtratoFechamentoPrestador): ExtratoFechamentoPrestador => {
    const nomePorId = new Map<string, string>(
      clientes.filter(c => Boolean(c.id?.trim())).map(c => [c.id, (c.nome_fantasia || c.razao_social || '').trim()])
    );
    const resolver = (valor?: string): string | undefined => {
      if (!valor) return undefined;
      const t = String(valor).trim();
      if (t === 'Todos' || t === 'todos') return 'Todos os clientes';
      if (nomePorId.has(t)) return nomePorId.get(t);
      return undefined;
    };

    const proximo = { ...extrato };
    const nomeCliente = resolver(proximo.clienteLabel);
    if (nomeCliente) proximo.clienteLabel = nomeCliente;
    if (proximo.operacoes && proximo.operacoes.length > 0) {
      proximo.operacoes = proximo.operacoes.map((op) => {
        const nome = resolver(op.cliente_nome);
        return nome ? { ...op, cliente_nome: nome } : op;
      });
    }
    return proximo;
  };

  // FIN-MOT-2H — gerar extrato consultivo usando os filtros do painel (sem formulário duplicado)
  const handleGerarExtratoPeriodo = async () => {
    if (!filtroPrestadorId || filtroPrestadorId === TODOS_PRESTADORES_VALUE) {
      toast.error("Selecione um prestador para gerar o extrato");
      return;
    }
    if (!dataInicio || !dataFim) {
      toast.error("Informe o período (data inicial e final)");
      return;
    }
    setExtratoLoading(true);
    setShowExtrato(true);
    try {
      const extrato = await ExtratoPrestadorService.construirExtratoPorPeriodo({
        prestadorId: filtroPrestadorId,
        dataInicio,
        dataFim,
        clienteId: filtroClienteId === TODOS_CLIENTES_VALUE ? undefined : filtroClienteId,
        origem: filtroOrigem || "todos",
      });
      setExtratoSelecionado(enriquecerExtratoComClientes(extrato));
    } catch (e: any) {
      console.error("[PagamentoPrestadores] Erro ao gerar extrato por período:", e);
      toast.error(`Erro ao gerar extrato: ${e.message}`);
      setExtratoSelecionado(null);
    } finally {
      setExtratoLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-500" />
            Pagamento de Prestadores
          </h2>
          <p className="text-muted-foreground">Fechamento e pagamento de prestadores por período</p>
        </div>
            <Button className="bg-green-600 hover:bg-green-700" title="Criar obrigação manual de prestador (serviço avulso, ajuste, reembolso ou adiantamento)" onClick={() => setShowNovoPagamento(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Lançamento
        </Button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="h-auto w-full justify-start gap-1 rounded-xl bg-muted/60 p-1.5 overflow-x-auto">
          <TabsTrigger value="fila">Fila de Liquidação</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard Operacional</TabsTrigger>
          <TabsTrigger value="listagem">Fechamentos e Pagamentos</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório Financeiro</TabsTrigger>
          <TabsTrigger value="conta-corrente">Conta Corrente</TabsTrigger>
        </TabsList>
        {/* REFORMULACAO-UI-PAGAMENTOS — Visão primária: Fila de Liquidação */}
        <TabsContent value="fila" className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-amber-50/40 border-amber-100">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Fila de Liquidação</p>
                <p className="text-xl font-extrabold text-amber-700 mt-1">{fmtMoeda(resumoFilaLiquidacao.liquido)}</p>
                <p className="text-xs text-amber-500 mt-0.5">{resumoFilaLiquidacao.qtd} serviço(s) aguardando liberação</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-50/40 border-slate-100">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Bruto</p>
                <p className="text-xl font-extrabold text-slate-700 mt-1">{fmtMoeda(resumoFilaLiquidacao.bruto)}</p>
                <p className="text-xs text-slate-500 mt-0.5">Serviços + adicionais + pedágio</p>
              </CardContent>
            </Card>
            <Card className="bg-rose-50/40 border-rose-100">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Descontos</p>
                <p className="text-xl font-extrabold text-rose-700 mt-1">{fmtMoeda(resumoFilaLiquidacao.descontos)}</p>
                <p className="text-xs text-rose-500 mt-0.5">Descontos + adiantamentos</p>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50/40 border-emerald-100">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Valor Líquido</p>
                <p className="text-xl font-extrabold text-emerald-700 mt-1">{fmtMoeda(resumoFilaLiquidacao.liquido)}</p>
                <p className="text-xs text-emerald-500 mt-0.5">Total a liberar</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-orange-500" /> Fila de Liquidação
                  </CardTitle>
                  <CardDescription>
                    OSs e Programações Operacionais finalizadas no aplicativo aguardando liberação financeira.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Prestador</Label>
                    <Select value={filtroPrestadorId} onValueChange={setFiltroPrestadorId}>
                      <SelectTrigger className="w-48" title="Filtrar por prestador">
                        <SelectValue placeholder="Todos os prestadores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TODOS_PRESTADORES_VALUE}>Todos os prestadores</SelectItem>
                        {prestadores.filter(p => Boolean(p.id?.trim())).map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Buscar</Label>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input
                        value={filtroBusca}
                        onChange={e => setFiltroBusca(e.target.value)}
                        placeholder="Prestador, OS..."
                        className="w-44 pl-7"
                      />
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => fetchPagamentos()} title="Recarregar fila de liquidação">
                    <RefreshCw className="w-4 h-4 mr-2" /> Recarregar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filaLiquidacaoPag.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum serviço aguardando liberação</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    As OSs e Programações finalizadas no aplicativo aparecem aqui automaticamente.
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Serviço / OS</TableHead>
                        <TableHead className="text-right">Valor Bruto</TableHead>
                        <TableHead className="text-right">Descontos</TableHead>
                        <TableHead className="text-right">Valor Líquido</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filaLiquidacaoPag.map((item: any) => {
                        const v = calcularFilaValores(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <p className="text-sm font-medium">
                                {nomeOuNaoInformado(item.prestador_nome || nomePrestadorPorId[item.prestador_id])}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {item.prestador_documento ? mascararCPF(item.prestador_documento) : "—"}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{item.os_numero || `#${String(item.id).slice(0, 8)}`}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {labelOrigem(item.origem_lancamento)}
                                </Badge>
                                {item.status_pagamento && item.status_pagamento !== "pendente" && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {labelStatusGenerico(item.status_pagamento)}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">{fmtMoeda(v.bruto)}</TableCell>
                            <TableCell className="text-right font-mono text-sm text-red-600">
                              {v.descontos > 0 ? `- ${fmtMoeda(v.descontos)}` : fmtMoeda(0)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm font-bold text-orange-600">
                              {fmtMoeda(v.liquido)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                                title="Liberar pagamento"
                                disabled={liberandoFilaId === item.id}
                                onClick={() => handleLiberarPagamentoFila(item)}
                              >
                                <Check className="w-3.5 h-3.5 mr-1" />
                                {liberandoFilaId === item.id ? "Liberando..." : "Liberar Pagamento"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <PaginationBar
                    page={pageFilaLiquidacao}
                    pageSize={PAGE_SIZE_PAGTO}
                    totalCount={filaLiquidacaoFiltrada.length}
                    onPageChange={setPageFilaLiquidacao}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dashboard" className="space-y-4">
          {(() => {
            const kpis = calcularKPIPrestador(pagamentos as any, pagamentosManuaisPeriodo as any, escalaRepasse);
            const alertas = gerarAlertas(kpis, kpis.divergencias, escalaRepasseDedup.length);
            const distribuicao = calcularDistribuicaoStatus(pagamentos as any, pagamentosManuaisPeriodo as any);
            const CORES = { pendente: "#F59E0B", pago: "#10B981", cancelado: "#EF4444", divergente: "#8B5CF6", agendado: "#3B82F6", em_lote: "#6366F1" };

            const fmt = fmtMoeda;
            const totalGeral = kpis.totalAPagar + kpis.totalPago;

            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="bg-emerald-50/40 border-emerald-100">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Pago</p>
                      <p className="text-xl font-extrabold text-emerald-700 mt-1">{fmt(kpis.totalPago)}</p>
                      <p className="text-xs text-emerald-500 mt-0.5">{kpis.qtdPagos} registro(s)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-amber-50/40 border-amber-100">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total a Pagar</p>
                      <p className="text-xl font-extrabold text-amber-700 mt-1">{fmt(kpis.totalAPagar)}</p>
                      <p className="text-xs text-amber-500 mt-0.5">{kpis.qtdPendentes} pendente(s)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50/40 border-red-100">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Divergências</p>
                      <p className="text-xl font-extrabold text-red-700 mt-1">{kpis.divergencias}</p>
                      <p className="text-xs text-red-500 mt-0.5">{kpis.qtdDivergentes} registro(s)</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50/40 border-blue-100">
                    <CardContent className="p-4">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bloqueados (sem prestador ou valor ≤ 0)</p>
                      <p className="text-xl font-extrabold text-blue-700 mt-1">{kpis.bloqueados}</p>
                      <p className="text-xs text-blue-500 mt-0.5">{kpis.qtdPeriodo} lançamento(s) no período</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={distribuicao}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                            {distribuicao.map((d, i) => (
                              <Cell key={i} fill={(CORES as any)[d.status] || "#94A3B8"} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Proporção</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={distribuicao} dataKey="quantidade" nameKey="status" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                            {distribuicao.map((d, i) => (
                              <Cell key={i} fill={(CORES as any)[d.status] || "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {alertas.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm text-amber-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alertas Financeiros</CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {alertas.map(a => (
                          <div key={a.tipo} className={`rounded-lg border p-3 ${a.gravidade === "alta" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-bold uppercase text-muted-foreground">{a.label}</p>
                              <Badge variant="outline" className={`text-[10px] ${a.gravidade === "alta" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{a.quantidade}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{a.descricao}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </TabsContent>
        <TabsContent value="listagem" className="space-y-4">
          <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-4">
            {/* FIN-P1-02: Navegação por mês */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesOffset(m => m - 1)}>
                <Calendar className="w-3 h-3" />
              </Button>
              <div className="text-center min-w-[140px]">
                <p className="text-sm font-semibold capitalize">{mesAtualStr}</p>
                {mesOffset !== 0 && (
                  <button onClick={() => setMesOffset(0)} className="text-[10px] text-blue-600 underline">Voltar ao mês atual</button>
                )}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesOffset(m => m + 1)}>
                <Calendar className="w-3 h-3" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prestador</Label>
              <Select value={filtroPrestadorId} onValueChange={setFiltroPrestadorId}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Todos os prestadores" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_PRESTADORES_VALUE}>Todos os prestadores</SelectItem>
                  {prestadores.filter(p => Boolean(p.id?.trim())).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Última semana</SelectItem>
                  <SelectItem value="quinzena">Última quincena</SelectItem>
                  <SelectItem value="mes">Último mês</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <Select
                value={filtroClienteId}
                onValueChange={setFiltroClienteId}
                disabled={["pendentes", "manuais", "anteriores", "repasses"].includes(subAba)}
              >
                <SelectTrigger
                  className="w-44 disabled:opacity-50"
                  title={["pendentes", "manuais", "anteriores", "repasses"].includes(subAba)
                    ? "Filtro de cliente não se aplica a esta visão"
                    : "Filtrar por cliente (Visão do Período / Aptos para Lote)"}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS_CLIENTES_VALUE}>Todos os clientes</SelectItem>
                  {clientes.filter(c => Boolean(c.id?.trim())).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Origem/Tipo</Label>
              <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ordem_servico">Ordem de Serviço</SelectItem>
                  <SelectItem value="escala">Programação</SelectItem>
                  <SelectItem value="manual">Lançamento Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  value={filtroBusca}
                  onChange={e => setFiltroBusca(e.target.value)}
                  placeholder="Prestador, OS..."
                  className="w-40 pl-7"
                />
              </div>
            </div>
            <Button variant="outline" onClick={() => { fetchOss(); fetchPagamentos(); fetchFechamentos(); fetchPendentesAprovacao(); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              title="Gerar extrato do prestador com os filtros selecionados"
              onClick={handleGerarExtratoPeriodo}
            >
              <FileText className="w-4 h-4 mr-2" /> Gerar Extrato
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="pt-1">
        <Tabs value={subAba} onValueChange={setSubAba}>
          <TabsList className="h-auto w-full justify-start gap-1 rounded-lg border border-border/60 bg-card p-1">
            <TabsTrigger value="pendentes" className="flex-none gap-1.5">
              <Inbox className="w-3.5 h-3.5" /> Pendentes de Aprovação
              {filaAprovacao.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {filaAprovacao.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="aptos" className="flex-none">Aptos para Lote</TabsTrigger>
            {/* FIN-BUG-05 — visões de consulta consolidadas em um único menu,
                mantendo o fluxo principal enxuto (aprovar + lote). */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 flex-none gap-1 px-3 text-xs text-muted-foreground">
                  Mais visões <ChevronDown className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onSelect={() => setSubAba("periodo")}>
                  <Calendar className="w-4 h-4 mr-2" /> Visão do Período
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSubAba("manuais")}>
                  <DollarSign className="w-4 h-4 mr-2" /> Pagamentos Manuais
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSubAba("anteriores")}>
                  <Layers className="w-4 h-4 mr-2" /> Fechamentos Anteriores
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSubAba("repasses")}>
                  <Truck className="w-4 h-4 mr-2" /> Repasses da Programação
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TabsList>

        {/* FIN-BUG-04 — Caixa de Entrada: pendentes de aprovação (lançamentos
            manuais e demais obrigações) com resumo bancário e ação oficial. */}
        <TabsContent value="pendentes" className="space-y-4">
          {/* FIN-BUG-07 — Hierarquia banking premium: resumo e alertas no topo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Aguardando aprovação</p>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">{fmtMoeda(resumoFila.pendentes.valor)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{resumoFila.pendentes.qtd} lançamento(s) na fila</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Aprovados a pagar</p>
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-indigo-700">{fmtMoeda(resumoPeriodo.aprovados.valor)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{resumoPeriodo.aprovados.qtd} aguardando lote/pagamento</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Bloqueados</p>
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-red-700">{fmtMoeda(resumoFila.bloqueados.valor)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{resumoFila.bloqueados.qtd} sem prestador ou valor inválido</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Pago no período</p>
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{fmtMoeda(resumoPeriodo.pagosMes.valor)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{resumoPeriodo.pagosMes.qtd} pagamento(s) confirmado(s)</p>
            </div>
          </div>

          {resumoFila.fantasmas.qtd > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/60 p-3 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  {resumoFila.fantasmas.qtd} lançamento(s) sem prestador vinculado (registro fantasma)
                </p>
                <p className="mt-0.5 text-red-700/80">
                  Estes registros não podem ser aprovados nem pagos pela RPC oficial. Regularize o vínculo ou cancele o lançamento.
                </p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-[#F97316]" /> Caixa de Entrada — Pendentes de Aprovação
                </CardTitle>
                <CardDescription className="text-xs">
                  Fila global — independe do filtro de período. Aprovar aqui aplica a RPC oficial (confere + aprova + elegível a lote); não executa pagamento.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border max-h-[60vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Origem / Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaAprovacao.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="font-medium">Nenhum lançamento pendente de aprovação</p>
                          <p className="text-xs mt-1">Novos lançamentos manuais aparecem aqui até serem conferidos e aprovados.</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filaAprovacao.map((p) => {
                        const nv = normalizarPagamento(p, nomePrestadorPorId);
                        const bloqueio = nv.motivoBloqueio === "SEM_PRESTADOR"
                          ? "Sem prestador vinculado"
                          : nv.motivoBloqueio === "VALOR_INVALIDO"
                            ? "Valor inválido (R$ 0,00)"
                            : null;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDateLocal(p.data_competencia || p.periodo_inicio || p.created_at)}</TableCell>
                            <TableCell className="text-xs font-medium">
                              {nv.prestadorNome || <span className="text-red-600">Sem prestador</span>}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">{labelOrigem(p.origem_lancamento)}</Badge>
                              <span className="ml-2 text-muted-foreground">{p.tipo_lancamento || "—"}</span>
                            </TableCell>
                            <TableCell className="text-xs max-w-[280px] truncate" title={p.observacao || ""}>{p.observacao || "—"}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-orange-600">
                              {fmtMoeda(nv.valor)}
                              {nv.valorLegado && (
                                <span className="ml-1 text-[10px] font-normal text-amber-600" title="Valor legado (valor_liquido zerado; exibindo valor_servicos)">legado</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {bloqueio ? (
                                <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{bloqueio}</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Aguardando aprovação</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
                                  title="Conferir e aprovar"
                                  disabled={!nv.podeAprovar || aprovandoFilaId === p.id}
                                  onClick={() => aprovarDaFila(p)}
                                >
                                  {aprovandoFilaId === p.id ? <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                                  Aprovar
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  title="Reprovar"
                                  onClick={() => abrirReprovarPagamento(p)}
                                >
                                  <FileX className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="periodo" className="space-y-4">
          {prestadorRows.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Nenhum repasse encontrado no período selecionado</p>
                <p className="text-xs mt-1">Ajuste os filtros de período, prestador ou origem para visualizar os repasses.</p>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total títulos no período", value: totalOS, color: "text-foreground", accent: "bg-slate-500" },
              { label: "Prestadores no período", value: Object.keys(ossAgrupadas).length, color: "text-violet-500", accent: "bg-violet-500" },
              { label: "Total a pagar", value: totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-amber-500", accent: "bg-amber-500" },
              { label: "Pagamentos confirmados", value: ossFiltrados.filter(o => o.status === "pago").length, color: "text-emerald-500", accent: "bg-emerald-500" },
            ].map(k => (
              <div key={k.label} className="relative overflow-hidden bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.accent}`} />
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prestador</TableHead>
                <TableHead>Qtd Repasses</TableHead>
                <TableHead>Valor Serviços</TableHead>
                <TableHead>Pedágio/Adicional</TableHead>
                <TableHead>Ajustes</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestadorRowsPag.map(([prestador, total]) => (
                <TableRow key={prestador}>
                  <TableCell className="font-medium">{nomeOuNaoInformado(prestador)}</TableCell>
                  <TableCell>{total.quantidade}</TableCell>
                  <TableCell>{total.servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell>{(total.pedagio + total.adicionais).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell>
                    <span className="text-green-600">+{((valoresAjustados[prestador]?.reembolso || 0) + (valoresAjustados[prestador]?.bonus || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    <span className="text-red-600"> -{((valoresAjustados[prestador]?.desconto || 0) + total.descontos).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  </TableCell>
                  <TableCell className="font-bold text-orange-600">{total.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => handleAbrirDetalhe(prestador)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            </Table>
            <PaginationBar
              page={pagePeriodo}
              pageSize={PAGE_SIZE_PAGTO}
              totalCount={prestadorRows.length}
              onPageChange={setPagePeriodo}
            />
            </CardContent>
          </Card>
          )}
        </TabsContent>

        <TabsContent value="aptos" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-lg">Aptos para Lote</CardTitle>
                <CardDescription className="text-xs">
                  Todas as origens (OS direta, Programação, Manual) · conferido + aprovado + elegível + sem lote + não teste/agregado
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl border bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Aptos (filtro)</p><p className="text-lg font-extrabold">{aptosFiltrados.length}</p></div>
                <div className="rounded-xl border bg-violet-50 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Prestadores (filtro)</p><p className="text-lg font-extrabold">{new Set(aptosFiltrados.map((p) => p.prestador_id || p.prestador_nome)).size}</p></div>
                <div className="rounded-xl border bg-indigo-50 border-indigo-100 p-3"><p className="text-[10px] font-semibold uppercase text-muted-foreground">Total líquido (filtro)</p><p className="text-lg font-extrabold text-indigo-700">{fmtMoeda(totalAptosLiquido)}</p></div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <Badge variant="outline" className="text-xs">Selecionados: {itensLoteSelecionados.length} · {fmtMoeda(resumoLote.totalLiquido)}</Badge>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelecionadosLote((prev) => new Set([...prev, ...aptosPag.map((p) => p.id)]))} disabled={aptosPag.length === 0} title="Selecionar os itens visíveis nesta página">
                    Selecionar visíveis
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelecionadosLote(new Set())} disabled={itensLoteSelecionados.length === 0} title="Limpar a seleção de itens">
                    Limpar seleção
                  </Button>
                  <Button
                    className="bg-indigo-600 hover:bg-indigo-700"
                    disabled={itensLoteSelecionados.length === 0}
                    onClick={() => { setLoteResultado(null); setShowModalLote(true); }}
                    title="Formar ordem/lote de pagamento com os itens selecionados"
                  >
                    <Layers className="w-4 h-4 mr-2" /> Gerar Ordem/Lote de Pagamento ({itensLoteSelecionados.length})
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Serviço</TableHead>
                    <TableHead className="text-right">Pedágio</TableHead>
                    <TableHead className="text-right">Adicional</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Conf.</TableHead>
                    <TableHead>Aprov.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {aptosFiltrados.length === 0 ? (
                    <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Nenhum pagamento apto para lote</TableCell></TableRow>
                  ) : (
                    aptosPag.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-indigo-600"
                            checked={selecionadosLote.has(p.id)}
                            onChange={() => toggleLote(p.id, isAptoLote(p as unknown as LinhaLote))}
                            title="Selecionar para lote"
                          />
                        </TableCell>
                        <TableCell className="text-xs font-medium">{nomeOuNaoInformado(p.prestador_nome)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDateLocal(p.periodo_inicio || p.data_competencia)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtPeriodo(p.periodo_inicio, p.periodo_fim)}</TableCell>
                        <TableCell className="text-xs">{p.os_numero || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">{p.cliente_nome || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs">
                          {labelOrigem(p.origem_lancamento)}
                        </TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtMoeda(Number(p.valor_servicos) || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtMoeda(Number(p.pedagio) || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-mono">{fmtMoeda(Number(p.adicionais) || 0)}</TableCell>
                        <TableCell className="text-xs text-right font-mono font-bold">{fmtMoeda(Number(p.valor_liquido) || 0)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">{p.status_conferencia}</Badge></TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">{p.status_aprovacao}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <PaginationBar page={pageAptos} pageSize={PAGE_SIZE_PAGTO} totalCount={aptosFiltrados.length} onPageChange={setPageAptos} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manuais" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Pagamentos Manuais</CardTitle>
              <CardDescription>Pagamentos avulsos ou ajustes criados manualmente</CardDescription>
            </CardHeader>
            <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>Tipo / Origem</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentosManuais.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento manual criado
                    </TableCell>
                  </TableRow>
              ) : (
                pagamentosManuais.map(p => {
                  const nv = normalizarPagamento(p, nomePrestadorPorId);
                  const bloqueio = nv.motivoBloqueio === "SEM_PRESTADOR"
                    ? "Sem prestador"
                    : nv.motivoBloqueio === "VALOR_INVALIDO"
                      ? "Valor inválido"
                      : null;
                  return (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs whitespace-nowrap">{fmtDateLocal(p.data_competencia || p.created_at)}</TableCell>
                    <TableCell className="text-xs font-medium">
                      {nv.prestadorNome || <span className="text-red-600">Sem prestador vinculado</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">{p.tipo_lancamento || "Manual"}</Badge>
                      <span className="ml-2 text-muted-foreground">{labelOrigem(p.origem_lancamento)}</span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[280px] truncate" title={p.observacao || ""}>
                      {p.observacao || (p.os_numero ? `OS: ${p.os_numero}` : "—")}
                    </TableCell>
                    <TableCell className="text-xs text-right font-mono font-bold text-orange-600">
                      {fmtMoeda(nv.valor)}
                      {nv.valorLegado && (
                        <span className="ml-1 text-[10px] font-normal text-amber-600" title="Valor legado (valor_liquido zerado; exibindo valor_servicos)">legado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {bloqueio ? (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{bloqueio}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
                            {p.status_conferencia === 'conferido' ? 'Conferido' : 'Em aberto'}
                          </Badge>
                        )}
                        <Badge className={
                          p.status_pagamento === 'pago' ? 'bg-green-100 text-green-800' :
                          p.status_pagamento === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                          p.status_pagamento === 'cancelado' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }>
                          {p.status_pagamento === 'pendente' ? 'Pendente' :
                           p.status_pagamento === 'agendado' ? 'Agendado' :
                           p.status_pagamento === 'em_lote' ? 'Em Lote' :
                           p.status_pagamento === 'pago' ? 'Pago' :
                           p.status_pagamento === 'cancelado' ? 'Cancelado' : p.status_pagamento}
                        </Badge>
                        {p.status_pagamento === 'em_lote' && p.lote_id && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-indigo-600 font-mono">
                            {loteIdCurto(p.lote_id)}
                            <button className="hover:text-indigo-800" onClick={() => navigator.clipboard?.writeText(String(p.lote_id))} title="Copiar ID do lote">
                              <Copy className="w-3 h-3" />
                            </button>
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!bloqueio && p.status_conferencia !== 'conferido' && (
                          <Button size="icon" variant="ghost" title="Conferir" onClick={() => handleAtualizarStatus(p.id, { status_conferencia: 'conferido', elegivel_lote: verificarElegibilidadeLote(p.prestador_id) })}>
                            <FileCheck className="w-4 h-4 text-blue-600" />
                          </Button>
                        )}
                        {!bloqueio && podeReprovarPagamento(p) && (
                          <>
                            <Button size="icon" variant="ghost" title="Aprovar" onClick={() => handleAtualizarStatus(p.id, { status_aprovacao: 'aprovado' })}>
                              <Check className="w-4 h-4 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Reprovar" onClick={() => abrirReprovarPagamento(p)}>
                              <FileX className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                        {(p.status_pagamento === 'pendente' || p.status_pagamento === 'em_lote') ? (
                           <Button size="icon" variant="ghost" title="Marcar como pago" onClick={() => handleMarcarPago(p.id)}>
                             <DollarSign className="w-4 h-4 text-green-600" />
                           </Button>
                        ) : null}
                        {(podeCancelarPagamento(p) || podeEstornarPagamento(p)) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" title="Mais ações" aria-label="Mais ações">
                                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              {podeCancelarPagamento(p) && (
                                <DropdownMenuItem onSelect={() => abrirCancelarPagamento(p)} className="text-red-600 focus:text-red-600">
                                  <X className="w-4 h-4 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              {podeEstornarPagamento(p) && (
                                <DropdownMenuItem onSelect={() => abrirEstornarPagamento(p)} className="text-amber-600 focus:text-amber-600">
                                  <RotateCcw className="w-4 h-4 mr-2" /> Estornar pagamento
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="anteriores" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Fechamentos Anteriores</CardTitle>
                <Badge variant="outline" className="text-xs">{fechamentosReais.length} fechamento{fechamentosReais.length !== 1 ? "s" : ""}</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {fechamentosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Carregando fechamentos...</span>
                </div>
              ) : fechamentosReais.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhum fechamento encontrado para o período/prestador selecionado.</p>
                  <p className="text-xs mt-1">Crie um fechamento a partir da aba "Visão do Período".</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Prestador</TableHead>
                      <TableHead className="text-right">Qtd Itens</TableHead>
                      <TableHead className="text-right">Serviços</TableHead>
                      <TableHead className="text-right">Adicionais</TableHead>
                      <TableHead className="text-right">Descontos</TableHead>
                      <TableHead className="text-right">Valor Líquido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Conf.</TableHead>
                      <TableHead>Data Aprov.</TableHead>
                      <TableHead>Data Pagto.</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fechamentosReais.map(f => {
                      const exp = fechamentoExpandido[f.id] || false;
                      const statusColors: Record<string, string> = {
                        em_conferencia: "bg-yellow-100 text-yellow-800 border-yellow-200",
                        conferido: "bg-blue-100 text-blue-800 border-blue-200",
                        aprovado: "bg-purple-100 text-purple-800 border-purple-200",
                        pago: "bg-green-100 text-green-800 border-green-200",
                        cancelado: "bg-red-100 text-red-800 border-red-200",
                      };
                      const statusLabels: Record<string, string> = {
                        em_conferencia: "Em Conferência",
                        conferido: "Conferido",
                        aprovado: "Aprovado",
                        pago: "Pago",
                        cancelado: "Cancelado",
                      };
                      return (
                        <TableRow key={f.id} className={f.status === "pago" ? "opacity-70" : ""}>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFechamentoExpandido(prev => ({ ...prev, [f.id]: !exp }))}>
                              {exp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </Button>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{fmtPeriodo(f.periodo_inicio, f.periodo_fim)}</TableCell>
                          <TableCell className="font-medium text-sm">{nomeOuNaoInformado(f.prestador_nome)}</TableCell>
                          <TableCell className="text-right">{f.quantidade_itens}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{f.valor_servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-green-600">{(f.valor_reembolsos + f.valor_bonus + f.valor_adiantamentos).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-red-600">{f.valor_descontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-sm text-orange-600">{f.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColors[f.status] || ""}`}>{statusLabels[f.status] || f.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDateLocal(f.data_conferencia)}</TableCell>
                          <TableCell className="text-xs">{fmtDateLocal(f.data_aprovacao)}</TableCell>
                          <TableCell className="text-xs">{fmtDateLocal(f.data_pagamento)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {f.status === "em_conferencia" && (
                                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => { setFechamentoSelecionado(f); setShowConferirFechamento(true); }}>
                                  <FileCheck className="w-3 h-3 mr-1" /> Conferir
                                </Button>
                              )}
                              {f.status === "conferido" && (
                                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700" onClick={() => { setFechamentoSelecionado(f); setShowAprovarFechamento(true); }}>
                                  <Check className="w-3 h-3 mr-1" /> Aprovar
                                </Button>
                              )}
                              {f.status === "aprovado" && (
                                <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => { setFechamentoSelecionado(f); setPagarData({ dataPagamento: new Date().toISOString().split("T")[0], contaFinanceiraId: "", valorEfetivo: f.valor_liquido }); setShowPagarFechamento(true); }}>
                                  <DollarSign className="w-3 h-3 mr-1" /> Pagar
                                </Button>
                              )}
                              {f.status === "pago" && (
                                <Badge className="bg-green-100 text-green-800 text-[10px]">Pago</Badge>
                              )}
                              {f.status !== "pago" && f.status !== "cancelado" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-800 hover:bg-red-50" onClick={() => { setFechamentoSelecionado(f); setCancelarMotivo(""); setShowCancelarFechamento(true); }}>
                                  <X className="w-3 h-3 mr-1" /> Cancelar
                                </Button>
                              )}
                              {f.status === "cancelado" && (
                                <Badge className="bg-red-100 text-red-800 text-[10px]">Cancelado</Badge>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {fechamentosReais.some(f => fechamentoExpandido[f.id]) && (
            <div className="space-y-3">
              {fechamentosReais.filter(f => fechamentoExpandido[f.id]).map(f => (
                <Card key={f.id} className="border-l-4 border-l-indigo-300">
                  <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-indigo-800">Memória de Cálculo</h4>
                        <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono space-y-1">
                          <p>Valor serviços: {f.valor_servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                          {f.valor_reembolsos > 0 && <p className="text-green-600">+ Reembolsos: {f.valor_reembolsos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                          {f.valor_bonus > 0 && <p className="text-green-600">+ Bônus: {f.valor_bonus.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                          {f.valor_descontos > 0 && <p className="text-red-600">- Descontos: {f.valor_descontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                          {f.valor_adiantamentos > 0 && <p className="text-red-600">- Adiantamentos: {f.valor_adiantamentos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>}
                          <p className="font-bold text-indigo-700 border-t border-slate-200 pt-1 mt-1">= Valor líquido: {f.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-indigo-800">Dados do Fechamento</h4>
                        <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                          <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{fmtPeriodo(f.periodo_inicio, f.periodo_fim)}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{f.quantidade_itens}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span><Badge variant="outline" className={`text-[10px] ${(f.status === "pago" ? "bg-green-100 text-green-800" : f.status === "cancelado" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800")}`}>{f.status}</Badge></span></div>
                          {f.data_conferencia && <div className="flex justify-between"><span className="text-muted-foreground">Conferido em</span><span>{fmtDateLocal(f.data_conferencia)}</span></div>}
                          {f.data_aprovacao && <div className="flex justify-between"><span className="text-muted-foreground">Aprovado em</span><span>{fmtDateLocal(f.data_aprovacao)}</span></div>}
                          {f.data_pagamento && <div className="flex justify-between"><span className="text-muted-foreground">Pago em</span><span>{fmtDateLocal(f.data_pagamento)}</span></div>}
                          {f.observacao && <div className="flex justify-between"><span className="text-muted-foreground">Observação</span><span className="text-right max-w-[200px] truncate">{f.observacao}</span></div>}
                        </div>
                      </div>
                    </div>
                    {f.itens && f.itens.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-indigo-800 mb-2">Itens do Fechamento ({f.itens.length})</h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>OS</TableHead>
                                <TableHead>Origem</TableHead>
                                <TableHead className="text-right">Serviços</TableHead>
                                <TableHead className="text-right">Pedágio</TableHead>
                                <TableHead className="text-right">Adicionais</TableHead>
                                <TableHead className="text-right">Descontos</TableHead>
                                <TableHead className="text-right">Líquido</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {f.itens.map(item => (
                                <TableRow key={item.id}>
                                  <TableCell className="font-mono text-xs">{item.os_numero || item.id.slice(0, 8)}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-[10px]">{labelOrigem(item.origem_lancamento)}</Badge></TableCell>
                                  <TableCell className="text-right text-xs">{item.valor_servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell className="text-right text-xs">{item.pedagio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell className="text-right text-xs text-green-600">{item.adicionais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell className="text-right text-xs text-red-600">{item.descontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                  <TableCell className="text-right text-xs font-bold">{item.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="repasses" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500 shrink-0" />
                <div>
                  <CardTitle className="text-lg">Repasses da Programação Operacional</CardTitle>
                  <CardDescription>
                    {escalaRepasseLoading ? "Carregando..." : "Dados preparados da programação — ainda não processados como pagamento"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <Select value={filtroComprovante} onValueChange={setFiltroComprovante}>
                    <SelectTrigger className="h-7 text-xs w-44">
                      <SelectValue placeholder="Comprovante" />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTRO_COMPROVANTE_OPCOES.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              <Badge variant="outline" className="text-xs text-indigo-600 border-indigo-200 bg-indigo-50 shrink-0">
                Origem: Programação Operacional
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {escalaRepasseLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Carregando dados da Programação...
            </div>
          ) : Object.keys(escalaAgrupada).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum repasse pendente da Programação Operacional</p>
              <p className="text-xs mt-1">Consulta apenas — os repasses são provisionados automaticamente pela Programação Operacional.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(escalaAgrupada).map(([prestador, items]) => {
                const itemsFiltrados = filtroComprovante === "todos"
                  ? items
                  : items.filter(i => i.comprovanteStatus === filtroComprovante);
                if (itemsFiltrados.length === 0) return null;
                const subtotal = itemsFiltrados.reduce((s, i) => s + i.valorTotal, 0);
                return (
                  <div key={prestador} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm">{prestador}</h4>
                      <span className="text-sm font-bold text-indigo-600">
                        {itemsFiltrados.length} aloc{itemsFiltrados.length === 1 ? "ação" : "ações"} —{" "}
                        {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">OS</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Comprovante</TableHead>
                          <TableHead className="text-xs text-right">Valor Base</TableHead>
                          <TableHead className="text-xs text-right">Adicionais</TableHead>
                          <TableHead className="text-xs text-right">Descontos</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                          <TableHead className="text-xs text-right">Entregas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsFiltrados.map(item => {
                          const compInfo = getStatusComprovanteInfo(item.comprovanteStatus);
                          return (
                          <TableRow key={item.alocacaoId} className={item.comprovanteStatus === "pendente" ? "opacity-70" : ""}>
                            <TableCell className="font-mono text-xs">{item.os || "-"}</TableCell>
                            <TableCell className="text-xs">{fmtDateLocal(item.data)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${compInfo.className}`}>
                                {compInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right">{fmtMoeda(item.valorBase)}</TableCell>
                            <TableCell className="text-xs text-right text-green-600">{item.valorAdicionais > 0 ? fmtMoeda(item.valorAdicionais) : "-"}</TableCell>
                            <TableCell className="text-xs text-right text-red-600">{item.valorDescontos > 0 ? fmtMoeda(item.valorDescontos) : "-"}</TableCell>
                            <TableCell className="text-xs text-right font-bold">{fmtMoeda(item.valorTotal)}</TableCell>
                            <TableCell className="text-xs text-right">{item.quantidadeEntregas || "-"}</TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
              <div className="text-right text-sm text-muted-foreground">
                Total em repasses da Programação:{" "}
                <span className="font-bold text-indigo-600">
                  {totalEscalaRepasse.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="ml-2 text-xs">(não incluso nos fechamentos acima)</span>
              </div>
            </div>
          )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>
      </div>

              </TabsContent>
        <TabsContent value="relatorio" className="space-y-4">
          {(() => {
            const linhas = linhasRelatorioFiltradas;
            const linhasTabela = imprimindoRelatorio ? linhasRelatorioFiltradas : linhasRelatorioPagina;
            const totalServicos = linhas.reduce((s, l) => s + l.valorServicos, 0);
            const totalLiquido = linhas.reduce((s, l) => s + l.valorLiquido, 0);
            const fmt = fmtMoeda;

            return (
              <>
                <div>
                  <h3 className="text-lg font-bold">Relatório Financeiro de Prestadores</h3>
                  <p className="text-sm text-muted-foreground">
                    {linhas.length} registro(s) · {fmtPeriodo(dataInicio, dataFim)} · Total líquido: {fmt(totalLiquido)}
                  </p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Serviços</p><p className="text-base font-bold">{fmt(totalServicos)}</p></CardContent></Card>
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Adicionais</p><p className="text-base font-bold text-green-600">{fmt(linhas.reduce((s, l) => s + l.valorAdicionais, 0))}</p></CardContent></Card>
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Descontos</p><p className="text-base font-bold text-red-600">{fmt(linhas.reduce((s, l) => s + l.valorDescontos, 0))}</p></CardContent></Card>
                  <Card className="bg-indigo-50/50 border-indigo-100"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Líquido</p><p className="text-base font-bold text-indigo-700">{fmt(totalLiquido)}</p></CardContent></Card>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={filtroStatusRelatorio} onValueChange={setFiltroStatusRelatorio}>
                      <SelectTrigger className="w-40 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os status</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="nao_vencido">Não vencido</SelectItem>
                        <SelectItem value="em_lote">Em lote</SelectItem>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setImprimindoRelatorio(true); setTimeout(() => { imprimirRelatorio(); setImprimindoRelatorio(false); }, 350); }}>
                      <Printer className="w-4 h-4 mr-2" /> Imprimir
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportarCSV(linhas)}>
                      <Download className="w-4 h-4 mr-2" /> Exportar CSV
                    </Button>
                  </div>
                </div>
                <Card>
                  <CardContent className="p-0 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Prestador</TableHead>
                          <TableHead className="text-xs">Período</TableHead>
                          <TableHead className="text-xs text-right">OS</TableHead>
                          <TableHead className="text-xs text-right">Serviços</TableHead>
                          <TableHead className="text-xs text-right">Adicionais</TableHead>
                          <TableHead className="text-xs text-right">Descontos</TableHead>
                          <TableHead className="text-xs text-right">Pedágio</TableHead>
                          <TableHead className="text-xs text-right">Líquido</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Origem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linhas.length === 0 ? (
                          <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                        ) : (
                          linhasTabela.map((l, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-xs">{nomeOuNaoInformado(l.prestadorNome)}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{fmtPeriodo(l.periodoInicio, l.periodoFim)}</TableCell>
                              <TableCell className="text-xs text-right">{l.quantidadeOs}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{fmt(l.valorServicos)}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-green-600">{l.valorAdicionais > 0 ? fmt(l.valorAdicionais) : "—"}</TableCell>
                              <TableCell className="text-xs text-right font-mono text-red-600">{l.valorDescontos > 0 ? fmt(l.valorDescontos) : "—"}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{l.valorPedagio > 0 ? fmt(l.valorPedagio) : "—"}</TableCell>
                              <TableCell className="text-xs text-right font-mono font-bold">{fmt(l.valorLiquido)}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] ${getPagamentoStatusInfo(l.statusPagamento).bg} ${getPagamentoStatusInfo(l.statusPagamento).cor}`}>
                                  {getPagamentoStatusInfo(l.statusPagamento).label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">{labelOrigem(l.origem)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <PaginationBar
                      page={pageRelatorio}
                      pageSize={PAGE_SIZE_PAGTO}
                      totalCount={linhasRelatorioFiltradas.length}
                      onPageChange={setPageRelatorio}
                    />
                  </CardContent>
                </Card>
              </>
            );
          })()}
        </TabsContent>
        <TabsContent value="conta-corrente" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Conta Corrente do Prestador</CardTitle>
              <CardDescription>Extrato financeiro com entradas, saídas e saldo acumulado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="w-full sm:w-1/2 lg:w-1/3">
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

              {prestadorCC && (() => {
                const totalCreditos = extratoCC.reduce((s, e) => s + (e.credito || 0), 0);
                const totalDebitos = extratoCC.reduce((s, e) => s + (e.debito || 0), 0);
                const saldoAtual = extratoCC.length > 0 ? extratoCC[extratoCC.length - 1].saldo : 0;
                return (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="bg-blue-50/40 border-blue-100">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Saldo atual</p>
                      <p className={`text-lg font-extrabold mt-0.5 ${saldoAtual >= 0 ? "text-blue-700" : "text-red-600"}`}>{fmtMoeda(saldoAtual)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50/40 border-emerald-100">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total créditos</p>
                      <p className="text-lg font-extrabold mt-0.5 text-emerald-700">{fmtMoeda(totalCreditos)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50/40 border-red-100">
                    <CardContent className="p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total débitos</p>
                      <p className="text-lg font-extrabold mt-0.5 text-red-600">{fmtMoeda(totalDebitos)}</p>
                    </CardContent>
                  </Card>
                </div>
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
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhum lançamento na conta corrente deste prestador</p>
                            <p className="text-xs mt-1">Os créditos e pagamentos aparecerão aqui conforme os lançamentos forem processados.</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        extratoCC.map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="whitespace-nowrap">{fmtDateLocal(e.data)}</TableCell>
                            <TableCell><Badge variant="outline">{labelOrigem(e.origem)}</Badge></TableCell>
                            <TableCell>{e.descricao || "—"}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{e.credito > 0 ? fmtMoeda(e.credito) : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{e.debito > 0 ? fmtMoeda(e.debito) : '—'}</TableCell>
                            <TableCell className={`text-right font-mono font-bold ${e.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoeda(e.saldo)}</TableCell>
                            <TableCell><Badge variant="secondary">{labelStatusGenerico(e.status)}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                </>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showModalLote} onOpenChange={setShowModalLote}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar Ordem/Lote de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Pagamentos</p><p className="text-lg font-extrabold">{resumoLote.quantidade}</p></div>
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Prestadores</p><p className="text-lg font-extrabold">{resumoLote.prestadores}</p></div>
              <div className="rounded-lg border bg-slate-50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Período dos serviços</p><p className="text-xs font-semibold">{resumoLote.periodoMin ? `${fmtDateLocal(resumoLote.periodoMin)} a ${fmtDateLocal(resumoLote.periodoMax)}` : "—"}</p></div>
              <div className="rounded-lg border bg-indigo-50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Total líquido</p><p className="text-lg font-extrabold text-indigo-700">{fmtMoeda(resumoLote.totalLiquido)}</p></div>
            </div>
            <div className="border rounded-lg max-h-48 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs">Prestador</TableHead><TableHead className="text-xs text-right">Qtd</TableHead><TableHead className="text-xs text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>
                  {resumoLote.porPrestador.map((x) => (
                    <TableRow key={x.nome}><TableCell className="text-xs">{x.nome}</TableCell><TableCell className="text-xs text-right">{x.quantidade}</TableCell><TableCell className="text-xs text-right font-semibold">{fmtMoeda(x.total)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {loteResultado && (
              <div className={`rounded-lg border p-3 text-xs ${loteResultado.bloqueados > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {loteResultado.bloqueados > 0
                  ? <>Lote não gerado. Bloqueios: {loteResultado.bloqueados}</>
                  : loteResultado.lote_id
                    ? <>Lote gerado com sucesso. Identificador: <span className="font-mono">{loteResultado.lote_id.slice(0, 8)}</span> · Pagamentos: {loteResultado.incluidos} · Total: {fmtMoeda(resumoLote.totalLiquido)}</>
                    : <>Já em lote ({loteResultado.ja_em_lote}).</>}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">A formação do lote NÃO executa pagamento, baixa ou envio bancário.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModalLote(false)}>Cancelar</Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={gerandoLote || resumoLote.quantidade === 0} onClick={handleGerarLote}>
              {gerandoLote ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Layers className="w-4 h-4 mr-2" />} Gerar Ordem/Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Fechamento</DialogTitle>
          </DialogHeader>
          {selectedPrestador && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs">
                <span className="font-semibold uppercase text-muted-foreground">Período selecionado: </span>
                <span className="font-semibold">{fmtDateLocal(dataInicio)} a {fmtDateLocal(dataFim)}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Prestador</Label>
                  <p className="font-medium">{selectedPrestador.nome_completo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <p className="font-medium">{mascararCPF(selectedPrestador.cpf_cnpj)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ajustes Manuais</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">Reembolso</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.reembolso || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "reembolso", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bônus</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.bonus || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "bonus", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Desconto</Label>
                    <Input
                      type="number"
                      value={valoresAjustados[selectedPrestador.nome_completo]?.desconto || 0}
                      onChange={e => handleAtualizarAjuste(selectedPrestador.nome_completo, "desconto", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Pedágio</TableHead>
                      <TableHead>Adicional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ossAgrupadas[selectedPrestador.nome_completo] || []).map(os => (
                      <TableRow key={os.id}>
                        <TableCell className="whitespace-nowrap">{os.data ? fmtDateLocal(os.data) : <span className="text-amber-600 text-xs">Data não determinada</span>}</TableCell>
                        <TableCell className="font-mono">{os.numero}</TableCell>
                        <TableCell>{(os.custo_prestador || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell>{(os.pedagio || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                        <TableCell>{(os.adicionais || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetalhe(false)}>Fechar</Button>
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => { setShowFechamento(true); }}>
              <Check className="w-4 h-4 mr-2" /> Gerar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFechamento} onOpenChange={setShowFechamento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Fechamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Confirma o fechamento para <strong>{selectedPrestador?.nome_completo}</strong>?</p>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p>Quantidade de OS: <strong>{totaisPorPrestador[selectedPrestador?.nome_completo || ""]?.quantidade || 0}</strong></p>
              <p>Valor líquido: <strong className="text-orange-600 text-lg">
                {(totaisPorPrestador[selectedPrestador?.nome_completo || ""]?.liquido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong></p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFechamento(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleGerarFechamento}>
              <Check className="w-4 h-4 mr-2" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNovoPagamento} onOpenChange={setShowNovoPagamento}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Lançamento de Prestador</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Prestador *</Label>
                  <Select value={novoPagamento.prestadorId} onValueChange={v => setNovoPagamento(p => ({ ...p, prestadorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o prestador" /></SelectTrigger>
                    <SelectContent>
                      {prestadores.length === 0 ? (
                        <div className="p-3 text-sm text-red-500 font-medium text-center">
                          Nenhum prestador encontrado. Cadastre um prestador antes de lançar pagamento.
                        </div>
                      ) : (
                        prestadores.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nome_completo}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo do Lançamento *</Label>
                  <Select value={novoPagamento.tipoLancamento} onValueChange={v => setNovoPagamento(p => ({ ...p, tipoLancamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS_LANCAMENTO_MANUAL.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Obrigação manual de prestador — não paga automaticamente, entra no workflow de aprovação.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Natureza</Label>
                  <div className="h-10 flex items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                    Crédito para o prestador (+)
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input 
                    type="number" 
                    value={novoPagamento.valor || ""} 
                    onChange={e => setNovoPagamento(p => ({ ...p, valor: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento *</Label>
                  <Select value={novoPagamento.formaPagamento} onValueChange={v => setNovoPagamento(p => ({ ...p, formaPagamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="TED">TED</SelectItem>
                      <SelectItem value="Boleto">Boleto</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="CNAB/Lote">CNAB/Lote</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input type="date" value={novoPagamento.dataCompetencia} onChange={e => setNovoPagamento(p => ({ ...p, dataCompetencia: e.target.value }))} />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Conta de Pagamento (Empresa)</Label>
                  <Select value={novoPagamento.contaPagamento} onValueChange={v => setNovoPagamento(p => ({ ...p, contaPagamento: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {contasFinanceiras.length === 0 ? (
                        <div className="p-3 text-sm text-red-500 font-medium text-center">
                          Nenhuma conta cadastrada. Cadastre uma conta antes de lançar pagamento.
                        </div>
                      ) : (
                        contasFinanceiras.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} ({c.banco} — {c.tipo})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Descrição / Observação *</Label>
                  <Textarea
                    value={novoPagamento.descricao}
                    onChange={e => setNovoPagamento(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descreva o motivo do lançamento (ex.: serviço avulso do dia 20/09, reembolso de pedágio...)"
                    className="h-20 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {novoPagamento.prestadorId ? (
                (() => {
                  const prestadorInfo = prestadores.find(p => p.id === novoPagamento.prestadorId);
                  const dadosIncompletos = !(prestadorInfo?.cpf_cnpj && prestadorInfo.cpf_cnpj.length >= 11);
                  return (
                    <Card className="bg-slate-50 border-slate-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <Landmark className="w-4 h-4 text-slate-500" /> Dados Básicos
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">CPF/CNPJ</p>
                          <p className="font-medium">{mascararCPF(prestadorInfo?.cpf_cnpj)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Telefone</p>
                          <p className="font-medium">{mascararTelefone(prestadorInfo?.telefone) || "Não informado"}</p>
                        </div>
                        {dadosIncompletos && (
                          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-xs flex items-start gap-2 border border-red-100">
                            <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p>Sem documento (CPF/CNPJ). <strong>Não elegível para pagamento em lote (CNAB)</strong>.</p>
                          </div>
                        )}
                        {!dadosIncompletos && (
                          <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-xs flex items-start gap-2 border border-green-100">
                            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p>Documento completo. <strong>Elegível para lote</strong>.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center h-48">
                  <Landmark className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Selecione um prestador para ver os dados bancários</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" onClick={() => setShowNovoPagamento(false)} disabled={criandoLancamento}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvarNovoPagamento} disabled={criandoLancamento}>
              {criandoLancamento ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {criandoLancamento ? "Salvando..." : "Salvar Lançamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showJustificativa} onOpenChange={setShowJustificativa}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" /> Liberação com Justificativa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-semibold">Este pagamento não pode ser aprovado automaticamente.</p>
              <p className="mt-1 text-xs text-amber-600">Informe o motivo da liberação manual. A auditoria registrará esta exceção.</p>
            </div>
            <Label>Justificativa *</Label>
            <Textarea
              value={justificativaTexto}
              onChange={e => setJustificativaTexto(e.target.value)}
              placeholder="Ex: Comprovante foi enviado por e-mail, anexar posteriormente..."
              className="h-24 resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowJustificativa(false); setJustificativaAlvo(null); setJustificativaTexto(""); }}>
              Cancelar
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleLiberarComJustificativa} disabled={!justificativaTexto.trim()}>
              <Check className="w-4 h-4 mr-2" /> Liberar com Justificativa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIN-MOT-1H2 — Ver Extrato de Fechamento do Prestador */}
      <Dialog open={showExtrato} onOpenChange={setShowExtrato}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5 text-orange-500" />
              EXTRATO DE FECHAMENTO DO PRESTADOR
              {extratoSelecionado && <span className="text-sm font-normal text-muted-foreground">· {extratoSelecionado.numero}</span>}
            </DialogTitle>
          </DialogHeader>

          {extratoLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : !extratoSelecionado ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
              <p>Não foi possível montar o extrato deste fechamento.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Cabeçalho: prestador + período + status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-muted-foreground">PRESTADOR</p>
                  <p className="font-bold">{extratoSelecionado.prestador.nome_completo}</p>
                  {extratoSelecionado.prestador.cpf_cnpj && (
                    <p className="text-sm text-muted-foreground">CPF/CNPJ: {mascararDocumentoH2(extratoSelecionado.prestador.cpf_cnpj)}</p>
                  )}
                  {extratoSelecionado.prestador.veiculo_placa && (
                    <p className="text-sm text-muted-foreground">
                      Veículo: {extratoSelecionado.prestador.veiculo_tipo} - {extratoSelecionado.prestador.veiculo_placa}
                    </p>
                  )}
                </div>
                <div className="space-y-1 md:text-right">
                  <p className="text-sm font-semibold text-muted-foreground">PERÍODO</p>
                  <p className="font-bold">
                    {fmtPeriodo(extratoSelecionado.periodo_inicio, extratoSelecionado.periodo_fim)}
                  </p>
                  <p className="text-sm text-muted-foreground">Gerado em: {formatarDataH2(extratoSelecionado.data_geracao)}</p>
                  <div className="flex md:justify-end gap-2 pt-1">
                    <Badge className="bg-indigo-100 text-indigo-800">
                      {statusPagamentoLabelH2({ ...extratoSelecionado, status: extratoSelecionado.status, status_pagamento: extratoSelecionado.status_pagamento })}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Operações do período */}
              <div className="rounded-lg border">
                <div className="border-b px-4 py-2 bg-slate-50 flex items-center justify-between">
                  <p className="text-sm font-semibold">Operações / OS do Período</p>
                  <span className="text-xs text-muted-foreground">{extratoSelecionado.operacoes.length} item(s)</span>
                </div>
                <div className="p-4">
                  {extratoSelecionado.operacoes.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhuma OS vinculada detalhada neste fechamento.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Origem</TableHead>
                          <TableHead className="text-xs">OS Conexão</TableHead>
                          <TableHead className="text-xs">Romaneio/OC</TableHead>
                          <TableHead className="text-xs">Cliente</TableHead>
                          <TableHead className="text-xs">Serviço/Descrição</TableHead>
                          <TableHead className="text-xs text-right">Valor Base</TableHead>
                          <TableHead className="text-xs text-right">KM/Adic.</TableHead>
                          <TableHead className="text-xs text-right">Créditos</TableHead>
                          <TableHead className="text-xs text-right">Débitos</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extratoSelecionado.operacoes.map((op, i) => {
                          const isCred = op.tipo === 'credito';
                          const total = isCred
                            ? (Number(op.valor_base) || 0) + (Number(op.valor_adicionais) || 0)
                            : -(Number(op.valor_base) || 0) - (Number(op.valor_descontos) || 0);
                          return (
                          <TableRow key={i}>
                            <TableCell className="text-xs whitespace-nowrap">{formatarDataH2(op.data_operacao)}</TableCell>
                            <TableCell className="text-xs">
                              {labelOrigem(op.tipoOrigem)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {op.ordem_servico_numero || "—"}
                              {op.jaFechada && (
                                <Badge className="ml-2 bg-amber-100 text-amber-800 text-[10px]">
                                  Já fechada{op.referenciaFechamento ? ` · ${op.referenciaFechamento}` : ""}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{op.romaneio || "—"}</TableCell>
                            <TableCell className="text-xs">{op.cliente_nome || "—"}</TableCell>
                            <TableCell className="text-xs">{op.descricao || "—"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatarMoedaH2(op.valor_base)}</TableCell>
                            <TableCell className="text-xs text-right font-mono text-green-600">
                              {op.km_total ? `${op.km_total} km` : formatarMoedaH2(Number(op.valor_adicionais) || 0)}
                            </TableCell>
                            <TableCell className={`text-xs text-right font-mono ${isCred ? 'text-green-600' : ''}`}>
                              {isCred ? formatarMoedaH2(Number(op.valor) ?? Number(op.valor_base) ?? 0) : "—"}
                            </TableCell>
                            <TableCell className={`text-xs text-right font-mono ${!isCred ? 'text-red-600' : ''}`}>
                              {!isCred ? formatarMoedaH2(-(Number(op.valor) ?? 0) || (Number(op.valor_base) || 0)) : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold">{formatarMoedaH2(total)}</TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              {/* Resumo financeiro */}
              <div className="rounded-lg border p-4">
                <p className="text-sm font-semibold mb-3">RESUMO FINANCEIRO</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="font-semibold text-green-700">Créditos</p>
                    <div className="flex justify-between"><span className="text-muted-foreground">Serviços/Base</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_servicos)}</span></div>
                    {extratoSelecionado.valor_pedagio > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Pedágio</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_pedagio)}</span></div>}
                    {extratoSelecionado.valor_adicionais > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Outros adicionais</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_adicionais)}</span></div>}
                    {extratoSelecionado.valor_reembolsos > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Reembolsos</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_reembolsos)}</span></div>}
                    {extratoSelecionado.valor_bonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Bônus</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_bonus)}</span></div>}
                    <div className="flex justify-between border-t pt-1"><span className="font-semibold">Total Créditos</span><span className="font-bold text-green-700">{formatarMoedaH2(extratoSelecionado.valor_total_creditos)}</span></div>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-red-700">Descontos / Débitos</p>
                    {extratoSelecionado.valor_descontos > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Descontos</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_descontos)}</span></div>}
                    {extratoSelecionado.valor_adiantamentos > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Adiantamentos</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_adiantamentos)}</span></div>}
                    {extratoSelecionado.valor_combustivel > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Combustível</span><span className="font-mono">{formatarMoedaH2(extratoSelecionado.valor_combustivel)}</span></div>}
                    <div className="flex justify-between border-t pt-1"><span className="font-semibold">Total Débitos</span><span className="font-bold text-red-700">{formatarMoedaH2(extratoSelecionado.valor_total_debitos)}</span></div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t mt-3 pt-3">
                  <span className="font-bold text-base">VALOR LÍQUIDO</span>
                  <span className="font-extrabold text-xl text-orange-600">{formatarMoedaH2(extratoSelecionado.valor_liquido)}</span>
                </div>
              </div>

              {extratoSelecionado.observacoes && (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold mb-1">Observações</p>
                  <p className="text-muted-foreground whitespace-pre-wrap">{extratoSelecionado.observacoes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowExtrato(false)}>Fechar</Button>
                <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => handleGerarPDFExtrato(extratoSelecionado)}>
                  <Download className="w-4 h-4 mr-2" /> Gerar PDF Completo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* FIN-P1-04: Dialog Conferir Fechamento */}
      <Dialog open={showConferirFechamento} onOpenChange={setShowConferirFechamento}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conferir Fechamento</DialogTitle>
          </DialogHeader>
          {fechamentoSelecionado && (
            <div className="space-y-4">
              <p className="text-sm">Confirma a conferência do fechamento de <strong>{fechamentoSelecionado.prestador_nome}</strong>?</p>
              <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{fmtPeriodo(fechamentoSelecionado.periodo_inicio, fechamentoSelecionado.periodo_fim)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{fechamentoSelecionado.quantidade_itens}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor Líquido</span><span className="font-bold text-orange-600">{fechamentoSelecionado.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status Atual</span><span><Badge variant="outline" className="text-[10px] bg-yellow-100 text-yellow-800">em_conferencia</Badge></span></div>
              </div>
              <p className="text-xs text-muted-foreground">Após conferência, o fechamento passará para "Conferido" e ficará disponível para aprovação.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConferirFechamento(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConferirFechamento} disabled={fechamentoAcaoLoading}>
              {fechamentoAcaoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileCheck className="w-4 h-4 mr-2" />}
              Conferir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIN-P1-04: Dialog Aprovar Fechamento */}
      <Dialog open={showAprovarFechamento} onOpenChange={setShowAprovarFechamento}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Aprovar Fechamento</DialogTitle>
          </DialogHeader>
          {fechamentoSelecionado && (
            <div className="space-y-4">
              <p className="text-sm">Confirma a aprovação do fechamento de <strong>{fechamentoSelecionado.prestador_nome}</strong>?</p>
              <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{fmtPeriodo(fechamentoSelecionado.periodo_inicio, fechamentoSelecionado.periodo_fim)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{fechamentoSelecionado.quantidade_itens}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor Líquido</span><span className="font-bold text-orange-600">{fechamentoSelecionado.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conferido em</span><span>{fmtDateLocal(fechamentoSelecionado.data_conferencia)}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">Após aprovação, o fechamento ficará disponível para pagamento.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAprovarFechamento(false)}>Cancelar</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleAprovarFechamento} disabled={fechamentoAcaoLoading}>
              {fechamentoAcaoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIN-P1-04: Dialog Pagar Fechamento */}
      <Dialog open={showPagarFechamento} onOpenChange={setShowPagarFechamento}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pagar Fechamento</DialogTitle>
          </DialogHeader>
          {fechamentoSelecionado && (
            <div className="space-y-4">
              <p className="text-sm">Registrar pagamento de <strong>{fechamentoSelecionado.prestador_nome}</strong>?</p>
              <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{fmtPeriodo(fechamentoSelecionado.periodo_inicio, fechamentoSelecionado.periodo_fim)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{fechamentoSelecionado.quantidade_itens}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor Líquido</span><span className="font-bold text-orange-600">{fechamentoSelecionado.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Aprovado em</span><span>{fmtDateLocal(fechamentoSelecionado.data_aprovacao)}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data do Pagamento *</Label>
                  <Input type="date" value={pagarData.dataPagamento} onChange={e => setPagarData(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Conta Financeira (Opcional)</Label>
                  <Select value={pagarData.contaFinanceiraId} onValueChange={v => setPagarData(p => ({ ...p, contaFinanceiraId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
                    <SelectContent>
                      {contasFinanceiras.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor Efetivo (R$)</Label>
                <Input type="number" step="0.01" value={pagarData.valorEfetivo} onChange={e => setPagarData(p => ({ ...p, valorEfetivo: parseFloat(e.target.value) || 0 }))} />
                <p className="text-xs text-muted-foreground">Valor: {pagarData.valorEfetivo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
              </div>
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Pagamento idempotente: segunda confirmação = no-op (sem novo débito na Conta Corrente).</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPagarFechamento(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handlePagarFechamento} disabled={fechamentoAcaoLoading}>
              {fechamentoAcaoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <DollarSign className="w-4 h-4 mr-2" />}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FIN-P1-04: Dialog Cancelar Fechamento */}
      <Dialog open={showCancelarFechamento} onOpenChange={setShowCancelarFechamento}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cancelar Fechamento</DialogTitle>
          </DialogHeader>
          {fechamentoSelecionado && (
            <div className="space-y-4">
              <p className="text-sm">Cancelar fechamento de <strong>{fechamentoSelecionado.prestador_nome}</strong>?</p>
              <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{fmtPeriodo(fechamentoSelecionado.periodo_inicio, fechamentoSelecionado.periodo_fim)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Itens</span><span>{fechamentoSelecionado.quantidade_itens}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor Líquido</span><span className="font-bold text-orange-600">{fechamentoSelecionado.valor_liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Motivo do Cancelamento *</Label>
                <Textarea value={cancelarMotivo} onChange={e => setCancelarMotivo(e.target.value)} placeholder="Descreva o motivo do cancelamento..." rows={3} />
              </div>
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">Os itens serão desvinculados e poderão ser reutilizados em novo fechamento.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelarFechamento(false)}>Voltar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleCancelarFechamento} disabled={fechamentoAcaoLoading || !cancelarMotivo.trim()}>
              {fechamentoAcaoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
              Cancelar Fechamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PP-UX-02C1C — Reprovar Pagamento de Prestador (RPC f_reprovar_pagamento_prestador) */}
      <Dialog open={showReprovarPagamento} onOpenChange={(o) => { if (!acaoPagamentoLoading) { setShowReprovarPagamento(o); if (!o) { setAcaoPagamento(null); setAcaoPagamentoAviso(null); } } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileX className="w-5 h-5 text-red-600" /> Reprovar Pagamento</DialogTitle>
          </DialogHeader>
          {acaoPagamento && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Prestador:</span> <strong>{acaoPagamento.prestador_nome || "—"}</strong></p>
                {acaoPagamento.os_numero && <p><span className="text-muted-foreground">OS:</span> {acaoPagamento.os_numero}</p>}
                {(acaoPagamento.periodo_inicio || acaoPagamento.periodo_fim) && <p><span className="text-muted-foreground">Período:</span> {fmtDateLocal(acaoPagamento.periodo_inicio)} – {fmtDateLocal(acaoPagamento.periodo_fim)}</p>}
                <p><span className="text-muted-foreground">Valor:</span> <strong className="text-orange-600">{fmtMoeda(acaoPagamento.valor_liquido)}</strong></p>
              </div>
              <div>
                <Label>Motivo da reprovação (opcional)</Label>
                <Textarea value={motivoAcaoPagamento} onChange={(e) => setMotivoAcaoPagamento(e.target.value)} placeholder="Descreva o motivo da reprovação..." rows={3} />
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">A reprovação encerra o fluxo de aprovação. Não altera o financeiro nem a baixa.</p>
              {acaoPagamentoAviso && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{acaoPagamentoAviso}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReprovarPagamento(false)} disabled={acaoPagamentoLoading}>Voltar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleReprovarPagamento} disabled={acaoPagamentoLoading}>
              {acaoPagamentoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <FileX className="w-4 h-4 mr-2" />} Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PP-UX-02C1C — Cancelar Pagamento NÃO pago (RPC f_cancelar_pagamento_prestador) */}
      <Dialog open={showCancelarPagamento} onOpenChange={(o) => { if (!acaoPagamentoLoading) { setShowCancelarPagamento(o); if (!o) { setAcaoPagamento(null); setAcaoPagamentoAviso(null); } } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><X className="w-5 h-5 text-red-600" /> Cancelar Pagamento</DialogTitle>
          </DialogHeader>
          {acaoPagamento && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Prestador:</span> <strong>{acaoPagamento.prestador_nome || "—"}</strong></p>
                {acaoPagamento.os_numero && <p><span className="text-muted-foreground">OS:</span> {acaoPagamento.os_numero}</p>}
                {(acaoPagamento.periodo_inicio || acaoPagamento.periodo_fim) && <p><span className="text-muted-foreground">Período:</span> {fmtDateLocal(acaoPagamento.periodo_inicio)} – {fmtDateLocal(acaoPagamento.periodo_fim)}</p>}
                <p><span className="text-muted-foreground">Situação:</span> <Badge variant="outline">{acaoPagamento.status_pagamento}</Badge></p>
                <p><span className="text-muted-foreground">Valor:</span> <strong className="text-orange-600">{fmtMoeda(acaoPagamento.valor_liquido)}</strong></p>
              </div>
              <div>
                <Label>Motivo do cancelamento (opcional)</Label>
                <Textarea value={motivoAcaoPagamento} onChange={(e) => setMotivoAcaoPagamento(e.target.value)} placeholder="Descreva o motivo do cancelamento..." rows={3} />
              </div>
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">Esta ação cancela a obrigação e o título financeiro correspondente. Não é permitida quando já existe baixa.</p>
              {acaoPagamentoAviso && <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded font-medium">{acaoPagamentoAviso}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelarPagamento(false)} disabled={acaoPagamentoLoading}>Voltar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleCancelarPagamento} disabled={acaoPagamentoLoading || !!acaoPagamentoAviso}>
              {acaoPagamentoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />} Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PP-UX-02C1C — Estornar Pagamento INTEGRAL (RPC f_estornar_pagamento_prestador) */}
      <Dialog open={showEstornarPagamento} onOpenChange={(o) => { if (!acaoPagamentoLoading) { setShowEstornarPagamento(o); if (!o) { setAcaoPagamento(null); setAcaoPagamentoAviso(null); } } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-amber-600" /> Estornar Pagamento</DialogTitle>
          </DialogHeader>
          {acaoPagamento && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Prestador:</span> <strong>{acaoPagamento.prestador_nome || "—"}</strong></p>
                {acaoPagamento.os_numero && <p><span className="text-muted-foreground">OS:</span> {acaoPagamento.os_numero}</p>}
                {(acaoPagamento.periodo_inicio || acaoPagamento.periodo_fim) && <p><span className="text-muted-foreground">Período:</span> {fmtDateLocal(acaoPagamento.periodo_inicio)} – {fmtDateLocal(acaoPagamento.periodo_fim)}</p>}
                <p><span className="text-muted-foreground">Valor:</span> <strong className="text-orange-600">{fmtMoeda(acaoPagamento.valor_liquido)}</strong></p>
              </div>
              <div>
                <Label>Motivo do estorno (obrigatório)</Label>
                <Textarea value={motivoAcaoPagamento} onChange={(e) => setMotivoAcaoPagamento(e.target.value)} placeholder="Descreva o motivo do estorno..." rows={3} />
              </div>
              <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded">Esta ação reabre a obrigação financeira e estorna a baixa registrada. Disponível apenas para pagamento integral.</p>
              {acaoPagamentoAviso && <p className="text-xs text-red-600 bg-red-50 p-2 rounded font-medium">{acaoPagamentoAviso}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEstornarPagamento(false)} disabled={acaoPagamentoLoading}>Voltar</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleEstornarPagamento} disabled={acaoPagamentoLoading || !motivoAcaoPagamento.trim()}>
              {acaoPagamentoLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />} Estornar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** @deprecated A finalização de OS agora grava via ordemServicoService / pagamentoPrestadorService. Esta função está mantida para compatibilidade, mas não é mais chamada pelo fluxo principal. */
export async function gerarLancamentosPrestadorPorOS(os: any) {
  // S2: INSERT direto em pagamentos_prestadores bloqueado por S1; sem RPC oficial -> no-op.
  if (!os || os.status !== 'finalizada' || !os.prestador_id) return;
  console.warn('[S2] gerarLancamentosPrestadorPorOS indisponivel: pendente de RPC oficial (S1 bloqueia escrita direta).');
  return;
  // eslint-disable-next-line no-unreachable

  const resultado = calcularRepassePrestador({
    custo_prestador: os.custo_prestador,
    pedagio: os.pedagio,
    adicionais: os.adicionais,
    descontos: os.descontos,
  });

  // Antes era INSERT direto; agora roteado pelo serviço (idempotente via UNIQUE os_id).
  await criarPagamento({
    prestador_id: os.prestador_id,
    prestador_nome: os.prestador || os.prestador_nome,
    os_id: os.id,
    os_numero: os.numero,
    tipo_lancamento: 'Serviço OS',
    natureza: resultado.totalLiquido >= 0 ? 'credito' : 'debito',
    valor: Math.abs(resultado.totalLiquido),
    valor_liquido: resultado.totalLiquido,
    valor_servicos: os.custo_prestador || 0,
    pedagio: os.pedagio || 0,
    adicionais: os.adicionais || 0,
    descontos: os.descontos || 0,
    data_competencia: os.data || new Date().toISOString().split('T')[0],
    origem_lancamento: 'os',
    impacto_dre: true,
    impacto_fluxo_caixa: true,
    categoria_financeira: 'Custo Logístico',
  });

  registrarAuditoria({
    acao: 'criar_pagamento',
    entidade_tipo: 'pagamento_prestador',
    entidade_id: os.os_id || os.id,
    prestador_id: os.prestador_id,
    prestador_nome: os.prestador || os.prestador_nome,
    valor_novo: resultado.totalLiquido,
    detalhes: {
      os_id: os.id,
      os_numero: os.numero,
      origem: 'geracao_automatica_os',
    },
  });
}
