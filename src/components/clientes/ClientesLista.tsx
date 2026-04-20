import { useState, useEffect } from "react";
import { Search, Plus, Filter, Edit, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { Cliente } from "./types";
import { toast } from "sonner";

interface Props {
  onSelect: (id: string) => void;
  onNew: () => void;
}

const ClientesLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    try {
      setIsLoading(true);
      const TABLE_NAME = "clientes";
      console.log("CARREGANDO CLIENTES...");
      const { data, error } = await supabase.from(TABLE_NAME).select("*").order("razao_social");
      console.log("DATA:", data);
      console.log("ERROR:", error);
      if (error) {
        console.error(`[ClientesLista] Erro no fetch da '${TABLE_NAME}':`, error.message);
        console.error("  details:", error.details);
        console.error("  hint:", error.hint);
        console.error("  code:", error.code);
        throw error;
      }
      console.log(`[ClientesLista] Fetch OK da '${TABLE_NAME}':`, data?.length, "registros");
      setClientes((data as Cliente[]) || []);
    } catch (error) {
      console.error("[ClientesLista] Erro catch fetch:", error);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = clientes.filter((c) =>
    (c.razaoSocial?.toLowerCase() || "").includes(busca.toLowerCase()) || 
    (c.cnpj || "").includes(busca)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Clientes</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} cliente(s) encontrado(s)</p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-primary">
          <Plus className="w-4 h-4" /> Cadastrar Cliente
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por razão social ou CNPJ..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Filter className="w-4 h-4" /> Filtros</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Razão Social</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Segmento</TableHead>
                <TableHead>Localidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>OS / Mês</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(c.id)}>
                    <TableCell>
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs bg-muted">{(c.razaoSocial || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{c.razaoSocial}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.cnpj}</TableCell>
                    <TableCell className="text-sm">{c.segmento || "—"}</TableCell>
                    <TableCell className="text-sm">{c.cidade ? `${c.cidade}/${c.uf}` : "—"}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.status === "Ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                        {c.status || "Ativo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{c.numOsMes || 0}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}><Edit className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientesLista;
