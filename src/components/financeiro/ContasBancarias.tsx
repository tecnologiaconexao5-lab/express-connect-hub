import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Plus, Building2, Wallet, Banknote, MoreHorizontal, ArrowRightLeft, Landmark, Pencil, Trash2, Search, Check, X, AlertCircle, Loader2, FileText, TrendingUp, TrendingDown, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  ContaFinanceira, 
  Transferencia, 
  TIPOS_CONTA, 
  BANCOS, 
  UNIDADES, 
  mockContasBancarias, 
  mockTransferencias, 
  formatCurrency, 
  generateId,
  getErrorMessage,
  formatDocument,
  isValidNumber
} from "./types";

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaFinanceira[]>(() => {
    try {
      const saved = localStorage.getItem("contas_financeiras");
      return saved ? JSON.parse(saved) : mockContasBancarias;
    } catch (e) {
      console.error("Erro ao carregar contas:", e);
      return mockContasBancarias;
    }
  });

  const [transferencias, setTransferencias] = useState<Transferencia[]>(() => {
    try {
      const saved = localStorage.getItem("transferencias_financeiras");
      return saved ? JSON.parse(saved) : mockTransferencias;
    } catch (e) {
      console.error("Erro ao carregar transferências:", e);
      return mockTransferencias;
    }
  });

  const [showNovaConta, setShowNovaConta] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaFinanceira | null>(null);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(false);

  const [novaConta, setNovaConta] = useState({
    nome: "",
    tipo: "corrente" as const,
    banco: "",
    agencia: "",
    conta: "",
    digito: "",
    titular: "",
    cpfCnpj: "",
    saldoInicial: 0,
    ativa: true,
    principal: false,
    contaContabil: "",
    centroResultado: "",
    unidade: "matriz_sp",
    observacoes: ""
  });

  const [novaTransferencia, setNovaTransferencia] = useState({
    contaOrigemId: "",
    contaDestinoId: "",
    valor: 0,
    data: new Date().toISOString().split("T")[0],
    descricao: "",
    taxa: 0
  });

  useEffect(() => {
    try {
      localStorage.setItem("contas_financeiras", JSON.stringify(contas));
    } catch (e) {
      console.error("Erro ao salvar contas:", e);
    }
  }, [contas]);

  useEffect(() => {
    try {
      localStorage.setItem("transferencias_financeiras", JSON.stringify(transferencias));
    } catch (e) {
      console.error("Erro ao salvar transferências:", e);
    }
  }, [transferencias]);

  const saldoTotal = useMemo(() => {
    return contas.filter(c => c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const saldoContasAtivas = useMemo(() => {
    return contas.filter(c => c.ativa).length;
  }, [contas]);

  const saldoCaixas = useMemo(() => {
    return contas.filter(c => c.tipo === "caixa" && c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const saldoBancario = useMemo(() => {
    return contas.filter(c => c.tipo !== "caixa" && c.ativa).reduce((acc, c) => acc + c.saldoAtual, 0);
  }, [contas]);

  const filtradas = useMemo(() => {
    if (!busca.trim()) return contas;
    const term = busca.toLowerCase();
    return contas.filter(c => 
      c.nome.toLowerCase().includes(term) ||
      c.banco.toLowerCase().includes(term) ||
      c.titular.toLowerCase().includes(term)
    );
  }, [contas, busca]);

  const handleSalvarConta = useCallback(() => {
    setLoading(true);
    try {
      if (!novaConta.nome.trim()) {
        toast.error("Nome da conta é obrigatório");
        return;
      }

      const conta: ContaFinanceira = {
        id: contaEditando?.id || generateId(),
        nome: novaConta.nome.trim(),
        tipo: novaConta.tipo,
        banco: novaConta.banco || "-",
        agencia: novaConta.agencia || "-",
        conta: novaConta.conta || "-",
        digito: novaConta.digito || "",
        titular: novaConta.titular || "-",
        cpfCnpj: novaConta.cpfCnpj || undefined,
        saldoInicial: contaEditando ? contaEditando.saldoInicial : (isValidNumber(novaConta.saldoInicial) ? novaConta.saldoInicial : 0),
        saldoAtual: contaEditando ? contaEditando.saldoAtual : (isValidNumber(novaConta.saldoInicial) ? novaConta.saldoInicial : 0),
        ativa: novaConta.ativa,
        principal: novaConta.principal,
        unidadeId: novaConta.unidade,
        observacoes: novaConta.observacoes || undefined,
        criadoEm: contaEditando?.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
      };

      if (contaEditando) {
        setContas(prev => prev.map(c => c.id === conta.id ? conta : c));
        toast.success("Conta atualizada com sucesso!");
      } else {
        setContas(prev => [...prev, conta]);
        toast.success("Conta cadastrada com sucesso!");
      }

      setShowNovaConta(false);
      setContaEditando(null);
      setNovaConta({
        nome: "", tipo: "corrente", banco: "", agencia: "", conta: "", digito: "", titular: "", cpfCnpj: "", saldoInicial: 0, ativa: true, principal: false, contaContabil: "", centroResultado: "", unidade: "matriz_sp", observacoes: ""
      });
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [novaConta, contaEditando]);

  const handleTransferencia = useCallback(() => {
    setLoading(true);
    try {
      if (!novaTransferencia.contaOrigemId || !novaTransferencia.contaDestinoId || !novaTransferencia.valor) {
        toast.error("Preencha todos os campos obrigatórios");
        return;
      }

      if (novaTransferencia.contaOrigemId === novaTransferencia.contaDestinoId) {
        toast.error("As contas de origem e destino devem ser diferentes");
        return;
      }

      const origem = contas.find(c => c.id === novaTransferencia.contaOrigemId);
      if (!origem) {
        toast.error("Conta de origem não encontrada");
        return;
      }

      if (origem.saldoAtual < novaTransferencia.valor) {
        toast.error("Saldo insuficiente para transferência");
        return;
      }

      const valorFinal = novaTransferencia.valor + (novaTransferencia.taxa || 0);

      const transferencia: Transferencia = {
        id: generateId(),
        contaOrigemId: novaTransferencia.contaOrigemId,
        contaDestinoId: novaTransferencia.contaDestinoId,
        valor: novaTransferencia.valor,
        data: novaTransferencia.data,
        descricao: novaTransferencia.descricao || "Transferência",
        taxa: novaTransferencia.taxa || undefined,
        status: "realizada",
        createdAt: new Date().toISOString()
      };

      setContas(prev => prev.map(c => {
        if (c.id === novaTransferencia.contaOrigemId) {
          return { ...c, saldoAtual: c.saldoAtual - valorFinal };
        }
        if (c.id === novaTransferencia.contaDestinoId) {
          return { ...c, saldoAtual: c.saldoAtual + novaTransferencia.valor };
        }
        return c;
      }));

      setTransferencias(prev => [...prev, transferencia]);
      toast.success("Transferência realizada com sucesso!");
      setShowTransferencia(false);
      setNovaTransferencia({ contaOrigemId: "", contaDestinoId: "", valor: 0, data: new Date().toISOString().split("T")[0], descricao: "", taxa: 0 });
    } catch (error) {
      console.error("Erro na transferência:", error);
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [novaTransferencia, contas]);

  const handleEditar = useCallback((conta: ContaFinanceira) => {
    try {
      setContaEditando(conta);
      setNovaConta({
        nome: conta.nome,
        tipo: conta.tipo,
        banco: conta.banco,
        agencia: conta.agencia,
        conta: conta.conta,
        digito: conta.digito,
        titular: conta.titular,
        cpfCnpj: conta.cpfCnpj || "",
        saldoInicial: conta.saldoInicial,
        status: conta.ativa ? "ativa" : "inativa",
        principal: conta.principal,
        contaContabil: conta.planoContaId || "",
        centroResultado: conta.centroResultadoId || "",
        unidade: conta.unidadeId || "matriz_sp",
        observacoes: conta.observacoes || ""
      });
      setShowNovaConta(true);
    } catch (error) {
      console.error("Erro ao editar conta:", error);
      toast.error("Erro ao carregar dados da conta");
    }
  }, []);

  const handleExcluir = useCallback((id: string) => {
    try {
      if (confirm("Tem certeza que deseja excluir esta conta?")) {
        setContas(prev => prev.filter(c => c.id !== id));
        toast.success("Conta excluída");
      }
    } catch (error) {
      console.error("Erro ao excluir conta:", error);
      toast.error(getErrorMessage(error));
    }
  }, []);

  const contasaAtivas = useMemo(() => contas.filter(c => c.ativa), [contas]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Contas, Caixas e Bancos
          </h2>
          <p className="text-sm text-muted-foreground">Gestão completa de contas financeiras</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showTransferencia} onOpenChange={setShowTransferencia}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" disabled={loading}>
                <ArrowRightLeft className="w-4 h-4"/> Transferência
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-primary"/>
                  Transferência entre Contas
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Conta Origem *</Label>
                  <Select 
                    value={novaTransferencia.contaOrigemId} 
                    onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaOrigemId: v})}
                    disabled={loading}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                    <SelectContent>
                      {contasaAtivas.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} - Saldo: {formatCurrency(c.saldoAtual)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta Destino *</Label>
                  <Select 
                    value={novaTransferencia.contaDestinoId} 
                    onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaDestinoId: v})}
                    disabled={loading}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                    <SelectContent>
                      {contasaAtivas.filter(c => c.id !== novaTransferencia.contaOrigemId).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$) *</Label>
                    <Input 
                      type="number" 
                      value={novaTransferencia.valor || ""} 
                      onChange={(e) => setNovaTransferencia({...novaTransferencia, valor: Number(e.target.value)})}
                      placeholder="0,00"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input 
                      type="date" 
                      value={novaTransferencia.data} 
                      onChange={(e) => setNovaTransferencia({...novaTransferencia, data: e.target.value})}
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Taxa/Tarifa (R$)</Label>
                  <Input 
                    type="number" 
                    value={novaTransferencia.taxa || ""} 
                    onChange={(e) => setNovaTransferencia({...novaTransferencia, taxa: Number(e.target.value)})}
                    placeholder="0,00"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea 
                    value={novaTransferencia.descricao} 
                    onChange={(e) => setNovaTransferencia({...novaTransferencia, descricao: e.target.value})}
                    placeholder="Descrição da transferência..."
                    className="resize-none"
                    disabled={loading}
                  />
                </div>
                {novaTransferencia.valor > 0 && (
                  <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
                    <span className="text-sm font-medium">Total a debitar:</span>
                    <span className="font-bold text-lg">{formatCurrency(novaTransferencia.valor + (novaTransferencia.taxa || 0))}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTransferencia(false)} disabled={loading}>Cancelar</Button>
                <Button onClick={handleTransferencia} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4"/>}
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNovaConta} onOpenChange={(open) => { setShowNovaConta(open); if (!open) setContaEditando(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                <Plus className="w-4 h-4"/> Nova Conta/Caixa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{contaEditando ? "Editar Conta" : "Cadastro de Conta Financeira"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome da Conta/Identificação *</Label>
                    <Input 
                      value={novaConta.nome} 
                      onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})} 
                      placeholder="Ex: Conta Corrente Principal Itaú"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conta *</Label>
                    <Select 
                      value={novaConta.tipo} 
                      onValueChange={(v: any) => setNovaConta({...novaConta, tipo: v})}
                      disabled={loading}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_CONTA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Instituição Financeira</Label>
                    <Select 
                      value={novaConta.banco} 
                      onValueChange={(v) => setNovaConta({...novaConta, banco: v})}
                      disabled={loading}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {BANCOS.map(b => <SelectItem key={b.value} value={b.label}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input 
                      value={novaConta.agencia} 
                      onChange={(e) => setNovaConta({...novaConta, agencia: e.target.value})} 
                      placeholder="0000"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Número da Conta</Label>
                    <Input 
                      value={novaConta.conta} 
                      onChange={(e) => setNovaConta({...novaConta, conta: e.target.value})} 
                      placeholder="00000"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dígito</Label>
                    <Input 
                      value={novaConta.digito} 
                      onChange={(e) => setNovaConta({...novaConta, digito: e.target.value})} 
                      placeholder="0"
                      className="w-20"
                      disabled={loading}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Titular da Conta / Razão Social</Label>
                    <Input 
                      value={novaConta.titular} 
                      onChange={(e) => setNovaConta({...novaConta, titular: e.target.value})} 
                      placeholder="Nome na conta..."
                      disabled={loading}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>CPF/CNPJ do Titular</Label>
                    <Input 
                      value={novaConta.cpfCnpj} 
                      onChange={(e) => setNovaConta({...novaConta, cpfCnpj: e.target.value})} 
                      placeholder="00.000.000/0001-00"
                      className="font-mono"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold text-sm">Configurações Financeiras</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Saldo Inicial R$</Label>
                      <Input 
                        type="number" 
                        value={novaConta.saldoInicial || ""} 
                        onChange={(e) => setNovaConta({...novaConta, saldoInicial: Number(e.target.value)})} 
                        placeholder="0,00"
                        disabled={loading || !!contaEditando}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vincular Empresa/Unidade</Label>
                      <Select 
                        value={novaConta.unidade} 
                        onValueChange={(v) => setNovaConta({...novaConta, unidade: v})}
                        disabled={loading}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select 
                        value={novaConta.ativa ? "ativa" : "inativa"} 
                        onValueChange={(v: any) => setNovaConta({...novaConta, ativa: v === "ativa"})}
                        disabled={loading}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativa">Ativa</SelectItem>
                          <SelectItem value="inativa">Inativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input 
                        type="checkbox" 
                        id="principal" 
                        checked={novaConta.principal} 
                        onChange={(e) => setNovaConta({...novaConta, principal: e.target.checked})}
                        className="rounded"
                        disabled={loading}
                      />
                      <Label htmlFor="principal" className="font-normal">Conta Principal (Padrão para operações)</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações Internas</Label>
                    <Textarea 
                      value={novaConta.observacoes} 
                      onChange={(e) => setNovaConta({...novaConta, observacoes: e.target.value})} 
                      placeholder="Observações sobre esta conta..."
                      className="resize-none"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNovaConta(false); setContaEditando(null); }} disabled={loading}>Cancelar</Button>
                <Button onClick={handleSalvarConta} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {contaEditando ? "Atualizar" : "Salvar"} Conta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-blue-800 text-white shadow-xl hover:shadow-2xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100 flex items-center gap-2">
              <Wallet className="w-4 h-4"/> Saldo Consolidado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight">{formatCurrency(saldoTotal)}</div>
            <p className="text-xs text-indigo-200 mt-2 flex items-center gap-1">
              <Check className="w-3 h-3" /> {saldoContasAtivas} conta(s) ativa(s)
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-100 flex items-center gap-2">
              <Building2 className="w-4 h-4"/> Saldo em Bancos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(saldoBancario)}</div>
            <p className="text-xs text-emerald-200 mt-1">Contas correntes e digitais</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-100 flex items-center gap-2">
              <Banknote className="w-4 h-4"/> Saldo em Caixas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(saldoCaixas)}</div>
            <p className="text-xs text-amber-200 mt-1">Caixas internos</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white shadow-md hover:shadow-lg transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <RefreshCw className="w-4 h-4"/> Transferências
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transferencias.length}</div>
            <p className="text-xs text-slate-400 mt-1">Total de transferências</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Contas Cadastradas</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar contas..." 
                value={busca} 
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Conta/Identificação</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Agência/Conta</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Saldo Atual</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Principal</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-10 h-10 opacity-50" />
                      <p>Nenhuma conta encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map(conta => (
                  <TableRow key={conta.id} className="hover:bg-muted/20">
                    <TableCell>
                      <div className="font-semibold text-sm">{conta.nome}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        {conta.tipo === "corrente" && <Banknote className="w-3 h-3" />}
                        {conta.tipo === "caixa" && <Wallet className="w-3 h-3" />}
                        {conta.tipo === "digital" && <Building2 className="w-3 h-3" />}
                        {TIPOS_CONTA.find(t => t.value === conta.tipo)?.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      {conta.banco}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {conta.agencia !== "-" ? `${conta.agencia} / ${conta.conta}${conta.digito ? `-${conta.digito}` : ""}` : "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate" title={conta.titular}>
                      {conta.titular}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{UNIDADES.find(u => u.value === conta.unidadeId)?.label}</Badge>
                    </TableCell>
                    <TableCell className={`text-right font-bold text-sm ${conta.saldoAtual < 0 ? "text-red-600" : "text-foreground"}`}>
                      {formatCurrency(conta.saldoAtual)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="outline" 
                        className={conta.ativa ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}
                      >
                        {conta.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {conta.principal && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Principal</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditar(conta)}>
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => handleExcluir(conta.id)}>
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
    </div>
  );
}