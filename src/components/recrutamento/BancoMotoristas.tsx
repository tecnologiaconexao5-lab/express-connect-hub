import { useState, useEffect } from "react";
import { Truck, Phone, MapPin, Search, Plus, Edit, Trash2, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface Motorista {
  id: string;
  nome: string;
  telefone: string;
  regiao: string;
  tipoVeiculo: string;
  capacidade: string;
  disponibilidade: string;
  status: string;
  observacoes: string;
  origem: string;
  dataCadastro: string;
}

const STORAGE_KEY = "banco_motoristas_tms";

const initialMotoristas: Motorista[] = [
  { id: "1", nome: "Carlos Silva Santos", telefone: "(11) 99999-0001", regiao: "São Paulo - Capital", tipoVeiculo: "Caminhão Truck", capacidade: "10 ton", disponibilidade: "disponivel", status: "aprovado", observacoes: "Experiência com carga paletizada", origem: "Indicação", dataCadastro: "2026-03-15" },
  { id: "2", nome: "Roberto Alves Ferreira", telefone: "(11) 99999-0002", regiao: "Grande São Paulo", tipoVeiculo: "Van", capacidade: "1.5 ton", disponibilidade: "disponivel", status: "interessado", observacoes: "Disponível para operações diárias", origem: "Portal", dataCadastro: "2026-03-18" },
  { id: "3", nome: "Marcos Paulo Oliveira", telefone: "(11) 99999-0003", regiao: "Interior SP", tipoVeiculo: "Caminhão Toco", capacidade: "6 ton", disponibilidade: "reserva", status: "pendente", observacoes: "Veículo próprio", origem: "Feira", dataCadastro: "2026-03-20" },
  { id: "4", nome: "José Carlos Souza", telefone: "(11) 99999-0004", regiao: "São Paulo - Capital", tipoVeiculo: "Carreta", capacidade: "25 ton", disponibilidade: "disponivel", status: "aprovado", observacoes: "Motorista experiente pararuckagem", origem: "Indicação", dataCadastro: "2026-03-22" },
];

export function BancoMotoristas() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroRegiao, setFiltroRegiao] = useState("todas");
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Motorista | null>(null);

  const [form, setForm] = useState<Partial<Motorista>>({
    nome: "",
    telefone: "",
    regiao: "",
    tipoVeiculo: "",
    capacidade: "",
    disponibilidade: "disponivel",
    status: "interessado",
    observacoes: "",
    origem: "Manual",
    dataCadastro: new Date().toISOString().split("T")[0]
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
    return matchBusca && matchStatus && matchRegiao;
  });

const handleSave = () => {
    if (!form.nome || !form.telefone) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    let novos: Motorista[];
    if (editando) {
      novos = motoristas.map((m) => m.id === editando.id ? { ...m, ...form } : m);
    } else {
      novos = [...motoristas, { ...form, id: Date.now().toString() } as Motorista];
    }
    save(novos);
    setShowModal(false);
    setEditando(null);
    setForm({ nome: "", telefone: "", regiao: "", tipoVeiculo: "", capacidade: "", disponibilidade: "disponivel", status: "interessado", observacoes: "", origem: "Manual", dataCadastro: new Date().toISOString().split("T")[0] });
    toast.success(editando ? "Motorista atualizado!" : "Motorista cadastrado!");
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
        <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Região" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Regiões</SelectItem>
            <SelectItem value="São Paulo">São Paulo</SelectItem>
            <SelectItem value="Grande">Grande São Paulo</SelectItem>
            <SelectItem value="Interior">Interior SP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motorista</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Disponibilidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nome}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {m.telefone}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      {m.regiao}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Truck className="w-3 h-3 text-muted-foreground" />
                      {m.tipoVeiculo}
                    </div>
                    <span className="text-xs text-muted-foreground">{m.capacidade}</span>
                  </TableCell>
                  <TableCell>{getDisponibilidadeBadge(m.disponibilidade)}</TableCell>
                  <TableCell>{getStatusBadge(m.status)}</TableCell>
                  <TableCell className="text-xs">{m.origem}</TableCell>
                  <TableCell className="text-xs">{new Date(m.dataCadastro).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right">
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
                  <SelectItem value="Fiorino">Fiorino</SelectItem>
                  <SelectItem value="Van">Van / VUC</SelectItem>
                  <SelectItem value="3/4">Caminhão 3/4</SelectItem>
                  <SelectItem value="Toco">Caminhão Toco</SelectItem>
                  <SelectItem value="Truck">Caminhão Truck</SelectItem>
                  <SelectItem value="Carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
    </div>
  );
}