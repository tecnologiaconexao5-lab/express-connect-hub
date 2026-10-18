import { useState, useEffect, useCallback } from "react";
import { Search, Plus, FileText, BookOpen, Video, Music, Image, HelpCircle, Upload, RefreshCw, ChevronDown, ChevronRight, Trash2, Clock, CheckCircle, AlertTriangle, Archive, Copy, BadgeCheck, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { academyService, type AcademiaCurso, type AcademiaMaterial, type StatusAcademia, type TipoMaterial } from "@/services/ia/academyService";
import { centralIaService, type AutomacaoRobo } from "@/services/centralIaService";

const STATUS_ACADEMIA_LABELS: Record<StatusAcademia, string> = {
  rascunho: "Rascunho", em_andamento: "Em Andamento", aprovado: "Aprovado",
  obsoleto: "Obsoleto", revogado: "Revogado",
};

const STATUS_ACADEMIA_COLORS: Record<StatusAcademia, string> = {
  rascunho: "bg-yellow-100 text-yellow-800 border-yellow-300",
  em_andamento: "bg-blue-100 text-blue-800 border-blue-300",
  aprovado: "bg-green-100 text-green-800 border-green-300",
  obsoleto: "bg-gray-100 text-gray-500 border-gray-300",
  revogado: "bg-red-100 text-red-800 border-red-300",
};

const TIPO_MATERIAL_ICON: Record<TipoMaterial, React.ElementType> = {
  texto: FileText, pergunta_resposta: HelpCircle, pdf: FileText,
  doc: FileText, docx: FileText, xls: FileText, xlsx: FileText,
  csv: FileText, xml: FileText, imagem: Image, audio: Music, video: Video,
};

const TIPO_MATERIAL_LABEL: Record<TipoMaterial, string> = {
  texto: "Texto", pergunta_resposta: "Pergunta e Resposta", pdf: "PDF",
  doc: "Word (DOC)", docx: "Word (DOCX)", xls: "Excel (XLS)", xlsx: "Excel (XLSX)",
  csv: "CSV", xml: "XML", imagem: "Imagem", audio: "Áudio", video: "Vídeo",
};

type TabView = "dashboard" | "cursos" | "materiais";

export function AcademyTab() {
  const [view, setView] = useState<TabView>("dashboard");
  const [robos, setRobos] = useState<AutomacaoRobo[]>([]);
  const [cursos, setCursos] = useState<AcademiaCurso[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [roboFilter, setRoboFilter] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCurso, setEditCurso] = useState<AcademiaCurso | null>(null);
  const [selectedCurso, setSelectedCurso] = useState<AcademiaCurso | null>(null);
  const [materiais, setMateriais] = useState<AcademiaMaterial[]>([]);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editMaterial, setEditMaterial] = useState<AcademiaMaterial | null>(null);
  const [loading, setLoading] = useState(false);

  const [formCurso, setFormCurso] = useState({ robo_id: "", titulo: "", descricao: "", tipo: "curso", categoria: "", objetivo: "", tags: "", validade: "" });
  const [formMaterial, setFormMaterial] = useState({ tipo: "texto" as TipoMaterial, titulo: "", conteudo: "", pergunta: "", resposta: "", ordem: 0 });

  const loadCursos = useCallback(async () => {
    setLoading(true);
    const filtros: any = {};
    if (statusFilter !== "todos") filtros.status = statusFilter;
    if (roboFilter !== "todos") filtros.robo_id = roboFilter;
    if (search) filtros.search = search;
    const data = await academyService.listarCursos(filtros);
    setCursos(data);
    setLoading(false);
  }, [search, statusFilter, roboFilter]);

  const loadRobos = useCallback(async () => {
    const data = await centralIaService.listarRobos();
    setRobos(data);
  }, []);

  const loadMateriais = useCallback(async (cursoId: string) => {
    const data = await academyService.listarMateriais(cursoId);
    setMateriais(data);
  }, []);

  useEffect(() => { loadRobos(); }, [loadRobos]);
  useEffect(() => { if (view === "cursos" || view === "dashboard") loadCursos(); }, [view, loadCursos]);

  async function handleSalvarCurso() {
    if (!formCurso.titulo.trim()) { toast.error("Título é obrigatório"); return; }
    if (editCurso) {
      await academyService.atualizarCurso(editCurso.id, {
        titulo: formCurso.titulo, descricao: formCurso.descricao || null,
        tipo: formCurso.tipo, categoria: formCurso.categoria || null,
        objetivo: formCurso.objetivo || null, tags: formCurso.tags ? formCurso.tags.split(",").map(t => t.trim()) : [],
        validade: formCurso.validade || null, robo_id: formCurso.robo_id || null,
      } as any);
      toast.success("Curso atualizado");
    } else {
      await academyService.criarCurso({
        robo_id: formCurso.robo_id || undefined, titulo: formCurso.titulo,
        descricao: formCurso.descricao, tipo: formCurso.tipo, categoria: formCurso.categoria,
        objetivo: formCurso.objetivo, tags: formCurso.tags ? formCurso.tags.split(",").map(t => t.trim()) : [],
        validade: formCurso.validade,
      });
      toast.success("Curso criado");
    }
    setDialogOpen(false);
    setEditCurso(null);
    resetFormCurso();
    loadCursos();
  }

  function resetFormCurso() {
    setFormCurso({ robo_id: "", titulo: "", descricao: "", tipo: "curso", categoria: "", objetivo: "", tags: "", validade: "" });
  }

  function abrirEditarCurso(curso: AcademiaCurso) {
    setEditCurso(curso);
    setFormCurso({
      robo_id: curso.robo_id || "", titulo: curso.titulo, descricao: curso.descricao || "",
      tipo: curso.tipo, categoria: curso.categoria || "", objetivo: curso.objetivo || "",
      tags: (curso.tags || []).join(", "), validade: curso.validade || "",
    });
    setDialogOpen(true);
  }

  function abrirNovoCurso() {
    setEditCurso(null);
    resetFormCurso();
    setDialogOpen(true);
  }

  async function handleStatusCurso(id: string, status: StatusAcademia) {
    await academyService.alterarStatusCurso(id, status);
    toast.success(`Status alterado para ${STATUS_ACADEMIA_LABELS[status]}`);
    loadCursos();
  }

  async function handleNovaVersao(id: string) {
    const novo = await academyService.criarNovaVersaoCurso(id);
    if (novo) { toast.success("Nova versão criada"); loadCursos(); }
    else toast.error("Erro ao criar versão");
  }

  async function abrirCurso(curso: AcademiaCurso) {
    setSelectedCurso(curso);
    setView("materiais");
    await loadMateriais(curso.id);
  }

  function voltar() { setSelectedCurso(null); setView("cursos"); }

  async function handleSalvarMaterial() {
    if (!formMaterial.titulo.trim() || !selectedCurso) { toast.error("Título é obrigatório"); return; }
    if (editMaterial) {
      await academyService.atualizarMaterial(editMaterial.id, {
        tipo: formMaterial.tipo, titulo: formMaterial.titulo, conteudo: formMaterial.conteudo || null,
        pergunta: formMaterial.pergunta || null, resposta: formMaterial.resposta || null,
      } as any);
      toast.success("Material atualizado");
    } else {
      await academyService.criarMaterial({
        curso_id: selectedCurso.id, tipo: formMaterial.tipo, titulo: formMaterial.titulo,
        conteudo: formMaterial.conteudo, pergunta: formMaterial.pergunta, resposta: formMaterial.resposta,
        ordem: materiais.length,
      });
      toast.success("Material adicionado");
    }
    setMaterialDialogOpen(false);
    setEditMaterial(null);
    resetFormMaterial();
    loadMateriais(selectedCurso.id);
  }

  function abrirNovoMaterial() { setEditMaterial(null); resetFormMaterial(); setMaterialDialogOpen(true); }

  function resetFormMaterial() {
    setFormMaterial({ tipo: "texto", titulo: "", conteudo: "", pergunta: "", resposta: "", ordem: 0 });
  }

  async function handleUploadArquivo(cursoId: string, materialId: string, roboId: string, file: File, tipo: TipoMaterial) {
    const result = await academyService.uploadMaterialArquivo(cursoId, materialId, roboId, file, tipo);
    if (result) toast.success("Arquivo enviado");
    else toast.error("Erro no upload");
    loadMateriais(cursoId);
  }

  async function handleDeletarMaterial(id: string) {
    await academyService.deletarMaterial(id);
    toast.success("Material removido");
    if (selectedCurso) loadMateriais(selectedCurso.id);
  }

  const stats = {
    total: cursos.length,
    rascunho: cursos.filter(c => c.status === "rascunho").length,
    aprovado: cursos.filter(c => c.status === "aprovado").length,
    em_andamento: cursos.filter(c => c.status === "em_andamento").length,
    obsoleto: cursos.filter(c => c.status === "obsoleto" || c.status === "revogado").length,
  };

  if (view === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Academia IA</h2>
            <p className="text-muted-foreground">Centro de treinamento dos Funcionários Digitais</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadCursos}><RefreshCw className="h-4 w-4 mr-1" />Atualizar</Button>
            <Button size="sm" onClick={() => { abrirNovoCurso(); setView("cursos"); }}><Plus className="h-4 w-4 mr-1" />Novo Curso</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Cursos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rascunho</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-yellow-600">{stats.rascunho}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Em Andamento</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-blue-600">{stats.em_andamento}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Aprovados</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-green-600">{stats.aprovado}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Obsoletos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-gray-500">{stats.obsoleto}</div></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Funcionários Digitais</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
              {robos.map(robo => {
                const cursosRobo = cursos.filter(c => c.robo_id === robo.id);
                return (
                  <Card key={robo.id} className="p-3 cursor-pointer hover:bg-accent" onClick={() => setView("cursos")}>
                    <div className="font-medium">{robo.nome}</div>
                    <div className="text-sm text-muted-foreground">{cursosRobo.length} curso(s)</div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimos Cursos</CardTitle></CardHeader>
          <CardContent>
            {cursos.slice(0, 10).map(curso => (
              <div key={curso.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <span className="font-medium">{curso.titulo}</span>
                  <span className="ml-2 text-sm text-muted-foreground">v{curso.versao}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_ACADEMIA_COLORS[curso.status as StatusAcademia] || ""}>{STATUS_ACADEMIA_LABELS[curso.status as StatusAcademia] || curso.status}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => abrirCurso(curso)}><FileText className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
            {cursos.length === 0 && <p className="text-muted-foreground text-sm">Nenhum curso cadastrado</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "materiais" && selectedCurso) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={voltar} className="mb-1">&larr; Voltar</Button>
            <h2 className="text-2xl font-bold tracking-tight">{selectedCurso.titulo}</h2>
            <p className="text-muted-foreground">
              v{selectedCurso.versao} &middot; {STATUS_ACADEMIA_LABELS[selectedCurso.status as StatusAcademia] || selectedCurso.status}
              {selectedCurso.robo_id && robos.find(r => r.id === selectedCurso.robo_id) && <> &middot; {robos.find(r => r.id === selectedCurso.robo_id)?.nome}</>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => abrirEditarCurso(selectedCurso)}><FileText className="h-4 w-4 mr-1" />Editar Curso</Button>
            <Button size="sm" onClick={abrirNovoMaterial}><Plus className="h-4 w-4 mr-1" />Adicionar Material</Button>
          </div>
        </div>

        {selectedCurso.objetivo && (
          <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{selectedCurso.objetivo}</p></CardContent></Card>
        )}

        <div className="space-y-2">
          {materiais.map((mat, idx) => {
            const Icon = TIPO_MATERIAL_ICON[mat.tipo] || FileText;
            return (
              <Card key={mat.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mat.titulo}</span>
                        <Badge variant="outline" className="text-xs">{TIPO_MATERIAL_LABEL[mat.tipo]}</Badge>
                        {mat.versao > 1 && <span className="text-xs text-muted-foreground">v{mat.versao}</span>}
                      </div>
                      {mat.tipo === "texto" && mat.conteudo && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{mat.conteudo}</p>}
                      {mat.tipo === "pergunta_resposta" && (
                        <div className="mt-1 space-y-1">
                          <p className="text-sm font-medium">Q: {mat.pergunta}</p>
                          <p className="text-sm text-muted-foreground">R: {mat.resposta}</p>
                        </div>
                      )}
                      {mat.arquivo_url && (
                        <div className="mt-1 flex items-center gap-2">
                          <a href={mat.arquivo_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Abrir arquivo</a>
                          {mat.tamanho_bytes && <span className="text-xs text-muted-foreground">({(mat.tamanho_bytes / 1024).toFixed(1)} KB)</span>}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    {["pdf","doc","docx","xls","xlsx","csv","xml","imagem","audio","video"].includes(mat.tipo) && (
                      <input type="file" id={`upload-${mat.id}`} className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0]; if (file && selectedCurso.robo_id) handleUploadArquivo(selectedCurso.id, mat.id, selectedCurso.robo_id, file, mat.tipo);
                      }} accept={
                        mat.tipo === "pdf" ? ".pdf" : mat.tipo === "imagem" ? "image/*" : mat.tipo === "audio" ? "audio/*" : mat.tipo === "video" ? "video/*" : undefined
                      } />
                    )}
                    {["pdf","doc","docx","xls","xlsx","csv","xml","imagem","audio","video"].includes(mat.tipo) && (
                      <Button variant="ghost" size="sm" onClick={() => document.getElementById(`upload-${mat.id}`)?.click()}><Upload className="h-4 w-4" /></Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => handleDeletarMaterial(mat.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {materiais.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum material neste curso. Clique em "Adicionar Material" para começar.</CardContent></Card>
          )}
        </div>

        <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>{editMaterial ? "Editar Material" : "Adicionar Material"}</DialogTitle><DialogDescription>Adicione conteúdo de treinamento para o Funcionário Digital.</DialogDescription></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de Material</Label>
                <Select value={formMaterial.tipo} onValueChange={(v: TipoMaterial) => setFormMaterial({ ...formMaterial, tipo: v, conteudo: "", pergunta: "", resposta: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_MATERIAL_LABEL).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título</Label>
                <Input value={formMaterial.titulo} onChange={e => setFormMaterial({ ...formMaterial, titulo: e.target.value })} placeholder="Ex: Procedimento de segurança" />
              </div>
              {formMaterial.tipo === "texto" && (
                <div><Label>Conteúdo</Label><Textarea value={formMaterial.conteudo} onChange={e => setFormMaterial({ ...formMaterial, conteudo: e.target.value })} rows={8} placeholder="Digite o conteúdo de treinamento..." /></div>
              )}
              {formMaterial.tipo === "pergunta_resposta" && (
                <>
                  <div><Label>Pergunta</Label><Textarea value={formMaterial.pergunta} onChange={e => setFormMaterial({ ...formMaterial, pergunta: e.target.value })} rows={3} placeholder="Ex: Como agir em caso de atraso?" /></div>
                  <div><Label>Resposta</Label><Textarea value={formMaterial.resposta} onChange={e => setFormMaterial({ ...formMaterial, resposta: e.target.value })} rows={5} placeholder="Ex: O procedimento padrão é..." /></div>
                </>
              )}
              {["pdf","doc","docx","xls","xlsx","csv","xml","imagem","audio","video"].includes(formMaterial.tipo) && (
                <div>
                  <Label>Upload de Arquivo</Label>
                  <p className="text-sm text-muted-foreground mb-2">O upload será feito após salvar o material.</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSalvarMaterial}>{editMaterial ? "Atualizar" : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Cursos de Treinamento</h2>
          <p className="text-muted-foreground">{cursos.length} curso(s) cadastrado(s)</p>
        </div>
        <Button size="sm" onClick={abrirNovoCurso}><Plus className="h-4 w-4 mr-1" />Novo Curso</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar cursos..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            {Object.entries(STATUS_ACADEMIA_LABELS).map(([k, v]) => (<SelectItem key={k} value={k}>{v}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={roboFilter} onValueChange={setRoboFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Funcionário Digital" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos robôs</SelectItem>
            {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={loadCursos}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
      </div>

      <div className="space-y-2">
        {cursos.map(curso => {
          const robo = robos.find(r => r.id === curso.robo_id);
          return (
            <Card key={curso.id} className="p-4 cursor-pointer hover:bg-accent/50" onClick={() => abrirCurso(curso)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{curso.titulo}</span>
                    <Badge className={STATUS_ACADEMIA_COLORS[curso.status as StatusAcademia] || ""}>{STATUS_ACADEMIA_LABELS[curso.status as StatusAcademia] || curso.status}</Badge>
                    <Badge variant="outline">v{curso.versao}</Badge>
                  </div>
                  {curso.descricao && <p className="text-sm text-muted-foreground mt-1">{curso.descricao}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    {robo && <span>🤖 {robo.nome}</span>}
                    {curso.categoria && <span>📂 {curso.categoria}</span>}
                    {curso.validade && <span>⏰ Válido até {new Date(curso.validade).toLocaleDateString("pt-BR")}</span>}
                    <span>📅 {new Date(curso.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4" onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => handleNovaVersao(curso.id)} title="Nova versão"><Copy className="h-4 w-4" /></Button>
                  {curso.status === "rascunho" && <Button variant="ghost" size="sm" onClick={() => handleStatusCurso(curso.id, "em_andamento")} title="Iniciar"><PlayIcon className="h-4 w-4" /></Button>}
                  {curso.status === "em_andamento" && <Button variant="ghost" size="sm" onClick={() => handleStatusCurso(curso.id, "aprovado")} title="Aprovar"><BadgeCheck className="h-4 w-4 text-green-500" /></Button>}
                  {curso.status === "aprovado" && <Button variant="ghost" size="sm" onClick={() => handleStatusCurso(curso.id, "obsoleto")} title="Obsoleto"><Archive className="h-4 w-4" /></Button>}
                  {curso.status !== "revogado" && <Button variant="ghost" size="sm" onClick={() => handleStatusCurso(curso.id, "revogado")} title="Revogar"><XCircle className="h-4 w-4 text-red-500" /></Button>}
                  <Button variant="ghost" size="sm" onClick={() => abrirEditarCurso(curso)}><FileText className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          );
        })}
        {cursos.length === 0 && !loading && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum curso encontrado</p>
            <p className="text-sm mt-1">Crie o primeiro curso de treinamento para começar.</p>
            <Button className="mt-4" onClick={abrirNovoCurso}><Plus className="h-4 w-4 mr-1" />Criar Curso</Button>
          </CardContent></Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editCurso ? "Editar Curso" : "Novo Curso"}</DialogTitle><DialogDescription>Configure o curso de treinamento para o Funcionário Digital.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Título *</Label><Input value={formCurso.titulo} onChange={e => setFormCurso({ ...formCurso, titulo: e.target.value })} placeholder="Ex: Treinamento de Atendimento ao Cliente" /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={formCurso.descricao} onChange={e => setFormCurso({ ...formCurso, descricao: e.target.value })} rows={3} placeholder="Descrição do curso..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Funcionário Digital</Label>
                <Select value={formCurso.robo_id} onValueChange={v => setFormCurso({ ...formCurso, robo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar robô" /></SelectTrigger>
                  <SelectContent>
                    {robos.map(r => (<SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Tipo</Label>
                <Select value={formCurso.tipo} onValueChange={v => setFormCurso({ ...formCurso, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="modulo">Módulo</SelectItem>
                    <SelectItem value="curso">Curso</SelectItem>
                    <SelectItem value="licao">Lição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Categoria</Label><Input value={formCurso.categoria} onChange={e => setFormCurso({ ...formCurso, categoria: e.target.value })} placeholder="Ex: Operacional" /></div>
              <div><Label>Validade</Label><Input type="date" value={formCurso.validade} onChange={e => setFormCurso({ ...formCurso, validade: e.target.value })} /></div>
            </div>
            <div><Label>Objetivo</Label><Textarea value={formCurso.objetivo} onChange={e => setFormCurso({ ...formCurso, objetivo: e.target.value })} rows={2} placeholder="O que o robô deve aprender com este curso..." /></div>
            <div><Label>Tags (separadas por vírgula)</Label><Input value={formCurso.tags} onChange={e => setFormCurso({ ...formCurso, tags: e.target.value })} placeholder="Ex: atendimento, cliente, procedimento" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvarCurso}>{editCurso ? "Atualizar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PlayIcon(props: any) { return <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="5 3 19 12 5 21 5 3" /></svg>; }
