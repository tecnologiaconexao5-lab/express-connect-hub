import { useState, useEffect } from "react";
import { Search, Plus, Filter, Edit, Copy, CheckCircle, XCircle, FileDown, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import TabelaValoresForm from "./TabelaValoresForm";
import { TabelaValores } from "./tabelaValoresTypes";

const TabelasValoresLista = () => {
  const [tabelas, setTabelas] = useState<TabelaValores[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modoForm, setModoForm] = useState<"ver" | "editar" | "novo" | null>(null);
  const [tabelaSelecionada, setTabelaSelecionada] = useState<TabelaValores | null>(null);

  useEffect(() => {
    fetchTabelas();
  }, []);

  const fetchTabelas = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("tabelas_valores").select("*").order("nome");
      if (error) throw error;
      // Preenche lista mas se vazio a UI lida.
      setTabelas((data as any) || []);
    } catch (e: any) {
      if (e.code !== "42P01") toast.error("Erro ao carregar tabelas de valores.");
    } finally {
      setIsLoading(false);
    }
  };

  const filtradas = tabelas.filter(t => 
    t.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    t.cliente?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleDuplicar = async (tab: TabelaValores) => {
    const parts = tab.versao.split(".");
    const novaVersao = `${parts[0]}.${parseInt(parts[1] || "0") + 1}`;
    
    const novaTabela = {
      ...tab,
      id: undefined,
      nome: `${tab.nome} (Cópia)`,
      versao: novaVersao,
      status: "rascunho"
    };

    try {
      const { error } = await supabase.from("tabelas_valores").insert([novaTabela]);
      if (error) throw error;
      toast.success("Tabela duplicada com sucesso.");
      fetchTabelas();
    } catch (e) {
      toast.error("Erro ao duplicar!");
    }
  };

  const updateStatus = async (id: string, novoStatus: string) => {
    try {
      const { error } = await supabase.from("tabelas_valores").update({ status: novoStatus }).eq("id", id);
      if (error) throw error;
      toast.success(`Status alterado para ${novoStatus}.`);
      fetchTabelas();
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  if (modoForm) {
    return (
      <TabelaValoresForm
        tabela={tabelaSelecionada || undefined}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setTabelaSelecionada(null); fetchTabelas(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Tabelas de Valores</h2>
          <p className="text-sm text-muted-foreground">{filtradas.length} tabela(s) de preços cadastradas</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><FileDown className="w-4 h-4" /> Exportar</Button>
          <Button variant="outline" className="gap-2"><Layers className="w-4 h-4" /> Importar</Button>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setModoForm("novo")}>
            <Plus className="w-4 h-4 mr-1" /> Nova Tabela
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome da tabela ou cliente..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5"><Filter className="w-4 h-4" /> Filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cliente Vinculado</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6">Carregando...</TableCell></TableRow>
              ) : filtradas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhuma tabela cadastrada ou encontrada.</TableCell></TableRow>
              ) : filtradas.map((tab) => (
                <TableRow key={tab.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setTabelaSelecionada(tab); setModoForm("ver"); }}>
                  <TableCell className="font-semibold">{tab.nome}</TableCell>
                  <TableCell>{tab.cliente || "Todos"}</TableCell>
                  <TableCell>{tab.tipoOperacao || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tab.vigenciaInicial ? new Date(tab.vigenciaInicial).toLocaleDateString() : ""} - {tab.vigenciaFinal ? new Date(tab.vigenciaFinal).toLocaleDateString() : ""}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">v{tab.versao}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
                      ${tab.status === "ativa" ? "bg-green-100 text-green-700" :
                        tab.status === "inativa" ? "bg-red-100 text-red-700" :
                        tab.status === "vencida" ? "bg-gray-100 text-gray-700" :
                        "bg-orange-100 text-orange-700"}`}>
                      {tab.status?.toUpperCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => { setTabelaSelecionada(tab); setModoForm("editar"); }}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicar(tab)}><Copy className="w-4 h-4" /></Button>
                      {tab.status !== "ativa" && <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" title="Ativar" onClick={() => updateStatus(tab.id, "ativa")}><CheckCircle className="w-4 h-4" /></Button>}
                      {tab.status === "ativa" && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" title="Inativar" onClick={() => updateStatus(tab.id, "inativa")}><XCircle className="w-4 h-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TabelasValoresLista;
