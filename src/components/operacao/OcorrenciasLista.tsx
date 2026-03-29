import { useState } from "react";
import { AlertTriangle, Plus, Search, Eye, Camera, PenTool, CheckCircle, Clock, MapPin, Package, DollarSign, RotateCcw, ArrowRightLeft, FileText, Upload, X, Filter } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Ocorrencia {
  id: string;
  os: string;
  tipo: string;
  data: Date;
  descricao: string;
  responsavel: string;
  impactoFinanceiro: number;
  foto?: string;
  geraReentrega: boolean;
  geraDevolucao: boolean;
  status: "aberta" | "tratativa" | "resolvida" | "encerrada";
  historico: HistoricoItem[];
}

interface HistoricoItem {
  id: string;
  data: Date;
  tipo: string;
  descricao: string;
  responsavel: string;
}

const tiposOcorrencia = [
  { value: "ausencia_cliente", label: "Ausência do cliente" },
  { value: "endereco_nao_localizado", label: "Endereço não localizado" },
  { value: "recusa", label: "Recusa do destinatário" },
  { value: "avaria", label: "Avaria na carga" },
  { value: "falta_volume", label: "Falta de volume" },
  { value: "atraso", label: "Atraso na entrega" },
  { value: "mecanico", label: "Problema mecânico" },
  { value: "documental", label: "Problema documental" },
  { value: "outro", label: "Outro" },
];

const mockOcorrencias: Ocorrencia[] = [
  { 
    id: "1", 
    os: "OS-202610-8802", 
    tipo: "avaria", 
    data: new Date(2026, 2, 27, 14, 32), 
    descricao: "Avaria parcial na carga - caixas amassadas",
    responsavel: "prestador",
    impactoFinanceiro: 2500,
    geraReentrega: true,
    geraDevolucao: false,
    status: "aberta",
      historico: [
        { id: "h1", data: new Date(2026, 2, 27, 14, 32), tipo: "criacao", descricao: "Ocorrência registrada", responsavel: "João Silva" },
        { id: "h2", data: new Date(2026, 2, 27, 15, 0), tipo: "atualizacao", descricao: "Fotos anexadas", responsavel: "João Silva" },
      ]
    },
    { 
      id: "3", 
      os: "OS-10450-3200", 
      tipo: "atraso", 
      data: new Date(2026, 2, 20, 11, 10), 
      descricao: "Atraso de 4h por problema de trânsito",
      responsavel: "transportadora",
      impactoFinanceiro: 800,
      geraReentrega: false,
      geraDevolucao: false,
      status: "resolvida",
      historico: [
        { id: "h1", data: new Date(2026, 2, 20, 11, 10), tipo: "criacao", descricao: "Ocorrência registrada", responsavel: "Maria Santos" },
        { id: "h2", data: new Date(2026, 2, 20, 16, 0), tipo: "resolucao", descricao: "Entrega realizada com atraso", responsavel: "Maria Santos" },
      ]
    },
  { 
    id: "2", 
    os: "OS-10450-4411", 
    tipo: "ausencia_cliente", 
    data: new Date(2026, 2, 26, 9, 15), 
    descricao: "Cliente não estava no local para receber",
    responsavel: "cliente",
    impactoFinanceiro: 0,
    geraReentrega: true,
    geraDevolucao: false,
    status: "tratativa",
    historico: []
  },
  { 
    id: "3", 
    os: "OS-10450-3200", 
    tipo: "atraso", 
    data: new Date(2026, 2, 20, 11, 10), 
    descricao: "Atraso de 4h por problema de trânsito",
    responsavel: "transportadora",
    impactoFinanceiro: 800,
    geraReentrega: false,
    geraDevolucao: false,
    status: "resolvida",
    historico: [
      { id: "h1", data: new Date(2026, 2, 20, 11, 10), tipo: "criacao", descricao: "Ocorrência registrada", responsavel: "Maria Santos" },
      { id: "h2", data: new Date(2026, 2, 20, 16, 0), tipo: "resolucao", descricao: "Entrega realizada com atraso", responsavel: "Maria Santos" },
    ]
  },
];

const OcorrenciasLista = () => {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(mockOcorrencias);
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<Ocorrencia | null>(null);
  const [novaOcorrencia, setNovaOcorrencia] = useState<Partial<Ocorrencia>>({
    tipo: "",
    descricao: "",
    responsavel: "",
    impactoFinanceiro: 0,
    geraReentrega: false,
    geraDevolucao: false,
  });

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "aberta": return <Badge className="bg-red-100 text-red-800 border border-red-200">Aberta</Badge>;
      case "tratativa": return <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Em Tratativa</Badge>;
      case "resolvida": return <Badge className="bg-green-100 text-green-800 border border-green-200">Resolvida</Badge>;
      case "encerrada": return <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">Encerrada</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const t = tiposOcorrencia.find(tp => tp.value === tipo);
    return t?.label || tipo;
  };

  const filteredOcorrencias = ocorrencias.filter(o => {
    if (busca && !o.os.toLowerCase().includes(busca.toLowerCase())) return false;
    if (filtroTipo !== "todos" && o.tipo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && o.status !== filtroStatus) return false;
    return true;
  });

  const abrirDetalhe = (oc: Ocorrencia) => {
    setOcorrenciaSelecionada(oc);
    setShowDetalhe(true);
  };

  const salvarOcorrencia = () => {
    if (!novaOcorrencia.os || !novaOcorrencia.tipo || !novaOcorrencia.descricao) {
      toast.error("Preencha OS, tipo e descrição");
      return;
    }

    const nova: Ocorrencia = {
      id: `o${Date.now()}`,
      os: novaOcorrencia.os || "",
      tipo: novaOcorrencia.tipo || "",
      data: new Date(),
      descricao: novaOcorrencia.descricao || "",
      responsavel: novaOcorrencia.responsavel || "",
      impactoFinanceiro: novaOcorrencia.impactoFinanceiro || 0,
      geraReentrega: novaOcorrencia.geraReentrega || false,
      geraDevolucao: novaOcorrencia.geraDevolucao || false,
      status: "aberta",
      historico: [{
        id: `h${Date.now()}`,
        data: new Date(),
        tipo: "criacao",
        descricao: "Ocorrência registrada",
        responsavel: "Usuário atual"
      }]
    };

    setOcorrencias([nova, ...ocorrencias]);
    setShowModal(false);
    setNovaOcorrencia({});
    toast.success("Ocorrência registrada com sucesso!");
  };

  const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por OS..." 
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-10 w-full bg-card" 
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[150px] h-10">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tiposOcorrencia.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[140px] h-10">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberta">Aberta</SelectItem>
              <SelectItem value="tratativa">Em Tratativa</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
              <SelectItem value="encerrada">Encerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Lançar Ocorrência
        </Button>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList>
          <TabsTrigger value="lista">Lista de Ocorrências</TabsTrigger>
          <TabsTrigger value="rastreio">Rastreio</TabsTrigger>
        </TabsList>

        <TabsContent value="lista">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data / Hora</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-right">Impacto</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOcorrencias.map((oc) => (
                    <TableRow key={oc.id} className="hover:bg-red-50/20 transition">
                      <TableCell className="font-bold text-slate-800">{oc.os}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                          {getTipoLabel(oc.tipo)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {oc.data.toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm capitalize">{oc.responsavel}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {oc.impactoFinanceiro > 0 ? fmtFin(oc.impactoFinanceiro) : "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(oc.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirDetalhe(oc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredOcorrencias.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma ocorrência encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rastreio">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Timeline de Ocorrências por OS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ocorrencias.filter(o => o.historico.length > 0).map(oc => (
                  <div key={oc.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold">{oc.os}</span>
                      {getStatusBadge(oc.status)}
                    </div>
                    <div className="space-y-2">
                      {oc.historico.map(h => (
                        <div key={h.id} className="flex gap-3 text-sm">
                          <div className="w-20 text-xs text-muted-foreground">{h.data.toLocaleString("pt-BR")}</div>
                          <div>
                            <span className="font-medium">{h.descricao}</span>
                            <span className="text-muted-foreground"> - {h.responsavel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Nova Ocorrência */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Registrar Ocorrência
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
            <div>
              <Label>OS Vinculada</Label>
              <Input 
                placeholder="OS-0000" 
                value={novaOcorrencia.os || ""}
                onChange={(e) => setNovaOcorrencia({...novaOcorrencia, os: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tipo de Ocorrência</Label>
              <Select value={novaOcorrencia.tipo} onValueChange={(v) => setNovaOcorrencia({...novaOcorrencia, tipo: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposOcorrencia.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea 
                placeholder="Descreva o que aconteceu..." 
                value={novaOcorrencia.descricao || ""}
                onChange={(e) => setNovaOcorrencia({...novaOcorrencia, descricao: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={novaOcorrencia.responsavel} onValueChange={(v) => setNovaOcorrencia({...novaOcorrencia, responsavel: v})}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prestador">Prestador/Transportadora</SelectItem>
                  <SelectItem value="cliente">Cliente/Destinatário</SelectItem>
                  <SelectItem value="transportadora">Nossa Transportadora</SelectItem>
                  <SelectItem value="operador">Operador/Torre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Impacto Financeiro (R$)</Label>
              <Input 
                type="number" 
                placeholder="0,00" 
                value={novaOcorrencia.impactoFinanceiro || ""}
                onChange={(e) => setNovaOcorrencia({...novaOcorrencia, impactoFinanceiro: parseFloat(e.target.value) || 0})}
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gerar Reentrega?</Label>
              <Switch 
                checked={novaOcorrencia.geraReentrega || false}
                onCheckedChange={(v) => setNovaOcorrencia({...novaOcorrencia, geraReentrega: v})}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Gerar Devolução?</Label>
              <Switch 
                checked={novaOcorrencia.geraDevolucao || false}
                onCheckedChange={(v) => setNovaOcorrencia({...novaOcorrencia, geraDevolucao: v})}
              />
            </div>
            <div>
              <Label>Upload de Evidência (foto)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 text-center mt-1 cursor-pointer hover:bg-muted/50 transition">
                <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">Clique ou arraste arquivo</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={salvarOcorrencia}>Salvar Ocorrência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Detalhes */}
      <Sheet open={showDetalhe} onOpenChange={setShowDetalhe}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Detalhes da Ocorrência - {ocorrenciaSelecionada?.os}
            </SheetTitle>
            <SheetDescription>
              {ocorrenciaSelecionada && getTipoLabel(ocorrenciaSelecionada.tipo)}
            </SheetDescription>
          </SheetHeader>
          
          {ocorrenciaSelecionada && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Status</p>{getStatusBadge(ocorrenciaSelecionada.status)}</CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Data</p><p className="font-medium text-sm">{ocorrenciaSelecionada.data.toLocaleString("pt-BR")}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Responsável</p><p className="font-medium text-sm capitalize">{ocorrenciaSelecionada.responsavel}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Impacto</p><p className="font-medium text-sm">{ocorrenciaSelecionada.impactoFinanceiro > 0 ? fmtFin(ocorrenciaSelecionada.impactoFinanceiro) : "—"}</p></CardContent></Card>
              </div>

              <div>
                <Label>Descrição</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{ocorrenciaSelecionada.descricao}</p>
              </div>

              <div className="flex gap-4">
                {ocorrenciaSelecionada.geraReentrega && (
                  <Badge variant="outline" className="bg-blue-50"><RotateCcw className="w-3 h-3 mr-1" /> Gera Reentrega</Badge>
                )}
                {ocorrenciaSelecionada.geraDevolucao && (
                  <Badge variant="outline" className="bg-orange-50"><ArrowRightLeft className="w-3 h-3 mr-1" /> Gera Devolução</Badge>
                )}
              </div>

              <div>
                <Label>Histórico</Label>
                <div className="space-y-2 mt-1">
                  {ocorrenciaSelecionada.historico.map(h => (
                    <div key={h.id} className="flex gap-2 text-sm p-2 bg-muted rounded">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p>{h.descricao}</p>
                        <p className="text-xs text-muted-foreground">{h.data.toLocaleString("pt-BR")} - {h.responsavel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OcorrenciasLista;
