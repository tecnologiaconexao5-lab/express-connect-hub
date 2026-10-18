import { useState, useEffect, useCallback } from "react";
import {
  Building2, FileText, Plus, Save, RefreshCw, Search,
  CheckCircle2, XCircle, AlertTriangle, Upload, History,
  Link2, Unlink, Edit3, BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { conhecimentoCorporativoService, getTipoLabel } from "@/services/ia/conhecimentoCorporativoService";
import type { ConhecimentoCorporativo, ConhecimentoDistribuicao, TipoConhecimento } from "@/services/ia/conhecimentoCorporativoService";

const STATUS_CORES: Record<string, string> = {
  rascunho: "bg-yellow-100 text-yellow-800",
  ativo: "bg-green-100 text-green-800",
  inativo: "bg-gray-100 text-gray-600",
  vencido: "bg-red-100 text-red-800",
  expirado: "bg-red-100 text-red-800",
  arquivado: "bg-gray-100 text-gray-500",
};

const TIPO_CORES: Record<string, string> = {
  procedimento: "bg-blue-100 text-blue-800",
  politica: "bg-purple-100 text-purple-800",
  contrato: "bg-amber-100 text-amber-800",
  tabela_preco: "bg-green-100 text-green-800",
  treinamento: "bg-cyan-100 text-cyan-800",
  compliance: "bg-red-100 text-red-800",
  outro: "bg-gray-100 text-gray-600",
};

const PRIORIDADE_CORES: Record<string, string> = {
  baixa: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-800",
  alta: "bg-orange-100 text-orange-800",
  critica: "bg-red-100 text-red-800",
};

function fmtData(d: string | null | undefined) {
  if (!d) return "-";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; }
}

export function ConhecimentoCorporativoTab() {
  const [conhecimentos, setConhecimentos] = useState<ConhecimentoCorporativo[]>([]);
  const [robos, setRobos] = useState<{ id: string; nome: string; setor: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  const [editItem, setEditItem] = useState<Partial<ConhecimentoCorporativo> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [viewItem, setViewItem] = useState<ConhecimentoCorporativo | null>(null);
  const [distribuicoes, setDistribuicoes] = useState<ConhecimentoDistribuicao[]>([]);
  const [uploading, setUploading] = useState(false);

  const categorias = [...new Set(conhecimentos.map((c) => c.categoria).filter(Boolean))] as string[];

  function carregar() {
    setLoading(true);
    Promise.all([
      conhecimentoCorporativoService.listarConhecimentos(),
      supabase.from("automacoes_robos").select("id, nome, setor").then(({ data }) => data || []),
    ]).then(([conhec, robosData]) => {
      setConhecimentos(conhec);
      setRobos(robosData as { id: string; nome: string; setor: string }[]);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { carregar(); }, []);

  const filtrados = conhecimentos.filter((c) => {
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (filtroTipo !== "todos" && c.tipo_conhecimento !== filtroTipo) return false;
    if (filtroCategoria !== "todos" && c.categoria !== filtroCategoria) return false;
    if (searchQuery && !c.titulo.toLowerCase().includes(searchQuery.toLowerCase()) && !(c.conteudo || "").toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  async function criarConhecimento() {
    if (!editItem?.titulo || !editItem?.conteudo) {
      toast.warning("Preencha título e conteúdo");
      return;
    }
    setIsCreating(true);
    try {
      const result = await conhecimentoCorporativoService.criarConhecimento({
        titulo: editItem.titulo,
        conteudo: editItem.conteudo,
        tipo_conhecimento: (editItem.tipo_conhecimento || "outro") as TipoConhecimento,
        categoria: editItem.categoria || undefined,
        setor: editItem.setor || undefined,
        tags: editItem.tags || [],
        validade_inicio: editItem.validade_inicio || undefined,
        validade_fim: editItem.validade_fim || undefined,
      });
      if (result) {
        toast.success("Conhecimento criado");
        setEditItem(null);
        carregar();
      } else {
        toast.error("Erro ao criar");
      }
    } finally {
      setIsCreating(false);
    }
  }

  async function salvarEdicao() {
    if (!editItem?.id) return;
    const ok = await conhecimentoCorporativoService.editarConhecimento(editItem.id, editItem);
    if (ok) {
      toast.success("Conhecimento atualizado");
      setEditItem(null);
      carregar();
    } else {
      toast.error("Erro ao atualizar");
    }
  }

  async function alterarStatus(id: string, status: string) {
    const ok = await conhecimentoCorporativoService.alterarStatus(id, status);
    if (ok) {
      toast.success(`Status alterado para ${status}`);
      carregar();
    }
  }

  async function criarNovaVersao(id: string) {
    const item = conhecimentos.find((c) => c.id === id);
    if (!item) return;
    const ok = await conhecimentoCorporativoService.criarNovaVersao(id, {
      titulo: item.titulo,
      conteudo: item.conteudo,
      tipo_conhecimento: item.tipo_conhecimento as TipoConhecimento,
    });
    if (ok) {
      toast.success(`Nova versão criada (v${ok.versao})`);
      carregar();
    }
  }

  async function vincularRoboHandler(conhecimentoId: string, roboId: string) {
    const ok = await conhecimentoCorporativoService.vincularRobo(conhecimentoId, roboId);
    if (ok) {
      toast.success("Robô vinculado");
      carregarDistribuicoes(conhecimentoId);
    }
  }

  async function desvincularRoboHandler(conhecimentoId: string, roboId: string) {
    const ok = await conhecimentoCorporativoService.desvincularRobo(conhecimentoId, roboId);
    if (ok) {
      toast.success("Robô desvinculado");
      carregarDistribuicoes(conhecimentoId);
    }
  }

  async function carregarDistribuicoes(conhecimentoId: string) {
    const dist = await conhecimentoCorporativoService.listarDistribuicoes(conhecimentoId);
    setDistribuicoes(dist);
  }

  const handleFileUpload = useCallback(async (conhecimentoId: string, file: File) => {
    setUploading(true);
    try {
      const ok = await conhecimentoCorporativoService.uploadArquivoConhecimento(conhecimentoId, file);
      if (ok) {
        toast.success("Arquivo anexado");
      } else {
        toast.error("Erro ao anexar arquivo");
      }
    } finally {
      setUploading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Biblioteca Corporativa
          </h2>
          <Badge variant="outline" className="text-xs">{conhecimentos.length} documentos</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar conhecimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 h-8 pl-8 text-xs"
            />
          </div>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="procedimento">Procedimento</SelectItem>
              <SelectItem value="politica">Política</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="tabela_preco">Tabela Preço</SelectItem>
              <SelectItem value="treinamento">Treinamento</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
              <SelectItem value="arquivado">Arquivado</SelectItem>
              <SelectItem value="expirado">Expirado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={carregar}>
            <RefreshCw className="mr-1 h-3 w-3" />Atualizar
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8" onClick={() => setEditItem({
                titulo: "", conteudo: "", tipo_conhecimento: "outro",
                status: "rascunho", tags: [], categoria: "", setor: "",
              } as Partial<ConhecimentoCorporativo>)}>
                <Plus className="mr-1 h-3 w-3" />Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editItem?.id ? "Editar Conhecimento" : "Novo Conhecimento Corporativo"}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Título *</Label>
                    <Input value={editItem?.titulo || ""} onChange={(e) => setEditItem({ ...editItem, titulo: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={editItem?.tipo_conhecimento || "outro"} onValueChange={(v) => setEditItem({ ...editItem, tipo_conhecimento: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="procedimento">Procedimento</SelectItem>
                        <SelectItem value="politica">Política</SelectItem>
                        <SelectItem value="contrato">Contrato</SelectItem>
                        <SelectItem value="tabela_preco">Tabela de Preço</SelectItem>
                        <SelectItem value="treinamento">Treinamento</SelectItem>
                        <SelectItem value="compliance">Compliance</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Input value={editItem?.categoria || ""} onChange={(e) => setEditItem({ ...editItem, categoria: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Setor Aplicável</Label>
                    <Input value={editItem?.setor || ""} onChange={(e) => setEditItem({ ...editItem, setor: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Conteúdo *</Label>
                  <Textarea value={editItem?.conteudo || ""} onChange={(e) => setEditItem({ ...editItem, conteudo: e.target.value })} className="min-h-[120px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Tags (separadas por vírgula)</Label>
                    <Input
                      value={(editItem?.tags || []).join(", ")}
                      onChange={(e) => setEditItem({ ...editItem, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={editItem?.status || "rascunho"} onValueChange={(v) => setEditItem({ ...editItem, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rascunho">Rascunho</SelectItem>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="arquivado">Arquivado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Validade Início</Label>
                    <Input type="date" value={editItem?.validade_inicio || ""} onChange={(e) => setEditItem({ ...editItem, validade_inicio: e.target.value || null })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Validade Fim</Label>
                    <Input type="date" value={editItem?.validade_fim || ""} onChange={(e) => setEditItem({ ...editItem, validade_fim: e.target.value || null })} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
                  <Button size="sm" onClick={editItem?.id ? salvarEdicao : criarConhecimento} disabled={isCreating}>
                    <Save className="mr-1 h-3 w-3" />{editItem?.id ? "Salvar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : filtrados.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum conhecimento corporativo encontrado.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((item) => {
            const temDistribuicoes = item.id === viewItem?.id;
            return (
              <Card key={item.id} className={item.status === "inativo" || item.status === "arquivado" ? "opacity-60" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => {
                      setViewItem(viewItem?.id === item.id ? null : item);
                      if (viewItem?.id !== item.id) carregarDistribuicoes(item.id);
                    }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{item.titulo}</span>
                        <Badge className={`text-[9px] ${TIPO_CORES[item.tipo_conhecimento] || ""}`}>
                          {getTipoLabel(item.tipo_conhecimento)}
                        </Badge>
                        <Badge className={`text-[9px] ${STATUS_CORES[item.status] || ""}`}>{item.status}</Badge>
                        <Badge variant="outline" className="text-[9px]">v{item.versao}</Badge>
                        {item.categoria && <Badge variant="secondary" className="text-[9px]">{item.categoria}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.conteudo?.slice(0, 200)}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        {item.setor && <span>Setor: {item.setor}</span>}
                        {item.validade_fim && <span>Validade: {item.validade_fim}</span>}
                        <span>Criado: {fmtData(item.criado_em)}</span>
                        {item.criado_por && <span>Por: {item.criado_por.substring(0, 8)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => setEditItem({ ...item })}>
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader><DialogTitle>Editar: {item.titulo}</DialogTitle></DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <Label className="text-xs">Título</Label>
                                <Input value={editItem?.titulo || ""} onChange={(e) => setEditItem({ ...editItem, titulo: e.target.value })} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Tipo</Label>
                                <Select value={editItem?.tipo_conhecimento || "outro"} onValueChange={(v) => setEditItem({ ...editItem, tipo_conhecimento: v })}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="procedimento">Procedimento</SelectItem>
                                    <SelectItem value="politica">Política</SelectItem>
                                    <SelectItem value="contrato">Contrato</SelectItem>
                                    <SelectItem value="tabela_preco">Tabela Preço</SelectItem>
                                    <SelectItem value="treinamento">Treinamento</SelectItem>
                                    <SelectItem value="compliance">Compliance</SelectItem>
                                    <SelectItem value="outro">Outro</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Conteúdo</Label>
                              <Textarea value={editItem?.conteudo || ""} onChange={(e) => setEditItem({ ...editItem, conteudo: e.target.value })} className="min-h-[100px]" />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => setEditItem(null)}>Cancelar</Button>
                              <Button size="sm" onClick={salvarEdicao}>Salvar</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* EXPANDED DETAILS */}
                  {viewItem?.id === item.id && (
                    <div className="mt-4 pt-3 border-t space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">Ações</h4>
                          <div className="flex flex-wrap gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => criarNovaVersao(item.id)}>
                              <History className="mr-1 h-3 w-3" />Nova Versão
                            </Button>
                            {item.status !== "ativo" && (
                              <Button variant="outline" size="sm" className="h-7 text-[10px] text-green-600" onClick={() => alterarStatus(item.id, "ativo")}>
                                <CheckCircle2 className="mr-1 h-3 w-3" />Ativar
                              </Button>
                            )}
                            {item.status === "ativo" && (
                              <Button variant="outline" size="sm" className="h-7 text-[10px] text-red-600" onClick={() => alterarStatus(item.id, "inativo")}>
                                <XCircle className="mr-1 h-3 w-3" />Desativar
                              </Button>
                            )}
                            {item.status === "rascunho" && (
                              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => alterarStatus(item.id, "ativo")}>
                                <CheckCircle2 className="mr-1 h-3 w-3" />Publicar
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">Upload de Arquivo</h4>
                          <div className="flex items-center gap-2">
                            <input
                              type="file"
                              id={`upload-${item.id}`}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleFileUpload(item.id, file);
                                e.target.value = "";
                              }}
                            />
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" disabled={uploading} onClick={() => document.getElementById(`upload-${item.id}`)?.click()}>
                              <Upload className="mr-1 h-3 w-3" />{uploading ? "Enviando..." : "Anexar"}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold text-muted-foreground">Vinculação</h4>
                          <div className="flex items-center gap-2">
                            <Select onValueChange={(roboId) => vincularRoboHandler(item.id, roboId)}>
                              <SelectTrigger className="w-40 h-7 text-[10px]"><SelectValue placeholder="Vincular robô..." /></SelectTrigger>
                              <SelectContent>
                                {robos.filter((r) => !distribuicoes.find((d) => d.robo_id === r.id)).map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {distribuicoes.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                            <Link2 className="h-3 w-3 inline mr-1" />Robôs Vinculados ({distribuicoes.length})
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {distribuicoes.map((d) => (
                              <Badge key={d.id} variant="secondary" className="text-[10px] flex items-center gap-1">
                                {d.robo_nome || d.robo_id.substring(0, 8)}
                                {d.obrigatorio && <span className="text-red-500">*</span>}
                                <span className={PRIORIDADE_CORES[d.prioridade] || ""}>{d.prioridade}</span>
                                <button className="ml-1 text-red-500 hover:text-red-700" onClick={() => desvincularRoboHandler(item.id, d.robo_id)}>
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
