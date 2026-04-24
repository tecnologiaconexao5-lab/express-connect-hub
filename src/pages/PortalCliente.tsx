import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Package, PlusCircle, FileText, DollarSign, LogOut, Search, Download, MapPin, Clock, CheckCircle, AlertTriangle, 
  Truck, User, Phone, Mail, ChevronRight, X, Camera, Signature, MapPinned, Activity, Calendar, BarChart3, 
  Send, Route, Users, FileUp, AlertCircle, TrendingUp, Wallet, CreditCard, Bell, Settings, LogIn,
  Clock3, Package2, Navigation, CheckCheck, MoreHorizontal, Eye, PhoneCall, MessageSquare, Play, Pause,
  Grid3X3, List, Calculator, Map, Navigation2, Star, ThumbsUp, ThumbsDown, Minus, Plus, Filter,
  QrCode, ExternalLink, RefreshCw, Moon, Sun, Building2, Home, Briefcase, Ruler, Scale, ArrowRight,
  FilePlus, FileCheck, History, Award, TrendingDown, TrendingEqual
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
  comentario?: string;
  os_id: string;
  created_at: string;
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
  "programacao": "bg-slate-100 text-slate-600 border-slate-200",
  "coleta": "bg-blue-100 text-blue-600 border-blue-200",
  "saiu_para_rota": "bg-purple-100 text-purple-600 border-purple-200",
  "em_rota": "bg-orange-100 text-orange-600 border-orange-200",
  "entregue": "bg-emerald-100 text-emerald-600 border-emerald-200",
  "atrasada": "bg-red-100 text-red-600 border-red-200",
  "problema": "bg-red-100 text-red-600 border-red-200",
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
  { id: "pedidos", icon: Package, label: "Pedidos" },
  { id: "rastreio", icon: MapPin, label: "Rastreamento" },
  { id: "roteirizacao", icon: Route, label: "Roteirização" },
  { id: "financeiro", icon: DollarSign, label: "Financeiro" },
  { id: "ocorrencias", icon: AlertCircle, label: "Ocorrências" },
  { id: "notificacoes", icon: Bell, label: "Notificações" },
  { id: "avaliacao", icon: Star, label: "Avaliação" },
];

export default function PortalCliente() {
  const navigate = useNavigate();
  const user = getUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaItem[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [enderecosFavoritos, setEnderecosFavoritos] = useState<EnderecoFavorito[]>([]);
  const [roteirizacao, setRoteirizacao] = useState<RoteirizacaoRota[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteData, setClienteData] = useState<any>(null);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [selectedEntregas, setSelectedEntregas] = useState<Set<string>>(new Set());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [showNovoPedidoModal, setShowNovoPedidoModal] = useState(false);
  const [buscaGlobal, setBuscaGlobal] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("30dias");
  const [operacaoStatus, setOperacaoStatus] = useState<"saudavel" | "atencao" | "critico">("saudavel");
  
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

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const clienteNome = user?.name || user?.email || "";
      const clienteFiltro = clienteNome ? clienteNome.replace(/@.+$/, "").trim() : "";

      const [{ data: clienteInfo }, { data: entregasData }, { data: faturasData }, { data: ocorrenciasData }] = await Promise.all([
        clienteFiltro ? supabase.from('clientes').select('*').ilike('nome_fantasia', `%${clienteFiltro}%`).limit(1).single() : Promise.resolve({ data: null }),
        supabase.from('ordens_servico').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('financeiro_receber').select('*').order('data_vencimento', { ascending: false }).limit(20),
        supabase.from('ocorrencias').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      setClienteData(clienteInfo);

      if (entregasData && entregasData.length > 0) {
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
      } else {
        setEntregas([]);
      }

      if (faturasData && faturasData.length > 0) {
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
      } else {
        setFaturas([]);
      }

      if (ocorrenciasData && ocorrenciasData.length > 0) {
        const ocorrenciasTransformadas = ocorrenciasData.map((o: any) => ({
          id: o.id,
          tipo: o.tipo || 'outro',
          descricao: o.descricao || '',
          status: o.status || 'pendente',
          prioridade: o.severidade === 'alta' ? 'alta' : 'media',
          created_at: o.created_at,
        }));
        setOcorrencias(ocorrenciasTransformadas);
      } else {
        setOcorrencias([]);
      }

      setAlertas([]);
      setNotificacoes([]);
      setAvaliacoes([]);
      setEnderecosFavoritos([]);
      setRoteirizacao([]);
    } catch (error) {
      console.error('Erro ao carregar dados do Supabase:', error);
      setEntregas([]);
      setAlertas([]);
      setFaturas([]);
      setNotificacoes([]);
      setOcorrencias([]);
      setAvaliacoes([]);
      setEnderecosFavoritos([]);
      setRoteirizacao([]);
    }
    setLoading(false);
  }, [user]);

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
    {id: "1", nota: 5, comentario: "Entrega super rápida!", os_id: "OS-202610-1028", created_at: "2026-04-10T14:00:00"},
    {id: "2", nota: 4, comentario: "Tudo certo, recomendo", os_id: "OS-202609-9802", created_at: "2026-04-05T16:00:00"},
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

  useEffect(() => { carregarDados(); }, [carregarDados]);

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
    const promotores = avaliacoes.filter(a => a.nota >= 4).length;
    const detratores = avaliacoes.filter(a => a.nota <= 2).length;
    return Math.round(((promotores - detratores) / avaliacoes.length) * 100) || 0;
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
    if (!historico || historico.length === 0) return <div className="text-sm text-slate-400">Aguardando informações</div>;
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
                idx <= currentIdx ? "bg-gradient-to-br from-purple-500 to-orange-500 text-white" : "bg-slate-200 text-slate-400"
              }`}>
                <step.icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${idx <= currentIdx ? "text-purple-600" : "text-slate-400"}`}>{step.label}</span>
            </div>
            {idx < steps.length - 1 && <div className={`w-6 h-0.5 ${idx < currentIdx ? "bg-gradient-to-r from-purple-500 to-orange-500" : "bg-slate-200"}`} />}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-900">
      {/* Sidebar Fixa */}
      <aside className={`fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 border-r border-slate-700/50 z-50 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? "w-20" : "w-64"
      }`}>
        {/* Logo */}
        <div className="h-20 flex items-center px-4 border-b border-slate-700/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg">
            CE
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3">
              <h1 className="font-bold text-white text-sm">Conexão Express</h1>
              <p className="text-[10px] text-slate-400">Portal do Cliente</p>
            </div>
          )}
        </div>

        {/* Menu */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {itensSidebar.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? "bg-gradient-to-r from-orange-500/20 to-purple-500/20 text-white border-l-2 border-orange-500" 
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              {item.id === "notificacoes" && !sidebarCollapsed && naoLidas > 0 && (
                <span className="ml-auto px-2 py-0.5 text-[10px] bg-red-500 rounded-full">{naoLidas}</span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0) || "C"}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.name || "Cliente"}</p>
                <p className="text-[10px] text-slate-400 truncate">{clienteData?.nome_fantasia || clienteData?.razao_social || user?.email || ""}</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse Button */}
        <button 
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-slate-800 border border-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "ml-20" : "ml-64"}`}>
        {/* Topbar */}
        <header className="h-16 bg-slate-800/50 border-b border-slate-700/50 flex items-center px-6 justify-between backdrop-blur-xl">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar pedidos, clientes, destinos..." 
              className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white relative">
                    <Bell className="w-5 h-5" />
                    {naoLidas > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-slate-800 border-slate-700 text-white">
                  <p>{naoLidas} notificações não lidas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <Button 
              className="bg-gradient-to-r from-orange-500 to-purple-500 hover:from-orange-600 hover:to-purple-600 border-0 rounded-xl"
              onClick={() => setShowNovoPedidoModal(true)}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              Novo Pedido
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1 p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="space-y-6">
            {/* ===== DASHBOARD ===== */}
            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">{getSaudacao()}, {user?.name || "Cliente"}!</h2>
                    <p className="text-slate-400">Este é o resumo da sua operação hoje</p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700">
                    <span className={`w-2 h-2 rounded-full ${
                      operacaoStatus === "saudavel" ? "bg-emerald-500" : operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
                    } animate-pulse`} />
                    <span className="text-sm text-slate-300">
                      Operação {operacaoStatus === "saudavel" ? "Saudável" : operacaoStatus === "atencao" ? "Atenção" : "Crítica"}
                    </span>
                  </div>
                </div>

                {/* Cards Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {label: "Pedidos Ativos", value: metricas?.ativos ?? 0, icon: Package, color: "from-purple-500 to-purple-600", change: metricas?.comparacaoDia ?? 0, desc: "vsOntem"},
                    {label: "SLA no Prazo", value: `${metricas?.slaMedio ?? 0}%`, icon: Clock, color: "from-emerald-500 to-emerald-600", change: 5, desc: "vsontem"},
                    {label: "Em Rota", value: metricas?.emRota ?? 0, icon: Truck, color: "from-orange-500 to-orange-600", change: -2, desc: "vsontem"},
                    {label: "Taxa de Sucesso", value: `${metricas?.taxaSucesso ?? 0}%`, icon: CheckCircle, color: "from-blue-500 to-blue-600", change: 8, desc: "vsontem"},
                  ].map((card, idx) => (
                    <Card key={idx} className="bg-slate-800/50 border-slate-700/50 backdrop-blur">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-slate-400 uppercase">{card.label}</p>
                            <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                            <div className={`flex items-center gap-1 mt-2 text-xs ${card.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {card.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              <span>{Math.abs(card.change)}% {card.desc}</span>
                            </div>
                          </div>
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                            <card.icon className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Gráficos */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700/50">
                    <CardHeader><CardTitle className="text-base text-white">Evolução de Entregas</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-48 flex items-end gap-3 px-4">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((dia, i) => {
                          const height = [60, 80, 45, 90, 75, 30, 0][i];
                          return (
                            <div key={dia} className="flex-1 flex flex-col items-center gap-2">
                              <div className="w-full bg-gradient-to-t from-orange-500 to-purple-500 rounded-t-lg" style={{height: `${height}%`}} />
                              <span className="text-xs text-slate-400">{dia}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardHeader><CardTitle className="text-base text-white">Status dos Pedidos</CardTitle></CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center gap-4 py-4">
                        <div className="relative w-32 h-32">
                          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray="60 40" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f97316" strokeWidth="3" strokeDasharray="25 75" strokeDashoffset="-60" />
                            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray="15 85" strokeDashoffset="-85" />
                          </svg>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-slate-300">Entregues (60%)</span></div>
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-xs text-slate-300">Em Rota (25%)</span></div>
                          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-slate-300">Atrasados (15%)</span></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pedidos Recentes */}
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-white">Pedidos Recentes</CardTitle>
                    <Button variant="ghost" size="sm" className="text-purple-400" onClick={() => setActiveTab("pedidos")}>Ver todos →</Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {entregas.slice(0, 4).map(entrega => (
                      <div key={entrega.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 cursor-pointer" onClick={() => {setSelectedEntrega(entrega); setShowDetailModal(true);}}>
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusCores[entrega.status]}`}>
                            {getStatusIcone(entrega.status)}
                          </div>
                          <div>
                            <p className="font-medium text-white">{entrega.numero}</p>
                            <p className="text-xs text-slate-400">{entrega.origem.cidade} → {entrega.destino.cidade}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={statusCores[entrega.status]}>{entrega.status_label}</Badge>
                          <span className="text-sm text-slate-400">{fmtData(entrega.previsao)}</span>
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
                  <h2 className="text-xl font-bold text-white">Pedidos</h2>
                  <div className="flex gap-3">
                    <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                      <SelectTrigger className="w-[150px] bg-slate-800 border-slate-700 text-white rounded-xl">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="todos" className="text-white">Todos</SelectItem>
                        <SelectItem value="programacao" className="text-white">Programado</SelectItem>
                        <SelectItem value="em_rota" className="text-white">Em Rota</SelectItem>
                        <SelectItem value="entregue" className="text-white">Entregue</SelectItem>
                        <SelectItem value="atrasada" className="text-white">Atrasado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" className="border-slate-700 text-slate-300 rounded-xl">
<FilePlus className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                    <Button className="bg-gradient-to-r from-orange-500 to-purple-500 rounded-xl" onClick={() => setShowNovoPedidoModal(true)}>
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Novo Pedido
                    </Button>
                  </div>
                </div>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-700/30">
                        <TableRow>
                          <TableHead className="text-slate-300 w-10"><Checkbox /></TableHead>
                          <TableHead className="text-slate-300">ID</TableHead>
                          <TableHead className="text-slate-300">Cliente</TableHead>
                          <TableHead className="text-slate-300">Destino</TableHead>
                          <TableHead className="text-slate-300">Status</TableHead>
                          <TableHead className="text-slate-300">Valor</TableHead>
                          <TableHead className="text-slate-300">Previsão</TableHead>
                          <TableHead className="text-slate-300 w-20">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEntregas.map(entrega => (
                          <TableRow key={entrega.id} className="border-slate-700/50 hover:bg-slate-700/30">
                            <TableCell><Checkbox checked={selectedEntregas.has(entrega.id)} onCheckedChange={() => toggleSelecionar(entrega.id)} /></TableCell>
                            <TableCell className="font-medium text-white">{entrega.numero}</TableCell>
                            <TableCell className="text-slate-300">{entrega.cliente_nome}</TableCell>
                            <TableCell className="text-slate-300">{entrega.destino.cidade}/{entrega.destino.uf}</TableCell>
                            <TableCell><Badge variant="outline" className={statusCores[entrega.status]}>{entrega.status_label}</Badge></TableCell>
                            <TableCell className="text-white">{fmtFin(entrega.valor_frete)}</TableCell>
                            <TableCell className="text-slate-300">{fmtData(entrega.previsao)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-white" onClick={() => {setSelectedEntrega(entrega); setShowDetailModal(true);}}>
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="w-8 h-8 text-slate-400 hover:text-white">
                                  <MapPin className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== RASTREAMENTO ===== */}
            {activeTab === "rastreio" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <Card className="lg:col-span-2 bg-slate-800/50 border-slate-700/50">
                  <CardHeader><CardTitle className="text-white">Mapa de Rastreamento</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-[500px] bg-slate-700/30 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <Map className="w-16 h-16 mx-auto text-slate-600" />
                        <p className="text-slate-400 mt-4">Mapa em tempo real</p>
                        <p className="text-sm text-slate-500">Integração Google Maps / Mapbox</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader><CardTitle className="text-white">Detalhes do Pedido</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-slate-700/30 rounded-xl">
                      <p className="text-xs text-slate-400">Selecione um pedido para ver detalhes</p>
                    </div>
                    <div className="space-y-3">
                      <Button variant="outline" className="w-full border-slate-700 text-slate-300 justify-start">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Gerar Link Público
                      </Button>
                      <Button variant="outline" className="w-full border-slate-700 text-slate-300 justify-start">
                        <QrCode className="w-4 h-4 mr-2" />
                        Gerar QR Code
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== ROTEIRIZAÇÃO ===== */}
            {activeTab === "roteirizacao" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Roteirização Inteligente</h2>
                  <Button className="bg-gradient-to-r from-orange-500 to-purple-500">
                    <Route className="w-4 h-4 mr-2" />
                    Gerar Roteiro
                  </Button>
                </div>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader><CardTitle className="text-white">Rotas Sugeridas</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {roteirizacao.map(rota => (
                      <div key={rota.id} className="p-4 bg-slate-700/30 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center">
                            <Truck className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{rota.regiao}</p>
                            <p className="text-sm text-slate-400">{rota.veiculo} • {rota.pedidos.length} pedidos • {rota.peso_total}kg</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm text-slate-400">{rota.km} km</p>
                            <p className="text-xs text-slate-500">{rota.bairros.length} bairros</p>
                          </div>
                          <Button variant="outline" size="sm" className="border-slate-600 text-slate-300">
                            Aplicar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== FINANCEIRO ===== */}
            {activeTab === "financeiro" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <Wallet className="w-5 h-5 text-red-400" />
                        <p className="text-sm text-slate-400">Vencidas</p>
                      </div>
                      <p className="text-2xl font-bold text-white mt-2">{fmtFin(0)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-blue-400" />
                        <p className="text-sm text-slate-400">A Vencer</p>
                      </div>
                      <p className="text-2xl font-bold text-white mt-2">{fmtFin(totalAVencer)}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                        <p className="text-sm text-slate-400">Pagos</p>
                      </div>
                      <p className="text-2xl font-bold text-white mt-2">{fmtFin(totalFaturado)}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white">Faturas</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="border-slate-600 text-slate-300"><FileText className="w-4 h-4 mr-2" />PDF</Button>
                      <Button variant="outline" size="sm" className="border-slate-600 text-slate-300"><FileText className="w-4 h-4 mr-2" />Excel</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-700/30">
                        <TableRow><TableHead className="text-slate-300">Fatura</TableHead><TableHead className="text-slate-300">Competência</TableHead><TableHead className="text-slate-300">Valor</TableHead><TableHead className="text-slate-300">Vencimento</TableHead><TableHead className="text-slate-300">Status</TableHead></TableRow>
                      </TableHeader>
                      <TableBody>
                        {faturas.map(fatura => (
                          <TableRow key={fatura.id} className="border-slate-700/50">
                            <TableCell className="text-white font-medium">{fatura.fatura}</TableCell>
                            <TableCell className="text-slate-300">{fatura.competencia}</TableCell>
                            <TableCell className="text-white">{fmtFin(fatura.valor)}</TableCell>
                            <TableCell className="text-slate-300">{fmtData(fatura.vencimento)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={fatura.status === "paga" ? "bg-emerald-900/30 text-emerald-400 border-emerald-800" : fatura.status === "a_vencer" ? "bg-blue-900/30 text-blue-400 border-blue-800" : "bg-red-900/30 text-red-400 border-red-800"}>
                                {fatura.status === "paga" ? "Pago" : fatura.status === "a_vencer" ? "A Vencer" : "Vencida"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== OCORRÊNCIAS ===== */}
            {activeTab === "ocorrencias" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Abertas</p><p className="text-2xl font-bold text-white">0</p></CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Em Análise</p><p className="text-2xl font-bold text-white">0</p></CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Resolvidas</p><p className="text-2xl font-bold text-white">1</p></CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">SLA</p><p className="text-2xl font-bold text-white">100%</p></CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-white">Lista de Ocorrências</CardTitle>
                    <Button className="bg-gradient-to-r from-orange-500 to-purple-500"><AlertCircle className="w-4 h-4 mr-2" />Nova Ocorrência</Button>
                  </CardHeader>
                  <CardContent>
                    {ocorrencias.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                        <p>Nenhuma ocorrência registrada</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ocorrencias.map(oc => (
                          <div key={oc.id} className="p-4 bg-slate-700/30 rounded-xl">
                            <div className="flex items-center justify-between">
                              <div><p className="font-medium text-white">{oc.tipo}</p><p className="text-sm text-slate-400">{oc.descricao}</p></div>
                              <Badge variant="outline">{oc.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== NOTIFICAÇÕES ===== */}
            {activeTab === "notificacoes" && (
              <div className="space-y-6">
                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader><CardTitle className="text-white">Notificações</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {notificacoes.map(notif => (
                      <div key={notif.id} className={`p-4 rounded-xl ${notif.lida ? "bg-slate-700/30" : "bg-slate-700/50 border-l-2 border-orange-500"}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            notif.tipo === "entrega" ? "bg-emerald-500/20 text-emerald-400" :
                            notif.tipo === "risco" ? "bg-red-500/20 text-red-400" :
                            "bg-purple-500/20 text-purple-400"
                          }`}>
                            {notif.tipo === "entrega" ? <CheckCircle className="w-5 h-5" /> :
                             notif.tipo === "risco" ? <AlertTriangle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-white">{notif.titulo}</p>
                            <p className="text-sm text-slate-400">{notif.mensagem}</p>
                            <p className="text-xs text-slate-500 mt-2">{fmtData(notif.created_at)}</p>
                          </div>
                          {!notif.lida && <span className="w-2 h-2 bg-orange-500 rounded-full" />}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* ===== AVALIAÇÃO ===== */}
            {activeTab === "avaliacao" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-gradient-to-br from-purple-500 to-orange-500 border-0">
                    <CardContent className="p-6 text-center">
                      <p className="text-4xl font-bold text-white">{npsScore}</p>
                      <p className="text-sm text-white/80">NPS Score</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Promotores</p><p className="text-2xl font-bold text-emerald-400">{avaliacoes.filter(a => a.nota >= 4).length}</p></CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Avaliações</p><p className="text-2xl font-bold text-white">{avaliacoes.length}</p></CardContent>
                  </Card>
                  <Card className="bg-slate-800/50 border-slate-700/50">
                    <CardContent className="p-5"><p className="text-sm text-slate-400">Detratores</p><p className="text-2xl font-bold text-red-400">{avaliacoes.filter(a => a.nota <= 2).length}</p></CardContent>
                  </Card>
                </div>

                <Card className="bg-slate-800/50 border-slate-700/50">
                  <CardHeader><CardTitle className="text-white">Feedbacks</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {avaliacoes.map(av => (
                      <div key={av.id} className="p-4 bg-slate-700/30 rounded-xl">
                        <div className="flex items-center gap-2 mb-2">
                          {[1,2,3,4,5].map(s => (
                            <Star key={s} className={`w-4 h-4 ${s <= av.nota ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                          ))}
                        </div>
                        {av.comentario && <p className="text-sm text-slate-300">{av.comentario}</p>}
                        <p className="text-xs text-slate-500 mt-2">{av.os_id} • {fmtData(av.created_at)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Modal Detalhe do Pedido */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              {selectedEntrega?.numero}
            </DialogTitle>
          </DialogHeader>
          {selectedEntrega && (
            <div className="space-y-5 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 bg-slate-700/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusCores[selectedEntrega.status]}`}>
                    {getStatusIcone(selectedEntrega.status)}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{selectedEntrega.status_label}</p>
                    <p className="text-sm text-slate-400">SLA: {selectedEntrega.sla}%</p>
                  </div>
                </div>
                <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowProblemaModal(true)}>
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Reportar
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-xs text-blue-400 uppercase">Origem</p>
                  <p className="font-medium text-white mt-1">{selectedEntrega.origem.cidade}/{selectedEntrega.origem.uf}</p>
                  <p className="text-sm text-slate-400">{selectedEntrega.origem.rua}, {selectedEntrega.origem.numero}</p>
                </div>
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <p className="text-xs text-emerald-400 uppercase">Destino</p>
                  <p className="font-medium text-white mt-1">{selectedEntrega.destino.cidade}/{selectedEntrega.destino.uf}</p>
                  <p className="text-sm text-slate-400">{selectedEntrega.destino.rua}, {selectedEntrega.destino.numero}</p>
                </div>
              </div>

              {selectedEntrega.destinatario && (
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase mb-2">Destinatário</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div><p className="text-xs text-slate-500">Nome</p><p className="text-white">{selectedEntrega.destinatario.nome}</p></div>
                    <div><p className="text-xs text-slate-500">Documento</p><p className="text-white">{selectedEntrega.destinatario.documento}</p></div>
                    <div><p className="text-xs text-slate-500">Telefone</p><p className="text-white">{selectedEntrega.destinatario.telefone}</p></div>
                  </div>
                </div>
              )}

              {selectedEntrega.prestador && (
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase mb-2">Motorista</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-300" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{selectedEntrega.prestador.nome}</p>
                        <p className="text-sm text-slate-400">{selectedEntrega.prestador.veiculo} • {selectedEntrega.prestador.placa}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-400 uppercase mb-3">Timeline</p>
                <StepTimeline historico={selectedEntrega.historico} />
              </div>

              {selectedEntrega.status === "entregue" && selectedEntrega.pod && (
                <div className="p-4 bg-slate-700/30 rounded-xl">
                  <p className="text-xs text-slate-400 uppercase mb-3">Comprovante de Entrega</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="aspect-video bg-slate-600 rounded-lg flex items-center justify-center">
                      <Camera className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="aspect-video bg-slate-600 rounded-lg flex items-center justify-center">
                      <Signature className="w-8 h-8 text-slate-400" />
                    </div>
                  </div>
                  {selectedEntrega.pod.receptor && (
                    <div className="p-3 bg-slate-600/50 rounded-lg">
                      <p className="text-sm"><span className="text-slate-400">Recebedor:</span> <span className="text-white">{selectedEntrega.pod.receptor}</span></p>
                      <p className="text-sm"><span className="text-slate-400">Parentesco:</span> <span className="text-white">{selectedEntrega.pod.grau_parentesco}</span></p>
                    </div>
                  )}
                  <Button className="w-full mt-3 bg-gradient-to-r from-orange-500 to-purple-500">
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Comprovante
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowDetailModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reportar Problema */}
      <Dialog open={showProblemaModal} onOpenChange={setShowProblemaModal}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Reportar Problema
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue placeholder="Tipo de problema" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="atraso" className="text-white">Atraso na Entrega</SelectItem>
                <SelectItem value="nao_encontrado" className="text-white">Cliente Não Encontrado</SelectItem>
                <SelectItem value="avariado" className="text-white">Produto Avariado</SelectItem>
                <SelectItem value="falta" className="text-white">Mercadoria Faltando</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição do problema..." className="bg-slate-700 border-slate-600 text-white" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowProblemaModal(false)}>Cancelar</Button>
            <Button className="bg-red-500">Reportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Pedido */}
      <Dialog open={showNovoPedidoModal} onOpenChange={setShowNovoPedidoModal}>
        <DialogContent className="max-w-3xl bg-slate-800 border-slate-700 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Pedido</DialogTitle>
            <DialogDescription className="text-slate-400">Preencha os dados do seu pedido</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">CEP Origem</Label>
                <Input placeholder="00000-000" className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">CEP Destino</Label>
                <Input placeholder="00000-000" className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-300">Descrição da Mercadoria</Label>
                <Input placeholder="Ex: Peças automotivas" className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Peso (kg)</Label>
                <Input type="number" placeholder="0" className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div>
                <Label className="text-slate-300">Volumes</Label>
                <Input type="number" placeholder="0" className="bg-slate-700 border-slate-600 text-white" />
              </div>
              <div className="col-span-2">
                <Label className="text-slate-300">Observações</Label>
                <Textarea placeholder="Instruções..." className="bg-slate-700 border-slate-600 text-white" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={() => setShowNovoPedidoModal(false)}>Cancelar</Button>
            <Button className="bg-gradient-to-r from-orange-500 to-purple-500">Criar Pedido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}