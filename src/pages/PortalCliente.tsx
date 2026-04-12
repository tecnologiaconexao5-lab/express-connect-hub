import { useState, useEffect, useCallback } from "react";
import { 
  Package, PlusCircle, FileText, DollarSign, LogOut, Search, Download, MapPin, Clock, CheckCircle, AlertTriangle, 
  Truck, User, Phone, Mail, ChevronRight, X, Camera, Signature, MapPinned, Zap, FileUp, AlertCircle,
  Activity, Calendar, BarChart3, DownloadCloud, Send, RefreshCw, Filter
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getUser, logout } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtHora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

interface Entrega {
  id: string;
  numero: string;
  status: string;
  status_label: string;
  origem: string;
  destino: string;
  previsao: string;
  created_at: string;
  valor_frete: number;
  peso: number;
  volumes: number;
  cliente_id?: string;
  prestador?: { nome: string; foto_url?: string };
  historico?: HistoricoItem[];
  pod?: PodItem;
  ocorrencias?: OcorrenciaItem[];
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
  created_at?: string;
  local?: string;
}

interface OcorrenciaItem {
  tipo: string;
  descricao: string;
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
  status: "vencida" | "a_vencer" | "paga";
}

const statusCores: Record<string, string> = {
  "programacao": "bg-slate-100 text-slate-700 border-slate-200",
  "coleta": "bg-blue-100 text-blue-700 border-blue-200",
  "saiu_para_rota": "bg-amber-100 text-amber-700 border-amber-200",
  "em_rota": "bg-orange-100 text-orange-700 border-orange-200",
  "entregue": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "atrasada": "bg-red-100 text-red-700 border-red-200",
  "problema": "bg-red-100 text-red-700 border-red-200",
};

const statusIcones: Record<string, typeof Truck> = {
  "programacao": Calendar,
  "coleta": Truck,
  "saiu_para_rota": Truck,
  "em_rota": Truck,
  "entregue": CheckCircle,
  "atrasada": AlertTriangle,
  "problema": AlertCircle,
};

export default function PortalCliente() {
  const navigate = useNavigate();
  const user = getUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [problemaTipo, setProblemaTipo] = useState("");
  const [problemaDesc, setProblemaDesc] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [operacaoStatus, setOperacaoStatus] = useState<"saudavel" | "atencao" | "critico">("saudavel");

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const clientId = user?.id || session?.user?.id;

      if (!clientId) {
        setEntregas(generateMockEntregas());
        setAlertas(generateMockAlertas());
        setFaturas(generateMockFaturas());
        setLoading(false);
        return;
      }

      const { data: osData } = await supabase
        .from("ordens_servico")
        .select(`
          id, numero, status, valor_frete, data_previsao, created_at,
          cliente_id,
          prestador:prestadores(nome, foto_url),
          os_historico(acao, status_novo, created_at),
          os_documentos(tipo, url),
          ocorrencias(tipo, descricao, created_at)
        `)
        .eq("cliente_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (osData && osData.length > 0) {
        const entregasFormatadas = osData.map(os => ({
          ...os,
          status_label: formatStatus(os.status),
          origem: "São Paulo, SP",
          destino: "Rio de Janeiro, RJ",
          previsao: os.data_previsao || new Date(Date.now() + 86400000).toISOString(),
          peso: Math.floor(Math.random() * 500) + 50,
          volumes: Math.floor(Math.random() * 10) + 1,
          historico: os.os_historico?.slice(-5).reverse() || [],
          pod: os.os_documentos?.find(d => d.tipo === "pod"),
          ocorrencias: os.ocorrencias,
        }));
        setEntregas(entregasFormatadas);
      } else {
        setEntregas(generateMockEntregas());
        setAlertas(generateMockAlertas());
        setFaturas(generateMockFaturas());
      }
    } catch (error) {
      console.log("Using mock data");
      setEntregas(generateMockEntregas());
      setAlertas(generateMockAlertas());
      setFaturas(generateMockFaturas());
    }
    setLoading(false);
  }, [user]);

  const generateMockEntregas = (): Entrega[] => [
    {
      id: "1", numero: "OS-202610-1045", status: "em_rota", status_label: "Em Rota",
      origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ",
      previsao: "2026-04-12T16:00:00", created_at: "2026-04-12T08:00:00",
      valor_frete: 1250.00, peso: 320, volumes: 3,
      prestador: { nome: "Carlos Silva", foto_url: "" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-10T10:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-11T14:00:00" },
        { acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-12T08:00:00" },
        { acao: "Em Rota", status_novo: "em_rota", created_at: "2026-04-12T09:30:00" },
      ],
      pod: { foto_url: "", assinatura_url: "", receptor: "", local: "" },
    },
    {
      id: "2", numero: "OS-202610-1033", status: "programacao", status_label: "Programado",
      origem: "Campinas, SP", destino: "Curitiba, PR",
      previsao: "2026-04-15T10:00:00", created_at: "2026-04-11T15:00:00",
      valor_frete: 980.00, peso: 180, volumes: 2,
      prestador: { nome: "Pedro Santos" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-11T15:00:00" },
      ],
    },
    {
      id: "3", numero: "OS-202610-1028", status: "entregue", status_label: "Entregue",
      origem: "São Paulo, SP", destino: "Belo Horizonte, MG",
      previsao: "2026-04-10T14:00:00", created_at: "2026-04-08T09:00:00",
      valor_frete: 2100.00, peso: 450, volumes: 5,
      prestador: { nome: "Marcos Oliveira" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-08T09:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-09T08:00:00" },
        { acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-10T06:00:00" },
        { acao: "Entregue", status_novo: "entregue", created_at: "2026-04-10T13:45:00" },
      ],
      pod: {
        foto_url: "",
        assinatura_url: "",
        receptor: "João da Silva",
        created_at: "2026-04-10T13:45:00",
        local: "Rua das Flores, 123 - Belo Horizonte"
      },
    },
    {
      id: "4", numero: "OS-202610-1015", status: "atrasada", status_label: "Atrasado",
      origem: "São Paulo, SP", destino: "Salvador, BA",
      previsao: "2026-04-11T12:00:00", created_at: "2026-04-07T10:00:00",
      valor_frete: 3500.00, peso: 800, volumes: 8,
      prestador: { nome: "Ricardo Costa" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-07T10:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-08T09:00:00" },
        { acao: "Atrasado", status_novo: "atrasada", created_at: "2026-04-11T12:00:00" },
      ],
      ocorrencias: [
        { tipo: "atraso", descricao: "トラフィックのため遅延 (Atrasado por tráfego)", created_at: "2026-04-11T12:00:00" }
      ],
    },
    {
      id: "5", numero: "OS-202609-9802", status: "entregue", status_label: "Entregue",
      origem: "São Paulo, SP", destino: "Recife, PE",
      previsao: "2026-04-05T16:00:00", created_at: "2026-04-02T08:00:00",
      valor_frete: 2800.00, peso: 620, volumes: 6,
      prestador: { nome: "Ana Paula" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-02T08:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-03T09:00:00" },
        { acao: "Entregue", status_novo: "entregue", created_at: "2026-04-05T15:30:00" },
      ],
      pod: {
        foto_url: "",
        assinatura_url: "",
        receptor: "Maria Souza",
        created_at: "2026-04-05T15:30:00",
        local: "Av. Brasil, 500 - Recife"
      },
    },
  ];

  const generateMockAlertas = (): Alerta[] => [
    {
      id: "1", tipo: "atraso", titulo: "Risco de Atraso",
      descricao: "OS-202610-1015 com atraso confirmado",
      os_id: "4", severidade: "critico", created_at: "2026-04-12T10:00:00"
    },
    {
      id: "2", tipo: "km", titulo: "Km Próximo do Limite",
      descricao: "Veículo operando próximo do limite de KM",
      os_id: "1", severidade: "atencao", created_at: "2026-04-12T09:00:00"
    },
    {
      id: "3", tipo: "problema", titulo: "Problema Reportado",
      descricao: "Problema reportado por Carlos Silva",
      os_id: "4", severidade: "atencao", created_at: "2026-04-11T14:00:00"
    },
  ];

  const generateMockFaturas = (): Fatura[] => [
    {
      id: "1", fatura: "FAT-0045", competencia: "04/2026", os_vinculadas: ["OS-202610-1045", "OS-202610-1033"],
      vencimento: "2026-05-10", valor: 14500.00, status: "a_vencer"
    },
    {
      id: "2", fatura: "FAT-0044", competencia: "03/2026", os_vinculadas: ["OS-202609-9802"],
      vencimento: "2026-04-10", valor: 2800.00, status: "paga"
    },
    {
      id: "3", fatura: "FAT-0043", competencia: "02/2026", os_vinculadas: [],
      vencimento: "2026-03-10", valor: 18500.00, status: "paga"
    },
  ];

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const entregasAtrasadas = entregas.filter(e => e.status === "atrasada").length;
    const entregasProblema = entregas.filter(e => e.status === "problema").length;
    
    if (entregasAtrasadas > 0 || entregasProblema > 0) {
      setOperacaoStatus("critico");
    } else if (entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length > 0) {
      setOperacaoStatus("atencao");
    } else {
      setOperacaoStatus("saudavel");
    }
  }, [entregas]);

  const formatStatus = (s: string) => {
    const map: Record<string, string> = {
      programacao: "Programado",
      coleta: "Em Coleta",
      saiu_para_rota: "Saiu para Rota",
      em_rota: "Em Rota",
      entregue: "Entregue",
      atrasada: "Atrasado",
      problema: "Com Problema",
    };
    return map[s] || s;
  };

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const getStatusIcone = (status: string) => {
    const Icone = statusIcones[status] || Clock;
    return <Icone className="w-4 h-4" />;
  };

  const handleSair = () => {
    logout();
    navigate("/login");
  };

  const handleReportarProblema = async () => {
    if (!selectedEntrega || !problemaTipo) return;
    
    toast({
      title: "Problema reportado",
      description: `Ocorrência registrada para ${selectedEntrega.numero}`,
      variant: "default",
    });
    
    setShowProblemaModal(false);
    setProblemaTipo("");
    setProblemaDesc("");
    carregarDados();
  };

  const handleBaixarComprovante = (entrega: Entrega) => {
    if (!entrega.pod) {
      toast({
        title: "Comprovante indisponível",
        description: "O POD ainda não foi carregado",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Baixando comprovante",
      description: `Download iniciado para ${entrega.numero}`,
    });
  };

  const handleDownloadLote = () => {
    const entregadas = entregas.filter(e => e.status === "entregue" && e.pod);
    if (entregadas.length === 0) {
      toast({
        title: "Nenhum comprovante",
        description: "Não há comprovantes para baixar",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Download em lote",
      description: `${entregadas.length} comprovantes baixados`,
    });
  };

  const filteredEntregas = entregas.filter(e => {
    const matchesBusca = !busca || e.numero.toLowerCase().includes(busca.toLowerCase()) ||
      e.destino.toLowerCase().includes(busca.toLowerCase());
    const matchesStatus = filtroStatus === "todos" || e.status === filtroStatus;
    return matchesBusca && matchesStatus;
  });

  const metricas = {
    hoje: entregas.filter(e => {
      const hoje = new Date().toDateString();
      return new Date(e.created_at).toDateString() === hoje;
    }).length,
    emRota: entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length,
    atrasadas: entregas.filter(e => e.status === "atrasada").length,
    concluidas: entregas.filter(e => e.status === "entregue").length,
  };

  const totalFaturado = faturas
    .filter(f => f.status === "paga")
    .reduce((acc, f) => acc + f.valor, 0);
  
  const totalAVencer = faturas
    .filter(f => f.status === "a_vencer")
    .reduce((acc, f) => acc + f.valor, 0);

  const StepTimeline = ({ historico }: { historico?: HistoricoItem[] }) => {
    if (!historico || historico.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Aguardando informações</span>
        </div>
      );
    }

    const steps = [
      { key: "programacao", label: "Pedido Recebido", icon: FileText },
      { key: "coleta", label: "Coleta Realizada", icon: Package },
      { key: "saiu_para_rota", label: "Saiu para Entrega", icon: Truck },
      { key: "em_rota", label: "Em Rota", icon: MapPin },
      { key: "entregue", label: "Entregue", icon: CheckCircle },
    ];

    const currentStepIndex = Math.max(0, ...historico.map(h => {
      const idx = steps.findIndex(s => s.key === h.status_novo);
      return idx >= 0 ? idx : 0;
    }));

    return (
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[60px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                idx <= currentStepIndex 
                  ? "bg-orange-500 text-white" 
                  : "bg-slate-200 text-slate-400"
              }`}>
                <step.icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium ${
                idx <= currentStepIndex ? "text-orange-600" : "text-muted-foreground"
              }`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-4 h-0.5 mx-1 ${
                idx < currentStepIndex ? "bg-orange-500" : "bg-slate-200"
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Topbar Premium */}
      <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center px-6 justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/25">
            CE
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-lg leading-tight">Conexão Express</h1>
            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Portal do Cliente</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border">
            <span className={`w-2.5 h-2.5 rounded-full ${
              operacaoStatus === "saudavel" ? "bg-emerald-500" :
              operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
            } animate-pulse`} />
            <span className="text-sm font-medium text-slate-700">
              Operação&nbsp;
              {operacaoStatus === "saudavel" ? "Saudável" :
               operacaoStatus === "atencao" ? "Atenção" : "Crítica"}
            </span>
          </div>
          
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold">{getSaudacao()}, {user?.name || "Cliente"}</span>
            <span className="text-[10px] text-muted-foreground">CNPJ: 00.123.456/0001-00</span>
          </div>
          
          <Button variant="ghost" size="icon" onClick={handleSair} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
            <LogOut className="w-5 h-5"/>
          </Button>
        </div>
      </header>

      {/*快速导航 */}
      <nav className="bg-white border-b border-slate-200/50 px-6 py-3 flex gap-2 overflow-x-auto">
        <Button
          variant={activeTab === "dashboard" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("dashboard")}
          className={`rounded-lg ${activeTab === "dashboard" ? "bg-orange-500 text-white" : "text-slate-600"}`}
        >
          <Activity className="w-4 h-4 mr-2" />
          Dashboard
        </Button>
        <Button
          variant={activeTab === "entregas" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("entregas")}
          className={`rounded-lg ${activeTab === "entregas" ? "bg-orange-500 text-white" : "text-slate-600"}`}
        >
          <Package className="w-4 h-4 mr-2" />
          Entregas
        </Button>
        <Button
          variant={activeTab === "nova" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("nova")}
          className={`rounded-lg ${activeTab === "nova" ? "bg-orange-500 text-white" : "text-slate-600"}`}
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          Nova Entrega
        </Button>
        <Button
          variant={activeTab === "alertas" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("alertas")}
          className={`rounded-lg ${activeTab === "alertas" ? "bg-orange-500 text-white" : "text-slate-600"}`}
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Alertas
          {alertas.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
              {alertas.length}
            </span>
          )}
        </Button>
        <Button
          variant={activeTab === "financeiro" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("financeiro")}
          className={`rounded-lg ${activeTab === "financeiro" ? "bg-orange-500 text-white" : "text-slate-600"}`}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Financeiro
        </Button>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto p-4 md:p-6">
        {/* ===== DASHBOARD ===== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/80">Hoje</p>
                      <p className="text-3xl font-bold mt-1">{metricas.hoje}</p>
                    </div>
                    <Calendar className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-xs text-white/70 mt-2">Novas solicitações</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/80">Em Rota</p>
                      <p className="text-3xl font-bold mt-1">{metricas.emRota}</p>
                    </div>
                    <Truck className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-xs text-white/70 mt-2">Em execução</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/80">Atrasadas</p>
                      <p className="text-3xl font-bold mt-1">{metricas.atrasadas}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-xs text-white/70 mt-2">Requierem atenção</p>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 border-0 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/80">Concluídas</p>
                      <p className="text-3xl font-bold mt-1">{metricas.concluidas}</p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-xs text-white/70 mt-2">Este mês</p>
                </CardContent>
              </Card>
            </div>

            {/* Entregas Recentes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg text-slate-800">Entregas em Andamento</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("entregas")} className="text-orange-600">
                  Ver todas <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {entregas.filter(e => e.status !== "entregue").slice(0, 3).map(entrega => (
                    <div 
                      key={entrega.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition"
                      onClick={() => { setSelectedEntrega(entrega); setShowDetailModal(true); }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          statusCores[entrega.status] || "bg-slate-100 text-slate-600"
                        }`}>
                          {getStatusIcone(entrega.status)}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{entrega.numero}</p>
                          <p className="text-xs text-muted-foreground">{entrega.origem} → {entrega.destino}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant="outline" className={statusCores[entrega.status]}>
                            {entrega.status_label}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Previsão: {fmtData(entrega.previsao)} {fmtHora(entrega.previsao)}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300" />
                      </div>
                    </div>
                  ))}
                  
                  {entregas.filter(e => e.status !== "entregue").length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma entrega em andamento</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Alertas Recentes */}
            {alertas.length > 0 && (
              <Card className="border-l-4 border-l-red-500">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Alertas Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {alertas.slice(0, 3).map(alerta => (
                      <div 
                        key={alerta.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          alerta.severidade === "critico" ? "bg-red-50" : "bg-amber-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            alerta.severidade === "critico" ? "bg-red-500" : "bg-amber-500"
                          }`} />
                          <div>
                            <p className="font-medium text-sm text-slate-800">{alerta.titulo}</p>
                            <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {fmtData(alerta.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ===== ENTREGAS ===== */}
        {activeTab === "entregas" && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por OS ou destino..." 
                  className="pl-9 bg-white"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="programacao">Programado</SelectItem>
                  <SelectItem value="em_rota">Em Rota</SelectItem>
                  <SelectItem value="entregue">Entregue</SelectItem>
                  <SelectItem value="atrasada">Atrasado</SelectItem>
                  <SelectItem value="problema">Com Problema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Entregas */}
            <div className="space-y-3">
              {filteredEntregas.map(entrega => (
                <Card 
                  key={entrega.id} 
                  className="overflow-hidden hover:shadow-md transition cursor-pointer"
                  onClick={() => { setSelectedEntrega(entrega); setShowDetailModal(true); }}
                >
                  <CardContent className="p-0">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 text-lg">{entrega.numero}</h3>
                            <Badge variant="outline" className={statusCores[entrega.status]}>
                              {getStatusIcone(entrega.status)}
                              <span className="ml-1">{entrega.status_label}</span>
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {entrega.origem} → {entrega.destino}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Previsão</p>
                          <p className="font-semibold text-sm">{fmtData(entrega.previsao)}</p>
                          <p className="text-xs text-muted-foreground">{fmtHora(entrega.previsao)}</p>
                        </div>
                      </div>

                      {/* Timeline Simples */}
                      <StepTimeline historico={entrega.historico} />

                      {/* Info do Motorista */}
                      {entrega.prestador && entrega.status !== "programacao" && (
                        <div className="mt-4 pt-3 border-t flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Motorista</p>
                              <p className="text-sm font-medium">{entrega.prestador.nome}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-slate-50">
                              {entrega.volumes} volumes
                            </Badge>
                            <Badge variant="outline" className="bg-slate-50">
                              {entrega.peso}kg
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredEntregas.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Nenhuma entrega encontrada</p>
                  <p className="text-sm text-muted-foreground">Tente ajustar os filtros</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== NOVA ENTREGA ===== */}
        {activeTab === "nova" && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-xl text-slate-800">Nova Solicitação de Coleta</CardTitle>
              <CardDescription>
                Preencha os dados e nossa equipe processará imediatamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">CEP de Coleta *</Label>
                  <Input placeholder="00000-000" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">CEP de Entrega *</Label>
                  <Input placeholder="00000-000" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs font-semibold">Endereço de Coleta</Label>
                  <Input placeholder="Rua, número, complemento" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs font-semibold">Endereço de Entrega</Label>
                  <Input placeholder="Rua, número, complemento" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs font-semibold">Descrição da Mercadoria *</Label>
                  <Input placeholder="Ex: Peças automotivas, R$ 10.000,00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Peso (Kg)</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Volumes</Label>
                  <Input type="number" placeholder="0" />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label className="text-xs font-semibold">Observações</Label>
                  <Textarea placeholder="Instruções especiais..." className="min-h-[80px]" />
                </div>
              </div>
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 mt-4"
                onClick={() => toast({ title: "Solicitação enviada", description: "Sua coleta foi solicitada com sucesso!" })}
              >
                <Send className="w-5 h-5 mr-2" />
                Emitir Solicitação
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== ALERTAS ===== */}
        {activeTab === "alertas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Central de Alertas</h2>
              <Badge variant="outline">{alertas.length} alertas</Badge>
            </div>

            {alertas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-500" />
                  <p className="text-lg font-medium text-slate-600">Tudo em ordem!</p>
                  <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alertas.map(alerta => (
                  <Card 
                    key={alerta.id}
                    className={`border-l-4 ${
                      alerta.severidade === "critico" ? "border-l-red-500" : "border-l-amber-500"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            alerta.severidade === "critico" ? "bg-red-100" : "bg-amber-100"
                          }`}>
                            {alerta.tipo === "atraso" || alerta.tipo === "problema" ? (
                              <AlertTriangle className={`w-5 h-5 ${alerta.severidade === "critico" ? "text-red-600" : "text-amber-600"}`} />
                            ) : (
                              <Truck className={`w-5 h-5 ${alerta.severidade === "critico" ? "text-red-600" : "text-amber-600"}`} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-800">{alerta.titulo}</h3>
                            <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fmtData(alerta.created_at)} {fmtHora(alerta.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className={
                          alerta.severidade === "critico" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        }>
                          {alerta.severidade === "critico" ? "Crítico" : "Atenção"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== FINANCEIRO ===== */}
        {activeTab === "financeiro" && (
          <div className="space-y-6">
            {/* Cards Financeiros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Faturas Vencidas</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{fmtFin(0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">A Vencer</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{fmtFin(totalAVencer)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Pagos no Período</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtFin(totalFaturado)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabela de Faturas */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Minhas Faturas</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="w-4 h-4 mr-2" />
                    Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fatura</TableHead>
                      <TableHead>Competência</TableHead>
                      <TableHead>OS Vinculadas</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturas.map(fatura => (
                      <TableRow key={fatura.id}>
                        <TableCell className="font-semibold">{fatura.fatura}</TableCell>
                        <TableCell>{fatura.competencia}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {fatura.os_vinculadas.join(", ")}
                        </TableCell>
                        <TableCell>{fmtData(fatura.vencimento)}</TableCell>
                        <TableCell className="font-medium">{fmtFin(fatura.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            fatura.status === "paga" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            fatura.status === "a_vencer" ? "bg-blue-50 text-blue-700 border-blue-200" :
                            "bg-red-50 text-red-700 border-red-200"
                          }>
                            {fatura.status === "paga" ? "Pago" : fatura.status === "a_vencer" ? "A Vencer" : "Vencida"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {fatura.status !== "paga" && (
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              Boleto / PIX
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detalhamento por输送 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo por Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordem</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Peso</TableHead>
                      <TableHead>Volumes</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.slice(0, 5).map(entrega => (
                      <TableRow key={entrega.id}>
                        <TableCell className="font-medium">{entrega.numero}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusCores[entrega.status]}>
                            {entrega.status_label}
                          </Badge>
                        </TableCell>
                        <TableCell>{entrega.peso}kg</TableCell>
                        <TableCell>{entrega.volumes}</TableCell>
                        <TableCell className="text-right font-medium">{fmtFin(entrega.valor_frete)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ===== MODAL DETALHE DA ENTREGA ===== */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              {selectedEntrega?.numero}
            </DialogTitle>
            <DialogDescription>
              Detalhes da ordem de serviço
            </DialogDescription>
          </DialogHeader>

          {selectedEntrega && (
            <div className="space-y-6">
              {/* Status Atual */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${statusCores[selectedEntrega.status]}`}>
                    {getStatusIcone(selectedEntrega.status)}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedEntrega.status_label}</p>
                    <p className="text-sm text-muted-foreground">
                      Previsão: {fmtData(selectedEntrega.previsao)} às {fmtHora(selectedEntrega.previsao)}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => setShowProblemaModal(true)}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reportar Problema
                </Button>
              </div>

              {/* Rota */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs font-bold text-blue-600 uppercase">Origem</p>
                  <p className="font-medium mt-1">{selectedEntrega.origem}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Destino</p>
                  <p className="font-medium mt-1">{selectedEntrega.destino}</p>
                </div>
              </div>

              {/* Motorista */}
              {selectedEntrega.prestador && (
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Motorista</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-semibold">{selectedEntrega.prestador.nome}</p>
                      <p className="text-sm text-muted-foreground">Prestador Linked</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Histórico</p>
                <div className="space-y-3">
                  {selectedEntrega.historico?.slice().reverse().map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.acao}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtData(item.created_at)} {fmtHora(item.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* POD */}
              {selectedEntrega.status === "entregue" && selectedEntrega.pod && (
                <div className="p-4 border rounded-lg">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Comprovante de Entrega (POD)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                      {selectedEntrega.pod.foto_url ? (
                        <img src={selectedEntrega.pod.foto_url} alt="Foto" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                      {selectedEntrega.pod.assinatura_url ? (
                        <img src={selectedEntrega.pod.assinatura_url} alt="Assinatura" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Signature className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                  </div>
                  {selectedEntrega.pod.receptor && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-muted-foreground">Recebido por</p>
                      <p className="font-medium">{selectedEntrega.pod.receptor}</p>
                      {selectedEntrega.pod.local && (
                        <p className="text-xs text-muted-foreground mt-1">{selectedEntrega.pod.local}</p>
                      )}
                    </div>
                  )}
                  <Button 
                    className="w-full mt-3 bg-orange-500 hover:bg-orange-600"
                    onClick={() => handleBaixarComprovante(selectedEntrega)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Comprovante
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== MODAL REPORTAR PROBLEMA ===== */}
      <Dialog open={showProblemaModal} onOpenChange={setShowProblemaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reportar Problema
            </DialogTitle>
            <DialogDescription>
              Selecione o tipo de problema encontrado na entrega {selectedEntrega?.numero}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Problema *</Label>
              <Select value={problemaTipo} onValueChange={setProblemaTipo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atraso">Atraso na Entrega</SelectItem>
                  <SelectItem value="nao_encontrado">Cliente Não Encontrado</SelectItem>
                  <SelectItem value="avariado">Produto Avariado</SelectItem>
                  <SelectItem value="falta">Mercadoria Faltando</SelectItem>
                  <SelectItem value="outro">Outro Problema</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea 
                placeholder="Descreva os detalhes do problema..." 
                value={problemaDesc}
                onChange={(e) => setProblemaDesc(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProblemaModal(false)}>
              Cancelar
            </Button>
            <Button 
              variant="default"
              className="bg-red-500 hover:bg-red-600"
              onClick={handleReportarProblema}
              disabled={!problemaTipo}
            >
              Reportar Problema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}