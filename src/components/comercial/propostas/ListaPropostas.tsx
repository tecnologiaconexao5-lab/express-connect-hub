import { useState, useMemo } from "react";
import { Search, Plus, FileText, Star, Copy, Edit, Trash2, LayoutTemplate, Briefcase, ChevronDown, Filter, CalendarDays, BarChart, Tags, Eye, Download, Share2, Archive, MoreVertical, Building2, FileSpreadsheet, Presentation, User, Grid3x3, List, PanelLeftClose, PanelLeft, X, Clock, Bookmark, ArchiveRestore, Check, Link2, Send, FileOutput, Palette, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuPortal } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { mockPropostas, Proposta, CATEGORIAS, getStatusColor, getStatusLabel, TIPOS_MODELO } from "./mockPropostas";

interface ListaPropostasProps {
  onNovaProposta: (tipo: "modelo" | "personalizada", originModelo?: any) => void;
  onEditar: (proposta: any) => void;
}

type CategoriaNav = "todos" | "institucional" | "comercial" | "tabela" | "apresentacao" | "modelo_base" | "personalizada" | "favoritas" | "recentes" | "arquivadas";
type ViewMode = "lista" | "cards" | "biblioteca";

const NAV_CATEGORIAS: { id: CategoriaNav; label: string; icon: any; count?: number }[] = [
  { id: "todos", label: "Todas", icon: FileText },
  { id: "institucional", label: "Institucionais", icon: Building2 },
  { id: "comercial", label: "Comerciais", icon: Briefcase },
  { id: "tabela", label: "Tabelas", icon: FileSpreadsheet },
  { id: "apresentacao", label: "Apresentações", icon: Presentation },
  { id: "modelo_base", label: "Modelos Base", icon: LayoutTemplate },
  { id: "personalizada", label: "Personalizadas", icon: User },
  { id: "favoritas", label: "Favoritas", icon: Star },
  { id: "recentes", label: "Recentes", icon: Clock },
  { id: "arquivadas", label: "Arquivadas", icon: Archive },
];

const FILTROS_RAPIDOS = [
  { id: "todos", label: "Todas" },
  { id: "modelo", label: "Modelos" },
  { id: "personalizada", label: "Personalizadas" },
  { id: "favorita", label: "Favoritas" },
  { id: "pronta", label: "Prontas" },
  { id: "enviada", label: "Enviadas" },
  { id: "rascunho", label: "Rascunhos" },
  { id: "arquivada", label: "Arquivadas" },
];

export default function ListaPropostas({ onNovaProposta, onEditar }: ListaPropostasProps) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<CategoriaNav>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<ViewMode>("lista");
  const [propostaSelecionada, setPropostaSelecionada] = useState<Proposta | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showNovoDialog, setShowNovoDialog] = useState(false);

  const filtradas = useMemo(() => {
    return mockPropostas.filter((p) => {
      const term = busca.toLowerCase();
      const matchBusca = 
        p.titulo.toLowerCase().includes(term) ||
        (p.cliente && p.cliente.toLowerCase().includes(term)) ||
        (p.segmento && p.segmento.toLowerCase().includes(term)) ||
        (p.tipoServico && p.tipoServico.toLowerCase().includes(term)) ||
        p.tags.some(t => t.toLowerCase().includes(term));

      let matchCategoria = true;
      if (categoria === "todos") matchCategoria = true;
      else if (categoria === "favoritas") matchCategoria = p.favorita;
      else if (categoria === "recentes") matchCategoria = new Date(p.atualizadoEm).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
      else if (categoria === "arquivadas") matchCategoria = p.arquivada;
      else matchCategoria = p.categoria === categoria;

      let matchFiltro = true;
      if (filtroTipo === "todos") matchFiltro = true;
      else if (filtroTipo === "modelo") matchFiltro = p.tipo === "modelo";
      else if (filtroTipo === "personalizada") matchFiltro = p.tipo === "personalizada";
      else if (filtroTipo === "favorita") matchFiltro = p.favorita;
      else if (filtroTipo === "pronta") matchFiltro = p.status === "pronta";
      else if (filtroTipo === "enviada") matchFiltro = p.status === "enviada" || p.status === "visualizada";
      else if (filtroTipo === "rascunho") matchFiltro = p.status === "rascunho";
      else if (filtroTipo === "arquivada") matchFiltro = p.arquivada;

      return matchBusca && matchCategoria && matchFiltro;
    });
  }, [busca, categoria, filtroTipo]);

  const stats = useMemo(() => ({
    total: mockPropostas.length,
    modelos: mockPropostas.filter(p => p.tipo === "modelo").length,
    personalizadas: mockPropostas.filter(p => p.type === "personalizada").length,
    favoritas: mockPropostas.filter(p => p.favorita).length,
    recentes: mockPropostas.filter(p => new Date(p.atualizadoEm).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000).length,
    prontas: mockPropostas.filter(p => p.status === "pronta").length,
    rascunhos: mockPropostas.filter(p => p.status === "rascunho").length,
    arquivadas: mockPropostas.filter(p => p.arquivada).length,
  }), []);

  const handleToggleFavorita = (proposta: Proposta) => {
    proposta.favorita = !proposta.favorita;
    toast.success(proposta.favorita ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const handleArquivar = (proposta: Proposta) => {
    proposta.arquivada = !proposta.arquivada;
    toast.success(proposta.arquivada ? "Arquivado com sucesso" : "Desarquivado com sucesso");
  };

  const handleDuplicar = (proposta: Proposta) => {
    const novaProposta: Proposta = {
      ...proposta,
      id: `${Date.now()}`,
      titulo: `${proposta.titulo} (Cópia)`,
      status: "rascunho",
      versao: "v0.1",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    toast.success("Proposta duplicada com sucesso!");
    onEditar(novaProposta);
  };

  const handleExportar = (proposta: Proposta, tipo: "padrao" | "personalizada") => {
    toast.success(`Exportando ${tipo === "padrao" ? "versão padrão" : "versão personalizada"}...`);
  };

  const handleEnviar = (proposta: Proposta) => {
    toast.success("Preparando envio...");
  };

  return (
    <div className="space-y-4">
      {/* Header com busca e ações */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex-1 w-full max-w-md relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome, cliente, segmento, tags..." 
            className="pl-9" 
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
          <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)} className="whitespace-nowrap">
            {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-primary whitespace-nowrap"><Plus className="w-4 h-4 mr-2" /> Criar Proposta</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><Briefcase className="mr-2 h-4 w-4" />Nova Proposta Personalizada</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-56">
                    {TIPOS_MODELO.filter(t => t.id !== "personalizada").map((tipo) => (
                      <DropdownMenuItem key={tipo.id} onClick={() => onNovaProposta("personalizada", { tipo })}>
                        <span className="font-medium">{tipo.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger><LayoutTemplate className="mr-2 h-4 w-4" />Novo Modelo Base</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-56">
                    <DropdownMenuItem onClick={() => onNovaProposta("modelo", { tipo: "institucional" })}>
                      <span className="font-medium">Proposta Institucional</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onNovaProposta("modelo", { tipo: "transporte_dedicado" })}>
                      <span className="font-medium">Transporte Dedicado</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onNovaProposta("modelo", { tipo: "last_mile" })}>
                      <span className="font-medium">Last Mile</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onNovaProposta("modelo", { tipo: "armazenagem" })}>
                      <span className="font-medium">Armazenagem</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onNovaProposta("modelo", { tipo: "tabela_frete" })}>
                      <span className="font-medium">Tabela de Frete</span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Sidebar de navegação por categorias */}
        {showSidebar && (
          <Card className="w-56 shrink-0 h-fit">
            <CardContent className="p-3">
              <div className="space-y-1">
                {NAV_CATEGORIAS.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <Button
                      key={cat.id}
                      variant={categoria === cat.id ? "secondary" : "ghost"}
                      className="w-full justify-start text-left h-9 px-3"
                      onClick={() => setCategoria(cat.id)}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      <span className="flex-1">{cat.label}</span>
                      {cat.id === "todos" && <span className="text-xs text-muted-foreground">{stats.total}</span>}
                      {cat.id === "favoritas" && stats.favoritas > 0 && <span className="text-xs text-muted-foreground">{stats.favoritas}</span>}
                      {cat.id === "recentes" && stats.recentes > 0 && <span className="text-xs text-muted-foreground">{stats.recentes}</span>}
                      {cat.id === "arquivadas" && stats.arquivadas > 0 && <span className="text-xs text-muted-foreground">{stats.arquivadas}</span>}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex-1 space-y-4">
          {/* Cards de indicadores */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Card className="cursor-pointer hover:shadow-md transition-all bg-primary/5 border-primary/20" onClick={() => { setCategoria("todos"); setFiltroTipo("todos"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg"><FileText className="w-4 h-4 text-primary" /></div>
                <div>
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setCategoria("todos"); setFiltroTipo("modelo"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><LayoutTemplate className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold text-blue-700">{stats.modelos}</p>
                  <p className="text-[10px] text-muted-foreground">Modelos</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setCategoria("personalizada"); setFiltroTipo("todos"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Briefcase className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold text-emerald-700">{stats.personalizadas}</p>
                  <p className="text-[10px] text-muted-foreground">Personalizadas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setCategoria("favoritas"); setFiltroTipo("todos"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Star className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold text-amber-700">{stats.favoritas}</p>
                  <p className="text-[10px] text-muted-foreground">Favoritas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setCategoria("todos"); setFiltroTipo("pronta"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Check className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold text-purple-700">{stats.prontas}</p>
                  <p className="text-[10px] text-muted-foreground">Prontas</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:shadow-md transition-all" onClick={() => { setCategoria("recentes"); setFiltroTipo("todos"); }}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg"><Clock className="w-4 h-4" /></div>
                <div>
                  <p className="text-xl font-bold text-cyan-700">{stats.recentes}</p>
                  <p className="text-[10px] text-muted-foreground">Recentes</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros rápidos */}
          <div className="flex gap-2 flex-wrap">
            {FILTROS_RAPIDOS.map((filtro) => (
              <Button
                key={filtro.id}
                variant={filtroTipo === filtro.id ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFiltroTipo(filtro.id)}
              >
                {filtro.label}
              </Button>
            ))}
            <div className="flex-1" />
            <div className="flex gap-1 border rounded-md p-1">
              <Button variant={viewMode === "lista" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => setViewMode("lista")}><List className="w-3.5 h-3.5" /></Button>
              <Button variant={viewMode === "cards" ? "secondary" : "ghost"} size="icon" className="h-6 w-6" onClick={() => setViewMode("cards")}><Grid3x3 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>

          {/* Lista principal */}
          {viewMode === "lista" ? (
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="w-[300px]">Documento</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Atualização</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtradas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <div className="flex flex-col items-center gap-2">
                            <FileText className="w-10 h-10 opacity-50" />
                            <p>Nenhuma proposta encontrada</p>
                            <p className="text-xs">Tente ajustar os filtros ou buscar por outro termo</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtradas.map((p) => (
                        <TableRow 
                          key={p.id} 
                          className="hover:bg-slate-50/50 cursor-pointer"
                          onClick={() => setPropostaSelecionada(p)}
                        >
                          <TableCell>
                            <div className="flex items-start gap-3">
                              {p.favorita ? (
                                <Star className="w-4 h-4 mt-1 text-amber-500 fill-amber-500" />
                              ) : (
                                <FileText className="w-4 h-4 mt-1 text-slate-400" />
                              )}
                              <div>
                                <p className="font-semibold text-slate-800">{p.titulo}</p>
                                <p className="text-xs text-muted-foreground">{p.subtitulo}</p>
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
                              {p.categoria === "modelo_base" ? "Modelo" : p.categoria === "personalizada" ? "Personalizada" : p.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600">{p.segmento}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs capitalize ${getStatusColor(p.status)}`}>
                              {getStatusLabel(p.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-slate-600">
                              <p>{new Date(p.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                              {p.versao && <p className="text-muted-foreground">{p.versao}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => onEditar(p)}><Eye className="w-4 h-4 mr-2" />Visualizar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEditar(p)}><Edit className="w-4 h-4 mr-2" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDuplicar(p)}><Copy className="w-4 h-4 mr-2" />Duplicar</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleExportar(p, "padrao")}><Download className="w-4 h-4 mr-2" />Exportar Padrão</DropdownMenuItem>
                                {p.tipo === "personalizada" && (
                                  <DropdownMenuItem onClick={() => handleExportar(p, "personalizada")}><FileOutput className="w-4 h-4 mr-2" />Exportar Personalizada</DropdownMenuItem>
                                )}
                                {p.status === "pronta" && (
                                  <DropdownMenuItem onClick={() => handleEnviar(p)}><Send className="w-4 h-4 mr-2" />Enviar ao Cliente</DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleToggleFavorita(p)}>
                                  <Star className="w-4 h-4 mr-2" />{p.favorita ? "Desfavoritar" : "Favoritar"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleArquivar(p)}>
                                  {p.arquivada ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
                                  {p.arquivada ? "Desarquivar" : "Arquivar"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtradas.map((p) => (
                <Card 
                  key={p.id} 
                  className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-0.5"
                  onClick={() => setPropostaSelecionada(p)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className={`p-2 rounded-lg ${p.categoria === "institucional" ? "bg-slate-100" : p.categoria === "comercial" ? "bg-blue-100" : p.categoria === "tabela" ? "bg-green-100" : p.categoria === "apresentacao" ? "bg-purple-100" : p.categoria === "modelo_base" ? "bg-amber-100" : "bg-emerald-100"}`}>
                        {p.categoria === "institucional" ? <Building2 className="w-4 h-4 text-slate-600" /> : 
                         p.categoria === "comercial" ? <Briefcase className="w-4 h-4 text-blue-600" /> : 
                         p.categoria === "tabela" ? <FileSpreadsheet className="w-4 h-4 text-green-600" /> : 
                         p.categoria === "apresentacao" ? <Presentation className="w-4 h-4 text-purple-600" /> : 
                         p.categoria === "modelo_base" ? <LayoutTemplate className="w-4 h-4 text-amber-600" /> : 
                         <User className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div className="flex gap-1">
                        {p.favorita && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                        {p.arquivada && <Archive className="w-4 h-4 text-gray-400" />}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <h3 className="font-semibold text-sm line-clamp-2 mb-1">{p.titulo}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{p.subtitulo}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-[10px] ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{p.versao}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Info de resultados */}
          <div className="text-xs text-muted-foreground text-center">
            Mostrando {filtradas.length} de {mockPropostas.length} propostas
          </div>
        </div>
      </div>

      {/* Sidebar de detalhes */}
      <Dialog open={!!propostaSelecionada} onOpenChange={() => setPropostaSelecionada(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {propostaSelecionada?.favorita && <Star className="w-5 h-5 text-amber-500 fill-amber-500" />}
              {propostaSelecionada?.titulo}
            </DialogTitle>
            <DialogDescription>{propostaSelecionada?.subtitulo}</DialogDescription>
          </DialogHeader>

          {propostaSelecionada && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-1">
                {/* Info principal */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-medium">{propostaSelecionada.cliente || "Genérico (Modelo)"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Segmento</p>
                    <p className="font-medium">{propostaSelecionada.segmento}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Tipo de Serviço</p>
                    <p className="font-medium">{propostaSelecionada.tipoServico}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge variant="outline" className={getStatusColor(propostaSelecionada.status)}>
                      {getStatusLabel(propostaSelecionada.status)}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Versão</p>
                    <p className="font-medium">{propostaSelecionada.versao}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Responsável</p>
                    <p className="font-medium">{propostaSelecionada.responsavel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="font-medium">{new Date(propostaSelecionada.criadoEm).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Última atualização</p>
                    <p className="font-medium">{new Date(propostaSelecionada.atualizadoEm).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                {/* Tags */}
                {propostaSelecionada.tags.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {propostaSelecionada.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Histórico de versões */}
                {propostaSelecionada.versoes.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Histórico de Versões</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        {propostaSelecionada.versoes.map((v) => (
                          <div key={v.versao} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div>
                              <span className="font-medium">{v.versao}</span>
                              <span className="text-muted-foreground text-xs ml-2">- {v.data}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{v.responsavel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Ações rápidas */}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { onEditar(propostaSelecionada); setPropostaSelecionada(null); }}>
                    <Edit className="w-4 h-4 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicar(propostaSelecionada)}>
                    <Copy className="w-4 h-4 mr-1" />Duplicar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleExportar(propostaSelecionada, "padrao")}>
                    <Download className="w-4 h-4 mr-1" />Exportar
                  </Button>
                  {propostaSelecionada.status === "pronta" && (
                    <Button size="sm" variant="outline" onClick={() => handleEnviar(propostaSelecionada)}>
                      <Send className="w-4 h-4 mr-1" />Enviar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleToggleFavorita(propostaSelecionada)}>
                    <Star className="w-4 h-4 mr-1" />{propostaSelecionada.favorita ? "Desfavoritar" : "Favoritar"}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}