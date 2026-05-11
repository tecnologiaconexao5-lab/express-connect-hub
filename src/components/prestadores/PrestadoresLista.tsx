import { useState, useEffect } from "react";
import { Search, Plus, Star, ChevronLeft, ChevronRight, Filter, Copy, Check, Eye, Trash2, Sparkles, Truck, CreditCard, Upload, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Prestador, TIPO_PARCEIRO_LABEL, TIPO_PARCEIRO_COR, STATUS_LABEL, STATUS_COR, TIPO_VEICULO_LABEL } from "./types";
import { mockPrestadores } from "./mockPrestadores";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { fromPrestadorRow, PrestadorRow } from "@/lib/dbMappers";

interface Props {
  onSelect: (p: Prestador) => void;
  onNew: () => void;
}

const PAGE_SIZE = 10;

const safeSplit = (value: unknown, separator: string) =>
  String(value || "").split(separator).filter(Boolean);

const getInitials = (name: string) => safeSplit(name, " ").map((n: string) => n[0]).slice(0, 2).join("");

const PrestadoresLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [regiaoFilter, setRegiaoFilter] = useState("todos");
  const [scoreFilter, setScoreFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickViewPrestador, setQuickViewPrestador] = useState<Prestador | null>(null);
  const [deletePrestador, setDeletePrestador] = useState<Prestador | null>(null);
  const [adminPassword, setAdminPassword] = useState("");

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "-";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const fetchPrestadores = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('prestadores').select('*');
      if (error) {
        if (error.code === "42P01") {
          setPrestadores(mockPrestadores);
          return;
        }
        throw error;
      }
      if (data && data.length > 0) {
        // Buscar veículos da tabela veiculos
        const { data: veiculosData } = await supabase.from('veiculos').select('*');
        const veiculosMap: Record<string, any[]> = {};
        if (veiculosData) {
          for (const v of veiculosData) {
            const pid = v.prestador_vinculado;
            if (pid) {
              if (!veiculosMap[pid]) veiculosMap[pid] = [];
              veiculosMap[pid].push({
                id: v.id,
                placa: v.placa,
                tipoVeiculo: v.tipo_veiculo,
                marca: v.marca,
                modelo: v.modelo,
                ano: v.ano_fabricacao,
                capacidadeKg: v.capacidade_kg,
                capacidadeM3: v.capacidade_m3,
                tipoCarga: v.tipo_carga,
                principal: v.status === 'Principal'
              });
            }
          }
        }

        const normalizados = (data as PrestadorRow[]).map((item) => {
          const mapped = fromPrestadorRow(item);
          const pid = mapped.id;
          const prestadorVeiculos = pid && veiculosMap[pid] ? veiculosMap[pid] : [];
          
          return {
            ...mapped,
            veiculos: prestadorVeiculos,
            documentos: mapped.documentos || [],
            contatosEmergencia: mapped.contatosEmergencia || [],
          } as Prestador;
        });
        setPrestadores(normalizados);
      } else {
        setPrestadores(mockPrestadores);
      }
    } catch (error) {
      console.error("Erro ao buscar prestadores:", error);
      setPrestadores(mockPrestadores);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = prestadores.filter((p) => {
    // Filtrar lixo/vazio
    if (!p.nomeCompleto || p.nomeCompleto === "-" || p.nomeCompleto === "—") return false;

    const buscaLower = (busca || "").toLowerCase();
    const nome = p.nomeCompleto || "";
    const documento = p.cpfCnpj || "";
    if (busca && !nome.toLowerCase().includes(buscaLower) && !documento.includes(busca)) return false;
    if (statusFilter !== "todos" && p.status !== statusFilter) return false;
    if (tipoFilter !== "todos" && p.tipoParceiro !== tipoFilter) return false;
    if (regiaoFilter !== "todos" && p.regiaoPrincipal !== regiaoFilter) return false;
    if (scoreFilter !== "todos") {
      const minScore = Number(scoreFilter);
      if (p.scoreInterno < minScore) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const regioes = [...new Set(prestadores.map((p) => p.regiaoPrincipal).filter(Boolean))];

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  const handleDelete = async () => {
    if (!deletePrestador) return;
    try {
      const { data, error: fetchError } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", "senha_admin").maybeSingle();
      if (fetchError) throw fetchError;
      const senhaCorreta = data?.valor || "admin123";
      if (adminPassword !== senhaCorreta) {
        toast.error("Senha administrativa incorreta");
        return;
      }
      const { error } = await supabase.from("prestadores").delete().eq("id", deletePrestador.id);
      if (error) throw error;
      setPrestadores(prestadores.filter(p => p.id !== deletePrestador.id));
      toast.success("Prestador excluído com sucesso");
      setDeletePrestador(null);
      setAdminPassword("");
    } catch (err: any) {
      console.error("Erro ao excluir:", err);
      toast.error("Erro ao excluir prestador");
    }
  };

  const getVeiculoDisplay = (p: Prestador) => {
    const veiculos = p.veiculos || [];
    if (veiculos.length === 0) return "—";
    const v = veiculos[0];
    const tipo = TIPO_VEICULO_LABEL[v.tipoVeiculo as keyof typeof TIPO_VEICULO_LABEL] || v.tipoVeiculo || "Outro";
    return `${tipo} — ${v.placa || ""}`;
  };

  const renderStars = (score?: number) => {
    const safeScore = Number(score || 0);
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(safeScore) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
        ))}
        <span className="text-xs text-muted-foreground ml-1">{safeScore.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Prestadores</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} parceiro(s) encontrado(s)</p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50">
          <Plus className="w-4 h-4" />
          Cadastrar Prestador
        </Button>
      </div>

      {/* Busca + toggle filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF/CNPJ..." value={busca} onChange={(e) => { setBusca(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5">
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {/* Filtros expandidos */}
      {showFilters && (
        <Card className="border-muted/60 shadow-sm animate-in slide-in-from-top-2 duration-200">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Status</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="analise">Em análise</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</label>
              <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                  <SelectItem value="agregado">Agregado</SelectItem>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="esporadico">Esporádico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Região</label>
              <Select value={regiaoFilter} onValueChange={(v) => { setRegiaoFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Regiões</SelectItem>
                  {regioes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Score mínimo</label>
              <Select value={scoreFilter} onValueChange={(v) => { setScoreFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Qualquer Score</SelectItem>
                  <SelectItem value="4">4+ estrelas</SelectItem>
                  <SelectItem value="3">3+ estrelas</SelectItem>
                  <SelectItem value="2">2+ estrelas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className="border-muted/60 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-xs uppercase font-bold">Nome / Documento</TableHead>
                <TableHead className="text-xs uppercase font-bold">Contato</TableHead>
                <TableHead className="text-xs uppercase font-bold">Tipo</TableHead>
                <TableHead className="text-xs uppercase font-bold">Região</TableHead>
                <TableHead className="text-xs uppercase font-bold">Veículo Principal</TableHead>
                <TableHead className="text-xs uppercase font-bold">Valor Diária</TableHead>
                <TableHead className="text-xs uppercase font-bold">Cadastro</TableHead>
                <TableHead className="text-xs uppercase font-bold">Status</TableHead>
                <TableHead className="text-right text-xs uppercase font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => onSelect(p)}>
                  <TableCell>
                    <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                      {p.foto ? (
                         <img src={p.foto} alt="Foto" className="w-full h-full object-cover rounded-full" />
                      ) : (
                         <AvatarFallback className="text-[10px] font-bold bg-muted">{getInitials(p.nomeCompleto || "")}</AvatarFallback>
                      )}
                    </Avatar>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{p.nomeCompleto}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">{p.cpfCnpj || "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-muted-foreground">{p.telefone || p.whatsapp || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-[9px] uppercase font-bold px-2 ${TIPO_PARCEIRO_COR[p.tipoParceiro as keyof typeof TIPO_PARCEIRO_COR] || "bg-gray-100 text-gray-600"}`}>
                      {TIPO_PARCEIRO_LABEL[p.tipoParceiro as keyof typeof TIPO_PARCEIRO_LABEL] || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{p.regiaoPrincipal || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-bold text-foreground">{getVeiculoDisplay(p)}</span>
                      {p.veiculos?.[0]?.tipoCarga && <span className="text-[9px] uppercase text-muted-foreground font-medium">{p.veiculos[0].tipoCarga}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-bold text-emerald-600">
                    {p.valorDiaria ? `R$ ${p.valorDiaria.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.dataCadastro ? new Date(p.dataCadastro).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[9px] uppercase font-bold px-2 ${STATUS_COR[p.status as keyof typeof STATUS_COR] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABEL[p.status as keyof typeof STATUS_LABEL] || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary" onClick={(e) => { e.stopPropagation(); setQuickViewPrestador(p); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); setDeletePrestador(p); }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); const text = `${p.nomeCompleto}\n${p.cpfCnpj}\n${p.telefone || p.whatsapp}\n${getVeiculoDisplay(p)}`; copyToClipboard(text, p.id); }}>
                        {copiedId === p.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="w-10 h-10 opacity-20" />
                      <p className="text-sm font-medium">Nenhum prestador encontrado para esta busca.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground font-medium">Mostrando {paginated.length} de {filtered.length} prestadores</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            <div className="flex items-center px-4 h-8 bg-muted/30 rounded-md text-xs font-bold">
              {page} / {totalPages}
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Próxima <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Visualização Rápida */}
      <Dialog open={!!quickViewPrestador} onOpenChange={() => setQuickViewPrestador(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-2xl">
          {quickViewPrestador && (
            <div className="flex flex-col">
              <div className="bg-primary/5 p-6 border-b border-muted/60">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-4 border-background shadow-lg">
                    <AvatarFallback className="bg-muted text-xl font-bold">{getInitials(quickViewPrestador.nomeCompleto || "")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold text-foreground leading-tight">{quickViewPrestador.nomeCompleto}</h3>
                      <Badge className={`${STATUS_COR[quickViewPrestador.status as keyof typeof STATUS_COR]} px-3 py-0.5 text-[10px] uppercase`}>
                        {STATUS_LABEL[quickViewPrestador.status as keyof typeof STATUS_LABEL]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                      {quickViewPrestador.cpfCnpj} • {quickViewPrestador.endereco?.cidade || "Cidade não inf."}/{quickViewPrestador.endereco?.estado || ""} • {calculateAge(quickViewPrestador.dataNascimento)} anos
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Contatos</Label>
                      <p className="text-sm font-bold flex items-center gap-1.5">
                        {quickViewPrestador.telefone || quickViewPrestador.whatsapp || "Não informado"}
                      </p>
                      {quickViewPrestador.email && <p className="text-[11px] text-muted-foreground">{quickViewPrestador.email}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Endereço Completo</Label>
                      <p className="text-xs font-medium leading-tight">
                        {quickViewPrestador.endereco?.rua ? `${quickViewPrestador.endereco.rua}, ${quickViewPrestador.endereco.numero}` : "Não informado"}<br/>
                        {quickViewPrestador.endereco?.bairro || ""}<br/>
                        {quickViewPrestador.endereco?.cidade ? `${quickViewPrestador.endereco.cidade}/${quickViewPrestador.endereco.estado}` : ""}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Região de Atuação</Label>
                      <p className="text-sm font-bold">{quickViewPrestador.regiaoPrincipal || "Não definida"}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Tipo de Parceiro</Label>
                      <p className="text-sm font-bold">{TIPO_PARCEIRO_LABEL[quickViewPrestador.tipoParceiro as keyof typeof TIPO_PARCEIRO_LABEL] || "—"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Veículo Principal</Label>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <p className="text-sm font-bold">{getVeiculoDisplay(quickViewPrestador)}</p>
                        </div>
                        {quickViewPrestador.veiculos?.[0] && (
                          <div className="flex gap-2">
                             <Badge variant="outline" className="text-[9px] uppercase">{quickViewPrestador.veiculos[0].tipoCarga || "Seco"}</Badge>
                             <Badge variant="outline" className="text-[9px] uppercase">{quickViewPrestador.veiculos[0].capacidadeKg || 0} kg</Badge>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Score Qualidade</Label>
                      <div className="flex items-center gap-1.5">
                        {renderStars(quickViewPrestador.scoreInterno)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Indicadores</Label>
                      <p className="text-sm"><span className="font-bold">{quickViewPrestador.qtdOperacoes || 0}</span> entregas</p>
                      <p className="text-sm"><span className="font-bold text-red-600">{quickViewPrestador.torreControle?.ocorrenciasGraves || 0}</span> ocorrências</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Documentação</Label>
                      <div className="flex gap-2 pt-1">
                         <Badge className={
                            !quickViewPrestador.documentos?.length ? "bg-yellow-100 text-yellow-700" :
                            quickViewPrestador.documentos.some((d) => d.status === "vencido") ? "bg-red-100 text-red-700" :
                            quickViewPrestador.documentos.some((d) => d.status === "pendente" || d.status === "vencendo") ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                         }>
                            {!quickViewPrestador.documentos?.length ? "Pendente" :
                             quickViewPrestador.documentos.some((d) => d.status === "vencido") ? "Vencido" :
                             quickViewPrestador.documentos.some((d) => d.status === "pendente" || d.status === "vencendo") ? "Pendente" :
                             "Completo"}
                         </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-muted/60 space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Observações da Torre</Label>
                  <p className="text-xs italic text-muted-foreground leading-relaxed">
                    {quickViewPrestador.observacoesTorre || "Nenhuma observação operacional registrada pela torre de controle."}
                  </p>
                </div>

                <div className="flex gap-3 pt-2 border-t border-muted/60">
                  <Button className="flex-1 shadow-lg shadow-primary/20" onClick={() => onSelect(quickViewPrestador)}>
                    Editar Cadastro Completo
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => {
                     // Simulando clique em gerar contrato abrindo e setando o estado do contrato
                     // Na lista, podemos apenas mandar para a edição, ou ter o modal lá
                     // Para simplificar, vou direcionar para edição
                     onSelect(quickViewPrestador);
                     setTimeout(() => toast.info("Clique em 'Gerar Contrato' na tela de edição."), 500);
                  }}>
                    Gerar Contrato
                  </Button>
                  <Button variant="ghost" className="flex-1" onClick={() => setQuickViewPrestador(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletePrestador} onOpenChange={() => { setDeletePrestador(null); setAdminPassword(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Excluir Prestador?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o cadastro de <strong>{deletePrestador?.nomeCompleto}</strong>? Esta ação removerá também os vínculos de veículos e documentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Senha de Segurança (Admin)</Label>
            <Input 
              type="password" 
              value={adminPassword} 
              onChange={(e) => setAdminPassword(e.target.value)} 
              placeholder="Digite a senha administrativa" 
              className="focus-visible:ring-red-500"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PrestadoresLista;
