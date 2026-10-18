import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  ArrowDownRight, DollarSign, Search, Plus, Check, X, FileText,
  Calendar, Clock, Package, Receipt, Download, Eye, Edit, Trash2,
  RefreshCw, AlertTriangle, CreditCard, Landmark, FileCheck
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
import PaginationBar from "@/components/ui/PaginationBar";
import { mascararCPF } from "@/lib/masking";
import { criarRecebivel, atualizarRecebivel, baixarRecebivel, excluirRecebivel, renegociarRecebivel, buscarRecebiveisFiltrados, buscarClientesLista, verificarDuplicataEscala, buscarEscalaFaturamento, buscarDetalheFatura, gerarChaveIdempotencia } from "@/services/financeiro/receberService";
import { escalaParaItemFaturamento, isAlocacaoFaturavel, type ItemFaturamentoEscala } from "@/services/escala/escalaFinanceiroAdapter";
import { mapearBancoParaLocal } from "@/services/escala/escalaMapper";
import { 
  CATEGORIAS_RECEITA, FORMAS_PAGAMENTO, mockCentrosResultado, mockPlanoContas
} from "./types";
import { buscarContasBancariasConfig, type ContaBancariaFinanceira } from "@/services/financeiro/configFinanceiraService";
import { calcularStatusEfetivo, statusEfetivoLabel, statusEfetivoClasses, type StatusEfetivo } from "@/helpers/statusVencimento";
import { ordenarRecebiveis } from "@/helpers/ordenacaoRecebiveis";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
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
  statusEfetivo: StatusEfetivo;
  formaRecebimento?: string;
  contaFinanceiraId?: string;
  recorrente: boolean;
  quantidadeParcelas?: number;
  parcelaAtual?: number;
  planoContaId?: string;
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  origem?: string;
  origemId?: string;
  competencia?: string;
  faturaId?: string;
  faturaNumero?: string;
  quantidadeItens?: number;
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
  const [escalaFaturamento, setEscalaFaturamento] = useState<ItemFaturamentoEscala[]>([]);
  const [escalaFaturamentoLoading, setEscalaFaturamentoLoading] = useState(false);
  const [showBoleto, setShowBoleto] = useState(false);
  const [showNfse, setShowNfse] = useState(false);
  const [aba, setAba] = useState("lista");

  const [showDetalheFatura, setShowDetalheFatura] = useState(false);
  const [faturaDetalheItens, setFaturaDetalheItens] = useState<any[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancariaFinanceira[]>([]);

  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const PAGE_SIZE = 25;

  // ── Mês / Período ──
  const [mesOffset, setMesOffset] = useState(0);
  const mesRef = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + mesOffset);
    return d;
  }, [mesOffset]);
  const mesAtualStr = useMemo(() => {
    return mesRef.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  }, [mesRef]);
  const mesAtualCodigo = useMemo(() => {
    return mesRef.toLocaleDateString("sv-SE", { month: "numeric", year: "numeric", timeZone: "America/Sao_Paulo" }).slice(0, 7);
  }, [mesRef]);
  const periodoMes = useMemo(() => {
    const y = mesRef.getFullYear();
    const m = mesRef.getMonth();
    const inicio = new Date(y, m, 1);
    const fim = new Date(y, m + 1, 0);
    return {
      inicio: inicio.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
      fim: fim.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }),
    };
  }, [mesRef]);
  // TMS-FIN-AR-UX-01 — default: MAIS RECENTE -> MAIS ANTIGO (por created_at).
  const [ordenacao, setOrdenacao] = useState("recente_desc");

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
  // TMS-FIN-SEC-02-A6 — chave de idempotência por sessão do diálogo (protege
  // contra duplo clique/retry no contrato oficial de criação).
  const novaReceitaKeyRef = useRef<string>("");
  const [buscaCliente, setBuscaCliente] = useState("");
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);

  const [dadosBaixa, setDadosBaixa] = useState({
    dataRecebimento: new Date().toISOString().split("T")[0],
    valorRecebido: 0,
    formaRecebimento: "pix",
    contaFinanceiraId: "",
    referenciaBancaria: "",
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
    buscarContasBancariasConfig().then(setContasBancarias).catch(() => setContasBancarias([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.status, filtros.cliente, filtros.categoria, filtros.centroResultado, filtros.dataInicio, filtros.dataFim, filtros.busca, mesOffset]);

  // TMS-FIN-PROG-05C.3B — volta para a página 1 ao mudar busca/filtro/período/ordenação
  useEffect(() => {
    setPage(1);
  }, [filtros.status, filtros.cliente, filtros.categoria, filtros.centroResultado, filtros.dataInicio, filtros.dataFim, filtros.busca, mesOffset, ordenacao]);

  useEffect(() => {
    fetchEscalaFaturamento();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtros.dataInicio, filtros.dataFim]);

  const fetchRecebiveis = async () => {
    try {
      setIsLoading(true);
      const periodoInicio = filtros.dataInicio || periodoMes.inicio;
      const periodoFim = filtros.dataFim || periodoMes.fim;
      // TMS-FIN-PROG-05C.3B — carrega o CONJUNTO COMPLETO filtrado (sem paginar
      // aqui). A paginação é aplicada depois, sobre o universo já filtrado e
      // ordenado, garantindo cards/totais globais + paginação real.
      const rows = await buscarRecebiveisFiltrados({
        cliente_id: filtros.cliente !== "todos" ? filtros.cliente : undefined,
        categoria: filtros.categoria !== "todos" ? filtros.categoria : undefined,
        centro_resultado: filtros.centroResultado !== "todos" ? filtros.centroResultado : undefined,
        data_inicio: periodoInicio,
        data_fim: periodoFim,
        search: filtros.busca || undefined,
      });
      const recebiveisMapped = rows.map((r: any) => ({
        id: r.id,
        clienteId: r.cliente_id || "",
        clienteNome: r.cliente_nome || "",
        clienteDocumento: r.cliente_documento || "",
        documento: r.fatura || r.documento || "",
        serie: r.serie || "",
        numero: r.numero || "",
        osVinculadas: r.os_vinculadas || "",
        contratoVinculado: r.contrato_vinculado || "",
        propostaVinculada: r.proposta_vinculada || "",
        categoriaId: r.categoria || "",
        centroResultadoId: r.centro_resultado || "",
        valorBruto: Number(r.valor_bruto) || Number(r.valor) || 0,
        desconto: Number(r.desconto) || 0,
        juros: Number(r.juros) || 0,
        multa: Number(r.multa) || 0,
        abatimento: Number(r.abatimento) || 0,
        valorLiquido: Number(r.valor_liquido) || Number(r.valor) || 0,
        dataEmissao: r.data_emissao || r.created_at?.split("T")[0] || new Date().toISOString().split("T")[0],
        dataVencimento: r.data_vencimento || r.vencimento || "",
        dataPrevisaoRecebimento: r.data_previsao_recebimento || r.previsao_recebimento || "",
        dataRecebimento: r.data_recebimento || r.data_pagamento || "",
        status: r.status || "pendente",
        statusEfetivo: calcularStatusEfetivo({
          statusPersistido: r.status,
          dataVencimento: r.data_vencimento || r.vencimento,
          dataPagamento: r.data_recebimento || r.data_pagamento,
          valorPago: r.valor_baixado,
          valorTotal: Number(r.valor_liquido) || Number(r.valor) || 0,
        }),
        formaRecebimento: r.forma_recebimento || "",
        contaFinanceiraId: r.conta_entrada || "",
        recorrente: !!r.recorrente,
        quantidadeParcelas: r.quantidade_parcelas,
        parcelaAtual: r.parcela_atual,
        planoContaId: r.plano_conta || "",
        observacoes: r.observacoes || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        origem: r.origem || "",
        origemId: r.origem_id || "",
        competencia: r.competencia || (r.data_emissao ? String(r.data_emissao || "").slice(0, 7) : ""),
        faturaId: r.fatura_id || "",
        faturaNumero: r.fatura_numero || "",
        quantidadeItens: r.quantidade_itens || 0,
      }));
      setRecebiveis(recebiveisMapped);
    } catch (error) {
      console.error("Erro ao buscar recebíveis:", error);
      setRecebiveis([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientes = async () => {
    try {
      const data = await buscarClientesLista();
      setClientes((data as Cliente[]) || []);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
    }
  };

  const fetchEscalaFaturamento = async () => {
    setEscalaFaturamentoLoading(true);
    try {
      const data = await buscarEscalaFaturamento({
        data_inicio: filtros.dataInicio,
        data_fim: filtros.dataFim,
      });

      const mapped = (data || [])
        .map(mapearBancoParaLocal)
        .filter(isAlocacaoFaturavel);

      const alocacaoIds = mapped.map((a: any) => a.id).filter(Boolean);
      let idsFaturados = new Set<string>();
      for (const alocId of alocacaoIds) {
        const duplicata = await verificarDuplicataEscala(alocId);
        if (duplicata) idsFaturados.add(alocId);
      }

      const items = mapped
        .filter((a: any) => !idsFaturados.has(a.id))
        .map(escalaParaItemFaturamento);
      setEscalaFaturamento(items);
    } catch (e) {
      console.warn("[ContasReceberEnterprise] Erro ao buscar faturamento da Escala:", e);
      setEscalaFaturamento([]);
    } finally {
      setEscalaFaturamentoLoading(false);
    }
  };

  const abrirDetalheFatura = async (r: Recebivel) => {
    setRecebivelSelecionado(r);
    if (r.origem === "fatura_consolidada" && r.id) {
      try {
        const itens = await buscarDetalheFatura(r.id);
        setFaturaDetalheItens(itens);
      } catch {
        setFaturaDetalheItens([]);
      }
    } else {
      setFaturaDetalheItens([]);
    }
    setShowDetalheFatura(true);
  };

  const filtrarClientes = useCallback(() => {
    if (!buscaCliente) return [];
    const buscaLower = buscaCliente.toLowerCase();
    return clientes.filter(c => 
      (c.razao_social?.toLowerCase() || "").includes(buscaLower) ||
      (c.nome_fantasia?.toLowerCase() || "").includes(buscaLower) ||
      (c.cnpj || "").includes(buscaCliente)
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
    const doc = cliente.cnpj || "";
    setNovaReceita({
      ...novaReceita,
      clienteId: cliente.id,
      clienteNome: cliente.nome_fantasia || cliente.razao_social,
      clienteDocumento: doc
    });
    setBuscaCliente("");
    setClientesFiltrados([]);
  };

  const valorLiquidoCalculado = useMemo(() => {
    return novaReceita.valorBruto - novaReceita.desconto + novaReceita.juros + novaReceita.multa - novaReceita.abatimento;
  }, [novaReceita.valorBruto, novaReceita.desconto, novaReceita.juros, novaReceita.multa, novaReceita.abatimento]);

  const handleSalvarReceita = async () => {
    if (!novaReceita.clienteId || !novaReceita.valorBruto) {
      toast.error("Preencha o cliente e valor");
      return;
    }
    try {
      const sanitizeValue = (val: any) => {
        if (val === "" || val === undefined || val === null) return null;
        return val;
      };
      
      const dataToSave = {
        cliente_id: novaReceita.clienteId,
        cliente_nome: novaReceita.clienteNome,
        cliente_documento: novaReceita.clienteDocumento,
        fatura: novaReceita.documento || `FAT-${Date.now()}`,
        serie: sanitizeValue(novaReceita.serie),
        numero: sanitizeValue(novaReceita.numero),
        os_vinculadas: sanitizeValue(novaReceita.osVinculadas),
        contrato_vinculado: sanitizeValue(novaReceita.contratoVinculado),
        proposta_vinculada: sanitizeValue(novaReceita.propostaVinculada),
        categoria: sanitizeValue(novaReceita.categoriaId),
        centro_resultado: sanitizeValue(novaReceita.centroResultadoId),
        valor_bruto: novaReceita.valorBruto || 0,
        desconto: novaReceita.desconto || 0,
        juros: novaReceita.juros || 0,
        multa: novaReceita.multa || 0,
        abatimento: novaReceita.abatimento || 0,
        valor_liquido: valorLiquidoCalculado || 0,
        data_emissao: sanitizeValue(novaReceita.dataEmissao),
        data_vencimento: sanitizeValue(novaReceita.dataVencimento),
        data_previsao_recebimento: sanitizeValue(novaReceita.dataPrevisaoRecebimento),
        conta_entrada: sanitizeValue(novaReceita.contaFinanceiraId),
        // TMS-FIN-AR-UX-01 — NÃO enviar status ao EDITAR: o status persistido é
        // preservado. A mudança de status só ocorre pelos fluxos oficiais
        // (baixarRecebivel / renegociarRecebivel / exclusão). No cadastro (novo),
        // o status informado passa por validarStatusCriacao.
        ...(recebivelSelecionado?.id ? {} : { status: novaReceita.status || "pendente" }),
        recorrente: novaReceita.recorrente || false,
        quantidade_parcelas: sanitizeValue(novaReceita.quantidadeParcelas),
        parcela_atual: sanitizeValue(novaReceita.parcelaAtual),
        plano_conta: sanitizeValue(novaReceita.planoContaId),
        observacoes: sanitizeValue(novaReceita.observacoes),
        idempotency_key: novaReceitaKeyRef.current || undefined,
      };

      if (recebivelSelecionado?.id) {
        await atualizarRecebivel(recebivelSelecionado.id, dataToSave);
        toast.success("Recebível atualizado!");
      } else {
        await criarRecebivel(dataToSave);
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
      const sanitizeValue = (val: any) => {
        if (val === "" || val === undefined || val === null) return null;
        return val;
      };
      
      const parcelas = [];
      for (let i = 0; i < qtd; i++) {
        const vencimento = new Date(primeiroVencimento);
        vencimento.setMonth(vencimento.getMonth() + i);
        
        const dataToSave = {
          cliente_id: novaReceita.clienteId,
          cliente_nome: novaReceita.clienteNome,
          cliente_documento: novaReceita.clienteDocumento,
          fatura: novaReceita.documento || `FAT-${Date.now()}`,
          serie: sanitizeValue(novaReceita.serie),
          numero: `${(novaReceita.numero || "1")}/${qtd}`,
          os_vinculadas: sanitizeValue(novaReceita.osVinculadas),
          contrato_vinculado: sanitizeValue(novaReceita.contratoVinculado),
          proposta_vinculada: sanitizeValue(novaReceita.propostaVinculada),
          categoria: sanitizeValue(novaReceita.categoriaId),
          centro_resultado: sanitizeValue(novaReceita.centroResultadoId),
          valor_bruto: valorParcela || 0,
          desconto: 0,
          juros: 0,
          multa: 0,
          abatimento: 0,
          valor_liquido: valorParcela || 0,
          data_emissao: sanitizeValue(novaReceita.dataEmissao),
          data_vencimento: vencimento.toISOString().split("T")[0],
          status: "pendente",
          recorrente: novaReceita.recorrente || false,
          quantidade_parcelas: qtd,
          parcela_atual: i + 1,
          observacoes: sanitizeValue(`${novaReceita.observacoes || ""} (${i+1}/${qtd})`),
          idempotency_key: novaReceitaKeyRef.current ? `${novaReceitaKeyRef.current}-p${i + 1}` : undefined,
        };
        
        await criarRecebivel(dataToSave);
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
      const contaSel = contasBancarias.find(c => c.id === dadosBaixa.contaFinanceiraId);
      await baixarRecebivel(recebivelSelecionado.id, dadosBaixa.valorRecebido, dadosBaixa.dataRecebimento, {
        forma: dadosBaixa.formaRecebimento,
        conta: contaSel?.nome || dadosBaixa.contaFinanceiraId || undefined,
        contaFinanceiraId: dadosBaixa.contaFinanceiraId || undefined,
        referencia: dadosBaixa.referenciaBancaria || undefined,
        observacao: dadosBaixa.observacoes || undefined,
      });
      toast.success("Baixa parcial realizada!");
      await fetchRecebiveis();
      setShowBaixa(false);
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao realizar baixa");
    }
  };

  const handleBaixaTotal = async () => {
    if (!recebivelSelecionado?.id) return;
    try {
      const valor = recebivelSelecionado.valorLiquido || recebivelSelecionado.valorBruto || 0;
      const contaSel = contasBancarias.find(c => c.id === dadosBaixa.contaFinanceiraId);
      await baixarRecebivel(recebivelSelecionado.id, valor, dadosBaixa.dataRecebimento, {
        forma: dadosBaixa.formaRecebimento,
        conta: contaSel?.nome || dadosBaixa.contaFinanceiraId || undefined,
        contaFinanceiraId: dadosBaixa.contaFinanceiraId || undefined,
        referencia: dadosBaixa.referenciaBancaria || undefined,
        observacao: dadosBaixa.observacoes || undefined,
      });
      toast.success("Baixa total realizada!");
      await fetchRecebiveis();
      setShowBaixa(false);
    } catch (error) {
      console.error("Erro na baixa:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao realizar baixa");
    }
  };

  const handleRenegociar = async () => {
    if (!recebivelSelecionado?.id || !dadosRenegociacao.novoVencimento || !dadosRenegociacao.novoValor) {
      toast.error("Informe novo vencimento e valor");
      return;
    }
    try {
      await renegociarRecebivel(recebivelSelecionado.id, {
        valor: dadosRenegociacao.novoValor,
        data_vencimento: dadosRenegociacao.novoVencimento,
        observacoes: `Renegociação: novo valor ${fmtFin(dadosRenegociacao.novoValor)}`,
      });
      toast.success("Recebível renegociado!");
      await fetchRecebiveis();
      setShowRenegociar(false);
    } catch (error) {
      console.error("Erro na renegociação:", error);
      toast.error(error instanceof Error ? error.message : "Erro ao renegociar");
    }
  };

  const handleExcluir = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      await excluirRecebivel(id);
      toast.success("Excluído!");
      await fetchRecebiveis();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir");
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
    novaReceitaKeyRef.current = gerarChaveIdempotencia("nr");
    setShowNovo(true);
  };

  const filtrados = useMemo(() => {
    let result = recebiveis.filter(r => {
      // TMS-FIN-PROG-05C.3B — busca é aplicada no SERVIDOR (conjunto completo);
      // aqui aplicamos somente status/cliente/categoria/centro sobre o conjunto já
      // carregado e filtrado (evita duplicar/limitar a busca à página).
      if (filtros.status !== "todos" && r.statusEfetivo !== filtros.status) return false;
      if (filtros.cliente !== "todos" && r.clienteId !== filtros.cliente) return false;
      if (filtros.categoria !== "todos" && r.categoriaId !== filtros.categoria) return false;
      if (filtros.centroResultado !== "todos" && r.centroResultadoId !== filtros.centroResultado) return false;
      return true;
    });
    // TMS-FIN-AR-UX-01 — ordenação GLOBAL (conjunto completo) por created_at desc
    // (default) com desempate por id, aplicada ANTES da paginação.
    return ordenarRecebiveis(result, ordenacao);
  }, [recebiveis, filtros, ordenacao]);

  // TMS-FIN-PROG-05C.3B — paginação REAL sobre o universo já filtrado/ordenado
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE)), [filtrados.length]);
  const paginadas = useMemo(
    () => filtrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtrados, page]
  );
  useEffect(() => {
    setTotalCount(filtrados.length);
    if (page > totalPages) setPage(1);
  }, [filtrados.length, page, totalPages]);

  const totais = useMemo(() => {
    const hoje = new Date().toISOString().split("T")[0];
    const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const pendentes = filtrados.filter(r => r.statusEfetivo === "a_vencer" || r.statusEfetivo === "vence_hoje").reduce((acc, r) => acc + (r.valorLiquido || 0), 0);
    const vencidos = filtrados.filter(r => r.statusEfetivo === "atrasado").reduce((acc, r) => acc + (r.valorLiquido || 0), 0);
    const pagos = filtrados.filter(r => r.statusEfetivo === "pago").reduce((acc, r) => acc + (r.valorLiquido || 0), 0);
    const parciais = filtrados.filter(r => r.statusEfetivo === "parcial").reduce((acc, r) => acc + (r.valorLiquido || 0), 0);
    const total = pendentes + vencidos + parciais;
    const vence7 = filtrados.filter(r =>
      (r.statusEfetivo === "a_vencer" || r.statusEfetivo === "vence_hoje" || r.statusEfetivo === "parcial") &&
      r.dataVencimento >= hoje && r.dataVencimento <= em7dias
    ).reduce((acc, r) => acc + (r.valorLiquido || 0), 0);
    const inadimplencia = (total + pagos) > 0 ? (vencidos / (total + pagos)) * 100 : 0;
    return { pendentes, vencidos, pagos, parciais, total, vence7, inadimplencia };
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { title: "Total a Receber", value: fmtFin(totais.total), icon: DollarSign, accent: "bg-blue-500", color: "text-blue-500" },
          { title: "Vencido", value: fmtFin(totais.vencidos), icon: AlertTriangle, accent: "bg-red-500", color: "text-red-500" },
          { title: "Vence em 7 dias", value: fmtFin(totais.vence7), icon: Clock, accent: "bg-amber-500", color: "text-amber-500" },
          { title: "Pendente", value: fmtFin(totais.pendentes), icon: Clock, accent: "bg-yellow-500", color: "text-yellow-500" },
          { title: "Recebido", value: fmtFin(totais.pagos), icon: DollarSign, accent: "bg-emerald-500", color: "text-emerald-500" },
          { title: "Inadimpl\u00eancia", value: `${totais.inadimplencia.toFixed(1)}%`, icon: ArrowDownRight, accent: totais.inadimplencia > 10 ? "bg-red-500" : "bg-slate-500", color: totais.inadimplencia > 10 ? "text-red-500" : "text-muted-foreground" },
        ].map(k => (
          <div key={k.title} className="relative overflow-hidden bg-card border border-border rounded-xl p-4 shadow-sm hover:-translate-y-0.5 transition-transform">
            <div className={`absolute top-0 left-0 right-0 h-0.5 ${k.accent}`} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{k.title}</p>
                <p className={`text-base font-extrabold mt-1 ${k.color}`}>{k.value}</p>
              </div>
              <div className="p-2 bg-muted/40 rounded-xl"><k.icon className={`w-4 h-4 ${k.color}`} /></div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Navegação por Mês ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setMesOffset(o => o - 1); setPage(1); }}>
            <ArrowDownRight className="w-4 h-4 rotate-[90deg]" />
          </Button>
          <span className="text-sm font-bold text-foreground min-w-[160px] text-center capitalize">{mesAtualStr}</span>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => { setMesOffset(o => o + 1); setPage(1); }}>
            <ArrowDownRight className="w-4 h-4 rotate-[-90deg]" />
          </Button>
          {mesOffset !== 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setMesOffset(0); setPage(1); }}>
              Voltar ao mês atual
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={ordenacao} onValueChange={setOrdenacao}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
                  <SelectItem value="recente_desc">Mais recente</SelectItem>
                  <SelectItem value="vencimento_asc">Vencimento ↑</SelectItem>
                  <SelectItem value="vencimento_desc">Vencimento ↓</SelectItem>
                  <SelectItem value="valor_desc">Maior valor</SelectItem>
                  <SelectItem value="valor_asc">Menor valor</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Filtros Rápidos ── */}
      <Card>
        <CardHeader className="py-4 flex flex-row items-center gap-4 justify-between">
          <div className="flex flex-1 items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar fatura, cliente, OS..." 
                value={filtros.busca}
                onChange={(e) => setFiltros({...filtros, busca: e.target.value})}
                className="pl-9 h-9" 
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: "Todos", value: "todos" },
                { label: "Atrasados", value: "atrasado", cls: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" },
                { label: "Vence Hoje", value: "vence_hoje", cls: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100" },
                { label: "A Vencer", value: "a_vencer", cls: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100" },
                { label: "Pago", value: "pago", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" },
                { label: "Cancelado", value: "cancelado", cls: "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100" },
              ].map(f => (
                <Button
                  key={f.value}
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs font-semibold ${filtros.status === f.value ? (f.cls || "bg-blue-50 text-blue-700 border-blue-300") : "bg-transparent"}`}
                  onClick={() => setFiltros({...filtros, status: f.value})}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setFiltros({
              busca: "", status: "todos", cliente: "todos", categoria: "todos",
              centroResultado: "todos", dataInicio: "", dataFim: ""
            })}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-indigo-300 text-indigo-700"
              disabled
              title="Faturamento de serviços descontinuado nesta tela (usava colunas inexistentes). Use Financeiro > Conferência Financeira."
            >
              <Receipt className="w-4 h-4 mr-2" /> Gerar Fatura
            </Button>
          <Dialog open={showNovo} onOpenChange={setShowNovo}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                novaReceitaKeyRef.current = gerarChaveIdempotencia("nr");
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
                                <p className="text-xs text-muted-foreground">{mascararCPF(c.cnpj || c.cpf)}</p>
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
                      {recebivelSelecionado?.id ? (
                        // TMS-FIN-AR-UX-01 — Em edição o status NÃO é editável aqui.
                        // 'Pago' só pelo fluxo oficial de baixa.
                        <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/40 px-3">
                          <Badge variant="outline" className="capitalize">{novaReceita.status || "—"}</Badge>
                          <span className="text-[10px] text-muted-foreground">Alterável apenas por baixa/renegociação/cancelamento</span>
                        </div>
                      ) : (
                        <Select value={novaReceita.status} onValueChange={(v) => setNovaReceita({...novaReceita, status: v})}>
                          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pendente">Pendente</SelectItem>
                            <SelectItem value="a_vencer">A vencer</SelectItem>
                            <SelectItem value="vencido">Vencido</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                            <SelectItem value="cancelado">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
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
                          {contasBancarias.filter(c => c.ativa).map(cf => (
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
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doc</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fiscal</TableHead>
                <TableHead>Boleto</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    Nenhum recebível encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginadas.map((r, i) => (
                  <TableRow key={r.id || i}>
                    <TableCell className="font-semibold">
                      {r.origem === "fatura_consolidada" ? (
                        <div className="flex items-center gap-1">
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px]">FATURA</Badge>
                          <span>{r.faturaNumero || r.documento}</span>
                          {r.quantidadeItens ? <span className="text-[10px] text-muted-foreground">({r.quantidadeItens} itens)</span> : null}
                        </div>
                      ) : (
                        <>
                          {r.documento}
                          {r.parcelaAtual && r.quantidadeParcelas && r.quantidadeParcelas > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">({r.parcelaAtual}/{r.quantidadeParcelas})</span>
                          )}
                        </>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.clienteNome ? (
                        <>
                          <div>{r.clienteNome}</div>
                          {r.clienteDocumento && <div className="text-xs text-muted-foreground">{r.clienteDocumento}</div>}
                        </>
                      ) : (
                        <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-xs">Cliente não vinculado</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.origem === "escala_operacional" ? (
                        <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-600 border-indigo-200">Programação</Badge>
                      ) : r.origem === "os" || r.origem === "ordem_servico" ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">OS</Badge>
                      ) : r.origem === "manual" ? (
                        <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">Manual</Badge>
                      ) : r.origem === "romaneio" || r.origem === "faturamento" ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">Romaneio</Badge>
                      ) : r.osVinculadas ? (
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">OS</Badge>
                      ) : r.origem ? (
                        <Badge variant="outline" className="text-xs capitalize">{r.origem}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{r.competencia || (r.dataEmissao ? r.dataEmissao.substring(0, 7) : "-")}</TableCell>
                    <TableCell>{r.dataVencimento ? new Date(r.dataVencimento + "T12:00:00").toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right font-medium">{fmtFin(r.valorLiquido)}</TableCell>
                    <TableCell>
                      <Badge className={statusEfetivoClasses(r.statusEfetivo)}>
                        {statusEfetivoLabel(r.statusEfetivo).toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 border-slate-200">Sem nota</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 border-slate-200">Sem boleto</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => r.origem === "fatura_consolidada" ? abrirDetalheFatura(r) : abrirDetalhe(r)} title="Detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => abrirEditar(r)} title="Editar">
                          <Edit className="w-4 h-4" />
                        </Button>
                        {r.status !== "pago" && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => { setDadosBaixa({ ...dadosBaixa, valorRecebido: r.valorLiquido }); setRecebivelSelecionado(r); setShowBaixa(true); }} title="Baixa">
                              <CreditCard className="w-4 h-4" />
                            </Button>
                            {r.origem !== "fatura_consolidada" && (
                              <Button variant="ghost" size="sm" onClick={() => { setDadosRenegociacao({ novoVencimento: r.dataVencimento, novoValor: r.valorLiquido, quantidadeParcelas: 1, observacoes: "" }); setRecebivelSelecionado(r); setShowRenegociar(true); }} title="Renegociar">
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => { setRecebivelSelecionado(r); setShowBoleto(true); }} title="Gerar Boleto">
                              <Landmark className="w-4 h-4 text-amber-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setRecebivelSelecionado(r); setShowNfse(true); }} title="Emitir NFS-e">
                              <FileCheck className="w-4 h-4 text-green-600" />
                            </Button>
                            {r.origem === "fatura_consolidada" && (
                              <Button variant="ghost" size="sm" title="Exportar PDF" disabled>
                                <Download className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => r.id && handleExcluir(r.id)} title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* TMS-FIN-PROG-05C.3B — paginação real e visível (PaginationBar) */}
          <PaginationBar
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            onPageChange={setPage}
            loading={isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500 shrink-0" />
            <div>
              <CardTitle className="text-lg">Faturamento Potencial da Programação</CardTitle>
              <CardDescription>
                {escalaFaturamentoLoading ? "Carregando..." : "Dados preparados da programação — ainda não lançados como recebível"}
              </CardDescription>
            </div>
            <Badge variant="outline" className="ml-auto text-xs text-indigo-600 border-indigo-200 bg-indigo-50 shrink-0">
              Origem: Programação Operacional
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 mb-4">
            <p className="font-bold mb-0.5">Faturamento de serviços mudou de lugar</p>
            <p>
              A geração de recebíveis a partir da Programação/OS foi descontinuada nesta tela (usava colunas
              inexistentes no banco). Para faturar serviços, acesse <strong>Financeiro &gt; Conferência Financeira</strong>,
              selecione os serviços e crie a fatura.
            </p>
          </div>
          {escalaFaturamentoLoading ? (
            <div className="text-center py-4 text-muted-foreground">Carregando dados da Programação...</div>
          ) : escalaFaturamento.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum faturamento pendente da Programação Operacional
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">OS</TableHead>
                    <TableHead className="text-xs">Cliente</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs text-right">Valor Frete</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalaFaturamento.map(item => (
                    <TableRow key={item.alocacaoId}>
                      <TableCell className="font-mono text-xs">{item.os || "-"}</TableCell>
                      <TableCell className="text-xs">
                        {item.clienteNome ? (
                          <span>{item.clienteNome}</span>
                        ) : (
                          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200 text-[10px]">Não vinculado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{item.data ? new Date(item.data).toLocaleDateString("pt-BR") : "-"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{item.valorFrete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="text-right text-sm text-muted-foreground">
                Total potencial:{" "}
                <span className="font-bold text-indigo-600">
                  {escalaFaturamento.reduce((acc, i) => acc + i.valorFrete, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                <span className="ml-2 text-xs">(faturar via Financeiro &gt; Conferência)</span>
              </div>
            </div>
          )}
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
              <div><Label className="text-xs text-muted-foreground">Cliente</Label><p className="font-medium">{recebivelSelecionado.clienteNome || <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">Cliente não vinculado</Badge>}</p></div>
              <div><Label className="text-xs text-muted-foreground">CNPJ/CPF</Label><p className="font-medium">{recebivelSelecionado.clienteDocumento || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Documento / Fatura</Label><p className="font-medium">{recebivelSelecionado.documento}</p></div>
              <div><Label className="text-xs text-muted-foreground">Origem</Label><p className="font-medium">{recebivelSelecionado.origem || (recebivelSelecionado.osVinculadas ? "OS" : "Manual")}</p></div>
              <div><Label className="text-xs text-muted-foreground">OS Vinculadas</Label><p className="font-medium">{recebivelSelecionado.osVinculadas || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Contrato</Label><p className="font-medium">{recebivelSelecionado.contratoVinculado || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Valor Bruto</Label><p className="font-medium">{fmtFin(recebivelSelecionado.valorBruto)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Desconto</Label><p className="font-medium text-green-600">-{fmtFin(recebivelSelecionado.desconto)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Juros/Multa</Label><p className="font-medium text-red-600">+{fmtFin(recebivelSelecionado.juros + recebivelSelecionado.multa)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Valor Líquido</Label><p className="font-bold text-lg">{fmtFin(recebivelSelecionado.valorLiquido)}</p></div>
              <div><Label className="text-xs text-muted-foreground">Emissão</Label><p className="font-medium">{recebivelSelecionado.dataEmissao ? new Date(recebivelSelecionado.dataEmissao + "T12:00:00").toLocaleDateString() : "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Vencimento</Label><p className="font-medium">{recebivelSelecionado.dataVencimento ? new Date(recebivelSelecionado.dataVencimento + "T12:00:00").toLocaleDateString() : "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Competência</Label><p className="font-medium">{recebivelSelecionado.competencia || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Categoria</Label><p className="font-medium">{CATEGORIAS_RECEITA.find(c => c.value === recebivelSelecionado.categoriaId)?.label || "-"}</p></div>
              <div><Label className="text-xs text-muted-foreground">Status</Label><Badge>{recebivelSelecionado.status}</Badge></div>
              <div><Label className="text-xs text-muted-foreground">Fiscal</Label><Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 border-slate-200">Sem nota</Badge></div>
              <div><Label className="text-xs text-muted-foreground">Boleto</Label><Badge variant="outline" className="text-xs bg-slate-50 text-slate-500 border-slate-200">Sem boleto</Badge></div>
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
                    {contasBancarias.filter(c => c.ativa).map(cf => (<SelectItem key={cf.id} value={cf.id}>{cf.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Referência Bancária</Label>
                <Input value={dadosBaixa.referenciaBancaria} onChange={(e) => setDadosBaixa({...dadosBaixa, referenciaBancaria: e.target.value})} placeholder="Nº do comprovante / transação..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Observações</Label>
                <Textarea value={dadosBaixa.observacoes} onChange={(e) => setDadosBaixa({...dadosBaixa, observacoes: e.target.value})} className="resize-none" placeholder="Observações sobre o recebimento..." />
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

      <Dialog open={showBoleto} onOpenChange={setShowBoleto}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-amber-600" /> Gerar Boleto Bancário
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-800">Preparação para emissão de boleto</p>
                <p className="text-xs text-amber-600 mt-1">Integração bancária pendente de configuração</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{recebivelSelecionado.clienteNome || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Documento:</span> <span className="font-medium">{recebivelSelecionado.clienteDocumento || "N/A"}</span></div>
                <div><span className="text-muted-foreground">Valor:</span> <span className="font-bold">{fmtFin(recebivelSelecionado.valorLiquido)}</span></div>
                <div><span className="text-muted-foreground">Vencimento:</span> <span className="font-medium">{recebivelSelecionado.dataVencimento ? new Date(recebivelSelecionado.dataVencimento + "T12:00:00").toLocaleDateString() : "N/A"}</span></div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Para gerar boletos automaticamente, configure uma conta bancária com integração de cobrança (CNAB400, API de cobrança PIX/Boleto) nas configurações financeiras.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBoleto(false)}>Fechar</Button>
                <Button className="bg-amber-600" disabled title="Integração bancária pendente">
                  <Landmark className="w-4 h-4 mr-2" /> Integração bancária pendente
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNfse} onOpenChange={setShowNfse}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-green-600" /> Emitir NFS-e
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">Conferência fiscal para emissão de NFS-e</p>
                <p className="text-xs text-green-600 mt-1">Verifique os dados abaixo antes de prosseguir</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pendências verificadas</p>
                <div className="grid grid-cols-1 gap-2">
                  {!recebivelSelecionado.clienteId ? (
                    <div className="flex items-center gap-2 text-xs text-red-600"><AlertTriangle className="w-3 h-3" /> Cliente não vinculado</div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600"><Check className="w-3 h-3" /> Cliente vinculado: {recebivelSelecionado.clienteNome}</div>
                  )}
                  {!recebivelSelecionado.clienteDocumento ? (
                    <div className="flex items-center gap-2 text-xs text-red-600"><AlertTriangle className="w-3 h-3" /> CNPJ/CPF do cliente não informado</div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600"><Check className="w-3 h-3" /> Documento do cliente: {recebivelSelecionado.clienteDocumento}</div>
                  )}
                  {!recebivelSelecionado.valorLiquido || recebivelSelecionado.valorLiquido <= 0 ? (
                    <div className="flex items-center gap-2 text-xs text-red-600"><AlertTriangle className="w-3 h-3" /> Valor inválido</div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-green-600"><Check className="w-3 h-3" /> Valor: {fmtFin(recebivelSelecionado.valorLiquido)}</div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" /> Emitente fiscal não configurado (necessário cadastrar certificado digital)</div>
                  <div className="flex items-center gap-2 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" /> Serviço/Código fiscal não definido (necessário configurar no plano de contas)</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNfse(false)}>Fechar</Button>
                <Button className="bg-green-600" disabled title="Configurações fiscais pendentes">
                  <FileCheck className="w-4 h-4 mr-2" /> Preparado para emissão
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDetalheFatura} onOpenChange={setShowDetalheFatura}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Detalhes da Fatura Consolidada
            </DialogTitle>
          </DialogHeader>
          {recebivelSelecionado && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Fatura:</span> <span className="font-bold">{recebivelSelecionado.faturaNumero || recebivelSelecionado.documento}</span></div>
                <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{recebivelSelecionado.clienteNome}</span></div>
                <div><span className="text-muted-foreground">CNPJ/CPF:</span> <span className="font-medium">{recebivelSelecionado.clienteDocumento || "-"}</span></div>
                <div><span className="text-muted-foreground">Vencimento:</span> <span className="font-medium">{recebivelSelecionado.dataVencimento ? new Date(recebivelSelecionado.dataVencimento + "T12:00:00").toLocaleDateString() : "-"}</span></div>
                <div><span className="text-muted-foreground">Competência:</span> <span className="font-medium">{recebivelSelecionado.competencia || "-"}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <Badge>{recebivelSelecionado.status}</Badge></div>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal: {fmtFin(recebivelSelecionado.valorBruto)}</span>
                  <span>Desconto: -{fmtFin(recebivelSelecionado.desconto)}</span>
                  <span className="font-bold text-indigo-600">Líquido: {fmtFin(recebivelSelecionado.valorLiquido)}</span>
                </div>
              </div>
              {faturaDetalheItens.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Itens vinculados ({faturaDetalheItens.length})</p>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Documento</TableHead>
                          <TableHead className="text-xs">Origem</TableHead>
                          <TableHead className="text-xs">OS</TableHead>
                          <TableHead className="text-xs text-right">Valor</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faturaDetalheItens.map((item, i) => (
                          <TableRow key={item.id || i}>
                            <TableCell className="text-xs">{item.documento || "-"}</TableCell>
                            <TableCell className="text-xs">{item.origem}</TableCell>
                            <TableCell className="text-xs">{item.os || "-"}</TableCell>
                            <TableCell className="text-xs text-right">{fmtFin(item.valor)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{item.status}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              {recebivelSelecionado.observacoes && (
                <div><Label className="text-xs text-muted-foreground">Observações</Label><p className="text-sm">{recebivelSelecionado.observacoes}</p></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}