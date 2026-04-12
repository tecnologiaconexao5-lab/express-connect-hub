import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Package, PlusCircle, FileText, DollarSign, LogOut, Search, Download, MapPin, Clock, CheckCircle, AlertTriangle, 
  Truck, User, Phone, Mail, ChevronRight, X, Camera, Signature, MapPinned, Activity, Calendar, BarChart3, 
  Send, RefreshCw, Filter, Map, Route, Users, FileUp, Clock3, AlertCircle, TrendingUp, Wallet, CreditCard,
  Building2, Home, Briefcase, Box, Ruler, Scale, TruckIcon, ArrowRight, Package2, Navigation, CheckCheck,
  MoreHorizontal, Eye, PhoneCall, MessageSquare, Play, Pause, Grid3X3, List, Calculator
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
  origem: Endereco;
  destino: Endereco;
  previsao: string;
  created_at: string;
  valor_frete: number;
  peso: number;
  volumes: number;
  dimensoes?: { altura: number; largura: number; comprimento: number };
  mercadoria: string;
  notas?: string[];
  cliente_id?: string;
  destinatario?: { nome: string; documento: string; telefone: string };
  prestador?: { nome: string; foto_url?: string; telefone?: string };
  historico?: HistoricoItem[];
  pod?: PodItem;
  ocorrencias?: OcorrenciaItem[];
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
  valor_adicional?: number;
  status: "vencida" | "a_vencer" | "paga";
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

interface VeiculoSugestao {
  tipo: string;
  capacidade_kg: number;
  volume_m3: number;
  recomendado: boolean;
}

const statusCores: Record<string, string> = {
  "programacao": "bg-slate-100 text-slate-700 border-slate-200",
  "coleta": "bg-blue-100 text-blue-700 border-blue-200",
  "saiu_para_rota": "bg-purple-100 text-purple-700 border-purple-200",
  "em_rota": "bg-orange-100 text-orange-700 border-orange-200",
  "entregue": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "atrasada": "bg-red-100 text-red-700 border-red-200",
  "problema": "bg-red-100 text-red-700 border-red-200",
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

const veiculosSugestoes: VeiculoSugestao[] = [
  { tipo: "Moto", capacidade_kg: 30, volume_m3: 0.05, recomendado: false },
  { tipo: "Fiorino", capacidade_kg: 300, volume_m3: 1.5, recomendado: false },
  { tipo: "Van", capacidade_kg: 800, volume_m3: 4.0, recomendado: false },
  { tipo: "Caminhão 3/4", capacidade_kg: 3000, volume_m3: 12.0, recomendado: false },
  { tipo: "Caminhão truck", capacidade_kg: 10000, volume_m3: 30.0, recomendado: false },
];

export default function PortalCliente() {
  const navigate = useNavigate();
  const user = getUser();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [enderecosFavoritos, setEnderecosFavoritos] = useState<EnderecoFavorito[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [selectedEntregas, setSelectedEntregas] = useState<Set<string>>(new Set());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProblemaModal, setShowProblemaModal] = useState(false);
  const [showNovoEnderecoModal, setShowNovoEnderecoModal] = useState(false);
  const [problemaTipo, setProblemaTipo] = useState("");
  const [problemaDesc, setProblemaDesc] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [operacaoStatus, setOperacaoStatus] = useState<"saudavel" | "atencao" | "critico">("saudavel");
  
  const [novaEntrega, setNovaEntrega] = useState({
    origem: { cep: "", rua: "", numero: "", bairro: "", cidade: "", uf: "", complemento: "" },
    destino: { cep: "", rua: "", numero: "", bairro: "", cidade: "", uf: "", complemento: "" },
    destinatario: { nome: "", documento: "", telefone: "" },
    mercadoria: "",
    peso: 0,
    volume: 0,
    altura: 0,
    largura: 0,
    comprimento: 0,
    instrucoes: "",
    janela_entrega: "",
    valorEstimado: 0,
  });

  const calcularValor = useCallback((peso: number, volume: number) => {
    const base = 50;
    const porKg = peso > 10 ? (peso - 10) * 2.5 : 0;
    const porVolume = volume * 15;
    return base + porKg + porVolume;
  }, []);

  useEffect(() => {
    const valor = calcularValor(novaEntrega.peso, novaEntrega.volume);
    setNovaEntrega(prev => ({ ...prev, valorEstimado: valor }));
  }, [novaEntrega.peso, novaEntrega.volume, calcularValor]);

  const getSaudacao = () => {
    const hora = new Date().getHours();
    if (hora < 12) return "Bom dia";
    if (hora < 18) return "Boa tarde";
    return "Boa noite";
  };

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      setEntregas(generateMockEntregas());
      setAlertas(generateMockAlertas());
      setFaturas(generateMockFaturas());
      setEnderecosFavoritos(generateMockEnderecos());
    } catch (error) {
      console.log("Using mock data");
    }
    setLoading(false);
  }, []);

  const generateMockEntregas = (): Entrega[] => [
    {
      id: "1", numero: "OS-202610-1045", status: "em_rota", status_label: "Em Rota",
      origem: { cep: "01234-567", rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" },
      destino: { cep: "20000-000", rua: "Av. Brasil", numero: "500", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
      previsao: "2026-04-12T16:00:00", created_at: "2026-04-12T08:00:00",
      valor_frete: 1250.00, peso: 320, volumes: 3, mercadoria: "Peças automotivas",
      destinatario: { nome: "João Silva Santos", documento: "123.456.789-00", telefone: "(11) 99999-9999" },
      prestador: { nome: "Carlos Silva", foto_url: "", telefone: "(11) 98888-7777" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-10T10:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-11T14:00:00" },
        { acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-12T08:00:00" },
        { acao: "Em Rota", status_novo: "em_rota", created_at: "2026-04-12T09:30:00" },
      ],
    },
    {
      id: "2", numero: "OS-202610-1033", status: "programacao", status_label: "Programado",
      origem: { cep: "13000-000", rua: "Rua Central", numero: "200", bairro: "Centro", cidade: "Campinas", uf: "SP" },
      destino: { cep: "80000-000", rua: "Av. Vicente", numero: "100", bairro: "Batel", cidade: "Curitiba", uf: "PR" },
      previsao: "2026-04-15T10:00:00", created_at: "2026-04-11T15:00:00",
      valor_frete: 980.00, peso: 180, volumes: 2, mercadoria: "Eletrônicos",
      destinatario: { nome: "Maria Oliveira", documento: "987.654.321-00", telefone: "(41) 99999-8888" },
      prestador: { nome: "Pedro Santos" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-11T15:00:00" },
      ],
    },
    {
      id: "3", numero: "OS-202610-1028", status: "entregue", status_label: "Entregue",
      origem: { cep: "01234-567", rua: "Av. Paulista", numero: "500", bairro: "Jardim Paulista", cidade: "São Paulo", uf: "SP" },
      destino: { cep: "30000-000", rua: "Av. Afonso Pena", numero: "1500", bairro: "Centro", cidade: "Belo Horizonte", uf: "MG" },
      previsao: "2026-04-10T14:00:00", created_at: "2026-04-08T09:00:00",
      valor_frete: 2100.00, peso: 450, volumes: 5, mercadoria: "Móveis corporativos",
      destinatario: { nome: "Empresa XYZ Ltda", documento: "12.345.678/0001-90", telefone: "(31) 3333-4444" },
      prestador: { nome: "Marcos Oliveira" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-08T09:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-09T08:00:00" },
        { acao: "Saiu para Entrega", status_novo: "saiu_para_rota", created_at: "2026-04-10T06:00:00" },
        { acao: "Entregue", status_novo: "entregue", created_at: "2026-04-10T13:45:00" },
      ],
      pod: {
        foto_url: "", assinatura_url: "", receptor: "Carlos Manager",
        grau_parentesco: "Funcionário", created_at: "2026-04-10T13:45:00",
        local: "Av. Afonso Pena, 1500 - Centro, Belo Horizonte - MG"
      },
    },
    {
      id: "4", numero: "OS-202610-1015", status: "atrasada", status_label: "Atrasado",
      origem: { cep: "01234-567", rua: "Av. Paulista", numero: "2000", bairro: "Jardim Paulista", cidade: "São Paulo", uf: "SP" },
      destino: { cep: "40000-000", rua: "Av. Juracy", numero: "80", bairro: "Pituba", cidade: "Salvador", uf: "BA" },
      previsao: "2026-04-11T12:00:00", created_at: "2026-04-07T10:00:00",
      valor_frete: 3500.00, peso: 800, volumes: 8, mercadoria: "Equipamentos industriais",
      destinatario: { nome: "Indústria ABC S/A", documento: "98.765.432/0001-00", telefone: "(71) 9999-0000" },
      prestador: { nome: "Ricardo Costa" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-07T10:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-08T09:00:00" },
        { acao: "Atrasado", status_novo: "atrasada", created_at: "2026-04-11T12:00:00" },
      ],
      ocorrencias: [
        { tipo: "atraso", descricao: "Atrasado por tráfego intenso", created_at: "2026-04-11T12:00:00" }
      ],
    },
    {
      id: "5", numero: "OS-202609-9802", status: "entregue", status_label: "Entregue",
      origem: { cep: "01234-567", rua: "Av. Brasil", numero: "3000", bairro: "Jardim Europa", cidade: "São Paulo", uf: "SP" },
      destino: { cep: "50000-000", rua: "Av. Recife", numero: "200", bairro: "Boa Viagem", cidade: "Recife", uf: "PE" },
      previsao: "2026-04-05T16:00:00", created_at: "2026-04-02T08:00:00",
      valor_frete: 2800.00, peso: 620, volumes: 6, mercadoria: "Vestuário",
      destinatario: { nome: "Loja Modelos Ltda", documento: "11.222.333/0001-44", telefone: "(81) 4444-5555" },
      prestador: { nome: "Ana Paula" },
      historico: [
        { acao: "Pedido Recebido", status_novo: "programacao", created_at: "2026-04-02T08:00:00" },
        { acao: "Coleta Realizada", status_novo: "coleta", created_at: "2026-04-03T09:00:00" },
        { acao: "Entregue", status_novo: "entregue", created_at: "2026-04-05T15:30:00" },
      ],
      pod: {
        foto_url: "", assinatura_url: "", receptor: "Pedro Souza",
        grau_parentesco: "Porteiro", created_at: "2026-04-05T15:30:00",
        local: "Av. Recife, 200 - Boa Viagem, Recife - PE"
      },
    },
  ];

  const generateMockAlertas = (): Alerta[] => [
    { id: "1", tipo: "atraso", titulo: "Risco de Atraso", descricao: "OS-202610-1015 com atraso确认ado", os_id: "4", severidade: "critico", created_at: "2026-04-12T10:00:00" },
    { id: "2", tipo: "km", titulo: "KM Próximo do Limite", descricao: "Veículo operando próximo do limite", os_id: "1", severidade: "atencao", created_at: "2026-04-12T09:00:00" },
    { id: "3", tipo: "problema", titulo: "Problema Reportado", descricao: "Problema reportado pelo motorista", os_id: "4", severidade: "atencao", created_at: "2026-04-11T14:00:00" },
  ];

  const generateMockFaturas = (): Fatura[] => [
    { id: "1", fatura: "FAT-0045", competencia: "04/2026", os_vinculadas: ["OS-202610-1045", "OS-202610-1033"], vencimento: "2026-05-10", valor: 14500.00, status: "a_vencer" },
    { id: "2", fatura: "FAT-0044", competencia: "03/2026", os_vinculadas: ["OS-202609-9802"], vencimento: "2026-04-10", valor: 2800.00, valor_adicional: 150.00, status: "paga" },
    { id: "3", fatura: "FAT-0043", competencia: "02/2026", os_vinculadas: [], vencimento: "2026-03-10", valor: 18500.00, status: "paga" },
  ];

  const generateMockEnderecos = (): EnderecoFavorito[] => [
    { id: "1", nome: "Matriz São Paulo", cep: "01234-567", rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", uf: "SP" },
    { id: "2", nome: "Filial Rio", cep: "20000-000", rua: "Av. Brasil", numero: "500", bairro: "Centro", cidade: "Rio de Janeiro", uf: "RJ" },
    { id: "3", nome: "CD Campinas", cep: "13000-000", rua: "Rua Central", numero: "200", bairro: "Centro", cidade: "Campinas", uf: "SP" },
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

  const getStatusIcone = (status: string) => {
    const Icone = statusIcones[status] || Clock;
    return <Icone className="w-5 h-5" />;
  };

  const handleSair = () => {
    logout();
    navigate("/login");
  };

  const handleEnviarAcompanhamento = (entrega: Entrega, mensagem: string) => {
    toast({
      title: "Mensagem.enviada",
      description: `Notificação enviada para ${entrega.destinatario?.nome || "cliente"}`,
    });
  };

  const handleReportarProblema = () => {
    if (!selectedEntrega || !problemaTipo) return;
    
    toast({
      title: "Problema reportado",
      description: `Ocorrência registrada para ${selectedEntrega.numero}`,
    });
    
    setShowProblemaModal(false);
    setProblemaTipo("");
    setProblemaDesc("");
  };

  const handleBaixarComprovante = (entrega: Entrega) => {
    if (!entrega.pod) {
      toast({ title: "Comprovante indisponível", description: "O POD ainda não foi carregado", variant: "destructive" });
      return;
    }
    
    toast({ title: "Baixando comprovante", description: `Download iniciado para ${entrega.numero}` });
  };

  const handleBaixarLote = () => {
    if (selectedEntregas.size === 0) {
      toast({ title: "Nenhuma entrega selecionada", variant: "destructive" });
      return;
    }
    toast({ title: "Download em lote", description: `${selectedEntregas.size} comprovantes baixados` });
  };

  const toggleSelecionarEntrega = (id: string) => {
    const nova = new Set(selectedEntregas);
    if (nova.has(id)) nova.delete(id);
    else nova.add(id);
    setSelectedEntregas(nova);
  };

  const filteredEntregas = useMemo(() => {
    return entregas.filter(e => {
      const matchesBusca = !busca || e.numero.toLowerCase().includes(busca.toLowerCase()) ||
        e.destino.cidade.toLowerCase().includes(busca.toLowerCase());
      const matchesStatus = filtroStatus === "todos" || e.status === filtroStatus;
      return matchesBusca && matchesStatus;
    });
  }, [entregas, busca, filtroStatus]);

  const metricas = useMemo(() => ({
    hoje: entregas.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length,
    emRota: entregas.filter(e => e.status === "em_rota" || e.status === "saiu_para_rota").length,
    atrasadas: entregas.filter(e => e.status === "atrasada").length,
    concluidas: entregas.filter(e => e.status === "entregue").length,
  }), [entregas]);

  const totalFaturado = useMemo(() => faturas.filter(f => f.status === "paga").reduce((acc, f) => acc + f.valor, 0), [faturas]);
  const totalAVencer = useMemo(() => faturas.filter(f => f.status === "a_vencer").reduce((acc, f) => acc + f.valor, 0), [faturas]);

  const dadosGraficoEntregas = useMemo(() => [
    { dia: "Seg", entregas: 12, concluidas: 10 },
    { dia: "Ter", entregas: 15, concluidas: 14 },
    { dia: "Qua", entregas: 8, concluidas: 8 },
    { dia: "Qui", entregas: 18, concluidas: 15 },
    { dia: "Sex", entregas: 22, concluidas: 20 },
    { dia: "Sáb", entregas: 5, concluidas: 5 },
    { dia: "Dom", entregas: 0, concluidas: 0 },
  ], []);

  const dadosGraficoPerformance = useMemo(() => ({
    noPrazo: 85,
    atrasadas: 15,
  }), []);

  const formatStatus = (s: string) => {
    const map: Record<string, string> = {
      programacao: "Programado", coleta: "Em Coleta", saiu_para_rota: "Saiu para Rota",
      em_rota: "Em Rota", entregue: "Entregue", atrasada: "Atrasado", problema: "Com Problema",
    };
    return map[s] || s;
  };

  const StepTimeline = ({ historico }: { historico?: HistoricoItem[] }) => {
    if (!historico || historico.length === 0) {
      return <div className="text-sm text-muted-foreground">Aguardando informações</div>;
    }

    const steps = [
      { key: "programacao", label: "Pedido Recebido", icon: FileText },
      { key: "coleta", label: "Coleta", icon: Package2 },
      { key: "saiu_para_rota", label: "Saiu", icon: Truck },
      { key: "em_rota", label: "Em Rota", icon: Navigation },
      { key: "entregue", label: "Entregue", icon: CheckCircle },
    ];

    const currentStepIndex = Math.max(0, ...historico.map(h => {
      const idx = steps.findIndex(s => s.key === h.status_novo);
      return idx >= 0 ? idx : 0;
    }));

    return (
      <div className="flex items-center gap-1 overflow-x-auto py-2">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center min-w-[70px]">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                idx <= currentStepIndex ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30" : "bg-slate-200 text-slate-400"
              }`}>
                <step.icon className="w-5 h-5" />
              </div>
              <span className={`text-[11px] mt-1.5 font-medium ${idx <= currentStepIndex ? "text-orange-600" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${idx < currentStepIndex ? "bg-orange-500" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const MiniGrafico = ({ data, type }: { data: { dia: string; entregas: number; concluidas: number }[]; type: "bar" | "pie" }) => (
    <div className="h-32 flex items-end gap-2 px-2">
      {data.map((d, idx) => (
        <div key={idx} className="flex-1 flex flex-col items-center gap-1">
          <div 
            className="w-full bg-orange-500/80 rounded-t-md transition-all hover:bg-orange-500"
            style={{ height: `${(d.entregas / 25) * 100}%`, minHeight: "4px" }}
          />
          <span className="text-[10px] text-muted-foreground">{d.dia}</span>
        </div>
      ))}
    </div>
  );

  const GraficoPizza = ({ noPrazo, atrasadas }: { noPrazo: number; atrasadas: number }) => (
    <div className="h-32 flex items-center justify-center gap-4">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#10b981" strokeWidth="3" strokeDasharray={`${noPrazo} ${100 - noPrazo}`} />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3" strokeDasharray={`${atrasadas} ${100 - atrasadas}`} strokeDashoffset={-noPrazo} />
        </svg>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-sm text-muted-foreground">No prazo ({noPrazo}%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-muted-foreground">Atrasadas ({atrasadas}%)</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Topbar Premium */}
      <header className="h-20 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 flex items-center px-6 justify-between shadow-sm sticky top-0 z-50">
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
          <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-slate-50 rounded-xl border border-slate-200/50">
            <span className={`w-3 h-3 rounded-full ${
              operacaoStatus === "saudavel" ? "bg-emerald-500" : operacaoStatus === "atencao" ? "bg-amber-500" : "bg-red-500"
            } animate-pulse`} />
            <span className="text-sm font-medium text-slate-700">
              Operação {operacaoStatus === "saudavel" ? "Saudável" : operacaoStatus === "atencao" ? "Atenção" : "Crítica"}
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

      {/* Navegação Premium */}
      <nav className="bg-white border-b border-slate-200/50 px-6 py-4 flex gap-3 overflow-x-auto">
        {[
          { id: "dashboard", icon: Activity, label: "Dashboard" },
          { id: "entregas", icon: Package, label: "Entregas" },
          { id: "nova", icon: PlusCircle, label: "Nova Entrega" },
          { id: "roteirizacao", icon: Route, label: "Roteirização" },
          { id: "alertas", icon: AlertTriangle, label: "Alertas", badge: alertas.length },
          { id: "financeiro", icon: DollarSign, label: "Financeiro" },
        ].map(tab => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-5 py-2.5 font-medium transition-all ${
              activeTab === tab.id ? "bg-orange-500 text-white shadow-lg shadow-orange-500/25" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
            {tab.badge && tab.badge > 0 && (
              <span className="ml-2 px-2 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            )}
          </Button>
        ))}
      </nav>

      <main className="flex-1 max-w-7xl mx-auto p-6 space-y-6">
        {/* ===== DASHBOARD ===== */}
        {activeTab === "dashboard" && (
          <div className="space-y-8">
            {/* Saudação e Status */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Olá, {user?.name || "Cliente"}!</h2>
                <p className="text-muted-foreground">Este é o resumo da sua operação hoje</p>
              </div>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl ${
                  operacaoStatus === "saudavel" ? "bg-emerald-50 text-emerald-700" : 
                  operacaoStatus === "atencao" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                }`}>
                  {operacaoStatus === "saudavel" ? <CheckCircle className="w-5 h-5" /> :
                   operacaoStatus === "atencao" ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="font-semibold">
                    {operacaoStatus === "saudavel" ? "Saudável" : operacaoStatus === "atencao" ? "Atenção" : "Crítica"}
                  </span>
                </div>
              </div>
            </div>

            {/* Cards de Métricas - Estilo Premium */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { label: "Hoje", value: metricas.hoje, icon: Calendar, color: "from-orange-500 to-orange-600", desc: "Novas solicitações" },
                { label: "Em Rota", value: metricas.emRota, icon: Truck, color: "from-purple-500 to-purple-600", desc: "Em execução" },
                { label: "Atrasadas", value: metricas.atrasadas, icon: AlertTriangle, color: "from-red-500 to-red-600", desc: "Requerem atenção" },
                { label: "Concluídas", value: metricas.concluidas, icon: CheckCircle, color: "from-emerald-500 to-emerald-600", desc: "Este mês" },
              ].map((card, idx) => (
                <Card key={idx} className={`bg-gradient-to-br ${card.color} border-0 text-white overflow-hidden relative`}>
                  <CardContent className="p-6 relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="relative">
                      <p className="text-xs font-medium text-white/80">{card.label}</p>
                      <p className="text-4xl font-bold mt-2">{card.value}</p>
                      <p className="text-xs text-white/70 mt-1">{card.desc}</p>
                    </div>
                    <div className="absolute bottom-4 right-4 opacity-30">
                      <card.icon className="w-12 h-12" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border border-slate-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Entregas por Dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <MiniGrafico data={dadosGraficoEntregas} type="bar" />
                </CardContent>
              </Card>
              
              <Card className="border border-slate-200/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <GraficoPizza noPrazo={dadosGraficoPerformance.noPrazo} atrasadas={dadosGraficoPerformance.atrasadas} />
                </CardContent>
              </Card>
            </div>

            {/* Entregas Recentes */}
            <Card className="border border-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Entregas em Andamento</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab("entregas")} className="text-orange-600">
                  Ver todas <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {entregas.filter(e => e.status !== "entregue").slice(0, 3).map(entrega => (
                  <div 
                    key={entrega.id}
                    className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                    onClick={() => { setSelectedEntrega(entrega); setShowDetailModal(true); }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        statusCores[entrega.status] || "bg-slate-100"
                      }`}>
                        {getStatusIcone(entrega.status)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{entrega.numero}</p>
                        <p className="text-sm text-muted-foreground">{entrega.origem.cidade} → {entrega.destino.cidade}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant="outline" className={statusCores[entrega.status]}>{entrega.status_label}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">Prev: {fmtData(entrega.previsao)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-300" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== ENTREGAS ===== */}
        {activeTab === "entregas" && (
          <div className="space-y-6">
            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="relative w-full lg:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar por OS ou cidade..." 
                  className="pl-10 bg-white rounded-xl"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="w-[180px] bg-white rounded-xl">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="programacao">Programado</SelectItem>
                    <SelectItem value="em_rota">Em Rota</SelectItem>
                    <SelectItem value="entregue">Entregue</SelectItem>
                    <SelectItem value="atrasada">Atrasado</SelectItem>
                    <SelectItem value="problema">Problema</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  className="rounded-xl"
                  onClick={handleBaixarLote}
                  disabled={selectedEntregas.size === 0}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar ({selectedEntregas.size})
                </Button>
              </div>
            </div>

            {/* Lista premium de Entregas */}
            <div className="grid grid-cols-1 gap-4">
              {filteredEntregas.map(entrega => (
                <Card 
                  key={entrega.id} 
                  className="overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-slate-200/50"
                  onClick={() => { setSelectedEntrega(entrega); setShowDetailModal(true); }}
                >
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <Checkbox 
                            checked={selectedEntregas.has(entrega.id)}
                            onCheckedChange={() => toggleSelecionarEntrega(entrega.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <h3 className="font-bold text-slate-800 text-xl">{entrega.numero}</h3>
                            <p className="text-sm text-muted-foreground">{entrega.mercadoria}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${statusCores[entrega.status]} px-3 py-1`}>
                          {getStatusIcone(entrega.status)}
                          <span className="ml-2">{entrega.status_label}</span>
                        </Badge>
                      </div>

                      {/* Rota visual */}
                      <div className="flex items-center gap-4 mb-4 p-4 bg-slate-50 rounded-xl">
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground uppercase mb-1">Origem</p>
                          <p className="font-medium">{entrega.origem.cidade} - {entrega.origem.uf}</p>
                          <p className="text-sm text-muted-foreground">{entrega.origem.rua}, {entrega.origem.numero}</p>
                        </div>
                        <ArrowRight className="w-6 h-6 text-orange-500" />
                        <div className="flex-1 text-right">
                          <p className="text-xs text-muted-foreground uppercase mb-1">Destino</p>
                          <p className="font-medium">{entrega.destino.cidade} - {entrega.destino.uf}</p>
                          <p className="text-sm text-muted-foreground">{entrega.destino.rua}, {entrega.destino.numero}</p>
                        </div>
                      </div>

                      {/* Timeline */}
                      <StepTimeline historico={entrega.historico} />

                      {/* Info adicional */}
                      {entrega.prestador && entrega.status !== "programacao" && (
                        <div className="mt-4 pt-4 border-t flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                              <User className="w-5 h-5 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Motorista</p>
                              <p className="font-medium">{entrega.prestador.nome}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-slate-50">{entrega.volumes} volumes</Badge>
                            <Badge variant="outline" className="bg-slate-50">{entrega.peso}kg</Badge>
                            <span className="text-sm text-muted-foreground">R$ {fmtFin(entrega.valor_frete)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredEntregas.length === 0 && (
                <div className="text-center py-16">
                  <Package className="w-20 h-20 mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-600">Nenhuma entrega encontrada</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== NOVA ENTREGA ===== */}
        {activeTab === "nova" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulário principal */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border border-slate-200/50">
                <CardHeader>
                  <CardTitle className="text-lg">Nova Solicitação de Coleta</CardTitle>
                  <CardDescription>Preencha os dados da sua solicitação</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Origem */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Home className="w-4 h-4 text-orange-500" />
                        Endereço de Coleta
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setShowNovoEnderecoModal(true)} className="text-orange-600">
                        + Salvar endereço
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label className="text-xs">CEP</Label>
                        <Input 
                          placeholder="00000-000" 
                          value={novaEntrega.origem.cep}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, cep: e.target.value } }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Rua</Label>
                        <Input 
                          placeholder="Rua, Avenida..."
                          value={novaEntrega.origem.rua}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, rua: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Número</Label>
                        <Input 
                          placeholder="0"
                          value={novaEntrega.origem.numero}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, numero: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Complemento</Label>
                        <Input 
                          placeholder="Apto, sala..."
                          value={novaEntrega.origem.complemento}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, complemento: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Bairro</Label>
                        <Input 
                          placeholder="Bairro"
                          value={novaEntrega.origem.bairro}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, bairro: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input 
                          placeholder="Cidade"
                          value={novaEntrega.origem.cidade}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, origem: { ...prev.origem, cidade: e.target.value } }))}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Destino */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-purple-500" />
                      Endereço de Entrega
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label className="text-xs">CEP</Label>
                        <Input 
                          placeholder="00000-000"
                          value={novaEntrega.destino.cep}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, destino: { ...prev.destino, cep: e.target.value } }))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Rua</Label>
                        <Input 
                          placeholder="Rua, Avenida..."
                          value={novaEntrega.destino.rua}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, destino: { ...prev.destino, rua: e.target.value } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Número</Label>
                        <Input placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs">Complemento</Label>
                        <Input placeholder="Apto, sala..." />
                      </div>
                      <div>
                        <Label className="text-xs">Bairro</Label>
                        <Input placeholder="Bairro" />
                      </div>
                      <div>
                        <Label className="text-xs">Cidade</Label>
                        <Input placeholder="Cidade" />
                      </div>
                    </div>
                  </div>

                  {/* Destinatário */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-500" />
                      Dados do Destinatário
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label className="text-xs">Nome/Razão Social</Label>
                        <Input placeholder="Nome completo ou razão social" />
                      </div>
                      <div>
                        <Label className="text-xs">CPF/CNPJ</Label>
                        <Input placeholder="000.000.000-00" />
                      </div>
                      <div>
                        <Label className="text-xs">Telefone</Label>
                        <Input placeholder="(00) 00000-0000" />
                      </div>
                    </div>
                  </div>

                  {/* Mercadoria */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Box className="w-4 h-4 text-blue-500" />
                      Mercadoria
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label className="text-xs">Descrição</Label>
                        <Input placeholder="Descrição da mercadoria" />
                      </div>
                      <div>
                        <Label className="text-xs">Peso (kg)</Label>
                        <Input 
                          type="number" 
                          placeholder="0"
                          value={novaEntrega.peso || ""}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, peso: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Volumes</Label>
                        <Input 
                          type="number" 
                          placeholder="0"
                          value={novaEntrega.volume || ""}
                          onChange={(e) => setNovaEntrega(prev => ({ ...prev, volume: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Altura (cm)</Label>
                        <Input type="number" placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs">Largura (cm)</Label>
                        <Input type="number" placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Instruções */}
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-semibold flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-amber-500" />
                      Instruções
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label className="text-xs">Instruções para o motorista</Label>
                        <Textarea placeholder="Ex: Portaria com horário restrito, entrar pelo lado B..." />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Janela de entrega</Label>
                        <Input placeholder="Ex: 08h às 17h" />
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-14 text-lg"
                    onClick={() => toast({ title: "Cotação gerada", description: "Valor estimado: " + fmtFin(novaEntrega.valorEstimado) })}
                  >
                    <Calculator className="w-5 h-5 mr-2" />
                    Gerar Cotação
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Endereços e Veículos */}
            <div className="space-y-6">
              {/* Endereços Frequentes */}
              <Card className="border border-slate-200/50">
                <CardHeader>
                  <CardTitle className="text-base">Endereços Frequentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {enderecosFavoritos.map(end => (
                    <div key={end.id} className="p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition">
                      <p className="font-medium text-sm">{end.nome}</p>
                      <p className="text-xs text-muted-foreground">{end.rua}, {end.numero} - {end.cidade}/{end.uf}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Sugestão de Veículo */}
              <Card className="border border-slate-200/50">
                <CardHeader>
                  <CardTitle className="text-base">Sugestão de Veículo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {veiculosSugestoes.map((v, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg flex items-center justify-between ${
                        novaEntrega.peso <= v.capacidade_kg ? "bg-emerald-50 border border-emerald-200" : "bg-slate-50"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{v.tipo}</p>
                        <p className="text-xs text-muted-foreground">{v.capacidade_kg}kg • {v.volume_m3}m³</p>
                      </div>
                      {novaEntrega.peso <= v.capacidade_kg && <CheckCheck className="w-5 h-5 text-emerald-500" />}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Valor Estimado */}
              <Card className="bg-gradient-to-br from-orange-500 to-purple-600 border-0 text-white">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-white/80">Valor Estimado</p>
                  <p className="text-3xl font-bold mt-2">{fmtFin(novaEntrega.valorEstimado)}</p>
                  <p className="text-xs text-white/70 mt-2">Sujeito a alterações após análise</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ===== ROTEIRIZAÇÃO ===== */}
        {activeTab === "roteirizacao" && (
          <div className="space-y-6">
            <Card className="border border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-lg">Roteirização Inteligente</CardTitle>
                <CardDescription>Agrupamos suas entregas por região automaticamente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500 text-white flex items-center justify-center">1</div>
                      <h4 className="font-semibold">Região SP</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">3 entregas</p>
                    <p className="text-xs text-blue-600 mt-2">Baixo risco de atraso</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center">2</div>
                      <h4 className="font-semibold">Região RJ</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">1 entrega</p>
                    <p className="text-xs text-purple-600 mt-2">Risco médio</p>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center">3</div>
                      <h4 className="font-semibold">Interior SP</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">1 entrega</p>
                    <p className="text-xs text-emerald-600 mt-2">Baixo risco</p>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" className="rounded-xl">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar
                  </Button>
                  <Button className="rounded-xl bg-orange-500">
                    <Route className="w-4 h-4 mr-2" />
                    Gerar Roteiro
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ===== ALERTAS ===== */}
        {activeTab === "alertas" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Central de Alertas</h2>
            
            {alertas.length === 0 ? (
              <Card className="border border-slate-200/50">
                <CardContent className="py-16 text-center">
                  <CheckCircle className="w-20 h-20 mx-auto mb-4 text-emerald-500" />
                  <p className="text-lg font-medium">Tudo em ordem!</p>
                  <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {alertas.map(alerta => (
                  <Card 
                    key={alerta.id}
                    className={`border-l-4 ${alerta.severidade === "critico" ? "border-l-red-500" : "border-l-amber-500"}`}
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
                            <h3 className="font-semibold">{alerta.titulo}</h3>
                            <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
                            <p className="text-xs text-muted-foreground mt-1">{fmtData(alerta.created_at)}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Card className="bg-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Wallet className="w-5 h-5 text-red-500" />
                    <p className="text-sm font-medium text-slate-600">Faturas Vencidas</p>
                  </div>
                  <p className="text-2xl font-bold text-red-600">{fmtFin(0)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-5 h-5 text-blue-500" />
                    <p className="text-sm font-medium text-slate-600">A Vencer</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{fmtFin(totalAVencer)}</p>
                </CardContent>
              </Card>
              <Card className="bg-slate-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-600">Pagos no Período</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{fmtFin(totalFaturado)}</p>
                </CardContent>
              </Card>
            </div>

            {/* Faturas */}
            <Card className="border border-slate-200/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Minhas Faturas</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg">
                    <Download className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg">
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
                      <TableHead>OS</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faturas.map(fatura => (
                      <TableRow key={fatura.id}>
                        <TableCell className="font-semibold">{fatura.fatura}</TableCell>
                        <TableCell>{fatura.competencia}</TableCell>
                        <TableCell className="text-xs">{fatura.os_vinculadas.join(", ")}</TableCell>
                        <TableCell>{fmtData(fatura.vencimento)}</TableCell>
                        <TableCell className="font-medium">{fmtFin(fatura.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            fatura.status === "paga" ? "bg-emerald-50 text-emerald-700" :
                            fatura.status === "a_vencer" ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                          }>
                            {fatura.status === "paga" ? "Pago" : fatura.status === "a_vencer" ? "A Vencer" : "Vencida"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Detalhamento */}
            <Card className="border border-slate-200/50">
              <CardHeader>
                <CardTitle className="text-base">Resumo por Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
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
                          <Badge variant="outline" className={statusCores[entrega.status]}>{entrega.status_label}</Badge>
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

      {/* Modal Detalhe da Entrega */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              {selectedEntrega?.numero}
            </DialogTitle>
          </DialogHeader>

          {selectedEntrega && (
            <div className="space-y-5">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${statusCores[selectedEntrega.status]}`}>
                    {getStatusIcone(selectedEntrega.status)}
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{selectedEntrega.status_label}</p>
                    <p className="text-sm text-muted-foreground">Previsão: {fmtData(selectedEntrega.previsao)}</p>
                  </div>
                </div>
                <Button variant="outline" className="text-red-600" onClick={() => setShowProblemaModal(true)}>
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Reportar
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl">
                  <p className="text-xs font-bold text-blue-600 uppercase">Origem</p>
                  <p className="font-medium mt-1">{selectedEntrega.origem.cidade}/{selectedEntrega.origem.uf}</p>
                  <p className="text-sm text-muted-foreground">{selectedEntrega.origem.rua}, {selectedEntrega.origem.numero}</p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-xl">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Destino</p>
                  <p className="font-medium mt-1">{selectedEntrega.destino.cidade}/{selectedEntrega.destino.uf}</p>
                  <p className="text-sm text-muted-foreground">{selectedEntrega.destino.rua}, {selectedEntrega.destino.numero}</p>
                </div>
              </div>

              {selectedEntrega.destinatario && (
                <div className="p-4 border rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Destinatário</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome</p>
                      <p className="font-medium">{selectedEntrega.destinatario.nome}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Documento</p>
                      <p className="font-medium">{selectedEntrega.destinatario.documento}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Telefone</p>
                      <p className="font-medium">{selectedEntrega.destinatario.telefone}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedEntrega.prestador && (
                <div className="p-4 border rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Motorista</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                        <User className="w-6 h-6 text-slate-500" />
                      </div>
                      <div>
                        <p className="font-semibold">{selectedEntrega.prestador.nome}</p>
                        <p className="text-sm text-muted-foreground">{selectedEntrega.prestador.telefone}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEnviarAcompanhamento(selectedEntrega, "saiu")}>
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Notificar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Timeline</p>
                <StepTimeline historico={selectedEntrega.historico} />
              </div>

              {selectedEntrega.status === "entregue" && selectedEntrega.pod && (
                <div className="p-4 border rounded-xl">
                  <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Comprovante de Entrega</p>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                      {selectedEntrega.pod.foto_url ? (
                        <img src={selectedEntrega.pod.foto_url} alt="Foto" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Camera className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                    <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center">
                      {selectedEntrega.pod.assinatura_url ? (
                        <img src={selectedEntrega.pod.assinatura_url} alt="Ass" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Signature className="w-8 h-8 text-slate-400" />
                      )}
                    </div>
                  </div>
                  {selectedEntrega.pod.receptor && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm"><span className="font-semibold">Recebedor:</span> {selectedEntrega.pod.receptor}</p>
                      <p className="text-sm"><span className="font-semibold"> Grau:</span> {selectedEntrega.pod.grau_parentesco}</p>
                      <p className="text-sm text-muted-foreground">{selectedEntrega.pod.local}</p>
                    </div>
                  )}
                  <Button className="w-full mt-3 bg-orange-500" onClick={() => handleBaixarComprovante(selectedEntrega)}>
                    <Download className="w-4 h-4 mr-2" />
                    Baixar Comprovante
                  </Button>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reportar Problema */}
      <Dialog open={showProblemaModal} onOpenChange={setShowProblemaModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Reportar Problema
            </DialogTitle>
            <DialogDescription>Selecione o tipo de problema</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Select value={problemaTipo} onValueChange={setProblemaTipo}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atraso">Atraso na Entrega</SelectItem>
                <SelectItem value="nao_encontrado">Cliente Não Encontrado</SelectItem>
                <SelectItem value="avariado">Produto Avariado</SelectItem>
                <SelectItem value="falta">Mercadoria Faltando</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Descrição..." value={problemaDesc} onChange={(e) => setProblemaDesc(e.target.value)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProblemaModal(false)}>Cancelar</Button>
            <Button className="bg-red-500" onClick={handleReportarProblema} disabled={!problemaTipo}>Reportar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Endereço */}
      <Dialog open={showNovoEnderecoModal} onOpenChange={setShowNovoEnderecoModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Endereço Frequente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Input placeholder="Nome (ex: Matriz SP)" />
            <Input placeholder="CEP" />
            <Input placeholder="Rua" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Número" />
              <Input placeholder="Complemento" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovoEnderecoModal(false)}>Cancelar</Button>
            <Button className="bg-orange-500">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}