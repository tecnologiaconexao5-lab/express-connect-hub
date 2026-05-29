import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Package, PlusCircle, FileText, DollarSign, LogOut, Search, Download, MapPin, Clock, CheckCircle, AlertTriangle, 
  Truck, User, Phone, Mail, ChevronRight, ChevronUp, ChevronDown, X, Camera, Signature, MapPinned, Activity, Calendar, BarChart3, 
  Send, Route, Users, FileUp, AlertCircle, TrendingUp, Wallet, CreditCard, Bell, Settings, LogIn,
  Clock3, Package2, Navigation, CheckCheck, MoreHorizontal, Eye, PhoneCall, MessageSquare, Play, Pause,
  Grid3X3, List, Calculator, Map, Navigation2, Star, ThumbsUp, ThumbsDown, Minus, Plus, Filter,
  QrCode, ExternalLink, RefreshCw, Moon, Sun, Building2, Home, Briefcase, Ruler, Scale, ArrowRight,
  FilePlus, FileCheck, History, Award, TrendingDown, TrendingEqual, Brain, Zap, Copy, Trash2
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
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
  gerarResumoInteligente,
  gerarSugestaoInteligente,
  calcularTempoRota,
  sugerirVeiculoAvancado,
  type PedidoPortal,
  type ResumoInteligente,
  statusCores,
  prioridadeCores,
} from "@/services/portalCliente/pedidosService";

const fmtFin = (v: number | null | undefined) => {
  if (v === null || v === undefined || isNaN(v)) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const fmtData = (d: string | null | undefined) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtHora = (d: string | null | undefined) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

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

const diasAtrasStr = (dias: number, hora: string = "08:00:00") => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  const datePart = d.toISOString().split("T")[0];
  return `${datePart}T${hora}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl">
        <p className="text-xs font-bold text-slate-400 mb-1.5">{label}</p>
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-xs my-0.5">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}:
            </span>
            <span className="font-bold" style={{ color: item.color }}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
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
  { id: "carregamento", icon: Package2, label: "Carregamento" },
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
  const [expandedStops, setExpandedStops] = useState<Record<number, boolean>>({ 0: true });
  const [coletaSearch, setColetaSearch] = useState("");
  const [destinosSearch, setDestinosSearch] = useState<Record<number, string>>({});
  const [criandoPedido, setCriandoPedido] = useState(false);
  const [janelas, setJanelas] = useState<{ das: string; ate: string }[]>([
    { das: "08:00", ate: "12:00" }
  ]);
  const [sugestoesFavColeta, setSugestoesFavColeta] = useState<any[]>([]);
  const [sugestoesFavDestinos, setSugestoesFavDestinos] = useState<{ [index: number]: any[] }>({});
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

  useEffect(() => {
    const formatted = janelas
      .filter(j => j.das && j.ate)
      .map(j => `${j.das} às ${j.ate}`)
      .join(", ");
    setNovoPedidoData(prev => ({ ...prev, janela_recebimento: formatted }));
  }, [janelas]);

  const togglePinFavorite = (id: string) => {
    setFavoritosList(prev => {
      const updated = prev.map(f => {
        if (f.id === id) {
          return { ...f, fixado: !f.fixado };
        }
        return f;
      });
      localStorage.setItem("portal_enderecos_favoritos", JSON.stringify(updated));
      return updated;
    });
    toast({
      title: "Favorito Atualizado",
      description: "Status do favorito alterado."
    });
  };
  
  const [showSucessoModal, setShowSucessoModal] = useState(false);
  const [createdOrderDetails, setCreatedOrderDetails] = useState<any>(null);
  const [novoPedidoStep, setNovoPedidoStep] = useState(1);
  const [novoPedidoData, setNovoPedidoData] = useState({
    // Coleta
    coleta_cep: "",
    coleta_rua: "",
    coleta_numero: "",
    coleta_complemento: "",
    coleta_bairro: "",
    coleta_cidade: "",
    coleta_uf: "",
    coleta_referencia: "",
    coleta_data: "",
    coleta_contato_nome: "",
    coleta_contato_telefone: "",
    coleta_contato_ramal: "",
    coleta_orientacoes: "",
    
    // Destinos
    destinos: [
      {
        cep: "",
        rua: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        referencia: "",
        data: "",
        contato_nome: "",
        contato_telefone: "",
        contato_ramal: "",
        orientacoes: "",
        destinatario: "",
        email: "",
        notifyRecipientWhatsapp: false,
        recipientWhatsapp: "",
      }
    ],
    
    // Mercadoria
    descricao: "",
    volumes: 1,
    peso: 0,
    comprimento: "",
    largura: "",
    altura: "",
    valor_declarado: "",
    tipo_carga: "seca",
    fragilidade: "normal",
    observacoes: "",
    necessidades: [] as string[],
    temperatura_minima: "",
    temperatura_maxima: "",
    
    // Orientações / Recebimento
    permitir_terceiros: false,
    autorizados_receber: "",
    horario_limite: "",
    janela_recebimento: "",
    orientacoes_rapidas: [] as string[],
    instrucoes_adicionais: "",
    
    // Notificações elegantes
    notificar_automacao: false,
    notificar_canal: "whatsapp" as "whatsapp" | "email" | "ambos",
    notificar_motorista_saiu: false,
    notificar_proximo_destino: false,
    notificar_entrega_concluida: false,
    notificar_ocorrencia: false,
  });
  const [sugestoesColeta, setSugestoesColeta] = useState<any[]>([]);
  const [sugestoesDestinos, setSugestoesDestinos] = useState<{ [index: number]: any[] }>({});
  const [isSearchingMapbox, setIsSearchingMapbox] = useState(false);
  const [favoritosList, setFavoritosList] = useState<any[]>(() => {
    try {
      const local = localStorage.getItem("portal_enderecos_favoritos");
      return local ? JSON.parse(local) : [
        { id: "fav-1", label: "CD Principal Diadema", cep: "09961-360", rua: "Av. Fagundes de Oliveira", numero: "190", complemento: "Galpão A1", bairro: "Piraporinha", cidade: "Diadema", uf: "SP", referencia: "", contato_nome: "Geraldo Expedição", contato_telefone: "(11) 98877-6655", contato_ramal: "12", email: "diadema@empresa.com", usado_contagem: 5, fixado: true, data_ultimo_uso: new Date().toISOString() },
        { id: "fav-2", label: "Filial Vila Maria", cep: "02170-000", rua: "Rua Curuçá", numero: "1050", complemento: "", bairro: "Vila Maria", cidade: "São Paulo", uf: "SP", referencia: "Próximo à Dutra", contato_nome: "Fabiana Recebimento", contato_telefone: "(11) 97766-5544", contato_ramal: "", email: "vilamaria@empresa.com", usado_contagem: 3, fixado: false, data_ultimo_uso: "" },
        { id: "fav-3", label: "Casa da Izabel", cep: "04012-001", rua: "Rua Vergueiro", numero: "1350", complemento: "Apto 42", bairro: "Vila Mariana", cidade: "São Paulo", uf: "SP", referencia: "", contato_nome: "Izabel Silva", contato_telefone: "(11) 96655-4433", contato_ramal: "", email: "izabel@gmail.com", usado_contagem: 8, fixado: true, data_ultimo_uso: new Date().toISOString() },
        { id: "fav-4", label: "Mercado Central", cep: "01021-000", rua: "Rua da Cantareira", numero: "306", complemento: "Box 14", bairro: "Centro", cidade: "São Paulo", uf: "SP", referencia: "", contato_nome: "Marcos Hortifruti", contato_telefone: "(11) 95544-3322", contato_ramal: "30", email: "marcos@mercadocentral.com.br", usado_contagem: 2, fixado: false, data_ultimo_uso: "" }
      ];
    } catch {
      return [];
    }
  });

  const [showCarregamentoDetailModal, setShowCarregamentoDetailModal] = useState(false);
  const [selectedCarregamento, setSelectedCarregamento] = useState<any>(null);
  const [filaOrdem, setFilaOrdem] = useState("chegada");
  const [carregamentos, setCarregamentos] = useState<any[]>([]);

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const buscarCep = async (cep: string, tipo: "coleta" | number) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (response.ok) {
        const data = await response.json();
        if (data.erro) {
          toast({
            title: "Erro ao buscar CEP",
            description: "CEP não encontrado ou inválido.",
            variant: "destructive"
          });
          return;
        }
        
        const street = data.logradouro || "";
        if (tipo === "coleta") {
          setNovoPedidoData(prev => ({
            ...prev,
            coleta_rua: street,
            coleta_bairro: data.bairro || "",
            coleta_cidade: data.localidade || "",
            coleta_uf: data.uf || "",
          }));
          setColetaSearch(street);
        } else {
          setNovoPedidoData(prev => {
            const novosDestinos = [...prev.destinos];
            if (novosDestinos[tipo]) {
              novosDestinos[tipo] = {
                ...novosDestinos[tipo],
                rua: street,
                bairro: data.bairro || "",
                cidade: data.localidade || "",
                uf: data.uf || "",
              };
            }
            return { ...prev, destinos: novosDestinos };
          });
          setDestinosSearch(prev => ({ ...prev, [tipo]: street }));
        }
      }
    } catch (err) {
      console.error("Erro ao buscar CEP:", err);
    }
  };

  const handleMapboxSearch = async (query: string, tipo: "coleta" | number) => {
    // Match local favorites
    if (query && query.trim().length >= 2) {
      const q = query.toLowerCase();
      const matchingFavs = favoritosList.filter(f => 
        f.label.toLowerCase().includes(q) || 
        (f.contato_nome && f.contato_nome.toLowerCase().includes(q))
      );
      if (tipo === "coleta") {
        setSugestoesFavColeta(matchingFavs);
      } else {
        setSugestoesFavDestinos(prev => ({ ...prev, [tipo]: matchingFavs }));
      }
    } else {
      if (tipo === "coleta") {
        setSugestoesFavColeta([]);
      } else {
        setSugestoesFavDestinos(prev => ({ ...prev, [tipo]: [] }));
      }
    }

    if (!query || query.trim().length < 3) {
      if (tipo === "coleta") {
        setSugestoesColeta([]);
      } else {
        setSugestoesDestinos(prev => ({ ...prev, [tipo]: [] }));
      }
      return;
    }
    
    setIsSearchingMapbox(true);
    try {
      const { buscarSugestoesEnderecos } = await import("@/services/maps/mapboxProvider");
      const suggestions = await buscarSugestoesEnderecos(query);
      if (tipo === "coleta") {
        setSugestoesColeta(suggestions);
      } else {
        setSugestoesDestinos(prev => ({ ...prev, [tipo]: suggestions }));
      }
    } catch (err) {
      console.error("Erro ao buscar no Mapbox:", err);
    } finally {
      setIsSearchingMapbox(false);
    }
  };

  const handleSelectMapboxSuggestion = (suggestion: any, tipo: "coleta" | number) => {
    const mainText = suggestion.rua 
      ? `${suggestion.rua}${suggestion.numero ? `, ${suggestion.numero}` : ""}`
      : suggestion.place_name.split(",")[0];

    if (tipo === "coleta") {
      setNovoPedidoData(prev => ({
        ...prev,
        coleta_cep: suggestion.cep || prev.coleta_cep,
        coleta_rua: suggestion.rua || prev.coleta_rua,
        coleta_bairro: suggestion.bairro || prev.coleta_bairro,
        coleta_cidade: suggestion.cidade || prev.coleta_cidade,
        coleta_uf: suggestion.uf || prev.coleta_uf,
      }));
      setColetaSearch(mainText);
      setSugestoesColeta([]);
    } else {
      setNovoPedidoData(prev => {
        const novosDestinos = [...prev.destinos];
        if (novosDestinos[tipo]) {
          novosDestinos[tipo] = {
            ...novosDestinos[tipo],
            cep: suggestion.cep || novosDestinos[tipo].cep,
            rua: suggestion.rua || novosDestinos[tipo].rua,
            bairro: suggestion.bairro || novosDestinos[tipo].bairro,
            cidade: suggestion.cidade || novosDestinos[tipo].cidade,
            uf: suggestion.uf || novosDestinos[tipo].uf,
          };
        }
        return { ...prev, destinos: novosDestinos };
      });
      setDestinosSearch(prev => ({ ...prev, [tipo]: mainText }));
      setSugestoesDestinos(prev => ({ ...prev, [tipo]: [] }));
    }
  };

  const adicionarDestino = () => {
    const nextIndex = novoPedidoData.destinos.length;
    setNovoPedidoData(prev => ({
      ...prev,
      destinos: [
        ...prev.destinos,
        {
          cep: "",
          rua: "",
          numero: "",
          complemento: "",
          bairro: "",
          cidade: "",
          uf: "",
          referencia: "",
          data: "",
          contato_nome: "",
          contato_telefone: "",
          contato_ramal: "",
          orientacoes: "",
          destinatario: "",
          email: "",
          notifyRecipientWhatsapp: false,
          recipientWhatsapp: "",
        }
      ]
    }));
    
    setExpandedStops(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        next[Number(k)] = false;
      });
      next[nextIndex] = true;
      return next;
    });

    setTimeout(() => {
      const card = document.getElementById(`destino-card-${nextIndex}`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const input = document.getElementById(`destino-cep-${nextIndex}`);
      if (input) {
        input.focus();
      }
    }, 200);
  };

  const removerDestino = (index: number) => {
    setNovoPedidoData(prev => {
      if (prev.destinos.length <= 1) {
        toast({
          title: "Não é possível remover",
          description: "Você precisa ter pelo menos um destino.",
          variant: "destructive"
        });
        return prev;
      }
      return {
        ...prev,
        destinos: prev.destinos.filter((_, i) => i !== index)
      };
    });
    setExpandedStops(prev => {
      const next: Record<number, boolean> = {};
      let nextIdx = 0;
      Object.keys(prev).forEach(k => {
        const keyInt = Number(k);
        if (keyInt !== index) {
          next[nextIdx] = prev[keyInt];
          nextIdx++;
        }
      });
      if (Object.values(next).every(v => !v)) {
        next[0] = true;
      }
      return next;
    });
  };

  const moverDestino = (index: number, direcao: "cima" | "baixo") => {
    const targetIndex = direcao === "cima" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= novoPedidoData.destinos.length) return;

    setNovoPedidoData(prev => {
      const novosDestinos = [...prev.destinos];
      const temp = novosDestinos[index];
      novosDestinos[index] = novosDestinos[targetIndex];
      novosDestinos[targetIndex] = temp;
      return { ...prev, destinos: novosDestinos };
    });

    setExpandedStops(prev => {
      const next = { ...prev };
      const tempExpanded = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = tempExpanded;
      return next;
    });
  };

  const handleSaveFavorite = (label: string, address: any) => {
    if (!label.trim()) return;
    const newFav = {
      id: `fav-${Date.now()}`,
      label,
      cep: address.cep || "",
      rua: address.rua || "",
      numero: address.numero || "",
      complemento: address.complemento || "",
      bairro: address.bairro || "",
      cidade: address.cidade || "",
      uf: address.uf || "",
      referencia: address.referencia || "",
      contato_nome: address.contato_nome || "",
      contato_telefone: address.contato_telefone || "",
      contato_ramal: address.contato_ramal || "",
      email: address.email || "",
      notifyRecipientWhatsapp: address.notifyRecipientWhatsapp || false,
      recipientWhatsapp: address.recipientWhatsapp || "",
      usado_contagem: 0,
      fixado: false,
      data_criacao: new Date().toISOString(),
      data_ultimo_uso: ""
    };
    
    setFavoritosList(prev => {
      const updated = [...prev, newFav];
      localStorage.setItem("portal_enderecos_favoritos", JSON.stringify(updated));
      return updated;
    });
    
    toast({
      title: "Endereço Salvo",
      description: `"${label}" foi adicionado aos seus favoritos.`
    });
  };

  const handleApplyFavorite = (fav: any, tipo: "coleta" | number) => {
    setFavoritosList(prev => {
      const updated = prev.map(f => {
        if (f.id === fav.id) {
          return {
            ...f,
            usado_contagem: (f.usado_contagem || 0) + 1,
            data_ultimo_uso: new Date().toISOString()
          };
        }
        return f;
      });
      localStorage.setItem("portal_enderecos_favoritos", JSON.stringify(updated));
      return updated;
    });

    if (tipo === "coleta") {
      setNovoPedidoData(prev => ({
        ...prev,
        coleta_cep: fav.cep || "",
        coleta_rua: fav.rua || "",
        coleta_numero: fav.numero || "",
        coleta_complemento: fav.complemento || "",
        coleta_bairro: fav.bairro || "",
        coleta_cidade: fav.cidade || "",
        coleta_uf: fav.uf || "",
        coleta_referencia: fav.referencia || "",
        coleta_contato_nome: fav.contato_nome || "",
        coleta_contato_telefone: fav.contato_telefone || "",
        coleta_contato_ramal: fav.contato_ramal || "",
      }));
      setColetaSearch(fav.label);
    } else {
      setNovoPedidoData(prev => {
        const novosDestinos = [...prev.destinos];
        if (novosDestinos[tipo]) {
          novosDestinos[tipo] = {
            ...novosDestinos[tipo],
            cep: fav.cep || "",
            rua: fav.rua || "",
            numero: fav.numero || "",
            complemento: fav.complemento || "",
            bairro: fav.bairro || "",
            cidade: fav.cidade || "",
            uf: fav.uf || "",
            referencia: fav.referencia || "",
            contato_nome: fav.contato_nome || "",
            contato_telefone: fav.contato_telefone || "",
            contato_ramal: fav.contato_ramal || "",
            destinatario: fav.contato_nome || "",
            email: fav.email || "",
            notifyRecipientWhatsapp: fav.notifyRecipientWhatsapp || false,
            recipientWhatsapp: fav.recipientWhatsapp || "",
          };
        }
        return { ...prev, destinos: novosDestinos };
      });
      setDestinosSearch(prev => ({ ...prev, [tipo]: fav.label }));
    }
    toast({
      title: "Endereço Aplicado",
      description: `Endereço "${fav.label}" preenchido.`
    });
  };

  const resumo = useMemo<ResumoInteligente>(() => gerarResumoInteligente(
    novoPedidoData.peso,
    novoPedidoData.comprimento,
    novoPedidoData.largura,
    novoPedidoData.altura,
    novoPedidoData.necessidades,
    novoPedidoData.destinos,
    novoPedidoData.coleta_cidade,
    novoPedidoData.coleta_uf,
    novoPedidoData.fragilidade
  ), [novoPedidoData.peso, novoPedidoData.comprimento, novoPedidoData.largura, novoPedidoData.altura,
      novoPedidoData.necessidades, novoPedidoData.destinos, novoPedidoData.coleta_cidade,
      novoPedidoData.coleta_uf, novoPedidoData.fragilidade]);

  const sugestao = useMemo(() => gerarSugestaoInteligente(
    resumo.km,
    novoPedidoData.destinos.length,
    novoPedidoData.horario_limite,
    novoPedidoData.necessidades,
    Number(novoPedidoData.peso) || 0
  ), [resumo.km, novoPedidoData.destinos.length, novoPedidoData.horario_limite,
      novoPedidoData.necessidades, novoPedidoData.peso]);

  const handleCriarPedido = async () => {
    try {
      if (!novoPedidoData.destinos[0]?.destinatario?.trim()) {
        toast({
          title: "Erro de validação",
          description: "O nome do destinatário é obrigatório.",
          variant: "destructive"
        });
        return;
      }
      
      setCriandoPedido(true);
      const destinoFinal = novoPedidoData.destinos[novoPedidoData.destinos.length - 1];
      
      const payload: PedidoFormData = {
        solicitante_nome: user?.name || "Cliente Portal",
        solicitante_email: user?.email || "",
        solicitante_telefone: "",
        
        coleta_cep: novoPedidoData.coleta_cep,
        coleta_rua: novoPedidoData.coleta_rua,
        coleta_numero: novoPedidoData.coleta_numero,
        coleta_complemento: novoPedidoData.coleta_complemento,
        coleta_bairro: novoPedidoData.coleta_bairro,
        coleta_cidade: novoPedidoData.coleta_cidade,
        coleta_uf: novoPedidoData.coleta_uf,
        coleta_referencia: novoPedidoData.coleta_referencia,
        coleta_data: novoPedidoData.coleta_data || new Date().toISOString(),
        
        entrega_destinatario: destinoFinal.destinatario,
        entrega_telefone: destinoFinal.contato_telefone,
        entrega_email: destinoFinal.email,
        entrega_notificar_whatsapp: destinoFinal.notifyRecipientWhatsapp,
        entrega_notificar_email: !!destinoFinal.email,
        entrega_cep: destinoFinal.cep,
        entrega_rua: destinoFinal.rua,
        entrega_numero: destinoFinal.numero,
        entrega_complemento: destinoFinal.complemento,
        entrega_bairro: destinoFinal.bairro,
        entrega_cidade: destinoFinal.cidade,
        entrega_uf: destinoFinal.uf,
        entrega_referencia: destinoFinal.referencia,
        entrega_data: destinoFinal.data || new Date().toISOString(),
        
        descricao: novoPedidoData.descricao,
        volumes: Number(novoPedidoData.volumes) || 1,
        peso: Number(novoPedidoData.peso) || 0,
        comprimento: Number(novoPedidoData.comprimento) || undefined,
        largura: Number(novoPedidoData.largura) || undefined,
        altura: Number(novoPedidoData.altura) || undefined,
        valor_declarado: Number(novoPedidoData.valor_declarado) || undefined,
        tipo_carga: novoPedidoData.tipo_carga,
        observacoes: novoPedidoData.observacoes,
        
        metadata: {
          solicitacao_via: "portal_cliente",
          fragilidade: novoPedidoData.fragilidade,
          necessidades: novoPedidoData.necessidades,
          temperatura_minima: novoPedidoData.temperatura_minima,
          temperatura_maxima: novoPedidoData.temperatura_maxima,
          permitir_terceiros: novoPedidoData.permitir_terceiros,
          autorizados_receber: novoPedidoData.autorizados_receber,
          horario_limite: novoPedidoData.horario_limite,
          janela_recebimento: novoPedidoData.janela_recebimento,
          protocolos_operacionais: novoPedidoData.orientacoes_rapidas,
          instrucoes_adicionais: novoPedidoData.instrucoes_adicionais,
          notificacoes: {
            automacao: novoPedidoData.notificar_automacao,
            canal: novoPedidoData.notificar_canal,
            alertas: {
              motorista_saiu: novoPedidoData.notificar_motorista_saiu,
              proximo_destino: novoPedidoData.notificar_proximo_destino,
              entrega_concluida: novoPedidoData.notificar_entrega_concluida,
              ocorrencia: novoPedidoData.notificar_ocorrencia,
            }
          },
          paradas: novoPedidoData.destinos.map(d => ({
            cep: d.cep,
            rua: d.rua,
            numero: d.numero,
            complemento: d.complemento,
            bairro: d.bairro,
            cidade: d.cidade,
            uf: d.uf,
            referencia: d.referencia,
            data: d.data,
            contato_nome: d.contato_nome,
            contato_telefone: d.contato_telefone,
            contato_ramal: d.contato_ramal,
            orientacoes: d.orientacoes,
            destinatario: d.destinatario,
            email: d.email,
            notify_whatsapp: d.notifyRecipientWhatsapp,
            recipient_whatsapp: d.recipientWhatsapp
          })),
          coleta_contato_nome: novoPedidoData.coleta_contato_nome,
          coleta_contato_telefone: novoPedidoData.coleta_contato_telefone,
          coleta_contato_ramal: novoPedidoData.coleta_contato_ramal,
          coleta_orientacoes: novoPedidoData.coleta_orientacoes
        }
      };
      
      const novoPed = await criarPedidoPortal(payload, clienteData?.id);
      if (novoPed) {
        setCreatedOrderDetails(novoPed);
        setShowNovoPedidoModal(false);
        setShowSucessoModal(true);
        toast({
          title: "Pedido criado com sucesso!",
          description: `Número do pedido: ${novoPed.numero_pedido}`
        });
        
        setNovoPedidoData({
          coleta_cep: "", coleta_rua: "", coleta_numero: "", coleta_complemento: "", coleta_bairro: "", coleta_cidade: "", coleta_uf: "", coleta_referencia: "", coleta_data: "",
          coleta_contato_nome: "", coleta_contato_telefone: "", coleta_contato_ramal: "", coleta_orientacoes: "",
          destinos: [
            {
              cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", referencia: "", data: "",
              contato_nome: "", contato_telefone: "", contato_ramal: "", orientacoes: "", destinatario: "", email: "",
              notifyRecipientWhatsapp: false, recipientWhatsapp: "",
            }
          ],
          descricao: "", volumes: 1, peso: 0, comprimento: "", largura: "", altura: "", valor_declarado: "", tipo_carga: "seca", fragilidade: "normal", observacoes: "", necessidades: [],
          temperatura_minima: "", temperatura_maxima: "",
          permitir_terceiros: false, autorizados_receber: "", horario_limite: "", janela_recebimento: "", orientacoes_rapidas: [], instrucoes_adicionais: "",
          notificar_automacao: false, notificar_canal: "whatsapp", notificar_motorista_saiu: false, notificar_proximo_destino: false, notificar_entrega_concluida: false, notificar_ocorrencia: false,
        });
        setNovoPedidoStep(1);
        setJanelas([{ das: "08:00", ate: "12:00" }]);
        setColetaSearch("");
        setDestinosSearch({});
        setSugestoesColeta([]);
        setSugestoesDestinos({});
        setSugestoesFavColeta([]);
        setSugestoesFavDestinos({});
        carregarDados();
      } else {
        toast({
          title: "Erro ao criar pedido",
          description: "Ocorreu um erro ao processar sua solicitação.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      toast({
        title: "Erro crítico",
        description: "Falha de processamento interna.",
        variant: "destructive"
      });
    } finally {
      setCriandoPedido(false);
    }
  };

  const carregarDados = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    else setRefreshing(true);
    
    try {
      const clienteNome = user?.name || user?.email || "";
      const clienteFiltro = clienteNome ? clienteNome.replace(/@.+$/, "").trim() : "";

      const [{ data: clienteInfo }] = await Promise.all([
        clienteFiltro ? supabase.from('clientes').select('*').ilike('nome_fantasia', `%${clienteFiltro}%`).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      setClienteData(clienteInfo);

      if (!clienteInfo) {
        setDashboardMetrics(null);
        setInsights([]);
        setEntregas([]);
        setFaturas([]);
        setOcorrencias([]);
        setNotificacoes([]);
        setAvaliacoes([]);
        setComprovantesData([]);
        return;
      }

      const [{ data: entregasData }, { data: faturasData }, { data: ocorrenciasData }, metrics] = await Promise.all([
        supabase.from('ordens_servico').select('*').eq('cliente_id', clienteInfo.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('financeiro_receber').select('*').eq('cliente_id', clienteInfo.id).order('data_vencimento', { ascending: false }).limit(20),
        supabase.from('ocorrencias').select('*').eq('cliente_id', clienteInfo.id).order('created_at', { ascending: false }).limit(20),
        buscarDashboardMetrics(clienteInfo.id, clienteNome),
      ]);

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
    // Dados reais carregados do Supabase via carregarDados().
    // Sem fallback para mocks — se não houver OS no banco, mostra empty state.
  }, [initialLoading, clienteData]);

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
    enabled: true,
    clienteId: clienteData?.id,
  });

  useEffect(() => { 
    if (initialLoading) carregarDados(true); 
  }, [carregarDados, initialLoading]);

  const carregarComprovantes = useCallback(async () => {
    setComprovantesLoading(true);
    try {
      const [comp, prot] = await Promise.all([
        buscarComprovantesPortal(clienteData?.id, 100),
        buscarProtocolosPortal(clienteData?.id, 100),
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
    toast({ title: "Roteirização em desenvolvimento", description: "Funcionalidade estará disponível em breve." });
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

  const graficoEvolucaoData = useMemo(() => {
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return dates.map(date => {
      const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const dateKey = date.toDateString();

      const diaEntregas = entregas.filter(e => {
        if (!e.created_at) return false;
        return new Date(e.created_at).toDateString() === dateKey;
      });

      const total = diaEntregas.length;
      const entregues = diaEntregas.filter(e => e.status === "entregue").length;
      const atrasadas = diaEntregas.filter(e => e.status === "atrasada" || e.status === "problema").length;

      const sla = total > 0 ? Math.round(((total - atrasadas) / total) * 100) : 100;
      const performance = total > 0 ? Math.round((entregues / total) * 100) : 100;

      return {
        name: dateStr,
        "Entregas": total,
        "SLA (%)": sla,
        "Atrasos": atrasadas,
        "Performance (%)": performance,
      };
    });
  }, [entregas]);

  const statusPedidosData = useMemo(() => {
    const total = entregas.length;
    if (total === 0) return [];

    const entregues = entregas.filter(e => e.status === "entregue").length;
    const emRota = entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length;
    const pendente = entregas.filter(e => e.status === "programacao" || e.status === "coleta").length;
    const critico = entregas.filter(e => e.status === "atrasada" || e.status === "problema").length;

    return [
      { name: "Entregues", value: entregues, color: "#10B981" },
      { name: "Em Rota", value: emRota, color: "#F97316" },
      { name: "Pendente", value: pendente, color: "#3B82F6" },
      { name: "Crítico / Atrasado", value: critico, color: "#EF4444" },
    ].filter(item => item.value > 0);
  }, [entregas]);

  const taxaSucesso = useMemo(() => {
    const total = entregas.length;
    if (total === 0) return 100;
    const entregues = entregas.filter(e => e.status === "entregue").length;
    return Math.round((entregues / total) * 100);
  }, [entregas]);

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
                    title="Entregues no Mês"
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
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <div>
                        <CardTitle className="text-base text-[#111827]">Evolução de Entregas</CardTitle>
                        <CardDescription className="text-xs text-[#64748B]">Entregas diárias e SLA dos últimos 7 dias</CardDescription>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-[#F97316]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                          Entregas
                        </span>
                        <span className="flex items-center gap-1.5 text-[#0F1A2E]">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#0F1A2E]" />
                          SLA (%)
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64 w-full pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={graficoEvolucaoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorEntregas" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#F97316" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#F97316" stopOpacity={0.01}/>
                              </linearGradient>
                              <linearGradient id="colorSla" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0F1A2E" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#0F1A2E" stopOpacity={0.01}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                            <XAxis 
                              dataKey="name" 
                              stroke="#94A3B8" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false} 
                              dy={8}
                            />
                            <YAxis 
                              stroke="#94A3B8" 
                              fontSize={11} 
                              tickLine={false} 
                              axisLine={false} 
                              dx={-8}
                            />
                            <ChartTooltip content={<CustomTooltip />} />
                            <Area 
                              type="monotone" 
                              dataKey="Entregas" 
                              stroke="#F97316" 
                              strokeWidth={3}
                              fillOpacity={1} 
                              fill="url(#colorEntregas)" 
                            />
                            <Area 
                              type="monotone" 
                              dataKey="SLA (%)" 
                              stroke="#0F1A2E" 
                              strokeWidth={2.5}
                              strokeDasharray="4 4"
                              fillOpacity={1} 
                              fill="url(#colorSla)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-white border-[#E5E7EB] shadow-sm rounded-2xl">
                    <CardHeader>
                      <CardTitle className="text-base text-[#111827]">Status dos Pedidos</CardTitle>
                      <CardDescription className="text-xs text-[#64748B]">Distribuição percentual por status</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col items-center justify-center gap-6 py-2">
                        <div className="relative w-full h-44 flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusPedidosData}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={70}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {statusPedidosData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-[#0F1A2E]">{taxaSucesso}%</span>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Sucesso</span>
                          </div>
                        </div>
                        <div className="w-full grid grid-cols-2 gap-2 mt-2">
                          {[
                            { name: "Entregues", color: "bg-emerald-500", key: "entregue" },
                            { name: "Em Rota", color: "bg-[#F97316]", key: "em_rota" },
                            { name: "Pendente", color: "bg-blue-500", key: "pendente" },
                            { name: "Atrasado/Crítico", color: "bg-red-500", key: "critico" }
                          ].map((st) => {
                            const count = st.key === "entregue" 
                              ? entregas.filter(e => e.status === "entregue").length
                              : st.key === "em_rota"
                              ? entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length
                              : st.key === "pendente"
                              ? entregas.filter(e => e.status === "programacao" || e.status === "coleta").length
                              : entregas.filter(e => e.status === "atrasada" || e.status === "problema").length;

                            const pct = entregas.length > 0 ? Math.round((count / entregas.length) * 100) : 0;

                            return (
                              <div key={st.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div className={`w-2 h-2 rounded-full ${st.color} shrink-0`} />
                                  <span className="text-[10px] font-bold text-[#475569] truncate">{st.name}</span>
                                </div>
                                <span className="text-[10px] font-black text-[#0F1A2E] pl-1">{pct}%</span>
                              </div>
                            );
                          })}
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
                    currentPosition={undefined}
                    origin={selectedEntrega?.origem?.latitude && selectedEntrega?.origem?.longitude ? {
                      lat: selectedEntrega.origem.latitude,
                      lng: selectedEntrega.origem.longitude,
                      label: selectedEntrega.origem.cidade || "Origem",
                    } : undefined}
                    destination={selectedEntrega?.destino?.latitude && selectedEntrega?.destino?.longitude ? {
                      lat: selectedEntrega.destino.latitude,
                      lng: selectedEntrega.destino.longitude,
                      label: selectedEntrega.destino.cidade || "Destino",
                    } : undefined}
                    driverName={selectedEntrega?.prestador?.nome}
                    vehicle={selectedEntrega?.prestador?.veiculo}
                    plate={selectedEntrega?.prestador?.placa}
                    status={selectedEntrega?.status || "programacao"}
                    eta={selectedEntrega?.previsao ? new Date(selectedEntrega.previsao).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
                    distance={selectedEntrega?.distancia_km || selectedEntrega?.distanciaKm || undefined}
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

            {/* ===== CARREGAMENTO ===== */}
            {activeTab === "carregamento" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Controle de Carregamento</h2>
                    <p className="text-sm font-medium text-slate-500">Monitoramento em tempo real de docas, conferência de volumes e pátio.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" className="bg-white border-slate-200" onClick={() => carregarDados()}>
                      <RefreshCw className="w-4 h-4 mr-2" /> Atualizar Pátio
                    </Button>
                  </div>
                </div>

                {/* KPIs Card Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Em Conferência</p>
                        <h3 className="text-2xl font-black text-amber-600 mt-1">
                          {carregamentos.filter(c => c.status === "em_conferencia").length}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Clock3 className="w-5 h-5 text-amber-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Liberados</p>
                        <h3 className="text-2xl font-black text-emerald-600 mt-1">
                          {carregamentos.filter(c => c.status === "liberado").length}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Divergências</p>
                        <h3 className="text-2xl font-black text-red-600 mt-1">
                          {carregamentos.filter(c => c.status === "divergencia").length}
                        </h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                    <CardContent className="p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Operando</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1">{carregamentos.length}</h3>
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        <Truck className="w-5 h-5 text-slate-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Order Selector */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Ordenar fila por</label>
                  <Select value={filaOrdem} onValueChange={setFilaOrdem}>
                    <SelectTrigger className="w-52 h-8 text-xs bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chegada">Ordem de chegada</SelectItem>
                      <SelectItem value="horario">Horário agendado</SelectItem>
                      <SelectItem value="regiao">Região</SelectItem>
                      <SelectItem value="volume">Volume</SelectItem>
                      <SelectItem value="prioridade">Prioridade</SelectItem>
                      <SelectItem value="veiculo">Tipo de veículo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Main Table Card */}
                <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider text-center w-14">Fila</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Veículo / Placa</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Motorista</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Doca</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Romaneio</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider text-center">Progresso</TableHead>
                          <TableHead className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Status</TableHead>
                          <TableHead className="w-[140px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const sorted = [...carregamentos].sort((a, b) => {
                            switch (filaOrdem) {
                              case "horario": return (a.horario_agendado || "").localeCompare(b.horario_agendado || "");
                              case "regiao": return (a.regiao || "").localeCompare(b.regiao || "");
                              case "volume": return (b.volumes_fisicos || 0) - (a.volumes_fisicos || 0);
                              case "prioridade": {
                                const prio: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
                                return (prio[a.prioridade] ?? 99) - (prio[b.prioridade] ?? 99);
                              }
                              case "veiculo": return (a.tipo_veiculo || "").localeCompare(b.tipo_veiculo || "");
                              default: return (a.entrada_patio || "").localeCompare(b.entrada_patio || "");
                            }
                          });
                          return sorted.map((item, idx) => {
                            const isFirst = idx === 0;
                            const posicao = `${idx + 1}º`;
                            return (
                              <TableRow key={item.id} className={`hover:bg-slate-50/80 transition-colors ${isFirst ? "bg-orange-50/40" : ""}`}>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`text-xs font-black ${isFirst ? "text-[#F97316]" : "text-slate-400"}`}>
                                      {posicao}
                                    </span>
                                    <span className={`text-[9px] font-bold ${isFirst ? "text-[#F97316]" : "text-slate-300"}`}>
                                      lugar
                                    </span>
                                    {isFirst && (
                                      <span className="mt-0.5 text-[8px] font-black text-emerald-600 uppercase tracking-wider bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                        Próximo
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div>
                                    <span className="font-bold text-slate-900">{item.placa}</span>
                                    <span className="text-xs block text-slate-500">{item.tipo_veiculo}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <span className="font-bold text-slate-800">{item.motorista}</span>
                                    <span className="text-xs block text-slate-500">{item.tipo_prestador}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="font-semibold text-slate-700">{item.doca || "Pátio"}</TableCell>
                                <TableCell className="font-semibold text-slate-600">{item.romaneio}</TableCell>
                                <TableCell className="text-center">
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <span className="text-xs font-black text-slate-700">
                                      {item.status === "programado" ? "0%" : item.status === "liberado" ? "100%" : `${Math.round((item.volumes_fisicos / item.volumes_documentos) * 100)}%`}
                                    </span>
                                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${item.status === "divergencia" ? "bg-red-500" : "bg-[#F97316]"}`}
                                        style={{ width: `${item.status === "programado" ? 0 : item.status === "liberado" ? 100 : (item.volumes_fisicos / item.volumes_documentos) * 100}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-bold">
                                      {item.status === "programado" ? "-" : `${item.volumes_fisicos}/${item.volumes_documentos} vols`}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={`rounded-full px-3 py-1 font-bold ${
                                    item.status === "em_conferencia" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                                    item.status === "liberado" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                                    item.status === "divergencia" ? "bg-red-50 text-red-600 border border-red-200" :
                                    "bg-slate-50 text-slate-600 border border-slate-200"
                                  }`}>
                                    {item.status_label}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {item.status === "programado" ? (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="hover:bg-emerald-50 rounded-full font-bold text-emerald-600 text-[11px]"
                                      onClick={() => {
                                        toast({ title: "Chamado para doca", description: `${item.placa} - ${item.motorista}` });
                                      }}
                                    >
                                      Chamar para doca
                                    </Button>
                                  ) : (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="hover:bg-slate-100 rounded-full font-bold text-[#F97316]"
                                      onClick={() => {
                                        setSelectedCarregamento(item);
                                        setShowCarregamentoDetailModal(true);
                                      }}
                                    >
                                      Auditar
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          });
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Modal Detalhe de Carregamento (Auditoria) */}
      <Dialog open={showCarregamentoDetailModal} onOpenChange={setShowCarregamentoDetailModal}>
        <DialogContent className="max-w-4xl bg-white border-slate-200 max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl rounded-3xl">
          {selectedCarregamento && (
            <>
              <DialogHeader className="p-6 bg-slate-50 border-b border-slate-200 flex-shrink-0">
                <DialogTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#F97316] flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <Truck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-xl font-extrabold text-slate-900 tracking-tight">Auditando Placa: {selectedCarregamento.placa}</span>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedCarregamento.tipo_veiculo} • {selectedCarregamento.doca}</p>
                    </div>
                  </div>
                  <Badge className={`rounded-full px-3 py-1 font-bold ${
                    selectedCarregamento.status === "em_conferencia" ? "bg-amber-50 text-amber-600 border border-amber-200" :
                    selectedCarregamento.status === "liberado" ? "bg-emerald-50 text-emerald-600 border border-emerald-200" :
                    selectedCarregamento.status === "divergencia" ? "bg-red-50 text-red-600 border border-red-200" :
                    "bg-slate-50 text-slate-600 border border-slate-200"
                  }`}>
                    {selectedCarregamento.status_label}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Motorista & Prestador Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-slate-50 border-slate-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista Responsável</p>
                    <p className="text-base font-black text-slate-800 mt-1">{selectedCarregamento.motorista}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">{selectedCarregamento.tipo_prestador}</p>
                  </Card>
                  <Card className="bg-slate-50 border-slate-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controle de Manifesto / Romaneio</p>
                    <p className="text-base font-black text-slate-800 mt-1">{selectedCarregamento.romaneio}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-0.5">Doca de Embarque: {selectedCarregamento.doca || 'N/A'}</p>
                  </Card>
                  <Card className="bg-slate-50 border-slate-200 rounded-2xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chave de Acesso NF-e</p>
                    <p className="text-xs font-bold text-slate-600 font-mono break-all mt-1">{selectedCarregamento.nf_chave}</p>
                  </Card>
                </div>

                {/* Divergência alerta se houver */}
                {selectedCarregamento.status === "divergencia" && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-black text-red-900">Alerta de Divergência Operacional</h4>
                      <p className="text-xs text-red-700 font-medium mt-0.5">{selectedCarregamento.divergencia_motivo}</p>
                    </div>
                  </div>
                )}

                {/* Audit Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Progresso de Conferência Física */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Auditoria de Volumes</h3>
                    
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                      <div>
                        <p className="text-xs text-slate-400 font-bold uppercase">Volumes Documentos</p>
                        <p className="text-2xl font-black text-slate-700 mt-1">{selectedCarregamento.volumes_documentos}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-bold uppercase">Volumes Físicos</p>
                        <p className="text-2xl font-black text-[#F97316] mt-1">{selectedCarregamento.volumes_fisicos}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-600 uppercase">Checklist da Doca</p>
                      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 font-medium">Integridade da Embalagem</span>
                          <Badge className={`rounded-full ${selectedCarregamento.embalagem_ok ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {selectedCarregamento.embalagem_ok ? 'Conforme' : 'Divergente'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 font-medium">Lacre Traseiro ({selectedCarregamento.lacre_numero || 'Sem lacre'})</span>
                          <Badge className={`rounded-full ${selectedCarregamento.lacre_ok ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {selectedCarregamento.lacre_ok ? 'Integrado' : 'Violado'}
                          </Badge>
                        </div>
                        {selectedCarregamento.refrigerado && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-slate-700 font-medium">Monitoramento de Temperatura (Alvo: {selectedCarregamento.temperatura_alvo}°C)</span>
                            <span className={`text-sm font-black ${Math.abs((selectedCarregamento.temperatura_atual || 0) - (selectedCarregamento.temperatura_alvo || 0)) > 1.0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {selectedCarregamento.temperatura_atual}°C
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 font-medium">Checklist Veicular Geral</span>
                          <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full">
                            Concluído
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pátio Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Timeline do Pátio</h3>
                    
                    <div className="relative border-l-2 border-slate-100 pl-6 space-y-5 py-2">
                      <div className="relative">
                        <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow" />
                        <p className="text-xs font-black text-slate-800">Entrada no Pátio</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {selectedCarregamento.entrada_patio ? fmtHora(selectedCarregamento.entrada_patio) : "Aguardando chegada..."}
                        </p>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-4 border-white shadow ${selectedCarregamento.inicio_conferencia ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-xs font-black text-slate-800">Início da Conferência</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {selectedCarregamento.inicio_conferencia ? fmtHora(selectedCarregamento.inicio_conferencia) : "Aguardando início..."}
                        </p>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-4 border-white shadow ${selectedCarregamento.fim_conferencia ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-xs font-black text-slate-800">Fim da Conferência</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {selectedCarregamento.fim_conferencia ? fmtHora(selectedCarregamento.fim_conferencia) : "Em andamento..."}
                        </p>
                      </div>

                      <div className="relative">
                        <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-4 border-white shadow ${selectedCarregamento.liberacao ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <p className="text-xs font-black text-slate-800">Saída / Liberação para Rota</p>
                        <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                          {selectedCarregamento.liberacao ? fmtHora(selectedCarregamento.liberacao) : "Aguardando liberação..."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Documentos Anexados */}
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Documentos e Comprovantes Anexados</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCarregamento.documentos && selectedCarregamento.documentos.length > 0 ? (
                      selectedCarregamento.documentos.map((doc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-[#F97316]" />
                            <div>
                              <p className="text-sm font-bold text-slate-800 truncate max-w-[200px]">{doc.nome}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.tipo}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="font-bold text-xs text-[#F97316] rounded-full hover:bg-orange-50">
                            Visualizar
                          </Button>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <p className="text-sm text-slate-400 font-medium">Nenhum documento digitalizado até o momento.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
                <Button variant="outline" className="bg-white border-slate-200" onClick={() => setShowCarregamentoDetailModal(false)}>
                  Fechar Auditoria
                </Button>
                {selectedCarregamento.status !== "liberado" && selectedCarregamento.status !== "divergencia" && (
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-full px-6 font-bold shadow-lg shadow-emerald-600/10"
                    onClick={() => {
                      setCarregamentos(prev => prev.map(c => c.id === selectedCarregamento.id ? {
                        ...c,
                        status: "liberado",
                        status_label: "Liberado para Rota",
                        fim_conferencia: new Date().toISOString(),
                        liberacao: new Date().toISOString(),
                      } : c));
                      setShowCarregamentoDetailModal(false);
                      toast({
                        title: "Veículo Liberado!",
                        description: `O veículo ${selectedCarregamento.placa} foi liberado para rota.`
                      });
                    }}
                  >
                    Liberar para Rota
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-4">
            {selectedEntrega ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">OS</p>
                    <p className="text-sm font-extrabold text-[#111827] mt-1">{selectedEntrega.numero || "—"}</p>
                  </div>
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Status</p>
                    <Badge className="mt-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-bold px-3">
                      {selectedEntrega.status || "Pendente"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Origem</p>
                    <p className="text-sm font-semibold text-[#111827] mt-1">
                      {selectedEntrega.origem
                        ? `${selectedEntrega.origem.rua || ""}, ${selectedEntrega.origem.numero || ""} - ${selectedEntrega.origem.cidade || ""}/${selectedEntrega.origem.uf || ""}`
                        : "—"}
                    </p>
                  </div>
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Destino</p>
                    <p className="text-sm font-semibold text-[#111827] mt-1">
                      {selectedEntrega.destino
                        ? `${selectedEntrega.destino.rua || ""}, ${selectedEntrega.destino.numero || ""} - ${selectedEntrega.destino.cidade || ""}/${selectedEntrega.destino.uf || ""}`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Previsão</p>
                  <p className="text-sm font-semibold text-[#111827] mt-1">{selectedEntrega.previsao || "A definir"}</p>
                </div>

                {selectedEntrega.prestador && (
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E5E7EB]">
                    <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Prestador</p>
                    <p className="text-sm font-semibold text-[#111827] mt-1">
                      {selectedEntrega.prestador.nome || "—"}
                    </p>
                  </div>
                )}

                <Button className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full font-bold"
                  onClick={() => { setShowDetailModal(false); }}>
                  Acompanhar
                </Button>
              </>
            ) : (
              <p className="text-sm text-[#475569]">Nenhum pedido selecionado.</p>
            )}
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

      {/* Modal Novo Pedido — Layout Premium com Lateral Escura */}
      <Dialog open={showNovoPedidoModal} onOpenChange={(open) => {
        if (!open) { setNovoPedidoStep(1); }
        setShowNovoPedidoModal(open);
      }}>
        <DialogContent className="max-w-6xl w-[95vw] h-[85vh] bg-white border-0 overflow-hidden flex p-0 shadow-2xl rounded-3xl">
          {/* ─── SIDEBAR ESCURA (Passos + Resumo Executivo) ─── */}
          <div className="w-[280px] min-w-[280px] bg-slate-900 text-white flex flex-col flex-shrink-0">
            {/* Header */}
            <div className="p-6 border-b border-slate-700/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F97316] flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Package2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-white tracking-tight">Novo Transporte</DialogTitle>
                  <DialogDescription className="text-[11px] text-slate-400 font-medium mt-0.5">Multi-paradas, cubagem e restrições</DialogDescription>
                </div>
              </div>
            </div>

            {/* Steps */}
            <nav className="flex-1 px-4 py-5 space-y-1.5">
              {[
                { step: 1, icon: MapPin, label: "Passo 1", sub: "Localização" },
                { step: 2, icon: Package, label: "Passo 2", sub: "Detalhes da Carga" },
                { step: 3, icon: CheckCircle, label: "Passo 3", sub: "Revisão Final" },
              ].map(({ step, icon: Icon, label, sub }) => (
                <button
                  key={step}
                  onClick={() => { if (step < novoPedidoStep || step === novoPedidoStep) setNovoPedidoStep(step); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all ${
                    novoPedidoStep === step
                      ? "bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30 shadow-sm"
                      : step < novoPedidoStep
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                    novoPedidoStep === step
                      ? "bg-[#F97316] text-white"
                      : step < novoPedidoStep
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-slate-500"
                  }`}>
                    {step < novoPedidoStep ? <CheckCheck className="w-4 h-4" /> : step}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</p>
                    <p className="text-sm font-bold">{sub}</p>
                  </div>
                </button>
              ))}
            </nav>

            {/* Resumo Executivo Inteligente */}
            <div className="px-4 pb-4">
              <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/50 space-y-2.5">
                <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
                  <Calculator className="w-3.5 h-3.5 text-[#F97316]" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo Executivo</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Navigation className="w-3 h-3" /> Paradas
                    </span>
                    <span className="text-xs font-black text-white">{resumo.paradas}</span>
                  </div>
                  {resumo.km > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <MapPin className="w-3 h-3" /> KM
                      </span>
                      <span className="text-xs font-black text-white">{resumo.km} km</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Scale className="w-3 h-3" /> Peso
                    </span>
                    <span className="text-xs font-black text-white">{resumo.peso} kg</span>
                  </div>
                  {resumo.cubagemM3 > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Ruler className="w-3 h-3" /> Cubagem
                      </span>
                      <span className="text-xs font-black text-white">{resumo.cubagemM3} m³</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Truck className="w-3 h-3" /> Veículo
                    </span>
                    <span className="text-xs font-black text-[#F97316]">{resumo.veiculoSugerido}</span>
                  </div>
                  <div className="border-t border-slate-700/30 pt-1.5 mt-1.5 space-y-1.5">
                    {resumo.tempoEstimado !== "—" && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Tempo est.
                        </span>
                        <span className="text-xs font-black text-white">{resumo.tempoEstimado}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> SLA
                      </span>
                      <span className="text-xs font-black text-white">{resumo.sla}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                        <Zap className="w-3 h-3" /> Complexidade
                      </span>
                      <span className={`text-xs font-black ${
                        resumo.complexidade === "Elevada" ? "text-red-400" :
                        resumo.complexidade === "Média" ? "text-amber-400" :
                        "text-emerald-400"
                      }`}>{resumo.complexidade}</span>
                    </div>
                    {resumo.refrigerado && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                          <span className="text-blue-400 text-[9px]">❄</span> Refrigeração
                        </span>
                        <span className="text-xs font-black text-blue-400">
                          {novoPedidoData.temperatura_minima || "—"}°C ~ {novoPedidoData.temperatura_maxima || "—"}°C
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── CONTEÚDO PRINCIPAL ─── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Passo {novoPedidoStep} de 3
                </span>
              </div>
              <button
                onClick={() => { setShowNovoPedidoModal(false); setNovoPedidoStep(1); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              <AnimatePresence mode="wait">
                {/* ===== STEP 1: LOCALIZAÇÃO (Coleta + Multi-paradas) ===== */}
                {novoPedidoStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="space-y-8">
                    {/* --- Coleta --- */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">1</span>
                        Local de Coleta
                      </h3>
                    </div>

                    {/* ⭐ Favoritos Inteligentes */}
                    <div className="mb-6">
                      <div className="bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                            Favoritos Inteligentes
                          </h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Clique para preencher a Coleta</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* Column 1: Pinned */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-1 flex items-center gap-1">📌 Fixados</span>
                            {favoritosList.filter(f => f.fixado).length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic block py-1">Nenhum fixado</span>
                            ) : (
                              favoritosList.filter(f => f.fixado).slice(0, 3).map(fav => (
                                <div 
                                  key={fav.id} 
                                  className="group flex items-center justify-between p-2 bg-white border border-slate-200/80 rounded-xl hover:border-[#F97316]/50 cursor-pointer transition-all duration-300"
                                  onClick={() => handleApplyFavorite(fav, "coleta")}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-[#F97316]">{fav.label}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{fav.cidade}/{fav.uf}</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 shrink-0 ml-1" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinFavorite(fav.id);
                                    }}
                                  >
                                    <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Column 2: Most Used */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-1 flex items-center gap-1">🔥 Mais Usados</span>
                            {favoritosList.length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic block py-1">Nenhum registro</span>
                            ) : (
                              [...favoritosList].sort((a, b) => (b.usado_contagem || 0) - (a.usado_contagem || 0)).slice(0, 3).map(fav => (
                                <div 
                                  key={fav.id} 
                                  className="group flex items-center justify-between p-2 bg-white border border-slate-200/80 rounded-xl hover:border-[#F97316]/50 cursor-pointer transition-all duration-300"
                                  onClick={() => handleApplyFavorite(fav, "coleta")}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-[#F97316]">{fav.label}</p>
                                    <p className="text-[9px] text-slate-400 truncate">Usos: {fav.usado_contagem || 0}</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-5 h-5 rounded-full text-slate-300 hover:text-amber-500 shrink-0 ml-1" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinFavorite(fav.id);
                                    }}
                                  >
                                    <Star className={`w-3 h-3 ${fav.fixado ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>

                          {/* Column 3: Recentes */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-1 flex items-center gap-1">🕒 Recentes</span>
                            {favoritosList.filter(f => f.data_ultimo_uso).length === 0 ? (
                              <span className="text-[10px] text-slate-400 italic block py-1">Sem uso recente</span>
                            ) : (
                              [...favoritosList].filter(f => f.data_ultimo_uso).sort((a, b) => new Date(b.data_ultimo_uso).getTime() - new Date(a.data_ultimo_uso).getTime()).slice(0, 3).map(fav => (
                                <div 
                                  key={fav.id} 
                                  className="group flex items-center justify-between p-2 bg-white border border-slate-200/80 rounded-xl hover:border-[#F97316]/50 cursor-pointer transition-all duration-300"
                                  onClick={() => handleApplyFavorite(fav, "coleta")}
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-slate-700 truncate group-hover:text-[#F97316]">{fav.label}</p>
                                    <p className="text-[9px] text-slate-400 truncate">{fav.cidade}/{fav.uf}</p>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="w-5 h-5 rounded-full text-slate-300 hover:text-amber-500 shrink-0 ml-1" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinFavorite(fav.id);
                                    }}
                                  >
                                    <Star className={`w-3 h-3 ${fav.fixado ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 relative">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">CEP Coleta</Label>
                        <div className="relative">
                          <Input
                            value={novoPedidoData.coleta_cep}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNovoPedidoData({ ...novoPedidoData, coleta_cep: val });
                              if (val.replace(/\D/g, "").length === 8) buscarCep(val, "coleta");
                            }}
                            placeholder="00000-000"
                            className="bg-white border-slate-200 rounded-xl"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-2 relative">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Buscar Endereço (Autocompletar)</Label>
                        <div className="relative">
                          <Input
                            id="coleta-autocomplete"
                            value={coletaSearch}
                            onChange={(e) => {
                              setColetaSearch(e.target.value);
                              handleMapboxSearch(e.target.value, "coleta");
                            }}
                            placeholder="Comece a digitar o apelido do favorito ou endereço (rua, CEP, etc.)..."
                            className="bg-white border-slate-200 rounded-xl pl-9 pr-9 text-xs"
                          />
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                          {isSearchingMapbox && <RefreshCw className="w-4 h-4 text-[#F97316] animate-spin absolute right-3 top-3" />}
                        </div>
                        {(sugestoesColeta.length > 0 || sugestoesFavColeta.length > 0) && (
                          <div className="absolute left-0 right-0 top-16 bg-white border border-slate-200 rounded-2xl shadow-xl z-[999] overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                            {sugestoesFavColeta.length > 0 && (
                              <div className="bg-slate-50/70 p-1.5 space-y-1">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 block">⭐ Favoritos Correspondentes</span>
                                {sugestoesFavColeta.map((fav, fIdx) => (
                                  <div 
                                    key={`fav-${fIdx}`} 
                                    className="p-2 hover:bg-orange-50/60 cursor-pointer text-xs flex items-center gap-2 group transition-colors rounded-lg" 
                                    onClick={() => {
                                      handleApplyFavorite(fav, "coleta");
                                      setSugestoesFavColeta([]);
                                    }}
                                  >
                                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                                    <div className="flex flex-col min-w-0">
                                      <span className="text-slate-800 font-bold truncate">{fav.label}</span>
                                      <span className="text-[10px] text-slate-400 font-medium truncate">{fav.rua}, {fav.numero} — {fav.cidade}/{fav.uf}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {sugestoesColeta.length > 0 && (
                              <div>
                                {sugestoesFavColeta.length > 0 && (
                                  <div className="bg-slate-100 h-[1px]" />
                                )}
                                {sugestoesColeta.map((s, idx) => {
                                  const mainText = s.rua ? `${s.rua}${s.numero ? `, ${s.numero}` : ""}` : s.place_name.split(",")[0];
                                  const secondaryText = s.bairro ? `${s.bairro} — ${s.cidade || ""}/${s.uf || ""}` : `${s.cidade || ""}/${s.uf || ""}`;
                                  return (
                                    <div 
                                      key={idx} 
                                      className="p-3 hover:bg-orange-50/60 cursor-pointer text-xs flex items-center gap-2.5 group transition-colors" 
                                      onClick={() => handleSelectMapboxSuggestion(s, "coleta")}
                                    >
                                      <MapPin className="w-4 h-4 text-[#F97316]/70 group-hover:text-[#F97316] shrink-0" />
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-slate-800 font-bold truncate">{mainText}</span>
                                        <span className="text-[10px] text-slate-400 font-medium truncate">{secondaryText}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Logradouro / Rua</Label>
                        <Input value={novoPedidoData.coleta_rua} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_rua: e.target.value })} placeholder="Avenida Paulista" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Número</Label>
                        <Input value={novoPedidoData.coleta_numero} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_numero: e.target.value })} placeholder="100" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Complemento</Label>
                        <Input value={novoPedidoData.coleta_complemento} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_complemento: e.target.value })} placeholder="Salas 401-402" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Bairro</Label>
                        <Input value={novoPedidoData.coleta_bairro} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_bairro: e.target.value })} placeholder="Bela Vista" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Cidade</Label>
                        <Input value={novoPedidoData.coleta_cidade} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_cidade: e.target.value })} placeholder="São Paulo" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Estado / UF</Label>
                        <Input value={novoPedidoData.coleta_uf} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_uf: e.target.value })} placeholder="SP" className="bg-white border-slate-200 rounded-xl" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/60 mt-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Nome Contato Coleta</Label>
                        <Input value={novoPedidoData.coleta_contato_nome} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_contato_nome: e.target.value })} placeholder="Ex: João Almoxarifado" className="bg-white border-slate-200 rounded-xl text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Telefone Contato</Label>
                        <Input value={novoPedidoData.coleta_contato_telefone} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_contato_telefone: e.target.value })} placeholder="(11) 99999-9999" className="bg-white border-slate-200 rounded-xl text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Ramal</Label>
                        <Input value={novoPedidoData.coleta_contato_ramal} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_contato_ramal: e.target.value })} placeholder="104" className="bg-white border-slate-200 rounded-xl text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Data/Hora Estimada Coleta</Label>
                        <Input type="datetime-local" value={novoPedidoData.coleta_data} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, coleta_data: e.target.value })} className="bg-white border-slate-200 rounded-xl text-xs" />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Input placeholder="Deseja salvar este endereço de coleta como favorito? Digite um apelido..." id="save_fav_label_coleta" className="bg-white border-slate-200 text-xs" />
                      <Button onClick={() => {
                        const input = document.getElementById("save_fav_label_coleta") as HTMLInputElement;
                        if (input && input.value) {
                          handleSaveFavorite(input.value, { 
                            cep: novoPedidoData.coleta_cep, 
                            rua: novoPedidoData.coleta_rua, 
                            numero: novoPedidoData.coleta_numero, 
                            complemento: novoPedidoData.coleta_complemento, 
                            bairro: novoPedidoData.coleta_bairro, 
                            cidade: novoPedidoData.coleta_cidade, 
                            uf: novoPedidoData.coleta_uf,
                            contato_nome: novoPedidoData.coleta_contato_nome,
                            contato_telefone: novoPedidoData.coleta_contato_telefone,
                            contato_ramal: novoPedidoData.coleta_contato_ramal
                          });
                          input.value = "";
                        }
                      }} className="bg-slate-800 text-white rounded-xl text-xs font-bold px-4">Salvar</Button>
                    </div>
                  </div>

                  {/* --- Destinos / Paradas --- */}
                  <div className="relative pb-16">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-4">
                      <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">2</span>
                        Destinos / Paradas
                      </h3>
                    </div>

                    <div className="space-y-4">
                      {novoPedidoData.destinos.map((destino, idx) => {
                        const isExpanded = expandedStops[idx] !== false;
                        const titleText = `DESTINO ${idx + 1}`;
                        const summaryText = (destino.destinatario || destino.cidade)
                          ? ` — ${destino.destinatario || "Sem Nome"}${destino.cidade ? ` — ${destino.cidade}/${destino.uf || ""}` : ""}`
                          : " — Novo endereço";

                        return (
                          <Card 
                            key={idx} 
                            id={`destino-card-${idx}`}
                            className={`bg-slate-50/50 border-slate-200/80 rounded-2xl relative transition-all duration-300 ${
                              isExpanded ? "p-5 space-y-4" : "p-4 space-y-0 hover:bg-slate-100/70"
                            }`}
                          >
                            <div 
                              className="flex items-center justify-between cursor-pointer select-none"
                              onClick={() => setExpandedStops(prev => ({ ...prev, [idx]: !isExpanded }))}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
                                  isExpanded ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-600"
                                }`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <div className="flex items-baseline gap-2 min-w-0">
                                  <span className="text-xs font-black text-slate-700 uppercase tracking-widest">{titleText}</span>
                                  {!isExpanded && (
                                    <span className="text-xs text-slate-500 font-medium truncate max-w-[280px] sm:max-w-md md:max-w-lg">
                                      {summaryText}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700" 
                                  onClick={() => moverDestino(idx, "cima")} 
                                  disabled={idx === 0}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700" 
                                  onClick={() => moverDestino(idx, "baixo")} 
                                  disabled={idx === novoPedidoData.destinos.length - 1}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-7 h-7 rounded-full text-red-500 hover:text-red-700 hover:bg-red-50" 
                                  onClick={() => removerDestino(idx)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700"
                                  onClick={() => setExpandedStops(prev => ({ ...prev, [idx]: !isExpanded }))}
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </Button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="space-y-4 pt-4 border-t border-slate-200/60 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">CEP Entrega</Label>
                                    <div className="relative">
                                      <Input 
                                        id={`destino-cep-${idx}`}
                                        value={destino.cep} 
                                        onChange={(e) => { 
                                          const val = e.target.value; 
                                          setNovoPedidoData(prev => { 
                                            const nd = [...prev.destinos]; 
                                            nd[idx].cep = val; 
                                            return { ...prev, destinos: nd }; 
                                          }); 
                                          if (val.replace(/\D/g, "").length === 8) buscarCep(val, idx); 
                                        }} 
                                        placeholder="00000-000" 
                                        className="bg-white border-slate-200 rounded-xl" 
                                      />
                                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                                    </div>
                                  </div>
                                  <div className="md:col-span-2 space-y-2 relative">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Buscar Endereço (Autocompletar)</Label>
                                    <div className="relative">
                                      <Input 
                                        value={destinosSearch[idx] || ""}
                                        onChange={(e) => {
                                          setDestinosSearch(prev => ({ ...prev, [idx]: e.target.value }));
                                          handleMapboxSearch(e.target.value, idx);
                                        }} 
                                        placeholder="Buscar endereço..." 
                                        className="bg-white border-slate-200 rounded-xl pl-9 pr-9" 
                                      />
                                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                      {isSearchingMapbox && <RefreshCw className="w-4 h-4 text-[#F97316] animate-spin absolute right-3 top-3" />}
                                    </div>
                                    {(sugestoesDestinos[idx]?.length > 0 || sugestoesFavDestinos[idx]?.length > 0) && (
                                      <div className="absolute left-0 right-0 top-16 bg-white border border-slate-200 rounded-2xl shadow-xl z-[999] overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                        {sugestoesFavDestinos[idx]?.length > 0 && (
                                          <div className="bg-slate-50/70 p-1.5 space-y-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 block">⭐ Favoritos Correspondentes</span>
                                            {sugestoesFavDestinos[idx].map((fav, fIdx) => (
                                              <div 
                                                key={`fav-${fIdx}`} 
                                                className="p-2 hover:bg-orange-50/60 cursor-pointer text-xs flex items-center gap-2 group transition-colors rounded-lg" 
                                                onClick={() => {
                                                  handleApplyFavorite(fav, idx);
                                                  setSugestoesFavDestinos(prev => ({ ...prev, [idx]: [] }));
                                                }}
                                              >
                                                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                                                <div className="flex flex-col min-w-0">
                                                  <span className="text-slate-800 font-bold truncate">{fav.label}</span>
                                                  <span className="text-[10px] text-slate-400 font-medium truncate">{fav.rua}, {fav.numero} — {fav.cidade}/{fav.uf}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        {sugestoesDestinos[idx]?.length > 0 && (
                                          <div>
                                            {sugestoesFavDestinos[idx]?.length > 0 && (
                                              <div className="bg-slate-100 h-[1px]" />
                                            )}
                                            {sugestoesDestinos[idx].map((s, sIdx) => {
                                              const mainText = s.rua ? `${s.rua}${s.numero ? `, ${s.numero}` : ""}` : s.place_name.split(",")[0];
                                              const secondaryText = s.bairro ? `${s.bairro} — ${s.cidade || ""}/${s.uf || ""}` : `${s.cidade || ""}/${s.uf || ""}`;
                                              return (
                                                <div 
                                                  key={sIdx} 
                                                  className="p-3 hover:bg-orange-50/60 cursor-pointer text-xs flex items-center gap-2.5 group transition-colors" 
                                                  onClick={() => handleSelectMapboxSuggestion(s, idx)}
                                                >
                                                  <MapPin className="w-4 h-4 text-[#F97316]/70 group-hover:text-[#F97316] shrink-0" />
                                                  <div className="flex flex-col min-w-0">
                                                    <span className="text-slate-800 font-bold truncate">{mainText}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium truncate">{secondaryText}</span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div className="md:col-span-2 space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Rua</Label>
                                    <Input value={destino.rua} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].rua = e.target.value; return { ...prev, destinos: nd }; })} placeholder="Rua das Flores" className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Número</Label>
                                    <Input value={destino.numero} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].numero = e.target.value; return { ...prev, destinos: nd }; })} placeholder="200" className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Complemento</Label>
                                    <Input value={destino.complemento} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].complemento = e.target.value; return { ...prev, destinos: nd }; })} placeholder="Apto 12" className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Bairro</Label>
                                    <Input value={destino.bairro} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].bairro = e.target.value; return { ...prev, destinos: nd }; })} className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Cidade</Label>
                                    <Input value={destino.cidade} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].cidade = e.target.value; return { ...prev, destinos: nd }; })} className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Estado / UF</Label>
                                    <Input value={destino.uf} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].uf = e.target.value; return { ...prev, destinos: nd }; })} className="bg-white border-slate-200 rounded-xl" />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200/60">
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Nome Destinatário</Label>
                                    <Input value={destino.destinatario} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].destinatario = e.target.value; return { ...prev, destinos: nd }; })} placeholder="Razão Social / Nome completo" className="bg-white border-slate-200 rounded-xl text-xs" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">WhatsApp (opcional)</Label>
                                    <Input value={destino.recipientWhatsapp} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].recipientWhatsapp = e.target.value; return { ...prev, destinos: nd }; })} placeholder="11999999999" className="bg-white border-slate-200 rounded-xl text-xs" />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">E-mail Destinatário</Label>
                                    <Input value={destino.email} onChange={(e) => setNovoPedidoData(prev => { const nd = [...prev.destinos]; nd[idx].email = e.target.value; return { ...prev, destinos: nd }; })} placeholder="destinatario@email.com" className="bg-white border-slate-200 rounded-xl text-xs" />
                                  </div>
                                </div>

                                <div className="flex gap-2 mt-3">
                                  <Input placeholder="Salvar este destinatário nos favoritos? Apelido..." id={`save_fav_label_destino_${idx}`} className="bg-white border-slate-200 text-xs" />
                                  <Button onClick={() => {
                                    const input = document.getElementById(`save_fav_label_destino_${idx}`) as HTMLInputElement;
                                    if (input && input.value) {
                                      handleSaveFavorite(input.value, {
                                        cep: destino.cep,
                                        rua: destino.rua,
                                        numero: destino.numero,
                                        complemento: destino.complemento,
                                        bairro: destino.bairro,
                                        cidade: destino.cidade,
                                        uf: destino.uf,
                                        contato_nome: destino.destinatario,
                                        email: destino.email,
                                        notifyRecipientWhatsapp: destino.notifyRecipientWhatsapp,
                                        recipientWhatsapp: destino.recipientWhatsapp
                                      });
                                      input.value = "";
                                    }
                                  }} className="bg-slate-800 text-white rounded-xl text-xs font-bold px-4">Salvar</Button>
                                </div>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>

                    {/* Sticky floating "+ Adicionar Parada" button at the bottom-right of destinations section */}
                    <div className="sticky bottom-0 right-0 flex justify-end pt-4 pointer-events-none z-40">
                      <Button 
                        onClick={adicionarDestino} 
                        className="pointer-events-auto bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-bold rounded-full h-10 px-5 shadow-lg shadow-orange-500/30 flex items-center gap-1.5 transition-all duration-300 hover:scale-105"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Parada
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===== STEP 2: DETALHES DA CARGA (Mercadoria + Orientações) ===== */}
              {novoPedidoStep === 2 && (
                <motion.div key="step2" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="space-y-8">
                  {/* --- Mercadoria --- */}
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">1</span>
                      Detalhes da Carga e Cubagem
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Descrição Detalhada da Carga</Label>
                          <Input value={novoPedidoData.descricao} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, descricao: e.target.value })} placeholder="Ex: Peças para ar condicionado, caixas de papelão..." className="bg-white border-slate-200 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Volumes</Label>
                            <Input type="number" value={novoPedidoData.volumes} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, volumes: Number(e.target.value) })} placeholder="1" className="bg-white border-slate-200 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Peso Total (kg)</Label>
                            <Input type="number" value={novoPedidoData.peso} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, peso: Number(e.target.value) })} placeholder="0" className="bg-white border-slate-200 rounded-xl" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-400 uppercase">Comp. (cm)</Label>
                            <Input type="number" value={novoPedidoData.comprimento} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, comprimento: e.target.value })} placeholder="100" className="bg-white border-slate-200 rounded-xl text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-400 uppercase">Larg. (cm)</Label>
                            <Input type="number" value={novoPedidoData.largura} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, largura: e.target.value })} placeholder="100" className="bg-white border-slate-200 rounded-xl text-xs" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-400 uppercase">Alt. (cm)</Label>
                            <Input type="number" value={novoPedidoData.altura} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, altura: e.target.value })} placeholder="100" className="bg-white border-slate-200 rounded-xl text-xs" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Valor Declarado (R$)</Label>
                            <Input type="number" value={novoPedidoData.valor_declarado} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, valor_declarado: e.target.value })} placeholder="1500.00" className="bg-white border-slate-200 rounded-xl" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Fragilidade</Label>
                            <Select value={novoPedidoData.fragilidade} onValueChange={(v) => setNovoPedidoData({ ...novoPedidoData, fragilidade: v })}>
                              <SelectTrigger className="bg-white border-slate-200 rounded-xl">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="normal">Normal / Resistente</SelectItem>
                                <SelectItem value="fragil">Frágil / Delicado</SelectItem>
                                <SelectItem value="muito_fragil">Altamente Frágil (Vidros/Espelhos)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Necessidades Especiais do Transporte</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { id: "coleta_doca", label: "Coleta em doca" },
                              { id: "agendamento", label: "Necessário agendamento" },
                              { id: "conferencia", label: "Entrega com conferência" },
                              { id: "canhoto_assinado", label: "Exige canhoto assinado" },
                              { id: "ajudante", label: "Necessário ajudante" },
                              { id: "uniforme", label: "Cliente exige uniforme" },
                              { id: "epi", label: "Uso obrigatório de EPI" },
                              { id: "veiculo_alto", label: "Restrição veículo alto" },
                              { id: "area_risco", label: "Área de risco" },
                              { id: "condominio", label: "Entrega em condomínio" },
                              { id: "paletizacao", label: "Necessário paletização" },
                              { id: "fracionada", label: "Carga fracionada" },
                              { id: "refrigerado", label: "Transporte Refrigerado" },
                              { id: "urgente", label: "Prioridade urgente" },
                              { id: "fragil", label: "Produto frágil" },
                              { id: "nao_empilhar", label: "Não empilhar" },
                              { id: "valiosa", label: "Mercadoria valiosa" },
                              { id: "rastreado", label: "Exige rastreamento" },
                              { id: "foto_entrega", label: "Necessário foto na entrega" },
                              { id: "cpf_documento", label: "Conferência por CPF/documento" }
                            ].map((item) => (
                              <div key={item.id} className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${novoPedidoData.necessidades.includes(item.id) ? "bg-orange-50/70 border-[#F97316] text-[#F97316] shadow-sm shadow-orange-500/10" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`} onClick={() => { const curr = novoPedidoData.necessidades; const updated = curr.includes(item.id) ? curr.filter(x => x !== item.id) : [...curr, item.id]; setNovoPedidoData({ ...novoPedidoData, necessidades: updated }); }}>
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-200 ${novoPedidoData.necessidades.includes(item.id) ? "border-[#F97316] scale-110" : "border-slate-300"}`}>
                                  {novoPedidoData.necessidades.includes(item.id) && <div className="w-2 h-2 rounded-full bg-[#F97316] animate-in zoom-in duration-200" />}
                                </div>
                                <span className="text-xs font-bold leading-tight">{item.label}</span>
                              </div>
                            ))}
                          </div>

                          {novoPedidoData.necessidades.includes("refrigerado") && (
                            <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                              <div className="bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border border-blue-100 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                                    </svg>
                                  </div>
                                  <p className="text-xs font-bold text-slate-600">Informe a faixa ideal de temperatura para conservação da carga.</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                      Mínima
                                    </Label>
                                    <div className="relative">
                                      <Input type="number" value={novoPedidoData.temperatura_minima} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, temperatura_minima: e.target.value })} placeholder="13" className="bg-white border-blue-200 rounded-xl pr-8 text-sm font-bold" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-500">°C</span>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                      Máxima
                                    </Label>
                                    <div className="relative">
                                      <Input type="number" value={novoPedidoData.temperatura_maxima} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, temperatura_maxima: e.target.value })} placeholder="16" className="bg-white border-blue-200 rounded-xl pr-8 text-sm font-bold" />
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-orange-500">°C</span>
                                    </div>
                                  </div>
                                </div>
                                {(novoPedidoData.temperatura_minima || novoPedidoData.temperatura_maxima) && (
                                  <div className="text-center animate-in fade-in slide-in-from-top-1 duration-300">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100/80 text-blue-700 rounded-full text-xs font-bold">
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                      Mín: {novoPedidoData.temperatura_minima || "—"}°C · Máx: {novoPedidoData.temperatura_maxima || "—"}°C
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Observações de Manuseio</Label>
                      <Textarea value={novoPedidoData.observacoes} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, observacoes: e.target.value })} placeholder="Instruções adicionais sobre amarração de carga, empilhamento máximo, etc..." className="bg-white border-slate-200 min-h-[80px]" />
                    </div>

                    {sugestao && (
                      <div className={`overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300 rounded-2xl p-4 ${
                        sugestao.tipo === "warning" ? "bg-amber-50/80 border border-amber-200" :
                        sugestao.tipo === "tip" ? "bg-blue-50/80 border border-blue-200" :
                        "bg-slate-50/80 border border-slate-200"
                      }`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            sugestao.tipo === "warning" ? "bg-amber-100 text-amber-600" :
                            sugestao.tipo === "tip" ? "bg-blue-100 text-blue-600" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {sugestao.tipo === "warning" ? <AlertTriangle className="w-4 h-4" /> :
                             sugestao.tipo === "tip" ? <Zap className="w-4 h-4" /> :
                             <Brain className="w-4 h-4" />}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análise Inteligente</p>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed">{sugestao.mensagem}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-100 p-4 rounded-2xl flex items-center justify-between mt-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-[#F97316] uppercase tracking-widest">Recomendação Inteligente de Veículo</p>
                        <p className="text-base font-black text-slate-800">{resumo.veiculoSugerido}</p>
                        <p className="text-xs text-slate-500 font-semibold">
                          {novoPedidoData.peso || 0} kg · {resumo.cubagemM3} m³{novoPedidoData.necessidades.includes("refrigerado") ? " · Refrigerado" : ""}{novoPedidoData.necessidades.includes("plataforma") ? " · Plataforma" : ""}{novoPedidoData.fragilidade !== "normal" ? " · Frágil" : ""}{resumo.km > 0 ? ` · ${resumo.km} km` : ""} · Veículo recomendado automaticamente.
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-orange-100 text-[#F97316] flex items-center justify-center">
                        <Truck className="w-6 h-6" />
                      </div>
                    </div>
                  </div>

                  {/* --- Orientações de Recebimento --- */}
                  <div>
                    <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2 mb-4">
                      <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">2</span>
                      Orientações e Janela de Entrega
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Horário Limite para Entrega</Label>
                          <Input type="time" value={novoPedidoData.horario_limite} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, horario_limite: e.target.value })} className="bg-white border-slate-200 rounded-xl" />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-xs font-black text-slate-500 uppercase tracking-wider block">Janelas de Recebimento Permitidas</Label>
                          <div className="space-y-2">
                            {janelas.map((j, jIdx) => (
                              <div key={jIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200/60 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Das</span>
                                  <Input 
                                    type="time" 
                                    value={j.das} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setJanelas(prev => {
                                        const next = [...prev];
                                        next[jIdx].das = val;
                                        return next;
                                      });
                                    }}
                                    className="bg-white border-slate-200 rounded-lg text-xs h-8 flex-1" 
                                  />
                                </div>
                                <div className="flex items-center gap-1.5 flex-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Até</span>
                                  <Input 
                                    type="time" 
                                    value={j.ate} 
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setJanelas(prev => {
                                        const next = [...prev];
                                        next[jIdx].ate = val;
                                        return next;
                                      });
                                    }}
                                    className="bg-white border-slate-200 rounded-lg text-xs h-8 flex-1" 
                                  />
                                </div>
                                {janelas.length > 1 && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    type="button"
                                    className="w-8 h-8 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" 
                                    onClick={() => setJanelas(prev => prev.filter((_, idx) => idx !== jIdx))}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          <Button 
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setJanelas(prev => [...prev, { das: "14:00", ate: "18:00" }])}
                            className="text-[#F97316] hover:text-[#EA580C] hover:bg-orange-50 text-xs font-bold flex items-center gap-1 h-8 rounded-lg"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Adicionar Período
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Quem está autorizado a receber?</Label>
                          <Input value={novoPedidoData.autorizados_receber} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, autorizados_receber: e.target.value })} placeholder="Ex: Apenas recepcionista Maria ou porteiro Jorge" className="bg-white border-slate-200 rounded-xl" />
                        </div>
                        <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                          <input type="checkbox" checked={novoPedidoData.permitir_terceiros} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, permitir_terceiros: e.target.checked })} className="w-5 h-5 accent-[#F97316] rounded" id="permit_terceiros" />
                          <label htmlFor="permit_terceiros" className="text-xs font-bold text-slate-700 cursor-pointer">Permitir entrega a vizinhos ou terceiros autorizados na ausência do destinatário principal?</label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 mt-4">
                      <Label className="text-xs font-black text-slate-500 uppercase tracking-wider">Protocolos Operacionais</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: "conferir_lacre", label: "Conferir lacre" },
                          { id: "validar_nf", label: "Validar NF" },
                          { id: "fotografar_entrega", label: "Fotografar entrega" },
                          { id: "registrar_temperatura", label: "Registrar temperatura" },
                          { id: "conferir_quantidade", label: "Conferir quantidade" },
                          { id: "coletar_nome_documento", label: "Coletar nome/documento" },
                          { id: "exigir_carimbo", label: "Exigir carimbo" },
                          { id: "registrar_avaria", label: "Registrar avaria" },
                          { id: "entregar_responsavel", label: "Entrega somente ao responsável" }
                        ].map((item) => (
                          <div key={item.id} className={`flex items-center gap-2.5 p-2.5 border rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${novoPedidoData.orientacoes_rapidas.includes(item.id) ? "bg-slate-800 border-slate-800 text-white shadow-md shadow-slate-900/10" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"}`} onClick={() => { const curr = novoPedidoData.orientacoes_rapidas; const updated = curr.includes(item.id) ? curr.filter(x => x !== item.id) : [...curr, item.id]; setNovoPedidoData({ ...novoPedidoData, orientacoes_rapidas: updated }); }}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center border transition-all duration-200 ${novoPedidoData.orientacoes_rapidas.includes(item.id) ? "border-white scale-110" : "border-slate-300"}`}>
                              {novoPedidoData.orientacoes_rapidas.includes(item.id) && <div className="w-2 h-2 rounded-full bg-white animate-in zoom-in duration-200" />}
                            </div>
                            <span className="text-xs font-bold leading-tight">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      {novoPedidoData.orientacoes_rapidas.length > 0 && (
                        <div className="overflow-hidden animate-in slide-in-from-top-2 fade-in duration-300">
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2 block">Instruções operacionais adicionais</Label>
                            <Textarea value={novoPedidoData.instrucoes_adicionais} onChange={(e) => setNovoPedidoData({ ...novoPedidoData, instrucoes_adicionais: e.target.value })} placeholder="Descreva instruções complementares para a operação..." className="bg-white border-slate-200 min-h-[80px] text-sm" />
                          </div>
                        </div>
                      )}

                      {/* -- Notificações Elegantes -- */}
                      <div className="space-y-2 mt-4">
                        <div className={`flex items-center gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all duration-300 ${novoPedidoData.notificar_automacao ? "bg-indigo-50/70 border-indigo-200 shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"}`} onClick={() => setNovoPedidoData({ ...novoPedidoData, notificar_automacao: !novoPedidoData.notificar_automacao })}>
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-300 ${novoPedidoData.notificar_automacao ? "bg-indigo-500 text-white scale-110" : "bg-slate-100 text-slate-400"}`}>
                            <Bell className="w-3 h-3" />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-slate-700">Atualizações automáticas da entrega</p>
                            <p className="text-[10px] text-slate-400 font-medium">Receba alertas sobre o status da operação</p>
                          </div>
                          <div className={`w-10 h-6 rounded-full transition-all duration-300 flex items-center ${novoPedidoData.notificar_automacao ? "bg-indigo-500 justify-end" : "bg-slate-200 justify-start"}`}>
                            <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow-sm transition-transform duration-300" />
                          </div>
                        </div>

                        {novoPedidoData.notificar_automacao && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="overflow-hidden">
                            <div className="bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 rounded-2xl p-4 space-y-4">
                              <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Canal de envio</p>
                                <div className="flex gap-2">
                                  {[
                                    { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                                    { id: "email", label: "E-mail", icon: Mail },
                                    { id: "ambos", label: "Ambos", icon: Bell },
                                  ].map(({ id, label, icon: Icon }) => (
                                    <button key={id} onClick={() => setNovoPedidoData({ ...novoPedidoData, notificar_canal: id as any })} className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${novoPedidoData.notificar_canal === id ? "bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm scale-[1.02]" : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"}`}>
                                      <Icon className="w-3.5 h-3.5" />
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alertas</p>
                                <div className="space-y-1.5">
                                  {[
                                    { id: "motorista_saiu", label: "Motorista saiu para entrega" },
                                    { id: "proximo_destino", label: "Pedido próximo do destino" },
                                    { id: "entrega_concluida", label: "Entrega concluída" },
                                    { id: "ocorrencia", label: "Ocorrência operacional" },
                                  ].map(({ id, label }) => {
                                    const campo = `notificar_${id}` as keyof typeof novoPedidoData;
                                    return (
                                      <div key={id} className="flex items-center gap-3 py-1.5 px-2 rounded-xl hover:bg-white/60 transition-colors cursor-pointer" onClick={() => setNovoPedidoData({ ...novoPedidoData, [campo]: !novoPedidoData[campo] })}>
                                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all duration-200 ${novoPedidoData[campo] ? "bg-indigo-500 border-indigo-500" : "border-slate-300"}`}>
                                          {novoPedidoData[campo] && <span className="text-white text-[9px] font-black">✓</span>}
                                        </div>
                                        <span className="text-xs font-medium text-slate-600">{label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ===== STEP 3: REVISÃO FINAL ===== */}
              {novoPedidoStep === 3 && (
                <motion.div key="step3" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="space-y-6">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 text-[#F97316] flex items-center justify-center text-xs font-bold">3</span>
                    Revisão Final do Pedido
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Coleta */}
                    <Card className="border-slate-200/80 rounded-2xl overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">Local de Coleta</span>
                      </div>
                      <div className="p-4 space-y-1.5 text-sm">
                        <p className="font-bold text-slate-800">{novoPedidoData.coleta_rua || "—"}, {novoPedidoData.coleta_numero || "s/n"}{novoPedidoData.coleta_complemento ? ` - ${novoPedidoData.coleta_complemento}` : ""}</p>
                        <p className="text-slate-500 font-medium">{novoPedidoData.coleta_bairro || "—"}, {novoPedidoData.coleta_cidade || "—"} / {novoPedidoData.coleta_uf || "—"} <span className="text-slate-400">— CEP {novoPedidoData.coleta_cep || "—"}</span></p>
                        {novoPedidoData.coleta_contato_nome && <p className="text-slate-500 font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {novoPedidoData.coleta_contato_nome}{novoPedidoData.coleta_contato_telefone ? ` — ${novoPedidoData.coleta_contato_telefone}` : ""}{novoPedidoData.coleta_contato_ramal ? ` (ramal ${novoPedidoData.coleta_contato_ramal})` : ""}</p>}
                        {novoPedidoData.coleta_data && <p className="text-slate-500 font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {new Date(novoPedidoData.coleta_data).toLocaleString("pt-BR")}</p>}
                      </div>
                    </Card>

                    {/* Destinos */}
                    <Card className="border-slate-200/80 rounded-2xl overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center gap-2">
                        <Navigation className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">Destinos / Paradas ({novoPedidoData.destinos.length})</span>
                      </div>
                      <div className="p-4 space-y-3">
                        {novoPedidoData.destinos.map((d, i) => (
                          <div key={i} className="pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[9px] font-black">{String.fromCharCode(65 + i)}</span>
                              <span className="text-xs font-bold text-slate-700">{d.destinatario || `Destino ${i + 1}`}</span>
                            </div>
                            <p className="text-xs text-slate-500 ml-7">{d.rua || "—"}, {d.numero || "s/n"}{d.complemento ? ` - ${d.complemento}` : ""} — {d.cidade || "—"}/{d.uf || "—"}</p>
                            {d.recipientWhatsapp && <p className="text-xs text-slate-400 ml-7">WhatsApp: {d.recipientWhatsapp} {d.notifyRecipientWhatsapp ? "🔔" : ""}</p>}
                          </div>
                        ))}
                      </div>
                    </Card>

                    {/* Carga */}
                    <Card className="border-slate-200/80 rounded-2xl overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">Carga</span>
                      </div>
                      <div className="p-4 space-y-1.5 text-sm">
                        <p className="font-bold text-slate-800">{novoPedidoData.descricao || "—"}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-slate-50 rounded-lg p-2 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase block">Volumes</span><span className="text-sm font-black text-slate-800">{novoPedidoData.volumes || 1}</span></div>
                          <div className="bg-slate-50 rounded-lg p-2 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase block">Peso</span><span className="text-sm font-black text-slate-800">{novoPedidoData.peso || 0} kg</span></div>
                          {novoPedidoData.comprimento && <div className="bg-slate-50 rounded-lg p-2 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase block">Dimensões</span><span className="text-sm font-black text-slate-800">{novoPedidoData.comprimento}x{novoPedidoData.largura}x{novoPedidoData.altura} cm</span></div>}
                          {novoPedidoData.valor_declarado && <div className="bg-slate-50 rounded-lg p-2 text-center"><span className="text-[10px] font-bold text-slate-400 uppercase block">Valor</span><span className="text-sm font-black text-emerald-600">{Number(novoPedidoData.valor_declarado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></div>}
                        </div>
                        {novoPedidoData.necessidades.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {novoPedidoData.necessidades.map(n => {
                              const labels: Record<string, string> = {
                                coleta_doca: "Coleta em doca",
                                agendamento: "Agendamento",
                                conferencia: "C/ conferência",
                                canhoto_assinado: "Canhoto assinado",
                                ajudante: "Ajudante",
                                uniforme: "Uniforme",
                                epi: "EPI",
                                veiculo_alto: "Restr. veículo alto",
                                area_risco: "Área de risco",
                                condominio: "Condomínio",
                                paletizacao: "Paletização",
                                fracionada: "Fracionada",
                                refrigerado: "Refrigerado",
                                urgente: "Urgente",
                                fragil: "Frágil",
                                nao_empilhar: "Não empilhar",
                                valiosa: "Valiosa",
                                rastreado: "Rastreamento",
                                foto_entrega: "Foto na entrega",
                                cpf_documento: "CPF/documento"
                              };
                              return <span key={n} className="text-[10px] font-bold bg-orange-50 text-[#F97316] px-2 py-0.5 rounded-full border border-orange-200">{labels[n] || n}</span>;
                            })}
                            {novoPedidoData.necessidades.includes("refrigerado") && (novoPedidoData.temperatura_minima || novoPedidoData.temperatura_maxima) && (
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                                {novoPedidoData.temperatura_minima || "—"}°C ~ {novoPedidoData.temperatura_maxima || "—"}°C
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Orientações */}
                    <Card className="border-slate-200/80 rounded-2xl overflow-hidden">
                      <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wider">Orientações de Entrega</span>
                      </div>
                      <div className="p-4 space-y-1.5 text-sm">
                        {novoPedidoData.horario_limite ? <p className="font-medium text-slate-700">Horário limite: <span className="font-black">{novoPedidoData.horario_limite}</span></p> : <p className="text-slate-400">Horário limite: —</p>}
                        {novoPedidoData.janela_recebimento && <p className="font-medium text-slate-700">Janela: <span className="font-black">{novoPedidoData.janela_recebimento}</span></p>}
                        {novoPedidoData.autorizados_receber && <p className="font-medium text-slate-700">Autorizados: <span className="font-black">{novoPedidoData.autorizados_receber}</span></p>}
                        <p className="font-medium text-slate-700">Permitir terceiros: <span className="font-black">{novoPedidoData.permitir_terceiros ? "Sim" : "Não"}</span></p>
                        {novoPedidoData.orientacoes_rapidas.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {novoPedidoData.orientacoes_rapidas.map(o => {
                              const labels: Record<string, string> = {
                                conferir_lacre: "Conferir lacre",
                                validar_nf: "Validar NF",
                                fotografar_entrega: "Fotografar entrega",
                                registrar_temperatura: "Registrar temperatura",
                                conferir_quantidade: "Conferir quantidade",
                                coletar_nome_documento: "Coletar nome/doc",
                                exigir_carimbo: "Exigir carimbo",
                                registrar_avaria: "Registrar avaria",
                                entregar_responsavel: "Só ao responsável"
                              };
                              return <span key={o} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{labels[o] || o}</span>;
                            })}
                          </div>
                        )}
                        {novoPedidoData.instrucoes_adicionais && (
                          <p className="font-medium text-slate-700 mt-2">Instruções adicionais: <span className="font-black">{novoPedidoData.instrucoes_adicionais}</span></p>
                        )}
                        {novoPedidoData.notificar_automacao && (
                          <div className="border-t border-slate-100 pt-2 mt-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Bell className="w-3 h-3" /> Notificações ativas
                            </p>
                            <p className="text-xs text-slate-600 mt-1 font-medium">
                              Canal: <span className="font-black capitalize">{novoPedidoData.notificar_canal}</span>
                              {novoPedidoData.notificar_motorista_saiu && " · Motorista saiu"}
                              {novoPedidoData.notificar_proximo_destino && " · Próximo do destino"}
                              {novoPedidoData.notificar_entrega_concluida && " · Entrega concluída"}
                              {novoPedidoData.notificar_ocorrencia && " · Ocorrência"}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  {/* Tempo Médio de Rota */}
                  {resumo.km > 0 && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="bg-gradient-to-r from-slate-50 to-slate-100/80 border border-slate-200 p-5 rounded-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Tempo Médio de Rota
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">⏱ Tempo estimado</p>
                          <p className="text-lg font-black text-slate-800 mt-1">{resumo.tempoEstimado}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-slate-100 text-center">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">📍 Distância total</p>
                          <p className="text-lg font-black text-slate-800 mt-1">{resumo.km} km</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Vehicle Recommendation */}
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-5 rounded-2xl flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-[#F97316] uppercase tracking-widest">Veículo Sugerido</p>
                      <p className="text-lg font-black text-slate-800">{resumo.veiculoSugerido}</p>
                      <p className="text-xs text-slate-500 font-semibold">
                        {resumo.peso} kg · {resumo.cubagemM3 > 0 ? `${resumo.cubagemM3} m³` : "cubagem não informada"}
                        {resumo.km > 0 ? ` · ${resumo.km} km` : ""} · {resumo.sla} SLA
                        {resumo.refrigerado ? " · Refrigerado" : ""}
                      </p>
                    </div>
                    <Truck className="w-8 h-8 text-[#F97316]" />
                  </div>

                  {sugestao && (
                    <div className={`rounded-2xl p-4 flex items-start gap-3 ${
                      sugestao.tipo === "warning" ? "bg-amber-50/80 border border-amber-200" :
                      sugestao.tipo === "tip" ? "bg-blue-50/80 border border-blue-200" :
                      "bg-slate-50/80 border border-slate-200"
                    }`}>
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        sugestao.tipo === "warning" ? "bg-amber-100 text-amber-600" :
                        sugestao.tipo === "tip" ? "bg-blue-100 text-blue-600" :
                        "bg-slate-100 text-slate-600"
                      }`}>
                        {sugestao.tipo === "warning" ? <AlertTriangle className="w-4 h-4" /> :
                         sugestao.tipo === "tip" ? <Zap className="w-4 h-4" /> :
                         <Brain className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Análise Inteligente</p>
                        <p className="text-xs font-semibold text-slate-700 leading-relaxed">{sugestao.mensagem}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between flex-shrink-0 bg-white">
              <div>
                {novoPedidoStep > 1 && (
                  <Button variant="outline" className="bg-white border-slate-200 rounded-full px-6 font-bold" onClick={() => setNovoPedidoStep((prev) => prev - 1)} disabled={criandoPedido}>
                    Voltar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  className="rounded-full px-6 font-bold text-slate-500 hover:text-slate-800" 
                  onClick={() => { setShowNovoPedidoModal(false); setNovoPedidoStep(1); }}
                  disabled={criandoPedido}
                >
                  Cancelar
                </Button>
                {novoPedidoStep < 3 ? (
                  <Button 
                    className="group bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-8 font-bold shadow-lg shadow-orange-500/20 transition-all duration-300 hover:scale-[1.03] flex items-center gap-1.5" 
                    onClick={() => setNovoPedidoStep((prev) => prev + 1)}
                  >
                    Próximo
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                ) : (
                  <Button 
                    className="group bg-[#F97316] hover:bg-[#EA580C] text-white rounded-full px-8 font-bold shadow-lg shadow-orange-500/20 transition-all duration-300 hover:scale-[1.03] flex items-center gap-1.5" 
                    onClick={handleCriarPedido}
                    disabled={criandoPedido}
                  >
                    {criandoPedido ? (
                      <>
                        Processando...
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </>
                    ) : (
                      <>
                        Criar Pedido
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Sucesso do Pedido Criado */}
      <Dialog open={showSucessoModal} onOpenChange={setShowSucessoModal}>
        <DialogContent className="max-w-2xl bg-white border-slate-200 p-0 overflow-hidden rounded-3xl shadow-2xl">
          <div className="p-8 text-center bg-slate-50 border-b border-slate-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Pedido Solicitado com Sucesso!</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">Seu pedido foi registrado com sucesso. Nossa equipe já está verificando o profissional mais adequado para o seu transporte. Em breve você poderá acompanhar em tempo real toda a operação.</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Número do Pedido</p>
                <p className="text-xl font-black text-[#F97316] mt-1">{createdOrderDetails?.numero_pedido}</p>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status Inicial</p>
                <Badge className="bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-bold mt-1.5 px-3 py-0.5">
                  Aguardando Triagem
                </Badge>
              </div>
            </div>

            <div className="space-y-3 bg-white border border-slate-200 p-5 rounded-2xl">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#F97316] mt-1" />
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Origem / Coleta</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {createdOrderDetails?.coleta_rua}, {createdOrderDetails?.coleta_numero} - {createdOrderDetails?.coleta_cidade}/{createdOrderDetails?.coleta_uf}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 my-2" />

              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-slate-800 mt-1" />
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Destino Final / Destinatário</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {createdOrderDetails?.entrega_destinatario}
                  </p>
                  <p className="text-xs text-slate-500 font-bold">
                    {createdOrderDetails?.entrega_rua}, {createdOrderDetails?.entrega_numero} - {createdOrderDetails?.entrega_cidade}/{createdOrderDetails?.entrega_uf}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
            <Button
              variant="outline"
              className="bg-white border-slate-200 rounded-full px-6 font-bold"
              onClick={() => {
                window.print();
              }}
            >
              Imprimir Canhoto
            </Button>
            <Button
              className="bg-slate-800 hover:bg-slate-900 text-white rounded-full px-6 font-bold"
              onClick={() => setShowSucessoModal(false)}
            >
              Concluído
            </Button>
          </div>
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