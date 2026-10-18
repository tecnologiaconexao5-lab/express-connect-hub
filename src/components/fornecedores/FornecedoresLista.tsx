import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Eye, Pencil, Power, PowerOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fornecedor, TIPO_PESSOA_LABEL, STATUS_FORNECEDOR_LABEL, STATUS_FORNECEDOR_COR } from "./types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import PaginationBar from "@/components/ui/PaginationBar";
import { ProgressiveBlocksLoader } from "@/components/ui/ProgressiveBlocksLoader";

interface Props {
  onSelect: (f: Fornecedor) => void;
  onNew: () => void;
}

const PAGE_SIZE = 25;

const formatDoc = (doc: string) => {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return doc;
};

const FornecedoresLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [quickView, setQuickView] = useState<Fornecedor | null>(null);
  const [inativarItem, setInativarItem] = useState<Fornecedor | null>(null);

  const fetchFornecedores = useCallback(async () => {
    try {
      setIsLoading(true);
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase.from("fornecedores").select("*", { count: "exact" });

      if (statusFilter !== "todos") {
        query = query.eq("status", statusFilter);
      }

      const { data, error, count } = await query
        .order("razao_social", { ascending: true })
        .range(from, to);

      if (error) throw error;
      setFornecedores((data as Fornecedor[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("[FornecedoresLista] Erro ao buscar:", err);
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchFornecedores(); }, [fetchFornecedores]);

  const filtered = fornecedores.filter((f) => {
    if (!busca) return true;
    const lower = busca.toLowerCase();
    return (
      f.razao_social.toLowerCase().includes(lower) ||
      (f.nome_fantasia ?? "").toLowerCase().includes(lower) ||
      f.cpf_cnpj.includes(busca) ||
      f.cpf_cnpj.replace(/\D/g, "").includes(busca.replace(/\D/g, ""))
    );
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleInativar = async () => {
    if (!inativarItem) return;

    try {
      const { count } = await supabase
        .from("financeiro_pagar")
        .select("id", { count: "exact", head: true })
        .eq("fornecedor_cadastro_id", inativarItem.id)
        .in("status", ["aberto", "pendente", "a vencer"]);

      if (count && count > 0) {
        toast.warning(`Existem ${count} titulos abertos para este fornecedor. Inativando, os titulos serao mantidos.`);
      }

      const { error } = await supabase
        .from("fornecedores")
        .update({ status: "inativo" })
        .eq("id", inativarItem.id);
      if (error) throw error;
      toast.success("Fornecedor inativado!");
      fetchFornecedores();
    } catch (err) {
      toast.error("Erro ao inativar");
    }
    setInativarItem(null);
  };

  const handleReativar = async (f: Fornecedor) => {
    try {
      const { error } = await supabase
        .from("fornecedores")
        .update({ status: "ativo" })
        .eq("id", f.id);
      if (error) throw error;
      toast.success("Fornecedor reativado!");
      fetchFornecedores();
    } catch (err) {
      toast.error("Erro ao reativar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por razao social, fantasia ou CPF/CNPJ..."
            className="pl-9 bg-card"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex gap-2">
          <select
            className="border rounded-md px-3 py-2 text-sm bg-card"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="todos">Todos</option>
            <option value="ativo">Ativos</option>
            <option value="inativo">Inativos</option>
          </select>
          <Button className="bg-green-600 hover:bg-green-700" onClick={onNew}>
            <Plus className="w-4 h-4 mr-2" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razao Social / Fantasia</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <ProgressiveBlocksLoader size="normal" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum fornecedor encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((f) => (
                  <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(f)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{f.razao_social}</p>
                        {f.nome_fantasia && <p className="text-xs text-muted-foreground">{f.nome_fantasia}</p>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{TIPO_PESSOA_LABEL[f.tipo_pessoa]}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{formatDoc(f.cpf_cnpj)}</TableCell>
                    <TableCell>{f.telefone || "—"}</TableCell>
                    <TableCell>{f.cidade && f.uf ? `${f.cidade}/${f.uf}` : f.cidade || f.uf || "—"}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_FORNECEDOR_COR[f.status]}>
                        {STATUS_FORNECEDOR_LABEL[f.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => onSelect(f)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onSelect(f)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {f.status === "ativo" ? (
                          <Button variant="ghost" size="sm" onClick={() => setInativarItem(f)}>
                            <PowerOff className="w-4 h-4 text-orange-500" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => handleReativar(f)}>
                            <Power className="w-4 h-4 text-green-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <PaginationBar
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Quick View Dialog */}
      <Dialog open={!!quickView} onOpenChange={(open) => { if (!open) setQuickView(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{quickView?.razao_social}</DialogTitle>
          </DialogHeader>
          {quickView && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Tipo:</span> {TIPO_PESSOA_LABEL[quickView.tipo_pessoa]}</div>
                <div><span className="text-muted-foreground">CPF/CNPJ:</span> {formatDoc(quickView.cpf_cnpj)}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {quickView.telefone || "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {quickView.email || "—"}</div>
                <div><span className="text-muted-foreground">Cidade:</span> {quickView.cidade || "—"}</div>
                <div><span className="text-muted-foreground">UF:</span> {quickView.uf || "—"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Inativar */}
      <Dialog open={!!inativarItem} onOpenChange={(open) => { if (!open) setInativarItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Inativar Fornecedor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja inativar <strong>{inativarItem?.razao_social}</strong>?
            O historico financeiro sera mantido.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setInativarItem(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleInativar}>Inativar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FornecedoresLista;
