import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Package, PlusCircle, FileText, DollarSign, LogOut, Search, Download, MapPin, Clock, CheckCircle, AlertTriangle, 
  Truck, User, Phone, Mail, ChevronRight, X, Camera, Signature, MapPinned, Activity, Calendar, BarChart3, 
  Send, Route, Users, FileUp, AlertCircle, TrendingUp, Wallet, CreditCard, Bell, Settings, LogIn,
  Clock3, Package2, Navigation, CheckCheck, MoreHorizontal, Eye, PhoneCall, MessageSquare, Play, Pause,
  Grid3X3, List, Calculator, Map, Navigation2, Star, ThumbsUp, ThumbsDown, Minus, Plus, Filter,
  QrCode, ExternalLink, RefreshCw, Moon, Sun, Building2, Home, Briefcase, Ruler, Scale, ArrowRight,
  FilePlus, FileCheck, History, Award, TrendingDown, TrendingEqual, Brain, Zap, Copy
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getUser, logout } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  PortalKpiCard,
  PortalSectionCard,
  PortalStatusBadge,
  PortalInsightCard,
  PortalEmptyState,
  PortalTimeline,
  PortalTrackingMap,
  PortalDeliveryCard,
  PortalDocumentPreview,
  PortalRoteirizacao,
  PortalEscalaOperacional,
  PortalIAOperacional,
  PortalMultiFilial,
  PortalExecutiveDashboard,
  PortalEconomia,
  PortalNotificacoes,
  PortalWhatsApp,
  PortalCentralViva,
  PortalPWA,
  type TimelineEvent,
} from "@/components/portal-cliente";
import { usePortalRealtime } from "@/hooks/portalCliente";
import { useTheme } from "@/hooks/useTheme";
import {
  buscarDashboardMetrics,
  gerarInsights,
  buscarComprovantesPortal,
  buscarProtocolosPortal,
} from "@/services/portalCliente/portalClienteService";

import {
  criarPedidoPortal,
  buscarPedidosPortal,
  validarPedido,
  sugerirVeiculo,
  type PedidoPortal,
  statusCores,
  prioridadecores,
} from "@/services/portalCliente/pedidosService";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtHora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const formatStatus = (s: string | undefined) => {
  const map: Record<string, string> = {
    programacao: "Programado",
    coleta: "Em Coleta",
    saiu_para_rota: "Saiu para Rota",
    em_rota: "Em Rota",
    entregue: "Entregue",
    atrasada: "Atrasado",
    problema: "Com Problema",
  };
  return map[s || ''] || s || "Pendente";
};

interface Entrega {
  id: string;
  numero: string;
  status: string;
  status_label: string;
  origem: Endereco;
  destino: Endereco;
  previsao: string;
  created_at: string;
  valor_frete: number;
  peso: number;
  volumes: number;
  dimensoes?: { altura: number; largura: number; comprimento: number };
  mercadoria: string;
  cliente_nome?: string;
  destinatario?: { nome: string; documento: string; telefone: string };
  prestador?: { nome: string; foto_url?: string; telefone?: string; veiculo?: string; placa?: string };
  historico?: HistoricoItem[];
  pod?: PodItem;
  ocorrencias?: OcorrenciaItem[];
  sla?: number;
}

interface Endereco {
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
}

interface HistoricoItem {
  acao: string;
  status_novo: string;
  created_at: string;
}

interface PodItem {
  foto_url?: string;
  assinatura_url?: string;
  receptor?: string;
  grau_parentesco?: string;
  created_at?: string;
  local?: string;
}

interface OcorrenciaItem {
  id: string;
  tipo: string;
  descricao: string;
  status: string;
  prioridade: string;
  created_at: string;
}

interface Alerta {
  id: string;
  tipo: "atraso" | "problema" | "km" | "parado";
  titulo: string;
  descricao: string;
  os_id?: string;
  severidade: "critico" | "atencao";
  created_at: string;
}

interface Fatura {
  id: string;
  fatura: string;
  competencia: string;
  os_vinculadas: string[];
  vencimento: string;
  valor: number;
  valor_adicional?: number;
  status: "vencida" | "a_vencer" | "paga";
}

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "entrega" | "risco" | "avaliacao" | "ocorrencia";
  lida: boolean;
  created_at: string;
}

interface RoteirizacaoRota {
  id: string;
  regiao: string;
  veiculo: string;
  pedidos: string[];
  peso_total: number;
  km: number;
  bairros: string[];
}

interface Avaliacao {
  id: string;
  nota: number;
  nota_pontualidade: number;
  nota_comunicacao: number;
  nota_conservacao: number;
  nota_atendimento: number;
  nps: number;
  comentario?: string;
  os_id: string;
  prestador_id?: string;
  prestador_nome?: string;
  veiculo?: string;
  placa?: string;
  entrega_origem?: string;
  entrega_destino?: string;
  created_at: string;
}

interface PrestadorAvaliacao {
  id: string;
  nome: string;
  foto?: string;
  veiculo?: string;
  placa?: string;
  entregas?: number;
  nota_media?: number;
}

interface EnderecoFavorito {
  id: string;
  nome: string;
  cep: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  complemento?: string;
}

const statusCores: Record<string, string> = {
  "programacao": "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800",
  "coleta": "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50",
  "saiu_para_rota": "bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50",
  "em_rota": "bg-orange-100 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50",
  "entregue": "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50",
  "atrasada": "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50",
  "problema": "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50",
};

const statusIcones: Record<string, typeof Truck> = {
  "programacao": Clock3,
  "coleta": Package2,
  "saiu_para_rota": Truck,
  "em_rota": Navigation,
  "entregue": CheckCircle,
  "atrasada": AlertTriangle,
  "problema": AlertCircle,
};

const itensSidebar = [
  { id: "dashboard", icon: Activity, label: "Dashboard" },
  { id: "ao_vivo", icon: Activity, label: "Ao Vivo" },
  { id: "pedidos", icon: Package, label: "Pedidos" },
  { id: "rastreio", icon: MapPin, label: "Rastreamento" },
  { id: "roteirizacao", icon: Route, label: "Roteirização" },
  { id: "escala", icon: Truck, label: "Escala" },
  { id: "executivo", icon: BarChart3, label: "Executivo" },
  { id: "economia", icon: DollarSign, label: "Economia" },
  { id: "ia_operacional", icon: Brain, label: "Assistente Conexão" },
  { id: "multi_filial", icon: Building2, label: "Filiais" },
  { id: "whatsapp", icon: MessageSquare, label: "WhatsApp" },
  { id: "notificacoes", icon: Bell, label: "Notificações" },
  { id: "financeiro", icon: DollarSign, label: "Financeiro" },
  { id: "ocorrencias", icon: AlertCircle, label: "Ocorrências" },
  { id: "avaliacao", icon: Star, label: "Avaliação" },
  { id: "relatorios", icon: FileCheck, label: "Relatórios" },
  { id: "comprovantes", icon: FileCheck, label: "Comprovantes" },
];

export default function PortalCliente() {
  const navigate = useNavigate();
  const user = getUser();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaItem[]>([]);
  const [filtroPeriodo, setFiltroPeriodo] = useState("30dias");
  const [selectedEntregas, setSelectedEntregas] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clienteData, setClienteData] = useState<any>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [showNovoPedidoModal, setShowNovoPedidoModal] = useState(false);
  const [showRotaModal, setShowRotaModal] = useState(false);
  const [showVeiculoModal, setShowVeiculoModal] = useState(false);
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [showComprovanteModal, setShowComprovanteModal] = useState(false);
  const [showAvaliacaoModal, setShowAvaliacaoModal] = useState(false);
  const [showNovaAvaliacaoModal, setShowNovaAvaliacaoModal] = useState(false);
  const [avaliacaoNota, setAvaliacaoNota] = useState(0);
  const [avaliacaoNps, setAvaliacaoNps] = useState(5);
  const [avaliacaoComentario, setAvaliacaoComentario] = useState("");
  const [avaliacaoOS, setAvaliacaoOS] = useState("");
  const [avaliacaoPontualidade, setAvaliacaoPontualidade] = useState(0);
  const [avaliacaoComunicacao, setAvaliacaoComunicacao] = useState(0);
  const [avaliacaoConservacao, setAvaliacaoConservacao] = useState(0);
  const [avaliacaoAtendimento, setAvaliacaoAtendimento] = useState(0);
  const [selectedPrestadorAvaliacao, setSelectedPrestadorAvaliacao] = useState<any>(null);
  const [prestadoresDisponiveis, setPrestadoresDisponiveis] = useState<any[]>([]);
  const [selectedRota, setSelectedRota] = useState<RoteirizacaoRota | null>(null);
  const [selectedVeiculo, setSelectedVeiculo] = useState<any>(null);
  const [selectedFilial, setSelectedFilial] = useState<any>(null);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);
  const [novaOcorrencia, setNovaOcorrencia] = useState({ tipo: "", descricao: "", os_id: "", prioridade: "media" });
  const [novaAvaliacao, setNovaAvaliacao] = useState({ nota: 0, comentario: "", os_id: "" });
  const [rotaDestinos, setRotaDestinos] = useState<any[]>([]);
  const [comprovantesData, setComprovantesData] = useState<ComprovanteResumo[]>([]);
  const [protocolosData, setProtocolosData] = useState<ProtocoloResumo[]>([]);
  const [comprovantesLoading, setComprovantesLoading] = useState(false);
  const [selectedComprovante, setSelectedComprovante] = useState<ComprovanteResumo | null>(null);
  const [selectedProtocolo, setSelectedProtocolo] = useState<ProtocoloResumo | null>(null);
  const [filtroPeriodoInicio, setFiltroPeriodoInicio] = useState("");
  const [filtroPeriodoFim, setFiltroPeriodoFim] = useState("");
  const [filtroOS, setFiltroOS] = useState("");
  const [filtroDestinatario, setFiltroDestinatario] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroPrestador, setFiltroPrestador] = useState("");
  const [filtroVeiculo, setFiltroVeiculo] = useState("");
  const [filtroPeriodoComprov, setFiltroPeriodoComprov] = useState("30dias");
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [operacaoStatus, setOperacaoStatus] = useState<"saudavel" | "atencao" | "critico">("saudavel");
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null);
  const [insights, setInsights] = useState<ReturnType<typeof gerarInsights>>([]);
  const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
  
  const [novoPedido, setNovoPedido] = useState({
    origem: {cep: "", rua: "", numero: "", bairro: "", cidade: "", uf: "", complemento: ""},
    destino: {cep: "", rua: "", numero: "", bairro: "", cidade: "", uf: "", complemento: ""},
    destinatario: {nome: "", documento: "", telefone: ""},
    mercadoria: "", peso: 0, volumes: 0, observacoes: "", veiculo_sugerido: "",
  });

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const carregarDados = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    else setRefreshing(true);
    
    try {
      const clienteNome = user?.name || user?.email || "";
      const clienteFiltro = clienteNome ? clienteNome.replace(/@.+$/, "").trim() : "";

      const [{ data: clienteInfo }, { data: entregasData }, { data: faturasData }, { data: ocorrenciasData }, metrics] = await Promise.all([
        clienteFiltro ? supabase.from('clientes').select('*').ilike('nome_fantasia', `%${clienteFiltro}%`).limit(1).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('ordens_servico').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('financeiro_receber').select('*').order('data_vencimento', { ascending: false }).limit(20),
        supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(20),
        buscarDashboardMetrics(clienteNome),
      ]);

      setClienteData(clienteInfo);
      setDashboardMetrics(metrics);
      setInsights(gerarInsights(metrics));

      if (entregasData) {
        const entregasTransformadas = entregasData.map((os: any) => ({
          id: os.id,
          numero: os.numero || `OS-${os.id.slice(0, 8)}`,
          status: os.status || 'programacao',
          status_label: formatStatus(os.status),
          origem: { cep: '', rua: '', numero: '', bairro: '', cidade: os.filial_origem || 'N/A', uf: '' },
          destino: { cep: '', rua: '', numero: '', bairro: '', cidade: os.cidade_destino || os.cliente || 'N/A', uf: '' },
          previsao: os.data_previsao || new Date().toISOString(),
          created_at: os.created_at,
          valor_frete: os.valor_cliente || os.valor_frete || 0,
          peso: os.peso || 0,
          volumes: os.volumes || 1,
          mercadoria: os.carga_descricao || os.mercadoria || 'Mercadoria',
          cliente_nome: os.cliente || clienteInfo?.nome_fantasia || 'Cliente',
          destinatario: undefined,
          prestador: os.prestador ? { nome: os.prestador } : undefined,
          historico: [],
          sla: 100,
        }));
        setEntregas(entregasTransformadas);
      }

      if (faturasData) {
        const faturasTransformadas = faturasData.map((f: any) => ({
          id: f.id,
          fatura: f.fatura || `FAT-${f.id.slice(0, 4)}`,
          competencia: f.competencia || new Date().toLocaleString('pt-BR', { month: '2-digit', year: 'numeric' }),
          os_vinculadas: [f.os_id?.slice(0, 8) || ''],
          vencimento: f.data_vencimento || f.vencimento,
          valor: f.valor || 0,
          status: f.status === 'pago' || f.status === 'recebido' ? 'paga' : f.status === 'vencida' ? 'vencida' : 'a_vencer',
        }));
        setFaturas(faturasTransformadas);
      }

      if (ocorrenciasData) {
        const ocorrenciasTransformadas = ocorrenciasData.map((o: any) => ({
          id: o.id,
          tipo: o.tipo || 'outro',
          descricao: o.descricao || '',
          status: o.status || 'pendente',
          prioridade: o.severidade === 'alta' ? 'alta' : 'media',
          created_at: o.created_at,
        }));
        setOcorrencias(ocorrenciasTransformadas);
      }
    } catch (error) {
      console.warn('Erro ao carregar dados do Supabase:', error);
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!initialLoading && entregas.length === 0) {
      setEntregas(generateMockEntregas());
      setFaturas(generateMockFaturas());
      setNotificacoes(generateMockNotificacoes());
      setOcorrencias(generateMockOcorrencias());
      setAvaliacoes(generateMockAvaliacoes());
      setPrestadoresDisponiveis(generateMockPrestadoresAvaliacao());
    }
  }, [initialLoading, entregas.length]);

  const generateMockEntregas = (): Entrega[] => [
    {
      id: "1", numero: "OS-202610-1045", status: "em_rota", status_label: "Em Rota",
      origem: {cep: "01234-567", rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP"},
      destino: {cep: "20000-000", rua: "Av. Brasil", numero: "500", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ"},
      previsao: "2026-04-12T16:00:00", created_at: "2026-04-12T08:00:00",
      valor_frete: 1250.00, peso: 320, volumes: 3, mercadoria: "Peças automotivas",
      cliente_nome: "Empresa XYZ Ltda",
      destinatario: {nome: "João Silva Santos", documento: "123.456.789-00", telefone: "(11) 99999-9999"},
      prestador: {nome: "Carlos Silva", telefone: "(11) 98888-7777", veiculo: "Mercedes Sprinter", placa: "ABC-1234"},
      historico: [
        {acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-10T10:00:00"},
        {acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-11T14:00:00"},
        {acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-12T08:00:00"},
        {acao: "Em Rota", status_novo: "em_rota", created_at: "2026-04-12T09:30:00"},
      ], sla: 95,
    },
    {
      id: "2", numero: "OS-202610-1033", status: "programacao", status_label: "Programado",
      origem: {cep: "13000-000", rua: "Rua Central", numero: "200", bairro: "Centro", cidade: "Campinas", uf: "SP"},
      destino: {cep: "80000-000", rua: "Av. Vicente", numero: "100", bairro: "Batel", cidade: "Curitiba", uf: "PR"},
      previsao: "2026-04-15T10:00:00", created_at: "2026-04-11T15:00:00",
      valor_frete: 980.00, peso: 180, volumes: 2, mercadoria: "Eletrônicos",
      cliente_nome: "Tech Brasil S/A",
      destinatario: {nome: "Maria Oliveira", documento: "987.654.321-00", telefone: "(41) 99999-8888"},
      prestador: {nome: "Pedro Santos"},
      historico: [{acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-11T15:00:00"}], sla: 100,
    },
    {
      id: "3", numero: "OS-202610-1028", status: "entregue", status_label: "Entregue",
      origem: {cep: "01234-567", rua: "Av. Paulista", numero: "500", bairro: "Jardim Paulista", cidade: "São Paulo", uf: "SP"},
      destino: {cep: "30000-000", rua: "Av. Afonso Pena", numero: "1500", bairro: "Centro", cidade: "Belo Horizonte", uf: "MG"},
      previsao: "2026-04-10T14:00:00", created_at: "2026-04-08T09:00:00",
      valor_frete: 2100.00, peso: 450, volumes: 5, mercadoria: "Móveis corporativos",
      cliente_nome: "Escritório Central",
      destinatario: {nome: "Empresa XYZ Ltda", documento: "12.345.678/0001-90", telefone: "(31) 3333-4444"},
      prestador: {nome: "Marcos Oliveira"},
      historico: [
        {acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-08T09:00:00"},
        {acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-09T08:00:00"},
        {acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-10T06:00:00"},
        {acao: "Entregue", status_novo: "entregue", created_at: "2026-04-10T13:45:00"},
      ],
      pod: {foto_url: "", assinatura_url: "", receptor: "Carlos Manager", grau_parentesco: "Funcionário", created_at: "2026-04-10T13:45:00", local: "Av. Afonso Pena, 1500"},
      sla: 100,
    },
    {
      id: "4", numero: "OS-202610-1015", status: "atrasada", status_label: "Atrasado",
      origem: {cep: "01234-567", rua: "Av. Paulista", numero: "2000", bairro: "Jardim Paulista", cidade: "São Paulo", uf: "SP"},
      destino: {cep: "40000-000", rua: "Av. Juracy", numero: "80", bairro: "Pituba", cidade: "Salvador", uf: "BA"},
      previsao: "2026-04-11T12:00:00", created_at: "2026-04-07T10:00:00",
      valor_frete: 3500.00, peso: 800, volumes: 8, mercadoria: "Equipamentos industriais",
      cliente_nome: "Indústria ABC S/A",
      destinatario: {nome: "Indústria ABC S/A", documento: "98.765.432/0001-00", telefone: "(71) 9999-0000"},
      prestador: {nome: "Ricardo Costa"},
      historico: [
        {acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-07T10:00:00"},
        {acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-08T09:00:00"},
        {acao: "Atrasado", status_novo: "atrasada", created_at: "2026-04-11T12:00:00"},
      ], sla: 65,
    },
    {
      id: "5", numero: "OS-202609-9802", status: "entregue", status_label: "Entregue",
      origem: {cep: "01234-567", rua: "Av. Brasil", numero: "3000", bairro: "Jardim Europa", cidade: "São Paulo", uf: "SP"},
      destino: {cep: "50000-000", rua: "Av. Recife", numero: "200", bairro: "Boa Viagem", cidade: "Recife", uf: "PE"},
      previsao: "2026-04-05T16:00:00", created_at: "2026-04-02T08:00:00",
      valor_frete: 2800.00, peso: 620, volumes: 6, mercadoria: "Vestuário",
      cliente_nome: "Loja Modelos Ltda",
      destinatario: {nome: "Loja Modelos Ltda", documento: "11.222.333/0001-44", telefone: "(81) 4444-5555"},
      prestador: {nome: "Ana Paula"},
      historico: [
        {acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-02T08:00:00"},
        {acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-03T09:00:00"},
        {acao: "Entregue", status_novo: "entregue", created_at: "2026-04-05T15:30:00"},
      ],
      pod: {foto_url: "", assinatura_url: "", receptor: "Pedro Souza", grau_parentesco: "Porteiro", created_at: "2026-04-05T15:30:00", local: "Av. Recife, 200"},
      sla: 100,
    },
  ];

  const generateMockAlertas = (): Alerta[] => [
    {id: "1", tipo: "atraso", titulo: "Risco de Atraso", descricao: "OS-202610-1015 com atraso", os_id: "4", severidade: "critico", created_at: "2026-04-12T10:00:00"},
    {id: "2", tipo: "km", titulo: "KM Próximo do Limite", descricao: "Veículo operando próximo do limite", os_id: "1", severidade: "atencao", created_at: "2026-04-12T09:00:00"},
  ];

  const generateMockFaturas = (): Fatura[] => [
    {id: "1", fatura: "FAT-0045", competencia: "04/2026", os_vinculadas: ["OS-202610-1045"], vencimento: "2026-05-10", valor: 14500.00, status: "a_vencer"},
    {id: "2", fatura: "FAT-0044", competencia: "03/2026", os_vinculadas: ["OS-202609-9802"], vencimento: "2026-04-10", valor: 2800.00, status: "paga"},
    {id: "3", fatura: "FAT-0043", competencia: "02/2026", os_vinculadas: [], vencimento: "2026-03-10", valor: 18500.00, status: "paga"},
  ];

  const generateMockNotificacoes = (): Notificacao[] => [
    {id: "1", titulo: "Entrega realizada", mensagem: "OS-202610-1028 foi entregue com sucesso", tipo: "entrega", lida: false, created_at: "2026-04-10T13:45:00"},
    {id: "2", titulo: "Em trânsito", mensagem: "OS-202610-1045 está a caminho", tipo: "entrega", lida: false, created_at: "2026-04-12T09:30:00"},
    {id: "3", titulo: "Risco de atraso", mensagem: "OS-202610-1015 pode atrasar", tipo: "risco", lida: true, created_at: "2026-04-11T12:00:00"},
  ];

  const generateMockOcorrencias = (): OcorrenciaItem[] => [
    {id: "1", tipo: "atraso", descricao: "Atraso por tráfego", status: "resolvida", prioridade: "media", created_at: "2026-04-11T12:00:00"},
  ];

  const generateMockAvaliacoes = (): Avaliacao[] => [
    {id: "1", nota: 5, nota_pontualidade: 5, nota_comunicacao: 5, nota_conservacao: 4, nota_atendimento: 5, nps: 10, comentario: "Entrega super rápida! Prestador excelente.", os_id: "OS-202610-1028", prestador_id: "p1", prestador_nome: "Carlos Silva", veiculo: "Mercedes Sprinter", placa: "ABC-1234", entrega_origem: "São Paulo/SP", entrega_destino: "Rio de Janeiro/RJ", created_at: "2026-04-10T14:00:00"},
    {id: "2", nota: 4, nota_pontualidade: 4, nota_comunicacao: 4, nota_conservacao: 4, nota_atendimento: 4, nps: 8, comentario: "Tudo certo, recomendo", os_id: "OS-202609-9802", prestador_id: "p2", prestador_nome: "Pedro Santos", veiculo: "Fiat Fiorino", placa: "XYZ-5678", entrega_origem: "Campinas/SP", entrega_destino: "Curitiba/PR", created_at: "2026-04-05T16:00:00"},
    {id: "3", nota: 3, nota_pontualidade: 2, nota_comunicacao: 3, nota_conservacao: 4, nota_atendimento: 3, nps: 6, comentario: "Atrasou um pouco, mas entrega OK", os_id: "OS-202610-1045", prestador_id: "p3", prestador_nome: "Marcos Oliveira", veiculo: "Hyundai HR", placa: "DEF-9012", entrega_origem: "São Paulo/SP", entrega_destino: "Salvador/BA", created_at: "2026-04-12T09:00:00"},
  ];

  const generateMockPrestadoresAvaliacao = (): PrestadorAvaliacao[] => [
    { id: "p1", nome: "Carlos Silva", veiculo: "Mercedes Sprinter", placa: "ABC-1234", entregas: 245, nota_media: 4.8 },
    { id: "p2", nome: "Pedro Santos", veiculo: "Fiat Fiorino", placa: "XYZ-5678", entregas: 180, nota_media: 4.5 },
    { id: "p3", nome: "Marcos Oliveira", veiculo: "Hyundai HR", placa: "DEF-9012", entregas: 120, nota_media: 3.9 },
    { id: "p4", nome: "João Costa", veiculo: "Honda Biz", placa: "GHI-3456", entregas: 380, nota_media: 4.7 },
  ];

  const generateMockEnderecos = (): EnderecoFavorito[] => [
    {id: "1", nome: "Matriz São Paulo", cep: "01234-567", rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP"},
    {id: "2", nome: "Filial Rio", cep: "20000-000", rua: "Av. Brasil", numero: "500", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ"},
  ];

  const generateMockRoteirizacao = (): RoteirizacaoRota[] => [
    {id: "1", regiao: "Zona Sul", veiculo: "Van", pedidos: ["OS-202610-1045", "OS-202610-1033"], peso_total: 500, km: 45, bairros: ["Jardim Paulista", "Pinheiros"]},
    {id: "2", regiao: "Zona Norte", veiculo: "Fiorino", pedidos: ["OS-202610-1015"], peso_total: 800, km: 62, bairros: ["Santana"]},
    {id: "3", regiao: "Interior", veiculo: "Caminhão 3/4", pedidos: ["OS-202609-9802"], peso_total: 620, km: 180, bairros: ["Campinas"]},
  ];

  const onEntregaUpdate = useCallback((update: any) => {
    setEntregas(prev => prev.map(e => e.id === update.id ? { ...e, status: update.status, status_label: formatStatus(update.status) } : e));
  }, []);

  const onNotificacao = useCallback((n: any) => {
    toast({ title: n.titulo, description: "Nova atualização no seu pedido." });
    carregarDados();
  }, [toast, carregarDados]);

  const onOcorrencia = useCallback(() => {
    carregarDados();
  }, [carregarDados]);

  usePortalRealtime({
    onEntregaUpdate,
    onNotificacao,
    onOcorrencia,
    enabled: true
  });

  useEffect(() => { 
    if (initialLoading) carregarDados(true); 
  }, [carregarDados, initialLoading]);

  const carregarComprovantes = useCallback(async () => {
    setComprovantesLoading(true);
    try {
      const [comp, prot] = await Promise.all([
        buscarComprovantesPortal(100),
        buscarProtocolosPortal(100),
      ]);
      setComprovantesData(comp);
      setProtocolosData(prot);
    } catch (error) {
      console.warn("[PortalCliente] Erro ao carregar comprovantes:", error);
    } finally {
      setComprovantesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "comprovantes") {
      carregarComprovantes();
    }
  }, [activeTab, carregarComprovantes]);

  useEffect(() => {
    const atrasadas = entregas.filter(e => e.status === "atrasada").length;
    if (atrasadas > 0) setOperacaoStatus("critico");
    else if (entregas.filter(e => e.status === "em_rota").length > 0) setOperacaoStatus("atencao");
    else setOperacaoStatus("saudavel");
  }, [entregas]);

  const getStatusIcone = (status: string) => {
    const Icone = statusIcones[status] || Clock;
    return <Icone className="w-4 h-4" />;
  };

  const handleSair = () => { logout(); navigate("/login"); };

  const toggleSelecionar = (id: string) => {
    const nova = new Set(selectedEntregas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setSelectedEntregas(nova);
  };

  const handleVerPedido = (id: string) => {
    const entrega = entregas.find(e => e.id === id);
    if (entrega) {
      setSelectedEntrega(entrega);
      setShowDetailModal(true);
    } else {
      toast({ title: "Pedido não encontrado", description: " ID: " + id });
    }
  };

  const handleVerRota = (id: string) => {
    const rota = generateMockRoteirizacao().find(r => r.id === id);
    if (rota) {
      setSelectedRota(rota);
      setShowRotaModal(true);
    }
  };

  const handleVerVeiculo = (id: string) => {
    setSelectedVeiculo({ id, nome: "Motorista Teste", telefone: "(11) 99999-9999", veiculo: "Van", placa: "ABC-1234", capacidade: 1000, regiao: "Zona Sul", entregas: 5, status: "ativo" });
    setShowVeiculoModal(true);
  };

  const handleVerFilial = (id: string) => {
    setSelectedFilial({ id, nome: "Filial Teste", endereco: "Av. Paulista, 1000", responsavel: "João Silva", entregas: 150, sla: 98, custo: 15000, occurencias: 2 });
    setShowFilialModal(true);
  };

  const handleVerOcorrencia = (id: string) => {
    const ocorrencia = ocorrencias.find(o => o.id === id);
    if (ocorrencia) {
      toast({ title: `Ocorrência: ${ocorrencia.tipo}`, description: ocorrencia.descricao });
    }
  };

  const handleVerFatura = (id: string) => {
    const fatura = faturas.find(f => f.id === id);
    if (fatura) {
      setSelectedFatura(fatura);
      setShowFaturaModal(true);
    }
  };

  const handleBaixarRelatorio = (tipo: string) => {
    const dados = tipo === 'entregas' ? entregas : tipo === 'financeiro' ? faturas : tipo === 'ocorrencias' ? ocorrencias : entregas;
    if (dados.length === 0) {
      toast({ title: "Sem dados", description: "Não há dados para exportar" });
      return;
    }
    const csv = [
      Object.keys(dados[0] || {}).join(','),
      ...dados.map((d: any) => Object.values(d).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: `Relatório ${tipo} baixado com sucesso` });
  };

  const handleVerComprovante = (id: string) => {
    const comp = comprovantesData.find(c => c.id === id);
    if (comp) {
      setSelectedComprovante(comp);
      setShowComprovanteModal(true);
    }
  };

  const handleBaixarComprovante = (id: string) => {
    const comp = comprovantesData.find(c => c.id === id);
    if (comp?.url) {
      window.open(comp.url, '_blank');
    } else if (comp) {
      const dados = `COMPROVANTE DE ENTREGA
=========================
OS: ${comp.titulo}
Tipo: ${comp.tipo}
Destinatário: ${comp.nome_recebedor || "Não informado"}
Documento: ${comp.documento_recebedor || "Não informado"}
Data: ${comp.data_entrega ? new Date(comp.data_entrega).toLocaleString("pt-BR") : "Não informado"}

Gerado em: ${new Date().toLocaleString("pt-BR")}`;
      const blob = new Blob([dados], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${comp.titulo || 'comprovante'}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: "Arquivo gerado com os dados do comprovante" });
    } else {
      toast({ title: "Comprovante não encontrado", description: "ID: " + id });
    }
  };

  const handleBaixarTodosComprovantes = () => {
    if (comprovantesData.length === 0) {
      toast({ title: "Sem dados", description: "Não há comprovantes para baixar" });
      return;
    }
    const dados = comprovantesData.map(c => 
      `OS: ${c.titulo} | Tipo: ${c.tipo} | Recebedor: ${c.nome_recebedor || "N/A"} | Data: ${c.data_entrega ? new Date(c.data_entrega).toLocaleDateString("pt-BR") : "N/A"}`
    ).join('\n');
    
    const header = "COMPROVANTES DE ENTREGA\n" + "=".repeat(50) + "\n\n";
    const blob = new Blob([header + dados], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comprovantes_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Download iniciado", description: `${comprovantesData.length} comprovantes exportados` });
  };

  const handleVerProtocolo = (id: string) => {
    const prot = protocolosData.find(p => p.id === id);
    if (prot) {
      setSelectedProtocolo(prot);
      setShowComprovanteModal(true);
    }
  };

  const handleCopiarProtocolo = (protocolo: string) => {
    navigator.clipboard.writeText(protocolo);
    toast({ title: "Copiado!", description: `Protocolo ${protocolo} copiado para área de transferência` });
  };

  const filteredComprovantes = useMemo(() => {
    return comprovantesData.filter(c => {
      const matchesOS = !filtroOS || c.titulo?.toLowerCase().includes(filtroOS.toLowerCase());
      const matchesDest = !filtroDestinatario || (c.nome_recebedor || "").toLowerCase().includes(filtroDestinatario.toLowerCase());
      const matchesTipo = filtroTipo === "todos" || c.tipo === filtroTipo;
      const matchesPrestador = !filtroPrestador || (c as any)?.prestador?.toLowerCase().includes(filtroPrestador.toLowerCase());
      const matchesVeiculo = !filtroVeiculo || (c as any)?.veiculo?.toLowerCase().includes(filtroVeiculo.toLowerCase());
      return matchesOS && matchesDest && matchesTipo && matchesPrestador && matchesVeiculo;
    });
  }, [comprovantesData, filtroOS, filtroDestinatario, filtroTipo, filtroPrestador, filtroVeiculo]);

  const filteredProtocolos = useMemo(() => {
    return protocolosData.filter(p => {
      const matchesBusca = !filtroOS || p.protocolo?.toLowerCase().includes(filtroOS.toLowerCase());
      return matchesBusca;
    });
  }, [protocolosData, filtroOS]);

  const handleImportarCSV = (file: File) => {
    setImportedCSV(file);
    toast({ title: "CSV recebido", description: `${file.name} será processado em breve` });
  };

  const handleAgendar = () => {
    setShowNovoPedidoModal(true);
  };

  const handleFiltrar = (tipo: string, valor: string) => {
    if (tipo === 'status') setFiltroStatus(valor);
    else if (tipo === 'periodo') setFiltroPeriodo(valor);
  };

  const handleReportarOcorrencia = async () => {
    if (!novaOcorrencia.tipo || !novaOcorrencia.descricao) {
      toast({ title: "Preencha os campos", description: "Tipo e descrição são obrigatórios" });
      return;
    }
    
    const novasOcorrencias = [...ocorrencias, {
      id: Date.now().toString(),
      tipo: novaOcorrencia.tipo,
      descricao: novaOcorrencia.descricao,
      status: "pendente",
      prioridade: novaOcorrencia.prioridade,
      created_at: new Date().toISOString()
    }];
    
    setOcorrencias(novasOcorrencias);
    setNovaOcorrencia({ tipo: "", descricao: "", os_id: "", prioridade: "media" });
    setShowProblemaModal(false);
    toast({ title: "Ocorrência reportada", description: "Nossa equipe analisará em breve" });
  };

  const handleEnviarAvaliacao = () => {
    if (avaliacaoNota === 0) {
      toast({ title: "Selecione uma nota", description: "Avaliação de 1 a 5 estrelas" });
      return;
    }
    if (!selectedPrestadorAvaliacao) {
      toast({ title: "Selecione um prestador", description: "Escolha o prestador que deseja avaliar" });
      return;
    }
    
    const novasAvaliacoes = [...avaliacoes, {
      id: Date.now().toString(),
      nota: avaliacaoNota,
      nota_pontualidade: avaliacaoPontualidade,
      nota_comunicacao: avaliacaoComunicacao,
      nota_conservacao: avaliacaoConservacao,
      nota_atendimento: avaliacaoAtendimento,
      nps: avaliacaoNps,
      comentario: avaliacaoComentario,
      os_id: avaliacaoOS || selectedPrestadorAvaliacao?.entrega?.numero || "Geral",
      prestador_id: selectedPrestadorAvaliacao?.id,
      prestador_nome: selectedPrestadorAvaliacao?.nome,
      veiculo: selectedPrestadorAvaliacao?.veiculo,
      placa: selectedPrestadorAvaliacao?.placa,
      entrega_origem: selectedPrestadorAvaliacao?.entrega_origem,
      entrega_destino: selectedPrestadorAvaliacao?.entrega_destino,
      created_at: new Date().toISOString()
    }];
    
    setAvaliacoes(novasAvaliacoes);
    setAvaliacaoNota(0);
    setAvaliacaoPontualidade(0);
    setAvaliacaoComunicacao(0);
    setAvaliacaoConservacao(0);
    setAvaliacaoAtendimento(0);
    setAvaliacaoNps(5);
    setAvaliacaoComentario("");
    setAvaliacaoOS("");
    setSelectedPrestadorAvaliacao(null);
    setShowNovaAvaliacaoModal(false);
    toast({ title: "Obrigado!", description: "Sua avaliação do prestador foi registrada" });
  };

  const handleNotificacaoAction = (notifId: string, acao: string) => {
    const notif = notificacoes.find(n => n.id === notifId);
    if (!notif) return;
    
    if (acao === 'ver_os') {
      const osMatch = notif.mensagem.match(/OS-\d+/);
      if (osMatch) {
        const entrega = entregas.find(e => e.numero.includes(osMatch[0]));
        if (entrega) {
          setSelectedEntrega(entrega);
          setShowDetailModal(true);
        } else {
          setActiveTab('pedidos');
        }
      } else {
        setActiveTab('pedidos');
      }
    } else if (acao === 'ver_ocorrencia') {
      setActiveTab('ocorrencias');
    } else if (acao === 'ver_comprovante') {
      setActiveTab('comprovantes');
      carregarComprovantes();
    } else if (acao === 'ver_fatura') {
      setActiveTab('financeiro');
    }
  };

  const metricas = useMemo(() => ({
    ativos: entregas.filter(e => e.status !== "entregue").length,
    emRota: entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length,
    atrasados: entregas.filter(e => e.status === "atrasada").length,
    concluidos: entregas.filter(e => e.status === "entregue").length,
    slaMedio: Math.round(entregas.reduce((acc, e) => acc + (e.sla || 0), 0) / entregas.length) || 0,
    taxaSucesso: Math.round((entregas.filter(e => e.status === "entregue").length / entregas.length) * 100) || 0,
    tempoMedio: 2.5,
    comparacaoDia: 12,
  }), [entregas]);

  const totalFaturado = useMemo(() => faturas.filter(f => f.status === "paga").reduce((acc, f) => acc + f.valor, 0), [faturas]);
  const totalAVencer = useMemo(() => faturas.filter(f => f.status === "a_vencer").reduce((acc, f) => acc + f.valor, 0), [faturas]);
  const naoLidas = useMemo(() => notificacoes.filter(n => !n.lida).length, [notificacoes]);

  const npsScore = useMemo(() => {
    const promotores = avaliacoes.filter(a => (a.nps || 0) >= 9).length;
    const detratores = avaliacoes.filter(a => (a.nps || 0) <= 6).length;
    return avaliacoes.length > 0 ? Math.round(((promotores - detratores) / avaliacoes.length) * 100) : 0;
  }, [avaliacoes]);

  const notaMediaGeral = useMemo(() => {
    if (avaliacoes.length === 0) return 0;
    return (avaliacoes.reduce((acc, a) => acc + a.nota, 0) / avaliacoes.length).toFixed(1);
  }, [avaliacoes]);

  const topPrestadores = useMemo(() => {
    const byPrestador: Record<string, { nome: string; nota: number; count: number }> = {};
    avaliacoes.forEach(a => {
      if (!a.prestador_id) return;
      if (!byPrestador[a.prestador_id]) {
        byPrestador[a.prestador_id] = { nome: a.prestador_nome || "", nota: 0, count: 0 };
      }
      byPrestador[a.prestador_id].nota += a.nota;
      byPrestador[a.prestador_id].count++;
    });
    return Object.entries(byPrestador)
      .map(([id, data]) => ({ id, nome: data.nome, media: (data.nota / data.count).toFixed(1), count: data.count }))
      .sort((a, b) => parseFloat(b.media) - parseFloat(a.media))
      .slice(0, 5);
  }, [avaliacoes]);

  const prestadoresAlerta = useMemo(() => {
    return avaliacoes.filter(a => a.nota <= 2).length;
  }, [avaliacoes]);

  const filteredEntregas = useMemo(() => {
    return entregas.filter(e => {
      const matchesBusca = !buscaGlobal || e.numero.toLowerCase().includes(buscaGlobal.toLowerCase()) ||
        e.destino.cidade.toLowerCase().includes(buscaGlobal.toLowerCase()) ||
        e.cliente_nome?.toLowerCase().includes(buscaGlobal.toLowerCase());
      const matchesStatus = filtroStatus === "todos" || e.status === filtroStatus;
      return matchesBusca && matchesStatus;
    });
  }, [entregas, buscaGlobal, filtroStatus]);

  const StepTimeline = ({ historico }: { historico?: HistoricoItem[] }) => {
    if (!historico || historico.length === 0) return <div className="text-sm text-muted-foreground">Aguardando informações</div>;
    const steps = [
      {key: "programacao", label: "Recebido", icon: Package2},
      {key: "coleta", label: "Coleta", icon: Package},
      {key: "saiu_para_rota", label: "Saiu", icon: Truck},
      {key: "em_rota", label: "Em Rota", icon: Navigation},
      {key: "entregue", label: "Entregue", icon: CheckCircle},
    ];
    const currentIdx = Math.max(0, ...historico.map(h => steps.findIndex(s => s.key === h.status_novo)));
    return (
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                idx <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                <step.icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${idx <= currentIdx ? "text-primary" : "text-muted-foreground"}`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && <div className={`w-6 h-0.5 ${idx < currentIdx ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-background text-foreground transition-colors duration-300">
      {/* Sidebar Fixa */}
      <aside className={`fixed left-0 top-0 h-full bg-white border-r border-[#E5E7EB] z-50 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? "w-20" : "w-64"
      }`}>
        {/* Logo */}
        <div className="h-20 flex items-center px-4 border-b border-[#E5E7EB]/50">
          <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20">
            CE
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3">
              <h1 className="font-bold text-[#111827] text-sm leading-tight">Conexão Express</h1>
              <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold">Portal Cliente</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto custom-scrollbar">
          {itensSidebar.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                activeTab === item.id 
                  ? "bg-[#F97316] text-white shadow-md shadow-orange-500/10" 
                  : "text-[#64748B] hover:text-[#111827] hover:bg-[#F8FAFC]"
              }`}
            >
              <item.icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${activeTab === item.id ? "scale-110" : "group-hover:scale-110"}`} />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              {item.id === "notificacoes" && !sidebarCollapsed && (notificacoes.filter(n => !n.lida).length) > 0 && (
                <span className="ml-auto px-2 py-0.5 text-[10px] bg-red-500 text-white rounded-full font-bold">
                  {notificacoes.filter(n => !n.lida).length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-[#E5E7EB]/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E5E7EB]">
            <Avatar className="w-10 h-10 border-2 border-orange-500/20">
              <AvatarFallback className="bg-[#F97316] text-white">
                {user?.name?.charAt(0) || "C"}
              </AvatarFallback>
            </Avatar>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#111827] truncate">{user?.name || "Cliente"}</p>
                <p className="text-[10px] text-[#64748B] truncate">{clienteData?.nome_fantasia || user?.email || ""}</p>
              </div>
            )}
            <button onClick={handleSair} className="p-1.5 text-[#64748B] hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapse Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center text-[#64748B] hover:text-[#F97316] shadow-sm hover:shadow-md transition-all z-10"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-[#E5E7EB] flex items-center px-6 justify-between sticky top-0 z-40">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <Input 
              placeholder="Buscar pedidos, destinos, NF..." 
              className="pl-10 bg-white border-[#E5E7EB] focus:border-[#F97316]/50 focus:ring-1 focus:ring-[#F97316]/20 rounded-full h-10 text-sm text-[#111827]"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={toggleTheme}
                    className="rounded-full w-10 h-10 text-[#64748B] hover:text-[#F97316] hover:bg-[#F8FAFC] transition-all"
                  >
                    {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alternar para modo {theme === "dark" ? "claro" : "escuro"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="h-6 w-px bg-[#E5E7EB] mx-1" />

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-[#64748B] hover:text-[#F97316] relative rounded-full w-10 h-10 transition-all">
                    <Bell className="w-5 h-5" />
                    {(notificacoes.filter(n => !n.lida).length) > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{notificacoes.filter(n => !n.lida).length} notificações</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button 
              className="bg-[#F97316] hover:bg-[#EA580C] text-white shadow-lg shadow-orange-900/20 rounded-full px-5 h-10 font-semibold transition-all hover:scale-105 active:scale-95"
              onClick={() => setShowNovoPedidoModal(true)}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Novo Pedido
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1 bg-[#F8FAFC]">
          <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-8 animate-fade-in">
            {/* ===== DASHBOARD ===== */}
            {/* ===== AO VIVO ===== */}
            {activeTab === "ao_vivo" && (
              <PortalCentralViva
                entregasAtivas={entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota" || e.status === "coleta").map(e => ({
                  id: e.id,
                  numero: e.numero,
                  status: e.status,
                  regiao: e.destino.cidade,
                  eta: fmtData(e.previsao),
                  sla: e.sla || 100,
                }))}
                isConnected={true}
                onRefresh={() => carregarDados()}
              />
            )}

            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight">{getSaudacao()}, {user?.name || "Cliente"}!</h2>
                    <p className="text-[#475569] mt-1">Bem-vindo ao seu portal de inteligência logística.</p>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white border border-[#E5E7EB] shadow-sm">
                    <div className="relative flex items-center justify-center">
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        operacaoStatus === "saudavel" ? "bg-emerald-500" : operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                      <span className={`absolute w-full h-full rounded-full animate-ping opacity-75 ${
                        operacaoStatus === "saudavel" ? "bg-emerald-500" : operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
                      }`} />
                    </div>
                    <span className="text-sm font-bold text-[#111827] uppercase tracking-wider">
                      Status: {operacaoStatus === "saudavel" ? "Saudável" : operacaoStatus === "atencao" ? "Atenção" : "Crítico"}
                    </span>
                  </div>
                </div>

                {/* Cards Metrics com novo Design System */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <PortalKpiCard
                    title="Entregas Hoje"
                    value={dashboardMetrics?.entregasHoje ?? metricas?.ativos ?? "-"}
                    icon={Package}
                    loading={initialLoading}
                    status={dashboardMetrics?.entregasHoje ?? 0 > 0 ? "saudavel" : "atencao"}
                  />
                  <PortalKpiCard
                    title="Em Andamento"
                    value={dashboardMetrics?.emAndamento ?? metricas?.emRota ?? "-"}
                    icon={Truck}
                    loading={initialLoading}
                    status={dashboardMetrics?.emAndamento ?? 0 > 0 ? "em_andamento" : "saudavel"}
                  />
                  <PortalKpiCard
                    title="Concluídas no Mês"
                    value={dashboardMetrics?.concluidasMes ?? metricas?.concluidos ?? "-"}
                    icon={CheckCircle}
                    loading={initialLoading}
                    status={dashboardMetrics?.concluidasMes ?? 0 > 0 ? "concluido" : "atencao"}
                  />
                  <PortalKpiCard
                    title="SLA"
                    value={`${dashboardMetrics?.slaMedio ?? metricas?.slaMedio ?? 0}%`}
                    icon={Clock}
                    loading={initialLoading}
                    status={
                      (dashboardMetrics?.slaMedio ?? metricas?.slaMedio ?? 0) >= 95
                        ? "saudavel"
                        : (dashboardMetrics?.slaMedio ?? metricas?.slaMedio ?? 0) >= 80
                          ? "atencao"
                          : "critico"
                    }
                  />
                  <PortalKpiCard
                    title="Atrasadas"
                    value={dashboardMetrics?.atrasadas ?? metricas?.atrasados ?? "-"}
                    icon={AlertTriangle}
                    loading={initialLoading}
                    status={
                      (dashboardMetrics?.atrasadas ?? metricas?.atrasados ?? 0) > 0
                        ? "critico"
                        : "saudavel"
                    }
                  />
                  <PortalKpiCard
                    title="Ocorrências"
                    value={dashboardMetrics?.totalOcorrencias ?? "-"}
                    icon={AlertCircle}
                    loading={initialLoading}
                    status={
                      (dashboardMetrics?.totalOcorrencias ?? 0) > 3
                        ? "critico"
                        : (dashboardMetrics?.totalOcorrencias ?? 0) > 0
                          ? "atencao"
                          : "saudavel"
                    }
                  />
                  <PortalKpiCard
                    title="Faturado (Pago)"
                    value={fmtFin(dashboardMetrics?.totalFaturado ?? 0)}
                    icon={DollarSign}
                    loading={initialLoading}
                  />
                  <PortalKpiCard
                    title="Valor Médio"
                    value={fmtFin(dashboardMetrics?.valorMedioEntrega ?? 0)}
                    icon={BarChart3}
                    loading={initialLoading}
                  />
                </div>

                {/* Insights Inteligentes */}
                <PortalSectionCard
                  title="Insights Inteligentes"
                  description="Análise automática baseada nos seus dados operacionais"
                >
                  {insights.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {insights.slice(0, 6).map((insight, idx) => (
                        <PortalInsightCard
                          key={idx}
                          type={insight.type}
                          title={insight.title}
                          description={insight.description}
                          priority={insight.priority}
                          metric={insight.metric}
                          suggestion={insight.suggestion}
                        />
                      ))}
                    </div>
                  ) : (
                    <PortalEmptyState
                      type="sem-dados"
                      title="Sem dados suficientes ainda"
                      description="Assim que sua operação ganhar volume, a Conexão Express mostrará insights automáticos aqui."
                    />
                  )}
                </PortalSectionCard>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-base text-[#111827]">Evolução de Entregas</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-56 flex items-end gap-3 px-4 pt-4">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia, i) => {
                          const height = [65, 85, 50, 95, 80, 40, 15][i];
                          const active = i === 3;
                          return (
                            <div key={dia} className="flex-1 flex flex-col items-center gap-3 group cursor-pointer">
                              <div className="w-full relative flex flex-col justify-end h-full">
                                <div 
                                  className={`w-full rounded-t-lg transition-all duration-500 ${active ? "bg-[#F97316] shadow-lg shadow-orange-500/30" : "bg-[#F97316]/20 group-hover:bg-[#F97316]/40"}`} 
                                  style={{height: `${height}%`}} 
                                />
                                {active && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#F97316] text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">95</div>}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-[#F97316]" : "text-[#64748B]"}`}>{dia}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardHeader><CardTitle className="text-base text-[#111827]">Status dos Pedidos</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center gap-8 py-6">
                        <div className="relative w-40 h-40">
                          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="60 40" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F97316" strokeWidth="4" strokeDasharray="25 75" strokeDashoffset="-60" strokeLinecap="round" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="4" strokeDasharray="15 85" strokeDashoffset="-85" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black">85%</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Sucesso</span>
                          </div>
                        </div>
                        <div className="w-full grid grid-cols-1 gap-3">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB]">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                              <span className="text-xs font-bold text-[#111827]">Entregues</span>
                            </div>
                            <span className="text-xs font-black text-[#111827]">60%</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB]">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                              <span className="text-xs font-bold text-[#111827]">Em Rota</span>
                            </div>
                            <span className="text-xs font-black text-[#111827]">25%</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E5E7EB]">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                              <span className="text-xs font-bold text-[#111827]">Atrasados</span>
                            </div>
                            <span className="text-xs font-black text-[#111827]">15%</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pedidos Recentes */}
                <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-[#111827]">Pedidos Recentes</CardTitle>
                    <Button variant="ghost" size="sm" className="text-[#F97316]" onClick={() => setActiveTab("pedidos")}>Ver todos →</Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {entregas.slice(0, 4).map(entrega => (
                      <div key={entrega.id} className="flex items-center justify-between p-3 bg-white rounded-xl hover:bg-[#F8FAFC] cursor-pointer transition border border-[#E5E7EB]" onClick={() => {setSelectedEntrega(entrega); setShowDetailModal(true);}}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusCores[entrega.status]}`}>
                            {getStatusIcone(entrega.status)}
                          </div>
                          <div>
                            <p className="font-medium text-[#111827]">{entrega.numero}</p>
                            <p className="text-xs text-[#475569]">{entrega.origem.cidade} → {entrega.destino.cidade}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={statusCores[entrega.status]}>{entrega.status_label}</Badge>
                          <span className="text-sm text-[#475569]">{fmtData(entrega.previsao)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== PEDIDOS ===== */}
            {activeTab === "pedidos" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-[#111827]">Pedidos</h2>
                  <div className="flex gap-3">
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger className="w-[150px] rounded-xl bg-white border-[#E5E7EB]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="programacao">Programado</SelectItem>
                        <SelectItem value="coleta">Em Coleta</SelectItem>
                        <SelectItem value="em_rota">Em Rota</SelectItem>
                        <SelectItem value="entregue">Entregue</SelectItem>
                        <SelectItem value="atrasada">Atrasado</SelectItem>
                        <SelectItem value="problema">Com Problema</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                      <SelectTrigger className="w-[140px] rounded-xl bg-white border-[#E5E7EB]">
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                        <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                        <SelectItem value="90dias">Últimos 90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="rounded-xl border-[#E5E7EB] text-[#475569] bg-white">
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                    <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl shadow-sm">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Novo Pedido
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <PortalKpiCard
                    title="Em Andamento"
                    value={entregas.filter(e => e.status !== "entregue").length}
                    icon={Truck}
                    status="em_andamento"
                    loading={initialLoading}
                  />
                  <PortalKpiCard
                    title="Atrasadas"
                    value={entregas.filter(e => e.status === "atrasada").length}
                    icon={AlertTriangle}
                    status={entregas.filter(e => e.status === "atrasada").length > 0 ? "critico" : "saudavel"}
                    loading={initialLoading}
                  />
                  <PortalKpiCard
                    title="Concluídas Hoje"
                    value={entregas.filter(e => e.status === "entregue" && new Date(e.created_at).toDateString() === new Date().toDateString()).length}
                    icon={CheckCircle}
                    status="concluido"
                    loading={initialLoading}
                  />
                  <PortalKpiCard
                    title="Sem Comprovante"
                    value={entregas.filter(e => e.status === "entregue" && !e.pod).length}
                    icon={Camera}
                    status={entregas.filter(e => e.status === "entregue" && !e.pod).length > 0 ? "atencao" : "saudavel"}
                    loading={initialLoading}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
                    {filteredEntregas.length} pedido(s) encontrado(s)
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#64748B] uppercase">Ordenar:</span>
                    <Select defaultValue="data">
                      <SelectTrigger className="w-[140px] h-9 bg-white border-[#E5E7EB] rounded-full text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="data" className="text-xs font-medium">Data</SelectItem>
                        <SelectItem value="status" className="text-xs font-medium">Status</SelectItem>
                        <SelectItem value="cliente" className="text-xs font-medium">Cliente</SelectItem>
                        <SelectItem value="valor" className="text-xs font-medium">Valor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredEntregas.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEntregas.map(entrega => (
                      <PortalDeliveryCard
                        key={entrega.id}
                        id={entrega.id}
                        osNumber={entrega.numero}
                        clientName={entrega.cliente_nome}
                        origin={{
                          city: entrega.origem.cidade,
                          uf: entrega.origem.uf,
                          neighborhood: entrega.origem.bairro,
                        }}
                        destination={{
                          city: entrega.destino.cidade,
                          uf: entrega.destino.uf,
                          neighborhood: entrega.destino.bairro,
                        }}
                        status={entrega.status as any}
                        statusLabel={entrega.status_label}
                        driver={entrega.prestador ? {
                          name: entrega.prestador.nome,
                          phone: entrega.prestador.telefone,
                          vehicle: entrega.prestador.veiculo,
                          plate: entrega.prestador.placa,
                        } : undefined}
                        sla={entrega.sla}
                        forecast={entrega.previsao}
                        hasProof={!!entrega.pod?.foto_url}
                        hasSignature={!!entrega.pod?.assinatura_url}
                        onClick={() => {setSelectedEntrega(entrega); setShowDetailModal(true);}}
                      />
                    ))}
                  </div>
                ) : (
                  <PortalEmptyState
                    type="sem-resultado"
                    title="Nenhum pedido encontrado"
                    description="Tente ajustar os filtros ou verificar novamente mais tarde."
                  />
                )}
              </div>
            )}

            {/* ===== RASTREAMENTO ===== */}
            {activeTab === "rastreio" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">Rastreamento em Tempo Real</h2>
                      <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">Acompanhe sua frota no mapa</p>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                        {entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length} ATIVOS
                      </span>
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                  </div>

                  <PortalTrackingMap
                    currentPosition={selectedEntrega?.prestador ? {
                      lat: -23.5505 + Math.random() * 0.1,
                      lng: -46.6333 + Math.random() * 0.1,
                      label: "Posição atual",
                    } : undefined}
                    origin={selectedEntrega ? {
                      lat: -23.5505,
                      lng: -46.6333,
                      label: "Origem",
                    } : undefined}
                    destination={selectedEntrega ? {
                      lat: -23.9618,
                      lng: -46.3322,
                      label: "Destino",
                    } : undefined}
                    driverName={selectedEntrega?.prestador?.nome}
                    vehicle={selectedEntrega?.prestador?.veiculo}
                    plate={selectedEntrega?.prestador?.placa}
                    status={selectedEntrega?.status || "programacao"}
                    eta={selectedEntrega?.previsao ? new Date(selectedEntrega.previsao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
                    distance={selectedEntrega ? Math.floor(Math.random() * 50) + 10 : undefined}
                  />

                  {entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-extrabold text-[#64748B] uppercase tracking-[0.2em]">Entregas em Andamento</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").slice(0, 4).map(entrega => (
                          <div
                            key={entrega.id}
                            className={`p-4 rounded-2xl cursor-pointer transition-all duration-300 group relative overflow-hidden border ${
                              selectedEntrega?.id === entrega.id
                                ? "bg-[#F97316]/10 border-[#F97316] shadow-lg shadow-[#F97316]/10"
                                : "bg-white border-[#E5E7EB] hover:border-[#F97316]/50 hover:bg-[#F8FAFC]"
                            }`}
                            onClick={() => setSelectedEntrega(entrega)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-black tracking-tight">{entrega.numero}</span>
                              <PortalStatusBadge status="em_andamento" />
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-[#475569] uppercase">
                              <MapPin className="w-3 h-3 text-[#64748B]" />
                              <span>{entrega.destino.cidade}/{entrega.destino.uf}</span>
                            </div>
                            {entrega.prestador && (
                              <div className="mt-3 flex items-center gap-2 text-[10px] font-extrabold text-[#F97316] uppercase bg-[#F97316]/5 w-fit px-2 py-0.5 rounded">
                                <Truck className="w-3 h-3" />
                                <span>{entrega.prestador.nome}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <Card className="bg-white border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl">
                    <CardHeader className="bg-[#F8FAFC] border-b border-[#E5E7EB] py-4 px-6">
                      <CardTitle className="text-xs font-extrabold uppercase tracking-widest text-[#F97316]">Informações do Pedido</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      {selectedEntrega ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                              <p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-tight mb-1">Número OS</p>
                              <p className="text-sm font-black text-[#111827]">{selectedEntrega.numero}</p>
                            </div>
                            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                              <p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-tight mb-1">Status Atual</p>
                              <div className="mt-0.5">
                                <PortalStatusBadge status={selectedEntrega.status as any} />
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                            <p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-tight mb-1">Destino Final</p>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5 text-[#F97316]" />
                              <p className="text-sm font-bold text-[#111827]">{selectedEntrega.destino.cidade}/{selectedEntrega.destino.uf}</p>
                            </div>
                          </div>

                          {selectedEntrega.prestador && (
                            <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                              <p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-tight mb-1">Recurso Atribuído</p>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#F97316]/20 flex items-center justify-center text-[#F97316] font-bold text-xs uppercase">
                                  {selectedEntrega.prestador.nome.charAt(0)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-bold text-[#111827]">{selectedEntrega.prestador.nome}</p>
                                  {selectedEntrega.prestador.veiculo && (
                                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-tighter">
                                      {selectedEntrega.prestador.veiculo} • {selectedEntrega.prestador.placa || selectedEntrega.prestador.plate || "N/A"}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                            <p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-tight mb-1">Previsão</p>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              <p className="text-sm font-bold text-[#111827]">{fmtData(selectedEntrega.previsao)} às {fmtHora(selectedEntrega.previsao)}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-8 text-center bg-[#F8FAFC] rounded-2xl border border-dashed border-[#E5E7EB]">
                          <Navigation className="w-10 h-10 text-[#64748B]/30 mx-auto mb-3" />
                          <p className="text-xs font-bold text-[#64748B] uppercase leading-relaxed">Selecione uma entrega no mapa ou na lista ao lado para ver detalhes</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="outline" className="rounded-full font-bold text-[10px] border-[#E5E7EB] text-[#475569] uppercase tracking-wider h-10 shadow-sm bg-white">
                          <ExternalLink className="w-3 h-3 mr-2 text-[#F97316]" />
                          Compartilhar
                        </Button>
                        <Button variant="outline" className="rounded-full font-bold text-[10px] border-[#E5E7EB] text-[#475569] uppercase tracking-wider h-10 shadow-sm bg-white">
                          <QrCode className="w-3 h-3 mr-2 text-[#F97316]" />
                          Etiqueta
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-[#111827]">Timeline Resumida</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedEntrega ? (
                        <PortalTimeline
                          events={selectedEntrega.historico?.map((h, idx) => ({
                            id: `${idx}`,
                            step: h.status_novo,
                            label: h.acao,
                            description: undefined,
                            timestamp: h.created_at,
                            status: idx === (selectedEntrega.historico?.length || 0) - 1 ? "current" : "completed",
                          })) || []}
                          emptyMessage="Sem histórico disponível"
                        />
                      ) : (
                        <p className="text-xs text-[#475569] text-center py-4">Selecione um pedido para ver a timeline</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ===== ROTEIRIZAÇÃO ===== */}
            {activeTab === "roteirizacao" && (
              <PortalRoteirizacao
                onGerarRoteiro={(destinos) => {
                  setRotaDestinos(destinos || []);
                  toast({ title: "Roteiro gerado", description: `${destinos?.length || 0} destinos otimizados` });
                }}
                onVerDetalhes={(rotaId) => handleVerRota(rotaId)}
              />
            )}

            {activeTab === "escala" && (
              <PortalEscalaOperacional
                onVerVeiculo={(veiculoId) => handleVerVeiculo(veiculoId)}
                onContatarMotorista={(telefone) => {
                  if (telefone) {
                    window.location.href = `tel:${telefone}`;
                  } else {
                    toast({ title: "Telefone não disponível", description: "Motorista sem celular cadastrado" });
                  }
                }}
              />
            )}

            {activeTab === "ia_operacional" && (
              <PortalIAOperacional
                onAction={(insightId) => toast({ title: "Insight registrado", description: "Nossa equipe analisará a sugestão" })}
                onNavigate={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === "multi_filial" && (
              <PortalMultiFilial
                onSelectUnidade={(unidadeId) => {
                  handleVerFilial(unidadeId);
                }}
                onConsolidado={() => {
                  toast({ title: "Visão consolidada", description: "Dados de todas as unidades" });
                }}
              />
            )}

            {activeTab === "executivo" && (
              <PortalExecutiveDashboard />
            )}

            {activeTab === "economia" && (
              <PortalEconomia />
            )}

            {activeTab === "whatsapp" && (
              <PortalWhatsApp
                onVerMensagem={(mensagemId) => {
                  toast({ title: "Mensagem selecionada", description: "ID: " + mensagemId });
                }}
              />
            )}

            {/* ===== NOTIFICAÇÕES ===== */}
            {activeTab === "notificacoes" && (
              <PortalNotificacoes
                onAction={(notificacaoId, acao) => {
                  handleNotificacaoAction(notificacaoId, acao);
                }}
              />
            )}

            {/* ===== FINANCEIRO ===== */}
            {activeTab === "financeiro" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="bg-white border-[#E5E7EB] shadow-sm group hover:shadow-md transition-all rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 border border-red-100">
                          <Wallet className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">Vencidas</p>
                          <p className="text-2xl font-black text-red-600">{fmtFin(0)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm group hover:shadow-md transition-all rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                          <CreditCard className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">A Vencer</p>
                          <p className="text-2xl font-black text-[#111827]">{fmtFin(totalAVencer)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm group hover:shadow-md transition-all rounded-2xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                          <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-[#64748B] uppercase tracking-widest mb-1">Total Pago</p>
                          <p className="text-2xl font-black text-emerald-600">{fmtFin(totalFaturado)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-white border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between bg-white border-b border-[#E5E7EB] py-4 px-6">
                    <CardTitle className="text-lg font-black text-[#111827] tracking-tight">Faturamento & Cobrança</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="rounded-full font-bold border-[#E5E7EB] text-[#475569] shadow-sm bg-white" onClick={() => handleBaixarRelatorio('financeiro')}><FileText className="w-4 h-4 mr-2" />Relatório</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-white border-b border-[#E5E7EB]">
                          <TableRow className="hover:bg-transparent border-b-0">
                            <TableHead className="font-black text-[10px] text-[#64748B] uppercase tracking-widest h-12">Fatura</TableHead>
                            <TableHead className="font-black text-[10px] text-[#64748B] uppercase tracking-widest h-12">Competência</TableHead>
                            <TableHead className="font-black text-[10px] text-[#64748B] uppercase tracking-widest h-12">Valor</TableHead>
                            <TableHead className="font-black text-[10px] text-[#64748B] uppercase tracking-widest h-12">Vencimento</TableHead>
                            <TableHead className="font-black text-[10px] text-[#64748B] uppercase tracking-widest h-12">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {faturas.length > 0 ? faturas.map(fatura => (
                            <TableRow key={fatura.id} className="hover:bg-[#F8FAFC] border-[#E5E7EB] transition-colors cursor-pointer" onClick={() => handleVerFatura(fatura.id)}>
                              <TableCell className="font-black text-sm text-[#111827]">{fatura.fatura}</TableCell>
                              <TableCell className="font-medium text-xs text-[#475569]">{fatura.competencia}</TableCell>
                              <TableCell className="font-bold text-sm text-[#111827]">{fmtFin(fatura.valor)}</TableCell>
                              <TableCell className="font-medium text-xs text-[#475569]">
                                {fatura.vencimento && new Date(fatura.vencimento).getFullYear() > 1970 ? fmtData(fatura.vencimento) : "Sem vencimento definido"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`font-bold px-3 py-1 rounded-full border-2 ${
                                  fatura.status === "paga" ? "border-emerald-500/20 text-emerald-600 bg-emerald-500/5" : 
                                  fatura.status === "a_vencer" ? "border-blue-500/20 text-blue-600 bg-blue-500/5" : 
                                  "border-red-500/20 text-red-600 bg-red-500/5"
                                }`}>
                                  {fatura.status === "paga" ? "Liquidada" : fatura.status === "a_vencer" ? "Aberta" : "Vencida"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) : (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center text-[#475569]">Nenhuma fatura encontrada.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== OCORRÊNCIAS ===== */}
            {activeTab === "ocorrencias" && (
              <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl"><CardContent className="p-6"><p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest mb-1">Abertas</p><p className="text-2xl font-black text-[#111827]">0</p></CardContent></Card>
                    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl"><CardContent className="p-6"><p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest mb-1">Em Análise</p><p className="text-2xl font-black text-amber-500">0</p></CardContent></Card>
                    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl"><CardContent className="p-6"><p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest mb-1">Resolvidas</p><p className="text-2xl font-black text-emerald-500">1</p></CardContent></Card>
                    <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl"><CardContent className="p-6"><p className="text-[10px] font-extrabold text-[#64748B] uppercase tracking-widest mb-1">SLA Atendimento</p><p className="text-2xl font-black text-[#F97316]">100%</p></CardContent></Card>
                  </div>

                <Card className="bg-white border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl">
                  <CardHeader className="flex flex-row items-center justify-between bg-[#F8FAFC] border-b border-[#E5E7EB] py-4 px-6">
                    <CardTitle className="text-lg font-black text-[#111827] tracking-tight">Ocorrências Operacionais</CardTitle>
                    <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-6 font-bold shadow-lg shadow-orange-500/20" onClick={() => setShowProblemaModal(true)}>
                      <AlertCircle className="w-4 h-4 mr-2" />Nova Ocorrência
                    </Button>
                  </CardHeader>
                  <CardContent className="p-0">
                    {ocorrencias.length === 0 ? (
                      <div className="text-center py-20 bg-[#F8FAFC]">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border-2 border-emerald-500/20">
                          <CheckCircle className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-sm font-bold text-[#475569] uppercase tracking-widest">Tudo em ordem!</p>
                        <p className="text-xs text-[#64748B] mt-1">Nenhuma ocorrência registrada no período.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E5E7EB]">
                        {ocorrencias.map(oc => (
                          <div key={oc.id} className="p-6 hover:bg-[#F8FAFC] transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${oc.status === 'resolvida' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-black text-sm text-[#111827] tracking-tight">{oc.tipo}</p>
                                <p className="text-xs font-medium text-[#475569] mt-0.5 line-clamp-1">{oc.descricao}</p>
                                <p className="text-[10px] font-bold text-[#64748B] uppercase mt-1 tracking-tighter opacity-60">{fmtData(oc.created_at)}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className={`font-black uppercase text-[10px] px-3 py-1 rounded-full border-2 ${
                              oc.status === 'resolvida' ? 'border-emerald-500/20 text-emerald-600 bg-emerald-500/5' : 'border-amber-500/20 text-amber-600 bg-amber-500/5'
                            }`}>
                              {oc.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== RELATÓRIOS ===== */}
            {activeTab === "relatorios" && (
              <div className="space-y-6">
                <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                  <CardHeader>
                    <CardTitle className="text-base text-[#111827]">Relatórios</CardTitle>
                    <p className="text-sm text-[#475569]">Baixe relatórios detalhados da sua operação</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-white border-[#E5E7EB] text-[#111827]" onClick={() => handleBaixarRelatorio('entregas')}>
                        <FileCheck className="w-6 h-6 text-[#F97316]" />
                        <span className="font-medium">Entregas por Período</span>
                        <span className="text-xs text-[#64748B]">CSV / PDF</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-white border-[#E5E7EB] text-[#111827]" onClick={() => handleBaixarRelatorio('sla')}>
                        <BarChart3 className="w-6 h-6 text-[#F97316]" />
                        <span className="font-medium">SLA e Performance</span>
                        <span className="text-xs text-[#64748B]">PDF</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-white border-[#E5E7EB] text-[#111827]" onClick={() => handleBaixarRelatorio('financeiro')}>
                        <DollarSign className="w-6 h-6 text-[#F97316]" />
                        <span className="font-medium">Financeiro</span>
                        <span className="text-xs text-[#64748B]">Excel / PDF</span>
                      </Button>
                      <Button variant="outline" className="h-auto py-4 flex-col gap-2 bg-white border-[#E5E7EB] text-[#111827]" onClick={() => handleBaixarRelatorio('ocorrencias')}>
                        <AlertCircle className="w-6 h-6 text-[#F97316]" />
                        <span className="font-medium">Ocorrências</span>
                        <span className="text-xs text-[#64748B]">CSV</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== COMPROVANTES ===== */}
            {activeTab === "comprovantes" && (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
                          <FileCheck className="w-5 h-5 text-[#F97316]" />
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Total</p>
                          <p className="text-2xl font-black text-[#111827]">{comprovantesData.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                          <Signature className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Com Assinatura</p>
                          <p className="text-2xl font-black text-[#111827]">{comprovantesData.filter(c => c.url || c.titulo).length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                          <Camera className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Com Fotos</p>
                          <p className="text-2xl font-black text-[#111827]">0</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-xs text-[#64748B] uppercase font-bold tracking-tight">Protocolos</p>
                          <p className="text-2xl font-black text-[#111827]">{protocolosData.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Header with filters */}
                <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                  <CardHeader className="pb-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg text-[#111827]">Comprovantes e Protocolos</CardTitle>
                        <p className="text-sm text-[#64748B]">Acesse fotos, assinaturas, canhotos e protocolos das entregas</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="rounded-xl border-[#E5E7EB] text-[#475569]"
                          onClick={handleBaixarTodosComprovantes}
                          disabled={comprovantesLoading}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Todos
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                      <div className="col-span-2 md:col-span-3 lg:col-span-2">
                        <Input
                          placeholder="Buscar OS ou protocolo..."
                          className="rounded-xl bg-white border-[#E5E7EB]"
                          value={filtroOS}
                          onChange={(e) => setFiltroOS(e.target.value)}
                        />
                      </div>
                      <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger className="rounded-xl bg-white border-[#E5E7EB]">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os tipos</SelectItem>
                          <SelectItem value="entrega">Entrega</SelectItem>
                          <SelectItem value="coleta">Coleta</SelectItem>
                          <SelectItem value="assinatura">Assinatura</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Destinatário"
                        className="rounded-xl bg-white border-[#E5E7EB]"
                        value={filtroDestinatario}
                        onChange={(e) => setFiltroDestinatario(e.target.value)}
                      />
                      <Input
                        placeholder="Prestador/Motorista"
                        className="rounded-xl bg-white border-[#E5E7EB]"
                        value={filtroPrestador}
                        onChange={(e) => setFiltroPrestador(e.target.value)}
                      />
                      <Input
                        placeholder="Veículo/Placa"
                        className="rounded-xl bg-white border-[#E5E7EB]"
                        value={filtroVeiculo}
                        onChange={(e) => setFiltroVeiculo(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Select value={filtroPeriodoComprov} onValueChange={setFiltroPeriodoComprov}>
                        <SelectTrigger className="w-[140px] rounded-xl bg-white border-[#E5E7EB]">
                          <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hoje">Hoje</SelectItem>
                          <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                          <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                          <SelectItem value="90dias">Últimos 90 dias</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" className="rounded-xl border-[#E5E7EB] text-[#475569] bg-white" onClick={() => { setFiltroOS(""); setFiltroDestinatario(""); setFiltroTipo("todos"); setFiltroPrestador(""); setFiltroVeiculo(""); }}>
                        Limpar Filtros
                      </Button>
                    </div>

                    {/* Loading state */}
                    {comprovantesLoading && (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#F97316]" />
                        <span className="ml-3 text-[#64748B]">Carregando comprovantes...</span>
                      </div>
                    )}

                    {/* Empty state */}
                    {!comprovantesLoading && filteredComprovantes.length === 0 && (
                      <div className="text-center py-16 bg-[#F8FAFC] rounded-2xl border-2 border-dashed border-[#E5E7EB]">
                        <FileCheck className="w-16 h-16 mx-auto text-[#64748B]/30 mb-4" />
                        <p className="text-lg font-bold text-[#111827]">Nenhum comprovante disponível ainda</p>
                        <p className="text-sm text-[#64748B] mt-2 max-w-md mx-auto">
                          Assim que uma entrega for concluída, fotos, assinatura e protocolo aparecerão aqui.
                        </p>
                      </div>
                    )}

                    {/* Comprovantes list */}
                    {!comprovantesLoading && filteredComprovantes.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredComprovantes.map((comp) => (
                          <div key={comp.id} className="p-4 bg-white rounded-xl border border-[#E5E7EB] hover:border-[#F97316]/50 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileCheck className="w-4 h-4 text-[#F97316]" />
                                <span className="text-sm font-bold text-[#111827]">{comp.titulo || "OS"}</span>
                              </div>
                              <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-500/10 text-xs">
                                {comp.tipo || "entrega"}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-xs text-[#64748B]">
                              <p className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {comp.nome_recebedor || "Não informado"}
                              </p>
                              <p className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {comp.data_entrega ? new Date(comp.data_entrega).toLocaleString("pt-BR") : "Não informado"}
                              </p>
                              {comp.documento_recebedor && (
                                <p className="flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  {comp.documento_recebedor}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 bg-white border-[#E5E7EB] text-[#475569]"
                                onClick={() => handleVerComprovante(comp.id)}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                Ver
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="flex-1 bg-white border-[#E5E7EB] text-[#475569]"
                                onClick={() => handleBaixarComprovante(comp.id)}
                              >
                                <Download className="w-3 h-3 mr-1" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Protocols Section */}
                    {!comprovantesLoading && filteredProtocolos.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-[#E5E7EB]">
                        <h3 className="text-sm font-bold text-[#111827] mb-4">Protocolos Gerados</h3>
                        <div className="space-y-2">
                          {filteredProtocolos.map((prot) => (
                            <div key={prot.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#E5E7EB]">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                  <FileText className="w-4 h-4 text-amber-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-[#111827]">{prot.protocolo}</p>
                                  <p className="text-xs text-[#64748B]">
                                    {prot.recebedor || "Recebedor não informado"} • {prot.horario ? new Date(prot.horario).toLocaleString("pt-BR") : ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {prot.status || "pendente"}
                                </Badge>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="text-[#64748B]"
                                  onClick={() => handleCopiarProtocolo(prot.protocolo)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== AVALIAÇÃO ===== */}
            {activeTab === "avaliacao" && (
              <div className="space-y-6">
                <div className="flex items-center justify-end">
                  <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white" onClick={() => setShowNovaAvaliacaoModal(true)}>
                    <Star className="w-4 h-4 mr-2" />
                    Avaliar Prestador
                  </Button>
                </div>

                {/* KPIs Premium */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <Card className="bg-gradient-to-br from-[#F97316] to-[#EA580C] border-0 shadow-lg shadow-orange-500/20">
                    <CardContent className="p-5 text-center">
                      <p className="text-4xl font-extrabold text-white">{npsScore}</p>
                      <p className="text-xs text-white/80 font-medium uppercase tracking-wider mt-1">NPS Score</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-extrabold text-[#111827]">{notaMediaGeral}</p>
                      <p className="text-xs text-[#64748B] font-medium mt-1">Nota Média</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-emerald-50 border-emerald-200 shadow-sm rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-extrabold text-emerald-600">{avaliacoes.filter(a => a.nota >= 4).length}</p>
                      <p className="text-xs text-emerald-700 font-medium mt-1">Promotores</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-extrabold text-[#111827]">{avaliacoes.length}</p>
                      <p className="text-xs text-[#64748B] font-medium mt-1">Total Avaliações</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50 border-red-200 shadow-sm rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-extrabold text-red-600">{prestadoresAlerta}</p>
                      <p className="text-xs text-red-700 font-medium mt-1">Alertas</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200 shadow-sm rounded-2xl">
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-extrabold text-blue-600">{topPrestadores.length}</p>
                      <p className="text-xs text-blue-700 font-medium mt-1">Prestadores Avaliados</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Prestadores */}
                {topPrestadores.length > 0 && (
                  <Card className="bg-gradient-to-r from-[#F8FAFC] to-white border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl">
                    <CardHeader className="bg-white border-b border-[#E5E7EB]">
                      <CardTitle className="text-base font-bold text-[#111827] flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        Ranking dos Melhores Prestadores
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {topPrestadores.map((p, idx) => (
                          <div key={p.id} className={`p-3 rounded-xl border ${idx === 0 ? "bg-amber-50 border-amber-200" : "bg-white border-[#E5E7EB]"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                                {idx + 1}
                              </span>
                              <span className="text-sm font-bold text-[#111827] truncate">{p.nome}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(s => (
                                  <Star key={s} className={`w-3 h-3 ${s <= Math.round(parseFloat(p.media)) ? "text-amber-500 fill-amber-500" : "text-slate-200"}`} />
                                ))}
                              </div>
                              <span className="text-sm font-extrabold text-amber-600">{p.media}</span>
                            </div>
                            <p className="text-[10px] text-[#64748B] mt-1">{p.count} avaliações</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card className="bg-white border-[#E5E7EB] shadow-sm overflow-hidden rounded-2xl">
                  <CardHeader className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                    <CardTitle className="text-lg font-bold text-[#111827]">Avaliações Recentes de Prestadores</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-[#E5E7EB]">
                      {avaliacoes.length > 0 ? avaliacoes.map(av => (
                        <div key={av.id} className="p-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-[#F97316] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                              {av.prestador_nome?.charAt(0) || "P"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <div>
                                  <p className="text-sm font-bold text-[#111827]">{av.prestador_nome || "Prestador"}</p>
                                  <p className="text-xs text-[#64748B]">{av.veiculo || ""} {av.placa ? `— ${av.placa}` : ""}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[1,2,3,4,5].map(s => (
                                    <Star key={s} className={`w-4 h-4 ${s <= av.nota ? "text-[#F97316] fill-[#F97316]" : "text-[#64748B]/30"}`} />
                                  ))}
                                  <span className="text-sm font-extrabold text-[#111827] ml-1">{av.nota}/5</span>
                                </div>
                              </div>

                              {/* Detalhes da avaliação */}
                              <div className="grid grid-cols-4 gap-2 mb-2">
                                <div className="text-center p-1.5 bg-[#F8FAFC] rounded-lg">
                                  <p className="text-[10px] text-[#64748B]">Pontualidade</p>
                                  <p className="text-xs font-bold text-[#111827]">{av.nota_pontualidade || 0}/5</p>
                                </div>
                                <div className="text-center p-1.5 bg-[#F8FAFC] rounded-lg">
                                  <p className="text-[10px] text-[#64748B]">Comunicação</p>
                                  <p className="text-xs font-bold text-[#111827]">{av.nota_comunicacao || 0}/5</p>
                                </div>
                                <div className="text-center p-1.5 bg-[#F8FAFC] rounded-lg">
                                  <p className="text-[10px] text-[#64748B]">Conservação</p>
                                  <p className="text-xs font-bold text-[#111827]">{av.nota_conservacao || 0}/5</p>
                                </div>
                                <div className="text-center p-1.5 bg-[#F8FAFC] rounded-lg">
                                  <p className="text-[10px] text-[#64748B]">Atendimento</p>
                                  <p className="text-xs font-bold text-[#111827]">{av.nota_atendimento || 0}/5</p>
                                </div>
                              </div>

                              {av.comentario && <p className="text-sm text-[#111827]/80 leading-relaxed mb-2">{av.comentario}</p>}
                              <div className="flex items-center gap-3 text-[10px] text-[#64748B] uppercase font-bold tracking-tighter">
                                {av.os_id && <span className="flex items-center gap-1"><FileText className="w-3 h-3" />OS: {av.os_id}</span>}
                                {av.entrega_origem && av.entrega_destino && (
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{av.entrega_origem} → {av.entrega_destino}</span>
                                )}
                                <span className="ml-auto">{fmtData(av.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="p-12 text-center">
                          <Star className="w-12 h-12 mx-auto text-[#64748B]/30 mb-3" />
                          <p className="text-base font-bold text-[#111827]">Nenhuma avaliação de prestador ainda</p>
                          <p className="text-sm text-[#64748B] mt-1">Avalie o prestador após a conclusão da entrega.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Modal Detalhe do Pedido */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl bg-white border-[#E5E7EB] max-h-screen overflow-hidden flex flex-col p-0 gap-0 shadow-2xl">
          <DialogHeader className="p-6 bg-[#F8FAFC] border-b border-[#E5E7EB] flex-shrink-0">
            <DialogTitle className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F97316] flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold text-[#111827] tracking-tight">{selectedEntrega?.numero}</span>
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-widest">{selectedEntrega?.cliente_nome || "Detalhes do Pedido"}</span>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <p className="text-sm text-[#475569]">Modal content placeholder</p>
          </div>
</DialogContent>
      </Dialog>

      {/* Modal Reportar Problema */}
      <Dialog open={showProblemaModal} onOpenChange={setShowProblemaModal}>
        <DialogContent className="bg-white border-[#E5E7EB] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#111827]">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Reportar Ocorrência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider text-[#64748B]">Tipo de Ocorrência</Label>
              <Select value={novaOcorrencia.tipo} onValueChange={(v) => setNovaOcorrencia({...novaOcorrencia, tipo: v})}>
                <SelectTrigger className="bg-white border-[#E5E7EB]">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atraso">Atraso na Entrega</SelectItem>
                  <SelectItem value="nao_encontrado">Destinatário Ausente</SelectItem>
                  <SelectItem value="avariado">Produto Avariado</SelectItem>
                  <SelectItem value="falta">Divergência de Itens</SelectItem>
                  <SelectItem value="outro">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-bold text-xs uppercase tracking-wider text-[#64748B]">Descrição Detalhada</Label>
              <Textarea 
                placeholder="Descreva o que aconteceu para que nossa torre de controle possa atuar..." 
                className="bg-white border-[#E5E7EB] min-h-[120px] resize-none"
                value={novaOcorrencia.descricao}
                onChange={(e) => setNovaOcorrencia({...novaOcorrencia, descricao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="bg-white border-[#E5E7EB] text-[#475569]" onClick={() => setShowProblemaModal(false)}>Cancelar</Button>
            <Button className="bg-red-500 hover:bg-red-600 text-white" onClick={handleReportarOcorrencia}>Enviar Reporte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Pedido */}
      <Dialog open={showNovoPedidoModal} onOpenChange={setShowNovoPedidoModal}>
        <DialogContent className="max-w-3xl bg-white border-[#E5E7EB] max-h-screen overflow-hidden flex flex-col p-0 shadow-2xl">
          <DialogHeader className="p-6 bg-[#F8FAFC] border-b border-[#E5E7EB]">
            <DialogTitle className="text-xl font-extrabold text-[#111827] tracking-tight">Solicitar Novo Transporte</DialogTitle>
            <DialogDescription className="font-medium text-[#475569]">Preencha os dados básicos para cotação e agendamento.</DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F97316]">Informações de Local</h4>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase">CEP Origem</Label>
                  <Input placeholder="00000-000" className="bg-white border-[#E5E7EB]" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase">CEP Destino</Label>
                  <Input placeholder="00000-000" className="bg-white border-[#E5E7EB]" />
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#F97316]">Carga e Mercadoria</h4>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#64748B] uppercase">Descrição</Label>
                  <Input placeholder="Ex: Peças automotivas, Eletrônicos..." className="bg-white border-[#E5E7EB]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#64748B] uppercase">Peso (kg)</Label>
                    <Input type="number" placeholder="0" className="bg-white border-[#E5E7EB]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#64748B] uppercase">Volumes</Label>
                    <Input type="number" placeholder="0" className="bg-white border-[#E5E7EB]" />
                  </div>
                </div>
              </div>
              <div className="col-span-1 md:col-span-2 space-y-2">
                <Label className="text-xs font-bold text-[#64748B] uppercase">Observações Adicionais</Label>
                <Textarea placeholder="Instruções de entrega, horários, contatos específicos..." className="bg-white border-[#E5E7EB] min-h-[100px]" />
              </div>
            </div>
          </div>
<DialogFooter className="p-6 bg-[#F8FAFC] border-t border-[#E5E7EB] gap-2">
            <Button variant="outline" className="rounded-full px-6 font-bold bg-white border-[#E5E7EB] text-[#475569]" onClick={() => setShowNovoPedidoModal(false)}>Descartar</Button>
            <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-8 font-bold shadow-lg shadow-orange-500/20 transition-all hover:scale-105 active:scale-95">Criar Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe Comprovante */}
      <Dialog open={showComprovanteModal} onOpenChange={setShowComprovanteModal}>
        <DialogContent className="max-w-2xl bg-white border-[#E5E7EB] max-h-screen overflow-hidden flex flex-col p-0 gap-0 shadow-2xl">
          <DialogHeader className="p-6 bg-[#F8FAFC] border-b border-[#E5E7EB] flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-extrabold text-[#111827]">{selectedComprovante?.titulo || "Comprovante"}</span>
                <p className="text-xs font-medium text-[#64748B] uppercase">Detalhes do Comprovante</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Tipo</p>
                <p className="text-sm font-bold text-[#111827]">{selectedComprovante?.tipo || "Não informado"}</p>
              </div>
              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">Status</p>
                <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-500/10">Concluído</Badge>
              </div>
            </div>
            
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Recebedor</p>
              <div className="space-y-2">
                <p className="text-sm font-bold text-[#111827]">{selectedComprovante?.nome_recebedor || "Não informado"}</p>
                {selectedComprovante?.documento_recebedor && (
                  <p className="text-xs text-[#64748B]">{selectedComprovante.documento_recebedor}</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Data da Entrega</p>
              <p className="text-sm font-bold text-[#111827]">
                {selectedComprovante?.data_entrega 
                  ? new Date(selectedComprovante.data_entrega).toLocaleString("pt-BR")
                  : "Não informado"}
              </p>
            </div>

            {selectedComprovante?.url && (
              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Documento</p>
                <Button 
                  variant="outline" 
                  className="w-full border-[#E5E7EB]"
                  onClick={() => window.open(selectedComprovante.url!, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Abrir Documento
                </Button>
              </div>
            )}
          </div>
          <DialogFooter className="p-4 bg-[#F8FAFC] border-t border-[#E5E7EB] gap-2 flex-shrink-0">
            <Button variant="outline" className="bg-white border-[#E5E7EB] text-[#475569]" onClick={() => setShowComprovanteModal(false)}>Fechar</Button>
            <Button
              className="bg-[#F97316] hover:bg-[#EA580C] text-white"
              onClick={() => handleBaixarComprovante(selectedComprovante?.id || "")}
            >
              <Download className="w-4 h-4 mr-2" />
              Baixar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNovaAvaliacaoModal} onOpenChange={setShowNovaAvaliacaoModal}>
        <DialogContent className="max-w-2xl bg-white border-[#E5E7EB] shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="bg-gradient-to-r from-[#F97316] to-[#EA580C] p-6 text-white">
            <DialogTitle className="flex items-center gap-3 text-xl font-extrabold text-white">
              <Star className="w-6 h-6 fill-white" />
              Avaliar Prestador da Entrega
            </DialogTitle>
            <DialogDescription className="text-white/80 font-medium">
              Avalie o desempenho do prestador/motorista
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* Seleção do Prestador */}
            <div className="p-4 bg-[#F8FAFC] rounded-2xl border border-[#E5E7EB]">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider block mb-3">Selecione o Prestador *</label>
              <div className="grid grid-cols-2 gap-3">
                {prestadoresDisponiveis.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPrestadorAvaliacao({ ...p, entrega_origem: "São Paulo/SP", entrega_destino: "Campinas/SP" })}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      selectedPrestadorAvaliacao?.id === p.id
                        ? "border-[#F97316] bg-orange-50 shadow-md shadow-orange-100"
                        : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#F97316] flex items-center justify-center text-white font-bold text-sm">
                        {p.nome.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#111827] truncate">{p.nome}</p>
                        <p className="text-[10px] text-[#64748B]">{p.veiculo} — {p.placa}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className={`w-3 h-3 ${(p.nota_media || 0) >= 4 ? "text-amber-500 fill-amber-500" : "text-slate-300"}`} />
                        <span className="text-xs font-bold text-[#111827]">{(p.nota_media || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* OS Vinculada */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">OS Vinculada</label>
              <Input
                placeholder="Ex: OS-202610-1045"
                className="bg-white border-[#E5E7EB] h-11"
                value={avaliacaoOS}
                onChange={(e) => setAvaliacaoOS(e.target.value)}
              />
            </div>

            {/* Critérios de Avaliação */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[#111827] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
                Critérios de Avaliação
              </h4>

              {/* Avaliação Geral */}
              <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-[#111827]">Avaliação Geral *</label>
                  <span className="text-xs font-bold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full">
                    {avaliacaoNota > 0 ? `${avaliacaoNota}/5` : "Selecione"}
                  </span>
                </div>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setAvaliacaoNota(s)}
                      className="p-1 rounded-lg hover:bg-white/50 transition-colors"
                    >
                      <Star className={`w-10 h-10 transition-all ${s <= avaliacaoNota ? "text-[#F97316] fill-[#F97316] scale-110" : "text-slate-300"}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Critérios em Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Pontualidade", value: avaliacaoPontualidade, set: setAvaliacaoPontualidade, icon: Clock },
                  { label: "Comunicação", value: avaliacaoComunicacao, set: setAvaliacaoComunicacao, icon: MessageSquare },
                  { label: "Conservação do Veículo", value: avaliacaoConservacao, set: setAvaliacaoConservacao, icon: Truck },
                  { label: "Atendimento do Motorista", value: avaliacaoAtendimento, set: setAvaliacaoAtendimento, icon: User },
                ].map(({ label, value, set, icon: IconComp }) => (
                  <div key={label} className="p-3 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComp className="w-4 h-4 text-[#64748B]" />
                      <label className="text-xs font-bold text-[#64748B]">{label}</label>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set(s)}
                          className="flex-1"
                        >
                          <Star className={`w-5 h-5 mx-auto ${s <= value ? "text-[#F97316] fill-[#F97316]" : "text-slate-200"}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NPS */}
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-[#111827]">NPS (Recomendaria?)</label>
                <span className={`text-sm font-extrabold px-3 py-1 rounded-full ${
                  avaliacaoNps >= 9 ? "bg-emerald-100 text-emerald-700" :
                  avaliacaoNps >= 7 ? "bg-blue-100 text-blue-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {avaliacaoNps}
                </span>
              </div>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAvaliacaoNps(n)}
                    className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${
                      n === avaliacaoNps
                        ? n >= 9 ? "bg-emerald-500 text-white shadow-md" : n >= 7 ? "bg-blue-500 text-white shadow-md" : "bg-red-500 text-white shadow-md"
                        : "bg-white text-[#475569] hover:bg-[#E5E7EB] border border-[#E5E7EB]"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-[#64748B] mt-2">
                <span>Não recomendaria</span>
                <span>Recomendaria</span>
              </div>
            </div>

            {/* Comentário */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Comentário</label>
              <Textarea
                placeholder="Descreva sua experiência com o prestador (opcional)..."
                className="bg-white border-[#E5E7EB] min-h-[100px] resize-none"
                value={avaliacaoComentario}
                onChange={(e) => setAvaliacaoComentario(e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] border-t border-[#E5E7EB] flex justify-end gap-2 flex-shrink-0">
            <Button variant="outline" className="bg-white border-[#E5E7EB]" onClick={() => setShowNovaAvaliacaoModal(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#F97316] hover:bg-[#EA580C] text-white px-8"
              onClick={handleEnviarAvaliacao}
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Avaliação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}