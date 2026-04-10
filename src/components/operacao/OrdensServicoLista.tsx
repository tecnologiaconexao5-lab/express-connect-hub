import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Plus, Filter, Edit, Eye, AlertTriangle, Truck, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { OrdemServico, OSStatus, STATUS_CORES } from "./osTypes";
import OrdemServicoForm from "./OrdemServicoForm";

const OrdensServicoLista = () => {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [osSelecionada, setOsSelecionada] = useState<OrdemServico | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchOrdens();
    if (searchParams.get("action") === "novo") {
      setModoForm("novo");
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get("status")) {
      setBusca(searchParams.get("status") || "");
    }
  }, [searchParams]);

  const fetchOrdens = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("ordens_servico").select("*").order("numero", { ascending: false });
      if (error) throw error;
      setOrdens((data as any) || []);
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao buscar ordens de serviço.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSalvar = () => {
    setModoForm(null);
    setOsSelecionada(null);
    fetchOrdens();
  };

  const isAtrasada = (os: OrdemServico) => {
    // mock verification
    if (os.status === "finalizada" || os.status === "cancelada") return false;
    const dateStr = os.previsaoTermino || os.data;
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < new Date().getTime();
  };

  const filtradas = ordens.filter(os => 
    os.numero.toLowerCase().includes(busca.toLowerCase()) || 
    (os.cliente || "").toLowerCase().includes(busca.toLowerCase()) ||
    (os.prestador || "").toLowerCase().includes(busca.toLowerCase())
  );

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (modoForm) {
    return (
      <OrdemServicoForm
        os={osSelecionada || undefined}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setOsSelecionada(null); fetchOrdens(); }}
        onSalvar={handleSalvar}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Ordens de Serviço</h2>
          <p className="text-sm text-muted-foreground">{filtradas.length} OS encontrada(s)</p>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setModoForm("novo")}>
          <Plus className="w-4 h-4 mr-1" /> Nova OS
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex gap-3 flex-wrap">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, cliente, prestador..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline"><Filter className="w-4 h-4 mr-1" /> Filtros Avançados</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OS</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Rota & Veículo</TableHead>
                <TableHead>Prestador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Carregando...</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma de Serviço encontrada. Crie sua primeira OS.</TableCell></TableRow>
              ) : filtradas.map(os => {
                const atrasada = isAtrasada(os);
                const comOcorrencia = os.status === "com ocorrencia";
                const bg = atrasada ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-muted/50 cursor-pointer";

                return (
                  <TableRow key={os.id} className={bg} onClick={() => { setOsSelecionada(os); setModoForm("ver"); }}>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        {comOcorrencia && <AlertTriangle className="w-4 h-4 text-orange-500" title="Com Ocorrência" />}
                        {os.numero}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(os.data).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell>
                       <span className="text-sm font-semibold">{os.cliente || "—"}</span>
                       <div className="text-xs text-muted-foreground">{os.tipoOperacao}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm"><MapPin className="w-3 h-3 text-muted-foreground"/> <span className="truncate max-w-[150px]">{os.unidade || "Rota Única"}</span></div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5"><Truck className="w-3 h-3"/> {os.veiculoTipo || "Não alocado"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6"><AvatarFallback className="text-[10px]">{os.prestador ? os.prestador[0] : "?"}</AvatarFallback></Avatar>
                        <span className="text-sm">{os.prestador || "Pendente"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${STATUS_CORES[os.status]?.twClass || "bg-gray-100 text-gray-800"}`}>
                        {STATUS_CORES[os.status]?.label || os.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className={`text-sm ${atrasada ? 'text-red-600 font-semibold' : ''}`}>
                        {os.previsaoTermino ? new Date(os.previsaoTermino).toLocaleDateString() : "Sem prazo"}
                      </div>
                      {atrasada && <span className="text-xs text-red-500">Atrasada</span>}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                       <Button variant="ghost" size="icon" onClick={() => { setOsSelecionada(os); setModoForm("ver"); }}><Eye className="w-4 h-4"/></Button>
                       <Button variant="ghost" size="icon" onClick={() => { setOsSelecionada(os); setModoForm("editar"); }}><Edit className="w-4 h-4"/></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdensServicoLista;
