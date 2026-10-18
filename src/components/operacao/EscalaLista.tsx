import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle, FileText, Download, Wallet, Clock, DollarSign, Percent, Activity, AlertTriangle, AlertCircle, CheckCircle, History, ExternalLink, Play, Edit, Package, BarChart3, Trash2, Hash } from "lucide-react";
import { AlocacaoCancelamentoModal } from "./escala/AlocacaoCancelamentoModal";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { cancelarAlocacao, criarAlocacao, atualizarAlocacao } from "@/services/escala/escalaService";
import { dividirDescontosEscala, reconstruirDescontosEscala } from "@/services/escala/escalaFinanceiroDesconto";
import { buscarTemposReaisAlocacao, formatarDuracaoMin, type TemposOperacionaisReais } from "@/services/escala/escalaTemposService";
import { calcularPrecoRapido } from "@/services/precificacao/precificacaoEngineService";
import { resolverRepassePrestadorBase } from "@/helpers/repassePrestador";
import { resolverFranquiaEfetiva, resolverTarifaKmExcedente } from "@/helpers/franquiaKm";
import { selecionarTabelaPorCondicaoTerica } from "@/helpers/condicaoTerica";
// normalizeClienteNome removido — normalização inline com trim+toUpperCase
import { obterLabelStatus, obterClasseBadgeStatus, normalizarStatusParaUI, normalizarStatusParaBanco, isStatusCancelado } from "./escalaStatus";
import { enviarMensagem } from "@/services/integracoes/whatsappService";
import PODDisplay from "./PODDisplay";
import { ColetaReversaFields, emptyReversaFields, dbToReversaFields, hasReversaData, REVERSA_STATUS_LABELS, type ReversaFields } from "./ColetaReversaFields";
import { ColetaReversaFinanceiro } from "./ColetaReversaFinanceiro";
import { useEscalaRealtime } from "@/hooks/useEscalaRealtime";


import jsPDF from "jspdf";
import {
  drawCoverPage, drawContentHeader, drawInfoBlock, drawFinancialComposition, drawObservations, getPageSetup, fmtBRL as pdfFmtBRL
} from "@/lib/pdf/foundation";

type Periodo = 'semanal' | 'quinzenal' | 'mensal';

interface AlocacaoFinanceiro {
  valorTipo: 'cadastro' | 'percentual' | 'fixo';
  valorPercentual: number;
  valorFixo: number;
  combustivel: number;
  kmRodados: number;
  valorKm: number;
  pedagio: number;
  pedagioFranquia: number;
  pedagioExcedente: number;
  pedagioCobrarExcedente: boolean;
  diariasAdicionais: number;
  valorDiaria: number;
  segundaSaida: boolean;
  valorSegundaSaida: number;
  terceiraSaida: boolean;
  valorTerceiraSaida: number;
  saidasAdicionais: number;
  valorSaidaAdicional: number;
  ajudantes: number;
  valorAjudante: number;
  desconto: number;
  reembolsosOutros: string;
  valorReembolsoOutros: number;
}

// Mock data com veículos padronizados conforme tipos do sistema
const TIPO_VEICULO_LABEL: Record<string, string> = {
  todos: "Qualquer veículo",
  moto: "Moto",
  passeio: "Passeio",
  fiorino: "Fiorino",
  kangoo: "Kangoo",
  kombi: "Kombi",
  van: "Van",
  vuc: "VUC",
  hr: "HR",
  "3_4": "3/4",
  toco: "Toco",
  truck: "Truck",
  carreta: "Carreta",
  bitrem: "Bitrem",
  outro: "Outros",
};

const CORES_STATUS: any = {
  disponivel: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300",
  confirmado: "bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-300",
  aguardando: "bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-300 dashed-border",
  operacao: "bg-orange-500 text-white hover:bg-orange-600 border-orange-600",
  indisponivel: "bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200",
};

export default function EscalaLista() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodo, setPeriodo] = useState<Periodo>('semanal');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{prestadorId: string, data: Date} | null>(null);
  const [dataAlocacaoModal, setDataAlocacaoModal] = useState("");
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  const [selectedCarregamentoDetail, setSelectedCarregamentoDetail] = useState<any>(null);
  const [showCarregamentoDetailModal, setShowCarregamentoDetailModal] = useState(false);
  const [selectedPodAlocacao, setSelectedPodAlocacao] = useState<string | null>(null);
  const [showPODModal, setShowPODModal] = useState(false);
  // Removed mock confirmacoesCarregamento
  
  // States reais para dados
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novaOSId, setNovaOSId] = useState("");
  const [numeroOC, setNumeroOC] = useState("");
  const [novoPrestadorId, setNovoPrestadorId] = useState("");
  const [novoPrestadorNome, setNovoPrestadorNome] = useState("");
  const [filtroPrestadorModal, setFiltroPrestadorModal] = useState("");
  const [showPrestadorDropdown, setShowPrestadorDropdown] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [prestadorVeiculo, setPrestadorVeiculo] = useState<{tipo_veiculo: string, placa: string, refrigerado: boolean, condicao_termica?: string} | null>(null);
  const [tabelaAmbiguidadeTermica, setTabelaAmbiguidadeTermica] = useState(false);
  const [instrucoesPrestador, setInstrucoesPrestador] = useState("");
  const [observacaoCliente, setObservacaoCliente] = useState("");
  const [tabelaValores, setTabelaValores] = useState<any>(null);
  const [tabelaRascunhoEncontrada, setTabelaRascunhoEncontrada] = useState<any>(null);
  // ESCALA-E2E-08D — proteção contra race: respostas assíncronas antigas do lookup
  // de tabela não podem sobrescrever o resultado mais recente.
  const tabelaReqSeqRef = useRef(0);
  const [kmExcedentePrestador, setKmExcedentePrestador] = useState<number>(0);
  const [minutosEspera, setMinutosEspera] = useState<number>(0);
  const [ajusteClienteValor, setAjusteClienteValor] = useState<number>(0);
  const [ajusteClienteMotivo, setAjusteClienteMotivo] = useState("");
  const [regraEspecialAtiva, setRegraEspecialAtiva] = useState(false);
  const [loadingTabelaValores, setLoadingTabelaValores] = useState(false);
  const [novoTipo, setNovoTipo] = useState("reserva");
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [kmInicial, setKmInicial] = useState<number>(0);
  const [kmFinal, setKmFinal] = useState<number>(0);
  const [statusOperacional, setStatusOperacional] = useState("planejado");
  const [observacaoOperacional, setObservacaoOperacional] = useState("");
  const [tempoChegadaPatio, setTempoChegadaPatio] = useState("07:45");
  const [tempoInicioCarregamento, setTempoInicioCarregamento] = useState("08:15");
  const [tempoFimCarregamento, setTempoFimCarregamento] = useState("09:00");
  const [tempoSaidaRua, setTempoSaidaRua] = useState("09:15");
  const [tempoFinalizacaoEntregas, setTempoFinalizacaoEntregas] = useState("17:30");
  // A31-H — tempos operacionais REAIS derivados dos eventos do App (eventos_oficiais)
  const [temposReais, setTemposReais] = useState<TemposOperacionaisReais | null>(null);
  const [novaOrigem, setNovaOrigem] = useState("");
  const [novoDestino, setNovoDestino] = useState("");
  // Coleta Reversa fields
  const [reversaFields, setReversaFields] = useState<ReversaFields>(emptyReversaFields());
  const [showReversa, setShowReversa] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("acao") === "alocar") {
      setTimeout(() => {
        const hoje = format(new Date(), 'yyyy-MM-dd');
        setDataAlocacaoModal(hoje);
        handleCellClick("", new Date());
        setModalOpen(true);
        window.history.replaceState({}, '', window.location.pathname + "?tab=escala");
      }, 500); // Wait for initial render and data load
    }
  }, []);

  // Função para buscar tabela de valores do cliente
  const buscarTabelaValoresCliente = useCallback(async (clienteId: string, clienteNome: string, tipoVeiculo: string, dataEscalaStr?: string, condicaoTerica?: string) => {
    if (!clienteId || !tipoVeiculo) return null;
    const reqId = ++tabelaReqSeqRef.current;
    const isStale = () => reqId !== tabelaReqSeqRef.current;
    setLoadingTabelaValores(true);
    try {
      const dataEscala = dataEscalaStr ? new Date(dataEscalaStr) : new Date();

      // Resolver nome canônico do banco (igne whitespace/case do input)
      let nomeCanonico: string | null = null;
      const { data: cliRow } = await supabase
        .from("clientes")
        .select("nome_fantasia")
        .eq("id", clienteId)
        .maybeSingle();
      if (cliRow?.nome_fantasia) {
        nomeCanonico = cliRow.nome_fantasia;
      }

      const normalizar = (s: string) => (s || "").trim().toUpperCase();

      // Buscar todas as tabelas ativas para o tipo de veículo e matchear por nome normalizado
      const { data: candidateTables } = await supabase
        .from("tabelas_valores")
        .select("id, nome, valor_base, valor_km, km_franquia, franquia_km, valor_km_excedente, tipo_veiculo, classificacao_termica, status, data_inicio, data_fim, ativo, percentual_prestador, valor_fixo_prestador, tipo_repasse_prestador, adicionais, cliente, universal")
        .eq("tipo_veiculo", tipoVeiculo)
        .eq("ativo", true);

      let escolhida = null;
      let rascunhoEncontrado = null;
      let ambiguidade = false;

      if (candidateTables && candidateTables.length > 0) {
        const specificMatch = candidateTables.find(t => {
          if (t.universal) return false;
          const dbNome = normalizar(t.cliente || "");
          const inputNome = normalizar(nomeCanonico || clienteNome || "");
          return dbNome !== "" && inputNome !== "" && dbNome === inputNome;
        });

        if (specificMatch) {
          const ativas = candidateTables.filter(t => !t.universal && (t.ativo || t.status === 'ativa'));
          const rascunhos = candidateTables.filter(t => !t.universal && (!t.ativo || t.status === 'rascunho' || t.status === 'inativa'));
          if (rascunhos.length > 0) rascunhoEncontrado = rascunhos[0];

          const matchAtivas = ativas.filter(d => normalizar(d.cliente || "") === normalizar(nomeCanonico || clienteNome || ""));

          // ESCALA-07 — condição térmica é dimensão INDEPENDENTE do tipo de veículo.
          const sel = selecionarTabelaPorCondicaoTerica(matchAtivas, condicaoTerica);
          if (sel.ambiguidade) {
            ambiguidade = true;
            escolhida = null;
          } else if (sel.tabela) {
            const comVigencia = sel.compativeis.find(d => {
              if (!d.data_inicio) return true;
              return new Date(d.data_inicio) <= dataEscala && (!d.data_fim || new Date(d.data_fim) >= dataEscala);
            });
            escolhida = comVigencia || sel.tabela;
          } else {
            // condição térmica conhecida sem tabela compatível → NÃO usar tabela incompatível
            escolhida = null;
          }
        }
      }

      if (isStale()) return null;
      setTabelaAmbiguidadeTermica(ambiguidade);

      if (escolhida) {
        setTabelaRascunhoEncontrada(rascunhoEncontrado);
        setTabelaValores({ ...escolhida, franquia_km: resolverFranquiaEfetiva(escolhida.franquia_km, escolhida.km_franquia), km_franquia: resolverFranquiaEfetiva(escolhida.franquia_km, escolhida.km_franquia), valor_km_excedente: resolverTarifaKmExcedente(escolhida.valor_km_excedente, escolhida.valor_km) });
        setRegraEspecialAtiva(true);
        return escolhida;
      }

      // Fallback universal (mesma dimensão térmica; não escolher arbitrariamente)
      if (isStale()) return null;
      const { data: universalList } = await supabase
        .from("tabelas_valores")
        .select("id, nome, valor_base, valor_km, km_franquia, franquia_km, valor_km_excedente, tipo_veiculo, classificacao_termica, status, data_inicio, data_fim, ativo, percentual_prestador, valor_fixo_prestador, tipo_repasse_prestador, adicionais")
        .eq("universal", true)
        .eq("tipo_veiculo", tipoVeiculo)
        .eq("ativo", true);

      const selUniversal = selecionarTabelaPorCondicaoTerica(universalList || [], condicaoTerica);
      if (selUniversal.ambiguidade) setTabelaAmbiguidadeTermica(true);
      const universalData = selUniversal.tabela;

      if (isStale()) return null;
      if (universalData) {
        setTabelaRascunhoEncontrada(rascunhoEncontrado);
        setTabelaValores({ ...universalData, franquia_km: resolverFranquiaEfetiva(universalData.franquia_km, universalData.km_franquia), km_franquia: resolverFranquiaEfetiva(universalData.franquia_km, universalData.km_franquia), valor_km_excedente: resolverTarifaKmExcedente(universalData.valor_km_excedente, universalData.valor_km) });
        setRegraEspecialAtiva(false);
        return universalData;
      }

      if (isStale()) return null;
      setTabelaRascunhoEncontrada(rascunhoEncontrado);
      setTabelaValores(null);
      setRegraEspecialAtiva(false);
      return null;
    } catch (err) {
      console.error("Erro ao buscar tabela de valores:", err);
      if (isStale()) return null;
      setTabelaValores(null);
      setTabelaRascunhoEncontrada(null);
      setRegraEspecialAtiva(false);
      return null;
    } finally {
      if (!isStale()) setLoadingTabelaValores(false);
    }
  }, []);

  // ESCALA-E2E-08D — resolução reativa e INDEPENDENTE DE ORDEM.
  // Sempre que houver cliente + veículo (tipo canônico) + data, a tabela é (re)calculada,
  // seja o fluxo Prestador→Cliente ou Cliente→Prestador. Protegido contra race pelo seqRef.
  useEffect(() => {
    if (!modalOpen) return;
    if (!novoClienteId) return;
    if (!prestadorVeiculo?.tipo_veiculo) return;
    buscarTabelaValoresCliente(
      novoClienteId,
      novoClienteNome,
      prestadorVeiculo.tipo_veiculo,
      dataAlocacaoModal,
      prestadorVeiculo.condicao_termica
    );
  }, [
    modalOpen,
    novoClienteId,
    novoClienteNome,
    prestadorVeiculo?.tipo_veiculo,
    prestadorVeiculo?.condicao_termica,
    dataAlocacaoModal,
    buscarTabelaValoresCliente,
  ]);

  // Função para buscar dados do veículo do prestador
  const buscarDadosVeiculoPrestador = useCallback(async (prestadorId: string) => {
    const { data, error } = await supabase
      .from("prestadores")
      .select("veiculos(id, tipo_veiculo, tipo, placa, modelo, tipo_carga)")
      .eq("id", prestadorId)
      .single();
    
    if (!error && data) {
      const veiculos = data.veiculos || [];
      if (veiculos.length === 0) {
        // Prestador sem veículo vinculado — sem fallback
        setPrestadorVeiculo({ tipo_veiculo: "", placa: "", refrigerado: false, condicao_termica: "" });
        return data;
      }
      if (veiculos.length > 1) {
        // Múltiplos veículos — bloquear (não escolher arbitrariamente)
        setPrestadorVeiculo(null);
        return data;
      }
      // Exatamente 1 veículo — usar tipo_veiculo canônico, fallback para tipo legado
      const v = veiculos[0];
      const effectiveType = v.tipo_veiculo || v.tipo || "";
      setPrestadorVeiculo({
        tipo_veiculo: effectiveType,
        placa: v.placa || "",
        refrigerado: false,
        condicao_termica: v.tipo_carga || ""
      });
      return data;
    }
    setPrestadorVeiculo(null);
    return null;
  }, []);

  // Filtros Avançados
  const [filtroPeriodo, setFiltroPeriodo] = useState("esta_semana");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dataFim, setDataFim] = useState(format(addDays(new Date(), 7), "yyyy-MM-dd"));
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  
  // Dados Financeiros
  const [financeiro, setFinanceiro] = useState<AlocacaoFinanceiro>({
    valorTipo: 'cadastro',
    valorPercentual: 0,
    valorFixo: 0,
    combustivel: 0,
    kmRodados: 0,
    valorKm: 0,
    pedagio: 0,
    pedagioFranquia: 100,
    pedagioExcedente: 0,
    pedagioCobrarExcedente: false,
    diariasAdicionais: 0,
    valorDiaria: 0,
    segundaSaida: false,
    valorSegundaSaida: 0,
    terceiraSaida: false,
    valorTerceiraSaida: 0,
    saidasAdicionais: 0,
    valorSaidaAdicional: 0,
    ajudantes: 0,
    valorAjudante: 0,
    desconto: 0,
    reembolsosOutros: '',
    valorReembolsoOutros: 0
  });

  // Alocações do período
  const [alocacoes, setAlocacoes] = useState<any[]>([]);
  const [listaClientes, setListaClientes] = useState<any[]>([]);

  // D15: Realtime subscription para atualização automática da escala
  useEscalaRealtime(() => {
    loadAlocacoes();
  });

  useEffect(() => {
    // Carregar prestadores reais
    async function loadPrestadores() {
      try {
        const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, tipo_veiculo, placa), status, regiao_principal, valor_diaria, valor_saida, fixo_mensal, franquia_km, valor_km")
          .eq("status", "ativo");
        
        if (error) throw error;
        
        // Formatar para uso
        const fmtd = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome_completo,
          cpfCnpj: p.cpf_cnpj,
          telefone: p.telefone || p.whatsapp,
          veiculo: p.veiculos && p.veiculos.length > 0 ? (p.veiculos[0].tipo_veiculo || p.veiculos[0].tipo || '') : '',
          placa: p.veiculos && p.veiculos.length > 0 ? p.veiculos[0].placa : '',
          regiao: p.regiao_principal || "Sem região",
          status: "disponivel",
          avatar: p.nome_completo ? p.nome_completo.substring(0,2).toUpperCase() : "PR",
          financeiro_real: {
             tipo_pagamento: "pix",
             valor_diaria: p.valor_diaria || 0,
             valor_saida: p.valor_saida || 0,
             fixo_mensal: p.fixo_mensal || 0,
             franquia_km: p.franquia_km || 0,
             valor_km: p.valor_km || 0
          }
        }));
        
        setPrestadores(fmtd);
      } catch (err) {
         console.warn("Erro ao buscar prestadores para escala", err);
      }
    }

    async function loadClientes() {
      try {
        const { data, error } = await supabase
          .from("clientes")
          .select("id, nome_fantasia")
          .order("nome_fantasia");
        if (!error && data) {
          setListaClientes(data);
        }
      } catch (e) {
        console.warn("Erro ao buscar clientes", e);
      }
    }

    loadPrestadores();
    loadClientes();
    loadAlocacoes();
  }, []);

  // Tentar carregar alocações do Supabase primeiro
  const loadAlocacoes = useCallback(async () => {
      try {
        const hoje = new Date();
        const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
        const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('alocacoes_escala')
          .select(`
            id, data_escala, status, status_pagamento, turno, tipo_veiculo, placa,
            valor_fixo, valor_frete, valor_pedagio, valor_combustivel, valor_ajudante,
            valor_adicional, valor_desconto, valor_desconto_prestador, valor_total, km_realizados, metadata, observacoes,
            prestador_id, cliente_id, ordem_servico_id,
            prestadores!prestador_id!left(id, nome_completo),
            clientes!cliente_id!left(id, nome_fantasia),
            ordens_servico!ordem_servico_id!left(id, numero)
          `)
          .gte('data_escala', inicioMes)
          .lte('data_escala', fimMes)
          .order('data_escala', { ascending: true });

        if (!error && data) {
          if (data.length > 0) {
            const mapped = data.map((r: any) => {
              const prestNome = r.prestadores?.nome_completo || r.metadata?.prestadorNome || '';
              const cliNome = r.clientes?.nome_fantasia || r.metadata?.clienteNome || '';
              const meta = r.metadata || {};
              const valorBase = Number(r.valor_fixo ?? meta.totals?.valorBase ?? 0);
              const adicionais = Number(r.valor_adicional ?? meta.totals?.totalAdicionais ?? 0);
              // A31-J1.12 — contrato oficial: valor_desconto = cliente; valor_desconto_prestador = prestador.
              const descontoPrestador = Number(r.valor_desconto_prestador || r.valor_desconto || meta.totals?.totalDescontos || 0);
              const descontoCliente = Number(r.valor_desconto || 0);
              const total = Number(r.valor_total ?? (valorBase + adicionais - descontoPrestador));
              return {
                id: r.id,
                prestadorId: r.prestador_id,
                prestadorNome: prestNome,
                clienteId: r.cliente_id,
                clienteNome: cliNome,
                data: (r.data_escala && r.data_escala.includes('T') ? r.data_escala.split('T')[0] : r.data_escala) + 'T12:00:00',
                turno: r.turno,
                status: r.status,
                statusPagamento: r.status_pagamento,
                os: meta.os || '',
                osNumero: r.ordens_servico?.numero || meta.os || '',
                osId: r.ordem_servico_id || meta.ordem_servico_id || '',
                horarioInicio: meta.horarioInicio || '',
                horarioFim: meta.horarioFim || '',
                kmInicial: meta.kmInicial || 0,
                kmFinal: meta.kmFinal || 0,
                prestadorVeiculo: { tipo_veiculo: r.tipo_veiculo, placa: r.placa },
                financeiro: meta.financeiro || {},
                descontoPrestador,
                descontoCliente,
                totals: { valorBase, totalAdicionais: adicionais, totalDescontos: descontoPrestador, total },
                metadata: meta,
              };
            });
            console.log("[DEBUG] loadAlocacoes retornou:", mapped.length, "registros", mapped);
            setAlocacoes(mapped);
          } else {
            setAlocacoes([]);
          }
          return; // Não usa localStorage se Supabase respondeu (mesmo que vazio)
        }
      } catch (e) {
        console.warn('Fallback para localStorage (Supabase indisponível):', e);
      }
      // Fallback: carregar alocações locais
      const saved = localStorage.getItem('conexao_escala_operacional');
      if (saved) {
        try { setAlocacoes(JSON.parse(saved)); } catch (e) {}
      }
    }, []);

  const diasPeriodo = useMemo(() => {
    let start = currentDate;
    let days = 7;

    switch (filtroPeriodo) {
      case 'hoje':
        start = new Date();
        days = 1;
        break;
      case 'amanha':
        start = addDays(new Date(), 1);
        days = 1;
        break;
      case 'esta_semana':
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
        break;
      case 'proxima_semana':
        start = addDays(startOfWeek(currentDate, { weekStartsOn: 1 }), 7);
        days = 7;
        break;
      case 'quinzenal':
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 15;
        break;
      case 'este_mes':
        start = startOfMonth(new Date());
        days = differenceInDays(endOfMonth(start), start) + 1;
        break;
      case 'proximo_mes':
        start = startOfMonth(addDays(endOfMonth(new Date()), 1));
        days = differenceInDays(endOfMonth(start), start) + 1;
        break;
      case 'personalizado':
        start = new Date(dataInicio + 'T12:00:00');
        days = Math.max(1, differenceInDays(new Date(dataFim + 'T12:00:00'), start) + 1);
        break;
      default:
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
    }

    return Array.from({ length: days }).map((_, i) => addDays(start, i));
  }, [currentDate, filtroPeriodo, dataInicio, dataFim]);

  const clientesDisponiveis = useMemo(() => {
    const clients = new Map();
    alocacoes.forEach(a => {
      if (a.clienteId && a.clienteNome) {
        clients.set(a.clienteId, a.clienteNome);
      }
    });
    return Array.from(clients.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [alocacoes]);

  const alocacoesFiltradas = useMemo(() => {
    return alocacoes.filter(a => {
      const uiStatus = normalizarStatusParaUI(a.status);
      const isCancelada = uiStatus === 'cancelado';
      if (filtroStatus !== 'cancelado' && isCancelada) return false;
      if (filtroStatus === 'cancelado' && !isCancelada) return false;
      if (filtroCliente !== "todos" && a.clienteId !== filtroCliente) return false;
      return true;
    });
  }, [alocacoes, filtroCliente, filtroStatus]);

  const prestadoresFiltrados = useMemo(() => {
    return prestadores.filter(p => {
      const matchNome = p.nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
                        p.placa.toLowerCase().includes(filtroNome.toLowerCase());
      const matchVeiculo = filtroVeiculo === "todos" || p.veiculo === filtroVeiculo;

      let matchCliente = true;
      if (filtroCliente !== "todos") {
        matchCliente = alocacoesFiltradas.some(a => a.prestadorId === p.id && diasPeriodo.some(d => isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), d)));
      }

      let matchStatus = true;
      if (filtroStatus !== "todos") {
        matchStatus = alocacoesFiltradas.some(a => a.prestadorId === p.id && normalizarStatusParaUI(a.status) === filtroStatus && diasPeriodo.some(d => isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), d)));
      }

      return matchNome && matchVeiculo && matchCliente && matchStatus;
    });
  }, [prestadores, filtroNome, filtroVeiculo, filtroCliente, filtroStatus, alocacoesFiltradas, diasPeriodo]);

  const listaControleDiario = useMemo(() => {
    return alocacoesFiltradas.filter(a => a.data && diasPeriodo.some(dp => isSameDay(dp, new Date(a.data))));
  }, [alocacoesFiltradas, diasPeriodo]);



  const nextPeriodo = () => {
    if (filtroPeriodo === 'esta_semana' || filtroPeriodo === 'proxima_semana') setCurrentDate(addDays(currentDate, 7));
    else if (filtroPeriodo === 'quinzenal') setCurrentDate(addDays(currentDate, 15));
    else if (filtroPeriodo === 'este_mes' || filtroPeriodo === 'proximo_mes') setCurrentDate(addDays(endOfMonth(currentDate), 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prevPeriodo = () => {
    if (filtroPeriodo === 'esta_semana' || filtroPeriodo === 'proxima_semana') setCurrentDate(addDays(currentDate, -7));
    else if (filtroPeriodo === 'quinzenal') setCurrentDate(addDays(currentDate, -15));
    else if (filtroPeriodo === 'este_mes' || filtroPeriodo === 'proximo_mes') setCurrentDate(addDays(startOfMonth(currentDate), -1));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const handleCellClick = (prestadorId: string, data: Date) => {
    setSelectedCell({prestadorId, data});
    setDataAlocacaoModal(format(data, 'yyyy-MM-dd'));
    
    // Encontrar se já existe alocação para preencher os campos
    const existing = alocacoes.find(a => a.prestadorId === prestadorId && isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), data));
    setTemposReais(null);
    if (existing) {
      // A31-H — tempos REAIS derivados dos eventos do App (fonte única eventos_oficiais)
      if (existing.id && typeof existing.id === 'string' && existing.id.includes('-')) {
        buscarTemposReaisAlocacao(existing.id).then((t) => { if (t) setTemposReais(t); });
      }
      setNovoPrestadorId(existing.prestadorId);
      setNovoPrestadorNome(existing.prestadorNome || "");
      setNovoClienteId(existing.clienteId || "");
      setNovoClienteNome(existing.clienteNome || "");
      // ESCALA-E2E-08D — espelha o veículo no estado para que a resolução reativa da
      // tabela também funcione na reabertura/edição (troca de cliente recalculando).
      if (existing.prestadorVeiculo) setPrestadorVeiculo(existing.prestadorVeiculo as any);
      setNovoTurno(existing.turno || "integral");
      setNovoTipo(existing.tipo || "reserva");
      setNovaOS(existing.osNumero || existing.os || "");
      setNovaOSId(existing.osId || existing.metadata?.ordem_servico_id || "");
      setNumeroOC(existing.metadata?.numeroOC || "");
      setHorarioInicio(existing.horarioInicio || "08:00");
      setHorarioFim(existing.horarioFim || "18:00");
      // A31-J1.12 — reabertura sob o contrato oficial: campo Cliente carrega
      // valor_desconto (como ajuste negativo); campo Prestador carrega
      // valor_desconto_prestador (fallback legado para valor_desconto).
      const descReconstruido = reconstruirDescontosEscala(existing.descontoCliente ?? 0, existing.descontoPrestador ?? 0);
      setFinanceiro((prev) => {
        const base = {
          ...(existing.financeiro || prev),
          desconto: descReconstruido.descontoPrestador,
        };
        // ESCALA-PRESTADOR-02: alocações antigas gravadas como "percentual" com 0%
        // nunca tiveram override real — reabrem no modo padrão "Cadastro do prestador".
        if (!base.valorTipo || (base.valorTipo === 'percentual' && !(Number(base.valorPercentual) > 0))) {
          base.valorTipo = 'cadastro';
        }
        return base;
      });
      setAjusteClienteValor(descReconstruido.ajusteCliente);
      setAjusteClienteMotivo(existing.metadata?.faturamento?.motivo_ajuste || "");
      if (existing.kmInicial !== undefined) setKmInicial(existing.kmInicial);
      else setKmInicial(0);
      if (existing.kmFinal !== undefined) setKmFinal(existing.kmFinal);
      else setKmFinal(0);
      if (existing.tempoChegadaPatio !== undefined) setTempoChegadaPatio(existing.tempoChegadaPatio);
      else setTempoChegadaPatio("07:45");
      if (existing.tempoInicioCarregamento !== undefined) setTempoInicioCarregamento(existing.tempoInicioCarregamento);
      else setTempoInicioCarregamento("08:15");
      if (existing.tempoFimCarregamento !== undefined) setTempoFimCarregamento(existing.tempoFimCarregamento);
      else setTempoFimCarregamento("09:00");
      if (existing.tempoSaidaRua !== undefined) setTempoSaidaRua(existing.tempoSaidaRua);
      else setTempoSaidaRua("09:15");
      setTempoFinalizacaoEntregas(existing.tempoFinalizacaoEntregas || "17:30");
      
      setStatusOperacional(existing.metadata?.statusOperacional || "planejado");
      setObservacaoOperacional(existing.metadata?.observacaoOperacional || "");
      setInstrucoesPrestador(existing.metadata?.instrucoesPrestador || "");
      setObservacaoCliente(existing.metadata?.observacaoCliente || "");
      setNovaOrigem(existing.origem || "");
      setNovoDestino(existing.destino || "");
      
      // Carregar dados de Coleta Reversa
      if (hasReversaData(existing as any)) {
        setShowReversa(true);
        setReversaFields(dbToReversaFields(existing as any));
      } else {
        setShowReversa(false);
        setReversaFields(emptyReversaFields());
      }

      if (existing.clienteId && existing.prestadorVeiculo?.tipo_veiculo) {
        buscarTabelaValoresCliente(existing.clienteId, existing.clienteNome || "", existing.prestadorVeiculo.tipo_veiculo, existing.data, (existing.prestadorVeiculo as any)?.condicao_termica);
      }
    } else {
      // Reset reversa
      setShowReversa(false);
      setReversaFields(emptyReversaFields());
      // Resetar para valores padrão
      setNovoPrestadorId(prestadorId);
      const prest = prestadores.find(p => p.id === prestadorId);
      setNovoPrestadorNome(prest?.nome || "");
      setNovoClienteId("");
      setNovoClienteNome("");
      setNovoTurno("integral");
      setNovoTipo("reserva");
      setNovaOS("");
      setNovaOSId("");
      const dtStr = format(data, 'yyyyMMdd');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      setNumeroOC(`OC-${dtStr}-${randomSuffix}`);
      setHorarioInicio("08:00");
      setHorarioFim("18:00");
      setKmExcedentePrestador(0);
      setMinutosEspera(0);
      
      setFinanceiro({
        valorTipo: 'percentual',
        valorPercentual: 0,
        valorFixo: 0,
        combustivel: 0,
        kmRodados: 0,
        valorKm: 0,
        pedagio: 0,
        pedagioFranquia: 100,
        pedagioExcedente: 0,
        pedagioCobrarExcedente: false,
        diariasAdicionais: 0,
        valorDiaria: 0,
        segundaSaida: false,
        valorSegundaSaida: 0,
        terceiraSaida: false,
        valorTerceiraSaida: 0,
        saidasAdicionais: 0,
        valorSaidaAdicional: 0,
        ajudantes: 0,
        valorAjudante: 0,
        desconto: 0,
        reembolsosOutros: '',
        valorReembolsoOutros: 0
      });
      setKmInicial(0);
      setKmFinal(0);
      setTempoChegadaPatio("07:45");
      setTempoInicioCarregamento("08:15");
      setTempoFimCarregamento("09:00");
      setTempoSaidaRua("09:15");
      setTempoFinalizacaoEntregas("17:30");
      setTabelaValores(null);
      setTabelaRascunhoEncontrada(null);
      setRegraEspecialAtiva(false);
      setAjusteClienteValor(0);
      setAjusteClienteMotivo("");
      setKmExcedentePrestador(0);
      setMinutosEspera(0);
      setStatusOperacional("planejado");
      setObservacaoOperacional("");
      setInstrucoesPrestador("");
      setObservacaoCliente("");
      setNovaOrigem("");
      setNovoDestino("");
      
      buscarDadosVeiculoPrestador(prestadorId);
    }
    setModalOpen(true);
  };

  /**
   * Calcula totais da alocação usando o engine de precificação para o core
   * (preço cliente + prestador base) + adicionais operacionais da escala.
   */
  const calcularTotalAlocacao = (tabelaOverride?: any) => {
    const tabelaBase = tabelaOverride ?? tabelaValores;
    const prestadorSelecionado = prestadores.find(p => p.id === novoPrestadorId);
    const kmRodados = Math.max((kmFinal || 0) - (kmInicial || 0), 0);

    // Usa o engine de precificação para calcular valores base
    const engineResult = calcularPrecoRapido(
      {
        id: tabelaBase?.id || "",
        nome: tabelaBase?.nome || "Tabela",
        fonte: tabelaBase?.universal ? "universal" : (tabelaBase?.id ? "tabelas_valores" : "fallback_hardcoded"),
        valor_base: Number(tabelaBase?.valor_base) || 0,
        franquia_km: resolverFranquiaEfetiva(tabelaBase?.franquia_km, tabelaBase?.km_franquia),
        valor_km_excedente: resolverTarifaKmExcedente(tabelaBase?.valor_km_excedente, tabelaBase?.valor_km),
        percentual_prestador: Number(tabelaBase?.percentual_prestador ?? 80),
      },
      kmRodados
    );

    // Regra especial DVL (hora de saída) — aplica multiplicador no valor base
    const horaSaida = tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8;
    let multDVL = 1.0;
    if (regraEspecialAtiva && novoClienteId) {
      if (horaSaida <= 11) multDVL = 1.0;
      else if (horaSaida <= 14) multDVL = 1.50;
      else if (horaSaida <= 16) multDVL = 1.70;
      else multDVL = 1.85;
    }
    const valorBaseCliente = engineResult.valorCliente * multDVL;
    const ajusteManual = Number(ajusteClienteValor) || 0;
    const totalCliente = valorBaseCliente + ajusteManual;

    // Adicionais do prestador
    const adicCombustivel = Number(financeiro.combustivel) || 0;
    const adicPedagio = Number(financeiro.pedagio) || 0;
    const adicDiariasAdic = (Number(financeiro.diariasAdicionais) || 0) * (Number(financeiro.valorDiaria) || 0);
    const adicSegundaSaida = financeiro.segundaSaida ? (Number(financeiro.valorSegundaSaida) || 0) : 0;
    const adicTerceiraSaida = financeiro.terceiraSaida ? (Number(financeiro.valorTerceiraSaida) || 0) : 0;
    const adicSaidasAdic = (Number(financeiro.saidasAdicionais) || 0) * (Number(financeiro.valorSaidaAdicional) || 0);
    const adicAjudante = (Number(financeiro.ajudantes) || 0) * (Number(financeiro.valorAjudante) || 0);
    const adicReembolso = Number(financeiro.valorReembolsoOutros) || 0;
    const kmExcPrestValor = Number(kmExcedentePrestador) || 0;
    const totalAdicionaisPrest = adicCombustivel + adicPedagio + adicDiariasAdic + adicSegundaSaida + adicTerceiraSaida + adicSaidasAdic + adicAjudante + adicReembolso + kmExcPrestValor;
    const totalDescontosPrest = Number(financeiro.desconto) || 0;

    // ESCALA-PRESTADOR-02 — repasse dual canônico.
    // Padrão "cadastro": base = valor_diaria ?? valor_saida do prestador (sem usar % da tabela cliente).
    // "percentual": base = valor da tabela cliente × percentual informado pelo operador.
    // "fixo": base = valor fixo informado.
    const repasse = resolverRepassePrestadorBase({
      modo: financeiro.valorTipo,
      valorDiaria: prestadorSelecionado?.financeiro_real?.valor_diaria,
      valorSaida: prestadorSelecionado?.financeiro_real?.valor_saida,
      valorFixo: financeiro.valorFixo,
      percentual: financeiro.valorPercentual,
      valorBaseCliente: totalCliente,
    });
    let valorBasePrest = repasse.base;
    const totalPrestador = valorBasePrest + totalAdicionaisPrest - totalDescontosPrest;
    const margemValor = totalCliente - totalPrestador;
    const margemPerc = totalCliente > 0 ? (margemValor / totalCliente) * 100 : 0;

    return {
      valorBase: valorBasePrest,
      totalAdicionais: totalAdicionaisPrest,
      totalDescontos: totalDescontosPrest,
      total: totalPrestador,
      cliente: {
        valorBase: valorBaseCliente,
        valorBaseOriginal: engineResult.valorCliente,
        adicionais: ajusteManual,
        total: totalCliente,
        overbookingAtivo: false,
        overbookingPercentualCliente: 0,
        overbookingValorCliente: 0,
        detalhes: {
          km: { rodados: kmRodados, franquia: resolverFranquiaEfetiva(tabelaBase?.franquia_km, tabelaBase?.km_franquia), excedente: engineResult.kmExcedente, valorKm: resolverTarifaKmExcedente(tabelaBase?.valor_km_excedente, tabelaBase?.valor_km), totalExcedente: engineResult.kmExcedente * resolverTarifaKmExcedente(tabelaBase?.valor_km_excedente, tabelaBase?.valor_km) },
          espera: { minutos: Number(minutosEspera) || 0, tolerancia: 60, excedente: Math.max(0, (Number(minutosEspera) || 0) - 60), valorHora: 0, totalExcedente: 0 },
          ajusteManual,
          pedagioCobrado: 0,
          reentrega: 0,
          agendamento: 0,
          overbooking: 0,
          overbookingDetalhe: { ativo: false, valorBaseOriginal: 0, percentual: 0, valor: 0 },
          segundaSaida: adicSegundaSaida,
          terceiraSaida: adicTerceiraSaida,
        },
      },
      prestador: {
        valorBase: valorBasePrest,
        valorBaseOriginal: engineResult.valorPrestador,
        adicionais: totalAdicionaisPrest,
        descontos: totalDescontosPrest,
        total: totalPrestador,
        overbookingAtivo: false,
        overbookingPercentualPrestador: 0,
        overbookingValorPrestador: 0,
        detalhes: {
          km: { excedente: engineResult.kmExcedente, valorKm: kmExcPrestValor > 0 ? kmExcPrestValor : Number(tabelaBase?.valor_km || 0), totalExcedente: kmExcPrestValor },
          espera: 0,
          ajudante: adicAjudante,
          pedagio: adicPedagio,
          combustivel: adicCombustivel,
          segundaSaida: adicSegundaSaida,
          terceiraSaida: adicTerceiraSaida,
          saidasAdicionais: adicSaidasAdic,
          diariasAdicionais: adicDiariasAdic,
          outrosReembolsos: adicReembolso,
          overbooking: 0,
          overbookingDetalhe: { ativo: false, valorBaseOriginal: 0, percentual: 0, valor: 0 },
        },
      },
      margem: {
        valor: margemValor,
        percentual: margemPerc,
      },
    };
  };

  const handleCancelarAlocacao = async () => {
    if (!cancelTarget) return;
    setIsCanceling(true);
    try {
      const resultado = await cancelarAlocacao(cancelTarget.id, 'Cancelado via Programação Operacional');
      
      if (!resultado.sucesso) {
        throw new Error(resultado.erro || 'Falha ao cancelar alocação');
      }
      
      toast.success("Alocação cancelada com sucesso!");
      
      setAlocacoes(prev => prev.map(a => 
        a.id === cancelTarget.id 
          ? { ...a, status: 'cancelada', statusPagamento: 'cancelado' } 
          : a
      ));
      
      setCancelTarget(null);
      loadAlocacoes();
    } catch (error) {
      console.error("Erro ao cancelar:", error);
      toast.error(`Erro ao cancelar: ${(error as Error).message || 'Falha na comunicação'}`);
    } finally {
      setIsCanceling(false);
    }
  };

  const handleCreateReserva = async () => {
    if (!novoPrestadorId) {
      return toast.error("Selecione um prestador obrigatório.");
    }
    
    // Bloquear salvar se prestador não tem veículo vinculado
    if (prestadorVeiculo && !prestadorVeiculo.tipo_veiculo) {
      return toast.error("Este prestador não possui veículo vinculado. Vincule um veículo antes de salvar.");
    }

    // Bloquear salvar se prestador tem mais de um veículo (escolha ambígua)
    if (novoPrestadorId) {
      const { data } = await supabase
        .from("veiculos")
        .select("id")
        .eq("prestador_vinculado", novoPrestadorId);
      if (data && data.length > 1) {
        return toast.error("Prestador possui mais de um veículo. Selecione o veículo da operação.");
      }
    }
    
    if (!dataAlocacaoModal) {
      return toast.error("Informe a data da alocação.");
    }
    
    // ESCALA-E2E-08D — FAIL-SAFE: se há cliente + veículo válido e a tabela está NULL no
    // estado, reconsulta UMA vez antes de bloquear. Usa o resultado REAL (sem ajuste
    // automático, sem tabela fake, sem fallback de valor zero).
    let tabelaEfetiva = tabelaValores;
    if (novoClienteId && prestadorVeiculo?.tipo_veiculo && !tabelaValores) {
      const tabelaReconsultada = await buscarTabelaValoresCliente(
        novoClienteId,
        novoClienteNome,
        prestadorVeiculo.tipo_veiculo,
        dataAlocacaoModal,
        prestadorVeiculo.condicao_termica
      );
      if (tabelaReconsultada) tabelaEfetiva = tabelaReconsultada;
    }

    if (novoClienteId && !tabelaEfetiva && !ajusteClienteMotivo && ajusteClienteValor === 0) {
      return toast.error("Sem tabela de preço. Informe o 'Ajuste Manual' e o 'Motivo' para faturar.");
    }
    
    if (ajusteClienteValor !== 0 && !ajusteClienteMotivo) {
      return toast.error("Por favor, preencha o Motivo do Ajuste do Cliente.");
    }

    const totals = calcularTotalAlocacao(tabelaEfetiva);
    const dataObj = new Date(dataAlocacaoModal + 'T12:00:00');

    // Verificar conflito de prestador e veículo antes de prosseguir
    const reservaDiaExistente = alocacoes.find(a => {
      const _s = (a.status || '').toLowerCase();
      if (_s === 'cancelada' || _s === 'cancelado') return false;
      if (a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), dataObj)) return true;
      if (prestadorVeiculo?.placa && a.prestadorVeiculo?.placa === prestadorVeiculo.placa && isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), dataObj)) return true;
      return false;
    });
    const existing = reservaDiaExistente?.prestadorId === novoPrestadorId ? reservaDiaExistente : undefined;
    const prestadorSelecionado = prestadores.find(p => p.id === novoPrestadorId);
    
    let financeiroStatus = 'ok';
    if (!tabelaEfetiva) financeiroStatus = 'pendente';
    else if (!prestadorSelecionado?.financeiro_real || prestadorSelecionado.financeiro_real.valor_diaria === 0) financeiroStatus = 'fallback';
    if (!tabelaEfetiva && ajusteClienteValor > 0) financeiroStatus = 'manual';

    console.log("[PROVA-DATA] input modal:", dataAlocacaoModal);
    console.log("[PROVA-DATA] payload data_escala:", dataAlocacaoModal);
    console.log("[ESCALA-SAVE-DATA] data escolhida:", dataAlocacaoModal);
    console.log("[ESCALA-SAVE-DATA] data enviada ao Supabase:", dataAlocacaoModal);

    // --- Objeto para o estado local (camelCase) ---
    const novaAlocacao = {
      id: existing?.id || String(Date.now()),
      prestadorId: novoPrestadorId,
      prestadorNome: novoPrestadorNome,
      clienteId: novoClienteId,
      clienteNome: novoClienteNome,
      data: dataAlocacaoModal + 'T12:00:00',
      turno: novoTurno,
      tipo: novoTipo,
      os: novaOS,
      horarioInicio,
      horarioFim,
      financeiro,
      totals,
      valorCliente: 0, // Pode ser preenchido depois via financeiro
      prestadorVeiculo,
      statusPagamento: 'pendente',
      status: 'aguardando_aceite',
      kmInicial,
      kmFinal,
      origem: novaOrigem,
      destino: novoDestino,
      tempoChegadaPatio,
      tempoInicioCarregamento,
      tempoFimCarregamento,
      tempoSaidaRua,
      tempoFinalizacaoEntregas,
      metadata: { kmInicial, kmFinal, numeroOC, financeiro_status: financeiroStatus, statusOperacional, observacaoOperacional, instrucoesPrestador, observacaoCliente, financeiro, totals, os: novaOS, turno: novoTurno, horarioInicio, horarioFim, tempoChegadaPatio, tempoInicioCarregamento, tempoFimCarregamento, tempoSaidaRua, tempoFinalizacaoEntregas, origem_tms: true, precisa_aceite_app: true, tipo_operacao: 'escala' }
    };

    // --- Payload para o banco (snake_case conforme schema alocacoes_escala) ---
    // ESCALA-OS-01: a OS interna NÃO é mais obrigatória na UI. Se nenhuma OS foi
    // selecionada, criarAlocacao() gera/vincula automaticamente a OS interna (uma única
    // OS por alocação). O Romaneio/OC do cliente é referência EXTERNA (metadata).
    const payload = {
      ordem_servico_id: novaOSId || null,
      prestador_id: novoPrestadorId || null,
      cliente_id: novoClienteId || null,
      data_escala: dataAlocacaoModal,
      turno: novoTurno,
      tipo_veiculo: prestadorVeiculo?.tipo_veiculo || null,
      placa: prestadorVeiculo?.placa || null,
      status: 'aguardando_aceite',
      status_pagamento: 'pendente',
      observacoes: novaOS ? `OS: ${novaOS}` : null,
      origem: novaOrigem || null,
      destino: novoDestino || null,
      // Financeiro
      valor_fixo: totals.prestador.valorBase,
      valor_repasse: totals.prestador.valorBase,
      valor_pedagio: financeiro.pedagio || 0,
      valor_combustivel: financeiro.combustivel || 0,
      valor_ajudante: (financeiro.ajudantes || 0) * (financeiro.valorAjudante || 0),
      valor_adicional: totals.prestador.adicionais,
      // A31-J1.12 — contrato oficial: desconto cliente em valor_desconto; desconto
      // prestador em valor_desconto_prestador (ajuste cliente negativo = desconto cliente).
      ...(() => {
        const d = dividirDescontosEscala(ajusteClienteValor, totals.prestador.descontos, totals.cliente.valorBase);
        return { valor_frete: d.valorFrete, valor_desconto: d.valorDescontoCliente, valor_desconto_prestador: d.valorDescontoPrestador };
      })(),
      km_realizados: Math.max((kmFinal || 0) - (kmInicial || 0), 0),
      // Coleta Reversa
      ...(showReversa ? {
        tipo_reversa: reversaFields.tipo_reversa,
        reversa_qtd_volumes: reversaFields.reversa_qtd_volumes,
        reversa_observacoes: reversaFields.reversa_observacoes,
        reversa_valor_cliente: reversaFields.reversa_impacto_cliente || (() => {
          if (reversaFields.reversa_modelo_cliente === "valor_fixo") return reversaFields.reversa_valor_fixo_cliente;
          const q = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada : reversaFields.reversa_qtd_volumes;
          return q * reversaFields.reversa_valor_unitario_cliente;
        })(),
        reversa_valor_prestador: reversaFields.reversa_impacto_prestador || (() => {
          if (reversaFields.reversa_modelo_prestador === "valor_fixo") return reversaFields.reversa_valor_fixo_prestador;
          const q = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada : reversaFields.reversa_qtd_volumes;
          return q * reversaFields.reversa_valor_unitario_prestador;
        })(),
        reversa_status: reversaFields.reversa_status,
        reversa_endereco_coleta: reversaFields.reversa_endereco_coleta,
        reversa_endereco_devolucao: reversaFields.reversa_endereco_devolucao,
        reversa_unidade_cobranca: reversaFields.reversa_unidade_cobranca,
        reversa_valor_unitario: reversaFields.reversa_valor_unitario,
        reversa_qtd_coletada: reversaFields.reversa_qtd_coletada,
        reversa_divergencia: reversaFields.reversa_divergencia,
        reversa_motivo_divergencia: reversaFields.reversa_motivo_divergencia,
        reversa_responsavel: reversaFields.reversa_responsavel,
        reversa_documento_responsavel: reversaFields.reversa_documento_responsavel,
        reversa_telefone: reversaFields.reversa_telefone,
        reversa_data_prevista: reversaFields.reversa_data_prevista,
        reversa_data_realizada: reversaFields.reversa_data_realizada,
        reversa_valor_adicional: reversaFields.reversa_valor_adicional,
        // Modelos independentes
        reversa_modelo_cliente: reversaFields.reversa_modelo_cliente,
        reversa_valor_unitario_cliente: reversaFields.reversa_valor_unitario_cliente,
        reversa_valor_fixo_cliente: reversaFields.reversa_valor_fixo_cliente,
        reversa_modelo_prestador: reversaFields.reversa_modelo_prestador,
        reversa_valor_unitario_prestador: reversaFields.reversa_valor_unitario_prestador,
        reversa_valor_fixo_prestador: reversaFields.reversa_valor_fixo_prestador,
        // Mídia da reversa
        reversa_fotos: reversaFields.reversa_fotos.length > 0 ? reversaFields.reversa_fotos : null,
        reversa_assinatura_url: reversaFields.reversa_assinatura_url || null,
        reversa_latitude: reversaFields.reversa_latitude || null,
        reversa_longitude: reversaFields.reversa_longitude || null,
      } : {}),
      // Metadados extras
      metadata: {
        kmInicial,
        kmFinal,
        numeroOC,
        financeiro_status: financeiroStatus,
        statusOperacional,
        observacaoOperacional,
        instrucoesPrestador,
        observacaoCliente,
        financeiro: financeiro,
        totals: totals,
        os: novaOS,
        turno: novoTurno,
        horarioInicio,
        horarioFim,
        tempoChegadaPatio,
        tempoInicioCarregamento,
        tempoFimCarregamento,
        tempoSaidaRua,
        tempoFinalizacaoEntregas,
        faturamento: {
          tabela_id: tabelaEfetiva?.id || null,
          nome_tabela: tabelaEfetiva?.nome || 'Sem Tabela',
          franquia_km: resolverFranquiaEfetiva(tabelaEfetiva?.franquia_km, tabelaEfetiva?.km_franquia),
          valor_km_excedente: resolverTarifaKmExcedente(tabelaEfetiva?.valor_km_excedente, tabelaEfetiva?.valor_km),
          ajuste_manual: ajusteClienteValor,
          motivo_ajuste: ajusteClienteMotivo
        },
        repasse: {
          origem: financeiro.valorTipo,
          tipo_repasse: financeiro.valorTipo,
          percentual: financeiro.valorTipo === 'percentual' ? Number(financeiro.valorPercentual) : null,
          valor_base_prestador: totals.prestador.valorBase,
          valor_final: totals.prestador.total,
          valor_km_prestador: kmExcedentePrestador,
          valor_fixo: financeiro.valorTipo === 'fixo' ? Number(financeiro.valorFixo) : null
        },
        km: {
          inicial: kmInicial,
          final: kmFinal,
          rodados: Math.max((kmFinal || 0) - (kmInicial || 0), 0)
        },
        espera: {
          minutos_espera: minutosEspera
        },
        origem_tms: true,
        precisa_aceite_app: true,
        tipo_operacao: 'escala',
        ordem_servico_id: novaOSId || null
      }
    };

    console.log("[DEBUG] Salvando alocacao no banco...", {
      payload, 
      id_existente: existing?.id, 
      data_original: selectedCell?.data,
      data_salva: payload.data_escala,
      prestador_id: payload.prestador_id,
      cliente_id: payload.cliente_id,
      valor_frete: payload.valor_frete,
      valor_repasse: payload.valor_repasse,
      km_realizados: payload.km_realizados
    });

    try {
      setIsSaving(true);

      if (existing?.id && typeof existing.id === 'string' && existing.id.includes('-')) {
        // UPDATE
        const updatePayload = { ...payload };
        if (updatePayload.status) {
          updatePayload.status = normalizarStatusParaBanco(updatePayload.status);
        }
        const resultado = await atualizarAlocacao(existing.id, updatePayload as any);
        if (!resultado.sucesso) {
          toast.error(`Erro ao atualizar alocação: ${resultado.erro || 'Falha na comunicação'}`);
          console.error('[Escala] Erro ao atualizar:', resultado.erro);
          return; // NÃO fechar modal
        }
        toast.success("Alocação atualizada com sucesso!");
      } else {
        // CREATE
        const resultado = await criarAlocacao(payload as any);
        if (!resultado.sucesso) {
          toast.error(`Erro ao criar alocação: ${resultado.erro || 'Falha na comunicação'}`);
          console.error('[Escala] Erro ao criar:', resultado.erro);
          return; // NÃO fechar modal
        }
        toast.success("Alocação criada com sucesso!");
      }

      // Sucesso confirmado — fechar modal e refetch
      setModalOpen(false);
      loadAlocacoes();
    } catch (err: any) {
      toast.error(`Erro ao salvar alocação: ${err?.message || 'Falha na comunicação'}`);
      console.error('[Escala] Erro ao salvar:', err?.message);
      // NÃO fechar modal — preservar dados digitados
    } finally {
      setIsSaving(false);
    }
  };

  const handleGerarEscalaAutomatica = () => {
     if (prestadoresFiltrados.length === 0) return toast.error("Sem prestadores para alocar.");
     const novas = [...alocacoes];
     
     // Loop simplificado para gerar escala mockada que parece real
     diasPeriodo.forEach(d => {
       // Não alocar domingos por padrão
       if (d.getDay() === 0) return;
       
       // Alocar 30% da frota aleatoriamente
       prestadoresFiltrados.forEach(p => {
          if (Math.random() > 0.7) {
             const exist = novas.find(a => a.prestadorId === p.id && isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), d));
             if (!exist) {
               novas.push({
                 id: Math.random(),
                 prestadorId: p.id,
                 data: d.toISOString(),
                 turno: "integral",
                 tipo: "reserva",
                 os: "",
                 status: "confirmado",
                 statusPagamento: "a pagar",
                 totals: { total: 500 }
               });
             }
          }
        });
     });

     setAlocacoes(novas);
     localStorage.setItem("conexao_escala_operacional", JSON.stringify(novas));
     toast.success("Programação gerada automaticamente com IA!");
  };

  const handleGerarRelatorioPagamento = async (aloc: any) => {
    try {
      const finStatus = aloc.metadata?.financeiro_status;
      if (finStatus && finStatus !== 'ok') {
        return toast.error(`Atenção: A alocação possui status financeiro '${finStatus.toUpperCase()}'. Regularize a composição financeira antes de gerar o demonstrativo.`);
      }

      const rawId = aloc.id.toString();
      const shortId = `ESC-${rawId.replace(/-/g, '').substring(rawId.length > 8 ? rawId.length - 8 : 0, rawId.length).replace(/-/g, '').toUpperCase().substring(0, 8)}`;
      const doc = new jsPDF("portrait", "mm", "a4");
      const page = getPageSetup(doc, 15);

      const prestador = aloc.metadata?.totals?.prestador || {};
      const financeiro = aloc.metadata?.financeiroPrestador || {};

      const vBase = Number(prestador.valorBase) || 0;
      const vKmAdicional = Number(prestador.detalhes?.km?.totalExcedente) || 0;
      const vEspera = Number(prestador.detalhes?.espera?.totalExcedente || financeiro.espera) || 0;
      const vPedagio = Number(financeiro.pedagio) || 0;
      const vReembolso = Number(financeiro.valorReembolsoOutros) || 0;
      const vAjudante = (Number(financeiro.ajudantes) || 0) * (Number(financeiro.valorAjudante) || 0);
      const vCombustivel = Number(financeiro.combustivel) || 0;
      const vDescontos = Number(prestador.descontos) || 0;
      const vAdiantamento = Number(financeiro.adiantamento) || 0;

      const totaisAdicionais = vKmAdicional + vEspera + vPedagio + vReembolso + vAjudante + vCombustivel;
      const vLiquido = vBase + totaisAdicionais - vDescontos - vAdiantamento;

      const logo = await drawCoverPage(doc, {
        documentType: "DEMONSTRATIVO DE PAGAMENTO",
        documentNumber: shortId,
        entityName: aloc.prestadorNome || "Prestador Não Informado",
        entitySubtitle: "Prestador autônomo / agregado — prestação de serviços",
        date: format(new Date(), "dd/MM/yyyy HH:mm"),
        via: "Prestador"
      });

      let y = 85;
      const infoFields = [
        { label: "Data da Operação", value: format(new Date(aloc.data), "dd/MM/yyyy") },
        { label: "OS / Referência", value: shortId },
        { label: "Placa do Veículo", value: aloc.prestadorVeiculo?.placa || "N/D" },
        { label: "Tipo de Veículo", value: aloc.prestadorVeiculo?.tipo_veiculo ? String(aloc.prestadorVeiculo.tipo_veiculo).toUpperCase() : "N/D", col: "right" as const },
        { label: "Operação / Cliente", value: aloc.clienteNome || "N/D", col: "right" as const },
        { label: "Origem → Destino", value: aloc.regiao || "Não informada", col: "right" as const },
      ];
      y = drawInfoBlock(doc, page.margin, y, page.contentWidth, "DADOS DA OPERAÇÃO", infoFields);

      const financeLines: { label: string; value: number; indent?: boolean; isTotal?: boolean; highlight?: boolean }[] = [
        { label: "Valor Base / Diária", value: vBase }
      ];
      if (vKmAdicional > 0) financeLines.push({ label: "KM Adicional", value: vKmAdicional, indent: true });
      if (vEspera > 0) financeLines.push({ label: "Espera / Aguarde", value: vEspera, indent: true });
      if (vPedagio > 0) financeLines.push({ label: "Pedágio", value: vPedagio, indent: true });
      if (vReembolso > 0) financeLines.push({ label: "Reembolso", value: vReembolso, indent: true });
      if (vAjudante > 0) financeLines.push({ label: "Ajudante", value: vAjudante, indent: true });
      if (vCombustivel > 0) financeLines.push({ label: "Posto / Convênio Combustível", value: vCombustivel, indent: true });
      if (vAdiantamento > 0) financeLines.push({ label: "( - ) Adiantamentos", value: -vAdiantamento, indent: true });
      if (vDescontos > 0) financeLines.push({ label: "( - ) Descontos", value: -vDescontos, indent: true });
      financeLines.push({ label: "VALOR LÍQUIDO A RECEBER", value: vLiquido, isTotal: true, highlight: true });

      y = drawFinancialComposition(doc, page.margin, y, page.contentWidth, "COMPOSIÇÃO DO PAGAMENTO", financeLines);

      drawObservations(
        doc, page.margin, y + 10, page.contentWidth,
        `Demonstrativo destinado exclusivamente ao Prestador de Serviço. Confira os valores e comunique divergências em até 48h úteis ao financeiro. CNPJ: 31.227.975/0001-80 — Tel: (11) 4225-1600 — financeiro@conexaoexpress.com.br`
      );

      doc.save(`demonstrativo-${(aloc.prestadorNome || 'prestador').toLowerCase().replace(/\s+/g, '-')}-${shortId}.pdf`);
      toast.success("Demonstrativo de pagamento gerado com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar demonstrativo de pagamento.");
    }
  };

  const handleShareWhatsApp = (aloc: any) => {
    const finStatus = aloc.metadata?.financeiro_status;
    if (finStatus && finStatus !== 'ok') {
      return toast.error(`Atenção: A alocação possui status financeiro '${finStatus.toUpperCase()}'. Regularize antes de enviar ao prestador.`);
    }

    const rawId = aloc.id.toString();
    const shortId = `ESC-${rawId.replace(/-/g, '').substring(rawId.length > 8 ? rawId.length - 8 : 0, rawId.length).replace(/-/g, '').toUpperCase().substring(0, 8)}`;
    const prestador = aloc.metadata?.totals?.prestador || {};
    const financeiro = aloc.metadata?.financeiroPrestador || {};

    const vBase = Number(prestador.valorBase) || 0;
    const vKmAdicional = Number(prestador.detalhes?.km?.totalExcedente) || 0;
    const vEspera = Number(prestador.detalhes?.espera?.totalExcedente || financeiro.espera) || 0;
    const vPedagio = Number(financeiro.pedagio) || 0;
    const vReembolso = Number(financeiro.valorReembolsoOutros) || 0;
    const vAjudante = (Number(financeiro.ajudantes) || 0) * (Number(financeiro.valorAjudante) || 0);
    const vCombustivel = Number(financeiro.combustivel) || 0;
    const vDescontos = Number(prestador.descontos) || 0;
    const vAdiantamento = Number(financeiro.adiantamento) || 0;

    const totaisAdicionais = vKmAdicional + vEspera + vPedagio + vReembolso + vAjudante + vCombustivel;
    const vLiquido = vBase + totaisAdicionais - vDescontos - vAdiantamento;

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dataFmt = format(new Date(aloc.data), "dd/MM/yyyy");

    let msg = `*CONEXÃO EXPRESS*\n`;
    msg += `*Demonstrativo Operacional*\n\n`;
    msg += `*Prestador:* ${aloc.prestadorNome || 'Não informado'}\n`;
    msg += `*OS / Ref.:* ${shortId}\n`;
    msg += `*Data:* ${dataFmt}\n`;
    if (aloc.regiao) msg += `*Rota:* ${aloc.regiao}\n`;
    if (aloc.prestadorVeiculo?.placa) msg += `*Veículo:* ${aloc.prestadorVeiculo.placa}\n\n`;

    msg += `*VALORES*\n`;
    msg += `Valor Base: ${fmt(vBase)}\n`;
    if (vKmAdicional > 0) msg += `KM Adicional: ${fmt(vKmAdicional)}\n`;
    if (vEspera > 0) msg += `Espera: ${fmt(vEspera)}\n`;
    if (vPedagio > 0) msg += `Pedágio: ${fmt(vPedagio)}\n`;
    if (vReembolso > 0) msg += `Reembolso: ${fmt(vReembolso)}\n\n`;

    const subtotal = vBase + vKmAdicional + vEspera + vPedagio + vReembolso;
    msg += `*Subtotal:* ${fmt(subtotal)}\n\n`;

    if (vCombustivel > 0 || vAdiantamento > 0 || vDescontos > 0) {
      msg += `*DESCONTOS*\n`;
      if (vCombustivel > 0) msg += `Convênio Combustível: ${fmt(vCombustivel)}\n`;
      if (vAdiantamento > 0) msg += `Adiantamentos: ${fmt(vAdiantamento)}\n`;
      if (vDescontos > 0) msg += `Descontos Diversos: ${fmt(vDescontos)}\n\n`;
    }

    msg += `*TOTAL LÍQUIDO A RECEBER*\n`;
    msg += `${fmt(vLiquido)}\n\n`;
    msg += `_Em caso de divergência retornar em até 48 horas._`;

    const encoded = encodeURIComponent(msg);
    const telClean = aloc.prestadorTelefone ? aloc.prestadorTelefone.replace(/\D/g, '') : '';

    if (telClean) {
      window.open(`https://wa.me/55${telClean}?text=${encoded}`, '_blank');
    } else {
      navigator.clipboard.writeText(msg);
      toast.success("Texto copiado! Prestador sem telefone cadastrado.");
    }
  };

  const handleExportPDF = () => {
    try {
      const fmtBRL = (v: any) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const alocacoesPeriodo = alocacoesFiltradas.filter(a => {
        const d = new Date(a.data);
        return d >= diasPeriodo[0] && d <= diasPeriodo[diasPeriodo.length - 1];
      });

      if (alocacoesPeriodo.length === 0) {
        toast.info('Nenhuma alocação no período para exportar.');
        return;
      }

      const extrairFaturamento = (a: any): number => {
        return Number(a.valor_frete ?? a.metadata?.totals?.cliente?.total ?? 0);
      };
      
      const extrairRepasse = (a: any): number => {
        return Number(a.valor_repasse ?? a.valor_fixo ?? a.metadata?.totals?.prestador?.total ?? a.metadata?.totals?.total ?? a.totals?.total ?? 0);
      };

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;

      // Header
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageWidth, 38, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('RELATÓRIO OPERACIONAL DE FATURAMENTO E REPASSE', margin, 18);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Período: ${format(diasPeriodo[0], 'dd/MM/yyyy')} a ${format(diasPeriodo[diasPeriodo.length - 1], 'dd/MM/yyyy')}`, margin, 28);
      doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - margin, 28, { align: 'right' });

      let y = 50;
      doc.setTextColor(50, 50, 50);

      // Cabeçalho da tabela
      const cols = ['OS/Data', 'Cliente / Prestador', 'Placa', 'Faturamento', 'Repasse', 'Margem', 'Status'];
      const colWidths = [20, 50, 15, 23, 23, 23, 20];
      let x = margin;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y - 6, pageWidth - margin * 2, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      cols.forEach((col, i) => {
        doc.text(col, x + 1, y);
        x += colWidths[i];
      });
      y += 6;

      // Linhas
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      let totalFaturamento = 0;
      let totalRepasse = 0;
      
      alocacoesPeriodo.forEach((a, idx) => {
        const prestNome = a.prestadorNome || prestadores.find((p: any) => p.id === a.prestadorId)?.nome || '-';
        const cliNome = a.clienteNome || '-';
        const placa = a.prestadorVeiculo?.placa || prestadores.find((p: any) => p.id === a.prestadorId)?.placa || '-';
        const vFat = extrairFaturamento(a);
        const vRep = extrairRepasse(a);
        const margem = vFat - vRep;
        
        totalFaturamento += vFat;
        totalRepasse += vRep;
        
        const statusTxt = a.status || '-';
        const dataStr = a.data ? format(new Date(a.data), 'dd/MM') : '-';
        const osData = `${a.os || '-'}\n${dataStr}`;
        const cliPrest = `${String(cliNome).substring(0, 25)}\n${String(prestNome).substring(0, 25)}`;
        
        const row = [osData, cliPrest, placa, fmtBRL(vFat), fmtBRL(vRep), fmtBRL(margem), statusTxt];

        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y - 4, pageWidth - margin * 2, 10, 'F');
        }
        x = margin;
        row.forEach((cell, i) => {
          const lines = cell.split('\n');
          lines.forEach((line, li) => {
             doc.text(line, x + 1, y + (li * 4));
          });
          x += colWidths[i];
        });
        y += 10;
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
      });

      // Totais
      y += 4;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`Total de Alocações: ${alocacoesPeriodo.length}`, margin, y);
      
      const totaisTxt = `Faturamento: ${fmtBRL(totalFaturamento)}  |  Repasse: ${fmtBRL(totalRepasse)}  |  Margem: ${fmtBRL(totalFaturamento - totalRepasse)}`;
      doc.text(totaisTxt, pageWidth - margin, y, { align: 'right' });

      doc.save(`relatorio-operacional-${format(diasPeriodo[0], 'dd-MM-yyyy')}.pdf`);
      toast.success('PDF do relatório operacional gerado!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao exportar PDF: ' + (err?.message || 'desconhecido'));
    }
  };

  const handleIncluirLote = () => {
    toast.success("Alocações incluidas no lote de pagamento!");
  };

  const prestadorAtivo = selectedCell ? prestadores.find(p => p.id === selectedCell.prestadorId) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-slate-50">
       {/* Unified Header & Filters */}
       <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-col gap-2 shrink-0 z-10 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
             <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
               <CalendarIcon className="w-5 h-5 text-primary"/> Programação Operacional
             </h3>
             <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleGerarEscalaAutomatica}><Truck className="w-3.5 h-3.5"/> Gerar Programação</Button>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleExportPDF}><Download className="w-3.5 h-3.5"/> Exportar PDF</Button>
                <Button size="sm" className="gap-1 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleIncluirLote}><DollarSign className="w-3.5 h-3.5"/> Incluir Lote</Button>
                <Button size="sm" className="gap-1 text-xs h-8" onClick={() => { setDataAlocacaoModal(format(new Date(), 'yyyy-MM-dd')); handleCellClick("", new Date()); setModalOpen(true); }}><Plus className="w-3.5 h-3.5"/> Alocar</Button>
             </div>
          </div>
          <div className="flex items-center flex-wrap gap-3">
             <div className="relative min-w-[220px]">
               <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400"/>
               <Input placeholder="Buscar por placa ou nome..." className="pl-9 h-9 text-xs" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} />
             </div>
             <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-9 w-[180px] text-xs"><SelectValue placeholder="Todos Clientes"/></SelectTrigger>
                <SelectContent>
                   <SelectItem value="todos">Todos Clientes</SelectItem>
                   {clientesDisponiveis.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
             </Select>
             <div className="flex items-center bg-white border border-slate-200 rounded-md shadow-sm h-9">
               <Button variant="ghost" size="icon" onClick={prevPeriodo} className="h-9 w-9 rounded-r-none border-r border-slate-200"><ChevronLeft className="w-4 h-4 text-slate-600"/></Button>
               <div className="px-3 text-xs font-bold text-slate-700 min-w-[130px] text-center">
                 {format(diasPeriodo[0], "dd/MM")} - {format(diasPeriodo[diasPeriodo.length - 1], "dd/MM")}
               </div>
               <Button variant="ghost" size="icon" onClick={nextPeriodo} className="h-9 w-9 rounded-l-none border-l border-slate-200"><ChevronRight className="w-4 h-4 text-slate-600"/></Button>
             </div>
             <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue/></SelectTrigger>
                <SelectContent>
                   <SelectItem value="hoje">Hoje</SelectItem>
                   <SelectItem value="amanha">Amanhã</SelectItem>
                   <SelectItem value="esta_semana">Esta semana</SelectItem>
                   <SelectItem value="proxima_semana">Próxima semana</SelectItem>
                   <SelectItem value="quinzenal">Quinzenal</SelectItem>
                   <SelectItem value="este_mes">Este mês</SelectItem>
                   <SelectItem value="proximo_mes">Próximo mês</SelectItem>
                   <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
             </Select>
             {filtroPeriodo === 'personalizado' && (
               <div className="flex items-center gap-1.5">
                 <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9 text-xs w-32" />
                 <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-9 text-xs w-32" />
               </div>
             )}
             <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Veículo"/></SelectTrigger>
                <SelectContent>
                   <SelectItem value="todos">Todos Veículos</SelectItem>
                   {Object.entries(TIPO_VEICULO_LABEL).map(([val, label]) => (
                     <SelectItem key={val} value={val}>{label}</SelectItem>
                   ))}
                </SelectContent>
             </Select>
             <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue placeholder="Status"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="indisponivel">Indisponível</SelectItem>
                </SelectContent>
             </Select>
          </div>
       </div>

       {/* Quick KPIs as Operational Chips */}
       <div className="flex items-center gap-2 shrink-0 px-4 py-1.5 bg-slate-100 border-b border-slate-200 overflow-x-auto custom-scrollbar">
          <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 flex items-center gap-1.5 px-2 py-0.5"><Truck className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{listaControleDiario.length}</span> <span className="text-[9px] uppercase font-semibold">Alocações</span></Badge>
          <Badge variant="outline" className="bg-emerald-50/80 text-emerald-700 border-emerald-200 flex items-center gap-1.5 px-2 py-0.5"><CheckCircle className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{listaControleDiario.filter(a => a.status === 'operacao' || a.status === 'confirmado' || a.statusPagamento === 'a pagar').length}</span> <span className="text-[9px] uppercase font-semibold">Em Rota/Conf.</span></Badge>
          <Badge variant="outline" className="bg-amber-50/80 text-amber-700 border-amber-200 flex items-center gap-1.5 px-2 py-0.5"><Clock className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{listaControleDiario.filter(a => a.tipo === 'reserva' || a.status === 'aguardando').length}</span> <span className="text-[9px] uppercase font-semibold">Aguardando</span></Badge>
          <Badge variant="outline" className="bg-orange-50/80 text-orange-700 border-orange-200 flex items-center gap-1.5 px-2 py-0.5"><DollarSign className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">R$ {listaControleDiario.reduce((acc, a) => acc + (a.totals?.total ?? a.metadata?.totals?.prestador?.total ?? 0), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> <span className="text-[9px] uppercase font-semibold">Repasse</span></Badge>
       </div>

       {/* Main Tabs Area */}
       <Tabs defaultValue="tabelas" className="flex-1 flex flex-col overflow-hidden bg-transparent">
          <div className="bg-white border-b border-slate-200 px-4 py-2 overflow-x-auto shrink-0 shadow-sm z-10">
             <TabsList className="bg-transparent h-9 p-0 flex w-max gap-2">
                <TabsTrigger value="tabelas" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><FileText className="w-3.5 h-3.5 mr-1.5"/> Controle Diário</TabsTrigger>
                <TabsTrigger value="grade" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><Truck className="w-3.5 h-3.5 mr-1.5"/> Grade Horizontal</TabsTrigger>
                <TabsTrigger value="calendario" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><CalendarIcon className="w-3.5 h-3.5 mr-1.5"/> Calendário Mensal</TabsTrigger>
                 <TabsTrigger value="confirmacoes" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><Check className="w-3.5 h-3.5 mr-1.5"/> Fila e Pátio</TabsTrigger>
                 <TabsTrigger value="indicadores" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><Activity className="w-3.5 h-3.5 mr-1.5"/> Indicadores</TabsTrigger>
                 <TabsTrigger value="graficos" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><BarChart3 className="w-3.5 h-3.5 mr-1.5"/> Gráficos</TabsTrigger>
             </TabsList>
          </div>

          <TabsContent value="calendario" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col overflow-auto bg-slate-50 m-0 custom-scrollbar border-t border-slate-200">
             <div className="bg-white h-full flex flex-col">
               <div className="grid grid-cols-7 gap-2 min-w-[700px] flex-1">
                 {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => (
                   <div key={day} className="text-center font-bold text-xs text-slate-500 py-2 border-b border-slate-100 uppercase">
                     {day}
                   </div>
                 ))}
                 
                 {(() => {
                   const monthStart = startOfMonth(currentDate);
                   const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                   const gridDays = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
                   
                   return gridDays.map((d, index) => {
                     const isSelectedPeriod = diasPeriodo.some((pDay) => isSameDay(pDay, d));
                     const dayAlocacoes = alocacoesFiltradas.filter((a) => isSameDay(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), d));
                     const isToday = isSameDay(d, new Date());
                     const isCurrentMonth = d.getMonth() === currentDate.getMonth();

                     return (
                       <div
                         key={index}
                         onClick={() => {
                           if (isSelectedPeriod) {
                             handleCellClick("", d);
                           }
                         }}
                         className={`min-h-[60px] border border-slate-200 rounded-xl p-1.5 transition flex flex-col justify-start gap-1 ${
                           isSelectedPeriod 
                             ? 'bg-white hover:bg-slate-50 cursor-pointer hover:border-primary shadow-sm' 
                             : 'bg-slate-50/50 opacity-50 pointer-events-none'
                         } ${isToday ? 'ring-2 ring-orange-500 ring-offset-2' : ''}`}
                       >
                         <div className="flex justify-between items-center">
                           <span className={`text-xs font-black rounded-full w-6 h-6 flex items-center justify-center ${
                             isToday 
                               ? 'bg-orange-500 text-white' 
                               : (isCurrentMonth ? 'text-slate-800' : 'text-slate-400')
                           }`}>
                             {format(d, "d")}
                           </span>
                           {isSelectedPeriod && dayAlocacoes.length > 0 && (
                             <Badge className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-600 font-bold border-blue-200">
                               {dayAlocacoes.filter(a => !isStatusCancelado(a.status)).length} aloc.
                             </Badge>
                           )}
                         </div>
                         
                         <div className="flex-1 mt-1 space-y-0.5 overflow-y-auto custom-scrollbar">
                           {isSelectedPeriod && dayAlocacoes.map((a, i) => (
                             <div
                               key={i}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleCellClick(a.prestadorId, d);
                               }}
                               className="text-[9px] bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 truncate font-semibold hover:bg-slate-200 transition"
                             >
                               {a.prestadorNome || "Alocação"}
                             </div>
                           ))}
                         </div>
                       </div>
                     );
                   });
                 })()}
               </div>
             </div>
          </TabsContent>

          <TabsContent value="grade" className="data-[state=active]:flex-1 data-[state=active]:flex overflow-hidden m-0 p-0 bg-white border-t border-slate-200">
            {/* Sidebar Prestadores (moved to inside Grade Horizontal) */}
            <div className="w-[280px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
               <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-xs text-slate-700 flex items-center gap-2"><Truck className="w-4 h-4 text-slate-500"/> Motoristas e Veículos</h3>
               </div>
               <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
                  {prestadoresFiltrados.map(p => (
                     <div key={p.id} className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-primary/50 transition cursor-pointer flex gap-3 items-center group">
                        <Avatar className="w-8 h-8 border border-slate-200 shadow-sm"><AvatarFallback className="bg-slate-100 text-slate-500 text-xs font-bold">{p.avatar}</AvatarFallback></Avatar>
                        <div className="flex-1 overflow-hidden">
                           <p className="text-xs font-bold text-slate-800 truncate">{p.nome}</p>
                           <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold truncate">{TIPO_VEICULO_LABEL[p.veiculo as keyof typeof TIPO_VEICULO_LABEL] || p.veiculo}</p>
                        </div>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${p.status === 'disponivel' ? 'bg-emerald-500' : p.status === 'ocupado' ? 'bg-orange-500' : 'bg-slate-300'}`}/>
                     </div>
                  ))}
                  {prestadoresFiltrados.length === 0 && (
                     <div className="p-4 text-center text-slate-400 text-xs font-medium">Nenhum prestador listado.</div>
                  )}
               </div>
            </div>

            {/* Horizontal Grid */}
            <div className="flex-1 overflow-auto bg-slate-50 custom-scrollbar relative">
              <div className="min-w-[800px]">
                <div className="grid bg-slate-50 border-b border-slate-200 sticky top-0 z-10" style={{gridTemplateColumns:`repeat(${diasPeriodo.length}, minmax(100px, 1fr))`}}>
                  {diasPeriodo.map((d, i) => (
                    <div key={i} className={`p-2 border-r border-slate-200 text-center ${isSameDay(d, new Date()) ? 'bg-blue-50/50 border-b-2 border-b-blue-500' : ''}`}>
                      <p className="text-[9px] uppercase font-bold text-slate-400">{format(d, "EEE", {locale: ptBR})}</p>
                      <p className={`text-sm font-black ${isSameDay(d, new Date()) ? 'text-blue-600' : 'text-slate-700'}`}>{format(d, "dd/MM")}</p>
                    </div>
                  ))}
                </div>
                <div className="divide-y divide-slate-100">
                  {prestadoresFiltrados.length === 0 ? (
                     <div className="p-8 text-center text-slate-400 text-sm">Nenhuma informação de grade.</div>
                  ) : (
                    prestadoresFiltrados.map(p => (
                    <div key={p.id} className="hover:bg-slate-50/50 transition" style={{display:'grid', gridTemplateColumns:`repeat(${diasPeriodo.length}, minmax(100px, 1fr))`}}>
                      {diasPeriodo.map((d, i) => {
                        const res = alocacoesFiltradas.find(r => r.prestadorId === p.id && isSameDay(new Date(r.data.includes('T') ? r.data : r.data + 'T12:00:00'), d));
                        let slotStyle = "bg-white text-slate-400";
                        if (p.status === "inativo") slotStyle = "bg-slate-50 text-slate-300";
                        let slotLabel = "Livre";
                        let icon = null;
                        
                        let isAtrasado = false;
                        let minAtraso = 0;

                        if (res) {
                           const st = res.status?.toLowerCase() || "";
                           if (st === "confirmado") {
                              slotStyle = "bg-emerald-50 text-emerald-700 border-b-2 border-b-emerald-500";
                              slotLabel = "Liberado";
                              icon = <CheckCircle className="w-3 h-3 text-emerald-600" />;
                           } else if (st === "operacao") {
                              slotStyle = "bg-blue-50 text-blue-700 border-b-2 border-b-blue-600";
                              slotLabel = "Em Rota";
                              icon = <Truck className="w-3 h-3 text-blue-600" />;
                           } else if (st === "aguardando") {
                              slotStyle = "bg-orange-50 text-orange-700 border-b-2 border-b-orange-500";
                              slotLabel = "Aguardando";
                              icon = <Clock className="w-3 h-3 text-orange-600" />;
                           } else if (["divergencia", "ocorrencia", "bloqueado"].includes(st)) {
                              slotStyle = "bg-rose-50 text-rose-700 border-b-2 border-b-rose-600";
                              slotLabel = "Ocorrência";
                              icon = <AlertTriangle className="w-3 h-3 text-rose-600" />;
                           } else if (["concluido", "finalizado"].includes(st)) {
                              slotStyle = "bg-slate-100 text-slate-700 border-b-2 border-b-slate-600";
                              slotLabel = "Concluído";
                              icon = <Check className="w-3 h-3 text-slate-600" />;
                           } else {
                              slotStyle = "bg-slate-100 text-slate-600 border-b-2 border-b-slate-400";
                              slotLabel = st.toUpperCase();
                           }

                           if (res.horarioInicio && ["aguardando", "confirmado"].includes(st)) {
                             const [hStr, mStr] = res.horarioInicio.split(':');
                             if (hStr && mStr && res.data) {
                                const dataAlocacao = new Date(res.data);
                                dataAlocacao.setHours(Number(hStr), Number(mStr), 0, 0);
                                if (isSameDay(dataAlocacao, new Date())) {
                                   const diffMinutos = Math.floor((new Date().getTime() - dataAlocacao.getTime()) / 60000);
                                   if (diffMinutos > 0) {
                                      isAtrasado = true;
                                      minAtraso = diffMinutos;
                                   }
                                }
                             }
                           }
                        }

                        return (
                          <div key={i} onClick={() => handleCellClick(p.id, d)} className={`p-2 border-r border-slate-200 cursor-pointer hover:brightness-95 transition min-h-[70px] flex flex-col items-start justify-between relative ${slotStyle}`}>
                            {res ? (
                               <div className="flex flex-col w-full h-full gap-0.5">
                                 <div className="flex items-center justify-between w-full">
                                   <div className="flex items-center gap-1 font-black text-[10px] uppercase tracking-tighter">
                                     {icon}
                                     <span>{slotLabel}</span>
                                   </div>
                                   <span className="font-bold text-[9px] bg-white/60 px-1 rounded shadow-sm">{res.horarioInicio || "08:00"}</span>
                                 </div>
                                 <div className="text-[10px] font-semibold truncate leading-tight mt-1 w-full" title={res.clienteNome}>{res.clienteNome || "Cliente"}</div>
                                 {isAtrasado && (
                                   <div className="absolute -bottom-1.5 right-1 bg-rose-600 text-white text-[8px] font-bold px-1 rounded shadow-md z-10 flex items-center gap-0.5">
                                      +{minAtraso}m
                                   </div>
                                 )}
                               </div>
                            ) : (
                               <div className="w-full h-full flex items-center justify-center opacity-40">
                                 <span className="text-[10px] font-bold">{slotLabel}</span>
                               </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tabelas" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col overflow-auto m-0 p-0 bg-white custom-scrollbar h-full">
            <div className="flex flex-col h-full bg-white">
              <div className="border-b border-slate-200 bg-slate-50/50 py-1.5 px-4 flex flex-row items-center justify-between sticky top-0 z-20">
                <h4 className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-primary"/> Controle Diário de Alocações</h4>
              </div>
              <div className="overflow-x-auto flex-1">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow className="border-b border-slate-100">
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase pl-6">Data</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Prestador</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Cliente</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Veículo</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Placa</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">OS</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Status</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-center">Financeiro</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-right">Valor Cliente</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-right">Repasse</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-right">Acréscimos</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-right">Espera</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-center">Região</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-center">Horário</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase text-right pr-6">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-slate-100">
                              {(() => {
                                console.log("[DEBUG] Lista usada pelo Controle Diario:", listaControleDiario.length, "itens", listaControleDiario);
                                if (listaControleDiario.length === 0) {
                                  return (
                                    <TableRow>
                                      <TableCell colSpan={14} className="h-32 text-center text-slate-500 font-medium">
                                        Nenhuma alocação encontrada para os filtros selecionados.
                                      </TableCell>
                                    </TableRow>
                                  );
                                }
                                return listaControleDiario.map((a, i) => {
                                  const prest = prestadores.find(p => p.id === a.prestadorId);
                                  const veiculoLabel = prest ? (TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo || "Sem veículo") : (a.prestadorVeiculo?.tipo_veiculo || "—");
                                  const placaLabel = prest?.placa || a.prestadorVeiculo?.placa || "—";
                                  const valorCliente = a.valor_frete ?? a.metadata?.totals?.cliente?.total ?? 0;
                                  const repasse = a.totals?.total ?? a.metadata?.totals?.prestador?.total ?? 0;
                                  const acrescimos = a.totals?.totalAdicionais ?? a.metadata?.totals?.adicionais ?? 0;
                                  const espera = a.metadata?.totals?.espera ?? 0;
                                  const financeiroStatus = a.metadata?.financeiro_status || 'ok';

                                  const statusRaw = (a.status || "").toLowerCase();
                                  const statusLabel = obterLabelStatus(a.status);
                                  let statusStyle: { color: string; icon: React.ReactNode } = { color: obterClasseBadgeStatus(a.status), icon: null as React.ReactNode };
                                  if (["recusada", "cancelada"].includes(statusRaw)) statusStyle.icon = <AlertTriangle className="w-2.5 h-2.5" />;
                                  else if (statusRaw === "aguardando_aceite") statusStyle.icon = <Clock className="w-2.5 h-2.5" />;
                                  else if (statusRaw === "aceita" || statusRaw === "confirmado") statusStyle.icon = <CheckCircle className="w-2.5 h-2.5" />;
                                  else if (statusRaw === "em_rota" || statusRaw === "operacao") statusStyle.icon = <Truck className="w-2.5 h-2.5" />;
                                  else if (statusRaw === "concluida" || statusRaw === "finalizado") statusStyle.icon = <Check className="w-2.5 h-2.5" />;
                                  else if (statusRaw === "ocorrencia") statusStyle.icon = <AlertCircle className="w-2.5 h-2.5" />;

                                  let isAtrasado = false;
                                  let minutosAtraso = 0;
                                  if (a.horarioInicio && ["aguardando", "confirmado"].includes(a.status?.toLowerCase() || "")) {
                                    const [hStr, mStr] = a.horarioInicio.split(':');
                                    if (hStr && mStr && a.data) {
                                       const dataAlocacao = new Date(a.data);
                                       dataAlocacao.setHours(Number(hStr), Number(mStr), 0, 0);
                                       if (isSameDay(dataAlocacao, new Date())) {
                                          const diffMinutos = Math.floor((new Date().getTime() - dataAlocacao.getTime()) / 60000);
                                          if (diffMinutos > 0) {
                                             isAtrasado = true;
                                             minutosAtraso = diffMinutos;
                                          }
                                       }
                                    }
                                  }

                                  return (
                                    <TableRow key={i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                                      <TableCell className="text-xs font-semibold pl-6">{a.data ? format(new Date(a.data), 'dd/MM/yyyy') : "—"}</TableCell>
                                      <TableCell className="text-xs font-bold text-slate-900">{prest?.nome || a.prestadorNome || "—"}</TableCell>
                                      <TableCell className="text-[10px] font-semibold text-slate-500">{a.clienteNome || "—"}</TableCell>
                                      <TableCell className="text-xs font-semibold text-slate-700">{veiculoLabel}</TableCell>
                                      <TableCell><span className="font-mono font-bold text-slate-800 bg-slate-100 border-t-2 border-t-blue-600 border-x border-b border-slate-300 px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[10px] uppercase tracking-wider">{placaLabel}</span></TableCell>
                                       <TableCell>
                                         <div className="flex flex-col items-start">
                                           <span className="font-mono font-bold text-xs text-slate-700">{a.osNumero || a.os || "—"}</span>
                                           {((a.metadata?.numeroOC || a.numero_oc) && (a.osNumero || a.os)) ? (
                                             <span className="text-[9px] text-slate-400" title="Romaneio / OC do cliente">OC: {a.metadata?.numeroOC || a.numero_oc}</span>
                                           ) : null}
                                         </div>
                                       </TableCell>
                                      <TableCell>
                                        <Badge className={`text-[9px] font-bold px-1.5 py-0.5 flex items-center w-max gap-1 border shadow-sm ${statusStyle.color}`}>
                                          {statusStyle.icon}
                                          <span className="uppercase">{statusLabel}</span>
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge className={`text-[9px] font-bold px-1.5 py-0.5 border shadow-sm ${
                                          financeiroStatus === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          financeiroStatus === 'pendente' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                          financeiroStatus === 'fallback' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                          financeiroStatus === 'manual' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                          'bg-slate-50 text-slate-700 border-slate-200'
                                        }`}>
                                          {financeiroStatus === 'ok' && <CheckCircle className="w-2.5 h-2.5 mr-1 inline" />}
                                          {financeiroStatus === 'pendente' && <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />}
                                          {financeiroStatus === 'fallback' && <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />}
                                          <span className="uppercase">{financeiroStatus}</span>
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-xs text-blue-600 font-bold text-right">{valorCliente > 0 ? `R$ ${Number(valorCliente).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : "—"}</TableCell>
                                      <TableCell className="text-xs text-emerald-600 font-bold text-right">{repasse > 0 ? `R$ ${Number(repasse).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : "—"}</TableCell>
                                      <TableCell className="text-xs text-orange-600 font-bold text-right">{acrescimos > 0 ? `R$ ${Number(acrescimos).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : "—"}</TableCell>
                                      <TableCell className="text-xs text-amber-600 font-bold text-right">{espera > 0 ? `R$ ${Number(espera).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : "—"}</TableCell>
                                      <TableCell className="text-[10px] font-semibold text-center text-slate-500">{a.regiao || "—"}</TableCell>
                                      <TableCell className="text-[10px] font-semibold text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-1">
                                           <span>{a.horarioInicio || "—"}</span>
                                           {isAtrasado ? (
                                             <span className="text-[8px] font-bold bg-rose-100 text-rose-700 px-1 rounded-sm flex items-center gap-0.5"><AlertTriangle className="w-2 h-2"/> +{minutosAtraso}min</span>
                                           ) : (
                                              a.horarioInicio && (["planejada", "aguardando_aceite", "aceita"].includes(statusRaw)) && (
                                               <span className="text-[8px] font-bold bg-emerald-100 text-emerald-700 px-1 rounded-sm">No Prazo</span>
                                             )
                                           )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right pr-6 space-x-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleCellClick(a.prestadorId, new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00')); }} title="Editar">
                                          <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-emerald-600" onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(a); }} title="WhatsApp">
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); handleGerarRelatorioPagamento(a); }} title="PDF">
                                          <FileText className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100 border border-red-300 rounded-md" onClick={(e) => { e.stopPropagation(); setCancelTarget(a); }} title="Cancelar Alocação" style={{minWidth: '24px'}}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                        {(statusRaw === "concluida" || statusRaw === "finalizado") && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100" onClick={(e) => { e.stopPropagation(); setSelectedPodAlocacao(a.id); setShowPODModal(true); }} title="Ver Protocolo de Entrega">
                                            <FileText className="w-3.5 h-3.5" />
                                          </Button>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              })()}
                            </TableBody>
                          </Table>
                        </div>
              </div>
          </TabsContent>

                  <TabsContent value="confirmacoes" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col overflow-auto m-0 p-0 bg-white custom-scrollbar h-full">
                    <div className="flex flex-col h-full bg-white">
                      <div className="border-b border-slate-200 bg-slate-50/50 py-1.5 px-4 flex flex-row items-center justify-between sticky top-0 z-20">
                        <div className="flex items-center gap-3">
                          <h4 className="text-[11px] font-black text-slate-800 uppercase flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-primary"/> Confirmações e Fila</h4>
                          <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block">Status integrado ao controle de pátio</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto flex-1">
                          <Table>
                            <TableHeader className="bg-slate-50/50">
                              <TableRow className="border-b border-slate-100">
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase pl-6">Prestador / Tipo</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">OS / Cliente</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Veículo / Placa</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Região / Destino</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Horário</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Fila Pátio</TableHead>
                                <TableHead className="font-extrabold text-[10px] text-slate-400 uppercase">Status</TableHead>
                                <TableHead className="text-right font-extrabold text-[10px] text-slate-400 uppercase pr-6">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody className="divide-y divide-slate-100">
                              {alocacoesFiltradas.filter(a => a.data && diasPeriodo.some(dp => isSameDay(dp, new Date(a.data)))).length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={8} className="h-32 text-center text-slate-500 font-medium">
                                    Nenhuma confirmação pendente para os filtros selecionados.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                alocacoesFiltradas.filter(a => a.data && diasPeriodo.some(dp => isSameDay(dp, new Date(a.data)))).map((c, i) => {
                                  const prest = prestadores.find(p => p.id === c.prestadorId);
                                  const veiculoLabel = prest ? (TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo || "Sem veículo") : (c.prestadorVeiculo?.tipo_veiculo || "—");
                                  const placaLabel = prest?.placa || c.prestadorVeiculo?.placa || "—";
                                  const statusAtual = c.status || "—";
                                  let statusStyle = { label: statusAtual, color: "bg-slate-100 text-slate-600 border-slate-200", icon: null as React.ReactNode };
                                  if (statusAtual.toLowerCase() === "confirmado") statusStyle = { label: 'Liberado Rota', color: "bg-emerald-500 text-white border-emerald-600", icon: <CheckCircle className="w-2.5 h-2.5" /> };
                                  else if (statusAtual.toLowerCase() === "operacao") statusStyle = { label: 'Em Rota', color: "bg-blue-600 text-white border-blue-700", icon: <Truck className="w-2.5 h-2.5" /> };
                                  else if (statusAtual.toLowerCase() === "aguardando") statusStyle = { label: 'Aguard. Chegada', color: "bg-orange-500 text-white border-orange-600", icon: <Clock className="w-2.5 h-2.5" /> };
                                  else if (["divergencia", "ocorrencia", "bloqueado"].includes(statusAtual.toLowerCase())) statusStyle = { label: 'Divergência', color: "bg-rose-500 text-white border-rose-600", icon: <AlertTriangle className="w-2.5 h-2.5" /> };
                                  else if (["cancelado"].includes(statusAtual.toLowerCase())) statusStyle = { label: 'Cancelado', color: "bg-rose-500 text-white border-rose-600", icon: <AlertTriangle className="w-2.5 h-2.5" /> };

                                  let isAtrasado = false;
                                  let minutosAtraso = 0;
                                  if (c.horarioInicio && ["aguardando"].includes(c.status?.toLowerCase() || "")) {
                                    const [hStr, mStr] = c.horarioInicio.split(':');
                                    if (hStr && mStr && c.data) {
                                       const dataAlocacao = new Date(c.data);
                                       dataAlocacao.setHours(Number(hStr), Number(mStr), 0, 0);
                                       if (isSameDay(dataAlocacao, new Date())) {
                                          const diffMinutos = Math.floor((new Date().getTime() - dataAlocacao.getTime()) / 60000);
                                          if (diffMinutos > 0) {
                                             isAtrasado = true;
                                             minutosAtraso = diffMinutos;
                                          }
                                       }
                                    }
                                  }

                                  return (
                                    <TableRow key={c.id || i} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                                      <TableCell className="pl-6">
                                        <div className="font-bold text-slate-900 text-xs">{c.prestadorNome || prest?.nome || "—"}</div>
                                        <Badge className={`text-[9px] font-bold border-0 px-2 py-0.2 mt-1 ${
                                          c.turno === "integral" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                        }`}>
                                          {c.turno === "integral" ? "Integral" : "Meio Período"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-bold text-slate-700 text-xs">{c.osNumero || c.os || "—"}</div>
                                        <div className="text-[10px] font-semibold text-slate-400">{c.clienteNome || "—"}</div>
                                        {((c.metadata?.numeroOC || c.numero_oc) && (c.osNumero || c.os)) ? (
                                          <div className="text-[9px] text-slate-400" title="Romaneio / OC do cliente">OC: {c.metadata?.numeroOC || c.numero_oc}</div>
                                        ) : null}
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-semibold text-slate-700 text-xs">{veiculoLabel}</div>
                                        <div className="mt-1"><span className="font-mono font-bold text-slate-800 bg-slate-100 border-t-2 border-t-blue-600 border-x border-b border-slate-300 px-1.5 py-0.5 rounded shadow-[0_1px_2px_rgba(0,0,0,0.1)] text-[10px] uppercase tracking-wider">{placaLabel}</span></div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-bold text-slate-700 text-xs">Região Principal</div>
                                      </TableCell>
                                      <TableCell className="text-xs text-slate-600 font-medium">
                                        <div className="flex flex-col items-start gap-1">
                                           <span>{c.horarioInicio || "08:00"}</span>
                                           {isAtrasado && (
                                             <span className="text-[8px] font-bold bg-rose-100 text-rose-700 px-1 rounded-sm flex items-center w-max gap-0.5"><AlertTriangle className="w-2 h-2"/> +{minutosAtraso}min</span>
                                           )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 w-max px-2 py-1 rounded-full shadow-inner">
                                           <span className={`w-2 h-2 rounded-full ${statusAtual.toLowerCase() === 'aguardando' || statusAtual.toLowerCase() === 'confirmado' || statusAtual.toLowerCase() === 'operacao' ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'bg-slate-300'}`} title="Portaria"></span>
                                           <div className={`w-3 h-px ${statusAtual.toLowerCase() === 'confirmado' || statusAtual.toLowerCase() === 'operacao' ? 'bg-orange-300' : 'bg-slate-200'}`}></div>
                                           <span className={`w-2 h-2 rounded-full ${statusAtual.toLowerCase() === 'confirmado' || statusAtual.toLowerCase() === 'operacao' ? 'bg-orange-500 shadow-[0_0_5px_rgba(249,115,22,0.5)]' : 'bg-slate-300'}`} title="Doca"></span>
                                           <div className={`w-3 h-px ${statusAtual.toLowerCase() === 'confirmado' || statusAtual.toLowerCase() === 'operacao' ? 'bg-emerald-300' : 'bg-slate-200'}`}></div>
                                           <span className={`w-2 h-2 rounded-full ${statusAtual.toLowerCase() === 'confirmado' || statusAtual.toLowerCase() === 'operacao' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} title="Liberado"></span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge className={`text-[9px] font-bold px-1.5 py-0.5 flex items-center w-max gap-1 border shadow-sm ${statusStyle.color}`}>
                                          {statusStyle.icon}
                                          <span className="uppercase">{statusStyle.label}</span>
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right pr-6">
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="text-orange-500 hover:text-orange-600 font-bold text-xs gap-1"
                                          onClick={() => {
                                            setSelectedCarregamentoDetail(c);
                                            setShowCarregamentoDetailModal(true);
                                          }}
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          Ver Carregamento
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </div>
                    </div>
                  </TabsContent>
                </Tabs>

        {/* Modal de Reserva */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="w-[90vw] max-w-[1200px] xl:max-w-[1400px] bg-slate-50/90 backdrop-blur-xl border-slate-200/60 shadow-2xl h-[90vh] flex flex-col overflow-hidden rounded-3xl p-0">
            <div className="flex-none bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between z-20 shadow-sm"><DialogHeader>
              <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
              <DialogDescription className="flex items-center flex-wrap gap-1 mt-1">
                Alocação para <strong className="text-slate-800">{prestadorAtivo?.nome || 'Prestador em seleção'}</strong> em
                <Input 
                  type="date" 
                  className="h-8 text-xs w-[130px] ml-1 bg-white" 
                  value={dataAlocacaoModal}
                  onChange={(e) => {
                     if(e.target.value) {
                       setDataAlocacaoModal(e.target.value);
                       setSelectedCell(prev => prev ? { ...prev, data: new Date(e.target.value + "T12:00:00") } : { prestadorId: "", data: new Date(e.target.value + "T12:00:00") });
                     }
                  }}
                />
              </DialogDescription>
            </DialogHeader></div>
            
            
              

             
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/30">
               {/* Coluna Esquerda: Setup da Viagem */}
               <div className="flex-none w-full lg:w-[400px] bg-white border-r border-slate-200 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4 z-10 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">
                 <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-600"/> Setup da Viagem</h3>
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-primary">Prestador *</Label>
                   <div className="relative">
                     <Input 
                       placeholder="Pesquisar prestador (nome, placa, veículo)..."
                       value={filtroPrestadorModal}
                       onChange={(e) => {
                          setFiltroPrestadorModal(e.target.value);
                          setShowPrestadorDropdown(true);
                          if(novoPrestadorId) { 
                             setNovoPrestadorId(""); 
                             setNovoPrestadorNome(""); 
                             setPrestadorVeiculo(null); 
                          }
                       }}
                       onFocus={() => setShowPrestadorDropdown(true)}
                       className="h-9 text-xs"
                     />
                     {showPrestadorDropdown && filtroPrestadorModal.length > 0 && (
                       <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto z-50">
                          {prestadores.filter(p => p.nome.toLowerCase().includes(filtroPrestadorModal.toLowerCase()) || (p.placa && p.placa.toLowerCase().includes(filtroPrestadorModal.toLowerCase())) || (p.veiculo && p.veiculo.toLowerCase().includes(filtroPrestadorModal.toLowerCase()))).length === 0 ? (
                            <div className="p-2 text-xs text-slate-500">Nenhum prestador encontrado.</div>
                          ) : (
                            prestadores.filter(p => p.nome.toLowerCase().includes(filtroPrestadorModal.toLowerCase()) || (p.placa && p.placa.toLowerCase().includes(filtroPrestadorModal.toLowerCase())) || (p.veiculo && p.veiculo.toLowerCase().includes(filtroPrestadorModal.toLowerCase()))).map(p => (
                              <div key={p.id} className="p-2 text-xs cursor-pointer hover:bg-slate-50 border-b last:border-b-0" onClick={() => {
                                setNovoPrestadorId(p.id);
                                setNovoPrestadorNome(p.nome);
                                setFiltroPrestadorModal(p.nome);
                                setShowPrestadorDropdown(false);
                                setFinanceiro(f => ({ ...f, valorTipo: 'cadastro' }));
                                buscarDadosVeiculoPrestador(p.id);
                              }}>
                                <div className="font-bold text-slate-800">{p.nome}</div>
                                <div className="text-[10px] text-slate-500 flex gap-2 mt-0.5">
                                  <span>Placa: {p.placa || "N/A"}</span>
                                  <span>Veículo: {p.veiculo || "N/A"}</span>
                                </div>
                              </div>
                            ))
                          )}
                       </div>
                     )}
                   </div>
                 </div>
                  {prestadorVeiculo && prestadorVeiculo.tipo_veiculo && (
                    <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium text-slate-700">{TIPO_VEICULO_LABEL[prestadorVeiculo.tipo_veiculo] || prestadorVeiculo.tipo_veiculo}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-medium text-slate-700">{prestadorVeiculo.placa || "Sem placa"}</span>
                        </div>
                        {prestadorVeiculo.refrigerado && (
                          <Badge className="bg-cyan-100 text-cyan-700 text-[10px]">Refrigerado</Badge>
                        )}
                      </div>
                    </div>
                  )}
                  {prestadorVeiculo && !prestadorVeiculo.tipo_veiculo && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-medium text-amber-800">Este prestador não possui veículo vinculado. Vincule um veículo para localizar a tabela de preço.</span>
                    </div>
                  )}
                 <div className="space-y-1">
                   <Label className="text-xs font-bold text-primary">Cliente Vinculado</Label>
                   <SearchableSelect 
                     table="clientes" 
                     labelField="nome_fantasia" 
                     searchFields={["nome_fantasia", "razao_social"]} 
                     value={novoClienteId} 
                       onChange={(id, item) => {
                         setNovoClienteId(id || "");
                         if (item) {
                           setNovoClienteNome(item.nome_fantasia);
                         }
                         // ESCALA-E2E-08D — a busca da tabela é reativa (useEffect),
                         // não mais disparada manualmente aqui (evita chamada duplicada).
                       }} 
                      placeholder="Selecione o cliente para buscar tabela de preços..."
                    />
                  </div>
                  {prestadorVeiculo && !prestadorVeiculo.tipo_veiculo && novoClienteId && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-center">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="text-xs font-medium text-amber-800">Vincule um veículo ao prestador para localizar a tabela de preço do cliente.</span>
                    </div>
                  )}
                  {loadingTabelaValores && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Buscando tabela de valores...
                    </div>
                  )}
                  {novoClienteId && prestadorVeiculo?.tipo_veiculo && !tabelaValores && !loadingTabelaValores && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex gap-2 items-center">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <div className="flex flex-col">
                        <span className="font-bold text-rose-800 text-xs">Nenhuma tabela de preço encontrada para este cliente/veículo.</span>
                        <span className="text-[10px] text-rose-600">Alocação ficará com financeiro pendente ou zerado.</span>
                      </div>
                    </div>
                   )}
                   {tabelaAmbiguidadeTermica && (
                     <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex gap-2 items-center">
                       <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                       <div className="flex flex-col">
                         <span className="font-bold text-amber-800 text-xs">Múltiplas tabelas compatíveis por condição térmica.</span>
                         <span className="text-[10px] text-amber-700">Defina a condição térmica do veículo (seco/térmico/refrigerado) ou ajuste a tabela para evitar seleção ambígua.</span>
                       </div>
                     </div>
                   )}
                  {tabelaValores && (
                   <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                     <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-emerald-800">Tabela aplicada: {regraEspecialAtiva ? "Cliente" : "Universal"}</span>
                       <span className="text-emerald-700">Base: R$ {tabelaValores.valor_base?.toFixed(2) || "0"} | KM: R$ {tabelaValores.valor_km?.toFixed(2) || "0"} | Franquia: {resolverFranquiaEfetiva(tabelaValores.franquia_km, tabelaValores.km_franquia)} km</span>
                     </div>
                   </div>
                 )}
                 {novoPrestadorId && (!prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real || prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real?.valor_diaria === 0) && (
                   <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 flex gap-2 items-center mt-2">
                     <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                     <div className="flex flex-col">
                       <span className="font-bold text-orange-800 text-xs">Prestador sem regra financeira de repasse cadastrada.</span>
                       <span className="text-[10px] text-orange-600">O sistema usará regras de repasse genéricas como fallback.</span>
                     </div>
                   </div>
                 )}
                  <div className="space-y-1 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-slate-400" />
                      <Label className="text-xs font-bold text-slate-800">Identificação Conexão (OS Interna)</Label>
                    </div>
                    {novaOS ? (
                      <div className="flex items-center justify-between gap-2 rounded-lg border bg-blue-50/60 px-3 py-2">
                        <div className="min-w-0">
                          <p className="font-mono font-extrabold text-sm text-blue-700">{novaOS}</p>
                          <p className="text-[10px] text-slate-500">Número interno da Conexão Express (vinculado a alocacoes_escala.ordem_servico_id)</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-slate-500" onClick={() => { setNovaOS(""); setNovaOSId(""); }}>
                          Desvincular
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed px-3 py-2 text-[11px] text-slate-400">
                        Sem OS interna vinculada. Use o campo abaixo para vincular uma OS existente (fluxo oficial — não é gerada numeração fictícia aqui).
                      </div>
                    )}
                    <SearchableSelect
                      table="ordens_servico"
                      labelField="numero"
                      searchFields={["numero"]}
                      value={novaOS}
                      onChange={(v, record) => { setNovaOS(v || ""); setNovaOSId(record?.id || ""); }}
                      placeholder="Buscar e vincular OS interna existente..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-primary">Origem</Label>
                    <Input
                      value={novaOrigem}
                      onChange={(e) => setNovaOrigem(e.target.value)}
                      placeholder="Ex: CD Cajamar - Rod. Anhanguera, Km 38"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-primary">Destino</Label>
                    <Input
                      value={novoDestino}
                      onChange={(e) => setNovoDestino(e.target.value)}
                      placeholder="Ex: CD Guarulhos - Av. Papa Joao XXIII, 2100"
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-primary">Turno Operacional</Label>
                    <Select value={novoTurno} onValueChange={setNovoTurno}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="madrugada">Madrugada</SelectItem>
                        <SelectItem value="manha">Manhã</SelectItem>
                        <SelectItem value="tarde">Tarde</SelectItem>
                        <SelectItem value="noite">Noite</SelectItem>
                        <SelectItem value="integral">Integral (24h)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

               {/* Coluna Direita: Abas operacionais e financeiras */}
               <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col">
                 <Tabs defaultValue="dados" className="w-full flex flex-col min-h-0">
              <div className="mb-4">
                <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dados" className="text-xs"><FileText className="w-3 h-3 mr-1"/>Dados da Alocação</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs"><DollarSign className="w-3 h-3 mr-1"/>Dados Financeiros</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>
                <TabsTrigger value="status" className="text-xs"><Play className="w-3 h-3 mr-1"/>Status da Entrega</TabsTrigger>
              </TabsList>
              </div>
                 

<TabsContent value="dados" className="space-y-6">
<div className="border-t pt-4 mt-4 space-y-3">
                   <div className="space-y-1 mb-4">
                     <div className="flex items-center gap-1.5">
                       <FileText className="w-3.5 h-3.5 text-slate-400" />
                       <Label className="text-xs font-bold text-slate-800">Romaneio / OC do Cliente</Label>
                     </div>
                     <Input 
                       value={numeroOC} 
                       onChange={(e) => setNumeroOC(e.target.value)} 
                       placeholder="Ex: OC-20260511-1234"
                     />
                     <p className="text-[10px] text-slate-400">Referência fornecida pelo cliente (romaneio / OC / ordem de carregamento). Usada no Financeiro e faturamento. Não é o número interno da Conexão Express.</p>
                   </div>
                   <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Controle de KM e Franquia</h4>
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <Label className="text-xs">KM Inicial</Label>
                         <Input 
                           type="number" 
                           value={kmInicial} 
                           onChange={(e) => {
                             const val = Number(e.target.value);
                             setKmInicial(val);
                             setFinanceiro(f => ({ ...f, kmRodados: Math.max(kmFinal - val, 0) }));
                           }} 
                         />
                      </div>
                      <div className="space-y-1">
                         <Label className="text-xs">KM Final</Label>
                         <Input 
                           type="number" 
                           value={kmFinal} 
                           onChange={(e) => {
                             const val = Number(e.target.value);
                             setKmFinal(val);
                             setFinanceiro(f => ({ ...f, kmRodados: Math.max(val - kmInicial, 0) }));
                           }} 
                         />
                      </div>
                   </div>
                   {(() => {
                     const kmRodados = Math.max(kmFinal - kmInicial, 0);
                     const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                     const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 0;
                     const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 0;
                     const kmExcedente = Math.max(kmRodados - kmFranquia, 0);
                     const totalExcedente = kmExcedente * valorKm;
                     const tabelaNaoConfigurada = novoClienteId && !regraEspecialAtiva;

                     return (
                       <div className="grid grid-cols-5 gap-2 p-3 bg-slate-50 rounded-xl border text-[11px]">
                         <div className="text-center border-r">
                           <p className="text-slate-500 font-medium">KM Total</p>
                           <p className="font-bold text-slate-800">{kmRodados} km</p>
                         </div>
                         <div className="text-center border-r">
                           <p className="text-slate-500 font-medium">Franquia</p>
                           <p className="font-bold text-slate-800">{tabelaNaoConfigurada ? "N/C" : `${kmFranquia} km`}</p>
                         </div>
                         <div className="text-center border-r">
                           <p className="text-slate-500 font-medium">KM Exced.</p>
                           <p className="font-bold text-orange-600">{tabelaNaoConfigurada ? "-" : `${kmExcedente} km`}</p>
                         </div>
                         <div className="text-center border-r">
                           <p className="text-slate-500 font-medium">Vlr KM Adic.</p>
                           <p className="font-bold text-slate-800">{tabelaNaoConfigurada ? "-" : `R$ ${valorKm.toFixed(2)}`}</p>
                         </div>
                         <div className="text-center">
                           <p className="text-slate-500 font-medium">Total Exced.</p>
                           <p className="font-bold text-green-600">{tabelaNaoConfigurada ? "-" : `R$ ${totalExcedente.toFixed(2)}`}</p>
                         </div>
                       </div>
                     );
                   })()}
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Turno</Label>
                      <Select value={novoTurno} onValueChange={setNovoTurno}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="integral">Dia Integral</SelectItem>
                            <SelectItem value="manha">Manhã (06-14)</SelectItem>
                            <SelectItem value="tarde">Tarde (14-22)</SelectItem>
                            <SelectItem value="noite">Noite (22-06)</SelectItem>
                            <SelectItem value="saida">Saída</SelectItem>
                            <SelectItem value="intermediario">Intermediário</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Tipo</Label>
                      <Select value={novoTipo} onValueChange={setNovoTipo}>
                         <SelectTrigger><SelectValue/></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="disponibilidade">Disponibilidade</SelectItem>
                            <SelectItem value="reserva">Reserva Operacional</SelectItem>
                            <SelectItem value="bloqueio">Bloqueio</SelectItem>
                            <SelectItem value="afastamento">Afastamento</SelectItem>
                         </SelectContent>
                      </Select>
                    </div>
                 </div>
                 <div className="border-t pt-3 mt-2">
                   <div className="flex items-center justify-between mb-2">
                     <Label className="text-xs font-bold text-amber-700 flex items-center gap-1">
                       <Truck className="w-3 h-3" /> Coleta Reversa
                     </Label>
                     <Switch checked={showReversa} onCheckedChange={setShowReversa} />
                   </div>
                   {showReversa && (
                     <ColetaReversaFields fields={reversaFields} onChange={setReversaFields} defaultOpen />
                   )}
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <Label className="text-xs">Horário Início</Label>
                       <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Horário Fim</Label>
                      <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="space-y-1">
                      <Label className="text-xs">Instruções ao Prestador</Label>
                      <Textarea value={instrucoesPrestador} onChange={e => setInstrucoesPrestador(e.target.value)} placeholder="Ex: Chegar 30m antes." rows={2} className="text-xs"/>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Observação Operacional</Label>
                      <Textarea value={observacaoOperacional} onChange={e => setObservacaoOperacional(e.target.value)} placeholder="Ex: Doca 4 ocupada." rows={2} className="text-xs"/>
                   </div>
                   <div className="space-y-1">
                      <Label className="text-xs">Observação p/ Faturamento</Label>
                      <Textarea value={observacaoCliente} onChange={e => setObservacaoCliente(e.target.value)} placeholder="Ex: Diária extra autorizada." rows={2} className="text-xs"/>
                   </div>
                </div>
              </TabsContent>
              
              <TabsContent value="financeiro" className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Inputs Column */}
                  <div className="md:col-span-2 space-y-4">
                    {/* Faturamento Cliente - Tabela e Ajuste */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> Faturamento do Cliente</h4>
                      
                      
                      {tabelaRascunhoEncontrada && !tabelaValores && (
                         <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-amber-800">
                               <strong>Aviso:</strong> Existe a tabela específica <em>"{tabelaRascunhoEncontrada.nome}"</em> para este cliente e veículo, mas ela está com status <strong>{tabelaRascunhoEncontrada.status.toUpperCase()}</strong> (inativa). Ela não será usada nesta operação.
                            </div>
                         </div>
                      )}

                      <div className="bg-white border rounded-lg p-3 grid grid-cols-2 gap-4">
                        <div>
                           <p className="text-[10px] text-slate-500 font-semibold uppercase">Tabela Utilizada</p>
                           <p className="text-xs font-bold text-slate-800 mt-0.5">{tabelaValores ? tabelaValores.nome : 'NENHUMA TABELA VINCULADA'}</p>
                           {tabelaValores && <p className="text-[10px] text-slate-500 mt-0.5">Vigência: {tabelaValores.data_inicio ? format(new Date(tabelaValores.data_inicio), 'dd/MM/yyyy') : 'Sem data'} a {tabelaValores.data_fim ? format(new Date(tabelaValores.data_fim), 'dd/MM/yyyy') : 'Sem data'}</p>}
                           {!tabelaValores && novoClienteId && <p className="text-[9px] text-red-500 mt-1">Nenhuma tabela ativa para este cliente e veículo.</p>}
                        </div>
                        <div>
                           <p className="text-[10px] text-slate-500 font-semibold uppercase">Parâmetros (Base / KM)</p>
                           <p className="text-xs font-bold text-slate-800 mt-0.5">
                             {tabelaValores ? `R$ ${tabelaValores.valor_base?.toFixed(2)} / R$ ${tabelaValores.valor_km_excedente?.toFixed(2)}` : '-'}
                           </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-1">
                         <div className="space-y-1">
                            <Label className="text-xs text-blue-900 font-semibold">Ajuste Manual (R$)</Label>
                            <Input 
                              type="number" 
                              value={ajusteClienteValor} 
                              onChange={e => setAjusteClienteValor(Number(e.target.value))} 
                              className="h-9 border-blue-200 focus-visible:ring-blue-500" 
                            />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs text-blue-900 font-semibold">Motivo do Ajuste</Label>
                            <Input 
                              type="text" 
                              placeholder="Obrigatório"
                              value={ajusteClienteMotivo} 
                              onChange={e => setAjusteClienteMotivo(e.target.value)} 
                              className={`h-9 ${(!tabelaValores || ajusteClienteValor !== 0) && !ajusteClienteMotivo ? 'border-red-300 ring-1 ring-red-100' : 'border-blue-200'}`} 
                            />
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs text-blue-900 font-semibold">Espera (min)</Label>
                            <Input 
                              type="number" 
                              placeholder="Tempo aguardado"
                              value={minutosEspera} 
                              onChange={e => setMinutosEspera(Number(e.target.value))} 
                              className="h-9 border-blue-200 focus-visible:ring-blue-500" 
                            />
                            {minutosEspera > 0 && tabelaValores?.adicionais?.espera?.ativo && (!tabelaValores.adicionais.espera.faixas || tabelaValores.adicionais.espera.faixas.length === 0) && (
                              <p className="text-[9px] text-orange-600 flex items-center gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3"/> Faixas de espera não cadastradas. Usando regra legada (valor fixo/hora).
                              </p>
                            )}
                         </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1"><Truck className="w-3.5 h-3.5"/> Valor do Prestador</h4>
                      
                      {financeiro.valorTipo === 'percentual' && tabelaValores && tabelaValores.tipo_repasse_prestador && (!prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real || prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real?.valor_diaria === 0) && (
                         <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-2 flex flex-col gap-1">
                            <span className="text-[10px] text-orange-800 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> FALLBACK: REGRA DA TABELA DO CLIENTE</span>
                            <span className="text-xs font-bold text-orange-900">
                               {tabelaValores.tipo_repasse_prestador === 'percentual' 
                                 ? `${tabelaValores.percentual_prestador}% sobre o faturamento` 
                                 : `Valor Fixo de R$ ${tabelaValores.valor_fixo_prestador}`}
                            </span>
                            <span className="text-[9px] text-orange-700">Prestador sem financeiro próprio. Usando regra de repasse embutida na tabela do cliente.</span>
                         </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-4">
                         <div className="space-y-1">
                            <Label className="text-xs">Tipo de Cálculo</Label>
                            <Select value={financeiro.valorTipo} onValueChange={v => setFinanceiro(f => ({ ...f, valorTipo: v as any }))}>
                               <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="cadastro">Cadastro do prestador</SelectItem>
                                  <SelectItem value="percentual">% sobre tabela</SelectItem>
                                  <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1">
                            {financeiro.valorTipo === 'cadastro' ? (
                              <>
                                <Label className="text-xs">Regra do Cadastro</Label>
                                <div className="h-9 flex items-center px-3 rounded-md border bg-slate-100 text-xs text-slate-700">
                                  {(() => {
                                    const p = prestadores.find(x => x.id === novoPrestadorId);
                                    const diaria = Number(p?.financeiro_real?.valor_diaria) || 0;
                                    const saida = Number(p?.financeiro_real?.valor_saida) || 0;
                                    const base = diaria > 0 ? diaria : (saida > 0 ? saida : 0);
                                    if (base <= 0) return 'Sem valor cadastrado';
                                    return `R$ ${base.toFixed(2)} ${diaria > 0 ? '(diária)' : '(saída)'}`;
                                  })()}
                                </div>
                              </>
                            ) : (
                              <>
                                <Label className="text-xs">{financeiro.valorTipo === 'percentual' ? 'Percentual (%)' : 'Valor Fixo (R$)'}</Label>
                                <Input type="number" value={financeiro.valorTipo === 'percentual' ? financeiro.valorPercentual : financeiro.valorFixo} onChange={e => {
                                  if (financeiro.valorTipo === 'percentual') setFinanceiro(f => ({...f, valorPercentual: Number(e.target.value)}));
                                  else setFinanceiro(f => ({...f, valorFixo: Number(e.target.value)}));
                                }} className="h-9" />
                              </>
                            )}
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs">KM Excedente (R$)</Label>
                            <Input type="number" value={kmExcedentePrestador} onChange={e => setKmExcedentePrestador(Number(e.target.value))} className="h-9" />
                         </div>
                      </div>
                    </div>
                    
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                       <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Adicionais e Descontos</h4>
                       <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">Combustível (R$)</Label>
                             <Input type="number" value={financeiro.combustivel} onChange={e => setFinanceiro(f => ({ ...f, combustivel: Number(e.target.value) }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">Pedágio (R$)</Label>
                             <Input type="number" value={financeiro.pedagio} onChange={e => setFinanceiro(f => ({ ...f, pedagio: Number(e.target.value) }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">Ajudantes (qtd)</Label>
                             <Input type="number" value={financeiro.ajudantes} onChange={e => setFinanceiro(f => ({ ...f, ajudantes: Number(e.target.value) }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">R$/Ajudante</Label>
                             <Input type="number" value={financeiro.valorAjudante} onChange={e => setFinanceiro(f => ({ ...f, valorAjudante: Number(e.target.value) }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">Diárias Adic.</Label>
                             <Input type="number" value={financeiro.diariasAdicionais} onChange={e => setFinanceiro(f => ({ ...f, diariasAdicionais: Number(e.target.value) }))} className="h-8 text-xs" />
                          </div>
                          <div className="space-y-1">
                             <Label className="text-[10px] font-semibold text-slate-600">Desconto (R$)</Label>
                             <Input type="number" value={financeiro.desconto} onChange={e => setFinanceiro(f => ({ ...f, desconto: Number(e.target.value) }))} className="h-8 text-xs border-red-200" />
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="bg-white border rounded-lg p-2.5 flex items-center justify-between">
                             <div className="flex flex-col">
                               <Label className="text-[10px] font-bold">2ª Saída</Label>
                               <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Switch checked={financeiro.segundaSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, segundaSaida: v }))} />
                               <Input type="number" value={financeiro.valorSegundaSaida} onChange={e => setFinanceiro(f => ({ ...f, valorSegundaSaida: Number(e.target.value) }))} disabled={!financeiro.segundaSaida} className="w-16 h-8 text-xs" />
                             </div>
                          </div>
                          
                          <div className="bg-white border rounded-lg p-2.5 flex items-center justify-between">
                             <div className="flex flex-col">
                               <Label className="text-[10px] font-bold">3ª Saída</Label>
                               <span className="text-[9px] text-slate-400">Adicionar valor fixo</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <Switch checked={financeiro.terceiraSaida} onCheckedChange={v => setFinanceiro(f => ({ ...f, terceiraSaida: v }))} />
                               <Input type="number" value={financeiro.valorTerceiraSaida} onChange={e => setFinanceiro(f => ({ ...f, valorTerceiraSaida: Number(e.target.value) }))} disabled={!financeiro.terceiraSaida} className="w-16 h-8 text-xs" />
                             </div>
                          </div>
                       </div>
                    </div>

                    {/* Coleta Reversa - Valores Financeiros */}
                    <div className="mt-4">
                      <ColetaReversaFinanceiro
                        fields={reversaFields}
                        onChange={setReversaFields}
                        qtdPrevista={reversaFields.reversa_qtd_volumes}
                      />
                    </div>
                  </div>

                  {/* Summary Sidebar Column */}
                  <div className="md:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between h-full min-h-[250px]">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b pb-2 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-primary"/> Resumo Financeiro</h4>
                      
                      {(() => {
                        const res = calcularTotalAlocacao();
                        return (
                          <div className="mt-3 space-y-4 text-xs">
                            {/* CLIENTE / FATURAMENTO */}
                            <div>
                              <p className="font-bold text-slate-700 uppercase mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500"/> Faturamento Cliente</p>
                              {res.cliente.valorBase === 0 && <p className="text-[9px] text-red-500 font-bold bg-red-50 border border-red-200 p-1 rounded mb-2">⚠️ Sem Tabela - Valor Zerado</p>}
                              <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">Valor Base (Tabela):</span>
                                <span className="font-semibold text-slate-800">R$ {res.cliente.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">Adicionais (KM exced.):</span>
                                <span className="font-semibold text-slate-800">R$ {res.cliente.adicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {showReversa && reversaFields.tipo_reversa !== "sem_reversa" && (
                                <div className="flex justify-between items-center py-0.5">
                                  <span className="text-amber-700 font-medium">Coleta Reversa:</span>
                                  <span className="font-semibold text-amber-700">
                                    + R$ {(reversaFields.reversa_impacto_cliente || (reversaFields.reversa_qtd_volumes * reversaFields.reversa_valor_unitario)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center py-1 mt-1 border-t">
                                <span className="text-slate-600 font-bold">Total a Faturar:</span>
                                <span className="font-bold text-blue-600 text-sm">R$ {res.cliente.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            {/* PRESTADOR / REPASSE */}
                            <div>
                              <p className="font-bold text-slate-700 uppercase mb-1 flex items-center gap-1"><Truck className="w-3 h-3 text-orange-500"/> Repasse Prestador</p>
                              <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">Diária Base:</span>
                                <span className="font-semibold text-slate-800">R$ {res.prestador.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">Adicionais (+):</span>
                                <span className="font-semibold text-green-600">+ R$ {res.prestador.adicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              {showReversa && reversaFields.tipo_reversa !== "sem_reversa" && (
                                <div className="flex justify-between items-center py-0.5">
                                  <span className="text-amber-700 font-medium">Repasse Reversa:</span>
                                  <span className="font-semibold text-amber-700">
                                    + R$ {(reversaFields.reversa_impacto_prestador || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500">Descontos (-):</span>
                                <span className="font-semibold text-red-500">- R$ {res.prestador.descontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="flex justify-between items-center py-1 mt-1 border-t">
                                <span className="text-slate-600 font-bold">Total a Pagar:</span>
                                <span className="font-bold text-orange-600 text-sm">R$ {res.prestador.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            {/* RESULTADO (MARGEM) */}
                            <div className="bg-white border p-2 rounded mt-2">
                              <p className="font-bold text-slate-700 uppercase mb-1 text-[10px]">Resultado da Operação</p>
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-medium">Margem Bruta (R$):</span>
                                <span className={`font-bold ${res.margem.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  R$ {res.margem.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-slate-500 font-medium">Margem (%):</span>
                                <span className={`font-bold ${res.margem.percentual >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {res.margem.percentual.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="resumo" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {/* 1. HISTÓRICO OPERACIONAL */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                    <span>Histórico Operacional</span>
                    <Badge variant="outline" className="bg-white text-slate-600 font-semibold text-[10px]">
                      Tempos Operacionais
                    </Badge>
                  </div>
                  
                  {(() => {
                    const calcularDiferencaTempo = (t1: string, t2: string) => {
                      if (!t1 || !t2) return "0 min";
                      const [h1, m1] = t1.split(":").map(Number);
                      const [h2, m2] = t2.split(":").map(Number);
                      let diffMin = (h2 * 60 + m2) - (h1 * 60 + m1);
                      if (diffMin < 0) diffMin += 24 * 60; // overnight
                      const hrs = Math.floor(diffMin / 60);
                      const mins = diffMin % 60;
                      if (hrs > 0) {
                        return `${hrs}h ${mins}m`;
                      }
                      return `${mins} min`;
                    };

                    // A31-H — tempos REAIS derivados dos eventos do App têm prioridade;
                    // o cálculo manual (metadata) permanece apenas como fallback.
                    const usaTemposReais = !!temposReais && (temposReais.tempoTotalMin !== null || temposReais.chegadaOrigem !== null);
                    const diffAguardando = usaTemposReais
                      ? formatarDuracaoMin(temposReais!.tempoAguardandoMin)
                      : calcularDiferencaTempo(tempoChegadaPatio, tempoInicioCarregamento);
                    const diffCarregamento = usaTemposReais
                      ? formatarDuracaoMin(temposReais!.tempoCarregamentoMin)
                      : calcularDiferencaTempo(tempoInicioCarregamento, tempoFimCarregamento);
                    const diffEmRota = usaTemposReais
                      ? formatarDuracaoMin(temposReais!.tempoEmRotaMin)
                      : calcularDiferencaTempo(tempoSaidaRua, tempoFinalizacaoEntregas);
                    const diffTotal = usaTemposReais
                      ? formatarDuracaoMin(temposReais!.tempoTotalMin)
                      : calcularDiferencaTempo(tempoChegadaPatio, tempoFinalizacaoEntregas);

                    return (
                      <div className="space-y-3">
                        {usaTemposReais && (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-700 flex items-center gap-1.5">
                            <Smartphone className="w-3 h-3 shrink-0" />
                            Tempos calculados a partir dos eventos REAIS do App Motorista (eventos_oficiais). Campos manuais abaixo são apenas fallback.
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Horário Agendado</Label>
                            <Input 
                              type="time" 
                              value={horarioInicio} 
                              onChange={(e) => setHorarioInicio(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Chegada no Pátio</Label>
                            <Input 
                              type="time" 
                              value={tempoChegadaPatio} 
                              onChange={(e) => setTempoChegadaPatio(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg flex justify-between items-center text-xs font-semibold text-amber-800">
                          <span>Tempo Aguardando:</span>
                          <span className="font-bold">{diffAguardando}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Início Carregamento</Label>
                            <Input 
                              type="time" 
                              value={tempoInicioCarregamento} 
                              onChange={(e) => setTempoInicioCarregamento(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Fim Carregamento</Label>
                            <Input 
                              type="time" 
                              value={tempoFimCarregamento} 
                              onChange={(e) => setTempoFimCarregamento(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg flex justify-between items-center text-xs font-semibold text-emerald-800">
                          <span>Tempo de Carregamento:</span>
                          <span className="font-bold">{diffCarregamento}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Saída para Rua</Label>
                            <Input 
                              type="time" 
                              value={tempoSaidaRua} 
                              onChange={(e) => setTempoSaidaRua(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">Finalização das Entregas</Label>
                            <Input 
                              type="time" 
                              value={tempoFinalizacaoEntregas} 
                              onChange={(e) => setTempoFinalizacaoEntregas(e.target.value)} 
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-cyan-50 border border-cyan-100 rounded-lg flex justify-between items-center text-xs font-semibold text-cyan-800">
                          <span>Tempo em Rota:</span>
                          <span className="font-bold">{diffEmRota}</span>
                        </div>

                        <div className="pt-2 border-t flex justify-between items-center text-xs text-slate-600 font-bold">
                          <span>Tempo Total de Operação:</span>
                          <span className="text-slate-800">{diffTotal}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 2. REGISTRO DE KM E VALORES DO DIA */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2">
                    Controle de KM e Fechamento
                  </div>
                  
                  {(() => {
                    const totals = calcularTotalAlocacao();
                    const horaSaida = tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8;
                     const prestadorSelecionado = prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id));
                      const diariaBase = prestadorSelecionado?.financeiro_real?.valor_diaria || 350;
                     const kmFranquia = prestadorSelecionado?.financeiro_real?.franquia_km || 0;
                     const valorKm = prestadorSelecionado?.financeiro_real?.valor_km || 0;
                    const kmRodados = Math.max(kmFinal - kmInicial, 0);
                    
                    const tabelaNaoConfigurada = novoClienteId && !regraEspecialAtiva;
                    
                    // Calcular percentual adicional baseado no horário
                    let percentualAdicional = 0;
                    let obsAdicional = "";
                    let diariaCalculada = diariaBase;
                    
                    if (regraEspecialAtiva && novoClienteId) {
                      if (horaSaida <= 11) {
                        percentualAdicional = 0;
                        obsAdicional = "SAÍDA ATÉ 11:00 = DIÁRIA BASE";
                      } else if (horaSaida <= 14) {
                        percentualAdicional = 50;
                        diariaCalculada = diariaBase * 1.50;
                        obsAdicional = `50% = R$ ${diariaCalculada.toFixed(2)}`;
                      } else if (horaSaida <= 16) {
                        percentualAdicional = 70;
                        diariaCalculada = diariaBase * 1.70;
                        obsAdicional = `70% = R$ ${diariaCalculada.toFixed(2)}`;
                      } else {
                        percentualAdicional = 85;
                        diariaCalculada = diariaBase * 1.85;
                        obsAdicional = `85% = R$ ${diariaCalculada.toFixed(2)}`;
                      }
                    }
                    
                    const kmExcedente = Math.max(kmRodados - kmFranquia, 0);
                    const valorKmExcedente = kmExcedente * valorKm;
                    const adicionaisManuais = Math.max(totals.totalAdicionais - valorKmExcedente, 0);
                    const totalDia = diariaCalculada + valorKmExcedente + adicionaisManuais - totals.totalDescontos;

                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">KM Inicial</Label>
                            <Input 
                              type="number" 
                              value={kmInicial} 
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setKmInicial(val);
                                setFinanceiro(f => ({ ...f, kmRodados: Math.max(kmFinal - val, 0) }));
                              }}
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-semibold">KM Final</Label>
                            <Input 
                              type="number" 
                              value={kmFinal} 
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setKmFinal(val);
                                setFinanceiro(f => ({ ...f, kmRodados: Math.max(val - kmInicial, 0) }));
                              }}
                              className="bg-white text-xs h-8 border-slate-200"
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">KM Total Automático:</span>
                          <span className="font-bold text-slate-800">{kmRodados} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Franquia KM:</span>
                          <span className="font-bold text-slate-800">{kmFranquia} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">KM Excedente:</span>
                          <span className="font-bold text-orange-600">{kmExcedente} km</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Valor KM Adicional:</span>
                          <span className="font-bold text-slate-800">R$ {valorKm.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Total KM Excedente:</span>
                          <span className="font-bold text-slate-800">R$ {valorKmExcedente.toFixed(2)}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Diária Base / Calculada:</span>
                          <span className="font-bold text-slate-800">
                            R$ {diariaBase.toFixed(2)} / <span className="text-cyan-600">R$ {diariaCalculada.toFixed(2)}</span>
                          </span>
                        </div>

                        {regraEspecialAtiva && novoClienteId && percentualAdicional > 0 && (
                          <div className="flex justify-between items-center text-xs py-1 text-orange-600 border-b">
                            <span>Adicional {percentualAdicional}%:</span>
                            <span className="font-medium">+ R$ {(diariaCalculada - diariaBase).toFixed(2)}</span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs py-1 border-b text-muted-foreground">
                          <span>+ Adicionais Financeiros:</span>
                          <span className="font-medium text-slate-800">R$ {adicionaisManuais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b text-red-500">
                          <span>- Descontos:</span>
                          <span className="font-medium">R$ {totals.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {regraEspecialAtiva && obsAdicional && (
                          <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                            <span className="text-xs font-semibold text-amber-800">{obsAdicional}</span>
                          </div>
                        )}

                        <div className="pt-3 border-t flex justify-between items-center">
                          <span className="text-sm font-black text-slate-800 uppercase">Total do Dia:</span>
                          <span className="text-base font-black text-green-600">R$ {totalDia.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-end pt-2">
                          <Button 
                            variant="outline" 
                            className="gap-2 h-9 text-xs border-primary text-primary hover:bg-primary/10"
                            onClick={() => {
                              const tempAloc = {
                                prestadorNome: novoPrestadorNome || prestadorAtivo?.nome,
                                prestadorVeiculo,
                                os: novaOS,
                                clienteNome: novoClienteNome,
                                data: dataAlocacaoModal ? dataAlocacaoModal + 'T12:00:00' : new Date().toISOString(),
                                horarioInicio,
                                tempoChegadaPatio,
                                tempoInicioCarregamento,
                                tempoFimCarregamento,
                                tempoSaidaRua,
                                tempoFinalizacaoEntregas,
                                kmInicial,
                                kmFinal,
                                totals: calcularTotalAlocacao(),
                                metadata: { financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? 'pendente' : 'fallback') : 'ok', statusOperacional, observacaoOperacional }
                              };
                              handleGerarRelatorioPagamento(tempAloc);
                            }}
                          >
                            <Download className="w-3.5 h-3.5" /> Gerar Relatório de Pagamento
                          </Button>
                        </div>
                      </div>
                    );
                  })()}
                  </div>

                {/* 3. COLETA REVERSA - RESUMO DO DIA */}
                {showReversa && reversaFields.tipo_reversa !== "sem_reversa" && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-4">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider border-b border-amber-200 pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Coleta Reversa</span>
                      <Badge className={`text-[10px] font-bold px-2 py-0.5 ${(() => {
                        const dif = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada - reversaFields.reversa_qtd_volumes : 0;
                        return dif === 0 ? 'bg-emerald-100 text-emerald-800' : dif < 0 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800';
                      })()}`}>
                        {REVERSA_STATUS_LABELS[reversaFields.reversa_status] || reversaFields.reversa_status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div><span className="text-amber-700 font-medium">Tipo:</span><br /><span className="font-bold text-slate-800">{REVERSA_TIPO_LABELS[reversaFields.tipo_reversa] || reversaFields.tipo_reversa}</span></div>
                      <div><span className="text-amber-700 font-medium">Status:</span><br /><span className="font-bold text-slate-800">{REVERSA_STATUS_LABELS[reversaFields.reversa_status] || reversaFields.reversa_status}</span></div>
                      <div><span className="text-amber-700 font-medium">Qtd Prevista:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_qtd_volumes} {reversaFields.reversa_unidade_cobranca}</span></div>
                      <div><span className="text-amber-700 font-medium">Qtd Coletada:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_qtd_coletada > 0 ? `${reversaFields.reversa_qtd_coletada} ${reversaFields.reversa_unidade_cobranca}` : '—'}</span></div>
                      <div><span className="text-amber-700 font-medium">Unidade:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_unidade_cobranca}</span></div>
                      <div><span className="text-amber-700 font-medium">Divergência:</span><br />
                        {(() => {
                          const dif = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada - reversaFields.reversa_qtd_volumes : 0;
                          const cls = dif === 0 ? 'text-emerald-700 bg-emerald-100' : dif < 0 ? 'text-red-700 bg-red-100' : 'text-amber-700 bg-amber-100';
                          const lbl = dif === 0 ? 'Sem divergência' : dif < 0 ? `${Math.abs(dif)} faltante(s)` : `${dif} excedente(s)`;
                          return <span className={`font-bold inline-block px-2 py-0.5 rounded ${cls}`}>{lbl}</span>;
                        })()}
                      </div>
                      <div><span className="text-amber-700 font-medium">Classificação:</span><br />
                        {(() => {
                          const dif = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada - reversaFields.reversa_qtd_volumes : 0;
                          const cor = dif === 0 ? 'text-emerald-700' : dif < 0 ? 'text-red-700' : 'text-amber-700';
                          return <span className={`font-bold ${cor}`}>{dif === 0 ? 'OK' : dif < 0 ? 'FALTANTE' : 'EXCEDENTE'}</span>;
                        })()}
                      </div>
                      {reversaFields.reversa_motivo_divergencia && (
                        <div className="col-span-2"><span className="text-amber-700 font-medium">Motivo:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_motivo_divergencia}</span></div>
                      )}
                      <div><span className="text-amber-700 font-medium">Responsável:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_responsavel || '—'}</span></div>
                      <div><span className="text-amber-700 font-medium">Telefone:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_telefone || '—'}</span></div>
                      <div><span className="text-amber-700 font-medium">Data Prevista:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_data_prevista || '—'}</span></div>
                      <div><span className="text-amber-700 font-medium">Data Realizada:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_data_realizada || '—'}</span></div>
                      <div className="col-span-2"><span className="text-amber-700 font-medium">Endereço Coleta:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_endereco_coleta || '—'}</span></div>
                      <div className="col-span-2"><span className="text-amber-700 font-medium">Endereço Devolução:</span><br /><span className="font-bold text-slate-800">{reversaFields.reversa_endereco_devolucao || '—'}</span></div>
                    </div>

                    <div className="border-t border-amber-200 pt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-amber-700 font-medium">Valor Reversa (Cliente):</span><br />
                        <span className="font-bold text-emerald-700 text-sm">
                          + R$ {(() => {
                            const q = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada : reversaFields.reversa_qtd_volumes;
                            if (reversaFields.reversa_modelo_cliente === 'valor_fixo') return (reversaFields.reversa_valor_fixo_cliente || 0).toFixed(2);
                            return (q * (reversaFields.reversa_valor_unitario_cliente || 0)).toFixed(2);
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-700 font-medium">Repasse (Prestador):</span><br />
                        <span className="font-bold text-blue-700 text-sm">
                          + R$ {(() => {
                            const q = reversaFields.reversa_qtd_coletada > 0 ? reversaFields.reversa_qtd_coletada : reversaFields.reversa_qtd_volumes;
                            if (reversaFields.reversa_modelo_prestador === 'valor_fixo') return (reversaFields.reversa_valor_fixo_prestador || 0).toFixed(2);
                            return (q * (reversaFields.reversa_valor_unitario_prestador || 0)).toFixed(2);
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-700 font-medium">Fotos:</span><br />
                        <span className="font-bold text-slate-800">{reversaFields.reversa_fotos.length > 0 ? `${reversaFields.reversa_fotos.length} foto(s)` : 'Nenhuma'}</span>
                      </div>
                      <div>
                        <span className="text-amber-700 font-medium">Assinatura:</span><br />
                        <span className={`font-bold ${reversaFields.reversa_assinatura_url ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {reversaFields.reversa_assinatura_url ? 'Disponível' : 'Não registrada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-amber-700 font-medium">GPS:</span><br />
                        <span className={`font-bold ${reversaFields.reversa_latitude && reversaFields.reversa_longitude ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {reversaFields.reversa_latitude && reversaFields.reversa_longitude ? `${reversaFields.reversa_latitude.toFixed(6)}, ${reversaFields.reversa_longitude.toFixed(6)}` : 'Não informado'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="status" className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-1">
                 {/* Status Visual Grid */}
                 <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                   {[
                     { id: 'planejado', label: 'Planejado', icon: CalendarIcon },
                     { id: 'aguardando', label: 'Aguardando', icon: Clock },
                     { id: 'carregando', label: 'Carregando', icon: Package },
                     { id: 'em_rota', label: 'Em Rota', icon: Truck },
                     { id: 'finalizado', label: 'Finalizado', icon: CheckCircle },
                     { id: 'cancelado', label: 'Cancelado', icon: AlertTriangle }
                   ].map(st => {
                      const isActive = statusOperacional === st.id;
                      const Icon = st.icon;
                      return (
                        <div 
                          key={st.id} 
                          onClick={() => setStatusOperacional(st.id)}
                          className={`cursor-pointer border rounded-xl p-3 flex flex-col items-center justify-center gap-2 text-center transition-all ${isActive ? 'bg-indigo-50 border-indigo-500 shadow-md ring-1 ring-indigo-500 ring-offset-1' : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                        >
                          <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <span className={`text-[10px] uppercase font-bold ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>{st.label}</span>
                        </div>
                      )
                   })}
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Cronograma Visual */}
                   <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                     <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b pb-2">Timeline Operacional</h4>
                     <div className="space-y-4">
                       {[
                         { label: "Alocado", time: horarioInicio || "--:--", done: !!horarioInicio },
                         { label: "Chegada no Pátio", time: tempoChegadaPatio || "--:--", done: !!tempoChegadaPatio },
                         { label: "Início Carregamento", time: tempoInicioCarregamento || "--:--", done: !!tempoInicioCarregamento },
                         { label: "Fim Carregamento", time: tempoFimCarregamento || "--:--", done: !!tempoFimCarregamento },
                         { label: "Saída (Em Rota)", time: tempoSaidaRua || "--:--", done: !!tempoSaidaRua },
                         { label: "Entregas Finalizadas", time: tempoFinalizacaoEntregas || "--:--", done: !!tempoFinalizacaoEntregas }
                       ].map((step, idx, arr) => (
                         <div key={idx} className="flex items-start gap-4 relative">
                           {idx !== arr.length - 1 && <div className={`absolute left-[11px] top-6 w-0.5 h-6 ${step.done ? 'bg-indigo-500' : 'bg-slate-200'}`}></div>}
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 z-10 bg-white ${step.done ? 'border-indigo-500 text-indigo-500' : 'border-slate-300 text-slate-300'}`}>
                             {step.done ? <Check className="w-3 h-3 font-bold"/> : <div className="w-1.5 h-1.5 rounded-full bg-slate-300"/>}
                           </div>
                           <div className="flex-1 flex justify-between items-center pt-1">
                             <span className={`text-xs font-bold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</span>
                             <span className={`text-xs font-mono ${step.done ? 'text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md' : 'text-slate-400'}`}>{step.time}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                   </div>

                   {/* Observação */}
                   <div className="space-y-2">
                     <Label className="text-xs font-bold text-primary">Observação Operacional</Label>
                     <textarea 
                       className="flex w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-[200px] resize-y custom-scrollbar" 
                       placeholder="Adicione observações importantes, ocorrências ou detalhes sobre o andamento da viagem..."
                       value={observacaoOperacional}
                       onChange={e => setObservacaoOperacional(e.target.value)}
                     />
                    </div>
                  </div>

                  {/* COLETA REVERSA — FLUXO + TIMELINE + FOTOS + ASSINATURA + GPS */}
                  {showReversa && reversaFields.tipo_reversa !== "sem_reversa" && (
                    <div className="space-y-6 border-t border-amber-200 pt-4">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Truck className="w-4 h-4" /> Fluxo da Coleta Reversa
                      </h4>

                      {/* FLUXO DE ETAPAS */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                        {[
                          { id: 'aguardando_coleta', label: 'Aguardando Coleta', icon: Clock },
                          { id: 'reversa_iniciada', label: 'Reversa Iniciada', icon: Play },
                          { id: 'chegada_coleta', label: 'Chegada ao Local', icon: MapPin },
                          { id: 'qtd_informada', label: 'Qtd Informada', icon: Package },
                          { id: 'divergencia_registrada', label: 'Divergência', icon: AlertTriangle },
                          { id: 'coleta_confirmada', label: 'Coleta Confirmada', icon: CheckCircle },
                          { id: 'em_devolucao', label: 'Em Devolução', icon: Truck },
                          { id: 'devolvida', label: 'Devolvida', icon: Check },
                          { id: 'finalizada', label: 'Finalizada', icon: CheckCircle },
                        ].map(step => {
                          const isActive = reversaFields.reversa_status === step.id || 
                            (step.id === 'coleta_confirmada' && ['coletada', 'em_devolucao', 'devolvida', 'finalizada'].includes(reversaFields.reversa_status)) ||
                            (step.id === 'divergencia_registrada' && ['divergente'].includes(reversaFields.reversa_status)) ||
                            (step.id === 'em_devolucao' && ['em_devolucao', 'devolvida', 'finalizada'].includes(reversaFields.reversa_status)) ||
                            (step.id === 'devolvida' && ['devolvida', 'finalizada'].includes(reversaFields.reversa_status)) ||
                            (step.id === 'finalizada' && ['finalizada'].includes(reversaFields.reversa_status));
                          const Icon = step.icon;
                          return (
                            <div key={step.id} className={`border rounded-lg p-2 flex flex-col items-center gap-1 text-center transition-all ${isActive ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-white border-slate-200 opacity-60'}`}>
                              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-600' : 'text-slate-400'}`} />
                              <span className={`text-[9px] font-bold uppercase ${isActive ? 'text-amber-700' : 'text-slate-400'}`}>{step.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* TIMELINE REVERSA — eventos_oficiais */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                          <span>Timeline da Reversa</span>
                          <Badge variant="outline" className="bg-white text-slate-600 font-semibold text-[10px]">
                            eventos_oficiais
                          </Badge>
                        </div>
                        <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                          {(() => {
                            const reversaEvents = [
                              { type: 'reversa_iniciada', label: 'Reversa Iniciada', ts: reversaFields.reversa_data_realizada || reversaFields.reversa_data_prevista },
                              { type: 'reversa_qtd_informada', label: 'Quantidade Informada', ts: reversaFields.reversa_qtd_coletada > 0 ? (reversaFields.reversa_data_realizada || reversaFields.reversa_data_prevista) : '' },
                              { type: 'reversa_coletada', label: 'Coletada', ts: ['coletada', 'em_devolucao', 'devolvida', 'finalizada'].includes(reversaFields.reversa_status) ? (reversaFields.reversa_data_realizada || reversaFields.reversa_data_prevista) : '' },
                              { type: 'reversa_devolvida', label: 'Devolvida', ts: ['devolvida', 'finalizada'].includes(reversaFields.reversa_status) ? (reversaFields.reversa_data_realizada || reversaFields.reversa_data_prevista) : '' },
                              { type: 'reversa_finalizada', label: 'Finalizada', ts: reversaFields.reversa_status === 'finalizada' ? (reversaFields.reversa_data_realizada || reversaFields.reversa_data_prevista) : '' },
                            ].filter(ev => ev.ts);
                            if (reversaEvents.length === 0) {
                              return <p className="text-xs text-slate-400 italic py-2">Nenhum evento registrado. Os eventos serão produzidos pelo App Motorista durante a coleta.</p>;
                            }
                            return reversaEvents.map((ev, idx) => (
                              <div key={idx} className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                <div className="flex-1 flex justify-between items-center">
                                  <span className="text-xs font-semibold text-slate-700">{ev.label}</span>
                                  <span className="text-[10px] font-mono text-slate-500">{ev.ts}</span>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                        {reversaFields.reversa_observacoes && (
                          <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                            <span className="font-semibold">Obs:</span> {reversaFields.reversa_observacoes}
                          </div>
                        )}
                        <p className="text-[9px] text-slate-400 italic">
                          * Eventos adicionais (chegada_coleta, divergente, etc.) são gerados pelo App Motorista em tempo real via RPC f_atualizar_reversa_app.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* FOTOS */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 md:col-span-2">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-amber-600" /> Fotos</span>
                            {reversaFields.reversa_fotos.length > 0 && (
                              <Badge className="bg-amber-100 text-amber-800 font-bold text-[10px]">{reversaFields.reversa_fotos.length} foto(s)</Badge>
                            )}
                          </div>
                          {reversaFields.reversa_fotos.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {reversaFields.reversa_fotos.map((foto, idx) => (
                                <div key={idx} className="group relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                  <img
                                    src={foto.url}
                                    alt={foto.legenda || `Foto ${idx + 1}`}
                                    className="w-full h-24 object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                    onClick={() => window.open(foto.url, '_blank')}
                                    onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).classList.add('hidden'); }}
                                  />
                                  {foto.categoria && (
                                    <span className="absolute top-1 left-1 bg-black/60 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">{foto.categoria}</span>
                                  )}
                                  {foto.legenda && (
                                    <div className="p-1 text-[9px] text-slate-500 truncate">{foto.legenda}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic py-4 text-center">Nenhuma foto registrada</p>
                          )}
                        </div>

                        {/* ASSINATURA */}
                        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2">
                            <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-amber-600" /> Assinatura</span>
                          </div>
                          {reversaFields.reversa_assinatura_url ? (
                            <div className="space-y-2">
                              <img
                                src={reversaFields.reversa_assinatura_url}
                                alt="Assinatura do responsável"
                                className="w-full max-h-24 object-contain border border-slate-200 rounded-lg bg-white cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(reversaFields.reversa_assinatura_url, '_blank')}
                                onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).classList.add('hidden'); }}
                              />
                              <div className="text-[10px] space-y-1 text-slate-600">
                                {reversaFields.reversa_assinatura_nome && (
                                  <p><span className="font-semibold">Responsável:</span> {reversaFields.reversa_assinatura_nome}</p>
                                )}
                                {reversaFields.reversa_assinatura_documento && (
                                  <p><span className="font-semibold">Documento:</span> {reversaFields.reversa_assinatura_documento}</p>
                                )}
                                {reversaFields.reversa_assinatura_data && (
                                  <p><span className="font-semibold">Data/Hora:</span> {reversaFields.reversa_assinatura_data}</p>
                                )}
                                {!reversaFields.reversa_assinatura_nome && !reversaFields.reversa_assinatura_documento && reversaFields.reversa_responsavel && (
                                  <p><span className="font-semibold">Responsável:</span> {reversaFields.reversa_responsavel}</p>
                                )}
                                {reversaFields.reversa_telefone && (
                                  <p><span className="font-semibold">Telefone:</span> {reversaFields.reversa_telefone}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic py-4 text-center">Assinatura não registrada</p>
                          )}
                        </div>
                      </div>

                      {/* GPS */}
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b pb-2">
                          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-amber-600" /> GPS da Coleta</span>
                        </div>
                        {reversaFields.reversa_latitude && reversaFields.reversa_longitude ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-slate-500 font-medium">Latitude:</span>
                              <p className="font-bold text-slate-800 font-mono">{reversaFields.reversa_latitude.toFixed(6)}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-medium">Longitude:</span>
                              <p className="font-bold text-slate-800 font-mono">{reversaFields.reversa_longitude.toFixed(6)}</p>
                            </div>
                            {reversaFields.reversa_gps_data && (
                              <div>
                                <span className="text-slate-500 font-medium">Data/Hora:</span>
                                <p className="font-bold text-slate-800">{reversaFields.reversa_gps_data}</p>
                              </div>
                            )}
                            <div className="sm:col-span-3">
                              <a
                                href={`https://www.google.com/maps?q=${reversaFields.reversa_latitude},${reversaFields.reversa_longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold underline"
                              >
                                <MapPin className="w-3 h-3" /> Abrir no Google Maps
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic py-4 text-center">Localização não informada</p>
                        )}
                      </div>
                    </div>
                  )}
                   </TabsContent>

                   <TabsContent value="indicadores" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col overflow-auto m-0 p-0 bg-white custom-scrollbar h-full">
                    {(() => {
                      const dados = listaControleDiario;
                      const totalOps = dados.length;
                      const totalValorCliente = dados.reduce(function(s, a) { return s + (Number(a.valorTotal) || 0); }, 0);
                      const totalRepasse = dados.reduce(function(s, a) { return s + (Number(a.valorFrete) || 0) + (Number(a.valorPedagio) || 0) + (Number(a.valorAjudante) || 0) + (Number(a.valorAdicional) || 0) - (Number(a.valorDesconto) || 0); }, 0);
                      const margemTotal = totalValorCliente - totalRepasse;
                      const margemPct = totalValorCliente > 0 ? (margemTotal / totalValorCliente * 100) : 0;
                      const kmTotal = dados.reduce(function(s, a) { return s + (Number(a.kmRealizados) || 0); }, 0);
                      const ticketMedio = totalOps > 0 ? totalValorCliente / totalOps : 0;
                      const prestadoresUnicos = new Set(dados.map(function(a) { return a.prestadorId; }).filter(Boolean));
                      const opsPorStatus: Record<string, number> = {};
                      dados.forEach(function(a) {
                        const st = a.status || 'indefinido';
                        opsPorStatus[st] = (opsPorStatus[st] || 0) + 1;
                      });
                      const formatar = function(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
                      return (
                        <div className="p-8 space-y-8 overflow-y-auto h-full">
                          <div>
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Indicadores da Programação</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Operacoes</span>
                                <p className="text-3xl font-black text-slate-800 mt-1">{totalOps || '—'}</p>
                              </div>
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Valor Cliente</span>
                                <p className="text-3xl font-black text-blue-600 mt-1">{totalValorCliente > 0 ? 'R$ ' + formatar(totalValorCliente) : '—'}</p>
                              </div>
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Repasse Prestador</span>
                                <p className="text-3xl font-black text-orange-600 mt-1">{totalRepasse > 0 ? 'R$ ' + formatar(totalRepasse) : '—'}</p>
                              </div>
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem</span>
                                <p className={`text-3xl font-black mt-1 ${margemTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {margemTotal !== 0 ? 'R$ ' + formatar(margemTotal) : '—'}
                                </p>
                                <span className={`text-xs font-semibold ${margemPct >= 20 ? 'text-emerald-500' : margemPct >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {margemPct.toFixed(1)}%
                                </span>
                              </div>
                              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">KM Rodado</span>
                                <p className="text-3xl font-black text-slate-800 mt-1">{kmTotal > 0 ? kmTotal.toLocaleString('pt-BR') + ' km' : '—'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket Medio</span>
                              <p className="text-2xl font-black text-slate-800 mt-1">{ticketMedio > 0 ? 'R$ ' + formatar(ticketMedio) : '—'}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prestadores Ativos</span>
                              <p className="text-2xl font-black text-slate-800 mt-1">{prestadoresUnicos.size || '—'}</p>
                            </div>
                            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Margem %</span>
                              <p className={`text-2xl font-black mt-1 ${margemPct >= 20 ? 'text-emerald-600' : margemPct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                {margemPct.toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {Object.keys(opsPorStatus).length > 0 && (
                            <div>
                              <h4 className="text-sm font-bold text-slate-700 mb-3">Operacoes por Status</h4>
                              <div className="space-y-2">
                                {Object.entries(opsPorStatus).map(function(_a) {
                                  const status = _a[0];
                                  const qtd = _a[1];
                                  const pct = totalOps > 0 ? (qtd / totalOps * 100) : 0;
                                  return (
                                    <div key={status} className="flex items-center gap-3">
                                      <span className="text-xs font-medium text-slate-600 w-28 capitalize">{status.replace(/_/g, ' ')}</span>
                                      <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                                        <div className="bg-primary h-full rounded-full transition-all" style={{width: pct + '%'}} />
                                      </div>
                                      <span className="text-xs font-bold text-slate-700 w-12 text-right">{qtd}</span>
                                      <span className="text-xs text-slate-400 w-12 text-right">{pct.toFixed(1)}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="graficos" className="data-[state=active]:flex-1 data-[state=active]:flex data-[state=active]:flex-col overflow-auto m-0 p-0 bg-slate-50 custom-scrollbar h-full">
                    {(() => {
                      const dados = listaControleDiario;
                      if (dados.length === 0) {
                        return (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center text-slate-400">
                              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                              <p className="text-sm font-semibold">Nenhum dado disponivel</p>
                              <p className="text-xs mt-1">Ajuste os filtros ou periodo para visualizar os graficos.</p>
                            </div>
                          </div>
                        );
                      }
                      const diasMap: Record<string, { cliente: number; repasse: number; margem: number; }> = {};
                      dados.forEach(function(a) {
                        try { const d = format(new Date(a.data.includes('T') ? a.data : a.data + 'T12:00:00'), 'dd/MM'); const vc = Number(a.valorTotal) || 0; const rp = (Number(a.valorFrete)||0) + (Number(a.valorPedagio)||0) + (Number(a.valorAjudante)||0) + (Number(a.valorAdicional)||0) - (Number(a.valorDesconto)||0); const m = vc - rp; if (!diasMap[d]) diasMap[d] = { cliente: 0, repasse: 0, margem: 0 }; diasMap[d].cliente += vc; diasMap[d].repasse += rp; diasMap[d].margem += m; } catch(_e){}
                      });
                      const evolucaoDiaria = Object.entries(diasMap).map(function(_a) { return { dia: _a[0], ..._a[1] }; }).sort(function(a,b) { return a.dia.localeCompare(b.dia); });

                      const statusCount: Record<string, number> = {};
                      dados.forEach(function(a) { const s = a.status || 'indefinido'; statusCount[s] = (statusCount[s] || 0) + 1; });
                      const statusData = Object.entries(statusCount).map(function(_a) { return { name: _a[0].replace(/_/g, ' '), value: _a[1] }; });

                      const clienteMap: Record<string, { qtd: number; valor: number }> = {};
                      dados.forEach(function(a) { const k = a.clienteNome || '—'; if (!clienteMap[k]) clienteMap[k] = { qtd: 0, valor: 0 }; clienteMap[k].qtd++; clienteMap[k].valor += Number(a.valorTotal) || 0; });
                      const clienteData = Object.entries(clienteMap).sort(function(a,b) { return b[1].valor - a[1].valor; }).slice(0, 10);

                      const prestMap: Record<string, { qtd: number; valor: number }> = {};
                      dados.forEach(function(a) { const k = a.prestadorNome || '—'; if (!prestMap[k]) prestMap[k] = { qtd: 0, valor: 0 }; prestMap[k].qtd++; const rp = (Number(a.valorFrete)||0) + (Number(a.valorPedagio)||0) + (Number(a.valorAjudante)||0) + (Number(a.valorAdicional)||0) - (Number(a.valorDesconto)||0); prestMap[k].valor += rp; });
                      const prestData = Object.entries(prestMap).sort(function(a,b) { return b[1].qtd - a[1].qtd; }).slice(0, 10);

                      return (
                        <div className="p-6 space-y-8 overflow-y-auto h-full">
                          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" /> Gráficos da Programação</h3>

                          <Card>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Evolucao Financeira por Dia</CardTitle></CardHeader>
                            <CardContent>
                              <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={evolucaoDiaria}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                                  <YAxis tick={{ fontSize: 11 }} />
                                  <Tooltip formatter={function(v: number) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }} />
                                  <Legend />
                                  <Line type="monotone" dataKey="cliente" name="Valor Cliente" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                  <Line type="monotone" dataKey="repasse" name="Repasse" stroke="#f97316" strokeWidth={2} dot={false} />
                                  <Line type="monotone" dataKey="margem" name="Margem" stroke="#10b981" strokeWidth={2} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </CardContent>
                          </Card>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <Card className="lg:col-span-1">
                              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Operacoes por Status</CardTitle></CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={240}>
                                  <BarChart data={statusData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                            <Card className="lg:col-span-1">
                              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Top Clientes (valor)</CardTitle></CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={240}>
                                  <BarChart data={clienteData.map(function(c) { return { name: c[0].length > 18 ? c[0].slice(0, 15) + '...' : c[0], valor: c[1].valor }; })} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={function(v: number) { return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 }); }} />
                                    <Bar dataKey="valor" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                            <Card className="lg:col-span-1">
                              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold">Top Prestadores (ops)</CardTitle></CardHeader>
                              <CardContent>
                                <ResponsiveContainer width="100%" height={240}>
                                  <BarChart data={prestData.map(function(p) { return { name: p[0].length > 18 ? p[0].slice(0, 15) + '...' : p[0], qtd: p[1].qtd }; })} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                                    <Tooltip />
                                    <Bar dataKey="qtd" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      );
                    })()}
                  </TabsContent>

                </Tabs>
</div></div><div className="flex-none bg-white border-t border-slate-200 p-4 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]"><DialogFooter className="flex justify-between items-center sm:justify-between w-full">
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => handleShareWhatsApp(alocacaoEmEdicao)}>
                <MessageCircle className="w-4 h-4"/> Confirmar via WA
              </Button>
              <Button onClick={handleCreateReserva} disabled={isSaving}>
                {isSaving ? "Salvando..." : "Salvar na Grade"}
              </Button>
            </DialogFooter></div>
          </DialogContent>
         </Dialog>

      {/* Modal Detalhe de Carregamento (Auditoria) */}
      <Dialog open={showCarregamentoDetailModal} onOpenChange={setShowCarregamentoDetailModal}>
        <DialogContent className="max-w-4xl bg-white border-slate-200 max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="border-b border-slate-100 pb-4">
            <DialogTitle className="flex items-center gap-4 text-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-600">
                <Truck className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight">{selectedCarregamentoDetail?.os}</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{selectedCarregamentoDetail?.cliente}</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
            {/* Coluna 1: Informações Gerais */}
            <div className="space-y-4 md:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Origem / Destino</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{selectedCarregamentoDetail?.cliente} (Origem)</p>
                  <p className="text-xs font-bold text-orange-600 mt-0.5">{selectedCarregamentoDetail?.destino} (Destino)</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prestador / Veículo</p>
                  <p className="text-xs font-bold text-slate-700 mt-1">{selectedCarregamentoDetail?.prestador}</p>
                  <p className="text-[10px] font-semibold text-slate-500 mt-0.5">{selectedCarregamentoDetail?.veiculo} • {selectedCarregamentoDetail?.placa}</p>
                </div>
              </div>

              {/* Status do Pátio */}
              <div className="p-5 bg-white border border-slate-100 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-orange-500" />
                    Auditoria de Pátio
                  </h4>
                  <Badge className="bg-slate-100 text-slate-700 font-bold text-[10px] px-2 py-0.5">
                    Fila: {selectedCarregamentoDetail?.posicaoFila ? `${selectedCarregamentoDetail?.posicaoFila}º lugar` : "Não listado"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedCarregamentoDetail?.checklist?.documentosConferidos ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black">Documentação Fiscal</p>
                      <p className="text-[9px] font-semibold opacity-75">
                        {selectedCarregamentoDetail?.checklist?.documentosConferidos ? "Validados & Liberados" : "Pendente de conferência"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedCarregamentoDetail?.checklist?.volumesConferidos ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black">Conferência Física</p>
                      <p className="text-[9px] font-semibold opacity-75">
                        {selectedCarregamentoDetail?.checklist?.volumesConferidos ? "Volumes e lacre batem" : "Divergência / Não iniciado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedCarregamentoDetail?.checklist?.temperaturaConferida ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black">Temperatura Baú</p>
                      <p className="text-[9px] font-semibold opacity-75">
                        {selectedCarregamentoDetail?.checklist?.temperaturaConferida ? "Monitorado: 4°C" : "Não aplicável / Não verificado"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      selectedCarregamentoDetail?.checklist?.semAvarias ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                    }`}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black">Status de Avarias</p>
                      <p className="text-[9px] font-semibold opacity-75">
                        {selectedCarregamentoDetail?.checklist?.semAvarias ? "Sem avarias declaradas" : "Registrado com avarias"}
                      </p>
                    </div>
                  </div>
                </div>

                {selectedCarregamentoDetail?.checklist?.observacoes && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Observações Operacionais</p>
                    <p className="text-xs text-amber-900 mt-1">{selectedCarregamentoDetail?.checklist?.observacoes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Coluna 2: Timeline do Carregamento */}
            <div className="space-y-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-4 h-4 text-orange-500" />
                  Timeline de Pátio
                </h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Registros da programação integrado ao pátio.</p>
              </div>

              <div className="relative pl-5 border-l-2 border-slate-200 space-y-4">
                {(() => {
                  const isAgregado = selectedCarregamentoDetail?.tipo === "agregado";
                  const timelineSteps = isAgregado ? [
                    { label: "Chegada no pátio", done: selectedCarregamentoDetail?.status !== "aguardando_prestador", hora: selectedCarregamentoDetail?.horarioCarregamento },
                    { label: "Entrada na fila", done: selectedCarregamentoDetail?.status !== "aguardando_prestador", hora: selectedCarregamentoDetail?.horarioCarregamento },
                    { label: "Chamado para doca", done: selectedCarregamentoDetail?.status === "carregamento_iniciado" || selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Início do carregamento", done: selectedCarregamentoDetail?.status === "carregamento_iniciado" || selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Conferência de carga", done: selectedCarregamentoDetail?.status === "liberado_para_rota" || (selectedCarregamentoDetail?.status === "carregamento_iniciado" && selectedCarregamentoDetail?.checklist?.volumesConferidos) },
                    { label: "Carregamento finalizado", done: selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Documentos liberados", done: selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Liberado para rota", done: selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Em trânsito", done: false }
                  ] : [
                    { label: "Prestador selecionado", done: true, hora: "19/05/2026 07:00" },
                    { label: "Prestador aceitou", done: true, hora: "19/05/2026 07:15" },
                    { label: "Motorista a caminho", done: true, hora: "19/05/2026 07:30" },
                    { label: "Chegou na origem", done: selectedCarregamentoDetail?.status !== "aguardando_prestador" },
                    { label: "Entrada na fila", done: selectedCarregamentoDetail?.status !== "aguardando_prestador" },
                    { label: "Início do carregamento", done: selectedCarregamentoDetail?.status === "carregamento_iniciado" || selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Conferência de carga", done: selectedCarregamentoDetail?.status === "liberado_para_rota" || (selectedCarregamentoDetail?.status === "carregamento_iniciado" && selectedCarregamentoDetail?.checklist?.volumesConferidos) },
                    { label: "Carregamento finalizado", done: selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Liberado para rota", done: selectedCarregamentoDetail?.status === "liberado_para_rota" },
                    { label: "Em trânsito", done: false }
                  ];

                  return timelineSteps.map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[26px] top-0.5 w-3 h-3 rounded-full border-2 bg-white ${
                        step.done ? "border-slate-800 bg-slate-800" : "border-slate-300"
                      }`} />
                      <div className="flex justify-between items-start text-[11px]">
                        <span className={`font-bold ${step.done ? "text-slate-800" : "text-slate-400"}`}>{step.label}</span>
                        {step.done && step.hora && (
                          <span className="text-[9px] font-semibold text-slate-400 whitespace-nowrap ml-2">
                            {step.hora.split(" ")[1] || "OK"}
                          </span>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 gap-2">
            <Button variant="outline" onClick={() => setShowCarregamentoDetailModal(false)}>
              Fechar Auditoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlocacaoCancelamentoModal
        open={!!cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null); }}
        deleteTarget={cancelTarget ? {
          prestadorNome: cancelTarget.prestadorNome,
          data: cancelTarget.data,
          clienteNome: cancelTarget.clienteNome,
          totals: cancelTarget.totals,
          status: cancelTarget.status,
          temTracking: cancelTarget.status === 'em_rota' || cancelTarget.status === 'aceita',
          temPOD: !!(cancelTarget.fotos_entrega?.length || cancelTarget.comprovanteUrl || cancelTarget.assinaturaUrl),
          temFinanceiro: !!(cancelTarget.valorFrete || cancelTarget.valorRepasse || cancelTarget.metadata?.financeiro_status === 'ok'),
          temOSVinculada: !!(cancelTarget.os || cancelTarget.ordemServicoId || cancelTarget.ordem_servico_id),
        } : null}
        onConfirmarCancelamento={handleCancelarAlocacao}
        cancelando={isCanceling}
      />

      <PODDisplay
        alocacaoId={selectedPodAlocacao || ""}
        open={showPODModal}
        onOpenChange={(open) => { if (!open) { setShowPODModal(false); setSelectedPodAlocacao(null); } }}
      />
    </div>
  );
}



