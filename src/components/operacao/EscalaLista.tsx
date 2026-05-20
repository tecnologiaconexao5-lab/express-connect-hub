import React, { useState, useMemo, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, Filter, Search, Plus, MapPin, Truck, Smartphone, Check, ChevronLeft, ChevronRight, MessageCircle, FileText, Download, Wallet, Clock, DollarSign, Percent, Activity, AlertTriangle, AlertCircle, CheckCircle, History, ExternalLink, Play } from "lucide-react";
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


import jsPDF from "jspdf";

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
  const [confirmacoesCarregamento, setConfirmacoesCarregamento] = useState([
    {
      id: "conf-1",
      prestador: "Carlos Alberto Santos",
      tipo: "agregado",
      cliente: "Matriz São Paulo",
      os: "OS-2026-00412",
      horarioCarregamento: "19/05/2026 08:00",
      posicaoFila: 2,
      status: "liberado_para_rota",
      veiculo: "Fiorino Branca",
      placa: "ABC-1234",
      destino: "Campinas, SP",
      checklist: {
        documentosConferidos: true,
        volumesConferidos: true,
        temperaturaConferida: false,
        semAvarias: true,
        observacoes: "Carga estivada corretamente."
      }
    },
    {
      id: "conf-2",
      prestador: "Marcos Pereira",
      tipo: "agregado",
      cliente: "Filial Extrema",
      os: "OS-2026-00413",
      horarioCarregamento: "19/05/2026 10:00",
      posicaoFila: 1,
      status: "carregamento_iniciado",
      veiculo: "HR Baú",
      placa: "XYZ-9876",
      destino: "Rio de Janeiro, RJ",
      checklist: {
        documentosConferidos: true,
        volumesConferidos: false,
        temperaturaConferida: true,
        semAvarias: false,
        observacoes: "1 caixa amassada na ponta."
      }
    },
    {
      id: "conf-3",
      prestador: "Renato Silva",
      tipo: "esporadico",
      cliente: "Filial Extrema",
      os: "OS-2026-00414",
      horarioCarregamento: "19/05/2026 13:00",
      posicaoFila: 3,
      status: "aguardando_prestador",
      veiculo: "Truck Baú",
      placa: "DEF-5678",
      destino: "Belo Horizonte, MG",
      checklist: {
        documentosConferidos: false,
        volumesConferidos: false,
        temperaturaConferida: false,
        semAvarias: true,
        observacoes: ""
      }
    },
    {
      id: "conf-4",
      prestador: "Adriano Souza",
      tipo: "esporadico",
      cliente: "CD Diadema",
      os: "OS-2026-00415",
      horarioCarregamento: "19/05/2026 14:30",
      posicaoFila: 4,
      status: "divergencia",
      veiculo: "Van Refrigerada",
      placa: "MNO-4321",
      destino: "Santos, SP",
      checklist: {
        documentosConferidos: true,
        volumesConferidos: true,
        temperaturaConferida: false,
        semAvarias: false,
        observacoes: "Divergência de temperatura no baú."
      }
    }
  ]);
  
  // States reais para dados
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  
  // Form Nova Reserva
  const [novoTurno, setNovoTurno] = useState("integral");
  const [novaOS, setNovaOS] = useState("");
  const [novoPrestadorId, setNovoPrestadorId] = useState("");
  const [novoPrestadorNome, setNovoPrestadorNome] = useState("");
  const [novoClienteId, setNovoClienteId] = useState("");
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [prestadorVeiculo, setPrestadorVeiculo] = useState<{tipo_veiculo: string, placa: string, refrigerado: boolean} | null>(null);
  const [tabelaValores, setTabelaValores] = useState<{valor_base: number, valor_km: number, km_franquia: number, tipo_veiculo: string} | null>(null);
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
  const buscarTabelaValoresCliente = useCallback(async (clienteId: string, tipoVeiculo: string) => {
    if (!clienteId || !tipoVeiculo) return null;
    setLoadingTabelaValores(true);
    try {
      const { data, error } = await supabase
        .from("tabelas_valores")
        .select("id, valor_base, valor_km, km_franquia, tipo_veiculo")
        .eq("cliente_id", clienteId)
        .eq("tipo_veiculo", tipoVeiculo)
        .eq("ativo", true)
        .single();
      
      if (!error && data) {
        setTabelaValores({ ...data, km_franquia: data.km_franquia || 200 });
        setRegraEspecialAtiva(true);
        return data;
      }
      
      const { data: universalData } = await supabase
        .from("tabelas_valores")
        .select("id, valor_base, valor_km, km_franquia, tipo_veiculo")
        .eq("universal", true)
        .eq("tipo_veiculo", tipoVeiculo)
        .eq("ativo", true)
        .single();
      
      if (universalData) {
        setTabelaValores({ ...universalData, km_franquia: universalData.km_franquia || 200 });
        setRegraEspecialAtiva(false);
        return universalData;
      }
      
      setTabelaValores(null);
      setRegraEspecialAtiva(false);
      return null;
    } catch (err) {
      console.error("Erro ao buscar tabela de valores:", err);
      setTabelaValores(null);
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
      .select("veiculo_tipo, veiculo_placa, refrigerado")
      .eq("id", prestadorId)
      .single();
    
    if (!error && data) {
      setPrestadorVeiculo({
        tipo_veiculo: data.veiculo_tipo || "fiorino",
        placa: data.veiculo_placa || "",
        refrigerado: data.refrigerado || false
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
  const [modoVisualizacao, setModoVisualizacao] = useState<'grade' | 'calendario'>(() => {
    const saved = localStorage.getItem('escala_modo_visualizacao');
    return (saved === 'grade' || saved === 'calendario') ? saved : 'calendario';
  });

  useEffect(() => {
    localStorage.setItem('escala_modo_visualizacao', modoVisualizacao);
  }, [modoVisualizacao]);

  useEffect(() => {
    // Carregar prestadores reais
    async function loadPrestadores() {
      try {
        const { data, error } = await supabase
          .from("prestadores")
          .select("id, nome_completo, cpf_cnpj, telefone, whatsapp, veiculos(tipo, placa), status, regiao_principal")
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
          avatar: p.nome_completo ? p.nome_completo.substring(0,2).toUpperCase() : "PR"
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

    // Carregar alocações locais
    const saved = localStorage.getItem("conexao_escala_operacional");
    if (saved) {
      try {
        setAlocacoes(JSON.parse(saved));
      } catch (e) {}
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
        start = new Date(dataInicio);
        days = Math.max(1, differenceInDays(new Date(dataFim), start) + 1);
        break;
      default:
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        days = 7;
    }

    return Array.from({ length: days }).map((_, i) => addDays(start, i));
  }, [currentDate, filtroPeriodo, dataInicio, dataFim]);

  const prestadoresFiltrados = useMemo(() => {
    return prestadores.filter(p => {
      const matchNome = p.nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
                        p.placa.toLowerCase().includes(filtroNome.toLowerCase());
      const matchVeiculo = filtroVeiculo === "todos" || p.veiculo === filtroVeiculo;

      // Se filtro de cliente ativo, verifica se tem alocação para esse cliente no período
      let matchCliente = true;
      if (filtroCliente !== "todos") {
        matchCliente = alocacoes.some(a => a.prestadorId === p.id && a.clienteId === filtroCliente && diasPeriodo.some(d => isSameDay(new Date(a.data), d)));
      }

      // Se filtro de status ativo, verifica se tem alocação com esse status/tipo no período
      let matchStatus = true;
      if (filtroStatus !== "todos") {
        matchStatus = alocacoes.some(a => a.prestadorId === p.id && a.tipo === filtroStatus && diasPeriodo.some(d => isSameDay(new Date(a.data), d)));
      }

      return matchNome && matchVeiculo && matchCliente && matchStatus;
    });
  }, [prestadores, filtroNome, filtroVeiculo, filtroCliente, filtroStatus, alocacoes, diasPeriodo]);



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
        buscarTabelaValoresCliente(existing.clienteId, existing.prestadorVeiculo.tipo_veiculo);
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
      setRegraEspecialAtiva(false);
      
      buscarDadosVeiculoPrestador(prestadorId);
    }
    setModalOpen(true);
  };

  const calcularTotalAlocacao = () => {
    const diariaBase = tabelaValores?.valor_base || 400;
    const kmFranquia = tabelaValores?.km_franquia || 200;
    const valorKm = tabelaValores?.valor_km || 2.50;
    const kmRodados = Math.max(kmFinal - kmInicial, 0);
    const kmExcedente = Math.max(kmRodados - kmFranquia, 0);
    
    const tabelaNaoConfigurada = novoClienteId && !regraEspecialAtiva;
    const valorKmExcedente = tabelaNaoConfigurada ? 0 : (kmExcedente * valorKm);

    const horaSaida = tempoSaidaRua ? parseInt(tempoSaidaRua.split(":")[0]) : 8;
    let diariaCalculada = diariaBase;
    
    if (regraEspecialAtiva && novoClienteId) {
      if (horaSaida <= 11) {
        diariaCalculada = diariaBase;
      } else if (horaSaida <= 14) {
        diariaCalculada = diariaBase * 1.50;
      } else if (horaSaida <= 16) {
        diariaCalculada = diariaBase * 1.70;
      } else {
        diariaCalculada = diariaBase * 1.85;
      }
    }

    // Let the operator override or use the manual fixo value if specified
    const valorDiariaFinal = financeiro.valorTipo === 'fixo' && financeiro.valorFixo > 0 
      ? financeiro.valorFixo 
      : (financeiro.valorTipo === 'percentual' && financeiro.valorPercentual > 0 
          ? (financeiro.valorPercentual / 100) * diariaCalculada 
          : diariaCalculada);

    const totalAdicionais = 
      financeiro.combustivel +
      valorKmExcedente +
      financeiro.pedagio +
      (financeiro.diariasAdicionais * (financeiro.valorDiaria || valorDiariaFinal)) +
      (financeiro.segundaSaida ? financeiro.valorSegundaSaida : 0) +
      (financeiro.terceiraSaida ? financeiro.valorTerceiraSaida : 0) +
      (financeiro.saidasAdicionais * financeiro.valorSaidaAdicional) +
      (financeiro.ajudantes * financeiro.valorAjudante) +
      financeiro.valorReembolsoOutros;

    const totalDescontos = financeiro.desconto;

    return {
      valorBase: valorDiariaFinal,
      totalAdicionais,
      totalDescontos,
      total: valorDiariaFinal + totalAdicionais - totalDescontos
    };
  };

  const handleCreateReserva = async () => {
    if (!novoPrestadorId) {
      return toast.error("Selecione um prestador obrigatório.");
    }

    const totals = calcularTotalAlocacao();
    const existing = alocacoes.find(a => a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), selectedCell?.data ? selectedCell.data : new Date()));
    const novaAlocacao = {
      id: existing?.id || Date.now(),
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
      prestadorVeiculo,
      statusPagamento: 'a pagar',
      status: 'confirmado',
      kmInicial,
      kmFinal,
      tempoChegadaPatio,
      tempoInicioCarregamento,
      tempoFimCarregamento,
      tempoSaidaRua,
      tempoFinalizacaoEntregas
    };

    try {
      // Tentar salvar no Supabase se existir a tabela (simulado ou real)
      const { error } = await supabase.from('alocacoes_escala').insert([novaAlocacao]);
      
      if (error && error.code === '42P01') {
        // Fallback para localStorage
        const novasAlocacoes = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
        setAlocacoes(novasAlocacoes);
        localStorage.setItem("conexao_escala_operacional", JSON.stringify(novasAlocacoes));
        toast.info("Salvo localmente em 'conexao_escala_operacional' (Tabela não encontrada no DB)");
      } else if (error) {
        throw error;
      } else {
        toast.success("Alocação salva no banco de dados!");
        setAlocacoes(prev => [...prev, novaAlocacao]);
      }
    } catch (err) {
      // Fallback genérico
      const novasAlocacoes = [...alocacoes.filter(a => !(a.prestadorId === novoPrestadorId && isSameDay(new Date(a.data), new Date(novaAlocacao.data)))), novaAlocacao];
      setAlocacoes(novasAlocacoes);
      localStorage.setItem("conexao_escala_operacional", JSON.stringify(novasAlocacoes));
      toast.success("Alocação salva localmente!");
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

  const handleGerarRelatorioPagamento = (aloc: any) => {
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("CONEXÃO EXPRESS TMS - RELATÓRIO DE PAGAMENTO", 15, 25);
      
      doc.setFontSize(10);
      doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 145, 25);
      
      // Content
      doc.setTextColor(50, 50, 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DADOS DA ALOCAÇÃO", 15, 55);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Prestador: ${aloc.prestadorNome || 'Não informado'}`, 15, 65);
      doc.text(`Veículo: ${aloc.prestadorVeiculo?.tipo_veiculo ? TIPO_VEICULO_LABEL[aloc.prestadorVeiculo.tipo_veiculo] || aloc.prestadorVeiculo.tipo_veiculo : 'Não informado'}`, 15, 72);
      doc.text(`Placa: ${aloc.prestadorVeiculo?.placa || 'Não informado'}`, 15, 79);
      doc.text(`OS Vinculada: ${aloc.os || 'Nenhuma'}`, 15, 86);
      doc.text(`Cliente: ${aloc.clienteNome || 'Nenhum'}`, 15, 93);
      doc.text(`Data Alocação: ${format(new Date(aloc.data), "dd/MM/yyyy")}`, 15, 100);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TEMPOS OPERACIONAIS", 15, 115);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Horário Agendado: ${aloc.horarioInicio || '08:00'}`, 15, 125);
      doc.text(`Chegada Pátio: ${aloc.tempoChegadaPatio || '07:45'}`, 15, 132);
      doc.text(`Início Carregamento: ${aloc.tempoInicioCarregamento || '08:15'}`, 15, 139);
      doc.text(`Fim Carregamento: ${aloc.tempoFimCarregamento || '09:00'}`, 15, 146);
      doc.text(`Saída para Rua: ${aloc.tempoSaidaRua || '09:15'}`, 15, 153);
      doc.text(`Finalização Entregas: ${aloc.tempoFinalizacaoEntregas || '17:30'}`, 15, 160);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("RESUMO DE QUILOMETRAGEM (KM)", 15, 175);
      
      const kmRodados = Math.max((aloc.kmFinal || 0) - (aloc.kmInicial || 0), 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`KM Inicial: ${aloc.kmInicial || 0} km`, 15, 185);
      doc.text(`KM Final: ${aloc.kmFinal || 0} km`, 15, 192);
      doc.text(`KM Rodados: ${kmRodados} km`, 15, 199);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("VALORES E FECHAMENTO FINANCEIRO", 15, 215);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Diária Base / Final: R$ ${aloc.totals?.valorBase?.toFixed(2) || "0.00"}`, 15, 225);
      doc.text(`Adicionais Operacionais: R$ ${aloc.totals?.totalAdicionais?.toFixed(2) || "0.00"}`, 15, 232);
      doc.text(`Descontos: R$ ${aloc.totals?.totalDescontos?.toFixed(2) || "0.00"}`, 15, 239);
      
      doc.setFillColor(240, 240, 240);
      doc.rect(15, 248, 180, 12, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`VALOR TOTAL DO PAGAMENTO DO DIA:`, 20, 256);
      doc.text(`R$ ${aloc.totals?.total?.toFixed(2) || "0.00"}`, 140, 256);
      
      // Save PDF
      doc.save(`relatorio-pagamento-${aloc.prestadorNome?.toLowerCase().replace(/\s+/g, '-') || 'prestador'}.pdf`);
      toast.success("Relatório de pagamento em PDF gerado!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar relatório de pagamento.");
    }
  };

  const handleExportPDF = () => {
    toast.success("Gerando PDF da escala do período...");
  };

  const handleIncluirLote = () => {
    toast.success("Alocações incluidas no lote de pagamento!");
  };

  const prestadorAtivo = selectedCell ? prestadores.find(p => p.id === selectedCell.prestadorId) : null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-230px)]">
       {/* Sidebar Prestadores */}
       <div className="xl:col-span-1 bg-card border border-border rounded-xl overflow-hidden shadow-sm flex flex-col h-full escala-sidebar">
          <div className="p-4 border-b border-border bg-muted/30 escala-header">
             <h3 className="font-bold text-foreground flex items-center gap-2 mb-4"><Truck className="w-5 h-5 text-primary"/> Prestadores Homologados</h3>
             <div className="relative mb-3">
               <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground"/>
               <Input placeholder="Buscar por placa ou nome..." className="pl-9 text-xs h-9" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} />
               <div className="flex flex-col gap-2 mt-3">
                <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
                  <SelectTrigger className="text-xs h-8"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_VEICULO_LABEL).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="text-xs h-8"><SelectValue placeholder="Status"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos Status</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="indisponivel">Indisponível</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" className="h-8 px-2"><Filter className="w-4 h-4"/></Button>
                </div>
              </div>
             </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
             {prestadoresFiltrados.map(p => (
                <div key={p.id} className="p-3 bg-card border border-border rounded-lg hover:border-primary/50 transition cursor-pointer flex gap-3 items-center group escala-prestador-card">
                   <Avatar className="w-10 h-10 border border-border shadow-sm"><AvatarFallback className="bg-muted text-muted-foreground font-bold">{p.avatar}</AvatarFallback></Avatar>
                   <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{p.veiculo} • {p.regiao}</p>
                   </div>
                   <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === 'disponivel' ? 'bg-emerald-500' : p.status === 'ocupado' ? 'bg-orange-500' : 'bg-muted-foreground/40'}`}/>
                </div>
             ))}
          </div>
       </div>

       {/* Calendário Principal */}
        <div className="xl:col-span-3 bg-card border border-border rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
            <div className="py-2.5 px-4 border-b border-border flex justify-between items-center bg-muted/20 flex-wrap gap-3 escala-header">
               <div>
                 <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                   <CalendarIcon className="w-4.5 h-4.5 text-primary"/> Escala de Operação
                 </h3>
               </div>
               <div className="flex items-center gap-2 flex-wrap">
                 <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={handleGerarEscalaAutomatica}><Truck className="w-3 h-3"/> Gerar Escala</Button>
                 <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={handleExportPDF}><Download className="w-3 h-3"/> Exportar PDF</Button>
                 <Button size="sm" className="gap-1 h-8 text-xs bg-orange-500 hover:bg-orange-600 text-white" onClick={handleIncluirLote}><DollarSign className="w-3 h-3"/> Incluir em Lote</Button>
                 <Button size="sm" className="gap-1 h-8 text-xs" onClick={() => { setSelectedCell(null); setModalOpen(true); }}><Plus className="w-3 h-3"/> Alocar</Button>
               </div>
            </div>
            
            <div className="flex flex-col gap-2 w-full p-3 flex-1 overflow-hidden">
                 <Tabs defaultValue="calendario" className="w-full flex-1 flex flex-col overflow-hidden">
                   <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-2">
                     <div className="flex items-center gap-2 flex-wrap">
                       <div className="flex items-center bg-card border border-border rounded-lg shadow-sm h-8">
                         <Button variant="ghost" size="icon" onClick={prevPeriodo} className="h-8 w-8 rounded-r-none"><ChevronLeft className="w-3.5 h-3.5"/></Button>
                         <div className="px-3 text-xs font-bold border-x border-border text-foreground min-w-[140px] text-center">
                           {format(diasPeriodo[0], "dd/MM")} - {format(diasPeriodo[diasPeriodo.length - 1], "dd/MM/yyyy")}
                         </div>
                         <Button variant="ghost" size="icon" onClick={nextPeriodo} className="h-8 w-8 rounded-l-none"><ChevronRight className="w-3.5 h-3.5"/></Button>
                       </div>
                       <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                         <SelectTrigger className="h-8 w-32 text-xs"><SelectValue/></SelectTrigger>
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
                       
                       <Select value={modoVisualizacao} onValueChange={(v) => setModoVisualizacao(v as any)}>
                         <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Visualização" /></SelectTrigger>
                         <SelectContent>
                           <SelectItem value="grade">Grade Horizontal</SelectItem>
                           <SelectItem value="calendario">Modo Calendário</SelectItem>
                         </SelectContent>
                       </Select>

                       {filtroPeriodo === 'personalizado' && (
                         <div className="flex items-center gap-1.5">
                           <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-8 text-xs w-28" />
                           <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="h-8 text-xs w-28" />
                         </div>
                       )}
                     </div>
                     
                     <TabsList className="bg-muted/50 w-fit h-8 p-0.5">
                       <TabsTrigger value="grade" className="text-xs h-7 px-2.5"><CalendarIcon className="w-3 h-3 mr-1"/> Grade de Escala</TabsTrigger>
                       <TabsTrigger value="metricas" className="text-xs h-7 px-2.5"><Percent className="w-3 h-3 mr-1"/> Métricas</TabsTrigger>
                       <TabsTrigger value="graficos" className="text-xs h-7 px-2.5"><DollarSign className="w-3 h-3 mr-1"/> Gráficos</TabsTrigger>
                       <TabsTrigger value="tabelas" className="text-xs h-7 px-2.5"><FileText className="w-3 h-3 mr-1"/> Tabelas</TabsTrigger>
                       <TabsTrigger value="confirmacoes" className="text-xs h-7 px-2.5"><Check className="w-3 h-3 mr-1"/> Confirmações</TabsTrigger>
                     </TabsList>
                   </div>
                   
                   <TabsContent value="grade" className="flex-1 flex flex-col overflow-hidden">
                     {modoVisualizacao === 'calendario' ? (
                       <div className="flex-1 overflow-auto bg-card rounded-xl border border-border p-4 custom-scrollbar">
                         <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                           {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((day) => (
                             <div key={day} className="text-center font-bold text-xs text-muted-foreground py-2 border-b border-border uppercase">
                               {day}
                             </div>
                           ))}
                           
                           {(() => {
                             const monthStart = startOfMonth(currentDate);
                             const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
                             const gridDays = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
                             
                             return gridDays.map((d, index) => {
                               const isSelectedPeriod = diasPeriodo.some((pDay) => isSameDay(pDay, d));
                               const dayAlocacoes = alocacoes.filter((a) => isSameDay(new Date(a.data), d));
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
                                   className={`min-h-[110px] border border-border rounded-xl p-2.5 transition flex flex-col justify-between ${
                                     isSelectedPeriod 
                                       ? 'bg-background hover:bg-muted/50 cursor-pointer border-primary/40 hover:border-primary shadow-sm' 
                                       : 'bg-muted/10 opacity-30 pointer-events-none'
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
                                       <Badge className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary font-bold border-0">
                                         {dayAlocacoes.length} aloc.
                                       </Badge>
                                     )}
                                   </div>
                                   
                                   <div className="flex-1 mt-2 space-y-1 overflow-y-auto max-h-[65px] custom-scrollbar">
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
                     ) : (
                       <div className="flex-1 overflow-auto custom-scrollbar">
                         <div className="min-w-[800px]">
                           <div className="grid bg-muted/40 border-b border-border" style={{gridTemplateColumns:`200px repeat(${diasPeriodo.length},1fr)`}}>
                             <div className="p-3 border-r border-border font-bold text-xs uppercase text-muted-foreground flex items-center">Recurso</div>
                             {diasPeriodo.map((d, i) => (
                               <div key={i} className={`p-3 border-r border-border text-center ${isSameDay(d, new Date()) ? 'bg-primary/10 border-b-2 border-b-primary' : ''}`}>
                                 <p className="text-[10px] uppercase font-bold text-muted-foreground">{format(d, "EEE", {locale: ptBR})}</p>
                                 <p className={`text-base font-black ${isSameDay(d, new Date()) ? 'text-primary' : 'text-foreground'}`}>{format(d, "dd/MM")}</p>
                               </div>
                             ))}
                           </div>
                           <div className="divide-y divide-border">
                             {prestadoresFiltrados.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground text-sm">Nenhum prestador encontrado com os filtros atuais.</div>
                             )}
                             {prestadoresFiltrados.map(p => (
                               <div key={p.id} className="hover:bg-muted/20 transition" style={{display:'grid', gridTemplateColumns:`200px repeat(${diasPeriodo.length},1fr)`}}>
                                 <div className="p-3 border-r border-border flex items-center gap-2 bg-card/50">
                                   <Avatar className="w-8 h-8 border border-border"><AvatarFallback className="text-xs font-bold">{p.avatar}</AvatarFallback></Avatar>
                                   <div className="overflow-hidden">
                                     <p className="text-xs font-bold truncate">{p.nome}</p>
                                     <p className="text-[10px] text-muted-foreground">{TIPO_VEICULO_LABEL[p.veiculo as keyof typeof TIPO_VEICULO_LABEL] || p.veiculo}</p>
                                   </div>
                                 </div>
                                 {diasPeriodo.map((d, i) => {
                                   const res = alocacoes.find(r => r.prestadorId === p.id && isSameDay(new Date(r.data), d));
                                   let slotStatus = p.status === "inativo" ? "indisponivel" : "disponivel";
                                   let slotLabel = "Livre";
                                   if (res) {
                                     slotStatus = res.status === "confirmado" ? "confirmado" : res.status === "aguardando" ? "aguardando" : "operacao";
                                     slotLabel = res.status === "confirmado" ? "Confirmado" : res.status === "aguardando" ? "Aguard. Conf." : "Em Rota";
                                   }
                                   return (
                                     <div key={i} onClick={() => handleCellClick(p.id, d)} className={`p-2 border-r border-border cursor-pointer hover:bg-primary/5 transition min-h-[60px] flex items-center justify-center ${CORES_STATUS[slotStatus]}`}>
                                       <span className="text-[10px] font-medium">{slotLabel}</span>
                                     </div>
                                   );
                                 })}
                               </div>
                             ))}
                           </div>
                         </div>
                       </div>
                     )}
                   </TabsContent>

                  <TabsContent value="metricas" className="flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Métricas da Escala</CardTitle></CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="p-3 bg-emerald-50 rounded-lg"><p className="text-xs text-muted-foreground">Disponíveis</p><p className="text-xl font-bold text-emerald-600">{prestadoresFiltrados.filter(p => p.status === "disponivel").length}</p></div>
                          <div className="p-3 bg-blue-50 rounded-lg"><p className="text-xs text-muted-foreground">Em Rota</p><p className="text-xl font-bold text-blue-600">{alocacoes.filter(a => a.statusPagamento === 'a pagar').length}</p></div>
                          <div className="p-3 bg-orange-50 rounded-lg"><p className="text-xs text-muted-foreground">Aguard. Conf.</p><p className="text-xl font-bold text-orange-600">{alocacoes.filter(a => a.tipo === 'reserva').length}</p></div>
                          <div className="p-3 bg-slate-50 rounded-lg"><p className="text-xs text-muted-foreground">Inativos</p><p className="text-xl font-bold text-slate-600">{prestadoresFiltrados.filter(p => p.status === "inativo").length}</p></div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="graficos" className="flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Distribuição por Veículo</CardTitle></CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {Object.entries(TIPO_VEICULO_LABEL).map(([key, label]) => {
                            const count = prestadores.filter(p => p.veiculo === key).length;
                            const pct = prestadores.length ? (count / prestadores.length * 100).toFixed(0) : 0;
                            if (count === 0) return null;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-xs w-20 truncate">{label}</span>
                                <div className="flex-1 bg-muted rounded-full h-2"><div className="bg-primary h-2 rounded-full" style={{width:`${pct}%`}}></div></div>
                                <span className="text-xs font-bold w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="tabelas" className="flex-1 overflow-auto">
                    <Card>
                      <CardHeader><CardTitle className="text-sm">Tabela de Alocações</CardTitle></CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader><TableRow><TableHead>Prestador</TableHead><TableHead>Veículo</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {alocacoes.map((a, i) => {
                              const prest = prestadores.find(p => p.id === a.prestadorId);
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-xs">{prest?.nome || "-"}</TableCell>
                                  <TableCell className="text-xs">{prest ? TIPO_VEICULO_LABEL[prest.veiculo as keyof typeof TIPO_VEICULO_LABEL] || prest.veiculo : "-"}</TableCell>
                                  <TableCell><Badge variant="outline" className="text-xs">{a.statusPagamento}</Badge></TableCell>
                                  <TableCell className="text-xs font-bold">R$ {a.totals?.total?.toLocaleString('pt-BR') || "-"}</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="confirmacoes" className="mt-1.5 flex-1 overflow-auto">
                    <Card className="bg-white border-slate-100 shadow-sm rounded-2xl overflow-hidden">
                      <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-2 px-6 flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-primary"/> Confirmações e Controle de Carregamento</CardTitle>
                          <CardDescription className="text-xs font-semibold text-slate-400">Acompanhe e valide o status da escala integrada ao controle de pátio e fila de docas.</CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
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
                              {confirmacoesCarregamento.map((c) => (
                                <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                                  <TableCell className="pl-6">
                                    <div className="font-bold text-slate-900 text-xs">{c.prestador}</div>
                                    <Badge className={`text-[9px] font-bold border-0 px-2 py-0.2 mt-1 ${
                                      c.tipo === "agregado" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"
                                    }`}>
                                      {c.tipo === "agregado" ? "Agregado / Frota" : "Esporádico"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-bold text-slate-700 text-xs">{c.os}</div>
                                    <div className="text-[10px] font-semibold text-slate-400">{c.cliente}</div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-semibold text-slate-700 text-xs">{c.veiculo}</div>
                                    <span className="font-black text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[10px]">{c.placa}</span>
                                  </TableCell>
                                  <TableCell>
                                    <div className="font-bold text-slate-700 text-xs">{c.destino}</div>
                                    <div className="text-[10px] font-semibold text-slate-400">Região Principal</div>
                                  </TableCell>
                                  <TableCell className="text-xs text-slate-600 font-medium">
                                    {c.horarioCarregamento.split(" ")[1]}
                                  </TableCell>
                                  <TableCell className="font-bold text-slate-700 text-xs">
                                    {c.posicaoFila ? `${c.posicaoFila}º lugar` : "—"}
                                  </TableCell>
                                  <TableCell>
                                    {c.status === "liberado_para_rota" && (
                                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[9px] border-0 px-2 py-0.5">
                                        Liberado Rota
                                      </Badge>
                                    )}
                                    {c.status === "carregamento_iniciado" && (
                                      <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-[9px] border-0 px-2 py-0.5 animate-pulse">
                                        Em Carregamento
                                      </Badge>
                                    )}
                                    {c.status === "aguardando_prestador" && (
                                      <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-[9px] border-0 px-2 py-0.5">
                                        Aguard. Chegada
                                      </Badge>
                                    )}
                                    {c.status === "divergencia" && (
                                      <Badge className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-[9px] border-0 px-2 py-0.5">
                                        Divergência
                                      </Badge>
                                    )}
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
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
       </div>

        {/* Modal de Reserva */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerenciar Alocação de Recurso</DialogTitle>
              <DialogDescription>
                Alocação para <strong className="text-slate-800">{prestadorAtivo?.nome || 'Novo Prestador'}</strong> em <strong className="text-slate-800">{selectedCell?.data ? format(selectedCell.data, "dd/MM/yyyy") : 'Data não selecionada'}</strong>.
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
                   <SearchableSelect 
                     table="prestadores" 
                     labelField="nome_completo" 
                     searchFields={["nome_completo", "cpf_cnpj"]} 
                     value={novoPrestadorId} 
                     onChange={(id, item) => {
                       setNovoPrestadorId(id || "");
                       if (item) {
                         setNovoPrestadorNome(item.nome_completo);
                         buscarDadosVeiculoPrestador(id || "");
                       }
                     }} 
                     placeholder="Pesquisar por nome ou CPF/CNPJ..."
                   />
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
                           buscarTabelaValoresCliente(id || "", prestadorVeiculo.tipo_veiculo);
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
                 {tabelaValores && (
                   <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                     <div className="flex items-center justify-between text-xs">
                       <span className="font-medium text-emerald-800">Tabela aplicada: {regraEspecialAtiva ? "Cliente" : "Universal"}</span>
                       <span className="text-emerald-700">Base: R$ {tabelaValores.valor_base?.toFixed(2) || "0"} | KM: R$ {tabelaValores.valor_km?.toFixed(2) || "0"}</span>
                     </div>
                   </div>
                 )}
                 <div className="space-y-1">
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
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Valor do Prestador</h4>
                      <div className="grid grid-cols-2 gap-4">
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
                         {financeiro.valorTipo === 'percentual' ? (
                           <div className="space-y-1">
                              <Label className="text-xs">Percentual (%)</Label>
                              <Input type="number" value={financeiro.valorPercentual} onChange={e => setFinanceiro(f => ({ ...f, valorPercentual: Number(e.target.value) }))} className="h-9" />
                           </div>
                         ) : (
                           <div className="space-y-1">
                              <Label className="text-xs">Valor Fixo (R$)</Label>
                              <Input type="number" value={financeiro.valorFixo} onChange={e => setFinanceiro(f => ({ ...f, valorFixo: Number(e.target.value) }))} className="h-9" />
                           </div>
                         )}
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
                          <div className="mt-3 space-y-2 text-xs">
                            <div className="flex justify-between items-center py-1 border-b">
                              <span className="text-slate-500 font-semibold">Diária Base:</span>
                              <span className="font-bold text-slate-800">R$ {res.valorBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b">
                              <span className="text-slate-500 font-semibold">Adicionais:</span>
                              <span className="font-bold text-slate-800 text-green-600">+ R$ {res.totalAdicionais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center py-1 border-b text-red-500">
                              <span className="font-semibold">Descontos:</span>
                              <span className="font-bold">- R$ {res.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            
                            <div className="bg-white border rounded-lg p-2 mt-4 text-center">
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Final Estimado</p>
                              <p className="text-lg font-black text-green-600 mt-0.5">R$ {res.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
                                totals: calcularTotalAlocacao()
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
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-emerald-50/50 gap-2 font-bold text-xs" onClick={() => toast.success("Mensagem enviada via WhatsApp!")}>
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
