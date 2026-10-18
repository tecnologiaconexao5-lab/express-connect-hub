import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Receipt, Search, RefreshCw, FileText, Eye, Printer,
  ChevronLeft, ChevronRight, Ban, Layers, ArrowDownRight, ExternalLink, Plus,
  Pencil, Trash2, XCircle, Send, CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  listarFaturas,
  buscarFaturaComItens,
  buscarDadosEmpresaParaFatura,
  buscarClienteParaFatura,
  montarInputPdfFatura,
  excluirFaturaManual,
  cancelarFaturaManualEmitida,
  enviarFaturaParaValidacao,
  aprovarFatura,
  emitirFatura,
  type Fatura,
  type FaturaComItens,
} from "@/services/financeiro/faturaService";
import { baixarPDFFatura } from "@/utils/pdfFatura";
import { FaturaPanel } from "./FaturaPanel";
import { FaturaManualDialog } from "./FaturaManualDialog";

const fmtM = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  aguardando_aprovacao: { label: "Aguardando aprovação", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  aprovada: { label: "Aprovada", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  emitida: { label: "Emitida", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelada: { label: "Cancelada", cls: "bg-red-50 text-red-700 border-red-200" },
};

const POR_PAGINA = 15;

export function FaturaLista() {
  const [faturas, setFaturas] = useState<Fatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroNumero, setFiltroNumero] = useState("");
  const [filtroVencInicio, setFiltroVencInicio] = useState("");
  const [filtroVencFim, setFiltroVencFim] = useState("");
  const [filtroRecebimento, setFiltroRecebimento] = useState("");
  const [pagina, setPagina] = useState(1);
  const [faturaDetalhe, setFaturaDetalhe] = useState<FaturaComItens | null>(null);
  const [faturaIdEdicao, setFaturaIdEdicao] = useState<string | null>(null);
  // MICRO-EDICAO-FATURA — modo do painel: "abrir" (workflow/visualização) ou
  // "editar" (clique no lápis → campos do formulário liberados).
  const [modoPainelFatura, setModoPainelFatura] = useState<"abrir" | "editar">("abrir");
  const [clienteNome, setClienteNome] = useState("");
  const [nomesClientes, setNomesClientes] = useState<Record<string, string>>({});
  const [abrirManual, setAbrirManual] = useState(false);
  // TMS-FAT-URG-02 — dialogs profissionais (sem confirm/prompt/alert nativo)
  const [confirmExcluir, setConfirmExcluir] = useState<Fatura | null>(null);
  const [confirmCancelar, setConfirmCancelar] = useState<Fatura | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const lista = await listarFaturas({});
      setFaturas(lista);
      // F38-MANUAL — enriquece o nome do cliente para exibição na lista
      const ids = Array.from(new Set(lista.map((f) => f.cliente_id).filter(Boolean))) as string[];
      if (ids.length > 0) {
        const { data } = await supabase
          .from("clientes")
          .select("id, razao_social, nome_fantasia")
          .in("id", ids);
        const nomes: Record<string, string> = {};
        (data || []).forEach((c) => { nomes[c.id] = c.razao_social || c.nome_fantasia || ""; });
        setNomesClientes(nomes);
      } else {
        setNomesClientes({});
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar faturas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const filtradas = useMemo(() => {
    let r = faturas;
    if (filtroStatus) r = r.filter((f) => f.status === filtroStatus);
    if (filtroCliente) r = r.filter((f) => f.cliente_id === filtroCliente);
    if (filtroNumero) r = r.filter((f) => (f.numero || "").toLowerCase().includes(filtroNumero.toLowerCase()));
    if (filtroVencInicio) r = r.filter((f) => f.vencimento && f.vencimento >= filtroVencInicio);
    if (filtroVencFim) r = r.filter((f) => f.vencimento && f.vencimento <= filtroVencFim);
    if (filtroRecebimento === "pago") r = r.filter((f) => f.conta_receber_id);
    if (filtroRecebimento === "nao_pago") r = r.filter((f) => !f.conta_receber_id);
    return r;
  }, [faturas, filtroStatus, filtroCliente, filtroNumero, filtroVencInicio, filtroVencFim, filtroRecebimento]);

  const paginadas = useMemo(() => {
    const inicio = (pagina - 1) * POR_PAGINA;
    return filtradas.slice(inicio, inicio + POR_PAGINA);
  }, [filtradas, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [filtroStatus, filtroCliente, filtroNumero, filtroVencInicio, filtroVencFim, filtroRecebimento]);

  const abrirDetalhe = async (f: Fatura) => {
    const detalhe = await buscarFaturaComItens(f.id);
    setFaturaDetalhe(detalhe);
  };

  const abrirEdicao = async (f: Fatura, modo: "abrir" | "editar" = "abrir") => {
    const detalhe = await buscarFaturaComItens(f.id);
    if (!detalhe) return;
    const cli = await buscarClienteParaFatura(detalhe.cliente_id || "");
    setClienteNome(cli?.razaoSocial || cli?.nomeFantasia || "");
    const emp = await buscarDadosEmpresaParaFatura();
    void emp;
    setModoPainelFatura(modo);
    setFaturaIdEdicao(detalhe.id);
    setFaturaDetalhe(null);
  };

  // FIN-01.1 — excluir fatura manual (rascunho) — confirmação via AlertDialog
  const confirmarExcluirFatura = async () => {
    const f = confirmExcluir;
    if (!f) return;
    if (f.status !== "rascunho") { setConfirmExcluir(null); return; }
    setProcessando(true);
    const res = await excluirFaturaManual(f.id);
    setProcessando(false);
    setConfirmExcluir(null);
    if (res.error) { toast.error(`Erro ao excluir: ${res.error}`); }
    else { toast.success("Rascunho excluído."); carregar(); }
  };

  // FIN-01.1 — cancelar fatura emitida — confirmação via AlertDialog + motivo
  const confirmarCancelarFatura = async () => {
    const f = confirmCancelar;
    if (!f) return;
    if (f.status !== "emitida") { setConfirmCancelar(null); return; }
    setProcessando(true);
    const res = await cancelarFaturaManualEmitida(f.id, motivoCancelamento || "");
    setProcessando(false);
    setConfirmCancelar(null);
    setMotivoCancelamento("");
    if (res.error) { toast.error(`Erro ao cancelar: ${res.error}`); }
    else { toast.success("Fatura cancelada."); carregar(); }
  };

  // TMS-FAT-URG-02 — validação NÃO emite, NÃO cria AR
  const handleEnviarValidacao = async (f: Fatura) => {
    if (f.status !== "rascunho") return;
    setProcessando(true);
    const res = await enviarFaturaParaValidacao(f.id);
    setProcessando(false);
    if (res.success) { toast.success("Fatura enviada para validação."); carregar(); }
    else { toast.error(res.error || "Erro ao enviar para validação"); }
  };

  // FIN-BUG-03 — Aprovar + Emitir em um clique: a aprovação sai de
  // aguardando_aprovacao -> aprovada e a emissão oficial (f_emitir_fatura)
  // conclui -> emitida gerando o Nº Conexão, o nº do cliente e a Conta a
  // Receber. Sem emissão a fatura continuaria sem número ("Rascunho" na lista).
  // Se a emissão falhar, a fatura permanece APROVADA e o usuário finaliza
  // pelo painel ("Revisar e emitir").
  const handleAprovar = async (f: Fatura) => {
    if (f.status !== "aguardando_aprovacao") return;
    setProcessando(true);
    const res = await aprovarFatura(f.id);
    if (!res.success) {
      setProcessando(false);
      toast.error(res.error || "Erro ao aprovar fatura");
      return;
    }
    const em = await emitirFatura(f.id);
    setProcessando(false);
    if (em.success && em.numero) {
      toast.success(`Fatura aprovada e emitida — Nº ${em.numero}.`);
    } else if (em.success) {
      toast.success("Fatura aprovada e emitida.");
    } else {
      toast.error(
        `Aprovada, mas não foi possível emitir: ${em.error || "erro desconhecido"}. ` +
        'Finalize pela ação "Revisar e emitir".'
      );
    }
    carregar();
  };

  const baixarPdf = async (f: Fatura) => {
    const detalhe = await buscarFaturaComItens(f.id);
    if (!detalhe) return;
    const emp = await buscarDadosEmpresaParaFatura();
    const cli = await buscarClienteParaFatura(detalhe.cliente_id || "");
    // F38-MANUAL — montador oficial aplica número manual + snapshot de conta
    const pdf = montarInputPdfFatura(detalhe, emp, cli);
    await baixarPDFFatura(pdf);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="py-3 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#F97316]" />
                Faturas
              </CardTitle>
              <CardDescription className="text-[11px]">
                {filtradas.length} fatura(s) · origem oficial faturas + fatura_itens
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C]" onClick={() => setAbrirManual(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Nova Fatura Manual
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={carregar}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Número</Label>
              <Input className="h-8 text-xs" placeholder="FAT-..." value={filtroNumero} onChange={(e) => setFiltroNumero(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Status</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Recebimento</Label>
              <Select value={filtroRecebimento} onValueChange={setFiltroRecebimento}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Com título (receber)</SelectItem>
                  <SelectItem value="nao_pago">Sem título</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Venc. inicial</Label>
              <Input type="date" className="h-8 text-xs" value={filtroVencInicio} onChange={(e) => setFiltroVencInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Venc. final</Label>
              <Input type="date" className="h-8 text-xs" value={filtroVencFim} onChange={(e) => setFiltroVencFim(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[9px] text-muted-foreground">Cliente (ID)</Label>
              <Input className="h-8 text-xs" placeholder="uuid" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button size="sm" variant="outline" className="h-8 text-xs w-full" onClick={() => setFiltroNumero("")}>
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : erro ? (
        <Card><CardContent className="py-8 text-center"><p className="text-red-500 text-sm">{erro}</p></CardContent></Card>
      ) : paginadas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma fatura encontrada</p>
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/60">
                  <TableHead className="text-[10px] uppercase">Nº Conexão</TableHead>
                  <TableHead className="text-[10px] uppercase">Nº Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase">Cliente</TableHead>
                  <TableHead className="text-[10px] uppercase">Emissão</TableHead>
                  <TableHead className="text-[10px] uppercase">Período</TableHead>
                  <TableHead className="text-[10px] uppercase">Vencimento</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Qtd</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase">Status</TableHead>
                  <TableHead className="text-[10px] uppercase">Recebimento</TableHead>
                  <TableHead className="text-[10px] uppercase text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer hover:bg-slate-50/60" onClick={() => abrirDetalhe(f)}>
                    <TableCell className="text-xs font-bold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        {/* FIN-BUG-03 — só o rascunho se chama "Rascunho"; sem número
                            oficial fora dele o estado real é "aguardando emissão". */}
                        <span>{f.metadata?.numeroManual || f.numero || (f.status === "rascunho" ? "Rascunho" : "Sem Nº oficial")}</span>
                        {f.metadata?.origem === "manual" ? (
                          <span className="inline-flex items-center rounded border border-[#F97316]/30 bg-[#F97316]/10 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-[#F97316]">Manual</span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-slate-400">Automática</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-slate-700">
                      {f.numero_cliente != null ? String(f.numero_cliente) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-xs max-w-[160px] truncate" title={f.cliente_id ? (nomesClientes[f.cliente_id] || "") : ""}>
                      {f.cliente_id ? (nomesClientes[f.cliente_id] || "—") : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{fmtData(f.data_emissao)}</TableCell>
                    <TableCell className="text-xs">
                      {f.competencia_inicio && f.competencia_fim ? `${fmtData(f.competencia_inicio)} a ${fmtData(f.competencia_fim)}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{fmtData(f.vencimento)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{/* qtd via detalhe */}</TableCell>
                    <TableCell className="text-xs text-right font-bold tabular-nums text-orange-600">{fmtM(f.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_LABEL[f.status]?.cls || "bg-slate-100"}>
                        {STATUS_LABEL[f.status]?.label || f.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {f.conta_receber_id ? <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">Título vinculado</Badge> : <span className="text-[10px] text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Detalhe" onClick={() => abrirDetalhe(f)}><Eye className="w-3.5 h-3.5" /></Button>
                        {/* Rascunho: editar, enviar para validação, PDF, excluir */}
                        {f.status === "rascunho" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Editar rascunho" onClick={() => abrirEdicao(f, "editar")}><Pencil className="w-3.5 h-3.5 text-blue-600" /></Button>
                        )}
                        {f.status === "rascunho" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Enviar para validação (não emite)" disabled={processando} onClick={() => handleEnviarValidacao(f)}><Send className="w-3.5 h-3.5 text-[#F97316]" /></Button>
                        )}
                        {f.status === "rascunho" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Excluir rascunho" onClick={() => setConfirmExcluir(f)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        )}
                        {/* Aguardando aprovação: abrir + aprovar */}
                        {f.status === "aguardando_aprovacao" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Abrir fatura" onClick={() => abrirEdicao(f)}><FileText className="w-3.5 h-3.5 text-[#F97316]" /></Button>
                        )}
                        {f.status === "aguardando_aprovacao" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Aprovar e emitir (gera Nº oficial e Conta a Receber)" disabled={processando} onClick={() => handleAprovar(f)}><CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /></Button>
                        )}
                        {/* Aprovada: abrir para emitir */}
                        {f.status === "aprovada" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Revisar e emitir" onClick={() => abrirEdicao(f)}><Printer className="w-3.5 h-3.5 text-emerald-600" /></Button>
                        )}
                        {/* Emitida: PDF, editar metadados, cancelar */}
                        {f.status === "emitida" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="PDF" onClick={() => baixarPdf(f)}><Printer className="w-3.5 h-3.5" /></Button>
                        )}
                        {f.status === "emitida" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Editar fatura emitida" onClick={() => abrirEdicao(f, "editar")}><Pencil className="w-3.5 h-3.5 text-emerald-600" /></Button>
                        )}
                        {f.status === "emitida" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Cancelar fatura emitida" onClick={() => setConfirmCancelar(f)}><XCircle className="w-3.5 h-3.5" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between p-3 border-t">
              <p className="text-[11px] text-muted-foreground">Mostrando {paginadas.length} de {filtradas.length}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-xs text-muted-foreground">Pág. {pagina}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={pagina * POR_PAGINA >= filtradas.length} onClick={() => setPagina(pagina + 1)}><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detalhe da fatura */}
      {faturaDetalhe && (
        <FaturaDetalheModal
          fatura={faturaDetalhe}
          onClose={() => setFaturaDetalhe(null)}
          onBaixarPdf={() => baixarPdf(faturaDetalhe)}
          onEditar={() => { abrirEdicao(faturaDetalhe, "editar"); }}
        />
      )}

      {/* Edição/continuação de rascunho */}
      {faturaIdEdicao && (
        <FaturaPanel
          open={!!faturaIdEdicao}
          onOpenChange={(o) => { if (!o) { setFaturaIdEdicao(null); } }}
          itens={[]}
          clienteNome={clienteNome}
          faturaId={faturaIdEdicao}
          modo={modoPainelFatura}
          onEmitida={() => { setFaturaIdEdicao(null); carregar(); }}
        />
      )}

      {/* F38-MANUAL — Nova Fatura Manual */}
      <FaturaManualDialog
        open={abrirManual}
        onOpenChange={setAbrirManual}
        onFaturaSalva={() => { setAbrirManual(false); carregar(); }}
      />

      {/* TMS-FAT-URG-02 — confirmações profissionais (sem confirm/prompt nativo) */}
      <AlertDialog open={!!confirmExcluir} onOpenChange={(o) => { if (!o) setConfirmExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Excluir rascunho?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Excluir o rascunho {String((confirmExcluir?.metadata as Record<string, unknown> | undefined)?.numeroManual || confirmExcluir?.numero || "")}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={processando} className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); confirmarExcluirFatura(); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmCancelar} onOpenChange={(o) => { if (!o) { setConfirmCancelar(null); setMotivoCancelamento(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold">Cancelar fatura emitida?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Cancelar a fatura {confirmCancelar?.numero || ""} também cancela a Conta a Receber vinculada (quando não paga) e libera os serviços para novo faturamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label className="text-[11px]">Motivo do cancelamento (opcional)</Label>
            <Input className="h-9 text-xs mt-1" value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} placeholder="Ex.: erro de valores" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Voltar</AlertDialogCancel>
            <AlertDialogAction disabled={processando} className="bg-red-600 hover:bg-red-700" onClick={(e) => { e.preventDefault(); confirmarCancelarFatura(); }}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FaturaDetalheModal({
  fatura, onClose, onBaixarPdf, onEditar,
}: {
  fatura: FaturaComItens;
  onClose: () => void;
  onBaixarPdf: () => void;
  onEditar: () => void;
}) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fd = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
  };
  const Linha = ({ label, valor }: { label: string; valor: React.ReactNode }) => (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{valor}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center"><Receipt className="w-4 h-4 text-[#F97316]" /></div>
            <div>
              <p className="text-sm font-bold">Fatura {fatura.numero || "Rascunho"}</p>
              <p className="text-[11px] text-muted-foreground">{fatura.itens.length} serviço(s) · {fmt(fatura.valor_total)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-[11px]" onClick={onBaixarPdf}><Printer className="w-3.5 h-3.5 mr-1" /> PDF</Button>
            {fatura.status === "rascunho" && (
              <Button variant="outline" size="sm" className="h-8 text-[11px] text-[#F97316]" onClick={onEditar}><FileText className="w-3.5 h-3.5 mr-1" /> Continuar</Button>
            )}
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}><Search className="w-0 h-0" />X</Button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg border bg-slate-50/60 p-3">
            <Linha label="Status" valor={<Badge variant="outline" className={STATUS_LABEL[fatura.status]?.cls}>{STATUS_LABEL[fatura.status]?.label || fatura.status}</Badge>} />
            <Linha label="Emissão" valor={fd(fatura.data_emissao)} />
            <Linha label="Vencimento" valor={fd(fatura.vencimento)} />
          </div>
          <div className="rounded-lg border bg-slate-50/60 p-3">
            <Linha label="Subtotal" valor={fmt(fatura.valor_bruto)} />
            <Linha label="Descontos" valor={`- ${fmt(fatura.descontos)}`} />
            <Linha label="Acréscimos" valor={fmt(fatura.acrescimos)} />
            <Linha label="TOTAL" valor={<span className="text-orange-600 font-extrabold">{fmt(fatura.valor_total)}</span>} />
          </div>
          <div className="rounded-lg border bg-slate-50/60 p-3">
            <Linha label="Conta a Receber" valor={fatura.conta_receber_id ? <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700">Vinculado</Badge> : <span className="text-slate-400">—</span>} />
            <Linha label="Observação" valor={fatura.observacao || "—"} />
          </div>
        </div>
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Serviços incluídos</p>
          <table className="w-full text-xs border rounded-lg">
            <thead><tr className="bg-slate-100 text-left"><th className="p-2">Data</th><th className="p-2">Romaneio/OC</th><th className="p-2">Descrição</th><th className="p-2 text-right">Valor</th></tr></thead>
            <tbody>
              {fatura.itens.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-2">{fd(i.data_servico)}</td>
                  <td className="p-2">{i.romaneio || "—"}</td>
                  <td className="p-2">{i.descricao || "Serviço"}</td>
                  <td className="p-2 text-right font-semibold">{fmt(i.valor_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FaturaLista;
