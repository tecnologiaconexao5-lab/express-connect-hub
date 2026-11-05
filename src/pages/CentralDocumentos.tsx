import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Upload,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FolderOpen,
  Eye,
  Download,
  ShieldCheck,
  Building2,
  Users,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PaginationBar from "@/components/ui/PaginationBar";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatarDataHoraBR } from "@/lib/formatDates";
import { DocumentoAcoesDropdown } from "@/components/documentos/DocumentoAcoesDropdown";
import { DocumentoUploadUniversal } from "@/components/documentos/DocumentoUploadUniversal";
import { DocumentoIAReportModal } from "@/components/documentos/DocumentoIAReportModal";
import { DocumentoHistoricoModal } from "@/components/documentos/DocumentoHistoricoModal";
import { DocumentoCompartilharModal } from "@/components/documentos/DocumentoCompartilharModal";
import { DocumentoNovaVersaoDialog } from "@/components/documentos/DocumentoNovaVersaoDialog";
import { FiltrosAtivos, type FiltroAtivoItem } from "@/components/ui/filtros-ativos";
import {
  analisarDocumentoComIA,
  atualizarAnaliseDocumentoMetadata,
  baixarDocumentoMetadata,
  CATEGORIAS_DOCUMENTO,
  enviarDocumentoOperacional,
  excluirDocumentoMetadata,
  listarDocumentosCentral,
  listarOpcoesFiltrosDocumentos,
  registrarEventoDocumento,
  STATUS_IA_CLASSE,
  STATUS_IA_LABEL,
  urlAssinadaDocumentoMetadata,
  type CategoriaDocumento,
  type DocumentoMetadata,
  type OpcoesFiltrosDocumentos,
  type RelatorioIA,
} from "@/services/documentos/documentosMetadataService";

const PAGE_SIZE = 12;

const STATUS_OPCOES = [
  "aprovado_na_conferencia",
  "aprovado_com_ressalvas",
  "necessita_de_correcao",
  "aguardando_conferencia_humana",
  "pendente",
  "processando",
  "erro",
] as const;

const MODULO_POR_CATEGORIA: Record<CategoriaDocumento, string> = {
  Comercial: "comercial",
  Operacional: "operacional",
  Financeiro: "financeiro",
  Recrutamento: "recrutamento",
  Administrativo: "administrativo",
};

const formatarTamanho = (bytes?: number | null) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const StatusBadge = ({ doc }: { doc: DocumentoMetadata }) => (
  <Badge className={`whitespace-nowrap border text-[10px] font-bold uppercase ${STATUS_IA_CLASSE[doc.status_ia]}`}>
    {STATUS_IA_LABEL[doc.status_ia]}
  </Badge>
);

export default function CentralDocumentosPage() {
  const [documentos, setDocumentos] = useState<DocumentoMetadata[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesFiltrosDocumentos>({ departamentos: [], entidades: [], responsaveis: [] });
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({
    nome: "",
    categoria: "todas",
    departamento: "",
    entidade: "",
    responsavel: "",
    dataInicio: "",
    dataFim: "",
    statusIa: "todos",
  });
  const [page, setPage] = useState(1);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [salvandoUpload, setSalvandoUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    nome: "",
    tipo: "Outros",
    categoria: "Operacional" as CategoriaDocumento,
    departamento: "",
    entidadeNome: "",
    responsavel: "",
    descricao: "",
  });

  const [iaDoc, setIaDoc] = useState<DocumentoMetadata | null>(null);
  const [iaOpen, setIaOpen] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaResultado, setIaResultado] = useState<RelatorioIA | null>(null);

  const [historyDoc, setHistoryDoc] = useState<DocumentoMetadata | null>(null);
  const [shareDoc, setShareDoc] = useState<DocumentoMetadata | null>(null);
  const [versionDoc, setVersionDoc] = useState<DocumentoMetadata | null>(null);
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionModo, setVersionModo] = useState<"nova" | "atualizar">("nova");
  const [deleteDoc, setDeleteDoc] = useState<DocumentoMetadata | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const { user } = useAuth();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const lista = await listarDocumentosCentral({
        nome: filtros.nome,
        categoria: filtros.categoria,
        departamento: filtros.departamento,
        entidade: filtros.entidade,
        responsavel: filtros.responsavel,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        statusIa: filtros.statusIa,
        limite: 500,
      });
      setDocumentos(lista);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    const timer = setTimeout(() => { void carregar(); }, 350);
    return () => clearTimeout(timer);
  }, [carregar]);

  useEffect(() => {
    void listarOpcoesFiltrosDocumentos().then(setOpcoes);
  }, []);

  const kpis = useMemo(() => {
    const total = documentos.length;
    const aprovados = documentos.filter((d) => d.status_ia === "aprovado_na_conferencia").length;
    const ressalvas = documentos.filter((d) => d.status_ia === "aprovado_com_ressalvas" || d.status_ia === "com_ressalvas").length;
    const correcao = documentos.filter((d) => d.status_ia === "necessita_de_correcao").length;
    const aguardando = documentos.filter(
      (d) => d.status_ia === "pendente" || d.status_ia === "aguardando_conferencia_humana",
    ).length;
    return { total, aprovados, ressalvas, correcao, aguardando };
  }, [documentos]);

  const pageData = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return documentos.slice(from, from + PAGE_SIZE);
  }, [documentos, page]);

  const limparFiltros = () => {
    setFiltros({
      nome: "",
      categoria: "todas",
      departamento: "",
      entidade: "",
      responsavel: "",
      dataInicio: "",
      dataFim: "",
      statusIa: "todos",
    });
  };

  const abrirUpload = () => {
    setUploadFile(null);
    setUploadForm({
      nome: "",
      tipo: "Outros",
      categoria: "Operacional",
      departamento: "",
      entidadeNome: "",
      responsavel: "",
      descricao: "",
    });
    setUploadOpen(true);
  };

  const enviarUpload = async () => {
    if (!uploadFile) {
      toast.error("Selecione o arquivo do documento.");
      return;
    }
    if (!uploadForm.nome.trim()) {
      toast.error("Informe o nome do documento.");
      return;
    }
    try {
      setSalvandoUpload(true);
      await enviarDocumentoOperacional({
        file: uploadFile,
        moduloOrigem: MODULO_POR_CATEGORIA[uploadForm.categoria],
        entidadeId: null,
        entidadeNome: uploadForm.entidadeNome.trim() || null,
        tipo: uploadForm.tipo.trim() || "Outros",
        nome: uploadForm.nome.trim(),
        categoria: uploadForm.categoria,
        departamento: uploadForm.departamento.trim() || null,
        responsavel: uploadForm.responsavel.trim() || null,
        descricao: uploadForm.descricao.trim() || null,
      });
      toast.success("Documento enviado para a Central.");
      setUploadOpen(false);
      await carregar();
      void listarOpcoesFiltrosDocumentos().then(setOpcoes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar o documento.");
    } finally {
      setSalvandoUpload(false);
    }
  };

  const abrirIA = async (doc: DocumentoMetadata) => {
    setIaDoc(doc);
    setIaResultado(null);
    setIaOpen(true);
    setIaLoading(true);
    try {
      const url = await urlAssinadaDocumentoMetadata(doc.url, doc.entidade_id);
      const relatorio = await analisarDocumentoComIA({
        url: url ?? doc.url,
        nome: doc.nome,
        tipo: doc.tipo,
        moduloOrigem: doc.modulo_origem,
        entidadeId: doc.entidade_id,
      });
      setIaResultado(relatorio);
      const atualizado = await atualizarAnaliseDocumentoMetadata(doc.id, relatorio);
      if (atualizado) {
        setDocumentos((prev) => prev.map((d) => (d.id === doc.id ? atualizado : d)));
        setIaDoc(atualizado);
      }
    } catch {
      toast.error("Não foi possível analisar o documento com IA.");
    } finally {
      setIaLoading(false);
    }
  };

  const abrirVersao = (doc: DocumentoMetadata, modo: "nova" | "atualizar") => {
    setVersionDoc(doc);
    setVersionModo(modo);
    setVersionOpen(true);
  };

  const visualizarDocumento = async (doc: DocumentoMetadata) => {
    try {
      const url = await urlAssinadaDocumentoMetadata(doc.url, doc.entidade_id);
      if (!url) {
        toast.error("Não foi possível gerar o link seguro deste documento.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      void registrarEventoDocumento(doc.id, {
        tipo: "visualizacao",
        descricao: "Documento visualizado.",
      });
    } catch {
      toast.error("Erro ao visualizar o documento.");
    }
  };

  const baixarDocumento = async (doc: DocumentoMetadata) => {
    try {
      await baixarDocumentoMetadata(doc);
      void registrarEventoDocumento(doc.id, {
        tipo: "download",
        descricao: "Documento baixado.",
      });
    } catch {
      toast.error("Erro ao baixar o documento.");
    }
  };

  const gerarNovaVersaoDaIA = () => {
    if (!iaDoc) return;
    setIaOpen(false);
    abrirVersao(iaDoc, "nova");
  };

  const confirmarExclusao = async () => {
    if (!deleteDoc) return;
    setExcluindo(true);
    try {
      await excluirDocumentoMetadata(deleteDoc);
      toast.success("Documento excluído.");
      setDeleteDoc(null);
      await carregar();
      void listarOpcoesFiltrosDocumentos().then(setOpcoes);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o documento.");
    } finally {
      setExcluindo(false);
    }
  };

  const filtrosAtivos: FiltroAtivoItem[] = [];
  if (filtros.nome.trim()) {
    filtrosAtivos.push({
      id: "nome",
      label: "Nome",
      valor: filtros.nome.trim(),
      onRemove: () => setFiltros((f) => ({ ...f, nome: "" })),
    });
  }
  if (filtros.categoria !== "todas") {
    filtrosAtivos.push({
      id: "categoria",
      label: "Categoria",
      valor: filtros.categoria,
      onRemove: () => setFiltros((f) => ({ ...f, categoria: "todas" })),
    });
  }
  if (filtros.departamento.trim()) {
    filtrosAtivos.push({
      id: "departamento",
      label: "Departamento",
      valor: filtros.departamento.trim(),
      onRemove: () => setFiltros((f) => ({ ...f, departamento: "" })),
    });
  }
  if (filtros.entidade.trim()) {
    filtrosAtivos.push({
      id: "entidade",
      label: "Entidade",
      valor: filtros.entidade.trim(),
      onRemove: () => setFiltros((f) => ({ ...f, entidade: "" })),
    });
  }
  if (filtros.responsavel.trim()) {
    filtrosAtivos.push({
      id: "responsavel",
      label: "Responsável",
      valor: filtros.responsavel.trim(),
      onRemove: () => setFiltros((f) => ({ ...f, responsavel: "" })),
    });
  }
  if (filtros.dataInicio) {
    filtrosAtivos.push({
      id: "dataInicio",
      label: "De",
      valor: filtros.dataInicio,
      onRemove: () => setFiltros((f) => ({ ...f, dataInicio: "" })),
    });
  }
  if (filtros.dataFim) {
    filtrosAtivos.push({
      id: "dataFim",
      label: "Até",
      valor: filtros.dataFim,
      onRemove: () => setFiltros((f) => ({ ...f, dataFim: "" })),
    });
  }
  if (filtros.statusIa !== "todos") {
    filtrosAtivos.push({
      id: "statusIa",
      label: "Status",
      valor: STATUS_IA_LABEL[filtros.statusIa],
      onRemove: () => setFiltros((f) => ({ ...f, statusIa: "todos" })),
    });
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <FolderOpen className="h-6 w-6 text-primary" /> Central de Documentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Documentos operacionais integrados ao Supabase Storage e à análise de conformidade.
          </p>
        </div>
        <Button onClick={abrirUpload} className="gap-2">
          <Upload className="h-4 w-4" /> Novo documento
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card><CardContent className="p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p><p className="text-2xl font-black">{kpis.total}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600"><CheckCircle2 className="h-3 w-3" /> Aprovados</p><p className="text-2xl font-black text-emerald-700">{kpis.aprovados}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600"><AlertTriangle className="h-3 w-3" /> Ressalvas</p><p className="text-2xl font-black text-amber-700">{kpis.ressalvas}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-600"><XCircle className="h-3 w-3" /> Correção</p><p className="text-2xl font-black text-rose-700">{kpis.correcao}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-violet-600"><Clock className="h-3 w-3" /> Aguardando</p><p className="text-2xl font-black text-violet-700">{kpis.aguardando}</p></CardContent></Card>
      </div>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Filter className="h-4 w-4 text-primary" />
              </span>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                  Filtros combinados
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Refine por nome, categoria, departamento, período ou status de verificação.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {filtrosAtivos.length > 0
                ? `${filtrosAtivos.length} filtro(s) ativo(s)`
                : "Nenhum filtro aplicado"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                  value={filtros.nome}
                  onChange={(e) => setFiltros((f) => ({ ...f, nome: e.target.value }))}
                  placeholder="Nome do documento"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <Select value={filtros.categoria} onValueChange={(v) => setFiltros((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger className="h-10 bg-background focus-visible:ring-2 focus-visible:ring-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {CATEGORIAS_DOCUMENTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Departamento</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  list="central-doc-departamentos"
                  value={filtros.departamento}
                  onChange={(e) => setFiltros((f) => ({ ...f, departamento: e.target.value }))}
                  placeholder="Todos"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              <datalist id="central-doc-departamentos">
                {opcoes.departamentos.map((d) => <option key={d} value={d} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cliente / Entidade</Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  list="central-doc-entidades"
                  value={filtros.entidade}
                  onChange={(e) => setFiltros((f) => ({ ...f, entidade: e.target.value }))}
                  placeholder="Todos"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              <datalist id="central-doc-entidades">
                {opcoes.entidades.map((e) => <option key={e} value={e} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  list="central-doc-responsaveis"
                  value={filtros.responsavel}
                  onChange={(e) => setFiltros((f) => ({ ...f, responsavel: e.target.value }))}
                  placeholder="Todos"
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
              <datalist id="central-doc-responsaveis">
                {opcoes.responsaveis.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data inicial</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros((f) => ({ ...f, dataInicio: e.target.value }))}
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data final</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros((f) => ({ ...f, dataFim: e.target.value }))}
                  className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status de Verificação</Label>
              <Select value={filtros.statusIa} onValueChange={(v) => setFiltros((f) => ({ ...f, statusIa: v }))}>
                <SelectTrigger className="h-10 bg-background focus-visible:ring-2 focus-visible:ring-primary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {STATUS_OPCOES.map((s) => <SelectItem key={s} value={s}>{STATUS_IA_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <FiltrosAtivos filtros={filtrosAtivos} onLimpar={limparFiltros} className="pt-1" />

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-3">
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => void carregar()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[220px]">Documento</TableHead>
                  <TableHead>Categoria / Departamento</TableHead>
                  <TableHead>Cliente / Entidade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status de Verificação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />Carregando documentos...</TableCell></TableRow>
                ) : pageData.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">Nenhum documento encontrado com os filtros atuais.</TableCell></TableRow>
                ) : pageData.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{doc.nome || doc.tipo || "Documento"}</p>
                          <p className="text-[11px] text-muted-foreground">{doc.tipo || "Sem tipo"} · {formatarTamanho(doc.tamanho_bytes)}</p>
                          {doc.descricao && <p className="truncate text-[11px] text-muted-foreground">{doc.descricao}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{doc.categoria}</p>
                      <p className="text-[11px] text-muted-foreground">{doc.departamento || "—"}</p>
                    </TableCell>
                    <TableCell className="text-sm">{doc.entidade_nome || "—"}</TableCell>
                    <TableCell className="text-sm">{doc.responsavel || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatarDataHoraBR(doc.data_inclusao)}</TableCell>
                    <TableCell><Badge variant="outline">v{doc.versao}</Badge></TableCell>
                    <TableCell><StatusBadge doc={doc} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Visualizar"
                          onClick={() => void visualizarDocumento(doc)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Baixar"
                          onClick={() => void baixarDocumento(doc)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => void abrirIA(doc)}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Conformidade
                        </Button>
                        <DocumentoAcoesDropdown
                          documento={doc}
                          onNovaVersao={(d) => abrirVersao(d, "nova")}
                          onAtualizarVersao={(d) => abrirVersao(d, "atualizar")}
                          onAnalisarIA={(d) => void abrirIA(d)}
                          onCompartilhar={setShareDoc}
                          onHistorico={setHistoryDoc}
                          onExcluir={
                            user?.role === "super_admin" || user?.role === "admin"
                              ? setDeleteDoc
                              : undefined
                          }
                          ocultarVisualizarBaixar
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaginationBar
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={documentos.length}
        onPageChange={setPage}
        loading={loading}
      />

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" /> Novo documento</DialogTitle>
            <DialogDescription>Envie diretamente ao bucket `documentos_operacionais` com os metadados da Central.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <DocumentoUploadUniversal
              disabled={salvandoUpload}
              onFile={(file) => {
                setUploadFile(file);
                setUploadForm((f) => ({ ...f, nome: f.nome || file.name }));
              }}
              label={uploadFile ? uploadFile.name : "Envie o documento"}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>Nome *</Label><Input value={uploadForm.nome} onChange={(e) => setUploadForm((f) => ({ ...f, nome: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Tipo</Label><Input value={uploadForm.tipo} onChange={(e) => setUploadForm((f) => ({ ...f, tipo: e.target.value }))} placeholder="CNH, CRLV, Contrato..." /></div>
              <div className="space-y-1">
                <Label>Categoria *</Label>
                <Select value={uploadForm.categoria} onValueChange={(v) => setUploadForm((f) => ({ ...f, categoria: v as CategoriaDocumento }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS_DOCUMENTO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Departamento</Label><Input value={uploadForm.departamento} onChange={(e) => setUploadForm((f) => ({ ...f, departamento: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Cliente / Entidade</Label><Input value={uploadForm.entidadeNome} onChange={(e) => setUploadForm((f) => ({ ...f, entidadeNome: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Responsável</Label><Input value={uploadForm.responsavel} onChange={(e) => setUploadForm((f) => ({ ...f, responsavel: e.target.value }))} /></div>
              <div className="space-y-1 md:col-span-2"><Label>Descrição</Label><Textarea rows={3} value={uploadForm.descricao} onChange={(e) => setUploadForm((f) => ({ ...f, descricao: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUploadOpen(false)} disabled={salvandoUpload}>Cancelar</Button>
            <Button onClick={() => void enviarUpload()} disabled={salvandoUpload || !uploadFile} className="gap-1.5">
              {salvandoUpload ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {salvandoUpload ? "Enviando..." : "Enviar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentoIAReportModal
        open={iaOpen}
        onOpenChange={setIaOpen}
        documento={iaDoc}
        resultado={iaResultado}
        loading={iaLoading}
        onReanalisar={iaDoc ? () => { void abrirIA(iaDoc); } : undefined}
        onGerarNovaVersao={iaDoc ? gerarNovaVersaoDaIA : undefined}
      />
      <DocumentoHistoricoModal open={Boolean(historyDoc)} onOpenChange={(v) => { if (!v) setHistoryDoc(null); }} documento={historyDoc} />
      <DocumentoCompartilharModal open={Boolean(shareDoc)} onOpenChange={(v) => { if (!v) setShareDoc(null); }} documento={shareDoc} />
      <DocumentoNovaVersaoDialog
        open={versionOpen}
        onOpenChange={setVersionOpen}
        documento={versionDoc}
        modo={versionModo}
        onConcluido={() => { void carregar(); void listarOpcoesFiltrosDocumentos().then(setOpcoes); }}
      />

      <Dialog open={Boolean(deleteDoc)} onOpenChange={(aberto) => { if (!aberto && !excluindo) setDeleteDoc(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" /> Excluir documento
            </DialogTitle>
            <DialogDescription>
              Esta ação remove o metadado e tenta apagar o arquivo do Storage. Disponível apenas para
              administradores.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
            <p className="font-semibold">{deleteDoc?.nome || deleteDoc?.tipo || "Documento"}</p>
            <p className="mt-1 text-xs font-mono break-all">{deleteDoc?.url}</p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={excluindo}
              onClick={() => setDeleteDoc(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={excluindo}
              onClick={() => void confirmarExclusao()}
            >
              {excluindo ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
