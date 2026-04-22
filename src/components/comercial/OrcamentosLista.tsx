import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Filter, FileText, Eye, Edit, Copy, CheckCircle, XCircle, FileDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { mockOrcamentos } from "./mockOrcamentos";
import { Orcamento, OrcamentoStatus, STATUS_CONFIG } from "./types";
import OrcamentoForm from "./OrcamentoForm";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { gerarPdfOrcamento } from "./orcamentoPdf";
import { toOrcamentoInsert } from "@/lib/dbMappers";

const ITEMS_PER_PAGE = 8;

const OrcamentosLista = () => {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroResponsavel, setFiltroResponsavel] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [pagina, setPagina] = useState(1);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<Orcamento | null>(null);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [dialogReprovar, setDialogReprovar] = useState<Orcamento | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState("");

  const responsaveis = [...new Set(orcamentos.map((o) => o.responsavel))];
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchOrcamentos();

    if (searchParams.get("action") === "novo") {
      setModoForm("novo");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const fetchOrcamentos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("orcamentos").select("*, orcamento_enderecos(*)").order("numero", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        setOrcamentos(data);
      } else {
        // Fallback for visual demonstration when db is empty
        setOrcamentos(mockOrcamentos);
      }
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao carregar orçamentos.");
      setOrcamentos(mockOrcamentos);
    } finally {
      setIsLoading(false);
    }
  };

  const filtrados = orcamentos.filter((o) => {
    const matchBusca = !busca || o.numero.toLowerCase().includes(busca.toLowerCase()) || o.cliente.toLowerCase().includes(busca.toLowerCase()) || o.clienteCnpj.includes(busca);
    const matchStatus = filtroStatus === "todos" || o.status === filtroStatus;
    const matchResp = filtroResponsavel === "todos" || o.responsavel === filtroResponsavel;

    let matchPeriodo = true;
    if (filtroPeriodo !== "todos") {
      const hoje = new Date();
      const dataOrc = new Date(o.dataEmissao);
      if (filtroPeriodo === "hoje") {
        matchPeriodo = dataOrc.toDateString() === hoje.toDateString();
      } else if (filtroPeriodo === "semana") {
        const umaSemanaAtras = new Date(hoje);
        umaSemanaAtras.setDate(hoje.getDate() - 7);
        matchPeriodo = dataOrc >= umaSemanaAtras && dataOrc <= hoje;
      } else if (filtroPeriodo === "mes") {
        const umMesAtras = new Date(hoje);
        umMesAtras.setMonth(hoje.getMonth() - 1);
        matchPeriodo = dataOrc >= umMesAtras && dataOrc <= hoje;
      }
    }

    return matchBusca && matchStatus && matchResp && matchPeriodo;
  });

  const totalPaginas = Math.ceil(filtrados.length / ITEMS_PER_PAGE);
  const paginados = filtrados.slice((pagina - 1) * ITEMS_PER_PAGE, pagina * ITEMS_PER_PAGE);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleAprovar = async (orc: Orcamento) => {
    try {
      const historicoAtualizado = [...orc.historico, { data: new Date().toLocaleString("pt-BR"), acao: "Aprovado", usuario: "Usuário atual" }];
      const res = await saveToSupabase({ ...orc, status: "aprovado" as OrcamentoStatus, historico: historicoAtualizado }, false);
      if (res) toast.success("Orçamento Aprovado!");
    } catch {
      toast.error("Erro ao aprovar.");
    }
  };

  const handleReprovar = async () => {
    if (!dialogReprovar) return;
    try {
      const historicoAtualizado = [...dialogReprovar.historico, { data: new Date().toLocaleString("pt-BR"), acao: `Reprovado: ${motivoReprovacao}`, usuario: "Usuário atual" }];
      const res = await saveToSupabase({ ...dialogReprovar, status: "reprovado" as OrcamentoStatus, historico: historicoAtualizado, motivoReprovacao }, false);
      if (res) {
        toast.success("Orçamento Reprovado.");
        setDialogReprovar(null);
        setMotivoReprovacao("");
      }
    } catch {
      toast.error("Erro ao reprovar.");
    }
  };

  const handleDuplicar = async (orc: Orcamento) => {
    const novoNumero = `ORC-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const novo: Orcamento = { ...JSON.parse(JSON.stringify(orc)), id: String(Date.now()), numero: novoNumero, status: "rascunho", dataEmissao: new Date().toISOString().split("T")[0], historico: [{ data: new Date().toLocaleString("pt-BR"), acao: `Duplicado de ${orc.numero}`, usuario: "Usuário atual" }] };
    await saveToSupabase(novo, true);
  };

  const saveToSupabase = async (orc: Orcamento, isNew: boolean) => {
    try {
      const dbPayload = toOrcamentoInsert(orc);
      let error = null;

      if (isNew) {
        const result = await supabase.from("orcamentos").insert([dbPayload]).select();
        error = result.error;
      } else {
        const result = await supabase.from("orcamentos").update(dbPayload).eq("id", orc.id).select();
        error = result.error;
      }

      if (error) {
        console.error("[saveToSupabase] Erro ao salvar:", error.message, error.details);
        toast.error(`Erro ao salvar: ${error.message}`);
        return false;
      }

      fetchOrcamentos();
      toast.success(isNew ? "Orçamento criado com sucesso!" : "Orçamento atualizado!");
      return true;

    } catch (e: any) {
      console.error("[saveToSupabase] Exceção:", e);
      toast.error("Erro inesperado ao salvar o orçamento.");
      return false;
    }
  };

  const handleSalvar = async (orc: Orcamento) => {
    await saveToSupabase(orc, modoForm === "novo");
    setModoForm(null);
    setOrcamentoSelecionado(null);
  };


  if (modoForm && (orcamentoSelecionado || modoForm === "novo")) {
    return (
      <OrcamentoForm
        orcamento={modoForm === "novo" ? undefined : orcamentoSelecionado!}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setOrcamentoSelecionado(null); }}
        onSalvar={handleSalvar}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">Gestão de propostas comerciais</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => { setOrcamentoSelecionado(null); setModoForm("novo"); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, cliente ou CNPJ..." value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} className="pl-9" />
            </div>
            <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); setPagina(1); }}>
              <SelectTrigger className="w-[160px]"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroResponsavel} onValueChange={(v) => { setFiltroResponsavel(v); setPagina(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginados.map((orc) => (
                <TableRow key={orc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setOrcamentoSelecionado(orc); setModoForm("ver"); }}>
                  <TableCell className="font-medium text-primary">{orc.numero}</TableCell>
                  <TableCell>{orc.cliente}</TableCell>
                  <TableCell>{new Date(orc.dataEmissao).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{new Date(orc.validade).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-semibold">{fmt(orc.valores.valorFinal)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[orc.status].color}`}>
                      {STATUS_CONFIG[orc.status].label}
                    </span>
                  </TableCell>
                  <TableCell>{orc.responsavel}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar" onClick={() => { setOrcamentoSelecionado(orc); setModoForm("ver"); }}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setOrcamentoSelecionado(orc); setModoForm("editar"); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar PDF" onClick={() => gerarPdfOrcamento(orc)}><FileDown className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicar(orc)}><Copy className="w-4 h-4" /></Button>
                      {(orc.status === "enviado" || orc.status === "em_analise") && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Aprovar" onClick={() => handleAprovar(orc)}><CheckCircle className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Reprovar" onClick={() => setDialogReprovar(orc)}><XCircle className="w-4 h-4" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginados.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum orçamento encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtrados.length} orçamento(s) encontrado(s)</p>
          <div className="flex gap-1">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <Button key={i} variant={pagina === i + 1 ? "default" : "outline"} size="sm" onClick={() => setPagina(i + 1)}>{i + 1}</Button>
            ))}
          </div>
        </div>
      )}

      {/* Reprovar Dialog */}
      <Dialog open={!!dialogReprovar} onOpenChange={() => setDialogReprovar(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprovar Orçamento {dialogReprovar?.numero}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo da reprovação:</p>
            <Textarea value={motivoReprovacao} onChange={(e) => setMotivoReprovacao(e.target.value)} placeholder="Motivo da reprovação..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogReprovar(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReprovar} disabled={!motivoReprovacao.trim()}>Confirmar Reprovação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrcamentosLista;
