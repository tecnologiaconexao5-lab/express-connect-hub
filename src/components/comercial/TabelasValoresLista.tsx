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
      const { data, error } = await supabase
        .from("tabelas_valores")
        .select("*")
        .order("nome", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false });
      
      if (error) {
        console.error("[TabelasValores] Erro ao carregar:", error);
        if (error.code === "42P01") {
          setTabelas([]);
          return;
        }
        if (error.message?.includes("nome")) {
          const { data: data2, error: error2 } = await supabase
            .from("tabelas_valores")
            .select("*")
            .order("created_at", { ascending: false });
          if (!error2) {
            setTabelas((data2 as any) || []);
            return;
          }
        }
        throw error;
      }
      
      const normalizedData = (data as any[])?.map((t: any) => ({
        ...t,
        id: t.id,
        nome: t.nome || "",
        cliente: t.cliente || "",
        unidade: t.unidade || "",
        tipoOperacao: t.tipo_operacao || "",
        segmentoCliente: t.segmento_cliente || "",
        dataInicio: t.data_inicio || "",
        dataFim: t.data_fim || "",
        status: t.status || "rascunho",
        versao: t.versao || 1,
        tipoTabela: t.tipo_tabela || "principal",
        observacoes: t.observacoes || "",
        cobrancaPrincipais: Array.isArray(t.cobranca_principais) ? t.cobranca_principais : [],
        tipoVeiculo: t.tipo_veiculo || "",
        subcategoriaVeiculo: t.subcategoria_veiculo || "",
        classificacaoTermica: t.classificacao_termica || "seco",
        valorBase: t.valor_base || 0,
        minimoFaturavel: t.minimo_faturavel || 0,
        custoPrestador: t.custo_prestador || 0,
        markupPercent: t.markup_percent || 0,
        margemMinimaPercent: t.margem_minima_percent || 20,
        custoMinimoPrestador: t.custo_minimo_prestador || 0,
        franquiaKm: t.franquia_km || 0,
        valorKmExcedente: t.valor_km_excedente || 0,
        arredondamento: t.arredondamento || "normal",
        cobrancaRetorno: (t.cobranca_retorno && typeof t.cobranca_retorno === 'object') ? t.cobranca_retorno : { cobrado: false, percentual: 0 },
        faixas: Array.isArray(t.faixas) ? t.faixas : [],
        adicionais: (t.adicionais && typeof t.adicionais === 'object') ? t.adicionais : {},
        contaContabil: t.conta_contabil || "",
        centroCustoPadrao: t.centro_custo_padrao || "",
        universal: t.universal || false,
      })) || [];
      
      setTabelas(normalizedData);
    } catch (e: any) {
      console.error("[TabelasValores] Erro catch:", e);
      if (e.code !== "42P01") toast.error("Erro ao carregar tabelas de valores.");
      setTabelas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filtradas = tabelas.filter(t => 
    t.nome?.toLowerCase().includes(busca.toLowerCase()) || 
    t.cliente?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleDuplicar = async (tab: TabelaValores) => {
    const novaVersao = tab.versao + 1;
    
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

  const handleSalvarTabela = async (tabela: TabelaValores) => {
    try {
      const payload = {
        nome: tabela.nome,
        cliente: tabela.cliente,
        unidade: tabela.unidade,
        tipo_operacao: tabela.tipoOperacao,
        segmento_cliente: tabela.segmentoCliente,
        data_inicio: tabela.dataInicio || null,
        data_fim: tabela.dataFim || null,
        status: tabela.status,
        versao: tabela.versao,
        tipo_tabela: tabela.tipoTabela,
        observacoes: tabela.observacoes,
        cobranca_principais: tabela.cobrancaPrincipais,
        tipo_veiculo: tabela.tipoVeiculo,
        subcategoria_veiculo: tabela.subcategoriaVeiculo,
        classificacao_termica: tabela.classificacaoTermica,
        valor_base: tabela.valorBase,
        minimo_faturavel: tabela.minimoFaturavel,
        custo_prestador: tabela.custoPrestador,
        markup_percent: tabela.markupPercent,
        margem_minima_percent: tabela.margemMinimaPercent,
        custo_minimo_prestador: tabela.custoMinimoPrestador,
        franquia_km: tabela.franquiaKm,
        valor_km_excedente: tabela.valorKmExcedente,
        arredondamento: tabela.arredondamento,
        cobranca_retorno: tabela.cobrancaRetorno,
        faixas: tabela.faixas,
        adicionais: tabela.adicionais,
        conta_contabil: tabela.contaContabil,
        centro_custo_padrao: tabela.centroCustoPadrao,
        universal: !tabela.cliente,
      };

      let error;
      if (modoForm === "novo") {
        const result = await supabase.from("tabelas_valores").insert([payload]);
        error = result.error;
      } else {
        const result = await supabase.from("tabelas_valores").update(payload).eq("id", tabela.id);
        error = result.error;
      }

      if (error) {
        console.error("[TabelasValores] Erro ao salvar:", error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }

      toast.success("Tabela salva com sucesso!");
      setModoForm(null);
      setTabelaSelecionada(null);
      fetchTabelas();
    } catch (e) {
      console.error("[TabelasValores] Erro catch salvar:", e);
      toast.error("Erro ao salvar tabela.");
    }
  };

  if (modoForm) {
    return (
      <TabelaValoresForm
        tabela={tabelaSelecionada || undefined}
        modo={modoForm}
        onVoltar={() => { setModoForm(null); setTabelaSelecionada(null); fetchTabelas(); }}
        onSalvar={handleSalvarTabela}
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
                    {tab.dataInicio ? new Date(tab.dataInicio).toLocaleDateString() : ""} - {tab.dataFim ? new Date(tab.dataFim).toLocaleDateString() : ""}
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
