import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Plus, Search, Eye, Clock, RotateCcw, ArrowRightLeft, Upload, X } from "lucide-react";
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
import { toast } from "sonner";
import { listarOcorrencias, criarOcorrencia, atualizarStatusOcorrencia, type OcorrenciaTMS } from "@/services/ocorrenciaService";

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

const OcorrenciasLista = () => {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaTMS[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [showModal, setShowModal] = useState(false);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [ocorrenciaSelecionada, setOcorrenciaSelecionada] = useState<OcorrenciaTMS | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [novaOcorrencia, setNovaOcorrencia] = useState({
    os_id: "",
    tipo: "",
    descricao: "",
    prioridade: "media",
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const dados = await listarOcorrencias({
        busca: busca || undefined,
        tipo: filtroTipo !== "todos" ? filtroTipo : undefined,
        status: filtroStatus !== "todos" ? filtroStatus : undefined,
      });
      setOcorrencias(dados);
    } catch (err: any) {
      setErro(err.message || "Erro ao carregar ocorrências");
    } finally {
      setLoading(false);
    }
  }, [busca, filtroTipo, filtroStatus]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "aberta": case "pendente": return <Badge className="bg-red-100 text-red-800 border border-red-200">Aberta</Badge>;
      case "em_analise": case "analise": case "tratativa": return <Badge className="bg-orange-100 text-orange-800 border border-orange-200">Em Análise</Badge>;
      case "resolvida": case "fechada": return <Badge className="bg-green-100 text-green-800 border border-green-200">Resolvida</Badge>;
      case "encerrada": return <Badge variant="outline" className="text-slate-500 border-slate-300 bg-slate-50">Encerrada</Badge>;
      default: return <Badge variant="outline">{s}</Badge>;
    }
  };

  const getTipoLabel = (tipo: string) => {
    const t = tiposOcorrencia.find(tp => tp.value === tipo);
    return t?.label || tipo;
  };

  const filteredOcorrencias = ocorrencias.filter(o => {
    if (busca) {
      const termo = busca.toLowerCase();
      const matchOS = (o.os_numero || "").toLowerCase().includes(termo);
      const matchDesc = (o.descricao || "").toLowerCase().includes(termo);
      const matchCliente = (o.cliente_nome || "").toLowerCase().includes(termo);
      if (!matchOS && !matchDesc && !matchCliente) return false;
    }
    return true;
  });

  const abrirDetalhe = (oc: OcorrenciaTMS) => {
    setOcorrenciaSelecionada(oc);
    setShowDetalhe(true);
  };

  const handleSalvar = async () => {
    if (!novaOcorrencia.tipo || !novaOcorrencia.descricao) {
      toast.error("Preencha tipo e descrição");
      return;
    }
    setSalvando(true);
    try {
      const result = await criarOcorrencia({
        tipo: novaOcorrencia.tipo,
        descricao: novaOcorrencia.descricao,
        prioridade: novaOcorrencia.prioridade,
        os_id: novaOcorrencia.os_id || undefined,
      });
      if (result.sucesso) {
        toast.success("Ocorrência registrada com sucesso!");
        setShowModal(false);
        setNovaOcorrencia({ os_id: "", tipo: "", descricao: "", prioridade: "media" });
        await carregar();
      } else {
        toast.error(result.erro || "Erro ao salvar ocorrência");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const handleAtualizarStatus = async (id: string, novoStatus: string) => {
    setAtualizando(id);
    try {
      const result = await atualizarStatusOcorrencia(id, novoStatus);
      if (result.sucesso) {
        toast.success(`Ocorrência ${novoStatus === "resolvida" ? "resolvida" : novoStatus === "em_analise" ? "em análise" : "atualizada"} com sucesso`);
        if (showDetalhe) {
          const atualizada = ocorrencias.find(o => o.id === id);
          if (atualizada) {
            setOcorrenciaSelecionada({ ...atualizada, status: novoStatus });
          }
        }
        await carregar();
      } else {
        toast.error(result.erro || "Erro ao atualizar status");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    } finally {
      setAtualizando(null);
    }
  };

  const fmtData = (data: string) => {
    try { return new Date(data).toLocaleString("pt-BR"); } catch { return data; }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por OS, cliente ou descrição..."
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
              <SelectItem value="em_analise">Em Análise</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
              <SelectItem value="encerrada">Encerrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-red-600 hover:bg-red-700 text-white shadow-sm" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Lançar Ocorrência
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm">Carregando ocorrências...</p>
            </div>
          ) : erro ? (
            <div className="text-center py-12">
              <p className="text-red-500 text-sm mb-2">{erro}</p>
              <Button variant="outline" size="sm" onClick={carregar}>Tentar novamente</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOcorrencias.map((oc) => (
                  <TableRow key={oc.id} className="hover:bg-red-50/20 transition">
                    <TableCell className="font-bold text-slate-800">{oc.os_numero || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{oc.cliente_nome || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                        {getTipoLabel(oc.tipo)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtData(oc.created_at)}</TableCell>
                    <TableCell>{getStatusBadge(oc.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => abrirDetalhe(oc)} title="Detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        {oc.status === "aberta" || oc.status === "pendente" ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-orange-500" onClick={() => handleAtualizarStatus(oc.id, "em_analise")} disabled={atualizando === oc.id} title="Iniciar análise">
                            <Clock className="w-4 h-4" />
                          </Button>
                        ) : null}
                        {oc.status === "em_analise" || oc.status === "analise" || oc.status === "tratativa" ? (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={() => handleAtualizarStatus(oc.id, "resolvida")} disabled={atualizando === oc.id} title="Resolver">
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOcorrencias.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      Nenhuma ocorrência encontrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
              <Label>OS Vinculada (opcional)</Label>
              <Input
                placeholder="ID da OS"
                value={novaOcorrencia.os_id}
                onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, os_id: e.target.value })}
                className="mt-1"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Insira o UUID da OS, ou deixe em branco</p>
            </div>
            <div>
              <Label>Tipo de Ocorrência</Label>
              <Select value={novaOcorrencia.tipo} onValueChange={(v) => setNovaOcorrencia({ ...novaOcorrencia, tipo: v })}>
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
                value={novaOcorrencia.descricao}
                onChange={(e) => setNovaOcorrencia({ ...novaOcorrencia, descricao: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={novaOcorrencia.prioridade} onValueChange={(v) => setNovaOcorrencia({ ...novaOcorrencia, prioridade: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={salvando}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleSalvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar Ocorrência"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet Detalhes */}
      <Sheet open={showDetalhe} onOpenChange={setShowDetalhe}>
        <SheetContent className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Detalhes da Ocorrência
            </SheetTitle>
            <SheetDescription>
              {ocorrenciaSelecionada && (
                <span>{getTipoLabel(ocorrenciaSelecionada.tipo)} — {ocorrenciaSelecionada.os_numero || "OS não vinculada"}</span>
              )}
            </SheetDescription>
          </SheetHeader>

          {ocorrenciaSelecionada && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Status</p>{getStatusBadge(ocorrenciaSelecionada.status)}</CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Data</p><p className="font-medium text-sm">{fmtData(ocorrenciaSelecionada.created_at)}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Cliente</p><p className="font-medium text-sm">{ocorrenciaSelecionada.cliente_nome || "—"}</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">Prioridade</p><p className="font-medium text-sm capitalize">{ocorrenciaSelecionada.prioridade}</p></CardContent></Card>
              </div>

              <div>
                <Label>Descrição</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded whitespace-pre-wrap">{ocorrenciaSelecionada.descricao}</p>
              </div>

              <div className="flex gap-2 pt-2">
                {ocorrenciaSelecionada.status === "aberta" || ocorrenciaSelecionada.status === "pendente" ? (
                  <Button
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => handleAtualizarStatus(ocorrenciaSelecionada.id, "em_analise")}
                    disabled={atualizando === ocorrenciaSelecionada.id}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    {atualizando === ocorrenciaSelecionada.id ? "Atualizando..." : "Iniciar Análise"}
                  </Button>
                ) : null}
                {ocorrenciaSelecionada.status === "em_analise" || ocorrenciaSelecionada.status === "analise" || ocorrenciaSelecionada.status === "tratativa" ? (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleAtualizarStatus(ocorrenciaSelecionada.id, "resolvida")}
                    disabled={atualizando === ocorrenciaSelecionada.id}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {atualizando === ocorrenciaSelecionada.id ? "Atualizando..." : "Resolver Ocorrência"}
                  </Button>
                ) : null}
                {ocorrenciaSelecionada.status === "resolvida" ? (
                  <Button
                    className="flex-1 bg-slate-500 hover:bg-slate-600 text-white"
                    onClick={() => handleAtualizarStatus(ocorrenciaSelecionada.id, "encerrada")}
                    disabled={atualizando === ocorrenciaSelecionada.id}
                  >
                    <X className="w-4 h-4 mr-2" />
                    {atualizando === ocorrenciaSelecionada.id ? "Atualizando..." : "Encerrar"}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OcorrenciasLista;
