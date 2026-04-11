import { useState, useMemo } from "react";
import { 
  Search, Plus, FileText, Star, Copy, Edit, Trash2, LayoutTemplate, Briefcase, 
  ChevronDown, Filter, CalendarDays, BarChart, Tags, Grid3X3, List, Bookmark, 
  Clock, Archive, Download, Share2, Eye, MoreHorizontal, Palette, RefreshCw,
  Building2, Presentation, Table2, FileCheck, FileX, Check, X, Image, Wand2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockPropostas } from "./mockPropostas";

interface ListaPropostasProps {
  onNovaProposta: (tipo: "modelo" | "personalizada", originModelo?: any) => void;
  onEditar: (proposta: any) => void;
}

type Categoria = "todas" | "institucionais" | "comerciais" | "tabelas" | "apresentacoes" | "modelos" | "personalizadas" | "favoritas" | "recentes" | "arquivadas";
type Visualizacao = "lista" | "cards" | "biblioteca";
type FiltroRapido = "todos" | "padrao" | "personalizado" | "institucional" | "comercial" | "tabela" | "apresentacao" | "favorito" | "recente" | "ativo" | "arquivado";

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
  historico: { data: string; acao: string; usuario: string }[];
}

const categorias: { value: Categoria; label: string; icon: any }[] = [
  { value: "todas", label: "Todas", icon: FileText },
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
      arquivada: p.status === "expirada",
      categoria: p.tipo === "modelo" ? "Modelo Base" : "Comercial",
      responsavel: ["Diego", "Carlos", "Mariana", "Roberto"][idx % 4],
      versao: Math.floor(Math.random() * 5) + 1,
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
      versao: 1,
      visualizacoes: 0,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      modeloOrigemId: p.id,
    };
    setPropostas(prev => [nova, ...prev]);
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
      maisAcessadas: [...propostas].sort((a, b) => b.visualizacoes - a.visualizacoes).slice(0, 3),
      recentes: [...propostas].sort((a, b) => new Date(b.atualizadoEm).getTime() - new Date(a.atualizadoEm).getTime()).slice(0, 5),
      prontasEnvio: propostas.filter(p => p.status === "aprovada").length,
      rascunhos: propostas.filter(p => p.status === "rascunho").length,
    };
  }, [propostas]);

  return (
    <div className="space-y-6">
      {/* Header com busca e controles */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex-1 w-full max-w-lg relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, cliente, segmento, tipo, status, responsável, tags..." 
            className="pl-9" 
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
          <div className="flex gap-2 flex-wrap">
            {filtrosRapidos.map(f => (
              <Button
                key={f.value}
                variant={filtroRapido === f.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroRapido(f.value)}
                className="text-xs"
              >
                {f.label}
              </Button>
            ))}
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
                                  <DropdownMenuItem onClick={() => toggleFavorita(p.id)}>
                                    <Star className="w-4 h-4 mr-2" />
                                    {p.favorita ? "Desfavoritar" : "Favoritar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Download className="w-4 h-4 mr-2" /> Exportar PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Share2 className="w-4 h-4 mr-2" /> Compartilhar Link
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleArquivar(p.id)}>
                                    <Archive className="w-4 h-4 mr-2" />
                                    {p.arquivada ? "Desarquivar" : "Arquivar"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-red-600">
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
                      {p.capaCustomizada ? (
                        <img src={p.capaCustomizada} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-10 h-10" style={{ color: p.corDestaque }} />
                      )}
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
    </div>
  );
}