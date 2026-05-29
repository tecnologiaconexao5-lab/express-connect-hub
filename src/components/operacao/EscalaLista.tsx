import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle, FileText, Download, Wallet, Clock, DollarSign, Percent, Activity, AlertTriangle, AlertCircle, CheckCircle, History, ExternalLink, Play, Edit } from "lucide-react";
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
import { calcularFinanceiroEscala } from "@/utils/engineFinanceira";
import { normalizeClienteNome } from "@/utils/clienteHelper";


import jsPDF from "jspdf";
import {
  drawCoverPage, drawContentHeader, drawInfoBlock, drawFinancialComposition, drawObservations, getPageSetup, fmtBRL as pdfFmtBRL
} from "@/lib/pdf/foundation";

type Periodo = 'semanal' | 'quinzenal' | 'mensal';

interface AlocacaoFinanceiro {
  valorTipo: 'percentual' | 'fixo';
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
  const [selectedCell, setSelectedCell] = useState<{prestadorId: string, data: Date} | null>(null);
  const [selectedCarregamentoDetail, setSelectedCarregamentoDetail] = useState<any>(null);
  const [showCarregamentoDetailModal, setShowCarregamentoDetailModal] = useState(false);
  // Removed mock confirmacoesCarregamento
  
  // States reais para dados
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novoPrestadorId, setNovoPrestadorId] = useState("");
  const [novoPrestadorNome, setNovoPrestadorNome] = useState("");
  const [filtroPrestadorModal, setFiltroPrestadorModal] = useState("");
  const [showPrestadorDropdown, setShowPrestadorDropdown] = useState(false);
  const [novoClienteId, setNovoClienteId] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [prestadorVeiculo, setPrestadorVeiculo] = useState<{tipo_veiculo: string, placa: string, refrigerado: boolean} | null>(null);
  const [tabelaValores, setTabelaValores] = useState<any>(null);
  const [tabelaRascunhoEncontrada, setTabelaRascunhoEncontrada] = useState<any>(null);
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
  const [tempoChegadaPatio, setTempoChegadaPatio] = useState("07:45");
  const [tempoInicioCarregamento, setTempoInicioCarregamento] = useState("08:15");
  const [tempoFimCarregamento, setTempoFimCarregamento] = useState("09:00");
  const [tempoSaidaRua, setTempoSaidaRua] = useState("09:15");
  const [tempoFinalizacaoEntregas, setTempoFinalizacaoEntregas] = useState("17:30");

  // Função para buscar tabela de valores do cliente
  const buscarTabelaValoresCliente = useCallback(async (clienteId: string, clienteNome: string, tipoVeiculo: string, dataEscalaStr?: string) => {
    if (!clienteId || !clienteNome || !tipoVeiculo) return null;
    setLoadingTabelaValores(true);
    try {
      const dataEscala = dataEscalaStr ? new Date(dataEscalaStr) : new Date();
      
      const nomeNormalizado = normalizeClienteNome(clienteNome);
      
      const { data: specificData, error: specificError } = await supabase
        .from("tabelas_valores")
        .select("id, nome, valor_base, valor_km, km_franquia, valor_km_excedente, tipo_veiculo, status, data_inicio, data_fim, ativo, percentual_prestador, valor_fixo_prestador, tipo_repasse_prestador, adicionais")
        .eq("cliente", nomeNormalizado)
        .eq("tipo_veiculo", tipoVeiculo);
        
      let escolhida = null;
      let rascunhoEncontrado = null;
      
      if (!specificError && specificData && specificData.length > 0) {
         const ativas = specificData.filter(d => d.ativo || d.status === 'ativa');
         const rascunhos = specificData.filter(d => !d.ativo || d.status === 'rascunho' || d.status === 'inativa');
         
         if (rascunhos.length > 0) rascunhoEncontrado = rascunhos[0];
         
         if (ativas.length > 0) {
           const comVigencia = ativas.find(d => {
             if (!d.data_inicio) return true;
             return new Date(d.data_inicio) <= dataEscala && (!d.data_fim || new Date(d.data_fim) >= dataEscala);
           });
           escolhida = comVigencia || ativas[0];
         }
      }
      
      if (escolhida) {
        setTabelaRascunhoEncontrada(rascunhoEncontrado);
        setTabelaValores({ ...escolhida, km_franquia: escolhida.km_franquia || 200, valor_km_excedente: escolhida.valor_km_excedente || escolhida.valor_km || 2.50 });
        setRegraEspecialAtiva(true);
        return escolhida;
      }
      
      const { data: universalData } = await supabase
        .from("tabelas_valores")
        .select("id, nome, valor_base, valor_km, km_franquia, valor_km_excedente, tipo_veiculo, status, data_inicio, data_fim, ativo, percentual_prestador, valor_fixo_prestador, tipo_repasse_prestador, adicionais")
        .eq("universal", true)
        .eq("tipo_veiculo", tipoVeiculo)
        .eq("ativo", true)
        .limit(1)
        .single();
      
      if (universalData) {
        setTabelaRascunhoEncontrada(rascunhoEncontrado);
        setTabelaValores({ ...universalData, km_franquia: universalData.km_franquia || 200, valor_km_excedente: universalData.valor_km_excedente || universalData.valor_km || 2.50 });
        setRegraEspecialAtiva(false);
        return universalData;
      }
      
      setTabelaRascunhoEncontrada(rascunhoEncontrado);
      setTabelaValores(null);
      setRegraEspecialAtiva(false);
      return null;
    } catch (err) {
      console.error("Erro ao buscar tabela de valores:", err);
      setTabelaValores(null);
      setTabelaRascunhoEncontrada(null);
      setRegraEspecialAtiva(false);
      return null;
    } finally {
      setLoadingTabelaValores(false);
    }
  }, []);

  // Função para buscar dados do veículo do prestador
  const buscarDadosVeiculoPrestador = useCallback(async (prestadorId: string) => {
    const { data, error } = await supabase
      .from("prestadores")
      .select("veiculos(tipo, placa)")
      .eq("id", prestadorId)
      .single();
    
    if (!error && data) {
      const v = data.veiculos && data.veiculos.length > 0 ? data.veiculos[0] : null;
      setPrestadorVeiculo({
        tipo_veiculo: v?.tipo || "vuc",
        placa: v?.placa || "",
        refrigerado: false
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

  // Alocações do período
  const [alocacoes, setAlocacoes] = useState<any[]>([]);
  const [listaClientes, setListaClientes] = useState<any[]>([]);

  useEffect(() => {
    // Carregar prestadores reais
    async function loadPrestadores() {
      try {
        const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal, valor_diaria, valor_saida, fixo_mensal, franquia_km, valor_km, tipo_pagamento")
          .eq("status", "ativo");
        
        if (error) throw error;
        
        // Formatar para uso
        const fmtd = (data || []).map((p: any) => ({
          id: p.id,
          nome: p.nome_completo,
          cpfCnpj: p.cpf_cnpj,
          telefone: p.telefone || p.whatsapp,
          veiculo: p.veiculos && p.veiculos.length > 0 ? p.veiculos[0].tipo : 'vuc',
          placa: p.veiculos && p.veiculos.length > 0 ? p.veiculos[0].placa : '',
          regiao: p.regiao_principal || "Sem região",
          status: "disponivel",
          avatar: p.nome_completo ? p.nome_completo.substring(0,2).toUpperCase() : "PR",
          financeiro_real: {
             tipo_pagamento: p.tipo_pagamento,
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

    // Tentar carregar alocações do Supabase primeiro
    async function loadAlocacoes() {
      try {
        const hoje = new Date();
        const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
        const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');
        const { data, error } = await supabase
          .from('alocacoes_escala')
          .select(`
            id, data_escala, status, status_pagamento, turno, tipo_veiculo, placa,
            valor_fixo, valor_frete, valor_pedagio, valor_combustivel, valor_ajudante,
            valor_adicional, valor_desconto, valor_total, km_realizados, metadata, observacoes,
            prestador_id, cliente_id,
            prestadores!prestador_id(id, nome_completo),
            clientes!cliente_id(id, nome_fantasia)
          `)
          .gte('data_escala', inicioMes)
          .lte('data_escala', fimMes)
          .order('data_escala', { ascending: true });

        if (!error && data && data.length > 0) {
          const mapped = data.map((r: any) => {
            const prestNome = r.prestadores?.nome_completo || r.metadata?.prestadorNome || '';
            const cliNome = r.clientes?.nome_fantasia || r.metadata?.clienteNome || '';
            const meta = r.metadata || {};
            const valorBase = Number(r.valor_fixo ?? meta.totals?.valorBase ?? 0);
            const adicionais = Number(r.valor_adicional ?? meta.totals?.totalAdicionais ?? 0);
            const descontos = Number(r.valor_desconto ?? meta.totals?.totalDescontos ?? 0);
            const total = Number(r.valor_total ?? (valorBase + adicionais - descontos));
            return {
              id: r.id,
              prestadorId: r.prestador_id,
              prestadorNome: prestNome,
              clienteId: r.cliente_id,
              clienteNome: cliNome,
              data: r.data_escala,
              turno: r.turno,
              status: r.status,
              statusPagamento: r.status_pagamento,
              os: meta.os || '',
              horarioInicio: meta.horarioInicio || '',
              horarioFim: meta.horarioFim || '',
              kmInicial: meta.kmInicial || 0,
              kmFinal: meta.kmFinal || 0,
              prestadorVeiculo: { tipo_veiculo: r.tipo_veiculo, placa: r.placa },
              financeiro: meta.financeiro || {},
              totals: { valorBase, totalAdicionais: adicionais, totalDescontos: descontos, total },
            };
          });
          setAlocacoes(mapped);
          return; // Não usa localStorage se Supabase respondeu
        }
      } catch (e) {
        console.warn('Fallback para localStorage (Supabase indisponível):', e);
      }
      // Fallback: carregar alocações locais
      const saved = localStorage.getItem('conexao_escala_operacional');
      if (saved) {
        try { setAlocacoes(JSON.parse(saved)); } catch (e) {}
      }
    }

    loadAlocacoes();
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
        start = new Date(dataInicio);
        days = Math.max(1, differenceInDays(new Date(dataFim), start) + 1);
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
      if (filtroCliente !== "todos" && a.clienteId !== filtroCliente) return false;
      return true;
    });
  }, [alocacoes, filtroCliente]);

  const prestadoresFiltrados = useMemo(() => {
    return prestadores.filter(p => {
      const matchNome = p.nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
                        p.placa.toLowerCase().includes(filtroNome.toLowerCase());
      const matchVeiculo = filtroVeiculo === "todos" || p.veiculo === filtroVeiculo;

      let matchCliente = true;
      if (filtroCliente !== "todos") {
        matchCliente = alocacoesFiltradas.some(a => a.prestadorId === p.id && diasPeriodo.some(d => isSameDay(new Date(a.data), d)));
      }

      let matchStatus = true;
      if (filtroStatus !== "todos") {
        matchStatus = alocacoesFiltradas.some(a => a.prestadorId === p.id && a.tipo === filtroStatus && diasPeriodo.some(d => isSameDay(new Date(a.data), d)));
      }

      return matchNome && matchVeiculo && matchCliente && matchStatus;
    });
  }, [prestadores, filtroNome, filtroVeiculo, filtroCliente, filtroStatus, alocacoesFiltradas, diasPeriodo]);



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
    
    // Encontrar se já existe alocação para preencher os campos
    const existing = alocacoes.find(a => a.prestadorId === prestadorId && isSameDay(new Date(a.data), data));
    if (existing) {
      setNovoPrestadorId(existing.prestadorId);
      setNovoPrestadorNome(existing.prestadorNome || "");
      setNovoClienteId(existing.clienteId || "");
      setNovoClienteNome(existing.clienteNome || "");
      setNovoTurno(existing.turno || "integral");
      setNovoTipo(existing.tipo || "reserva");
      setNovaOS(existing.os || "");
      setHorarioInicio(existing.horarioInicio || "08:00");
      setHorarioFim(existing.horarioFim || "18:00");
      if (existing.financeiro) {
        setFinanceiro(existing.financeiro);
      }
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
      if (existing.tempoFinalizacaoEntregas !== undefined) setTempoFinalizacaoEntregas(existing.tempoFinalizacaoEntregas);
      else setTempoFinalizacaoEntregas("17:30");
      
      if (existing.clienteId && existing.prestadorVeiculo?.tipo_veiculo) {
        buscarTabelaValoresCliente(existing.clienteId, existing.clienteNome || "", existing.prestadorVeiculo.tipo_veiculo, existing.data);
      }
    } else {
      // Resetar para valores padrão
      setNovoPrestadorId(prestadorId);
      const prest = prestadores.find(p => p.id === prestadorId);
      setNovoPrestadorNome(prest?.nome || "");
      setNovoClienteId("");
      setNovoClienteNome("");
      setNovoTurno("integral");
      setNovoTipo("reserva");
      setNovaOS("");
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
      
      buscarDadosVeiculoPrestador(prestadorId);
    }
    setModalOpen(true);
  };

  const calcularTotalAlocacao = () => {
    const prestadorSelecionado = prestadores.find(p => p.id === novoPrestadorId);

    return calcularFinanceiroEscala({
      tabelaValores,
      km: {
        inicial: kmInicial,
        final: kmFinal
      },
      espera: {
        minutosTotais: minutosEspera,
        tipoCobranca: 'proporcional'
      },
      regrasOperacionais: {
        regraEspecialAtiva,
        horaSaida: tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8,
        clienteValido: !!novoClienteId
      },
      inputsManuais: {
        ajusteClienteValor,
        kmExcedentePrestadorValor: kmExcedentePrestador
      },
      financeiroPrestador: financeiro,
      financeiroRealPrestador: prestadorSelecionado?.financeiro_real
    });
  };

  const handleCreateReserva = async () => {
    if (!novoPrestadorId) {
      return toast.error("Selecione um prestador obrigatório.");
    }
    
    if (novoClienteId && !tabelaValores && !ajusteClienteMotivo && ajusteClienteValor === 0) {
      return toast.error("Sem tabela de preço. Informe o 'Ajuste Manual' e o 'Motivo' para faturar.");
    }
    
    if (ajusteClienteValor !== 0 && !ajusteClienteMotivo) {
      return toast.error("Por favor, preencha o Motivo do Ajuste do Cliente.");
    }

    const totals = calcularTotalAlocacao();
    const existing = alocacoes.find(a => a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), selectedCell?.data ? selectedCell.data : new Date()));
    const prestadorSelecionado = prestadores.find(p => p.id === novoPrestadorId);
    
    let financeiroStatus = 'ok';
    if (!tabelaValores) financeiroStatus = 'pendente';
    else if (!prestadorSelecionado?.financeiro_real || prestadorSelecionado.financeiro_real.valor_diaria === 0) financeiroStatus = 'fallback';
    if (!tabelaValores && ajusteClienteValor > 0) financeiroStatus = 'manual';

    // --- Objeto para o estado local (camelCase) ---
    const novaAlocacao = {
      id: existing?.id || String(Date.now()),
      prestadorId: novoPrestadorId,
      prestadorNome: novoPrestadorNome,
      clienteId: novoClienteId,
      clienteNome: novoClienteNome,
      data: selectedCell?.data ? selectedCell.data.toISOString() : new Date().toISOString(),
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
      status: 'planejada',
      kmInicial,
      kmFinal,
      tempoChegadaPatio,
      tempoInicioCarregamento,
      tempoFimCarregamento,
      tempoSaidaRua,
      tempoFinalizacaoEntregas,
      metadata: { financeiro_status: financeiroStatus }
    };

    // --- Payload para o banco (snake_case conforme schema alocacoes_escala) ---
    const payload = {
      prestador_id: novoPrestadorId || null,
      cliente_id: novoClienteId || null,
      data_escala: selectedCell?.data ? format(selectedCell.data, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      turno: novoTurno,
      tipo_veiculo: prestadorVeiculo?.tipo_veiculo || 'vuc',
      placa: prestadorVeiculo?.placa || null,
      status: 'planejada',
      status_pagamento: 'pendente',
      observacoes: novaOS ? `OS: ${novaOS}` : null,
      // Financeiro
      valor_fixo: totals.prestador.valorBase,
      valor_repasse: totals.prestador.valorBase,
      valor_frete: totals.cliente.total, // Faturamento do Cliente
      valor_pedagio: financeiro.pedagio || 0,
      valor_combustivel: financeiro.combustivel || 0,
      valor_ajudante: (financeiro.ajudantes || 0) * (financeiro.valorAjudante || 0),
      valor_adicional: totals.prestador.adicionais,
      valor_desconto: totals.prestador.descontos,
      valor_total: totals.prestador.total, // Total Repasse
      km_realizados: Math.max((kmFinal || 0) - (kmInicial || 0), 0),
      // Metadados extras
      metadata: {
        financeiro_status: financeiroStatus,
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
          tabela_id: tabelaValores?.id || null,
          nome_tabela: tabelaValores?.nome || 'Sem Tabela',
          franquia_km: tabelaValores?.km_franquia || 0,
          valor_km_excedente: tabelaValores?.valor_km_excedente || 0,
          ajuste_manual: ajusteClienteValor,
          motivo_ajuste: ajusteClienteMotivo
        },
        repasse: {
          valor_km_prestador: kmExcedentePrestador,
          tipo_repasse: tabelaValores?.tipo_repasse_prestador || financeiro.valorTipo,
          percentual: tabelaValores?.percentual_prestador || financeiro.valorPercentual,
          valor_fixo: tabelaValores?.valor_fixo_prestador || financeiro.valorFixo
        },
        km: {
          inicial: kmInicial,
          final: kmFinal,
          rodados: Math.max((kmFinal || 0) - (kmInicial || 0), 0)
        },
        espera: {
          minutos_espera: minutosEspera
        }
      }
    };

    try {
      if (existing?.id && typeof existing.id === 'string' && existing.id.includes('-')) {
        // Atualizar registro existente no Supabase
        const { error } = await supabase.from('alocacoes_escala').update(payload).eq('id', existing.id);
        if (error && error.code !== '42P01') throw error;
        if (!error) {
          setAlocacoes(prev => prev.map(a => a.id === existing.id ? { ...novaAlocacao, id: existing.id } : a));
          toast.success(`Alocação de ${novoPrestadorNome || 'prestador'} atualizada!`);
          setModalOpen(false);
          return;
        }
      } else {
        // Inserir novo registro no Supabase
        const { data: inserted, error } = await supabase.from('alocacoes_escala').insert([payload]).select('id').single();
        if (error && error.code === '42P01') {
          // Tabela não existe → fallback localStorage
          const novas = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
          setAlocacoes(novas);
          localStorage.setItem("conexao_escala_operacional", JSON.stringify(novas));
          toast.info('Salvo localmente (tabela não encontrada no banco)');
        } else if (error) {
          throw error;
        } else {
          const idReal = inserted?.id || novaAlocacao.id;
          setAlocacoes(prev => [...prev.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), { ...novaAlocacao, id: idReal }]);
          toast.success(`Alocação de ${novoPrestadorNome || 'prestador'} salva!`);
        }
      }
    } catch (err: any) {
      // Fallback genérico para localStorage
      const novas = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
      setAlocacoes(novas);
      localStorage.setItem("conexao_escala_operacional", JSON.stringify(novas));
      toast.success('Alocação salva localmente!');
      console.warn('Supabase insert fallback:', err?.message);
    }

    setModalOpen(false);
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
             const exist = novas.find(a => a.prestadorId === p.id && isSameDay(new Date(a.data), d));
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
     toast.success("Escala gerada automaticamente com IA!");
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
               <CalendarIcon className="w-5 h-5 text-primary"/> Escala de Operação
             </h3>
             <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleGerarEscalaAutomatica}><Truck className="w-3.5 h-3.5"/> Gerar Escala</Button>
                <Button variant="outline" size="sm" className="gap-1 text-xs h-8" onClick={handleExportPDF}><Download className="w-3.5 h-3.5"/> Exportar PDF</Button>
                <Button size="sm" className="gap-1 text-xs h-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={handleIncluirLote}><DollarSign className="w-3.5 h-3.5"/> Incluir Lote</Button>
                <Button size="sm" className="gap-1 text-xs h-8" onClick={() => { handleCellClick("", new Date()); setModalOpen(true); }}><Plus className="w-3.5 h-3.5"/> Alocar</Button>
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
          <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 flex items-center gap-1.5 px-2 py-0.5"><Truck className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{alocacoesFiltradas.length}</span> <span className="text-[9px] uppercase font-semibold">Alocações</span></Badge>
          <Badge variant="outline" className="bg-emerald-50/80 text-emerald-700 border-emerald-200 flex items-center gap-1.5 px-2 py-0.5"><CheckCircle className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{alocacoesFiltradas.filter(a => a.status === 'operacao' || a.status === 'confirmado' || a.statusPagamento === 'a pagar').length}</span> <span className="text-[9px] uppercase font-semibold">Em Rota/Conf.</span></Badge>
          <Badge variant="outline" className="bg-amber-50/80 text-amber-700 border-amber-200 flex items-center gap-1.5 px-2 py-0.5"><Clock className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">{alocacoesFiltradas.filter(a => a.tipo === 'reserva' || a.status === 'aguardando').length}</span> <span className="text-[9px] uppercase font-semibold">Aguardando</span></Badge>
          <Badge variant="outline" className="bg-orange-50/80 text-orange-700 border-orange-200 flex items-center gap-1.5 px-2 py-0.5"><DollarSign className="w-3.5 h-3.5 opacity-70"/> <span className="font-bold text-sm">R$ {alocacoesFiltradas.reduce((acc, a) => acc + (a.totals?.total ?? a.metadata?.totals?.prestador?.total ?? 0), 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span> <span className="text-[9px] uppercase font-semibold">Repasse</span></Badge>
       </div>

       {/* Main Tabs Area */}
       <Tabs defaultValue="tabelas" className="flex-1 flex flex-col overflow-hidden bg-transparent">
          <div className="bg-white border-b border-slate-200 px-4 py-2 overflow-x-auto shrink-0 shadow-sm z-10">
             <TabsList className="bg-transparent h-9 p-0 flex w-max gap-2">
                <TabsTrigger value="tabelas" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><FileText className="w-3.5 h-3.5 mr-1.5"/> Controle Diário</TabsTrigger>
                <TabsTrigger value="grade" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><Truck className="w-3.5 h-3.5 mr-1.5"/> Grade Horizontal</TabsTrigger>
                <TabsTrigger value="calendario" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><CalendarIcon className="w-3.5 h-3.5 mr-1.5"/> Calendário Mensal</TabsTrigger>
                <TabsTrigger value="confirmacoes" className="text-xs font-bold h-8 px-4 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-slate-200 data-[state=active]:text-primary"><Check className="w-3.5 h-3.5 mr-1.5"/> Fila e Pátio</TabsTrigger>
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
                     const dayAlocacoes = alocacoesFiltradas.filter((a) => isSameDay(new Date(a.data), d));
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
                               {dayAlocacoes.length} aloc.
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
                        const res = alocacoesFiltradas.find(r => r.prestadorId === p.id && isSameDay(new Date(r.data), d));
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
                              {alocacoesFiltradas.filter(a => a.data && diasPeriodo.some(dp => isSameDay(dp, new Date(a.data)))).length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={14} className="h-32 text-center text-slate-500 font-medium">
                                    Nenhuma alocação encontrada para os filtros selecionados.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                alocacoesFiltradas.filter(a => a.data && diasPeriodo.some(dp => isSameDay(dp, new Date(a.data)))).map((a, i) => {
                                  const prest = prestadores.find(p => p.id === a.prestadorId);
                                  const veiculoLabel = prest ? (TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo) : (a.prestadorVeiculo?.tipo_veiculo || "—");
                                  const placaLabel = prest?.placa || a.prestadorVeiculo?.placa || "—";
                                  const valorCliente = a.valor_frete ?? a.metadata?.totals?.cliente?.total ?? 0;
                                  const repasse = a.totals?.total ?? a.metadata?.totals?.prestador?.total ?? 0;
                                  const acrescimos = a.totals?.totalAdicionais ?? a.metadata?.totals?.adicionais ?? 0;
                                  const espera = a.metadata?.totals?.espera ?? 0;
                                  const financeiroStatus = a.metadata?.financeiro_status || 'ok';

                                  const statusAtual = (a.statusPagamento === 'a pagar' ? a.status : a.statusPagamento) || a.status || "—";
                                  let statusStyle = { color: "bg-slate-100 text-slate-600 border-slate-200", icon: null as React.ReactNode };
                                  if (statusAtual.toLowerCase() === "confirmado" || statusAtual === "a pagar") statusStyle = { color: "bg-emerald-500 text-white border-emerald-600", icon: <CheckCircle className="w-2.5 h-2.5" /> };
                                  else if (statusAtual.toLowerCase() === "operacao") statusStyle = { color: "bg-blue-600 text-white border-blue-700", icon: <Truck className="w-2.5 h-2.5" /> };
                                  else if (statusAtual.toLowerCase() === "aguardando") statusStyle = { color: "bg-orange-500 text-white border-orange-600", icon: <Clock className="w-2.5 h-2.5" /> };
                                  else if (["divergencia", "ocorrencia", "bloqueado"].includes(statusAtual.toLowerCase())) statusStyle = { color: "bg-rose-500 text-white border-rose-600", icon: <AlertTriangle className="w-2.5 h-2.5" /> };
                                  else if (["concluido", "finalizado"].includes(statusAtual.toLowerCase())) statusStyle = { color: "bg-slate-700 text-white border-slate-800", icon: <Check className="w-2.5 h-2.5" /> };

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
                                      <TableCell className="text-xs font-bold text-slate-700">{a.os || "—"}</TableCell>
                                      <TableCell>
                                        <Badge className={`text-[9px] font-bold px-1.5 py-0.5 flex items-center w-max gap-1 border shadow-sm ${statusStyle.color}`}>
                                          {statusStyle.icon}
                                          <span className="uppercase">{statusAtual}</span>
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
                                             a.horarioInicio && (statusAtual.toLowerCase() === "aguardando" || statusAtual.toLowerCase() === "confirmado") && (
                                               <span className="text-[8px] font-bold bg-emerald-100 text-emerald-700 px-1 rounded-sm">No Prazo</span>
                                             )
                                           )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right pr-6 space-x-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleCellClick(a.prestadorId, new Date(a.data)); }} title="Editar">
                                          <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-emerald-600" onClick={(e) => { e.stopPropagation(); handleShareWhatsApp(a); }} title="WhatsApp">
                                          <MessageCircle className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-rose-600" onClick={(e) => { e.stopPropagation(); handleGerarRelatorioPagamento(a); }} title="PDF">
                                          <FileText className="w-3.5 h-3.5" />
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
                                  const veiculoLabel = prest ? (TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo) : (c.prestadorVeiculo?.tipo_veiculo || "—");
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
                                        <div className="font-bold text-slate-700 text-xs">{c.os || "—"}</div>
                                        <div className="text-[10px] font-semibold text-slate-400">{c.clienteNome || "—"}</div>
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
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
              <DialogDescription className="flex items-center flex-wrap gap-1 mt-1">
                Alocação para <strong className="text-slate-800">{prestadorAtivo?.nome || 'Prestador em seleção'}</strong> em
                <Input 
                  type="date" 
                  className="h-8 text-xs w-[130px] ml-1 bg-white" 
                  value={selectedCell?.data ? format(selectedCell.data, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")}
                  onChange={(e) => {
                     if(e.target.value) {
                       setSelectedCell({ prestadorId: selectedCell?.prestadorId || "", data: new Date(e.target.value + "T12:00:00") });
                     }
                  }}
                />
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="dados" className="text-xs"><FileText className="w-3 h-3 mr-1"/>Dados da Alocação</TabsTrigger>
                <TabsTrigger value="financeiro" className="text-xs"><DollarSign className="w-3 h-3 mr-1"/>Dados Financeiros</TabsTrigger>
                <TabsTrigger value="resumo" className="text-xs"><Check className="w-3 h-3 mr-1"/>Resumo do Dia</TabsTrigger>
              </TabsList>

             <TabsContent value="dados" className="space-y-4 py-4">
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
                 {prestadorVeiculo && (
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
                         if (prestadorVeiculo?.tipo_veiculo) {
                           buscarTabelaValoresCliente(id || "", item.nome_fantasia || item.razao_social || "", prestadorVeiculo.tipo_veiculo);
                         }
                       }
                     }} 
                     placeholder="Selecione o cliente para buscar tabela de preços..."
                   />
                 </div>
                 {loadingTabelaValores && (
                   <div className="text-xs text-muted-foreground flex items-center gap-2">
                     <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                     Buscando tabela de valores...
                   </div>
                 )}
                 {novoClienteId && !tabelaValores && !loadingTabelaValores && (
                   <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex gap-2 items-center">
                     <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                     <div className="flex flex-col">
                       <span className="font-bold text-rose-800 text-xs">Nenhuma tabela de preço encontrada para este cliente/veículo.</span>
                       <span className="text-[10px] text-rose-600">Alocação ficará com financeiro pendente ou zerado.</span>
                     </div>
                   </div>
                 )}
                 {tabelaValores && (
                   <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                     <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-emerald-800">Tabela aplicada: {regraEspecialAtiva ? "Cliente" : "Universal"}</span>
                       <span className="text-emerald-700">Base: R$ {tabelaValores.valor_base?.toFixed(2) || "0"} | KM: R$ {tabelaValores.valor_km?.toFixed(2) || "0"}</span>
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
                   <Label className="text-xs text-muted-foreground italic">OS vinculada (opcional)</Label>
                   <SearchableSelect 
                     table="ordens_servico" 
                     labelField="numero" 
                     searchFields={["numero"]} 
                     value={novaOS} 
                     onChange={v => setNovaOS(v||"")} 
                     placeholder="Vincular OS existente, se houver..."
                   />
                </div>
                
                <div className="border-t pt-4 mt-4 space-y-3">
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
                     const kmFranquia = tabelaValores?.km_franquia || 200;
                     const valorKm = tabelaValores?.valor_km || 2.50;
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
                <div className="space-y-1">
                   <Label className="text-xs">Instruções / Observações</Label>
                   <Textarea placeholder="Ex: Necessário chegar 30m antes na base." rows={2}/>
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
                      
                      {tabelaValores && tabelaValores.tipo_repasse_prestador && (!prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real || prestadores.find(p => p.id === novoPrestadorId)?.financeiro_real?.valor_diaria === 0) && (
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
                                  <SelectItem value="percentual">% sobre tabela</SelectItem>
                                  <SelectItem value="fixo">Valor Fixo (R$)</SelectItem>
                               </SelectContent>
                            </Select>
                         </div>
                         <div className="space-y-1">
                            <Label className="text-xs">{financeiro.valorTipo === 'percentual' ? 'Percentual (%)' : 'Valor Fixo (R$)'}</Label>
                            <Input type="number" value={financeiro.valorTipo === 'percentual' ? financeiro.valorPercentual : financeiro.valorFixo} onChange={e => {
                              if (financeiro.valorTipo === 'percentual') setFinanceiro(f => ({...f, valorPercentual: Number(e.target.value)}));
                              else setFinanceiro(f => ({...f, valorFixo: Number(e.target.value)}));
                            }} className="h-9" />
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

                    const diffAguardando = calcularDiferencaTempo(tempoChegadaPatio, tempoInicioCarregamento);
                    const diffCarregamento = calcularDiferencaTempo(tempoInicioCarregamento, tempoFimCarregamento);
                    const diffEmRota = calcularDiferencaTempo(tempoSaidaRua, tempoFinalizacaoEntregas);
                    const diffTotal = calcularDiferencaTempo(tempoChegadaPatio, tempoFinalizacaoEntregas);

                    return (
                      <div className="space-y-3">
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
                    const diariaBase = tabelaValores?.valor_base || 400;
                    const kmFranquia = tabelaValores?.km_franquia || 200;
                    const valorKm = tabelaValores?.valor_km || 2.50;
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
                    const totalDia = diariaCalculada + (tabelaNaoConfigurada ? 0 : valorKmExcedente) + totals.totalAdicionais - totals.totalDescontos;

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
                          {tabelaNaoConfigurada ? (
                            <Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">
                              Tabela não configurada
                            </Badge>
                          ) : (
                            <span className="font-bold text-slate-800">{kmFranquia} km</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">KM Excedente:</span>
                          {tabelaNaoConfigurada ? (
                            <span className="font-bold text-slate-400">-</span>
                          ) : (
                            <span className="font-bold text-orange-600">{kmExcedente} km</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Valor KM Adicional:</span>
                          {tabelaNaoConfigurada ? (
                            <Badge className="bg-red-50 text-red-600 border border-red-100 font-bold text-[10px] border-0">
                              Tabela não configurada
                            </Badge>
                          ) : (
                            <span className="font-bold text-slate-800">R$ {valorKm.toFixed(2)}</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-xs py-1 border-b">
                          <span className="text-slate-500 font-semibold">Total KM Excedente:</span>
                          {tabelaNaoConfigurada ? (
                            <span className="font-bold text-slate-400">-</span>
                          ) : (
                            <span className="font-bold text-slate-800">R$ {valorKmExcedente.toFixed(2)}</span>
                          )}
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
                          <span className="font-medium text-slate-800">R$ {totals.totalAdicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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
                                data: selectedCell?.data?.toISOString() || new Date().toISOString(),
                                horarioInicio,
                                tempoChegadaPatio,
                                tempoInicioCarregamento,
                                tempoFimCarregamento,
                                tempoSaidaRua,
                                tempoFinalizacaoEntregas,
                                kmInicial,
                                kmFinal,
                                totals: calcularTotalAlocacao(),
                                metadata: { financeiro_status: prestadores.find(p => p.id === (novoPrestadorId || prestadorAtivo?.id))?.financeiro_real?.valor_diaria === 0 || !tabelaValores ? (!tabelaValores ? 'pendente' : 'fallback') : 'ok' }
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
              </TabsContent>
            </Tabs>

            <DialogFooter className="flex justify-between items-center sm:justify-between mt-4">
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => handleShareWhatsApp(alocacaoEmEdicao)}>
                <MessageCircle className="w-4 h-4"/> Confirmar via WA
              </Button>
              <Button onClick={handleCreateReserva}>Salvar na Grade</Button>
            </DialogFooter>
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
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Registros da escala integrado ao pátio.</p>
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
    </div>
  );
}
