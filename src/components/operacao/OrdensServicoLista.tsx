import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Filter, Edit, Eye, AlertTriangle, Truck, MapPin, Trash2, Calendar, Clock, ChevronDown, CheckCircle2, Navigation, LocateFixed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { OrdemServico, OSStatus, STATUS_CORES } from "./osTypes";
import OrdemServicoForm from "./OrdemServicoForm";
import OrdemServicoPreview from "./OrdemServicoPreview";
import { fromOSRow, OSRow } from "@/lib/dbMappers";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OrdensServicoLista = () => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [osPreview, setOsPreview] = useState<OrdemServico | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filtros
  const [showFiltros, setShowFiltros] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [filtroTipoVeiculo, setFiltroTipoVeiculo] = useState("todos");
  const [filtroTipoCarga, setFiltroTipoCarga] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  
  // Rastreamento
  const [showRastreamento, setShowRastreamento] = useState(false);
  const [osRastreamento, setOsRastreamento] = useState<OrdemServico | null>(null);
  
  // Exclusão
  const [osParaExcluir, setOsParaExcluir] = useState<OrdemServico | null>(null);
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    fetchOrdens();
    if (searchParams.get("action") === "novo") {
      setModoForm("novo");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get("status")) {
      setFiltroStatus(searchParams.get("status") || "todos");
    }
  }, [searchParams]);

  const fetchOrdens = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("ordens_servico")
        .select("*, clientes(nome_fantasia, razao_social)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        if (error.code === "42P01") {
          setOrdens([]);
          return;
        }
        throw error;
      }
      if (data && data.length > 0) {
        const normalizados = (data as any[]).map((item) => {
          const os = fromOSRow(item);
          return {
            ...os,
            cliente: item.clientes?.nome_fantasia || item.clientes?.razao_social || os.cliente || "Cliente não informado"
          };
        });
        setOrdens(normalizados as OrdemServico[]);
      } else {
        setOrdens([]);
      }
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao buscar ordens de serviço.");
      setOrdens([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSalvar = () => {
    setModoForm(null);
    setOsSelecionada(null);
    fetchOrdens();
  };

  const isAtrasada = (os: OrdemServico) => {
    if (os.status === "finalizada" || os.status === "cancelada") return false;
    const dateStr = os.previsaoTermino || os.data;
    if (!dateStr) return false;
    try {
      return new Date(dateStr).getTime() < new Date().getTime();
    } catch {
      return false;
    }
  };

  const safeFormatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "—";
      return format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const filtradas = ordens.filter(os => {
    const searchLower = busca.toLowerCase();
    const matchBusca = 
      os.numero.toLowerCase().includes(searchLower) || 
      (os.cliente || "").toLowerCase().includes(searchLower) ||
      (os.prestador || "").toLowerCase().includes(searchLower) ||
      (os.veiculoPlaca || "").toLowerCase().includes(searchLower);

    const matchStatus = filtroStatus === "todos" || os.status === filtroStatus;
    const matchCliente = filtroCliente === "todos" || os.cliente === filtroCliente;
    const matchTipo = filtroTipo === "todos" || os.tipoOperacao === filtroTipo;
    const matchTipoVeiculo = filtroTipoVeiculo === "todos" || (os.veiculoTipo || "").toLowerCase() === (filtroTipoVeiculo || "todos").toLowerCase();
    const matchTipoCarga = filtroTipoCarga === "todos" || (os.carga?.tipo || "") === filtroTipoCarga;
    
    // Filtro de período
    let matchPeriodo = true;
    if (filtroPeriodo !== "todos") {
      const dataOS = new Date(os.data);
      if (isNaN(dataOS.getTime())) return false;
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      if (filtroPeriodo === "hoje") {
        matchPeriodo = dataOS >= hoje;
      } else if (filtroPeriodo === "ontem") {
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);
        matchPeriodo = dataOS >= ontem && dataOS < hoje;
      } else if (filtroPeriodo === "semana") {
        const umaSemanaAtras = new Date(hoje);
        umaSemanaAtras.setDate(hoje.getDate() - 7);
        matchPeriodo = dataOS >= umaSemanaAtras;
      } else if (filtroPeriodo === "mes") {
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        matchPeriodo = dataOS >= inicioMes;
      } else if (filtroPeriodo === "personalizado" && dataInicio && dataFim) {
        const dIni = new Date(dataInicio);
        const dFim = new Date(dataFim);
        dFim.setHours(23, 59, 59, 999);
        matchPeriodo = dataOS >= dIni && dataOS <= dFim;
      }
    }

    return matchBusca && matchStatus && matchCliente && matchTipo && matchPeriodo && matchTipoVeiculo && matchTipoCarga;
  });

  const handleDelete = async () => {
    if (!osParaExcluir) return;
    
    const senhaCorreta = import.meta.env.VITE_ADMIN_DELETE_PASSWORD || "admin123";
    
    if (senhaAdmin !== senhaCorreta) {
      toast.error("Senha administrativa incorreta.");
      return;
    }

    try {
      setExcluindo(true);
      const { error } = await supabase.from("ordens_servico").delete().eq("id", osParaExcluir.id);
      if (error) throw error;
      
      toast.success(`OS ${osParaExcluir.numero} excluída com sucesso.`);
      setOsParaExcluir(null);
      setSenhaAdmin("");
      fetchOrdens();
    } catch (e: any) {
      toast.error("Erro ao excluir OS: " + e.message);
    } finally {
      setExcluindo(false);
    }
  };

  const clientesDisponiveis = Array.from(new Set(ordens.map(o => o.cliente).filter(Boolean)));

  if (modoForm) {
    return (
      <OrdemServicoForm
        os={osSelecionada || undefined}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setOsSelecionada(null); fetchOrdens(); }}
        onSalvar={handleSalvar}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Ordens de Serviço</h2>
          <p className="text-sm text-muted-foreground">{filtradas.length} OS encontrada(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowFiltros(!showFiltros)} className={showFiltros ? "bg-muted" : ""}>
            <Filter className="w-4 h-4 mr-1" /> Filtros
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setModoForm("novo")}>
            <Plus className="w-4 h-4 mr-1" /> Nova OS
          </Button>
        </div>
      </div>

      {showFiltros && (
        <Card className="border-orange-100 shadow-sm animate-in slide-in-from-top duration-200">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  {Object.entries(STATUS_CORES).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cliente</Label>
              <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Clientes</SelectItem>
                  {clientesDisponiveis.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Veículo</Label>
              <Select value={filtroTipoVeiculo} onValueChange={setFiltroTipoVeiculo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todos os Veículos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Veículos</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                  <SelectItem value="carro_passeio">Carro Passeio</SelectItem>
                  <SelectItem value="fiorino">Fiorino</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="vuc">VUC</SelectItem>
                  <SelectItem value="tres_quartos">3/4</SelectItem>
                  <SelectItem value="toco">Toco</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Carga</Label>
              <Select value={filtroTipoCarga} onValueChange={setFiltroTipoCarga}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as Cargas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Cargas</SelectItem>
                  <SelectItem value="Seca">Seca</SelectItem>
                  <SelectItem value="Refrigerada">Refrigerada</SelectItem>
                  <SelectItem value="Congelada">Congelada</SelectItem>
                  <SelectItem value="Mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Operação</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todas as Operações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Operações</SelectItem>
                  <SelectItem value="Coleta e Entrega">Coleta e Entrega</SelectItem>
                  <SelectItem value="Apenas Coleta">Apenas Coleta</SelectItem>
                  <SelectItem value="Apenas Entrega">Apenas Entrega</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Dedicado">Dedicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Período</Label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Todo o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo o período</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="semana">Últimos 7 dias</SelectItem>
                  <SelectItem value="mes">Este mês</SelectItem>
                  <SelectItem value="personalizado">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtroPeriodo === "personalizado" && (
              <div className="md:col-span-4 grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Inicial</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Data Final</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
                </div>
              </div>
            )}
            <div className="flex items-end">
              <Button variant="ghost" size="sm" className="text-xs text-orange-600 h-9" onClick={() => {
                setFiltroStatus("todos");
                setFiltroCliente("todos");
                setFiltroPeriodo("todos");
                setFiltroTipo("todos");
                setFiltroTipoVeiculo("todos");
                setFiltroTipoCarga("todos");
                setBusca("");
              }}>Limpar Filtros</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, cliente, prestador, placa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9 h-10" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold">Nº OS</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Rota</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Tipo Veículo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Carga</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Prestador / Placa</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Status</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold">Prazo</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12">Carregando ordens de serviço...</TableCell></TableRow>
                ) : filtradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-20">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="w-10 h-10 opacity-20" />
                        <p className="font-medium">Nenhuma Ordem de Serviço encontrada.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtradas.map(os => {
                  const atrasada = isAtrasada(os);
                  const comOcorrencia = os.status === "ocorrencia";
                  
                  return (
                    <TableRow key={os.id} className="hover:bg-muted/30 transition-colors group">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-1.5 font-bold text-sm">
                          {comOcorrencia && <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                          {os.numero}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Calendar className="w-3 h-3" /> {safeFormatDate(os.data)}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="font-semibold text-sm">{os.cliente || "—"}</div>
                         <div className="text-[10px] text-muted-foreground uppercase tracking-tight">{os.tipoOperacao || "Transporte"}</div>
                      </TableCell>
<TableCell>
                         <div className="flex items-center gap-1 text-sm font-medium">
                           <MapPin className="w-3.5 h-3.5 text-primary"/> 
                           <span className="truncate max-w-[150px]">{os.unidade || "Rota Padrão"}</span>
                         </div>
                       </TableCell>
                       <TableCell>
                         <div className="text-xs font-semibold">{os.veiculoTipo || "—"}</div>
                       </TableCell>
                       <TableCell>
                         <div className="text-xs font-semibold">{os.carga?.tipo || "Seca"}</div>
                         <div className="text-[10px] text-muted-foreground truncate max-w-[100px]">{os.carga?.descricao || "—"}</div>
                       </TableCell>
                       <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="w-7 h-7 border border-muted shadow-sm">
                            <AvatarFallback className="text-[9px] font-bold bg-primary/5 text-primary">
                              {os.prestador ? os.prestador[0] : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{os.prestador || "Pendente"}</span>
                            <span className="text-[10px] font-bold text-orange-600">{os.veiculoPlaca || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_CORES[os.status]?.twClass || "bg-gray-100 text-gray-800"} text-[9px] uppercase font-bold py-0.5 px-2`}>
                          {STATUS_CORES[os.status]?.label || os.status}
                        </Badge>
                        {(os.dataProgramada || os.previsaoInicio) && (
                          <div className="mt-1 flex items-center gap-0.5 text-[9px] font-bold text-blue-600 uppercase">
                            <Clock className="w-2.5 h-2.5" /> Agendado
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`text-sm font-medium ${atrasada ? 'text-red-600' : ''}`}>
                          {os.previsaoTermino ? safeFormatDate(os.previsaoTermino) : "Sem prazo"}
                        </div>
                        {atrasada && <span className="text-[9px] font-bold text-red-500 uppercase">Atrasada</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600" title="Rastreamento" onClick={(e) => { e.stopPropagation(); setOsRastreamento(os); setShowRastreamento(true); }}>
                            <LocateFixed className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" title="Visualizar" onClick={() => { setOsPreview(os); setShowPreview(true); }}>
                            <Eye className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-orange-50 hover:text-orange-600" title="Editar" onClick={() => { setOsSelecionada(os); setModoForm("editar"); }}>
                            <Edit className="w-4 h-4"/>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" title="Excluir" onClick={() => setOsParaExcluir(os)}>
                            <Trash2 className="w-4 h-4 text-red-400"/>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Confirmação Exclusão */}
      <Dialog open={!!osParaExcluir} onOpenChange={() => { setOsParaExcluir(null); setSenhaAdmin(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a excluir a <strong>OS {osParaExcluir?.numero}</strong>. Esta ação é irreversível e removerá todos os históricos e vínculos financeiros.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Senha Administrativa</Label>
              <Input 
                type="password" 
                placeholder="Digite a senha para autorizar" 
                value={senhaAdmin}
                onChange={(e) => setSenhaAdmin(e.target.value)}
                className="focus-visible:ring-red-500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOsParaExcluir(null); setSenhaAdmin(""); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!senhaAdmin || excluindo}>
              {excluindo ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Rastreamento */}
      <Dialog open={showRastreamento} onOpenChange={setShowRastreamento}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5 text-blue-500" /> Rastreamento em Tempo Real
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center animate-pulse">
              <LocateFixed className="w-8 h-8 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h4 className="font-bold">OS {osRastreamento?.numero}</h4>
              <p className="text-sm text-muted-foreground px-4">
                Rastreamento em tempo real ainda não disponível para este prestador. Aguardando integração com o aplicativo Conexão Express para habilitar telemetria.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowRastreamento(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Preview OS */}
      <Dialog open={showPreview} onOpenChange={(open) => { if (!open) { setShowPreview(false); setOsPreview(null); } }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" /> Visualização da Ordem de Serviço
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {osPreview && <OrdemServicoPreview os={osPreview} onVoltar={() => { setShowPreview(false); setOsPreview(null); }} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdensServicoLista;
