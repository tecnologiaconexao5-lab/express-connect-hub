import { useState, useEffect } from "react";
import { Search, Plus, Star, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Prestador, TIPO_PARCEIRO_LABEL, TIPO_PARCEIRO_COR, STATUS_LABEL, STATUS_COR, TIPO_VEICULO_LABEL } from "./types";
import { mockPrestadores } from "./mockPrestadores";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface Props {
  onSelect: (p: Prestador) => void;
  onNew: () => void;
}

const PAGE_SIZE = 10;

const PrestadoresLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [regiaoFilter, setRegiaoFilter] = useState("todos");
  const [veiculoFilter, setVeiculoFilter] = useState("todos");
  const [docFilter, setDocFilter] = useState("todos");
  const [scoreFilter, setScoreFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [prestadores, setPrestadores] = useState<Prestador[]>(mockPrestadores);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPrestadores();
  }, []);

  const fetchPrestadores = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from('prestadores').select('*');
      if (error) throw error;
      if (data && data.length > 0) {
        setPrestadores(data as Prestador[]);
      }
    } catch (error) {
      console.error("Erro ao buscar prestadores:", error);
      toast.error("Erro ao carregar dados do Supabase. Usando dados locais.");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = prestadores.filter((p) => {
    if (busca && !p.nomeCompleto.toLowerCase().includes(busca.toLowerCase()) && !p.cpfCnpj.includes(busca)) return false;
    if (statusFilter !== "todos" && p.status !== statusFilter) return false;
    if (tipoFilter !== "todos" && p.tipoParceiro !== tipoFilter) return false;
    if (regiaoFilter !== "todos" && p.regiaoPrincipal !== regiaoFilter) return false;
    if (veiculoFilter !== "todos" && !p.veiculos?.some((v) => v.tipoVeiculo === veiculoFilter)) return false;
    if (docFilter === "vencido" && !p.documentos?.some((d) => d.status === "vencido")) return false;
    if (docFilter === "vencendo" && !p.documentos?.some((d) => d.status === "vencendo")) return false;
    if (docFilter === "pendente" && !p.documentos?.some((d) => d.status === "pendente")) return false;
    if (scoreFilter !== "todos") {
      const minScore = Number(scoreFilter);
      if (p.scoreInterno < minScore) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const regioes = [...new Set(prestadores.map((p) => p.regiaoPrincipal))];

  const renderStars = (score: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(score) ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{score.toFixed(1)}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Prestadores</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} parceiro(s) encontrado(s)</p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white">
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
        <Card>
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="analise">Em análise</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <Select value={tipoFilter} onValueChange={(v) => { setTipoFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="autonomo">Autônomo</SelectItem>
                  <SelectItem value="agregado">Agregado</SelectItem>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="esporadico">Esporádico</SelectItem>
                  <SelectItem value="terceiro">Terceiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Região</label>
              <Select value={regiaoFilter} onValueChange={(v) => { setRegiaoFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {regioes.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo veículo</label>
              <Select value={veiculoFilter} onValueChange={(v) => { setVeiculoFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="toco">Toco</SelectItem>
                  <SelectItem value="carreta">Carreta</SelectItem>
                  <SelectItem value="utilitario_leve">Utilitário</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Documentação</label>
              <Select value={docFilter} onValueChange={(v) => { setDocFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="vencendo">Vencendo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Score mínimo</label>
              <Select value={scoreFilter} onValueChange={(v) => { setScoreFilter(v); setPage(1); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
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
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Região</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Veículo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(p)}>
                  <TableCell>
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-muted">{p.nomeCompleto.split(" ").map((n) => n[0]).slice(0, 2).join("")}</AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium text-sm">{p.nomeFantasia || p.nomeCompleto}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.cpfCnpj}</TableCell>
                  <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TIPO_PARCEIRO_COR[p.tipoParceiro]}`}>{TIPO_PARCEIRO_LABEL[p.tipoParceiro]}</span></TableCell>
                  <TableCell><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COR[p.status]}`}>{STATUS_LABEL[p.status]}</span></TableCell>
                  <TableCell className="text-sm">{p.regiaoPrincipal}</TableCell>
                  <TableCell>{renderStars(p.scoreInterno)}</TableCell>
                  <TableCell className="text-sm">{p.veiculos?.[0] ? TIPO_VEICULO_LABEL[p.veiculos[0].tipoVeiculo] : "—"}</TableCell>
                </TableRow>
              ))}
              {paginated.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum prestador encontrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrestadoresLista;
