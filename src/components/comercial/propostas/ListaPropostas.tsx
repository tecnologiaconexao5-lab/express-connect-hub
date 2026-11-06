import { useState, useMemo, useEffect } from "react";
import { 
  Search, Plus, FileText, Star, Copy, Edit, Trash2, LayoutTemplate, Briefcase, 
  ChevronDown, Filter, CalendarDays, BarChart, Tags, Grid3X3, List, Bookmark, 
  Clock, Archive, Download, Share2, Eye, MoreHorizontal, Palette, RefreshCw,
  Building2, Presentation, Table2, FileCheck, FileX, Check, X, Image, Wand2,
  Save, Send, Upload, type LucideIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SafeImage } from "@/components/ui/safe-image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validarArquivoAnexo } from "@/lib/anexoDocumento";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockPropostas } from "./mockPropostas";
import { gerarPDFProfissional } from "@/utils/pdfGenerator";
import { DocumentoUploadUniversal } from "@/components/documentos/DocumentoUploadUniversal";
import { enviarDocumentoOperacional } from "@/services/documentos/documentosMetadataService";
import { resolverContatoProposta } from "@/services/comercial/propostaContatoService";
import { FiltrosAtivos, type FiltroAtivoItem } from "@/components/ui/filtros-ativos";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface ListaPropostasProps {
  onNovaProposta: (tipo: "modelo" | "personalizada", originModelo?: Proposta) => void;
  onEditar: (proposta: Proposta) => void;
}

type Categoria = "todas" | "institucionais" | "comerciais" | "tabelas" | "apresentacoes" | "modelos" | "personalizadas" | "favoritas" | "recentes" | "guardadas" | "arquivadas";
type Visualizacao = "lista" | "cards" | "biblioteca";
type FiltroRapido = "todos" | "padrao" | "personalizado" | "institucional" | "comercial" | "tabela" | "apresentacao" | "favorito" | "recente" | "guardada" | "exportada" | "ativo" | "arquivado";

interface Proposta {
  id: string;
  titulo: string;
  subtitulo: string;
  tipo: "modelo" | "personalizada";
  cliente: string | null;
  segmento: string;
  tipoServico: string;
  status: "rascunho" | "enviada" | "aprovada" | "rejeitada" | "expirada";
  favorita: boolean;
  arquivada: boolean;
  guardadaNaBiblioteca: boolean;
  dataGuardada: string | null;
  totalExportacoes: number;
  ultimaExportacaoEm: string | null;
  origemDaGuardada: string | null;
  categoria: string;
  responsavel: string;
  versao: number;
  visualizacoes: number;
  tags: string[];
  capaCustomizada?: string;
  logoCliente?: string;
  corDestaque?: string;
  criadoEm: string;
  atualizadoEm: string;
  modeloOrigemId?: string;
  clienteId?: string | null;
  leadId?: string | null;
  telefone?: string | null;
  ultimoDocumentoId?: string | null;
  ultimoDocumentoNome?: string | null;
  historico: { data: string; acao: string; usuario: string }[];
}

const categorias: { value: Categoria; label: string; icon: LucideIcon }[] = [
  { value: "todas", label: "Todas", icon: FileText },
  { value: "guardadas", label: "Guardadas", icon: Save },
  { value: "institucionais", label: "Institucionais", icon: Building2 },
  { value: "comerciais", label: "Comerciais", icon: Briefcase },
  { value: "tabelas", label: "Tabelas", icon: Table2 },
  { value: "apresentacoes", label: "Apresentações", icon: Presentation },
  { value: "modelos", label: "Modelos Base", icon: LayoutTemplate },
  { value: "personalizadas", label: "Personalizadas", icon: Bookmark },
  { value: "favoritas", label: "Favoritas", icon: Star },
  { value: "recentes", label: "Recentes", icon: Clock },
  { value: "arquivadas", label: "Arquivadas", icon: Archive },
];

const filtrosRapidos: { value: FiltroRapido; label: string }[] = [
  { value: "todos", label: "Todas" },
  { value: "padrao", label: "Padrão" },
  { value: "personalizado", label: "Personalizado" },
  { value: "institucional", label: "Institucional" },
  { value: "comercial", label: "Comercial" },
  { value: "tabela", label: "Tabela" },
  { value: "apresentacao", label: "Apresentação" },
  { value: "favorito", label: "Favorito" },
  { value: "recente", label: "Recente" },
  { value: "guardada", label: "Guardada" },
  { value: "exportada", label: "Exportada" },
  { value: "ativo", label: "Ativo" },
  { value: "arquivado", label: "Arquivado" },
];

const getStatusColor = (status: string) => {
  const colors: Record<string, { bg: string; text: string; label: string }> = {
    rascunho: { bg: "bg-slate-100", text: "text-slate-700", label: "Rascunho" },
    enviada: { bg: "bg-blue-100", text: "text-blue-700", label: "Enviada" },
    aprovada: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Aprovada" },
    rejeitada: { bg: "bg-red-100", text: "text-red-700", label: "Rejeitada" },
    expirada: { bg: "bg-amber-100", text: "text-amber-700", label: "Expirada" },
  };
  return colors[status] || { bg: "bg-gray-100", text: "text-gray-700", label: status };
};

const getCategoriaProposta = (p: Proposta): Categoria => {
  if (p.arquivada) return "arquivadas";
  if (p.guardadaNaBiblioteca) return "guardadas";
  if (p.favorita) return "favoritas";
  if (p.tipo === "personalizada") {
    if (p.cliente) return "personalizadas";
  }
  if (p.tipo === "modelo") {
    if (p.subtitulo?.toLowerCase().includes("institucional")) return "institucionais";
    if (p.subtitulo?.toLowerCase().includes("tabela")) return "tabelas";
    if (p.subtitulo?.toLowerCase().includes("apresentação")) return "apresentacoes";
    return "comerciais";
  }
  return "comerciais";
};

export default function ListaPropostas({ onNovaProposta, onEditar }: ListaPropostasProps) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("todas");
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>("todos");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("lista");
  const [propostas, setPropostas] = useState<Proposta[]>(
    mockPropostas.map((p, idx) => ({
      ...p,
      arquivada: p.status === "expirada" || p.arquivada || false,
      categoria: p.tipo === "modelo" ? "Modelo Base" : "Comercial",
      responsavel: ["Diego", "Carlos", "Mariana", "Roberto"][idx % 4],
      versao: p.versao || Math.floor(Math.random() * 5) + 1,
      visualizacoes: Math.floor(Math.random() * 100) + 10,
      tags: ["frete", "dedicado", "spot"].slice(0, Math.floor(Math.random() * 3)),
      historico: [
        { data: new Date().toISOString(), acao: "Criação", usuario: "Sistema" },
      ],
      corDestaque: ["#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626"][idx % 5],
    }))
  );

  const [propostaSelecionada, setPropostaSelecionada] = useState<Proposta | null>(null);
  const [showPersonalizarDialog, setShowPersonalizarDialog] = useState(false);
  const [showRenomearDialog, setShowRenomearDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [propostaUploadId, setPropostaUploadId] = useState("");

  // Link compartilhado: /comercial?tab=propostas&proposta=<id> abre a prévia.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("proposta");
    if (!id) return;
    const proposta = propostas.find((p) => p.id === id);
    if (proposta) {
      setPropostaSelecionada(proposta);
      setShowPreviewDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFavorita = (id: string) => {
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, favorita: !p.favorita } : p));
  };

  const toggleArquivar = (id: string) => {
    setPropostas(prev => prev.map(p => p.id === id ? { ...p, arquivada: !p.arquivada } : p));
  };

  const duplicarProposta = (p: Proposta) => {
    const nova: Proposta = {
      ...p,
      id: Date.now().toString(),
      titulo: `${p.titulo} (Cópia)`,
      tipo: "personalizada",
      status: "rascunho",
      favorita: false,
      guardadaNaBiblioteca: false,
      dataGuardada: null,
      totalExportacoes: 0,
      ultimaExportacaoEm: null,
      versao: 1,
      visualizacoes: 0,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      modeloOrigemId: p.id,
      historico: [
        ...p.historico,
        { data: new Date().toISOString(), acao: "Duplicado", usuario: "Sistema" },
      ],
    };
    setPropostas(prev => [nova, ...prev]);
  };

  const enviarPropostaPdf = async (file: File) => {
    const erroArquivo = validarArquivoAnexo(file);
    if (erroArquivo) {
      toast.error(erroArquivo);
      return;
    }
    const ehPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!ehPdf) {
      toast.error("Envie um arquivo PDF para a proposta.");
      return;
    }
    setIsUploading(true);
    try {
      const caminho = `doc_central_Proposta_Comercial_${Date.now()}.pdf`;
      const { data: upload, error: uploadError } = await supabase.storage
        .from("propostas")
        .upload(caminho, file, { upsert: false, contentType: "application/pdf" });
      if (uploadError || !upload?.path) {
        throw new Error(uploadError?.message || "Falha no upload do PDF da proposta.");
      }
      const referencia = `propostas/${upload.path}`;
      const agora = new Date().toISOString();
      const { data: criado, error: insertError } = await supabase
        .from("documentos_metadata")
        .insert([
          {
            url: referencia,
            nome: file.name,
            tipo: "Proposta Comercial",
            modulo_origem: "comercial",
            entidade_id: null,
            entidade_nome: null,
            status_ia: "pendente",
            relatorio_ia: null,
            data_inclusao: agora,
            categoria: "Comercial",
            departamento: "Comercial",
            responsavel: "Comercial",
            descricao: "Proposta comercial enviada pela aba Propostas.",
            mime_type: file.type || "application/pdf",
            tamanho_bytes: file.size,
            versao: 1,
            documento_pai_id: null,
            ativo: true,
            historico: [
              {
                id: crypto.randomUUID?.() || `evt_${Date.now()}`,
                tipo: "criacao",
                descricao: "Documento enviado para a Central de Documentos.",
                data: agora,
                usuario: "Comercial",
              },
            ],
          },
        ])
        .select("id")
        .single();
      if (insertError || !criado) {
        throw new Error(
          `PDF enviado, mas o metadado não foi salvo: ${insertError?.message || "resposta vazia"}`,
        );
      }
      const documentoId = (criado as { id?: string }).id || null;
      if (propostaUploadId) {
        setPropostas(prev =>
          prev.map(prop =>
            prop.id === propostaUploadId
              ? {
                  ...prop,
                  ultimoDocumentoId: documentoId,
                  ultimoDocumentoNome: file.name,
                  atualizadoEm: new Date().toISOString(),
                  historico: [
                    ...prop.historico,
                    { data: new Date().toISOString(), acao: `PDF enviado para a Central de Documentos (${file.name})`, usuario: "Comercial" },
                  ],
                }
              : prop
          )
        );
        toast.success("Proposta enviada e vinculada à proposta selecionada.");
      } else {
        toast.success("Proposta enviada para a Central de Documentos.");
      }
      setPropostaUploadId("");
      setShowUploadDialog(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a proposta.");
    } finally {
      setIsUploading(false);
    }
  };

  const guardarNaBiblioteca = (p: Proposta) => {
    const jaGuardada = propostas.find(prop => prop.origemDaGuardada === p.id && prop.guardadaNaBiblioteca);
    
    if (jaGuardada) {
      setPropostas(prev => prev.map(prop => 
        prop.id === jaGuardada.id 
          ? { ...prop, dataGuardada: new Date().toISOString(), atualizadaEm: new Date().toISOString() }
          : prop
      ));
    } else {
      const copia: Proposta = {
        ...p,
        id: `guardada-${Date.now()}`,
        titulo: `${p.titulo} (Cópia)`,
        tipo: "modelo",
        status: "aprovada",
        favorita: false,
        guardadaNaBiblioteca: true,
        dataGuardada: new Date().toISOString(),
        totalExportacoes: 0,
        ultimaExportacaoEm: null,
        origemDaGuardada: p.id,
        versao: 1,
        visualizacoes: 0,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
        historico: [
          ...p.historico,
          { data: new Date().toISOString(), acao: "Guardada na Biblioteca", usuario: "Sistema" },
        ],
      };
      setPropostas(prev => [copia, ...prev]);
    }
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const exportarProposta = async (p: Proposta, guardarTambem: boolean = false) => {
    try {
      const pdfFile = await gerarPDFProfissional({
        titulo: `Proposta Comercial — ${p.titulo}`,
        subtitulo: `${p.cliente || "Modelo base"} · ${p.segmento || "Segmento não informado"} · v${p.versao}.0`,
        colunas: ["Campo", "Detalhe"],
        linhas: [
          ["Cliente", p.cliente || "Não informado"],
          ["Segmento", p.segmento || "—"],
          ["Tipo de serviço", p.tipoServico || "—"],
          ["Status", getStatusColor(p.status).label],
          ["Responsável", p.responsavel || "—"],
          ["Versão", `v${p.versao}.0`],
          ["Atualizado em", new Date(p.atualizadoEm).toLocaleDateString("pt-BR")],
          ["Total de exportações", String(p.totalExportacoes + 1)],
        ],
        totais: [
          { label: "Proposta", valor: p.titulo },
          { label: "Emitida em", valor: new Date().toLocaleString("pt-BR") },
        ],
      });

      setPropostas(prev => prev.map(prop => {
        if (prop.id === p.id) {
          const now = new Date().toISOString();
          return {
            ...prop,
            totalExportacoes: prop.totalExportacoes + 1,
            ultimaExportacaoEm: now,
            historico: [
              ...prop.historico,
              { data: now, acao: `Exportação PDF #${prop.totalExportacoes + 1}`, usuario: "Sistema" },
            ],
          };
        }
        return prop;
      }));

      if (guardarTambem) {
        guardarNaBiblioteca(p);
      }

      try {
        const contato = await resolverContatoProposta({
          propostaId: p.id,
          leadId: p.leadId,
          clienteId: p.clienteId,
          clienteNome: p.cliente,
        });
        await enviarDocumentoOperacional({
          file: pdfFile,
          moduloOrigem: "comercial",
          entidadeId: contato.clienteId,
          entidadeNome: p.cliente,
          tipo: "Proposta Comercial",
          nome: pdfFile.name,
          categoria: "Comercial",
          departamento: "Comercial",
          clienteId: contato.clienteId,
          responsavel: "Comercial",
          descricao: `Proposta ${p.titulo} exportada em ${new Date().toLocaleString("pt-BR")}.`,
        });
        toast.success("Proposta exportada e enviada para a Central de Documentos.");
      } catch (uploadError) {
        console.error("[Propostas] Falha ao enviar o PDF para a Central:", uploadError);
        toast.warning("PDF gerado, mas não foi possível enviar para a Central de Documentos.");
      }

      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (erro) {
      console.error("[Propostas] Falha ao exportar PDF:", erro);
      toast.error("Não foi possível gerar o PDF da proposta.");
    }
  };

  const compartilharProposta = async (p: Proposta) => {
    const link = `${window.location.origin}/comercial?tab=propostas&proposta=${encodeURIComponent(p.id)}`;
    const contato = await resolverContatoProposta({
      propostaId: p.id,
      leadId: p.leadId,
      clienteId: p.clienteId,
      clienteNome: p.cliente,
    });
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link da proposta copiado!");
    } catch {
      window.prompt("Copie o link da proposta:", link);
    }

    const mensagem = `Olá! Segue o link da proposta "${p.titulo}" da Conexão Express:\n${link}`;
    const url = contato.telefone
      ? `https://wa.me/${contato.telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (!contato.telefone) {
      toast.warning("Telefone do lead/cliente não encontrado no CRM. WhatsApp aberto sem destinatário.");
    }

    const now = new Date().toISOString();
    setPropostas(prev => prev.map(prop =>
      prop.id === p.id
        ? { ...prop, historico: [...prop.historico, { data: now, acao: "Link compartilhado no WhatsApp", usuario: "Sistema" }] }
        : prop,
    ));
  };

  const excluirProposta = (p: Proposta) => {
    if (!window.confirm(`Excluir a proposta "${p.titulo}"?`)) return;
    setPropostas(prev => prev.filter(prop => prop.id !== p.id));
    toast.success("Proposta excluída.");
  };

  const filtradas = useMemo(() => {
    let result = [...propostas];

    if (busca) {
      const term = busca.toLowerCase();
      result = result.filter(p => 
        p.titulo.toLowerCase().includes(term) ||
        (p.cliente && p.cliente.toLowerCase().includes(term)) ||
        p.segmento.toLowerCase().includes(term) ||
        p.responsavel.toLowerCase().includes(term) ||
        p.tags.some(t => t.toLowerCase().includes(term))
      );
    }

    if (categoria !== "todas") {
      result = result.filter(p => getCategoriaProposta(p) === categoria);
    }

    switch (filtroRapido) {
      case "favorito":
        result = result.filter(p => p.favorita);
        break;
      case "recente":
        result = result.sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime()).slice(0, 10);
        break;
      case "guardada":
        result = result.filter(p => p.guardadaNaBiblioteca);
        break;
      case "exportada":
        result = result.filter(p => p.totalExportacoes > 0);
        break;
      case "arquivado":
        result = result.filter(p => p.arquivada);
        break;
      case "ativo":
        result = result.filter(p => !p.arquivada);
        break;
      case "padrao":
        result = result.filter(p => p.tipo === "modelo" && !p.cliente);
        break;
      case "personalizado":
        result = result.filter(p => p.tipo === "personalizada" && p.cliente);
        break;
      case "institucional":
        result = result.filter(p => p.subtitulo?.toLowerCase().includes("institucional") || p.categoria === "Institucional");
        break;
      case "comercial":
        result = result.filter(p => p.categoria === "Comercial");
        break;
      case "tabela":
        result = result.filter(p => p.subtitulo?.toLowerCase().includes("tabela") || p.categoria === "Tabela de Preços");
        break;
      case "apresentacao":
        result = result.filter(p => p.subtitulo?.toLowerCase().includes("apresentação"));
        break;
    }

    return result.sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime());
  }, [propostas, busca, categoria, filtroRapido]);

  const estatisticas = useMemo(() => {
    return {
      total: propostas.length,
      modelos: propostas.filter(p => p.tipo === "modelo").length,
      personalizadas: propostas.filter(p => p.tipo === "personalizada" && p.cliente).length,
      favoritas: propostas.filter(p => p.favorita).length,
      guardadas: propostas.filter(p => p.guardadaNaBiblioteca).length,
      exportadas: propostas.filter(p => p.totalExportacoes > 0).length,
      maisAcessadas: [...propostas].sort((a, b) => b.visualizacoes - a.visualizacoes).slice(0, 3),
      recentes: [...propostas].sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime()).slice(0, 5),
      prontasEnvio: propostas.filter(p => p.status === "aprovada").length,
      rascunhos: propostas.filter(p => p.status === "rascunho").length,
    };
  }, [propostas]);

  const limparTodosFiltros = () => {
    setBusca("");
    setCategoria("todas");
    setFiltroRapido("todos");
  };

  const filtrosAtivos: FiltroAtivoItem[] = [];
  if (busca.trim()) {
    filtrosAtivos.push({
      id: "busca",
      label: "Busca",
      valor: busca.trim(),
      onRemove: () => setBusca(""),
    });
  }
  if (categoria !== "todas") {
    const label = categorias.find((item) => item.value === categoria)?.label || categoria;
    filtrosAtivos.push({
      id: "categoria",
      label: "Categoria",
      valor: label,
      onRemove: () => setCategoria("todas"),
    });
  }
  if (filtroRapido !== "todos") {
    const label = filtrosRapidos.find((item) => item.value === filtroRapido)?.label || filtroRapido;
    filtrosAtivos.push({
      id: "filtroRapido",
      label: "Filtro",
      valor: label,
      onRemove: () => setFiltroRapido("todos"),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header com busca e controles */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex-1 w-full max-w-lg relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, cliente, segmento, tipo, status, responsável, tags..." 
            className="h-10 bg-background pl-9 focus-visible:ring-2 focus-visible:ring-primary/50" 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 items-center w-full md:w-auto overflow-x-auto">
          <Tabs value={visualizacao} onValueChange={(v) => setVisualizacao(v as Visualizacao)} className="h-9">
            <TabsList className="h-9">
              <TabsTrigger value="lista" className="h-7 px-2"><List className="w-4 h-4" /></TabsTrigger>
              <TabsTrigger value="cards" className="h-7 px-2"><Grid3X3 className="w-4 h-4" /></TabsTrigger>
              <TabsTrigger value="biblioteca" className="h-7 px-2"><LayoutTemplate className="w-4 h-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button
            variant="outline"
            className="whitespace-nowrap"
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" /> Fazer Upload de Proposta (PDF)
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary whitespace-nowrap"><Plus className="w-4 h-4 mr-2" /> Criar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onClick={() => onNovaProposta("personalizada")}>
                <Briefcase className="mr-2 h-4 w-4" />
                <span>Proposta Personalizada</span>
                <Badge variant="secondary" className="ml-auto">Novo</Badge>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNovaProposta("modelo")}>
                <LayoutTemplate className="mr-2 h-4 w-4" />
                <span>Novo Modelo Base</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Table2 className="mr-2 h-4 w-4" />
                <span>Importar Modelo</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Wand2 className="mr-2 h-4 w-4" />
                <span>IA Gerar Proposta</span>
                <Badge variant="outline" className="ml-auto bg-purple-50 text-purple-700">Beta</Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <FiltrosAtivos filtros={filtrosAtivos} onLimpar={limparTodosFiltros} className="px-1" />

      {/* Categorias Laterais */}
      <div className="flex gap-4">
        <Card className="w-56 shrink-0 hidden md:block">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-semibold">Biblioteca</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {categorias.map(cat => {
                const Icon = cat.icon;
                const count = cat.value === "todas" 
                  ? propostas.length 
                  : propostas.filter(p => getCategoriaProposta(p) === cat.value).length;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategoria(cat.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                      categoria === cat.value 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      <span>{cat.label}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 space-y-4">
          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium">Total Materiais</p>
                    <p className="text-xl font-bold text-blue-800">{estatisticas.total}</p>
                  </div>
                  <FileText className="w-6 h-6 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-indigo-700 font-medium">Modelos Base</p>
                    <p className="text-xl font-bold text-indigo-800">{estatisticas.modelos}</p>
                  </div>
                  <LayoutTemplate className="w-6 h-6 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-medium">Personalizadas</p>
                    <p className="text-xl font-bold text-emerald-800">{estatisticas.personalizadas}</p>
                  </div>
                  <Briefcase className="w-6 h-6 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-700 font-medium">Favoritas</p>
                    <p className="text-xl font-bold text-amber-800">{estatisticas.favoritas}</p>
                  </div>
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium">Prontas Envio</p>
                    <p className="text-xl font-bold text-purple-800">{estatisticas.prontasEnvio}</p>
                  </div>
                  <FileCheck className="w-6 h-6 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-cyan-700 font-medium">Guardadas</p>
                    <p className="text-xl font-bold text-cyan-800">{estatisticas.guardadas}</p>
                  </div>
                  <Save className="w-6 h-6 text-cyan-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-orange-700 font-medium">Exportadas</p>
                    <p className="text-xl font-bold text-orange-800">{estatisticas.exportadas}</p>
                  </div>
                  <Send className="w-6 h-6 text-orange-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-700 font-medium">Rascunhos</p>
                    <p className="text-xl font-bold text-slate-800">{estatisticas.rascunhos}</p>
                  </div>
                  <FileX className="w-6 h-6 text-slate-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros Rápidos */}
          <div className="space-y-3 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Filtros rápidos
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {filtradas.length} material(is)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {filtrosRapidos.map(f => (
                <Button
                  key={f.value}
                  variant={filtroRapido === f.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroRapido(f.value)}
                  className={`h-8 rounded-full px-3 text-xs ${filtroRapido === f.value ? "shadow-sm" : "bg-background"}`}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Visualização */}
          {visualizacao === "lista" && (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[300px]">Material</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Exp.</TableHead>
                      <TableHead>Versão</TableHead>
                      <TableHead>Atualizado</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nenhum material encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtradas.map((p) => {
                        const statusColors = getStatusColor(p.status);
                        return (
                          <TableRow key={p.id} className="hover:bg-slate-50/50">
                            <TableCell>
                              <div className="flex items-start gap-3">
                                <button onClick={() => toggleFavorita(p.id)}>
                                  {p.favorita ? (
                                    <Star className="w-4 h-4 mt-1 text-amber-500 fill-amber-500" />
                                  ) : (
                                    <Star className="w-4 h-4 mt-1 text-slate-300 hover:text-amber-500" />
                                  )}
                                </button>
                                <div>
                                  <p className="font-semibold text-slate-800">{p.titulo}</p>
                                  <p className="text-xs text-muted-foreground">{p.subtitulo}</p>
                                  <div className="flex gap-1 mt-1">
                                    {p.tags.map(tag => (
                                      <Badge key={tag} variant="outline" className="text-[10px] px-1 py-0">{tag}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {p.cliente ? (
                                <span className="font-medium text-slate-700">{p.cliente}</span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Genérico</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {p.tipo === "modelo" ? "Modelo" : "Personalizada"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-600">{p.segmento}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${statusColors.bg} ${statusColors.text} text-xs`}>
                                {statusColors.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {p.totalExportacoes > 0 && (
                                  <Send className="w-3 h-3 text-orange-500" />
                                )}
                                <span className="text-xs text-slate-500">{p.totalExportacoes}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs text-slate-500">v{p.versao}.0</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs flex items-center gap-1 text-slate-600">
                                <CalendarDays className="w-3.5 h-3.5" />
                                {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuItem onClick={() => { setPropostaSelecionada(p); setShowPreviewDialog(true); }}>
                                    <Eye className="w-4 h-4 mr-2" /> Visualizar Prévia
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onEditar(p)}>
                                    <Edit className="w-4 h-4 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => duplicarProposta(p)}>
                                    <Copy className="w-4 h-4 mr-2" /> Duplicar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setPropostaSelecionada(p); setShowPersonalizarDialog(true); }}>
                                    <Palette className="w-4 h-4 mr-2" /> Personalizar para Cliente
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setPropostaSelecionada(p); setShowRenomearDialog(true); }}>
                                    <Edit className="w-4 h-4 mr-2" /> Renomear
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => void exportarProposta(p, false)}>
                                    <Download className="w-4 h-4 mr-2" /> Exportar PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => guardarNaBiblioteca(p)}>
                                    <Save className="w-4 h-4 mr-2" /> Guardar na Biblioteca
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void exportarProposta(p, true)}>
                                    <Send className="w-4 h-4 mr-2" /> Exportar e Guardar
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => toggleFavorita(p.id)}>
                                    <Star className="w-4 h-4 mr-2" />
                                    {p.favorita ? "Desfavoritar" : "Favoritar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => void compartilharProposta(p)}>
                                    <Share2 className="w-4 h-4 mr-2" /> Compartilhar no WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleArquivar(p.id)}>
                                    <Archive className="w-4 h-4 mr-2" />
                                    {p.arquivada ? "Desarquivar" : "Arquivar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600" onClick={() => excluirProposta(p)}>
                                    <Trash2 className="w-4 h-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {visualizacao === "cards" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtradas.map((p) => {
                const statusColors = getStatusColor(p.status);
                return (
                  <Card key={p.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                    <div 
                      className="h-24 rounded-t-lg flex items-center justify-center relative overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${p.corDestaque}22, ${p.corDestaque}44)` }}
                    >
                      <SafeImage
                        src={p.capaCustomizada}
                        alt=""
                        className="w-full h-full object-cover"
                        fallbackClassName="bg-transparent"
                        fallback={<FileText className="w-10 h-10" style={{ color: p.corDestaque }} />}
                      />
                      <button 
                        onClick={(e) => { e.stopPropagation(); toggleFavorita(p.id); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-white/80 hover:bg-white"
                      >
                        <Star className={`w-4 h-4 ${p.favorita ? "text-amber-500 fill-amber-500" : "text-slate-400"}`} />
                      </button>
                      {p.cliente && (
                        <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 rounded text-xs font-medium text-slate-700">
                          {p.cliente}
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm line-clamp-2">{p.titulo}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{p.subtitulo}</p>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={`${statusColors.bg} ${statusColors.text} text-[10px]`}>
                          {statusColors.label}
                        </Badge>
                        <span className="text-xs text-slate-500">v{p.versao}.0</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{p.responsavel}</span>
                        <span>{new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {visualizacao === "biblioteca" && (
            <div className="space-y-6">
              {categorias.filter(c => c.value !== "todas").map(cat => {
                const itens = filtradas.filter(p => getCategoriaProposta(p) === cat.value);
                if (itens.length === 0) return null;
                const Icon = cat.icon;
                return (
                  <div key={cat.value}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-lg">{cat.label}</h3>
                      <Badge variant="secondary">{itens.length}</Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {itens.map(p => (
                        <Card key={p.id} className="hover:shadow-md cursor-pointer transition-all hover:-translate-y-1">
                          <div 
                            className="h-16 rounded-t-lg flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${p.corDestaque}22, ${p.corDestaque}44)` }}
                          >
                            <FileText className="w-8 h-8" style={{ color: p.corDestaque }} />
                          </div>
                          <CardContent className="p-2">
                            <p className="text-xs font-medium line-clamp-2">{p.titulo}</p>
                            <p className="text-[10px] text-muted-foreground">{p.cliente || "Modelo"}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Preview */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia da Proposta</DialogTitle>
            <DialogDescription>{propostaSelecionada?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="border rounded-lg p-8 bg-white min-h-[400px] flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-slate-500">Preview da proposta</p>
              <p className="text-sm text-muted-foreground mt-2">{propostaSelecionada?.subtitulo}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>Fechar</Button>
            <Button onClick={() => { setShowPreviewDialog(false); onEditar(propostaSelecionada!); }}>Editar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Personalização */}
      <Dialog open={showPersonalizarDialog} onOpenChange={setShowPersonalizarDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Personalizar para Cliente</DialogTitle>
            <DialogDescription>Adapte este modelo para um cliente específico</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Cliente</Label>
              <Input placeholder="Nome do cliente" defaultValue={propostaSelecionada?.cliente || ""} />
            </div>
            <div>
              <Label>Logo do Cliente (URL)</Label>
              <Input placeholder="https://..." />
            </div>
            <div>
              <Label>Cor de Destaque</Label>
              <div className="flex gap-2 mt-2">
                {['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'].map(c => (
                  <button
                    key={c}
                    className={`w-8 h-8 rounded-full border-2 ${propostaSelecionada?.corDestaque === c ? 'border-black' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Texto de Abertura</Label>
              <Input placeholder="Prezado(a)..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPersonalizarDialog(false)}>Cancelar</Button>
            <Button onClick={() => { setShowPersonalizarDialog(false); duplicarProposta(propostaSelecionada!); }}>
              <Wand2 className="w-4 h-4 mr-2" /> Criar Personalizada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Renomear */}
      <Dialog open={showRenomearDialog} onOpenChange={setShowRenomearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renomear Material</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input defaultValue={propostaSelecionada?.titulo} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenomearDialog(false)}>Cancelar</Button>
            <Button onClick={() => setShowRenomearDialog(false)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast de Exportação */}
      <Dialog
        open={showUploadDialog}
        onOpenChange={(aberto) => {
          if (!isUploading) {
            setShowUploadDialog(aberto);
            if (!aberto) setPropostaUploadId("");
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" /> Fazer Upload de Proposta (PDF)
            </DialogTitle>
            <DialogDescription>
              O PDF será indexado na Central de Documentos com categoria e departamento Comercial.
            </DialogDescription>
          </DialogHeader>
          {isUploading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Enviando proposta e registrando metadados...
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Vincular a uma proposta (opcional)</Label>
                <Select
                  value={propostaUploadId || "__nenhuma__"}
                  onValueChange={(v) => setPropostaUploadId(v === "__nenhuma__" ? "" : v)}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecionar proposta da lista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__nenhuma__">Nenhuma (só Central de Documentos)</SelectItem>
                    {propostas.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Ao vincular, a lista é atualizada com o documento enviado e um evento no histórico da proposta.
                </p>
              </div>
              <DocumentoUploadUniversal
                accept=".pdf,application/pdf"
                onFile={(file) => void enviarPropostaPdf(file)}
                label="Arraste o PDF da proposta aqui ou escolha uma opção"
                hint="Somente PDF · até 50 MB"
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isUploading}
              onClick={() => setShowUploadDialog(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showExportSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Download className="w-5 h-5" />
          <span>Proposta exportada com sucesso!</span>
        </div>
      )}

      {/* Toast de Guardar */}
      {showSaveSuccess && (
        <div className="fixed bottom-4 right-4 bg-cyan-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <Save className="w-5 h-5" />
          <span>Proposta salva na biblioteca!</span>
        </div>
      )}
    </div>
  );
}