import { useState, useEffect } from "react";
import { Truck, Phone, MapPin, Search, Plus, Edit, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, Star, FileText, Shield, Calendar, DollarSign, User, ExternalLink, Filter, Copy, Archive, History, Wrench, Award, TrendingUp, Activity, MapPinned, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

interface Motorista {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  regiao: string;
  regioesAtuacao: string[];
  tipoVeiculo: string;
  placa: string;
  tipoOperacao: string;
  temperaturaMinima: string;
  capacidade: string;
  disponibilidade: string;
  status: string;
  observacoes: string;
  origem: string;
  dataCadastro: string;
  
  // Campos adicionais para perfil completo
  score: number;
  ocorrencias: number;
  entregas: number;
  atrasos: number;
  ultimaOperacao: string;
  valorMedio: number;
  documentos: Documento[];
  historico: HistoricoItem[];
  agregado: boolean;
  cpf: string;
  cnh: string;
  veiculoProprio: boolean;
}

interface Documento {
  id: string;
  tipo: string;
  numero: string;
  validade: string;
  status: string;
}

interface HistoricoItem {
  id: string;
  acao: string;
  data: string;
  observacao: string;
}

const TIPOS_VEICULO = [
  { value: "moto", label: "Moto" },
  { value: "fiorino", label: "Fiorino" },
  { value: "van_vuc", label: "Van / VUC" },
  { value: "caminhao_34", label: "Caminhão 3/4" },
  { value: "caminhao_toco", label: "Caminhão Toco" },
  { value: "caminhao_truck", label: "Caminhão Truck" },
  { value: "carreta", label: "Carreta" },
];

const TEMPERATURAS = [
  { value: "ambiente", label: "Ambiente controlado" },
  { value: "0", label: "0°C" },
  { value: "-5", label: "-5°C" },
  { value: "-10", label: "-10°C" },
  { value: "-18", label: "-18°C" },
  { value: "-25", label: "-25°C" },
];

const STORAGE_KEY = "banco_motoristas_tms";

const getVeiculoLabel = (value: string) => {
  const found = TIPOS_VEICULO.find(t => t.value === value);
  return found ? found.label : value;
};

const getTemperaturaLabel = (value: string) => {
  const found = TEMPERATURAS.find(t => t.value === value);
  return found ? found.label : value;
};

const initialMotoristas: Motorista[] = [
  { 
    id: "1", nome: "Carlos Silva Santos", telefone: "(11) 99999-0001", email: "carlos@gmail.com", regiao: "São Paulo - Capital", regioesAtuacao: ["SP Capital", "Grande SP"], tipoVeiculo: "caminhao_truck", placa: "ABC-1234", tipoOperacao: "seco", temperaturaMinima: "", capacidade: "10 ton", disponibilidade: "disponivel", status: "aprovado", observacoes: "Experiência com carga paletizada", origem: "Indicação", dataCadastro: "2026-03-15",
    score: 92, ocorrencias: 0, entregas: 145, atrasos: 3, ultimaOperacao: "Magazine Luiza", valorMedio: 8500, documentos: [], historico: [], agregado: true, cpf: "123.456.789-00", cnh: "12345678900", veiculoProprio: true
  },
  { 
    id: "2", nome: "Roberto Alves Ferreira", telefone: "(11) 99999-0002", email: "roberto@gmail.com", regiao: "Grande São Paulo", regioesAtuacao: ["Grande SP"], tipoVeiculo: "van_vuc", placa: "DEF-5678", tipoOperacao: "refrigerado", temperaturaMinima: "-18", capacidade: "1.5 ton", disponibilidade: "disponivel", status: "interessado", observacoes: "Disponível para operações diárias", origem: "Portal", dataCadastro: "2026-03-18",
    score: 78, ocorrencias: 2, entregas: 45, atrasos: 1, ultimaOperacao: "", valorMedio: 0, documentos: [], historico: [], agregado: false, cpf: "234.567.890-01", cnh: "23456789012", veiculoProprio: true
  },
  { 
    id: "3", nome: "Marcos Paulo Oliveira", telefone: "(11) 99999-0003", email: "marcos@gmail.com", regiao: "Interior SP", regioesAtuacao: ["Interior SP", "Minas Gerais"], tipoVeiculo: "caminhao_toco", placa: "GHI-9012", tipoOperacao: "seco", temperaturaMinima: "", capacidade: "6 ton", disponibilidade: "reserva", status: "pendente", observacoes: "Veículo próprio", origem: "Feira", dataCadastro: "2026-03-20",
    score: 65, ocorrencias: 5, entregas: 28, atrasos: 4, ultimaOperacao: "Mercado Livre", valorMedio: 4200, documentos: [], historico: [], agregado: true, cpf: "345.678.901-23", cnh: "34567890123", veiculoProprio: true
  },
  { 
    id: "4", nome: "José Carlos Souza", telefone: "(11) 99999-0004", email: "jose@gmail.com", regiao: "São Paulo - Capital", regioesAtuacao: ["SP Capital", "Interior SP", "Sul"], tipoVeiculo: "carreta", placa: "JKL-3456", tipoOperacao: "refrigerado", temperaturaMinima: "-25", capacidade: "25 ton", disponibilidade: "disponivel", status: "aprovado", observacoes: "Motorista experiente para truckagem", origem: "Indicação", dataCadastro: "2026-03-22",
    score: 95, ocorrencias: 0, entregas: 312, atrasos: 1, ultimaOperacao: "Amazon", valorMedio: 12500, documentos: [], historico: [], agregado: false, cpf: "456.789.012-34", cnh: "45678901234", veiculoProprio: true
  },
  { 
    id: "5", nome: "Paulo Ricardo Santos", telefone: "(11) 99999-0005", email: "paulo@gmail.com", regiao: "São Paulo - Capital", regioesAtuacao: ["SP Capital"], tipoVeiculo: "van_vuc", placa: "MNO-7890", tipoOperacao: "seco", temperaturaMinima: "", capacidade: "800 kg", disponibilidade: "ferias", status: "inativo", observacoes: "Em férias", origem: "Portal", dataCadastro: "2026-01-10",
    score: 55, ocorrencias: 8, entregas: 15, atrasos: 2, ultimaOperacao: "", valorMedio: 0, documentos: [], historico: [], agregado: false, cpf: "567.890.123-45", cnh: "56789012345", veiculoProprio: false
  },
];

export function BancoMotoristas() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [filtroVeiculo, setFiltroVeiculo] = useState("todos");
  const [filtroScore, setFiltroScore] = useState("todos");
  const [filtroAgregado, setFiltroAgregado] = useState("todos");
  const [filtroDisponibilidade, setFiltroDisponibilidade] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Motorista | null>(null);
  const [motoristaSelecionado, setMotoristaSelecionado] = useState<Motorista | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);

  const [form, setForm] = useState<Partial<Motorista>>({
    nome: "",
    telefone: "",
    email: "",
    regiao: "",
    regioesAtuacao: [],
    tipoVeiculo: "",
    placa: "",
    tipoOperacao: "seco",
    temperaturaMinima: "",
    capacidade: "",
    disponibilidade: "disponivel",
    status: "interessado",
    observacoes: "",
    origem: "Manual",
    dataCadastro: new Date().toISOString().split("T")[0],
    score: 0,
    ocorrencias: 0,
    entregas: 0,
    atrasos: 0,
    ultimaOperacao: "",
    valorMedio: 0,
    documentos: [],
    historico: [],
    agregado: false,
    cpf: "",
    cnh: "",
    veiculoProprio: false
  });

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setMotoristas(JSON.parse(stored));
    } else {
      setMotoristas(initialMotoristas);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialMotoristas));
    }
  }, []);

  const save = (novos: Motorista[]) => {
    setMotoristas(novos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novos));
  };

  const filtered = motoristas.filter((m: Motorista) => {
    const matchBusca = !busca || m.nome.toLowerCase().includes(busca.toLowerCase()) || m.telefone.includes(busca);
    const matchStatus = filtroStatus === "todos" || m.status === filtroStatus;
    const matchRegiao = filtroRegiao === "todas" || m.regiao.includes(filtroRegiao);
    const matchVeiculo = filtroVeiculo === "todos" || m.tipoVeiculo === filtroVeiculo;
    const matchDisp = filtroDisponibilidade === "todos" || m.disponibilidade === filtroDisponibilidade;
    const matchAgregado = filtroAgregado === "todos" || (filtroAgregado === "agregado" && m.agregado) || (filtroAgregado === "freelancer" && !m.agregado);
    const matchScore = filtroScore === "todos" || 
      (filtroScore === "alto" && m.score >= 90) ||
      (filtroScore === "medio" && m.score >= 70 && m.score < 90) ||
      (filtroScore === "baixo" && m.score < 70);
    return matchBusca && matchStatus && matchRegiao && matchVeiculo && matchDisp && matchAgregado && matchScore;
  });

const handleSave = () => {
    if (!form.nome || !form.telefone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    const novoScore = calcularScore(form);
    let novos: Motorista[];
    if (editando) {
      novos = motoristas.map((m) => m.id === editando.id ? { ...m, ...form } : m);
    } else {
      novos = [...motoristas, { ...form, id: Date.now().toString(), score: novoScore } as Motorista];
    }
    save(novos);
    setShowModal(false);
    setEditando(null);
    setForm({ nome: "", telefone: "", email: "", regiao: "", regioesAtuacao: [], tipoVeiculo: "", placa: "", tipoOperacao: "seco", temperaturaMinima: "", capacidade: "", disponibilidade: "disponivel", status: "interessado", observacoes: "", origem: "Manual", dataCadastro: new Date().toISOString().split("T")[0], score: 0, ocorrencias: 0, entregas: 0, atrasos: 0, ultimaOperacao: "", valorMedio: 0, documentos: [], historico: [], agregado: false, cpf: "", cnh: "", veiculoProprio: false });
    toast.success(editando ? "Motorista atualizado!" : "Motorista cadastrado!");
  };

  const calcularScore = (m: Partial<Motorista>): number => {
    let score = 50; // Score base
    if (m.status === "aprovado") score += 20;
    if (m.status === "interessado") score += 10;
    if (m.disponibilidade === "disponivel") score += 15;
    if (m.disponibilidade === "reserva") score += 5;
    if (m.disponibilidade === "indisponivel" || m.disponibilidade === "ferias" || m.disponibilidade === "inativo") score -= 20;
    if (m.ocorrencias) score -= (m.ocorrencias * 5);
    if (m.atrasos) score -= (m.atrasos * 3);
    if (m.entregas && m.entregas > 100) score += 15;
    else if (m.entregas && m.entregas > 50) score += 10;
    else if (m.entregas && m.entregas > 20) score += 5;
    if (m.agregado) score += 5;
    if (m.veiculoProprio) score += 5;
    return Math.max(0, Math.min(100, score));
  };

  const handleVerPerfil = (m: Motorista) => {
    setMotoristaSelecionado(m);
    setShowDrawer(true);
  };

  const handleMudarDisponibilidade = (m: Motorista, novaDisp: string) => {
    const novos = motoristas.map(mot => mot.id === m.id ? { ...mot, disponibilidade: novaDisp } : mot);
    save(novos);
    toast.success(`Disponibilidade alterada para ${novaDisp}!`);
    if (motoristaSelecionado?.id === m.id) {
      setMotoristaSelecionado({ ...m, disponibilidade: novaDisp });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excelente";
    if (score >= 70) return "Bom";
    if (score >= 50) return "Regular";
    return "Baixo";
  };

  const getDispBadge = (disp: string) => {
    switch (disp) {
      case "disponivel":
        return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1"/>Disponível</Badge>;
      case "reserva":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><Clock className="w-3 h-3 mr-1"/>Reserva</Badge>;
      case "ocupado":
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1"/>Ocupado</Badge>;
      case "ferias":
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200"><Calendar className="w-3 h-3 mr-1"/>Férias</Badge>;
      case "indisponivel":
      case "inativo":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200"><XCircle className="w-3 h-3 mr-1"/>Inativo</Badge>;
      default:
        return <Badge>{disp}</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Remover este motorista?")) {
      save(motoristas.filter((m) => m.id !== id));
      toast.success("Motorista removido");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Aprovado</Badge>;
      case "interessado":
        return <Badge className="bg-blue-100 text-blue-700"><AlertCircle className="w-3 h-3 mr-1" /> Interessado</Badge>;
      case "reserva":
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" /> Reserva</Badge>;
      case "pendente":
        return <Badge className="bg-gray-100 text-gray-700"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDisponibilidadeBadge = (disp: string) => {
    switch (disp) {
      case "disponivel":
        return <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Disponível</span>;
      case "reserva":
        return <span className="inline-flex items-center gap-1 text-xs text-yellow-600"><Clock className="w-3 h-3" /> Reserva</span>;
      case "indisponivel":
        return <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3 h-3" /> Indisponível</span>;
      default:
        return <span className="text-xs text-gray-500">{disp}</span>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-orange-500" />
            Banco de Motoristas
          </h2>
          <p className="text-sm text-muted-foreground">Cadastro profissional de motoristas para oportunidades</p>
        </div>
        <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => { setEditando(null); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Motorista
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="aprovado">Aprovado</SelectItem>
            <SelectItem value="interessado">Interessado</SelectItem>
            <SelectItem value="reserva">Reserva</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroDisponibilidade} onValueChange={setFiltroDisponibilidade}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Disponibilidade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="reserva">Reserva</SelectItem>
            <SelectItem value="ocupado">Ocupado</SelectItem>
            <SelectItem value="ferias">Férias</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Regiões</SelectItem>
            <SelectItem value="São Paulo">São Paulo</SelectItem>
            <SelectItem value="Grande">Grande São Paulo</SelectItem>
            <SelectItem value="Interior">Interior SP</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroVeiculo} onValueChange={setFiltroVeiculo}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Veículo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="van_vuc">Van/VUC</SelectItem>
            <SelectItem value="caminhao_toco">Toco</SelectItem>
            <SelectItem value="caminhao_truck">Truck</SelectItem>
            <SelectItem value="carreta">Carreta</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroScore} onValueChange={setFiltroScore}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="alto">Alto (90+)</SelectItem>
            <SelectItem value="medio">Médio (70+)</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroAgregado} onValueChange={setFiltroAgregado}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="agregado">Agregado</SelectItem>
            <SelectItem value="freelancer">Freelancer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Motorista</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Disponibilidade</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleVerPerfil(m)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs">
                        {(m.nome || "").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{m.nome}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          {m.agregado ? <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-700">Agregado</Badge> : <Badge className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700">Freelancer</Badge>}
                          {m.veiculoProprio && <span className="text-[10px]">• Veículo próprio</span>}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {m.telefone}
                      </div>
                      {m.email && <div className="text-xs text-muted-foreground">{m.email}</div>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <Truck className="w-3 h-3 text-muted-foreground" />
                        {getVeiculoLabel(m.tipoVeiculo)}
                      </div>
                      {m.placa && <span className="text-xs text-muted-foreground">{m.placa}</span>}
                      <div className="flex items-center gap-1">
                        {(m.tipoOperacao === "refrigerado" || m.tipoOperacao === "ambos") && m.temperaturaMinima && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {m.temperaturaMinima}°C
                          </span>
                        )}
                        {m.tipoOperacao === "seco" && <span className="text-xs text-muted-foreground">Seco</span>}
                        <span className="text-xs text-muted-foreground block">{m.capacidade}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {m.regiao}
                    </div>
                    {m.regioesAtuacao && m.regioesAtuacao.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.regioesAtuacao.map((r, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1 rounded">{r}</span>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{getDispBadge(m.disponibilidade)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className={`w-3 h-3 ${getScoreColor(m.score)}`} />
                      <span className={`font-bold ${getScoreColor(m.score)}`}>{m.score}</span>
                      <span className="text-xs text-muted-foreground">({getScoreLabel(m.score)})</span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(m.status)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditando(m); setForm(m); setShowModal(true); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum motorista encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar Motorista" : "Novo Motorista"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-1">
              <Label>Nome Completo *</Label>
              <Input value={form.nome || ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do motorista" />
            </div>
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={form.telefone || ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label>Região</Label>
              <Input value={form.regiao || ""} onChange={(e) => setForm({ ...form, regiao: e.target.value })} placeholder="São Paulo, Interior, etc." />
            </div>
            <div className="space-y-1">
              <Label>Tipo de Veículo</Label>
              <Select value={form.tipoVeiculo} onValueChange={(v) => setForm({ ...form, tipoVeiculo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_VEICULO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo de Operação *</Label>
              <Select value={form.tipoOperacao || "seco"} onValueChange={(v) => setForm({ ...form, tipoOperacao: v, temperaturaMinima: v === "seco" || v === "ambos" ? "" : form.temperaturaMinima })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seco">Seco</SelectItem>
                  <SelectItem value="refrigerado">Refrigerado</SelectItem>
                  <SelectItem value="ambos">Ambos (Seco e Refrigerado)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipoOperacao === "refrigerado" && (
              <div className="space-y-1">
                <Label>Temperatura mínima *</Label>
                <Select value={form.temperaturaMinima} onValueChange={(v) => setForm({ ...form, temperaturaMinima: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione temperatura" /></SelectTrigger>
                  <SelectContent>
                    {TEMPERATURAS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Capacidade</Label>
              <Input value={form.capacidade || ""} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} placeholder="Ex: 10 ton" />
            </div>
            <div className="space-y-1">
              <Label>Disponibilidade</Label>
              <Select value={form.disponibilidade} onValueChange={(v) => setForm({ ...form, disponibilidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reserva">Reserva</SelectItem>
                  <SelectItem value="indisponivel">Indisponível</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interessado">Interessado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="reserva">Reserva</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Origem do Cadastro</Label>
              <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Cadastro Manual</SelectItem>
                  <SelectItem value="Portal">Portal de Vagas</SelectItem>
                  <SelectItem value="Indicação">Indicação</SelectItem>
                  <SelectItem value="Feira">Feira de Carreiras</SelectItem>
                  <SelectItem value="Redes">Redes Sociais</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Observações</Label>
              <Textarea value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Observações sobre o motorista..." className="resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button className="bg-orange-600" onClick={handleSave}>Salvar Motorista</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PERFIL DO MOTORISTA - DRAWER */}
      <Drawer open={showDrawer} onOpenChange={setShowDrawer}>
        <DrawerContent className="max-w-lg h-[90vh]">
          {motoristaSelecionado ? (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-lg">
                    {(motoristaSelecionado.nome || "").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{motoristaSelecionado.nome}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className={`w-4 h-4 ${getScoreColor(motoristaSelecionado.score)}`} />
                      <span className={`font-bold ${getScoreColor(motoristaSelecionado.score)}`}>{motoristaSelecionado.score}</span>
                      <span className="text-sm text-muted-foreground">({getScoreLabel(motoristaSelecionado.score)})</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDrawer(false)}><XCircle className="w-4 h-4" /></Button>
                </div>
                <div className="flex gap-2 mt-2">
                  {getStatusBadge(motoristaSelecionado.status)}
                  {getDispBadge(motoristaSelecionado.disponibilidade)}
                  {motoristaSelecionado.agregado ? <Badge className="bg-green-100 text-green-700 border-green-200">Agregado</Badge> : <Badge className="bg-blue-100 text-blue-700 border-blue-200">Freelancer</Badge>}
                </div>
              </div>
              
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                <Tabs defaultValue="dados" className="w-full">
                  <TabsList className="w-full bg-muted/50">
                    <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
                    <TabsTrigger value="operacoes" className="flex-1">Operações</TabsTrigger>
                    <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="dados" className="space-y-4 mt-4">
                    {/* Same as before */}
                    <Card>
                      <CardHeader className="py-3"><CardTitle className="text-sm">Contato</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{motoristaSelecionado.telefone}</span>
                        </div>
                        {motoristaSelecionado.email && (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{motoristaSelecionado.email}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{motoristaSelecionado.regiao}</span>
                        </div>
                        {motoristaSelecionado.placa && (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground" />
                            <span>{motoristaSelecionado.placa} - {getVeiculoLabel(motoristaSelecionado.tipoVeiculo)}</span>
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">Capacidade: {motoristaSelecionado.capacidade}</div>
                        <div className="text-sm text-muted-foreground">
                          Tipo: {motoristaSelecionado.tipoOperacao === "refrigerado" ? `Refrigerado (${motoristaSelecionado.temperaturaMinima || "N/A"}°C)` : "Seco"}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="py-3"><CardTitle className="text-sm">Disponibilidade</CardTitle></CardHeader>
                      <CardContent>
                        <div className="flex gap-2 flex-wrap">
                          <Button size="sm" variant={motoristaSelecionado.disponibilidade === "disponivel" ? "default" : "outline"} onClick={() => handleMudarDisponibilidade(motoristaSelecionado, "disponivel")}>
                            <CheckCircle className="w-3 h-3 mr-1"/>Disponível
                          </Button>
                          <Button size="sm" variant={motoristaSelecionado.disponibilidade === "reserva" ? "default" : "outline"} onClick={() => handleMudarDisponibilidade(motoristaSelecionado, "reserva")}>
                            <Clock className="w-3 h-3 mr-1"/>Reserva
                          </Button>
                          <Button size="sm" variant={motoristaSelecionado.disponibilidade === "inativo" ? "default" : "outline"} onClick={() => handleMudarDisponibilidade(motoristaSelecionado, "inativo")}>
                            <XCircle className="w-3 h-3 mr-1"/>Inativo
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="py-3"><CardTitle className="text-sm">Documentos</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CPF</span>
                          <span className="font-mono">{motoristaSelecionado.cpf || "Não informado"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">CNH</span>
                          <span className="font-mono">{motoristaSelecionado.cnh || "Não informado"}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Veículo próprio</span>
                          <span>{motoristaSelecionado.veiculoProprio ? "Sim" : "Não"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="operacoes" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="py-3"><CardTitle className="text-sm">Métricas Operacionais</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Total Entregas</span>
                          <span className="font-bold text-lg">{motoristaSelecionado.entregas}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Ocorrências</span>
                          <span className={`font-bold ${motoristaSelecionado.ocorrencias > 3 ? "text-red-600" : "text-green-600"}`}>
                            {motoristaSelecionado.ocorrencias}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Atrasos</span>
                          <span className={`font-bold ${motoristaSelecionado.atrasos > 2 ? "text-red-600" : "text-yellow-600"}`}>
                            {motoristaSelecionado.atrasos}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Última Operação</span>
                          <span>{motoristaSelecionado.ultimaOperacao || "N/A"}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Valor Médio</span>
                          <span className="font-bold text-green-600">
                            R$ {motoristaSelecionado.valorMedio.toFixed(2)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="historico" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader className="py-3"><CardTitle className="text-sm">Informações</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Data Cadastro</span>
                          <span>{new Date(motoristaSelecionado.dataCadastro).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Origem</span>
                          <span>{motoristaSelecionado.origem}</span>
                        </div>
                        {motoristaSelecionado.observacoes && (
                          <div className="pt-2 border-t">
                            <span className="text-muted-foreground text-sm">Observações:</span>
                            <p className="text-sm mt-1">{motoristaSelecionado.observacoes}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
}