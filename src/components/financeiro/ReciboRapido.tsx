import { useState, useEffect, useCallback } from "react";
import { Receipt, FileText, Download, Printer, Save, CheckCircle2, History, Eye, XCircle, RotateCcw, RefreshCw, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLogo } from "@/hooks/useLogo";
import { toast } from "sonner";
import {
  criarRecibo,
  cancelarRecibo,
  listarRecibos,
  obterRecibo,
  gerarPDFRecibo,
  abrirPDFRecibo,
  buscarDadosEmpresaParaRecibo,
  valorPorExtenso,
  type Recibo,
  type DadosPDFRecibo,
} from "@/services/financeiro/reciboService";

// ============================================================================
// F0-K — Recibos: persistência real + histórico + PDF oficial.
// Recibo é evidência — não altera DRE/Fluxo/valores financeiros.
// ============================================================================

const fmtBRL = (v: number) => (v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR");

const BLANK = {
  favorecido_tipo: "prestador", nome: "", cpfCnpj: "", valor: 0, descricao: "",
  formaPagamento: "dinheiro", contaFinanceira: "", osNumero: "", observacoes: "",
  dataEmissao: new Date().toISOString().split("T")[0],
};

export default function ReciboRapido() {
  const { getNomeFantasia } = useLogo();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reciboParams, setReciboParams] = useState({ ...BLANK });
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [empresa, setEmpresa] = useState<DadosPDFRecibo | null>(null);
  const [aba, setAba] = useState("emitir");
  const [verRecibo, setVerRecibo] = useState<Recibo | null>(null);
  const [cancelarId, setCancelarId] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [filtros, setFiltros] = useState({ dataInicial: "", dataFinal: "", status: "todos", busca: "" });

  useEffect(() => { buscarDadosEmpresaParaRecibo().then(setEmpresa).catch(() => setEmpresa(null)); }, []);

  const carregarHistorico = useCallback(async () => {
    setLoadingHist(true);
    try {
      const lista = await listarRecibos({
        dataInicial: filtros.dataInicial || undefined,
        dataFinal: filtros.dataFinal || undefined,
        status: filtros.status || undefined,
        busca: filtros.busca || undefined,
      });
      setRecibos(lista);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao carregar histórico de recibos");
    } finally {
      setLoadingHist(false);
    }
  }, [filtros]);

  useEffect(() => { if (aba === "historico") carregarHistorico(); }, [aba, carregarHistorico]);

  const handleGerarRecibo = async () => {
    if (!reciboParams.nome.trim()) return toast.error("Preencha o nome do favorecido.");
    if (!reciboParams.valor || reciboParams.valor <= 0) return toast.error("O valor deve ser maior que zero.");
    if (!reciboParams.descricao.trim()) return toast.error("Adicione a referência/descrição.");

    setIsSubmitting(true);
    try {
      const recibo = await criarRecibo({
        favorecido_tipo: reciboParams.favorecido_tipo,
        favorecido_nome: reciboParams.nome.trim(),
        favorecido_documento: reciboParams.cpfCnpj.trim() || null,
        valor: reciboParams.valor,
        referencia: reciboParams.descricao.trim(),
        forma_pagamento: reciboParams.formaPagamento,
        conta_financeira: reciboParams.contaFinanceira.trim() || null,
        os_numero: reciboParams.osNumero.trim() || null,
        observacoes: reciboParams.observacoes.trim() || null,
        data_emissao: reciboParams.dataEmissao,
      });
      toast.success(`Recibo ${recibo.numero} gerado e persistido com sucesso!`);
      setVerRecibo(recibo);
      setReciboParams({ ...BLANK });
      setAba("historico");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao gerar o recibo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVisualizar = async (id: string) => {
    try {
      const r = await obterRecibo(id);
      setVerRecibo(r);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao buscar recibo");
    }
  };

  const handlePDF = async (r: Recibo) => {
    try {
      const emp = empresa || (await buscarDadosEmpresaParaRecibo());
      await gerarPDFRecibo(r, emp, getNomeFantasia());
      toast.success(`PDF do recibo ${r.numero} gerado`);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar PDF");
    }
  };

  const handleImprimir = async (r: Recibo) => {
    try {
      const emp = empresa || (await buscarDadosEmpresaParaRecibo());
      await abrirPDFRecibo(r, emp, getNomeFantasia());
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir para impressão");
    }
  };

  const handleReemitir = (r: Recibo) => {
    setReciboParams({
      favorecido_tipo: r.favorecido_tipo, nome: r.favorecido_nome, cpfCnpj: r.favorecido_documento || "",
      valor: r.valor, descricao: r.referencia, formaPagamento: r.forma_pagamento || "dinheiro",
      contaFinanceira: r.conta_financeira || "", osNumero: r.os_numero || "", observacoes: r.observacoes || "",
      dataEmissao: new Date().toISOString().split("T")[0],
    });
    setAba("emitir");
    toast.info("Formulário pré-preenchido para reemissão.");
  };

  const handleCancelar = async () => {
    if (!cancelarId) return;
    if (!motivoCancelamento.trim()) return toast.error("Informe o motivo do cancelamento.");
    try {
      await cancelarRecibo(cancelarId, motivoCancelamento);
      toast.success("Recibo cancelado (histórico preservado).");
      setCancelarId(null);
      setMotivoCancelamento("");
      await carregarHistorico();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar recibo");
    }
  };

  const handleLimpar = () => setReciboParams({ ...BLANK });

  const visual = verRecibo;
  const valorExtensoPreview = valorPorExtenso(reciboParams.valor || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" /> Recibos
          </h2>
          <p className="text-sm text-muted-foreground">Emissão persistida, histórico, reimpressão e PDF oficial</p>
        </div>
      </div>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="bg-muted/50 rounded-xl p-1">
          <TabsTrigger value="emitir" className="gap-1.5 text-xs"><FileText className="w-3.5 h-3.5" /> Nova Emissão</TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5 text-xs"><History className="w-3.5 h-3.5" /> Histórico {recibos.length > 0 ? `(${recibos.length})` : ""}</TabsTrigger>
        </TabsList>

        {/* ── NOVA EMISSÃO ─────────────────────────────────────────────────── */}
        <TabsContent value="emitir" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="shadow-md">
              <CardHeader className="border-b bg-card">
                <CardTitle className="text-base">Dados do Recibo</CardTitle>
                <CardDescription>O recibo é persistido e numerado de forma única.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Favorecido</Label>
                    <Select value={reciboParams.favorecido_tipo} onValueChange={(v) => setReciboParams({ ...reciboParams, favorecido_tipo: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cliente">Cliente</SelectItem>
                        <SelectItem value="prestador">Prestador</SelectItem>
                        <SelectItem value="fornecedor">Fornecedor</SelectItem>
                        <SelectItem value="outro">Outro (Avulso)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={reciboParams.formaPagamento} onValueChange={(v) => setReciboParams({ ...reciboParams, formaPagamento: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Nome Completo / Razão Social *</Label>
                  <Input placeholder="Nome impresso no recibo..." className="mt-1" value={reciboParams.nome} onChange={(e) => setReciboParams({ ...reciboParams, nome: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CPF / CNPJ</Label>
                    <Input placeholder="000.000.000-00" className="mt-1" value={reciboParams.cpfCnpj} onChange={(e) => setReciboParams({ ...reciboParams, cpfCnpj: e.target.value })} />
                  </div>
                  <div>
                    <Label>Valor (R$) *</Label>
                    <Input placeholder="0,00" type="number" className="mt-1 font-mono text-lg font-semibold text-primary" value={reciboParams.valor || ""} onChange={(e) => setReciboParams({ ...reciboParams, valor: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label>Referente a (descrição) *</Label>
                  <Textarea placeholder="Ex: Pagamento referente aos serviços de transporte da OS-1029..." className="mt-1 h-20 resize-none" value={reciboParams.descricao} onChange={(e) => setReciboParams({ ...reciboParams, descricao: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>OS / Romaneio (vínculo)</Label>
                    <Input placeholder="Ex: OS-202608-123456" className="mt-1" value={reciboParams.osNumero} onChange={(e) => setReciboParams({ ...reciboParams, osNumero: e.target.value })} />
                  </div>
                  <div>
                    <Label>Conta Financeira</Label>
                    <Input placeholder="Ex: Conta Corrente Principal" className="mt-1" value={reciboParams.contaFinanceira} onChange={(e) => setReciboParams({ ...reciboParams, contaFinanceira: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea placeholder="Informações adicionais..." className="mt-1 h-16 resize-none" value={reciboParams.observacoes} onChange={(e) => setReciboParams({ ...reciboParams, observacoes: e.target.value })} />
                </div>
                <div>
                  <Label>Data de Emissão</Label>
                  <Input type="date" value={reciboParams.dataEmissao} onChange={(e) => setReciboParams({ ...reciboParams, dataEmissao: e.target.value })} className="mt-1" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t bg-muted/20 p-4">
                <Button variant="outline" className="text-muted-foreground" onClick={handleLimpar} disabled={isSubmitting}>Limpar</Button>
                <Button className="bg-primary shadow-md gap-2" onClick={handleGerarRecibo} disabled={isSubmitting}>
                  {isSubmitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando...</> : <><Save className="w-4 h-4" /> Gerar e Persistir</>}
                </Button>
              </CardFooter>
            </Card>

            {/* Pré-visualização */}
            <Card className="bg-muted/30 border border-dashed border-border shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">Pré-visualização do Documento</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center p-6">
                <div className="w-full max-w-sm bg-white rounded-lg shadow border p-6 font-sans text-slate-800">
                  <div className="text-center border-b pb-4 mb-4">
                    <h3 className="font-bold text-xl uppercase tracking-widest text-slate-700">RECIBO</h3>
                    <p className="text-sm text-slate-500">Nº será atribuído ao confirmar</p>
                  </div>
                  <div className="bg-slate-100 p-3 rounded-md mb-6 text-center">
                    <p className="text-sm text-slate-600 font-semibold">Valor</p>
                    <p className="text-2xl font-bold text-slate-800">{fmtBRL(reciboParams.valor || 0)}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{valorExtensoPreview}</p>
                  </div>
                  <p className="text-justify text-sm leading-7">
                    Recebemos de <strong className="border-b border-dotted border-slate-400 inline-block px-2 min-w-[200px] text-center">{reciboParams.nome || "______________________"}</strong>,
                    a importância supra referente a <strong>{reciboParams.descricao || "..."}</strong>.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── HISTÓRICO ───────────────────────────────────────────────────── */}
        <TabsContent value="historico" className="pt-4">
          <Card className="shadow-md">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div className="space-y-1"><Label className="text-xs">Período Inicial</Label><Input type="date" value={filtros.dataInicial} onChange={e => setFiltros(f => ({ ...f, dataInicial: e.target.value }))} className="h-9" /></div>
                <div className="space-y-1"><Label className="text-xs">Período Final</Label><Input type="date" value={filtros.dataFinal} onChange={e => setFiltros(f => ({ ...f, dataFinal: e.target.value }))} className="h-9" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={filtros.status} onValueChange={v => setFiltros(f => ({ ...f, status: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="emitido">Emitido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Nº, favorecido ou referência" value={filtros.busca} onChange={e => setFiltros(f => ({ ...f, busca: e.target.value }))} className="pl-8 h-9" />
                  </div>
                </div>
                <Button size="sm" className="h-9" onClick={carregarHistorico} disabled={loadingHist}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingHist ? "animate-spin" : ""}`} /> Buscar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md mt-4 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-[11px] uppercase pl-4">Número</TableHead>
                    <TableHead className="text-[11px] uppercase">Data</TableHead>
                    <TableHead className="text-[11px] uppercase">Favorecido</TableHead>
                    <TableHead className="text-[11px] uppercase">Documento</TableHead>
                    <TableHead className="text-[11px] uppercase">Referência</TableHead>
                    <TableHead className="text-[11px] uppercase text-right">Valor</TableHead>
                    <TableHead className="text-[11px] uppercase">Status</TableHead>
                    <TableHead className="text-[11px] uppercase text-right pr-4">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingHist ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10"><RefreshCw className="w-5 h-5 animate-spin mx-auto text-primary" /></TableCell></TableRow>
                  ) : recibos.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum recibo encontrado</TableCell></TableRow>
                  ) : recibos.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="pl-4 font-mono text-xs font-bold">{r.numero}</TableCell>
                      <TableCell className="text-xs">{fmtData(r.data_emissao)}</TableCell>
                      <TableCell className="text-xs font-medium max-w-[160px] truncate" title={r.favorecido_nome}>{r.favorecido_nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.favorecido_documento || "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={r.referencia}>{r.referencia}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">{fmtBRL(r.valor)}</TableCell>
                      <TableCell>
                        {r.status === "cancelado"
                          ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Cancelado</Badge>
                          : <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Emitido</Badge>}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500" title="Visualizar" onClick={() => handleVisualizar(r.id)}><Eye className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" title="PDF" onClick={() => handlePDF(r)}><Download className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-cyan-600" title="Imprimir" onClick={() => handleImprimir(r)}><Printer className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" title="Reemitir" onClick={() => handleReemitir(r)}><RotateCcw className="w-3.5 h-3.5" /></Button>
                          {r.status !== "cancelado" && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" title="Cancelar" onClick={() => { setCancelarId(r.id); setMotivoCancelamento(""); }}><XCircle className="w-3.5 h-3.5" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Visualizar recibo */}
      <Dialog open={!!visual} onOpenChange={(o) => !o && setVerRecibo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recibo {visual?.numero}</DialogTitle>
            <DialogDescription>Documento persistido — evidência (não altera financeiro).</DialogDescription>
          </DialogHeader>
          {visual && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-[10px] uppercase text-muted-foreground">Data</p><p className="font-medium">{fmtData(visual.data_emissao)}</p></div>
                <div><p className="text-[10px] uppercase text-muted-foreground">Valor</p><p className="font-bold">{fmtBRL(visual.valor)}</p></div>
              </div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Favorecido</p><p className="font-medium">{visual.favorecido_nome}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Documento</p><p>{visual.favorecido_documento || "-"}</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Referência</p><p>{visual.referencia}</p></div>
              {visual.forma_pagamento && <div><p className="text-[10px] uppercase text-muted-foreground">Forma</p><p>{visual.forma_pagamento}</p></div>}
              {visual.os_numero && <div><p className="text-[10px] uppercase text-muted-foreground">OS/Romaneio</p><p>{visual.os_numero}</p></div>}
              <div><p className="text-[10px] uppercase text-muted-foreground">Valor por extenso</p><p className="text-xs">{visual.valor_extenso}</p></div>
              {visual.status === "cancelado" && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
                  Cancelado em {visual.data_cancelamento ? new Date(visual.data_cancelamento).toLocaleString("pt-BR") : "—"} · {visual.motivo_cancelamento}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setVerRecibo(null)}>Fechar</Button>
            <Button size="sm" onClick={() => visual && handlePDF(visual)}><Download className="w-3.5 h-3.5 mr-1.5" /> PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={!!cancelarId} onOpenChange={(o) => !o && setCancelarId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar Recibo</DialogTitle>
            <DialogDescription>O registro é preservado com status "cancelado". Nenhuma reversão financeira automática.</DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Motivo do cancelamento (obrigatório)" value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} className="h-20" />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCancelarId(null)}>Voltar</Button>
            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleCancelar}>Cancelar Recibo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
