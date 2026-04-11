import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  ArrowDownRight, DollarSign, Search, Plus, Check, X, FileText, 
  Calendar, Clock, Building, Users, Package, Receipt, TrendingUp,
  Filter, Download, Eye, Edit, Trash2,RefreshCw, ChevronDown,
  AlertTriangle, CreditCard, Landmark, ArrowRightLeft, FileCheck,
  FileX, MoreHorizontal, Calculator, PieChart, Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { 
  formatCurrency, formatDate, formatDateForInput, formatDocument,
  CATEGORIAS_RECEITA, FORMAS_PAGAMENTO, STATUS_RECEBIVEL, mockCentrosResultado, mockPlanoContas, mockContasBancarias
} from "./types";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  segmento?: string;
  status?: string;
}

interface Recebivel {
  id?: string;
  clienteId: string;
  clienteNome: string;
  clienteDocumento?: string;
  documento: string;
  serie?: string;
  numero?: string;
  osVinculadas?: string;
  contratoVinculado?: string;
  propostaVinculada?: string;
  categoriaId?: string;
  centroResultadoId?: string;
  valorBruto: number;
  desconto: number;
  juros: number;
  multa: number;
  abatimento?: number;
  valorLiquido: number;
  dataEmissao: string;
  dataVencimento: string;
  dataPrevisaoRecebimento?: string;
  dataRecebimento?: string;
  status: string;
  formaRecebimento?: string;
  contaFinanceiraId?: string;
  recorrente: boolean;
  quantidadeParcelas?: number;
  parcelaAtual?: number;
  planoContaId?: string;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const defaultRecebivel = {
  clienteId: "",
  clienteNome: "",
  clienteDocumento: "",
  documento: "",
  serie: "",
  numero: "",
  osVinculadas: "",
  contratoVinculado: "",
  propostaVinculada: "",
  categoriaId: "",
  centroResultadoId: "",
  valorBruto: 0,
  desconto: 0,
  juros: 0,
  multa: 0,
  abatimento: 0,
  valorLiquido: 0,
  dataEmissao: new Date().toISOString().split("T")[0],
  dataVencimento: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
  dataPrevisaoRecebimento: "",
  status: "pendente",
  formaRecebimento: "boleto",
  contaFinanceiraId: "",
  recorrente: false,
  quantidadeParcelas: 1,
  parcelaAtual: 1,
  planoContaId: "",
  observacoes: ""
};

export default function ContasReceberEnterprise() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recebiveis, setRecebiveis] = useState<Recebivel[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNovo, setShowNovo] = useState(false);
  const [showDetalhe, setShowDetalhe] = useState(false);
  const [showBaixa, setShowBaixa] = useState(false);
  const [showRenegociar, setShowRenegociar] = useState(false);
  const [recebivelSelecionado, setRecebivelSelecionado] = useState<Recebivel | null>(null);
  const [aba, setAba] = useState("lista");

  const [filtros, setFiltros] = useState({
    busca: "",
    status: "todos",
    cliente: "todos",
    categoria: "todos",
    centroResultado: "todos",
    dataInicio: "",
    dataFim: ""
  });

  const [novaReceita, setNovaReceita] = useState<Recebivel>(defaultRecebivel);
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);

  const [dadosBaixa, setDadosBaixa] = useState({
    dataRecebimento: new Date().toISOString().split("T")[0],
    valorRecebido: 0,
    formaRecebimento: "pix",
    contaFinanceiraId: "",
    observacoes: ""
  });

  const [dadosRenegociacao, setDadosRenegociacao] = useState({
    novoVencimento: "",
    novoValor: 0,
    quantidadeParcelas: 1,
    observacoes: ""
  });

  useEffect(() => {
    fetchRecebiveis();
    fetchClientes();
  }, []);

  const fetchRecebiveis = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.from("financeiro_receber").select("*").order("data_vencimento", { ascending: true });
      if (error && error.code !== "PGRST116") throw error;
      if (data && data.length > 0) {
        setRecebiveis(data.map((r: any) => ({
          ...r,
          valorBruto: r.valor_bruto || r.valor || 0,
          valorLiquido: r.valor_liquido || r.valor || 0,
          dataEmissao: r.data_emissao || r.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
          dataVencimento: r.data_vencimento || r.vencimento || "",
          dataPrevisaoRecebimento: r.data_previsao_recebimento || r.previsao_recebimento || "",
          dataRecebimento: r.data_recebimento || r.data_pagamento || ""
        })));
      }
    } catch (error) {
      console.error("Erro ao buscar recebíveis:", error);
      setRecebiveis([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase.from("clientes").select("id, razao_social, nome_fantasia, cnpj, cpf, email, telefone, segmento, status").order("razao_social");
      if (error) throw error;
      setClientes((data as Cliente[]) || []);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  const filtrarClientes = useCallback(() => {
    if (!buscaCliente) return [];
    const buscaLower = buscaCliente.toLowerCase();
    return clientes.filter(c => 
      (c.razao_social?.toLowerCase() || "").includes(buscaLower) ||
      (c.nome_fantasia?.toLowerCase() || "").includes(buscaLower) ||
      (c.cnpj || "").includes(buscaCliente) ||
      (c.cpf || "").includes(buscaCliente)
    ).slice(0, 10);
  }, [buscaCliente, clientes]);

  useEffect(() => {
    if (buscaCliente) {
      setClientesFiltrados(filtrarClientes());
    } else {
      setClientesFiltrados([]);
    }
  }, [buscaCliente, filtrarClientes]);

  const handleSelecionarCliente = (cliente: Cliente) => {
    const doc = cliente.cnpj || cliente.cpf || "";
    setNovaReceita({
      ...novaReceita,
      clienteId: cliente.id,
      clienteNome: cliente.razao_social,
      clienteDocumento: doc
    });
    setBuscaCliente("");
    setClientesFiltrados([]);
  };

  const valorLiquidoCalculado = useMemo(() => {
    return novaReceita.valorBruto - novaReceita.desconto + novaReceita.juros + novaReceita.multa;
  }, [novaReceita.valorBruto, novaReceita.desconto, novaReceita.juros, novaReceita.multa]);

  const handleSalvarReceita = async () => {
    if (!novaReceita.clienteId || !novaReceita.valorBruto) {
      toast.error("Preencha o cliente e valor");
      return;
    }
    try {
      const dataToSave = {
        cliente_id: novaReceita.clienteId,
        cliente_nome: novaReceita.clienteNome,
        cliente_documento: novaReceita.clienteDocumento,
        documento: novaReceita.documento || `FAT-${Date.now()}`,
        serie: novaReceita.serie,
        numero: novaReceita.numero,
        os_vinculadas: novaReceita.osVinculadas,
        contrato_vinculado: novaReceita.contratoVinculado,
        proposta_vinculada: novaReceita.propostaVinculada,
        categoria_id: novaReceita.categoriaId,
        centro_resultado_id: novaReceita.centroResultadoId,
        valor_bruto: novaReceita.valorBruto,
        desconto: novaReceita.desconto,
        juros: novaReceita.juros,
        multa: novaReceita.multa,
        abatimento: novaReceita.abatimento || 0,
        valor_liquido: valorLiquidoCalculado,
        data_emissao: novaReceita.dataEmissao,
        data_vencimento: novaReceita.dataVencimento,
        data_previsao_recebimento: novaReceita.dataPrevisaoRecebimento,
        forma_recebimento: novaReceita.formaRecebimento,
        conta_financeira_id: novaReceita.contaFinanceiraId,
        status: novaReceita.status || "pendente",
        recorrente: novaReceita.recorrente,
        quantidade_parcelas: novaReceita.quantidadeParcelas,
        parcela_atual: novaReceita.parcelaAtual,
        plano_conta_id: novaReceita.planoContaId,
        observacoes: novaReceita.observacoes
      };

      if (recebivelSelecionado?.id) {
        const { error } = await supabase.from("financeiro_receber").update(dataToSave).eq("id", recebivelSelecionado.id);
        if (error) throw error;
        toast.success("Recebível atualizado!");
      } else {
        const { error } = await supabase.from("financeiro_receber").insert([dataToSave]);
        if (error) throw error;
        toast.success("Recebível cadastrado!");
      }
      
      await fetchRecebiveis();
      setShowNovo(false);
      setRecebivelSelecionado(null);
      setNovaReceita(defaultRecebivel);
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar recebível");
    }
  };

  const handleGerarParcelas = async () => {
    if (!novaReceita.clienteId || !novaReceita.valorBruto || !novaReceita.dataVencimento) {
      toast.error("Preencha cliente, valor e vencimento");
      return;
    }
    const qtd = novaReceita.quantidadeParcelas || 1;
    const valorParcela = valorLiquidoCalculado / qtd;
    const primeiroVencimento = new Date(novaReceita.dataVencimento);
    
    try {
      const parcelas = [];
      for (let i = 0; i < qtd; i++) {
        const vencimento = new Date(primeiroVencimento);
        vencimento.setMonth(vencimento.getMonth() + i);
        
        const dataToSave = {
          cliente_id: novaReceita.clienteId,
          cliente_nome: novaReceita.clienteNome,
          cliente_documento: novaReceita.clienteDocumento,
          documento: novaReceita.documento || `FAT-${Date.now()}`,
          serie: novaReceita.serie,
          numero: `${(novaReceita.numero || "1")}/${qtd}`,
          os_vinculadas: novaReceita.osVinculadas,
          contrato_vinculado: novaReceita.contratoVinculado,
          proposta_vinculada: novaReceita.propostaVinculada,
          categoria_id: novaReceita.categoriaId,
          centro_resultado_id: novaReceita.centroResultadoId,
          valor_bruto: valorParcela,
          desconto: 0,
          juros: 0,
          multa: 0,
          abatimento: 0,
          valor_liquido: valorParcela,
          data_emissao: novaReceita.dataEmissao,
          data_vencimento: vencimento.toISOString().split("T")[0],
          forma_recebimento: novaReceita.formaRecebimento,
          status: "pendente",
          recorrente: novaReceita.recorrente,
          quantidade_parcelas: qtd,
          parcela_atual: i + 1,
          observacoes: `${novaReceita.observacoes || ""} (${i+1}/${qtd})`
        };
        
        const { error } = await supabase.from("financeiro_receber").insert([dataToSave]);
        if (error) throw error;
      }
      
      toast.success(`${qtd} parcelas geradas com sucesso!`);
      await fetchRecebiveis();
      setShowNovo(false);
      setNovaReceita(defaultRecebivel);
    } catch (error) {
      console.error("Erro ao gerar parcelas:", error);
      toast.error("Erro ao gerar parcelas");
    }
  };

  const handleBaixaParcial = async () => {
    if (!recebivelSelecionado?.id || !dadosBaixa.valorRecebido) {
      toast.error("Informe o valor recebido");
      return;
    }
    try {
      const valorAnterior = recebivelSelecionado.valorLiquido;
      const novoValor = valorAnterior - dadosBaixa.valorRecebido;
      const novoStatus = novoValor <= 0 ? "pago" : "parcial";
      
      const { error } = await supabase.from("financeiro_receber").update({
        valor_liquido: novoValor,
        status: novoStatus,
        data_recebimento: dadosBaixa.dataRecebimento,
        forma_recebimento: dadosBaixa.formaRecebimento,
        conta_financeira_id: dadosBaixa.contaFinanceiraId,
        observacoes: `${recebivelSelecionado.observacoes || ""}\nBaixa parcial: ${fmtFin(dadosBaixa.valorRecebido)} em ${dadosBaixa.dataRecebimento}`
      }).eq("id", recebivelSelecionado.id);
      
      if (error) throw error;
      toast.success("Baixa parcial realizada!");
      await fetchRecebiveis();
      setShowBaixa(false);
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error("Erro ao realizar baixa");
    }
  };

  const handleBaixaTotal = async () => {
    if (!recebivelSelecionado?.id) return;
    try {
      const { error } = await supabase.from("financeiro_receber").update({
        status: "pago",
        data_recebimento: dadosBaixa.dataRecebimento || new Date().toISOString().split("T")[0],
        forma_recebimento: dadosBaixa.formaRecebimento,
        conta_financeira_id: dadosBaixa.contaFinanceiraId,
        valor_liquido: 0,
        observacoes: `${recebivelSelecionado.observacoes}\nBaixa total em ${dadosBaixa.dataRecebimento}`
      }).eq("id", recebivelSelecionado.id);
      
      if (error) throw error;
      toast.success("Baixa total realizada!");
      await fetchRecebiveis();
      setShowBaixa(false);
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error("Erro ao realizar baixa");
    }
  };

  const handleRenegociar = async () => {
    if (!recebivelSelecionado?.id || !dadosRenegociacao.novoVencimento || !dadosRenegociacao.novoValor) {
      toast.error("Informe novo vencimento e valor");
      return;
    }
    try {
      const { error } = await supabase.from("financeiro_receber").update({
        data_vencimento: dadosRenegociacao.novoVencimento,
        valor_bruto: dadosRenegociacao.novoValor,
        valor_liquido: dadosRenegociacao.novoValor,
        status: "pendente",
        observacoes: `${recebivelSelecionado.observacoes}\nRenegociação: novo valor ${fmtFin(dadosRenegociacao.novoValor)}, vencimento ${dadosRenegociacao.novoVencimento}`
      }).eq("id", recebivelSelecionado.id);
      
      if (error) throw error;
      toast.success("Recebível renegociado!");
      await fetchRecebiveis();
      setShowRenegociar(false);
    } catch (error) {
      console.error("Erro na renegociação:", error);
      toast.error("Erro ao renegociar");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      const { error } = await supabase.from("financeiro_receber").delete().eq("id", id);
      if (error) throw error;
      toast.success("Excluído!");
      await fetchRecebiveis();
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const abrirDetalhe = (r: Recebivel) => {
    setRecebivelSelecionado(r);
    setShowDetalhe(true);
  };

  const abrirEditar = (r: Recebivel) => {
    setNovaReceita({
      ...r,
      clienteId: r.clienteId,
      clienteNome: r.clienteNome,
      clienteDocumento: r.clienteDocumento || "",
      valorBruto: r.valorBruto,
      dataEmissao: r.dataEmissao,
      dataVencimento: r.dataVencimento,
      dataPrevisaoRecebimento: r.dataPrevisaoRecebimento || "",
      recorrente: !!r.recorrente,
      quantidadeParcelas: r.quantidadeParcelas || 1,
      parcelaAtual: r.parcelaAtual || 1
    });
    setRecebivelSelecionado(r);
    setShowNovo(true);
  };

  const filtrados = useMemo(() => {
    return recibiveis.filter(r => {
      if (filtros.busca && !JSON.stringify(r).toLowerCase().includes(filtros.busca.toLowerCase())) return false;
      if (filtros.status !== "todos" && r.status !== filtros.status) return false;
      if (filtros.cliente !== "todos" && r.clienteId !== filtros.cliente) return false;
      if (filtros.categoria !== "todos" && r.categoriaId !== filtros.categoria) return false;
      if (filtros.centroResultado !== "todos" && r.centroResultadoId !== filtros.centroResultado) return false;
      if (filtros.dataInicio && r.dataVencimento < filtros.dataInicio) return false;
      if (filtros.dataFim && r.dataVencimento > filtros.dataFim) return false;
      return true;
    });
  }, [recibiveis, filtros]);

  const totais = useMemo(() => {
    const pendentes = filtrados.filter(r => r.status === "pendente").reduce((acc, r) => acc + r.valorLiquido, 0);
    const vencidos = filtrados.filter(r => r.status === "vencido").reduce((acc, r) => acc + r.valorLiquido, 0);
    const pagos = filtrados.filter(r => r.status === "pago").reduce((acc, r) => acc + r.valorLiquido, 0);
    const parciais = filtrados.filter(r => r.status === "parcial").reduce((acc, r) => acc + r.valorLiquido, 0);
    const total = pendentes + vencidos + parciais;
    return { pendentes, vencidos, pagos, parciais, total };
  }, [filtrados]);

  const StatCard = ({ title, value, icon: Icon, color, sub }: any) => (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">{title}</p>
          <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className="p-3 bg-muted rounded-full">
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total a Receber" value={fmtFin(totais.total)} icon={DollarSign} color="#2563eb" />
        <StatCard title="Vencido" value={fmtFin(totais.vencidos)} icon={AlertTriangle} color="#dc2626" />
        <StatCard title="Pendente" value={fmtFin(totais.pendentes)} icon={Clock} color="#eab308" />
        <StatCard title="Recebido no Mês" value={fmtFin(totais.pagos)} icon={DollarSign} color="#16a34a" />
      </div>

      <Card>
        <CardHeader className="py-4 flex flex-row items-center gap-4 justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar fatura, cliente, OS..." 
                value={filtros.busca}
                onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
                className="pl-9" 
              />
            </div>
            <Select value={filtros.status} onValueChange={(v) => setFiltros({...filtros, status: v})}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="vencido">Vencido</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setFiltros({
              busca: "", status: "todos", cliente: "todos", categoria: "todos",
              centroResultado: "todos", dataInicio: "", dataFim: ""
            })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <Dialog open={showNovo} onOpenChange={setShowNovo}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                setNovaReceita(defaultRecebivel);
                setRecebivelSelecionado(null);
              }}>
                <Plus className="w-4 h-4 mr-2" /> Nova Receita
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5 text-blue-600" />
                  {recebivelSelecionado?.id ? "Editar Recebível" : "Nova Receita - Contas a Receber"}
                </DialogTitle>
              </DialogHeader>
              
              <Tabs value={aba} onValueChange={setAba} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="lista">Dados Principais</TabsTrigger>
                  <TabsTrigger value="valores">Valores</TabsTrigger>
                  <TabsTrigger value="vinculacoes">Vinculações</TabsTrigger>
                </TabsList>
                
                <TabsContent value="lista" className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Cliente Vinculado *</Label>
                    {!novaReceita.clienteId ? (
                      <div className="relative">
                        <Input 
                          placeholder="Buscar cliente por razão social ou CNPJ..." 
                          value={buscaCliente} 
                          onChange={(e) => setBuscaCliente(e.target.value)}
                          className="w-full"
                        />
                        {clientesFiltrados.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-card border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                            {clientesFiltrados.map((c) => (
                              <div 
                                key={c.id} 
                                className="p-2 hover:bg-muted cursor-pointer border-b last:border-0"
                                onClick={() => handleSelecionarCliente(c)}
                              >
                                <p className="font-medium text-sm">{c.razao_social}</p>
                                <p className="text-xs text-muted-foreground">{c.cnpj || c.cpf}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{novaReceita.clienteNome}</p>
                          <p className="text-xs text-blue-600">{novaReceita.clienteDocumento}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setNovaReceita({...novaReceita, clienteId: "", clienteNome: "", clienteDocumento: ""})}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Fatura / Documento</Label>
                      <Input 
                        value={novaReceita.documento} 
                        onChange={(e) => setNovaReceita({...novaReceita, documento: e.target.value})} 
                        placeholder="FAT-0001" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Série</Label>
                      <Input 
                        value={novaReceita.serie} 
                        onChange={(e) => setNovaReceita({...novaReceita, serie: e.target.value})} 
                        placeholder="1" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Número</Label>
                      <Input 
                        value={novaReceita.numero} 
                        onChange={(e) => setNovaReceita({...novaReceita, numero: e.target.value})} 
                        placeholder="0001" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Status</Label>
                      <Select value={novaReceita.status} onValueChange={(v) => setNovaReceita({...novaReceita, status: v})}>
                        <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pendente">Pendente</SelectItem>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="vencido">Vencido</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                          <SelectItem value="cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Emissão</Label>
                      <Input 
                        type="date" 
                        value={novaReceita.dataEmissao} 
                        onChange={(e) => setNovaReceita({...novaReceita, dataEmissao: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Vencimento</Label>
                      <Input 
                        type="date" 
                        value={novaReceita.dataVencimento} 
                        onChange={(e) => setNovaReceita({...novaReceita, dataVencimento: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Previsão Recebimento</Label>
                      <Input 
                        type="date" 
                        value={novaReceita.dataPrevisaoRecebimento} 
                        onChange={(e) => setNovaReceita({...novaReceita, dataPrevisaoRecebimento: e.target.value})} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Centro de Resultado</Label>
                      <Select value={novaReceita.centroResultadoId} onValueChange={(v) => setNovaReceita({...novaReceita, centroResultadoId: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {mockCentrosResultado.map(cr => (
                            <SelectItem key={cr.id} value={cr.id}>{cr.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={novaReceita.categoriaId} onValueChange={(v) => setNovaReceita({...novaReceita, categoriaId: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS_RECEITA.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Plano de Contas</Label>
                      <Select value={novaReceita.planoContaId} onValueChange={(v) => setNovaReceita({...novaReceita, planoContaId: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {mockPlanoContas.filter(p => p.tipo === "receita" && p.nivel === 1).map(pc => (
                            <SelectItem key={pc.id} value={pc.id}>{pc.codigo} - {pc.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Forma Recebimento</Label>
                      <Select value={novaReceita.formaRecebimento} onValueChange={(v) => setNovaReceita({...novaReceita, formaRecebimento: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map(fp => (
                            <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="valores" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Valor Bruto (R$) *</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.valorBruto || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, valorBruto: Number(e.target.value)})} 
                        placeholder="0,00" 
                        className="font-bold" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Desconto (-)</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.desconto || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, desconto: Number(e.target.value)})} 
                        placeholder="0,00" 
                        className="text-green-600" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Juros (+)</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.juros || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, juros: Number(e.target.value)})} 
                        placeholder="0,00" 
                        className="text-red-600" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Multa (+)</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.multa || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, multa: Number(e.target.value)})} 
                        placeholder="0,00" 
                        className="text-red-600" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Abatimento (-)</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.abatimento || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, abatimento: Number(e.target.value)})} 
                        placeholder="0,00" 
                        className="text-green-600" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Valor Líquido</Label>
                      <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg font-bold text-lg text-center">
                        {fmtFin(valorLiquidoCalculado)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Conta Financeira</Label>
                      <Select value={novaReceita.contaFinanceiraId} onValueChange={(v) => setNovaReceita({...novaReceita, contaFinanceiraId: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {mockContasBancarias.filter(c => c.ativa).map(cf => (
                            <SelectItem key={cf.id} value={cf.id}>{cf.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Recorrente</Label>
                      <div className="flex items-center gap-2 h-10">
                        <input 
                          type="checkbox" 
                          checked={novaReceita.recorrente}
                          onChange={(e) => setNovaReceita({...novaReceita, recorrente: e.target.checked})}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Ativo</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Parcelas</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.quantidadeParcelas || 1}
                        onChange={(e) => setNovaReceita({...novaReceita, quantidadeParcelas: Number(e.target.value)})}
                        min={1}
                        max={48}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Parcela Atual</Label>
                      <Input 
                        type="number" 
                        value={novaReceita.parcelaAtual || 1}
                        onChange={(e) => setNovaReceita({...novaReceita, parcelaAtual: Number(e.target.value)})}
                        min={1}
                        max={novaReceita.quantidadeParcelas}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="vinculacoes" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">OS Vinculadas</Label>
                      <Input 
                        value={novaReceita.osVinculadas || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, osVinculadas: e.target.value})} 
                        placeholder="OS-001, OS-002" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Contrato Vinculado</Label>
                      <Input 
                        value={novaReceita.contratoVinculado || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, contratoVinculado: e.target.value})} 
                        placeholder="CTR-001" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Proposta Vinculada</Label>
                      <Input 
                        value={novaReceita.propostaVinculada || ""} 
                        onChange={(e) => setNovaReceita({...novaReceita, propostaVinculada: e.target.value})} 
                        placeholder="PST-001" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Observações</Label>
                    <Textarea 
                      value={novaReceita.observacoes || ""} 
                      onChange={(e) => setNovaReceita({...novaReceita, observacoes: e.target.value})} 
                      placeholder="Observações sobre este recebível..." 
                      className="resize-none" 
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <div className="flex gap-2">
                  {novaReceita.quantidadeParcelas > 1 && (
                    <Button variant="outline" onClick={handleGerarParcelas}>
                      <Calendar className="w-4 h-4 mr-2" /> Gerar {novaReceita.quantidadeParcelas} Parcelas
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowNovo(false)}>Cancelar</Button>
                  <Button className="bg-blue-600" onClick={handleSalvarReceita}>
                    <Check className="w-4 h-4 mr-2" /> Salvar
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>OS/Contrato</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum recebível encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((r, i) => (
                  <TableRow key={r.id || i}>
                    <TableCell className="font-semibold">
                      {r.documento}
                      {r.parcelaAtual && r.quantidadeParcelas && r.quantidadeParcelas > 1 && (
                        <span className="text-xs text-muted-foreground ml-1">({r.parcelaAtual}/{r.quantidadeParcelas})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>{r.clienteNome}</div>
                      {r.clienteDocumento && <div className="text-xs text-muted-foreground">{r.clienteDocumento}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {r.osVinculadas && <Badge variant="outline">{r.osVinculadas}</Badge>}
                        {r.contratoVinculado && <Badge variant="secondary">{r.contratoVinculado}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {CATEGORIAS_RECEITA.find(c => c.value === r.categoriaId)?.label || r.categoriaId}
                    </TableCell>
                    <TableCell>{r.dataEmissao ? new Date(r.dataEmissao).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" }) : "-"}</TableCell>
                    <TableCell>{r.dataVencimento ? new Date(r.dataVencimento).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtFin(r.valorLiquido)}</TableCell>
                    <TableCell>
                      <Badge className={
                        r.status === "pago" ? "bg-green-100 text-green-700 border-green-200" :
                        r.status === "vencido" ? "bg-red-100 text-red-700 border-red-200" :
                        r.status === "parcial" ? "bg-yellow-100 text-yellow-700 border-yellow-200" :
                        "bg-blue-100 text-blue-700 border-blue-200"
                      }>
                        {r.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => abrirDetalhe(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(r)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        {r.status !== "pago" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setDadosBaixa({ ...dadosBaixa, valorRecebido: r.valorLiquido }); setRecebivelSelecionado(r); setShowBaixa(true); }}>
                              <CreditCard className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setDadosRenegociacao({ novoVencimento: r.dataVencimento, novoValor: r.valorLiquido, quantidadeParcelas: 1, observacoes: "" }); setRecebivelSelecionado(r); setShowRenegociar(true); }}>
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => r.id && handleExcluir(r.id)}>
                          <Trash2 className="w-4 h-4" />
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

      <Dialog open={showDetalhe} onOpenChange={setShowDetalhe}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Detalhes do Recebível
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div><Label className="text-xs text-muted-foreground">Cliente</Label><p className="font-medium">{recebivelSelecionado.clienteNome}</p></div>
              <div><Label className="text-xs text-muted-foreground">Documento</Label><p className="font-medium">{recebivelSelecionado.clienteDocumento}</p></div>
              <div><Label className="text-xs text-muted-foreground">Fatura</Label><p className="font-medium">{recebivelSelecionado.documento}</p></div>
              <div><Label className="text-xs text-muted-foreground">OS Vinculadas</Label><p className="font-medium">{recebivelSelecionado.osVinculadas || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Contrato</Label><p className="font-medium">{recebivelSelecionado.contratoVinculado || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Proposta</Label><p className="font-medium">{recebivelSelecionado.propostaVinculada || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Valor Bruto</Label><p className="font-medium">{fmtFin(recebivelSelecionado.valorBruto)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Desconto</Label><p className="font-medium text-green-600">-{fmtFin(recebivelSelecionado.desconto)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Juros/Multa</Label><p className="font-medium text-red-600">+{fmtFin(recebivelSelecionado.juros + recebivelSelecionado.multa)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Valor Líquido</Label><p className="font-bold text-lg">{fmtFin(recebivelSelecionado.valorLiquido)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Emissão</Label><p className="font-medium">{new Date(recebivelSelecionado.dataEmissao).toLocaleDateString()}</p></div>
              <div><Label className="text-xs text-muted-foreground">Vencimento</Label><p className="font-medium">{new Date(recebivelSelecionado.dataVencimento).toLocaleDateString()}</p></div>
              <div><Label className="text-xs text-muted-foreground">Categoria</Label><p className="font-medium">{CATEGORIAS_RECEITA.find(c => c.value === recebivelSelecionado.categoriaId)?.label || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Status</Label><Badge>{recebivelSelecionado.status}</Badge></div>
              {recebivelSelecionado.observacoes && <div className="col-span-2"><Label className="text-xs text-muted-foreground">Observações</Label><p className="text-sm">{recebivelSelecionado.observacoes}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" /> Baixa de Recebível
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{recebivelSelecionado.clienteNome}</p>
                <p className="text-sm text-muted-foreground">{recebivelSelecionado.documento}</p>
                <p className="text-lg font-bold mt-2">{fmtFin(recebivelSelecionado.valorLiquido)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Data Recebimento</Label>
                <Input type="date" value={dadosBaixa.dataRecebimento} onChange={(e) => setDadosBaixa({...dadosBaixa, dataRecebimento: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valor Recebido</Label>
                <Input type="number" value={dadosBaixa.valorRecebido} onChange={(e) => setDadosBaixa({...dadosBaixa, valorRecebido: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Forma</Label>
                <Select value={dadosBaixa.formaRecebimento} onValueChange={(v) => setDadosBaixa({...dadosBaixa, formaRecebimento: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGAMENTO.map(fp => (<SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Conta</Label>
                <Select value={dadosBaixa.contaFinanceiraId} onValueChange={(v) => setDadosBaixa({...dadosBaixa, contaFinanceiraId: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {mockContasBancarias.filter(c => c.ativa).map(cf => (<SelectItem key={cf.id} value={cf.id}>{cf.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBaixa(false)}>Cancelar</Button>
                <Button variant="outline" onClick={handleBaixaParcial}>Baixa Parcial</Button>
                <Button className="bg-green-600" onClick={handleBaixaTotal}>Baixa Total</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showRenegociar} onOpenChange={setShowRenegociar}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-600" /> Renegociar Recebível
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{recebivelSelecionado.clienteNome}</p>
                <p className="text-sm text-muted-foreground">{recebivelSelecionado.documento}</p>
                <p className="text-lg font-bold mt-2">Valor atual: {fmtFin(recebivelSelecionado.valorLiquido)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Novo Vencimento</Label>
                <Input type="date" value={dadosRenegociacao.novoVencimento} onChange={(e) => setDadosRenegociacao({...dadosRenegociacao, novoVencimento: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Novo Valor</Label>
                <Input type="number" value={dadosRenegociacao.novoValor} onChange={(e) => setDadosRenegociacao({...dadosRenegociacao, novoValor: Number(e.target.value)})} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observações</Label>
                <Textarea value={dadosRenegociacao.observacoes} onChange={(e) => setDadosRenegociacao({...dadosRenegociacao, observacoes: e.target.value})} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRenegociar(false)}>Cancelar</Button>
                <Button className="bg-orange-600" onClick={handleRenegociar}>Renegociar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}