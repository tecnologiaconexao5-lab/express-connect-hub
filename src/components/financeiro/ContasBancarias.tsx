import React, { useState, useEffect } from "react";
import {
  Plus, Building2, Wallet, ArrowRightLeft, Landmark, Check, AlertCircle,
  MoreHorizontal, Eye, Edit2, TrendingUp, TrendingDown, History,
  Star, StarOff, PowerOff, Power, X, ChevronRight, Search
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Conta {
  id: string;
  nome: string;
  tipo: string;
  banco: string;
  agencia: string;
  numero_conta: string;
  digito: string;
  titular: string;
  saldo: number;
  saldo_inicial: number;
  ativa: boolean;
  principal: boolean;
  empresa: string;
  plano_contas: string;
  observacoes: string;
  cor: string;
}

interface Transferencia {
  id: string;
  dataHora: string;
  data: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  taxa: number;
  historico: string;
  nomeOrigem: string;
  nomeDestino: string;
}

// ─── Initial data (seed fallback) ────────────────────────────────────────────

const CONTAS_SEED: Omit<Conta, 'id'>[] = [
  {
    nome: "Conta Corrente Principal", tipo: "Conta Corrente",
    banco: "Itaú Unibanco", agencia: "1234", numero_conta: "56789", digito: "0",
    titular: "Express Connect Transportes LTDA", saldo: 145000.50, saldo_inicial: 100000,
    ativa: true, principal: true, empresa: "Matriz (SP)",
    plano_contas: "Disponibilidades", observacoes: "", cor: "#2563eb"
  },
  {
    nome: "Conta Reserva / Impostos", tipo: "Conta Poupança",
    banco: "Bradesco", agencia: "4321", numero_conta: "98765", digito: "4",
    titular: "Express Connect Transportes LTDA", saldo: 85200.00, saldo_inicial: 80000,
    ativa: true, principal: false, empresa: "Matriz (SP)",
    plano_contas: "Reservas", observacoes: "Reserva para tributos", cor: "#7c3aed"
  },
  {
    nome: "Cartão Corporativo Digital", tipo: "Conta Digital",
    banco: "Nubank", agencia: "0001", numero_conta: "11223344", digito: "5",
    titular: "Express Connect Hub", saldo: 12500.00, saldo_inicial: 10000,
    ativa: true, principal: false, empresa: "Matriz (SP)",
    plano_contas: "Disponibilidades", observacoes: "", cor: "#8b5cf6"
  },
  {
    nome: "Caixa Interno — Pequenos Gastos", tipo: "Caixa Físico",
    banco: "—", agencia: "—", numero_conta: "—", digito: "—",
    titular: "Financeiro Interno", saldo: 1250.75, saldo_inicial: 2000,
    ativa: true, principal: false, empresa: "Matriz (SP)",
    plano_contas: "Caixa Geral", observacoes: "Reposição mensal: R$ 2.000", cor: "#0891b2"
  },
];

const TIPO_CONTA_CORES: Record<string, string> = {
  "Conta Corrente": "bg-blue-100 text-blue-700 border-blue-200",
  "Conta Poupança": "bg-violet-100 text-violet-700 border-violet-200",
  "Conta Digital": "bg-purple-100 text-purple-700 border-purple-200",
  "Caixa Físico": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "Conta Investimento": "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtHora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// ─── Form blank states ────────────────────────────────────────────────────────

const NOVA_CONTA_BLANK = {
  nome: "", tipo: "", banco: "", agencia: "", numero_conta: "", digito: "",
  titular: "", saldo_inicial: 0, ativa: true, principal: false,
  empresa: "Matriz (SP)", plano_contas: "Disponibilidades", observacoes: "", cor: "#2563eb"
};

const TRANSFERENCIA_BLANK = {
  contaOrigemId: "", contaDestinoId: "", valor: 0, taxa: 0,
  data: new Date().toISOString().split("T")[0], historico: ""
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ContasBancarias() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [historico, setHistorico] = useState<Transferencia[]>([]);
  const [busca, setBusca] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modais
  const [showNovaConta, setShowNovaConta] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [showHistorico, setShowHistorico] = useState(false);
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);

  // Estados submetendo
  const [isSubmittingConta, setIsSubmittingConta] = useState(false);
  const [isSubmittingTransf, setIsSubmittingTransf] = useState(false);

  // Formulários
  const [novaConta, setNovaConta] = useState({ ...NOVA_CONTA_BLANK });
  const [transferencia, setTransferencia] = useState({ ...TRANSFERENCIA_BLANK });
  const [errosConta, setErrosConta] = useState<Record<string, string>>({});
  const [errosTransf, setErrosTransf] = useState<Record<string, string>>({});

  // ── Fetch contas from Supabase ──
  const fetchContas = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("*")
        .order("nome");

      if (error) {
        if (error.code === "42P01") {
          setFetchError("Tabela de contas financeiras não encontrada no banco de dados.");
          setContas([]);
          return;
        }
        throw error;
      }

      if (!data || data.length === 0) {
        setContas([]);
        return;
      }

      setContas(data as Conta[]);
    } catch (e: any) {
      console.error("[ContasBancarias] Erro ao buscar contas:", e?.message || e);
      setFetchError("Erro ao carregar contas do banco de dados.");
      setContas([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContas();
  }, []);

  // ── Computed ──
  const saldoTotal = contas.filter(c => c.ativa).reduce((a, c) => a + c.saldo, 0);
  const contasAtivas = contas.filter(c => c.ativa).length;
  const contasFiltradas = contas.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.banco.toLowerCase().includes(busca.toLowerCase()) ||
    c.tipo.toLowerCase().includes(busca.toLowerCase())
  );

  // ── Validação conta ──
  const validarConta = () => {
    const erros: Record<string, string> = {};
    if (!novaConta.nome.trim()) erros.nome = "Nome da conta é obrigatório";
    if (!novaConta.tipo) erros.tipo = "Selecione o tipo de conta";
    if (!novaConta.banco.trim()) erros.banco = "Informe a instituição financeira";
    if (!novaConta.titular.trim()) erros.titular = "Informe o titular da conta";
    const nomeTrim = novaConta.nome.trim().toLowerCase();
    const duplicado = contas.some(c =>
      c.nome.toLowerCase() === nomeTrim && c.id !== (contaEditando?.id ?? "")
    );
    if (duplicado) erros.nome = "Já existe uma conta com este nome";
    setErrosConta(erros);
    return Object.keys(erros).length === 0;
  };

  // ── Validação transferência ──
  const validarTransferencia = () => {
    const erros: Record<string, string> = {};
    if (!transferencia.contaOrigemId) erros.origem = "Selecione a conta de origem";
    if (!transferencia.contaDestinoId) erros.destino = "Selecione a conta de destino";
    if (transferencia.contaOrigemId && transferencia.contaDestinoId &&
        transferencia.contaOrigemId === transferencia.contaDestinoId)
      erros.destino = "Origem e destino devem ser diferentes";
    if (!transferencia.valor || transferencia.valor <= 0) erros.valor = "Informe um valor válido";
    if (transferencia.taxa < 0) erros.taxa = "Taxa não pode ser negativa";
    if (!transferencia.data) erros.data = "Informe a data da transferência";

    if (transferencia.contaOrigemId && transferencia.valor > 0) {
      const origem = contas.find(c => c.id === transferencia.contaOrigemId);
      const totalSair = transferencia.valor + (transferencia.taxa || 0);
      if (origem && origem.saldo < totalSair) {
        erros.valor = `Saldo insuficiente. Disponível: ${fmtBRL(origem.saldo)}`;
      }
    }

    setErrosTransf(erros);
    return Object.keys(erros).length === 0;
  };

  // ── Salvar conta (criar/editar no Supabase) ──
  const handleSalvarConta = async () => {
    if (!validarConta()) return;
    try {
      setIsSubmittingConta(true);

      if (contaEditando) {
        const { error } = await supabase
          .from("contas_financeiras")
          .update({
            nome: novaConta.nome.trim(),
            tipo: novaConta.tipo,
            banco: novaConta.banco.trim(),
            agencia: novaConta.agencia || "—",
            numero_conta: novaConta.numero_conta || "—",
            digito: novaConta.digito || "—",
            titular: novaConta.titular.trim(),
            ativa: novaConta.ativa,
            principal: novaConta.principal,
            empresa: novaConta.empresa || "Matriz (SP)",
            plano_contas: novaConta.plano_contas || "Disponibilidades",
            observacoes: novaConta.observacoes,
            cor: novaConta.cor || "#2563eb",
          })
          .eq("id", contaEditando.id);

        if (error) throw error;

        if (novaConta.principal) {
          await supabase
            .from("contas_financeiras")
            .update({ principal: false })
            .neq("id", contaEditando.id)
            .eq("principal", true);
        }

        toast.success("Conta atualizada com sucesso!");
      } else {
        if (novaConta.principal) {
          await supabase
            .from("contas_financeiras")
            .update({ principal: false })
            .eq("principal", true);
        }

        const { error } = await supabase
          .from("contas_financeiras")
          .insert([{
            nome: novaConta.nome.trim(),
            tipo: novaConta.tipo,
            banco: novaConta.banco.trim(),
            agencia: novaConta.agencia || "—",
            numero_conta: novaConta.numero_conta || "—",
            digito: novaConta.digito || "—",
            titular: novaConta.titular.trim(),
            saldo: novaConta.saldo_inicial,
            saldo_inicial: novaConta.saldo_inicial,
            ativa: novaConta.ativa,
            principal: novaConta.principal,
            empresa: novaConta.empresa || "Matriz (SP)",
            plano_contas: novaConta.plano_contas || "Disponibilidades",
            observacoes: novaConta.observacoes,
            cor: novaConta.cor || "#2563eb",
          }]);

        if (error) throw error;
        toast.success("Conta cadastrada com sucesso!");
      }

      setShowNovaConta(false);
      setContaEditando(null);
      setNovaConta({ ...NOVA_CONTA_BLANK });
      setErrosConta({});
      await fetchContas();
    } catch (e: any) {
      console.error("[ContasBancarias] Erro ao salvar conta:", e?.message || e);
      toast.error(`Erro ao salvar conta: ${e?.message || "Tente novamente."}`);
    } finally {
      setIsSubmittingConta(false);
    }
  };

  // ── Transferir entre contas ──
  const handleTransferir = async () => {
    if (!validarTransferencia()) return;
    try {
      setIsSubmittingTransf(true);

      const origem = contas.find(c => c.id === transferencia.contaOrigemId)!;
      const destino = contas.find(c => c.id === transferencia.contaDestinoId)!;
      const totalSair = transferencia.valor + (transferencia.taxa || 0);

      const { error: errOrigem } = await supabase
        .from("contas_financeiras")
        .update({ saldo: origem.saldo - totalSair })
        .eq("id", origem.id);

      if (errOrigem) throw errOrigem;

      const { error: errDestino } = await supabase
        .from("contas_financeiras")
        .update({ saldo: destino.saldo + transferencia.valor })
        .eq("id", destino.id);

      if (errDestino) throw errDestino;

      const novaTransf: Transferencia = {
        id: crypto.randomUUID(),
        dataHora: new Date().toISOString(),
        data: transferencia.data,
        contaOrigemId: origem.id,
        contaDestinoId: destino.id,
        valor: transferencia.valor,
        taxa: transferencia.taxa || 0,
        historico: transferencia.historico || "Transferência entre contas",
        nomeOrigem: origem.nome,
        nomeDestino: destino.nome,
      };
      setHistorico(prev => [novaTransf, ...prev]);

      setShowTransferencia(false);
      setTransferencia({ ...TRANSFERENCIA_BLANK });
      setErrosTransf({});
      toast.success(`Transferência de ${fmtBRL(transferencia.valor)} realizada com sucesso!`);

      await fetchContas();
    } catch (e: any) {
      console.error("[ContasBancarias] Erro na transferência:", e?.message || e);
      toast.error(`Erro ao transferir: ${e?.message || "Tente novamente."}`);
    } finally {
      setIsSubmittingTransf(false);
    }
  };

  const handleEditarConta = (conta: Conta) => {
    setContaEditando(conta);
    setNovaConta({
      nome: conta.nome, tipo: conta.tipo, banco: conta.banco,
      agencia: conta.agencia, numero_conta: conta.numero_conta, digito: conta.digito,
      titular: conta.titular, saldo_inicial: conta.saldo,
      ativa: conta.ativa, principal: conta.principal,
      empresa: conta.empresa, plano_contas: conta.plano_contas,
      observacoes: conta.observacoes, cor: conta.cor
    });
    setShowNovaConta(true);
  };

  const handleToggleAtiva = async (id: string) => {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    try {
      const { error } = await supabase
        .from("contas_financeiras")
        .update({ ativa: !conta.ativa })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Conta ${conta.ativa ? "desativada" : "ativada"} com sucesso.`);
      await fetchContas();
    } catch (e: any) {
      toast.error(`Erro ao ${conta.ativa ? "desativar" : "ativar"} conta.`);
    }
  };

  const handleSetPrincipal = async (id: string) => {
    try {
      await supabase
        .from("contas_financeiras")
        .update({ principal: false })
        .eq("principal", true);

      const { error } = await supabase
        .from("contas_financeiras")
        .update({ principal: true })
        .eq("id", id);

      if (error) throw error;
      toast.success("Conta principal atualizada.");
      await fetchContas();
    } catch (e: any) {
      toast.error("Erro ao definir conta principal.");
    }
  };

  const fecharModalConta = () => {
    setShowNovaConta(false);
    setContaEditando(null);
    setNovaConta({ ...NOVA_CONTA_BLANK });
    setErrosConta({});
  };

  const fecharModalTransf = () => {
    setShowTransferencia(false);
    setTransferencia({ ...TRANSFERENCIA_BLANK });
    setErrosTransf({});
  };

  const origemSelecionada = transferencia.contaOrigemId
    ? contas.find(c => c.id === transferencia.contaOrigemId)
    : null;
  const totalSairTransf = (transferencia.valor || 0) + (transferencia.taxa || 0);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2.5 text-foreground">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Landmark className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Contas, Bancos e Caixas
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 ml-11">
            Gestão centralizada de todas as contas financeiras da empresa
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="gap-2 h-9" onClick={() => setShowHistorico(true)}>
            <History className="w-4 h-4" />
            Histórico
            {historico.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-indigo-100 text-indigo-700 border-indigo-200">
                {historico.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="outline"
            className="gap-2 h-9 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
            onClick={() => setShowTransferencia(true)}
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir
          </Button>

          <Button
            className="gap-2 h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
            onClick={() => { setContaEditando(null); setNovaConta({ ...NOVA_CONTA_BLANK }); setShowNovaConta(true); }}
          >
            <Plus className="w-4 h-4" />
            Nova Conta
          </Button>
        </div>
      </div>

      {/* KPI cards de saldo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-lg p-5 col-span-1">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-2">Saldo Consolidado</p>
          <p className="text-4xl font-black tracking-tight">{fmtBRL(saldoTotal)}</p>
          <p className="text-xs text-indigo-200 mt-2">{contasAtivas} conta{contasAtivas !== 1 ? "s" : ""} ativa{contasAtivas !== 1 ? "s" : ""}</p>
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm p-5 hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-green-500" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Maior Saldo
          </p>
          {(() => {
            const max = [...contas].sort((a, b) => b.saldo - a.saldo)[0];
            return max ? (
              <>
                <p className="text-2xl font-black text-foreground">{fmtBRL(max.saldo)}</p>
                <p className="text-xs text-muted-foreground mt-1 font-medium truncate">{max.nome}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">—</p>;
          })()}
        </div>

        <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm p-5 hover:shadow-md transition-all">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-400 to-purple-500" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3.5 h-3.5 text-violet-600" /> Transferências Realizadas
          </p>
          <p className="text-2xl font-black text-foreground">{historico.length}</p>
          <p className="text-xs text-muted-foreground mt-1 font-medium">
            Total: {fmtBRL(historico.reduce((a, t) => a + t.valor, 0))}
          </p>
        </div>
      </div>

      {/* Tabela de contas */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-5 flex flex-row items-center justify-between gap-4 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold">Contas Cadastradas</CardTitle>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conta..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Carregando contas...</p>
              </div>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-red-500">{fetchError}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchContas}>
                Tentar novamente
              </Button>
            </div>
          ) : contas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Landmark className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">Nenhuma conta cadastrada.</p>
              <p className="text-xs mt-1">Cadastre uma conta para lançar pagamentos.</p>
              <Button
                variant="outline"
                className="mt-4 gap-1.5"
                onClick={() => { setContaEditando(null); setNovaConta({ ...NOVA_CONTA_BLANK }); setShowNovaConta(true); }}
              >
                <Plus className="w-3.5 h-3.5" /> Cadastrar Primeira Conta
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase pl-5">Conta</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Banco</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Ag / Conta</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Titular</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase">Empresa</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right pr-5">Saldo</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground uppercase text-right pr-4">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasFiltradas.map(conta => (
                  <TableRow key={conta.id} className={`hover:bg-muted/20 transition-colors ${!conta.ativa ? "opacity-50" : ""}`}>
                    <TableCell className="pl-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: conta.cor }} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm text-foreground">{conta.nome}</span>
                            {conta.principal && (
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <Badge variant="outline" className={`text-[10px] font-medium px-1.5 py-0 mt-0.5 ${TIPO_CONTA_CORES[conta.tipo] ?? "bg-gray-100 text-gray-600"}`}>
                            {conta.tipo}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{conta.banco}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {conta.agencia !== "—" ? `${conta.agencia} / ` : ""}{conta.numero_conta}{conta.digito !== "—" ? `-${conta.digito}` : ""}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{conta.titular}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{conta.empresa}</TableCell>
                    <TableCell className="text-right pr-5 font-black text-sm">
                      <span className={conta.saldo < 0 ? "text-red-600" : "text-foreground"}>
                        {fmtBRL(conta.saldo)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={conta.ativa
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-[11px]"
                          : "bg-gray-100 text-gray-500 border-gray-200 text-[11px]"}
                      >
                        {conta.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 hover:bg-indigo-50 text-indigo-600"
                          title="Editar"
                          onClick={() => handleEditarConta(conta)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className={`h-7 w-7 p-0 ${conta.ativa ? "hover:bg-red-50 text-red-500" : "hover:bg-emerald-50 text-emerald-600"}`}
                          title={conta.ativa ? "Desativar" : "Ativar"}
                          onClick={() => handleToggleAtiva(conta.id)}
                        >
                          {conta.ativa ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                        {!conta.principal && conta.ativa && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 hover:bg-amber-50 text-amber-500"
                            title="Definir como principal"
                            onClick={() => handleSetPrincipal(conta.id)}
                          >
                            <Star className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Modal: Cadastro / Edição de Conta ─────────────────────────────── */}
      <Dialog open={showNovaConta} onOpenChange={open => { if (!open) fecharModalConta(); else setShowNovaConta(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <Landmark className="w-4 h-4 text-indigo-600" />
              </div>
              {contaEditando ? "Editar Conta Financeira" : "Cadastrar Nova Conta"}
            </DialogTitle>
            <DialogDescription>
              {contaEditando
                ? "Altere os dados da conta. Campos com * são obrigatórios."
                : "Preencha os dados da nova conta. Campos com * são obrigatórios."}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="mt-2">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="dados">Dados Principais</TabsTrigger>
              <TabsTrigger value="bancarios">Dados Bancários</TabsTrigger>
              <TabsTrigger value="config">Configurações</TabsTrigger>
            </TabsList>

            {/* Aba 1 — Dados Principais */}
            <TabsContent value="dados" className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Nome / Identificação <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={novaConta.nome}
                  onChange={e => { setNovaConta(p => ({ ...p, nome: e.target.value })); setErrosConta(p => ({ ...p, nome: "" })); }}
                  placeholder="Ex: Conta Corrente Principal Itaú"
                  className={`h-10 ${errosConta.nome ? "border-red-400 focus-visible:ring-red-300" : ""}`}
                />
                {errosConta.nome && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosConta.nome}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tipo de Conta <span className="text-red-500">*</span>
                  </Label>
                  <Select value={novaConta.tipo} onValueChange={v => { setNovaConta(p => ({ ...p, tipo: v })); setErrosConta(p => ({ ...p, tipo: "" })); }}>
                    <SelectTrigger className={`h-10 ${errosConta.tipo ? "border-red-400" : ""}`}>
                      <SelectValue placeholder="Selecionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                      <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                      <SelectItem value="Conta Digital">Conta Digital / Carteira</SelectItem>
                      <SelectItem value="Caixa Físico">Caixa Físico (Interno)</SelectItem>
                      <SelectItem value="Conta Investimento">Conta Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                  {errosConta.tipo && (
                    <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosConta.tipo}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Saldo Inicial (R$)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={novaConta.saldo_inicial || ""}
                    onChange={e => setNovaConta(p => ({ ...p, saldo_inicial: Number(e.target.value) }))}
                    placeholder="0,00"
                    className="h-10 font-mono text-indigo-700 dark:text-indigo-400 font-bold"
                    disabled={!!contaEditando}
                  />
                  {contaEditando && (
                    <p className="text-xs text-muted-foreground">Saldo atual: {fmtBRL(contaEditando.saldo)}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Titular / Razão Social <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={novaConta.titular}
                  onChange={e => { setNovaConta(p => ({ ...p, titular: e.target.value })); setErrosConta(p => ({ ...p, titular: "" })); }}
                  placeholder="Nome do titular ou empresa"
                  className={`h-10 ${errosConta.titular ? "border-red-400" : ""}`}
                />
                {errosConta.titular && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosConta.titular}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</Label>
                <Textarea
                  value={novaConta.observacoes}
                  onChange={e => setNovaConta(p => ({ ...p, observacoes: e.target.value }))}
                  placeholder="Informações adicionais sobre esta conta..."
                  className="resize-none h-20"
                />
              </div>
            </TabsContent>

            {/* Aba 2 — Dados Bancários */}
            <TabsContent value="bancarios" className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Instituição Financeira / Banco <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={novaConta.banco}
                  onChange={e => { setNovaConta(p => ({ ...p, banco: e.target.value })); setErrosConta(p => ({ ...p, banco: "" })); }}
                  placeholder="Itaú, Bradesco, Nubank, Caixa..."
                  className={`h-10 ${errosConta.banco ? "border-red-400" : ""}`}
                />
                {errosConta.banco && (
                  <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosConta.banco}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Agência</Label>
                  <Input
                    value={novaConta.agencia}
                    onChange={e => setNovaConta(p => ({ ...p, agencia: e.target.value }))}
                    placeholder="0000"
                    className="h-10 font-mono"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Número da Conta</Label>
                  <Input
                    value={novaConta.numero_conta}
                    onChange={e => setNovaConta(p => ({ ...p, numero_conta: e.target.value }))}
                    placeholder="00000"
                    className="h-10 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dígito</Label>
                  <Input
                    value={novaConta.digito}
                    onChange={e => setNovaConta(p => ({ ...p, digito: e.target.value }))}
                    placeholder="0"
                    className="h-10 font-mono"
                    maxLength={2}
                  />
                </div>
              </div>

              {novaConta.banco && (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                  <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wide">Dados bancários</p>
                  <p className="font-mono font-medium">
                    {novaConta.banco}{novaConta.agencia ? ` · Ag: ${novaConta.agencia}` : ""}{novaConta.numero_conta ? ` · C/C: ${novaConta.numero_conta}${novaConta.digito ? `-${novaConta.digito}` : ""}` : ""}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Aba 3 — Configurações */}
            <TabsContent value="config" className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Empresa / Unidade</Label>
                  <Select value={novaConta.empresa} onValueChange={v => setNovaConta(p => ({ ...p, empresa: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Matriz (SP)">Matriz (SP)</SelectItem>
                      <SelectItem value="Filial (RJ)">Filial (RJ)</SelectItem>
                      <SelectItem value="Filial (MG)">Filial (MG)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plano de Contas</Label>
                  <Select value={novaConta.plano_contas} onValueChange={v => setNovaConta(p => ({ ...p, plano_contas: v }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Disponibilidades">Disponibilidades</SelectItem>
                      <SelectItem value="Reservas">Reservas</SelectItem>
                      <SelectItem value="Caixa Geral">Caixa Geral</SelectItem>
                      <SelectItem value="Conta Operacional">Conta Operacional</SelectItem>
                      <SelectItem value="Fundo de Contingência">Fundo de Contingência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cor de identificação</Label>
                <div className="flex items-center gap-3">
                  {["#2563eb", "#7c3aed", "#8b5cf6", "#0891b2", "#16a34a", "#dc2626", "#d97706", "#475569"].map(cor => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => setNovaConta(p => ({ ...p, cor }))}
                      className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${novaConta.cor === cor ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Conta Ativa</p>
                    <p className="text-xs text-muted-foreground">Conta disponível para movimentações</p>
                  </div>
                  <Switch
                    checked={novaConta.ativa}
                    onCheckedChange={v => setNovaConta(p => ({ ...p, ativa: v }))}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-900/10">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Conta Principal
                    </p>
                    <p className="text-xs text-muted-foreground">Usada como padrão em lançamentos</p>
                  </div>
                  <Switch
                    checked={novaConta.principal}
                    onCheckedChange={v => setNovaConta(p => ({ ...p, principal: v }))}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={fecharModalConta} disabled={isSubmittingConta} className="h-10">
              Cancelar
            </Button>
            <Button
              onClick={handleSalvarConta}
              disabled={isSubmittingConta}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 font-semibold"
            >
              {isSubmittingConta
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Salvando...</span>
                : <><Check className="w-4 h-4 mr-1.5" />{contaEditando ? "Salvar Alterações" : "Cadastrar Conta"}</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Transferência ──────────────────────────────────────────── */}
      <Dialog open={showTransferencia} onOpenChange={open => { if (!open) fecharModalTransf(); else setShowTransferencia(true); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              </div>
              Transferência entre Contas
            </DialogTitle>
            <DialogDescription>
              Mova saldo entre contas da empresa. A operação é registrada no histórico.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Conta de Origem <span className="text-red-500">*</span>
              </Label>
              <Select
                value={transferencia.contaOrigemId}
                onValueChange={v => { setTransferencia(p => ({ ...p, contaOrigemId: v })); setErrosTransf(p => ({ ...p, origem: "", valor: "" })); }}
              >
                <SelectTrigger className={`h-10 ${errosTransf.origem ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Selecione a conta de origem" />
                </SelectTrigger>
                <SelectContent>
                  {contas.filter(c => c.ativa).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.cor }} />
                        {c.nome} — <span className="font-mono text-xs">{fmtBRL(c.saldo)}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errosTransf.origem && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosTransf.origem}</p>}
            </div>

            <div className="flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-full text-xs font-medium text-muted-foreground">
                <ChevronRight className="w-4 h-4" /> Transferir para
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Conta de Destino <span className="text-red-500">*</span>
              </Label>
              <Select
                value={transferencia.contaDestinoId}
                onValueChange={v => { setTransferencia(p => ({ ...p, contaDestinoId: v })); setErrosTransf(p => ({ ...p, destino: "" })); }}
              >
                <SelectTrigger className={`h-10 ${errosTransf.destino ? "border-red-400" : ""}`}>
                  <SelectValue placeholder="Selecione a conta de destino" />
                </SelectTrigger>
                <SelectContent>
                  {contas.filter(c => c.ativa && c.id !== transferencia.contaOrigemId).map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.cor }} />
                        {c.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errosTransf.destino && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosTransf.destino}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Valor (R$) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={transferencia.valor || ""}
                  onChange={e => { setTransferencia(p => ({ ...p, valor: Number(e.target.value) })); setErrosTransf(p => ({ ...p, valor: "" })); }}
                  placeholder="0,00"
                  className={`h-10 font-bold text-indigo-700 dark:text-indigo-400 font-mono ${errosTransf.valor ? "border-red-400" : ""}`}
                />
                {errosTransf.valor && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errosTransf.valor}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Taxa / Encargo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferencia.taxa || ""}
                  onChange={e => setTransferencia(p => ({ ...p, taxa: Number(e.target.value) }))}
                  placeholder="0,00"
                  className="h-10 font-mono text-red-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Data <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={transferencia.data}
                  onChange={e => setTransferencia(p => ({ ...p, data: e.target.value }))}
                  className={`h-10 ${errosTransf.data ? "border-red-400" : ""}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</Label>
                <Input
                  value={transferencia.historico}
                  onChange={e => setTransferencia(p => ({ ...p, historico: e.target.value }))}
                  placeholder="Descrição da transferência"
                  className="h-10"
                />
              </div>
            </div>

            {transferencia.valor > 0 && (
              <div className={`p-3 rounded-lg border text-sm space-y-1 ${
                origemSelecionada && origemSelecionada.saldo < totalSairTransf
                  ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800"
                  : "bg-indigo-50 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-800"
              }`}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Resumo da operação</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">Valor transferido:</span>
                  <span className="font-semibold text-xs">{fmtBRL(transferencia.valor)}</span>
                </div>
                {transferencia.taxa > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-xs">Taxa / encargo:</span>
                    <span className="font-semibold text-xs text-red-600">- {fmtBRL(transferencia.taxa)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-xs font-bold">Total debitado da origem:</span>
                  <span className="font-black text-sm">{fmtBRL(totalSairTransf)}</span>
                </div>
                {origemSelecionada && (
                  <div className={`flex justify-between ${origemSelecionada.saldo < totalSairTransf ? "text-red-600" : "text-muted-foreground"}`}>
                    <span className="text-xs">Saldo após transferência:</span>
                    <span className="font-semibold text-xs">{fmtBRL(origemSelecionada.saldo - totalSairTransf)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={fecharModalTransf} disabled={isSubmittingTransf} className="h-10">
              Cancelar
            </Button>
            <Button
              onClick={handleTransferir}
              disabled={isSubmittingTransf}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 font-semibold"
            >
              {isSubmittingTransf
                ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Transferindo...</span>
                : <><ArrowRightLeft className="w-4 h-4 mr-1.5" /> Confirmar Transferência</>
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Histórico ─────────────────────────────────────────────── */}
      <Dialog open={showHistorico} onOpenChange={setShowHistorico}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                <History className="w-4 h-4 text-violet-600" />
              </div>
              Histórico de Transferências
            </DialogTitle>
            <DialogDescription>
              Registro de todas as transferências entre contas realizadas.
            </DialogDescription>
          </DialogHeader>

          {historico.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-medium">Nenhuma transferência realizada ainda.</p>
              <p className="text-xs mt-1">As transferências aparecerão aqui após serem confirmadas.</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {historico.map(t => (
                <div key={t.id} className="rounded-xl border p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px]">
                          Transferência
                        </Badge>
                        <span className="text-xs text-muted-foreground">{fmtData(t.data)} às {fmtHora(t.dataHora)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-foreground truncate max-w-[130px]">{t.nomeOrigem}</span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold text-foreground truncate max-w-[130px]">{t.nomeDestino}</span>
                      </div>
                      {t.historico && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{t.historico}"</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-black text-lg text-indigo-700 dark:text-indigo-400">{fmtBRL(t.valor)}</p>
                      {t.taxa > 0 && (
                        <p className="text-xs text-red-500 font-medium">+ {fmtBRL(t.taxa)} taxa</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
