import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Star, ChevronLeft, ChevronRight, Filter, Copy, Check, Eye, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Prestador, TIPO_PARCEIRO_LABEL, TIPO_PARCEIRO_COR, STATUS_LABEL, STATUS_COR, TIPO_VEICULO_LABEL, normalizarStatusPrestador, statusAliases } from "./types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { fromPrestadorRow, PrestadorRow } from "@/lib/dbMappers";
import { formatarDataBR } from "@/lib/formatDates";
import { useAuth } from "@/contexts/AuthContext";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

interface Props {
  onSelect: (p: Prestador) => void;
  onNew: () => void;
  refreshKey?: number;
}

const PAGE_SIZE = 25;

const safeSplit = (value: unknown, separator: string) =>
  String(value || "").split(separator).filter(Boolean);

const getInitials = (name: string) => safeSplit(name, " ").map((n: string) => n[0]).slice(0, 2).join("");

const getVisiblePages = (current: number, total: number): (number | "...")[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
};

const PrestadoresLista = ({ onSelect, onNew, refreshKey }: Props) => {
  const { user } = useAuth();
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [tipoFilter, setTipoFilter] = useState("todos");
  const [regiaoFilter, setRegiaoFilter] = useState("todos");
  const [scoreFilter, setScoreFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickViewPrestador, setQuickViewPrestador] = useState<Prestador | null>(null);
  const [deletePrestador, setDeletePrestador] = useState<Prestador | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  // E2E-05D — contador de novos cadastros do APP aguardando validação (vem do banco).
  const [appPendingCount, setAppPendingCount] = useState(0);
  const [aprovandoId, setAprovandoId] = useState<string | null>(null);

  const fetchPrestadores = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);

      // 1. Build base query with search + filters for COUNT
      let countQuery = supabase.from("prestadores").select("*", { count: "exact", head: true });
      let dataQuery = supabase.from("prestadores").select("*");

      const trimmedBusca = busca.trim();
      if (trimmedBusca) {
        const pattern = `%${trimmedBusca}%`;
        countQuery = countQuery.or(`nome_completo.ilike.${pattern},cpf_cnpj.ilike.${pattern}`);
        dataQuery = dataQuery.or(`nome_completo.ilike.${pattern},cpf_cnpj.ilike.${pattern}`);
      }
      if (statusFilter !== "todos") {
        // E2E-05D — aceita aliases: 'analise' cobre 'em_analise'; 'ativo' cobre 'aprovado'.
        countQuery = countQuery.in("status", statusAliases(statusFilter));
        dataQuery = dataQuery.in("status", statusAliases(statusFilter));
      }
      if (tipoFilter !== "todos") {
        countQuery = countQuery.eq("tipo_parceiro", tipoFilter);
        dataQuery = dataQuery.eq("tipo_parceiro", tipoFilter);
      }
      if (regiaoFilter !== "todos") {
        countQuery = countQuery.eq("regiao_principal", regiaoFilter);
        dataQuery = dataQuery.eq("regiao_principal", regiaoFilter);
      }
      if (scoreFilter !== "todos") {
        const minScore = Number(scoreFilter);
        countQuery = countQuery.gte("score_interno", minScore);
        dataQuery = dataQuery.gte("score_interno", minScore);
      }

      // 2. Get filtered total count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      const total = count ?? 0;
      setTotalCount(total);

      // E2E-05D — contador real (banco) de cadastros do APP aguardando validação.
      // Falha aqui NÃO pode derrubar a listagem: try/catch isolado + status NULL
      // somado (normalizarStatusPrestador trata null como 'analise' no badge).
      try {
        const [pendentes, pendentesSemStatus] = await Promise.all([
          supabase
            .from("prestadores")
            .select("*", { count: "exact", head: true })
            .eq("origem_cadastro", "app_motorista")
            .in("status", ["analise", "em_analise"]),
          supabase
            .from("prestadores")
            .select("*", { count: "exact", head: true })
            .eq("origem_cadastro", "app_motorista")
            .is("status", null),
        ]);
        if (pendentes.error) throw pendentes.error;
        if (pendentesSemStatus.error) throw pendentesSemStatus.error;
        setAppPendingCount((pendentes.count ?? 0) + (pendentesSemStatus.count ?? 0));
      } catch (contadorErro: any) {
        console.warn("Erro ao contar cadastros do APP pendentes:", contadorErro?.message || contadorErro);
      }

      // 3. Sort globally A→Z (NULLs last) + paginate
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await dataQuery
        .order("nome_completo", { ascending: true, nullsFirst: false })
        .range(from, to);

      if (error) throw error;

      // 4. Fetch vehicles for current page
      const veiculosMap: Record<string, any[]> = {};
      if (data && data.length > 0) {
        const ids = data.map((d) => d.id);
        const { data: veiculosData } = await supabase
          .from("veiculos")
          .select("*")
          .in("prestador_vinculado", ids);
        if (veiculosData) {
          for (const v of veiculosData) {
            const pid = v.prestador_vinculado;
            if (pid) {
              if (!veiculosMap[pid]) veiculosMap[pid] = [];
              veiculosMap[pid].push({
                id: v.id,
                placa: v.placa,
                tipoVeiculo: v.tipo_veiculo || v.tipo,
                marca: v.marca,
                modelo: v.modelo,
                ano: v.ano_fabricacao,
                capacidadeKg: v.capacidade_kg,
                capacidadeM3: v.capacidade_m3,
                tipoCarga: v.tipo_carga,
                principal: v.status === "Principal",
              });
            }
          }
        }
      }

      // 5. Map to Prestador objects
      const normalizados = (data as PrestadorRow[]).map((item) => {
        const mapped = fromPrestadorRow(item);
        const pid = mapped.id;
        const prestadorVeiculos = pid && veiculosMap[pid] ? veiculosMap[pid] : [];
        const docsRaw = (item as unknown as Record<string, unknown>).documentos;
        const contatosRaw = (item as unknown as Record<string, unknown>).contatos_emergencia;
        return {
          ...mapped,
          nomeCompleto: mapped.nomeCompleto || "Nome não informado",
          veiculos: prestadorVeiculos,
          documentos: docsRaw ? (typeof docsRaw === "string" ? JSON.parse(docsRaw) : docsRaw) : [],
          contatosEmergencia: contatosRaw ? (typeof contatosRaw === "string" ? JSON.parse(contatosRaw) : contatosRaw) : [],
        } as Prestador;
      });

      setPrestadores(normalizados);
    } catch (error: any) {
      console.error("Erro ao buscar prestadores:", error);
      setFetchError(error?.message || "Erro ao carregar prestadores");
      setPrestadores([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [busca, statusFilter, tipoFilter, regiaoFilter, scoreFilter, page]);

  // Aprovação direta de cadastro vindo do APP do Motorista.
  const handleAprovarPrestador = async (prestador: Prestador) => {
    if (!prestador.id || aprovandoId) return;
    setAprovandoId(prestador.id);
    try {
      const { error } = await supabase
        .from("prestadores")
        .update({ status: "ativo", liberado_app: true, updated_at: new Date().toISOString() })
        .eq("id", prestador.id);
      if (error) throw error;

      toast.success(`Prestador ${prestador.nomeCompleto} aprovado!`, {
        description: "Cadastro do APP liberado para operar na Rede de Oportunidades.",
      });
      await fetchPrestadores();
    } catch (error) {
      toast.error("Não foi possível aprovar o prestador.", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setAprovandoId(null);
    }
  };

  useEffect(() => {
    fetchPrestadores();
  }, [fetchPrestadores]);

  // External refresh trigger (after save/delete in parent)
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      fetchPrestadores();
    }
  }, [refreshKey]);

  const handleSearchChange = (value: string) => {
    setBusca(value);
    setPage(1);
  };

  const handleFilterChange = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    setPage(1);
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return "-";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

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
      if (!user || (user.role !== "super_admin" && user.role !== "admin")) {
        toast.error("Apenas administradores podem excluir prestadores");
        return;
      }
      const { data: cfgData } = await supabase
        .from("configuracoes_sistema")
        .select("valor")
        .eq("chave", "senha_admin")
        .maybeSingle();
      if (cfgData?.valor && adminPassword !== cfgData.valor) {
        toast.error("Senha administrativa incorreta");
        return;
      }
      const { error } = await supabase.from("prestadores").delete().eq("id", deletePrestador.id);
      if (error) throw error;
      toast.success("Prestador excluído com sucesso");
      setDeletePrestador(null);
      setAdminPassword("");
      fetchPrestadores();
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

  const visiblePages = getVisiblePages(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Prestadores</h2>
          <p className="text-sm text-muted-foreground">{totalCount} parceiro(s) encontrado(s)</p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-200/50">
          <Plus className="w-4 h-4" />
          Cadastrar Prestador
        </Button>
      </div>

      {/* E2E-05D — Alerta de novos cadastros do APP aguardando validação (contagem do banco) */}
      {appPendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs font-semibold text-amber-800">
            {appPendingCount} novo(s) cadastro(s) do APP aguardando validação
          </p>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 text-[11px] border-amber-300 text-amber-800 hover:bg-amber-100"
            onClick={() => handleFilterChange(setStatusFilter)("analise")}
          >
            Ver em análise
          </Button>
        </div>
      )}

      {/* Busca + toggle filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou CPF/CNPJ..."
            value={busca}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
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
              <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
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
              <Select value={tipoFilter} onValueChange={handleFilterChange(setTipoFilter)}>
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
              <Select value={regiaoFilter} onValueChange={handleFilterChange(setRegiaoFilter)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Regiões</SelectItem>
                  {["NORTE", "NORDESTE", "CENTRO_OESTE", "SUDESTE", "SUL"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Score mínimo</label>
              <Select value={scoreFilter} onValueChange={handleFilterChange(setScoreFilter)}>
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

      {/* Error state */}
      {fetchError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">Erro ao carregar prestadores</p>
              <p className="text-xs text-red-600">{fetchError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchPrestadores()} className="shrink-0">
              Tentar novamente
            </Button>
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
              {isLoading && prestadores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-20">
                    <ProgressiveBlocksLoader size="normal" />
                  </TableCell>
                </TableRow>
              ) : !isLoading && prestadores.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="w-10 h-10 opacity-20" />
                      <p className="text-sm font-medium">
                        {fetchError
                          ? "Erro ao carregar prestadores."
                          : busca.trim()
                          ? "Nenhum prestador encontrado para esta busca."
                          : "Nenhum prestador cadastrado."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                prestadores.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => onSelect(p)}>
                    <TableCell>
                      <Avatar className="w-9 h-9 border-2 border-background shadow-sm">
                        <AvatarImage src={p.foto || undefined} alt="Foto" className="object-cover" />
                        <AvatarFallback className="text-[10px] font-bold bg-muted">{getInitials(p.nomeCompleto || "")}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {p.nomeCompleto || "Nome não informado"}
                        </span>
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
                      {formatarDataBR(p.dataCadastro) || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {p.origemCadastro === "app_motorista" && normalizarStatusPrestador(p.status) === "analise" && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 bg-emerald-600 px-2 text-[10px] font-bold text-white hover:bg-emerald-700"
                            disabled={aprovandoId === p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAprovarPrestador(p);
                            }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {aprovandoId === p.id ? "Aprovando..." : "Aprovar Prestador"}
                          </Button>
                        )}
                        <Badge className={`text-[9px] uppercase font-bold px-2 ${STATUS_COR[normalizarStatusPrestador(p.status)] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[normalizarStatusPrestador(p.status)] || "—"}
                        </Badge>
                        {p.origemCadastro === "app_motorista" && normalizarStatusPrestador(p.status) === "analise" && (
                          <Badge className="text-[9px] uppercase font-bold px-2 bg-amber-100 text-amber-800 border border-amber-300">
                            📱 Via App
                          </Badge>
                        )}
                      </div>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginacao numerada */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground font-medium">
            Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </Button>
            {visiblePages.map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs">...</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-xs font-bold"
                  disabled={isLoading}
                  onClick={() => setPage(p)}
                >
                  {p}
                </Button>
              )
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage(page + 1)}
            >
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
