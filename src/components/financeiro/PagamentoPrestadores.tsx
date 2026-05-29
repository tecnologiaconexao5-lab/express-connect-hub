import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DollarSign, Calendar, Users, Truck, FileCheck, FileX, RefreshCw, Download, Plus, Search, Filter, Eye, Edit, Check, X, Clock, CreditCard, Landmark, Package, AlertTriangle, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { escalaParaItemRepasse, isAlocacaoFaturavel, type ItemRepasseEscala } from "@/services/escala/escalaFinanceiroAdapter";
import { mapearBancoParaLocal } from "@/services/escala/escalaMapper";
import { calcularRepassePrestador } from "@/helpers/calculoRepassePrestador";
import { registrarAuditoria } from "@/services/financeiro/auditoriaPrestadorService";
import { getStatusComprovanteInfo, FILTRO_COMPROVANTE_OPCOES, type StatusComprovante } from "@/helpers/statusComprovante";
import { calcularStatusFinanceiro, getStatusFinanceiroInfo, getMotivoBloqueio, podeAprovar, type StatusFinanceiroPrestador, type DadosStatusFinanceiro } from "@/helpers/statusFinanceiroPrestador";
import { getFechamentoStatusInfo, extrairDivergencias } from "@/helpers/fechamentoHelper";
import { gerarLinhasRelatorio, exportarCSV, imprimirRelatorio } from "@/helpers/relatorioPrestadorHelper";
import { getPagamentoStatusInfo, getTimelineSteps, detectarTipoPagamento, getTipoPagamentoBadge } from "@/helpers/pagamentoHelper";
import { calcularKPIPrestador, gerarAlertas, calcularDistribuicaoStatus } from "@/helpers/dashboardPrestadorHelper";
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
  elegivel_lote?: boolean;
  lote_id?: string;
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
  valor: number;
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

export default function PagamentoPrestadores() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [aba, setAba] = useState(searchParams.get("aba") || "listagem");
  const [prestadorCC, setPrestadorCC] = useState<string>("");
  const [extratoCC, setExtratoCC] = useState<ExtratoContaCorrente[]>([]);

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [oss, setOss] = useState<OS[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filtroPeriodo, setFiltroPeriodo] = useState("semana");
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
  const [ossDoPrestador, setOssDoPrestador] = useState<OS[]>([]);
  const [pagamentosManuais, setPagamentosManuais] = useState<PagamentoManual[]>([]);
  const [escalaRepasse, setEscalaRepasse] = useState<ItemRepasseEscala[]>([]);
  const [escalaRepasseLoading, setEscalaRepasseLoading] = useState(false);
  const [contasFinanceiras, setContasFinanceiras] = useState<ContaFinanceira[]>([]);
  const [gerandoRepasseId, setGerandoRepasseId] = useState<string | null>(null);

  const [novoPagamento, setNovoPagamento] = useState({
    prestadorId: "",
    clienteId: "",
    osId: "",
    tipoLancamento: "Serviço OS",
    natureza: "credito",
    valor: 0,
    dataCompetencia: new Date().toISOString().split("T")[0],
    dataPrevistaPagamento: new Date().toISOString().split("T")[0],
    formaPagamento: "PIX",
    contaPagamento: "",
    observacao: "",
    arquivo: ""
  });

  const [valoresAjustados, setValoresAjustados] = useState<ValoresMap>({});

  useEffect(() => {
    const now = new Date();
    const inicio = new Date(now);
    inicio.setDate(inicio.getDate() - 7);
    setDataInicio(inicio.toISOString().split("T")[0]);
    setDataFim(now.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    fetchPrestadores();
    fetchOss();
    fetchPagamentos();
    fetchClientes();
    fetchPagamentosManuais();
    fetchEscalaRepasse();
    fetchContasFinanceiras();
  }, [dataInicio, dataFim]);

  useEffect(() => {
    if (novoPagamento.prestadorId) {
      fetchOssDoPrestador(novoPagamento.prestadorId);
    } else {
      setOssDoPrestador([]);
    }
  }, [novoPagamento.prestadorId]);

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

      if (error && error.code !== "42P01") throw error;
      setContasFinanceiras(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar contas financeiras:", e);
      setContasFinanceiras([]);
    }
  };

  const fetchOssDoPrestador = async (prestadorId: string) => {
    if (!prestadorId) return;
    try {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, prestador, custo_prestador, pedagio, adicionais, descontos, status, data")
        .eq("prestador_id", prestadorId)
        .in("status", ["finalizada", "concluida"])
        .order("data", { ascending: false })
        .limit(50);

      if (error) throw error;
      setOssDoPrestador(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar OS do prestador:", e);
    }
  };

  const fetchPagamentosManuais = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_prestadores")
        .select("*")
        .eq("origem_lancamento", "manual")
        .order("created_at", { ascending: false });

      if (error && error.code !== "42P01") {
        const { data: data2, error: error2 } = await supabase
          .from("pagamentos_prestadores")
          .select("*")
          .order("periodo_inicio", { ascending: false });
        if (error2) throw error2;
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
        const resultado = calcularRepassePrestador({
          custo_prestador: os.custo_prestador,
          pedagio: os.pedagio,
          adicionais: os.adicionais,
          descontos: os.descontos,
        });
        saldoAcumulado += resultado.totalLiquido;
        extrato.push({
          id: os.id,
          data: os.data || '',
          origem: 'OS Finalizada',
          descricao: `OS ${os.numero}`,
          credito: resultado.totalCredito,
          debito: resultado.totalDebito,
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

  const handleAtualizarStatus = async (id: string, updates: any, prestadorId?: string, prestadorNome?: string, motivo?: string) => {
    try {
      const { data: antes } = await supabase.from('pagamentos_prestadores').select('*').eq('id', id).maybeSingle();
      if (!antes) { toast.error("Registro não encontrado"); return; }

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

      const { error } = await supabase.from('pagamentos_prestadores').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Status atualizado!');
      fetchPagamentosManuais();

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
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("id, numero, prestador, custo_prestador, pedagio, adicionais, descontos, status, data, tipo_operacao, veiculo_tipo")
        .gte("data", dataInicio)
        .lte("data", dataFim)
        .in("status", ["finalizada", "concluida"])
        .order("data", { ascending: false });

      if (error) throw error;
      setOss(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar OS:", e);
    }
  };

  const fetchEscalaRepasse = async () => {
    setEscalaRepasseLoading(true);
    try {
      let query = supabase
        .from("alocacoes_escala")
        .select("*");
      if (dataInicio) query = query.gte("data_escala", dataInicio);
      if (dataFim) query = query.lte("data_escala", dataFim);
      const { data, error } = await query.order("data_escala", { ascending: false });
      if (error) throw error;
      const items = (data || [])
        .map(mapearBancoParaLocal)
        .filter(isAlocacaoFaturavel)
        .map(escalaParaItemRepasse);
      setEscalaRepasse(items);
    } catch (e) {
      console.warn("[PagamentoPrestadores] Erro ao buscar repasses da Escala:", e);
      setEscalaRepasse([]);
    } finally {
      setEscalaRepasseLoading(false);
    }
  };

  const handleGerarRepasse = async (item: ItemRepasseEscala) => {
    if (gerandoRepasseId) return;

    if (!item.prestadorId) {
      toast.warning("Repasse não pode ser gerado: alocação sem prestador vinculado.");
      return;
    }
    if (!item.valorTotal || item.valorTotal <= 0) {
      toast.warning("Repasse não pode ser gerado: valor total é zero ou inválido.");
      return;
    }
    if (item.comprovanteStatus === "pendente") {
      toast.warning("Alocação sem comprovante. O repasse será criado, mas a aprovação ficará bloqueada.");
    }

    setGerandoRepasseId(item.alocacaoId);
    try {
      let query = supabase.from("pagamentos_prestadores").select("id");
      query = query.eq("prestador_id", item.prestadorId).eq("valor_liquido", item.valorTotal).eq("origem_lancamento", "escala_operacional");
      if (item.os) query = query.eq("os_numero", item.os);
      const { data: existente } = await query.maybeSingle();

      if (existente) {
        toast.warning("Repasse já existe para este prestador + OS + valor.");
        return;
      }

      const competencia = item.data
        ? item.data.split("T")[0]
        : new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("pagamentos_prestadores").insert({
        prestador_id: item.prestadorId,
        prestador_nome: item.prestadorNome,
        os_numero: item.os,
        tipo_lancamento: "Repasse Escala",
        natureza: "credito",
        valor: item.valorTotal,
        valor_servicos: item.valorBase,
        valor_adicionais: item.valorAdicionais,
        valor_descontos: item.valorDescontos,
        valor_liquido: item.valorTotal,
        data_competencia: competencia,
        periodo_inicio: competencia,
        periodo_fim: competencia,
        status_conferencia: "em_aberto",
        status_pagamento: "pendente",
        origem_lancamento: "escala_operacional",
        observacao: `Gerado da Escala Operacional | alocação: ${item.alocacaoId} | entregas: ${item.quantidadeEntregas}`,
        quantidade_os: 1,
      });

      if (error) throw error;

      toast.success(`Repasse gerado: ${item.prestadorNome} — ${item.os || "sem OS"}`);

      registrarAuditoria({
        acao: 'gerar_repasse',
        entidade_tipo: 'repasse_escala',
        prestador_id: item.prestadorId,
        prestador_nome: item.prestadorNome,
        valor_novo: item.valorTotal,
        detalhes: {
          alocacao_id: item.alocacaoId,
          os: item.os,
          valor_base: item.valorBase,
          adicionais: item.valorAdicionais,
          descontos: item.valorDescontos,
          quantidade_entregas: item.quantidadeEntregas,
        },
      });

      await fetchPagamentos();
      await fetchPagamentosManuais();
    } catch (e: any) {
      console.error("[PagamentoPrestadores] Erro ao gerar repasse da Escala:", e);
      toast.error(`Erro ao gerar repasse: ${e.message}`);
    } finally {
      setGerandoRepasseId(null);
    }
  };

  const fetchPagamentos = async () => {
    try {
      const { data, error } = await supabase
        .from("pagamentos_prestadores")
        .select("*")
        .order("periodo_inicio", { ascending: false });

      if (error && error.code !== "42P01") throw error;
      setPagamentos(data || []);
    } catch (e: any) {
      console.error("Erro ao buscar pagamentos:", e);
    }
  };

  const ossAgrupadas = useMemo(() => {
    const grupos: { [key: string]: OS[] } = {};
    (oss || []).forEach(os => {
      const key = os.prestador || "sem_prestador";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(os);
    });
    return grupos;
  }, [oss]);

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

    const total = totaisPorPrestador[selectedPrestador.nome_completo];
    const osDoPrestador = ossAgrupadas[selectedPrestador.nome_completo] || [];
    const ajustes = valoresAjustados[selectedPrestador.nome_completo] || { reembolso: 0, bonus: 0, desconto: 0 };

    try {
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
      }

      if (!pagamentoId) throw new Error("Fechamento sem ID gerado");

      const itens = (osDoPrestador || []).map(os => ({
        pagamento_id: pagamentoId,
        os_id: os.id,
        os_numero: os.numero,
        valor_servico: os.custo_prestador || 0,
        pedagio: os.pedagio || 0,
        adicional: os.adicionais || 0,
        status: "pendente"
      }));

      if (itens.length > 0) {
        const { error: erroItens } = await supabase
          .from("pagamentos_prestadores_itens")
          .insert(itens);

        if (erroItens) throw erroItens;
      }

      toast.success(`Fechamento gerado para ${selectedPrestador.nome_completo}`);

      registrarAuditoria({
        acao: 'gerar_fechamento',
        entidade_tipo: 'fechamento',
        entidade_id: pagamentoId,
        prestador_id: selectedPrestador.id,
        prestador_nome: selectedPrestador.nome_completo,
        valor_novo: total.liquido,
        detalhes: {
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          qtd_os: total.quantidade,
          valor_servicos: total.servicos,
          valor_descontos: total.descontos,
        },
      });

      setShowFechamento(false);
      setShowDetalhe(false);
      fetchPagamentos();
    } catch (e: any) {
      console.error("Erro ao gerar fechamento:", e);
      toast.error(`Erro: ${e.message}`);
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

      const { error } = await supabase
        .from("pagamentos_prestadores")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", pagamentoId);

      if (error) throw error;
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
    if (!novoPagamento.prestadorId) {
      toast.error("Selecione um prestador");
      return;
    }
    if (!novoPagamento.valor || novoPagamento.valor <= 0) {
      toast.error("Informe um valor maior que zero");
      return;
    }

    const prestadorSelecionado = prestadores.find(p => p.id === novoPagamento.prestadorId);
    if (!prestadorSelecionado) {
      toast.error("Prestador não encontrado");
      return;
    }

    const elegivel = verificarElegibilidadeLote(novoPagamento.prestadorId);

    const contaSelecionada = contasFinanceiras.find(c => c.id === novoPagamento.contaPagamento);

    try {
      const { error } = await supabase
        .from("pagamentos_prestadores")
        .insert([{
          prestador_id: novoPagamento.prestadorId,
          prestador_nome: prestadorSelecionado.nome_completo,
          prestador_documento: prestadorSelecionado.cpf_cnpj,
          cliente_id: novoPagamento.clienteId || null,
          cliente_nome: clientes.find(c => c.id === novoPagamento.clienteId)?.nome_fantasia || null,
          os_id: novoPagamento.osId || null,
          os_numero: ossDoPrestador.find(o => o.id === novoPagamento.osId)?.numero || null,
          tipo_lancamento: novoPagamento.tipoLancamento,
          natureza: novoPagamento.natureza,
          valor: novoPagamento.valor,
          data_competencia: novoPagamento.dataCompetencia,
          data_prevista_pagamento: novoPagamento.dataPrevistaPagamento,
          forma_pagamento: novoPagamento.formaPagamento,
          conta_pagamento: contaSelecionada ? contaSelecionada.nome : (novoPagamento.contaPagamento || null),
          observacao: novoPagamento.observacao,
          status_conferencia: "em_aberto",
          status_pagamento: "pendente",
          elegivel_lote: elegivel,
          origem_lancamento: "manual",
          categoria_financeira: novoPagamento.tipoLancamento,
          centro_custo: null,
          conta_contabil: null,
          quantidade_os: 1,
          periodo_inicio: novoPagamento.dataCompetencia,
          periodo_fim: novoPagamento.dataCompetencia,
          valor_liquido: novoPagamento.natureza === "credito" ? novoPagamento.valor : -novoPagamento.valor,
          valor_servicos: novoPagamento.natureza === "credito" ? novoPagamento.valor : 0,
          valor_descontos: novoPagamento.natureza === "debito" ? novoPagamento.valor : 0,
          arquivo: novoPagamento.arquivo || null
        }]);

      if (error) throw error;
      toast.success("Pagamento salvo com sucesso!");

      registrarAuditoria({
        acao: 'criar_pagamento',
        entidade_tipo: 'pagamento_prestador',
        prestador_id: novoPagamento.prestadorId,
        prestador_nome: prestadorSelecionado.nome_completo,
        valor_novo: novoPagamento.natureza === "credito" ? novoPagamento.valor : -novoPagamento.valor,
        detalhes: {
          tipo_lancamento: novoPagamento.tipoLancamento,
          natureza: novoPagamento.natureza,
          forma_pagamento: novoPagamento.formaPagamento,
          observacao: novoPagamento.observacao,
          cliente_id: novoPagamento.clienteId,
          os_id: novoPagamento.osId,
        },
      });

      setShowNovoPagamento(false);
      setNovoPagamento({
        prestadorId: "",
        clienteId: "",
        osId: "",
        tipoLancamento: "Serviço OS",
        natureza: "credito",
        valor: 0,
        dataCompetencia: new Date().toISOString().split("T")[0],
        dataPrevistaPagamento: new Date().toISOString().split("T")[0],
        formaPagamento: "PIX",
        contaPagamento: "",
        observacao: "",
        arquivo: ""
      });
      fetchPagamentosManuais();
      fetchPagamentos();
    } catch (e: any) {
      const mensagem = e?.message || e?.details || "Erro desconhecido ao salvar pagamento";
      console.error("[PagamentoPrestadores] Erro ao salvar pagamento manual:", mensagem, e);
      toast.error(`Erro ao salvar: ${mensagem}`);
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

      const { error } = await supabase
        .from("pagamentos_prestadores")
        .update({ status: "pago", data_pagamento: new Date().toISOString().split("T")[0] })
        .eq("id", pagamentoId);

      if (error) throw error;
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

  const totalGeral = useMemo(() => {
    return Object.values(totaisPorPrestador).reduce((acc, t) => acc + t.liquido, 0);
  }, [totaisPorPrestador]);

  const totalOS = useMemo(() => {
    return oss.length;
  }, [oss]);

  const ossNumeros = useMemo(() => new Set((oss || []).map(o => o.numero)), [oss]);

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
        <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowNovoPagamento(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Pagamento
        </Button>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard Operacional</TabsTrigger>
          <TabsTrigger value="listagem">Fechamentos e Pagamentos</TabsTrigger>
          <TabsTrigger value="relatorio">Relatório Financeiro</TabsTrigger>
          <TabsTrigger value="conta-corrente">Conta Corrente</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="space-y-4">
          {(() => {
            const kpis = calcularKPIPrestador(pagamentos as any, pagamentosManuais as any, escalaRepasse);
            const alertas = gerarAlertas(kpis, kpis.divergencias, escalaRepasseDedup.length);
            const distribuicao = calcularDistribuicaoStatus(pagamentos as any, pagamentosManuais as any);
            const CORES = { pendente: "#F59E0B", pago: "#10B981", cancelado: "#EF4444", divergente: "#8B5CF6", agendado: "#3B82F6", em_lote: "#6366F1" };

            const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Bloqueados</p>
                      <p className="text-xl font-extrabold text-blue-700 mt-1">{kpis.bloqueados}</p>
                      <p className="text-xs text-blue-500 mt-0.5">{kpis.qtdPeriodo} no período</p>
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
            <Button variant="outline" onClick={() => { fetchOss(); fetchPagamentos(); }}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total OS do período", value: totalOS, color: "text-foreground", accent: "bg-slate-500" },
              { label: "Prestadores c/ OS", value: Object.keys(ossAgrupadas).length, color: "text-violet-500", accent: "bg-violet-500" },
              { label: "Total a pagar", value: totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), color: "text-amber-500", accent: "bg-amber-500" },
              { label: "Pagamentos confirmados", value: pagamentos.filter(p => p.status === "pago").length, color: "text-emerald-500", accent: "bg-emerald-500" },
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
                <TableHead>Qtd OS</TableHead>
                <TableHead>Valor Serviços</TableHead>
                <TableHead>Pedágio/Adicional</TableHead>
                <TableHead>Ajustes</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(totaisPorPrestador).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhuma OS encontrada no período selecionado
                  </TableCell>
                </TableRow>
              ) : (
                Object.entries(totaisPorPrestador || {}).map(([prestador, total]) => (
                  <TableRow key={prestador}>
                    <TableCell className="font-medium">{prestador}</TableCell>
                    <TableCell>{total.quantidade}</TableCell>
                    <TableCell>{total.servicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>{(total.pedagio + total.adicionais).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell>
                      <span className="text-green-600">+{((valoresAjustados[prestador]?.reembolso || 0) + (valoresAjustados[prestador]?.bonus || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      <span className="text-red-600"> -{((valoresAjustados[prestador]?.desconto || 0) + total.descontos).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </TableCell>
                    <TableCell className="font-bold text-orange-600">{total.liquido.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleAbrirDetalhe(prestador)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <TableHead>Cliente / OS</TableHead>
                <TableHead>Tipo Lançamento</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Débito</TableHead>
                <TableHead>Valor Líquido</TableHead>
                <TableHead>Status Fin.</TableHead>
                <TableHead>Forma Pagto</TableHead>
                <TableHead>Status Conf.</TableHead>
                <TableHead>Status Pagto</TableHead>
                <TableHead>Elegível Lote</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentosManuais.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento manual criado
                    </TableCell>
                  </TableRow>
              ) : (
                pagamentosManuais.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.data_competencia || p.created_at || '').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="font-medium">{p.prestador_nome}</TableCell>
                    <TableCell>
                      {p.cliente_nome && <span className="block text-xs">{p.cliente_nome}</span>}
                      {p.os_numero && <span className="block text-xs text-muted-foreground">OS: {p.os_numero}</span>}
                      {!p.cliente_nome && !p.os_numero && "-"}
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.tipo_lancamento}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        p.origem_lancamento === 'manual' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                        p.origem_lancamento === 'os_finalizada' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        p.origem_lancamento === 'fechamento' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        p.origem_lancamento === 'escala_operacional' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-slate-50 text-slate-600'
                      }>
                        {p.origem_lancamento === 'manual' ? 'Manual' :
                         p.origem_lancamento === 'os_finalizada' ? 'OS' :
                         p.origem_lancamento === 'fechamento' ? 'Fechamento' :
                         p.origem_lancamento === 'escala_operacional' ? 'Escala' : p.origem_lancamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {p.natureza === 'credito' ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : '-'}
                    </TableCell>
                    <TableCell className="text-red-600 font-medium">
                      {p.natureza === 'debito' ? p.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : '-'}
                    </TableCell>
                    <TableCell className="font-bold text-orange-600">
                      {(p.natureza === 'credito' ? p.valor : -p.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const sf = calcularStatusFinanceiro({
                          statusConferencia: p.status_conferencia,
                          statusAprovacao: p.status_aprovacao,
                          valorLiquido: p.natureza === 'credito' ? p.valor : -p.valor,
                        });
                        const info = getStatusFinanceiroInfo(sf);
                        return <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${info.bg} ${info.cor} ${info.borda}`}>{info.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>{p.forma_pagamento || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={p.status_conferencia === 'conferido' ? 'default' : 'secondary'} className={p.status_conferencia === 'conferido' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : ''}>
                        {p.status_conferencia === 'em_aberto' ? 'Em Aberto' : 
                         p.status_conferencia === 'conferido' ? 'Conferido' : 
                         p.status_conferencia === 'divergente' ? 'Divergente' : 
                         p.status_conferencia === 'bloqueado' ? 'Bloqueado' : p.status_conferencia}
                      </Badge>
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      {p.elegivel_lote ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.status_conferencia !== 'conferido' && (
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
                        {(p.status_pagamento === 'pendente' || p.status_pagamento === 'em_lote') ? (
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
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {pagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Fechamentos Anteriores</CardTitle>
              <Badge variant="outline" className="text-xs">{pagamentos.length} registro{pagamentos.length !== 1 ? "s" : ""}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Prestador</TableHead>
                  <TableHead className="text-right">Qtd OS</TableHead>
                  <TableHead className="text-right">Serviços</TableHead>
                  <TableHead className="text-right">Descontos</TableHead>
                  <TableHead className="text-right">Valor Líquido</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Divergências</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pagamentos || []).map(p => {
                  const exp = fechamentoExpandido[p.id] || false;
                  const divergencias = extrairDivergencias(p as any);
                  const sfInfo = getFechamentoStatusInfo(p.status);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFechamentoExpandido(prev => ({ ...prev, [p.id]: !exp }))}>
                          {exp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{p.periodo_inicio?.slice(0,10)} a {p.periodo_fim?.slice(0,10)}</TableCell>
                      <TableCell className="font-medium text-sm">{p.prestador_nome}</TableCell>
                      <TableCell className="text-right">{p.quantidade_os || 0}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{(p.valor_servicos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600">{(p.valor_descontos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-orange-600">{(p.valor_liquido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sfInfo.bg} ${sfInfo.cor}`}>{sfInfo.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {divergencias.length > 0 ? (
                          <div className="flex gap-1">
                            {divergencias.map(d => (
                              <Badge key={d.tipo} variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200" title={d.descricao}>
                                {d.label}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "pendente" && (
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleConfirmarPagamento(p.id)}>
                              <Check className="w-3 h-3 mr-1" /> Confirmar
                            </Button>
                          )}
                          {exp && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleGerarFechamento()}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Recalcular
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {pagamentos.some(p => fechamentoExpandido[p.id]) && (
        <div className="space-y-3">
          {pagamentos.filter(p => fechamentoExpandido[p.id]).map(p => {
            const sfInfo = getFechamentoStatusInfo(p.status);
            const memoria: string[] = [];
            memoria.push(`Valor serviços: ${(p.valor_servicos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
            if (p.valor_reembolsos) memoria.push(`+ Reembolsos: ${(p.valor_reembolsos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
            if (p.valor_bonus) memoria.push(`+ Bônus: ${(p.valor_bonus || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
            if (p.valor_descontos) memoria.push(`- Descontos: ${(p.valor_descontos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
            if (p.valor_adiantamentos) memoria.push(`- Adiantamentos: ${(p.valor_adiantamentos || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
            memoria.push(`= Valor líquido: ${(p.valor_liquido || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);

            const pgtoStatus = p.status === "pago" ? "pago" : p.status === "cancelado" ? "cancelado" : p.status_pagamento || p.status || "pendente";
            const tipoPgto = detectarTipoPagamento(p as any);
            const tipoPgtoBadge = getTipoPagamentoBadge(tipoPgto);
            const timeline = getTimelineSteps(pgtoStatus);

            return (
              <Card key={p.id} className="border-l-4 border-l-indigo-300">
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-indigo-800">Memória de Cálculo</h4>
                      <div className="bg-slate-50 rounded-lg p-3 text-xs font-mono space-y-1">
                        {memoria.map((linha, i) => (
                          <p key={i} className={linha.startsWith("=") ? "font-bold text-indigo-700 border-t border-slate-200 pt-1 mt-1" : ""}>{linha}</p>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-indigo-800">Dados do Fechamento</h4>
                      <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Período</span><span>{p.periodo_inicio?.slice(0,10)} a {p.periodo_fim?.slice(0,10)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">OS no período</span><span>{p.quantidade_os || 0}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span><Badge variant="outline" className={`text-[10px] ${sfInfo.bg} ${sfInfo.cor}`}>{sfInfo.label}</Badge></span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Pagamento</span><span><Badge variant="outline" className={`text-[10px] ${tipoPgtoBadge.bg} ${tipoPgtoBadge.cor}`}>{tipoPgtoBadge.label}</Badge></span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Conferência</span><span>{p.status_conferencia || "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Aprovação</span><span>{p.status_aprovacao || "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Forma Pagto</span><span>{p.origem_lancamento === "fechamento" && p.status === "pago" ? "Fechamento" : p.status_pagamento === "pago" ? "Pago" : "—"}</span></div>
                        {p.data_pagamento && <div className="flex justify-between"><span className="text-muted-foreground">Data Pagto</span><span>{new Date(p.data_pagamento).toLocaleDateString("pt-BR")}</span></div>}
                        {p.observacao && <div className="flex justify-between"><span className="text-muted-foreground">Observação</span><span className="text-right max-w-[200px] truncate">{p.observacao}</span></div>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-800 mb-2">Timeline de Pagamento</h4>
                    <div className="flex items-center gap-0 bg-slate-50 rounded-lg p-3">
                      {timeline.map((step, i) => (
                        <div key={step.status} className="flex items-center flex-1">
                          <div className={`flex items-center gap-1.5 ${step.concluido ? "text-emerald-600" : step.ativo ? "text-indigo-600 font-semibold" : "text-slate-400"}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${step.concluido ? "bg-emerald-100 border-emerald-400" : step.ativo ? "bg-indigo-100 border-indigo-400" : "bg-slate-100 border-slate-300"}`}>
                              {step.concluido ? <Check className="w-3 h-3" /> : i + 1}
                            </div>
                            <span className="text-[10px] whitespace-nowrap">{step.label}</span>
                          </div>
                          {i < timeline.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-2 ${step.concluido ? "bg-emerald-300" : "bg-slate-200"}`} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <CardTitle className="text-lg">Repasses da Escala Operacional</CardTitle>
              <CardDescription>
                {escalaRepasseLoading ? "Carregando..." : "Dados preparados da escala — ainda não processados como pagamento"}
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
                Origem: Escala Operacional
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {escalaRepasseLoading ? (
            <div className="text-center py-4 text-muted-foreground">Carregando dados da Escala...</div>
          ) : Object.keys(escalaAgrupada).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum repasse pendente da Escala Operacional
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
                          <TableHead className="text-xs text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itemsFiltrados.map(item => {
                          const compInfo = getStatusComprovanteInfo(item.comprovanteStatus);
                          return (
                          <TableRow key={item.alocacaoId} className={item.comprovanteStatus === "pendente" ? "opacity-70" : ""}>
                            <TableCell className="font-mono text-xs">{item.os || "-"}</TableCell>
                            <TableCell className="text-xs">{item.data ? new Date(item.data).toLocaleDateString("pt-BR") : "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${compInfo.className}`}>
                                {compInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right">{item.valorBase.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                            <TableCell className="text-xs text-right text-green-600">{item.valorAdicionais > 0 ? item.valorAdicionais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</TableCell>
                            <TableCell className="text-xs text-right text-red-600">{item.valorDescontos > 0 ? item.valorDescontos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-"}</TableCell>
                            <TableCell className="text-xs text-right font-bold">{item.valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                            <TableCell className="text-xs text-right">{item.quantidadeEntregas || "-"}</TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 text-xs"
                                disabled={gerandoRepasseId === item.alocacaoId}
                                onClick={() => handleGerarRepasse(item)}
                              >
                                {gerandoRepasseId === item.alocacaoId ? "Gerando..." : "Gerar Repasse"}
                              </Button>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })}
              <div className="text-right text-sm text-muted-foreground">
                Total em repasses da Escala:{" "}
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
        <TabsContent value="relatorio" className="space-y-4">
          {(() => {
            const linhas = gerarLinhasRelatorio(pagamentos as any, pagamentosManuais as any);
            const totalServicos = linhas.reduce((s, l) => s + l.valorServicos, 0);
            const totalLiquido = linhas.reduce((s, l) => s + l.valorLiquido, 0);
            const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">Relatório Financeiro de Prestadores</h3>
                    <p className="text-sm text-muted-foreground">{linhas.length} registro(s) — Total líquido: {fmt(totalLiquido)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={imprimirRelatorio}>
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
                          linhas.map((l, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium text-xs">{l.prestadorNome}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">{l.periodoInicio || "—"} a {l.periodoFim || "—"}</TableCell>
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
                              <TableCell className="text-xs">{l.origem || "—"}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Serviços</p><p className="text-sm font-bold">{fmt(totalServicos)}</p></CardContent></Card>
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Descontos</p><p className="text-sm font-bold text-red-600">{fmt(linhas.reduce((s, l) => s + l.valorDescontos, 0))}</p></CardContent></Card>
                  <Card className="bg-slate-50/50"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Adicionais</p><p className="text-sm font-bold text-green-600">{fmt(linhas.reduce((s, l) => s + l.valorAdicionais, 0))}</p></CardContent></Card>
                  <Card className="bg-indigo-50/50 border-indigo-100"><CardContent className="p-3"><p className="text-[10px] font-semibold text-muted-foreground uppercase">Total Líquido</p><p className="text-sm font-bold text-indigo-700">{fmt(totalLiquido)}</p></CardContent></Card>
                </div>
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
                            <TableCell className={`text-right font-bold ${e.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{e.saldo.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</TableCell>
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

      <Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Fechamento</DialogTitle>
          </DialogHeader>
          {selectedPrestador && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Prestador</Label>
                  <p className="font-medium">{selectedPrestador.nome_completo}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
                  <p className="font-medium">{selectedPrestador.cpf_cnpj}</p>
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
                      <TableHead>OS</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Pedágio</TableHead>
                      <TableHead>Adicional</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ossAgrupadas[selectedPrestador.nome_completo] || []).slice(0, 10).map(os => (
                      <TableRow key={os.id}>
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
            <DialogTitle>Novo Pagamento Manual</DialogTitle>
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
                  <Label>Cliente (Opcional)</Label>
                  <Select value={novoPagamento.clienteId} onValueChange={v => setNovoPagamento(p => ({ ...p, clienteId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                    <SelectContent>
                      {clientes.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 font-medium text-center">
                          Nenhum cliente encontrado
                        </div>
                      ) : (
                        clientes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>OS Vinculada (Opcional)</Label>
                  <Select value={novoPagamento.osId || ""} onValueChange={v => setNovoPagamento(p => ({ ...p, osId: v }))}>
                    <SelectTrigger><SelectValue placeholder={!novoPagamento.prestadorId ? "Selecione um prestador primeiro" : "Nenhuma OS disponível"} /></SelectTrigger>
                    <SelectContent>
                      {!novoPagamento.prestadorId ? (
                        <div className="p-3 text-sm text-slate-500 font-medium text-center">
                          Selecione um prestador para ver as OS disponíveis
                        </div>
                      ) : ossDoPrestador.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500 font-medium text-center">
                          Nenhuma OS finalizada para este prestador
                        </div>
                      ) : (
                        ossDoPrestador.map(os => (
                          <SelectItem key={os.id} value={os.id}>{os.numero} ({new Date(os.data || '').toLocaleDateString('pt-BR')})</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Lançamento *</Label>
                  <Select value={novoPagamento.tipoLancamento} onValueChange={v => setNovoPagamento(p => ({ ...p, tipoLancamento: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Serviço OS">Serviço OS</SelectItem>
                      <SelectItem value="Avulso">Avulso</SelectItem>
                      <SelectItem value="Reembolso">Reembolso</SelectItem>
                      <SelectItem value="Pedágio">Pedágio</SelectItem>
                      <SelectItem value="Estacionamento">Estacionamento</SelectItem>
                      <SelectItem value="Combustível">Combustível</SelectItem>
                      <SelectItem value="Diária">Diária</SelectItem>
                      <SelectItem value="Ajudante">Ajudante</SelectItem>
                      <SelectItem value="Adicional">Adicional</SelectItem>
                      <SelectItem value="Desconto">Desconto</SelectItem>
                      <SelectItem value="Adiantamento">Adiantamento</SelectItem>
                      <SelectItem value="Multa">Multa</SelectItem>
                      <SelectItem value="Ajuste">Ajuste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Natureza *</Label>
                  <Select value={novoPagamento.natureza} onValueChange={v => setNovoPagamento(p => ({ ...p, natureza: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credito">Crédito para o prestador (+)</SelectItem>
                      <SelectItem value="debito">Débito/Desconto (-)</SelectItem>
                    </SelectContent>
                  </Select>
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
                  <Label>Data de Competência *</Label>
                  <Input type="date" value={novoPagamento.dataCompetencia} onChange={e => setNovoPagamento(p => ({ ...p, dataCompetencia: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>Data Prevista Pagamento</Label>
                  <Input type="date" value={novoPagamento.dataPrevistaPagamento} onChange={e => setNovoPagamento(p => ({ ...p, dataPrevistaPagamento: e.target.value }))} />
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
                  <Label>Observação</Label>
                  <Input 
                    value={novoPagamento.observacao} 
                    onChange={e => setNovoPagamento(p => ({ ...p, observacao: e.target.value }))}
                    placeholder="Detalhes adicionais sobre o pagamento"
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Anexo / Comprovante</Label>
                  <Label htmlFor="arquivo-anexo" className="border-2 border-dashed border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition-colors m-0 w-full h-full">
                    <Download className="h-8 w-8 text-slate-400 mb-2" />
                    <p className="text-sm font-medium text-slate-700">{novoPagamento.arquivo ? "Arquivo selecionado" : "Clique para anexar um arquivo"}</p>
                    <p className="text-xs text-slate-500">PDF, JPG ou PNG (Máx 5MB)</p>
                    <input 
                      id="arquivo-anexo"
                      type="file" 
                      className="hidden" 
                      accept=".pdf,image/jpeg,image/png"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                           // Lógica simples de arquivo por base64 (poderia ir pro storage)
                           const file = e.target.files[0];
                           const reader = new FileReader();
                           reader.onloadend = () => {
                             setNovoPagamento(p => ({ ...p, arquivo: reader.result as string }));
                             toast.success("Arquivo anexado localmente!");
                           };
                           reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </Label>
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
                          <p className="font-medium">{prestadorInfo?.cpf_cnpj || "Não informado"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Telefone</p>
                          <p className="font-medium">{prestadorInfo?.telefone || "Não informado"}</p>
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
            <Button variant="outline" onClick={() => setShowNovoPagamento(false)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvarNovoPagamento}>
              <Check className="w-4 h-4 mr-2" /> Salvar Lançamento
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
    </div>
  );
}

/** @deprecated A finalização de OS agora grava diretamente em pagamentos_prestadores via ordemServicoService. Esta função está mantida para compatibilidade, mas não é mais chamada pelo fluxo principal. */
export async function gerarLancamentosPrestadorPorOS(os: any) {
  if (!os || os.status !== 'finalizada' || !os.prestador_id) return;
  
  const { data: existente } = await supabase
    .from('pagamentos_prestadores')
    .select('id')
    .eq('os_id', os.id)
    .eq('origem_lancamento', 'os')
    .maybeSingle();
    
  if (existente) return;

  const resultado = calcularRepassePrestador({
    custo_prestador: os.custo_prestador,
    pedagio: os.pedagio,
    adicionais: os.adicionais,
    descontos: os.descontos,
  });
  
  const payload = {
    prestador_id: os.prestador_id,
    os_id: os.id,
    os_numero: os.numero,
    tipo_lancamento: 'Serviço OS',
    natureza: resultado.totalLiquido >= 0 ? 'credito' : 'debito',
    valor: Math.abs(resultado.totalLiquido),
    valor_liquido: resultado.totalLiquido,
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
