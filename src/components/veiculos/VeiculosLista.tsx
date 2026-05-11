import { useState, useEffect } from "react";
import { Search, Plus, Filter, Edit, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { Veiculo } from "./types";
import { toast } from "sonner";

interface Props {
  onSelect: (id: string) => void;
  onNew: () => void;
}

const VeiculosLista = ({ onSelect, onNew }: Props) => {
  const [busca, setBusca] = useState("");
  const [tipoCargaFilter, setTipoCargaFilter] = useState("todos");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchVeiculos();
  }, []);

  const fetchVeiculos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("veiculos").select("*").order("placa");
      if (error) throw error;
      setVeiculos((data as Veiculo[]) || []);
    } catch (error) {
      console.error("Erro ao buscar veículos no Supabase, usando localStorage:", error);
      const localData = localStorage.getItem("veiculos_fallback");
      if (localData) {
        setVeiculos(JSON.parse(localData));
      } else {
        setVeiculos([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = veiculos.filter((v) => {
    const matchBusca = (v.placa || "").toLowerCase().includes(busca.toLowerCase()) ||
      (v.prestador_vinculado || "").toLowerCase().includes(busca.toLowerCase());
    const matchTipoCarga = tipoCargaFilter === "todos" || v.tipoCarga === tipoCargaFilter;
    return matchBusca && matchTipoCarga;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Veículos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} veículo(s) encontrado(s)</p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-primary">
          <Plus className="w-4 h-4" /> Cadastrar Veículo
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por placa ou prestador..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
        </div>
        <Select value={tipoCargaFilter} onValueChange={setTipoCargaFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Tipo Carga" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="seco">Seco</SelectItem>
            <SelectItem value="refrigerado">Refrigerado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tipo Carga</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Ano</TableHead>
                <TableHead>Prestador Vinculado</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alertas</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Nenhum veículo encontrado.</TableCell></TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(v.id)}>
                    <TableCell className="font-semibold">{v.placa.toUpperCase()}</TableCell>
                    <TableCell className="text-sm">{v.tipo_veiculo || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${v.tipoCarga === 'refrigerado' ? 'bg-blue-100 text-blue-700' : v.tipoCarga === 'seco' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {v.tipoCarga || 'Nao definido'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{v.marca} {v.modelo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.ano_fabricacao}/{v.ano_modelo}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">{v.prestador_vinculado || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${v.status === "Ativo" ? "bg-green-100 text-green-700" : v.status === "Manutenção" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {v.status || "Ativo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {/* Lógica simulada de alerta documental */}
                      {v.validade_documental && new Date(v.validade_documental) < new Date() ? (
                        <div className="flex items-center text-red-600 gap-1"><AlertTriangle className="w-4 h-4" /><span className="text-xs">Vencido</span></div>
                      ) : <span className="text-xs text-muted-foreground">OK</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={(e) => { e.stopPropagation(); onSelect(v.id); }}><Edit className="w-4 h-4" /></Button>
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

export default VeiculosLista;
