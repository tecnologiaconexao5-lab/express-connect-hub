import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIPOS_VEICULO } from "@/constants/tiposVeiculo";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/formatDates";
import {
  atualizarValidacaoDocumento,
  calcularAlertaValidade,
  excluirHomologacao,
  listarDocumentosPrestador,
  listarHomologacoes,
  modalidadeLabel,
  MODALIDADES_PRESTACAO,
  salvarHomologacao,
  STATUS_HOMOLOGACAO,
  TIPO_DOCUMENTO_LABEL,
  urlAssinadaDocumento,
  type DocumentoPrestadorApp,
  type ModalidadePrestacao,
  type PrestadorHomologacao,
  type StatusHomologacao,
  type StatusValidacaoDocumento,
} from "@/services/prestadores/homologacaoPrestadorService";

interface Props {
  prestadorId: string;
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

const DOC_STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  vencido: "Vencido",
};

const DOC_STATUS_TONE: Record<string, string> = {
  pendente: "bg-slate-100 text-slate-700 border-slate-200",
  aprovado: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejeitado: "bg-red-100 text-red-700 border-red-200",
  vencido: "bg-red-100 text-red-700 border-red-200",
};

function normalizarStatusDoc(doc: DocumentoPrestadorApp): StatusValidacaoDocumento {
  const valor = String(doc.status_validacao || doc.status || "pendente").toLowerCase();
  if (valor === "aprovado" || valor === "rejeitado" || valor === "vencido") return valor;
  return "pendente";
}

export default function PrestadorHomologacaoTab({ prestadorId }: Props) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoPrestadorApp[]>([]);
  const [homologacoes, setHomologacoes] = useState<PrestadorHomologacao[]>([]);
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<PrestadorHomologacao | null>(null);
  const [modalidade, setModalidade] = useState<ModalidadePrestacao>("entrega_imediata");
  const [clienteId, setClienteId] = useState<string>("todos");
  const [categoriaVeiculo, setCategoriaVeiculo] = useState<string>("");
  const [status, setStatus] = useState<StatusHomologacao>("pendente");
  const [validadeAte, setValidadeAte] = useState<string>("");
  const [requisitos, setRequisitos] = useState<string>("");

  const carregar = useCallback(async () => {
    if (!prestadorId) return;
    setLoading(true);
    try {
      const [docs, homs] = await Promise.all([
        listarDocumentosPrestador(prestadorId),
        listarHomologacoes(prestadorId),
      ]);
      setDocumentos(docs);
      setHomologacoes(homs);
    } finally {
      setLoading(false);
    }
  }, [prestadorId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getUser().then(({ data }) => {
      if (ativo) setAuthUserId(data.user?.id || null);
    });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase.from("clientes").select("id, nome_fantasia, razao_social").limit(500);
      if (!ativo) return;
      setClientes((data || []).map((c: any) => ({ id: c.id, nome: c.nome_fantasia || c.razao_social || c.id })));
    })();
    return () => { ativo = false; };
  }, []);

  const resumo = useMemo(() => {
    const validades = documentos.map((d) => calcularAlertaValidade(d.data_validade || d.data_vencimento || d.validade));
    return {
      docs: documentos.length,
      vencidos: validades.filter((v) => v === "vencido").length,
      vencendo: validades.filter((v) => v === "vencendo").length,
      pendentes: documentos.filter((d) => normalizarStatusDoc(d) === "pendente").length,
      homologados: homologacoes.filter((h) => h.status === "homologado").length,
    };
  }, [documentos, homologacoes]);

  async function visualizarDocumento(doc: DocumentoPrestadorApp) {
    const path = doc.arquivo_path || doc.url;
    if (!path) {
      toast.info("Documento sem arquivo anexado.");
      return;
    }
    const url = await urlAssinadaDocumento(path);
    if (!url) {
      toast.error("Não foi possível gerar a visualização segura do documento.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function validarDocumento(doc: DocumentoPrestadorApp, novoStatus: StatusValidacaoDocumento) {
    try {
      await atualizarValidacaoDocumento({ id: doc.id, status: novoStatus, usuarioId: authUserId });
      toast.success(`Documento ${TIPO_DOCUMENTO_LABEL[doc.tipo_documento || doc.tipo || "outro"] || "documento"} ${DOC_STATUS_LABEL[novoStatus].toLowerCase()}.`);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar o documento.");
    }
  }

  function abrirNovaHomologacao() {
    setEditando(null);
    setModalidade("entrega_imediata");
    setClienteId("todos");
    setCategoriaVeiculo("");
    setStatus("pendente");
    setValidadeAte("");
    setRequisitos("");
    setDialogOpen(true);
  }

  function abrirEdicao(item: PrestadorHomologacao) {
    setEditando(item);
    setModalidade(item.modalidade);
    setClienteId(item.cliente_id || "todos");
    setCategoriaVeiculo(item.categoria_veiculo || "");
    setStatus(item.status);
    setValidadeAte(item.validade_ate || "");
    const req = Array.isArray(item.requisitos_pendentes)
      ? (item.requisitos_pendentes as string[]).join("\n")
      : "";
    setRequisitos(req);
    setDialogOpen(true);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await salvarHomologacao({
        id: editando?.id,
        prestador_id: prestadorId,
        cliente_id: clienteId === "todos" ? null : clienteId,
        modalidade,
        categoria_veiculo: categoriaVeiculo || null,
        status,
        validade_ate: validadeAte || null,
        requisitos_pendentes: requisitos
          .split(/\r?\n/)
          .map((r) => r.trim())
          .filter(Boolean),
        usuarioId: authUserId,
      });
      toast.success("Homologação operacional salva.");
      setDialogOpen(false);
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a homologação.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item: PrestadorHomologacao) {
    if (!window.confirm(`Remover a homologação de ${modalidadeLabel(item.modalidade)}?`)) return;
    try {
      await excluirHomologacao(item.id);
      toast.success("Homologação removida.");
      await carregar();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  if (!prestadorId) {
    return <p className="text-sm text-muted-foreground">Salve o cadastro do prestador parceiro para configurar a homologação.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Resumo label="Documentos" valor={resumo.docs} tone="bg-slate-50 text-slate-800 border-slate-200" />
        <Resumo label="Pendentes" valor={resumo.pendentes} tone="bg-amber-50 text-amber-800 border-amber-200" />
        <Resumo label="Vencendo" valor={resumo.vencendo} tone="bg-orange-50 text-orange-800 border-orange-200" />
        <Resumo label="Vencidos" valor={resumo.vencidos} tone="bg-red-50 text-red-800 border-red-200" alerta={resumo.vencidos > 0} />
        <Resumo label="Modalidades homologadas" valor={resumo.homologados} tone="bg-emerald-50 text-emerald-800 border-emerald-200" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Documentos e validade</CardTitle>
            <CardDescription>Aprove, rejeite e acompanhe o vencimento dos documentos do prestador parceiro.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => void carregar()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Carregando documentos...</div>
          ) : documentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum documento cadastrado para este prestador parceiro.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Emissão</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map((doc) => {
                    const statusDoc = normalizarStatusDoc(doc);
                    const validade = doc.data_validade || doc.data_vencimento || doc.validade;
                    const alerta = calcularAlertaValidade(validade);
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{TIPO_DOCUMENTO_LABEL[doc.tipo_documento || doc.tipo || "outro"] || doc.tipo_documento || doc.tipo || "Documento"}</p>
                          {doc.categoria_cnh && <p className="text-[11px] text-muted-foreground">Categoria CNH: {doc.categoria_cnh}</p>}
                        </TableCell>
                        <TableCell className="text-sm">{doc.numero_documento || "—"}</TableCell>
                        <TableCell className="text-sm">{doc.data_emissao ? formatarDataBR(doc.data_emissao) : "—"}</TableCell>
                        <TableCell>
                          <p className="text-sm">{validade ? formatarDataBR(validade) : "—"}</p>
                          {alerta === "vencido" && <Badge variant="outline" className="mt-1 bg-red-100 text-red-700 border-red-200">Vencido</Badge>}
                          {alerta === "vencendo" && <Badge variant="outline" className="mt-1 bg-amber-100 text-amber-700 border-amber-200">Vence em até 30 dias</Badge>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={DOC_STATUS_TONE[statusDoc]}>{DOC_STATUS_LABEL[statusDoc]}</Badge>
                          {doc.validado_em && <p className="text-[10px] text-muted-foreground mt-1">Validado em {formatarDataHoraBR(doc.validado_em)}</p>}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void visualizarDocumento(doc)}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> Visualizar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-emerald-700" onClick={() => void validarDocumento(doc, "aprovado")}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs text-red-700" onClick={() => void validarDocumento(doc, "rejeitado")}>
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Homologação operacional</CardTitle>
            <CardDescription>Modalidades de prestação, categoria de veículo e cliente específico.</CardDescription>
          </div>
          <Button size="sm" onClick={abrirNovaHomologacao}><Plus className="w-4 h-4 mr-1.5" /> Nova homologação</Button>
        </CardHeader>
        <CardContent>
          {homologacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma modalidade homologada. Inclua a primeira homologação.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modalidade de prestação</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Categoria de veículo</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {homologacoes.map((item) => {
                    const tone = STATUS_HOMOLOGACAO.find((s) => s.value === item.status)?.tone || "";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm font-medium">{modalidadeLabel(item.modalidade)}</TableCell>
                        <TableCell className="text-sm">{item.cliente_nome || "Todos os clientes"}</TableCell>
                        <TableCell className="text-sm">
                          {item.categoria_veiculo
                            ? TIPOS_VEICULO.find((t) => t.value === item.categoria_veiculo)?.label || item.categoria_veiculo
                            : "—"}
                        </TableCell>
                        <TableCell className="text-sm">{item.validade_ate ? formatarDataBR(item.validade_ate) : "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={tone}>
                            {STATUS_HOMOLOGACAO.find((s) => s.value === item.status)?.label || item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => abrirEdicao(item)}>Editar</Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs text-red-700" onClick={() => void remover(item)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="w-5 h-5" /> {editando ? "Editar homologação" : "Nova homologação"}
            </DialogTitle>
            <DialogDescription>Defina a modalidade, o cliente e o status de homologação do prestador parceiro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Modalidade de prestação</Label>
              <Select value={modalidade} onValueChange={(v) => setModalidade(v as ModalidadePrestacao)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODALIDADES_PRESTACAO.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cliente específico (opcional)</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os clientes (homologação geral)</SelectItem>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria de veículo</Label>
              <Select value={categoriaVeiculo || "todas"} onValueChange={(v) => setCategoriaVeiculo(v === "todas" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as categorias</SelectItem>
                  {TIPOS_VEICULO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as StatusHomologacao)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_HOMOLOGACAO.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Validade até</Label>
                <Input type="date" value={validadeAte} onChange={(e) => setValidadeAte(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Requisitos pendentes (um por linha)</Label>
              <Textarea rows={3} value={requisitos} onChange={(e) => setRequisitos(e.target.value)} placeholder={"Ex.: Atualizar CRLV\nEx.: Seguro vencendo"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button onClick={() => void salvar()} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar homologação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Resumo({ label, valor, tone, alerta }: { label: string; valor: number; tone: string; alerta?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
        {alerta && <CalendarClock className="w-3.5 h-3.5" />}
      </div>
      <p className="text-2xl font-bold mt-1">{valor}</p>
    </div>
  );
}
