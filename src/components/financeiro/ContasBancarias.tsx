import React, { useState, useEffect } from "react";
import { Plus, Building2, Wallet, Banknote, MoreHorizontal, ArrowRightLeft, Landmark, Pencil, Trash2, Eye, Search, Upload, Download, RefreshCw, ArrowUpRight, ArrowDownRight, CreditCard, Check, X, FileText, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TIPOS_CONTA = [
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Conta Poupança" },
  { value: "digital", label: "Conta Digital / Carteira" },
  { value: "caixa", label: "Caixa Interno" },
  { value: "investimento", label: "Conta Investimento" },
  { value: "transitoria", label: "Conta Transitória" },
];

const BANCOS = [
  { value: "itau", label: "Itaú" },
  { value: "bradesco", label: "Bradesco" },
  { value: "bb", label: "Banco do Brasil" },
  { value: "santander", label: "Santander" },
  { value: "caixa", label: "Caixa Econômica" },
  { value: "nubank", label: "Nubank" },
  { value: "inter", label: "Inter" },
  { value: "c6", label: "C6 Bank" },
  { value: "safra", label: "Safra" },
  { value: "outro", label: "Outro" },
];

const UNIDADES = [
  { value: "matriz_sp", label: "Matriz (SP)" },
  { value: "filial_rj", label: "Filial (RJ)" },
  { value: "filial_mg", label: "Filial (MG)" },
  { value: "filial_pr", label: "Filial (PR)" },
];

interface ContaFinanceira {
  id: string;
  nome: string;
  tipo: string;
  banco: string;
  agencia: string;
  conta: string;
  digito: string;
  titular: string;
  cpfCnpj?: string;
  saldoInicial: number;
  saldoAtual: number;
  status: "ativa" | "inativa";
  principal: boolean;
  contaContabil?: string;
  centroResultado?: string;
  unidade: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

interface Transferencia {
  id: string;
  contaOrigemId: string;
  contaDestinoId: string;
  valor: number;
  data: string;
  historico: string;
  taxa?: number;
  status: "pendente" | "realizada" | "cancelada";
}

export default function ContasBancarias() {
  const [contas, setContas] = useState<ContaFinanceira[]>([
    { id: "1", nome: "Conta Corrente Principal", tipo: "corrente", banco: "Itaú", agencia: "1234", conta: "56789", digito: "0", titular: "Express Connect Transportes LTDA", cpfCnpj: "12.345.678/0001-90", saldoInicial: 100000, saldoAtual: 145000.50, status: "ativa", principal: true, unidade: "matriz_sp", observacoes: "Conta principal para operações", criadoEm: "2026-01-01", atualizadoEm: "2026-04-10" },
    { id: "2", nome: "Conta Reserva / Impostos", tipo: "poupanca", banco: "Bradesco", agencia: "4321", conta: "98765", digito: "4", titular: "Express Connect Transportes LTDA", cpfCnpj: "12.345.678/0001-90", saldoInicial: 50000, saldoAtual: 85200.00, status: "ativa", principal: false, unidade: "matriz_sp", criadoEm: "2026-01-15", atualizadoEm: "2026-04-08" },
    { id: "3", nome: "Cartão Corporativo Digital", tipo: "digital", banco: "Nubank", agencia: "0001", conta: "11223344", digito: "5", titular: "Express Connect Hub", cpfCnpj: "12.345.678/0001-90", saldoInicial: 10000, saldoAtual: 12500.00, status: "ativa", principal: false, unidade: "matriz_sp", criadoEm: "2026-02-01", atualizadoEm: "2026-04-05" },
    { id: "4", nome: "Caixa Interno", tipo: "caixa", banco: "-", agencia: "-", conta: "-", digito: "", titular: "Financeiro Interno", saldoInicial: 1000, saldoAtual: 1250.75, status: "ativa", principal: false, unidade: "matriz_sp", observacoes: "Pequenos gastos operacionais", criadoEm: "2026-01-01", atualizadoEm: "2026-04-09" },
  ]);

  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  
  const [showNovaConta, setShowNovaConta] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [contaEditando, setContaEditando] = useState<ContaFinanceira | null>(null);
  const [busca, setBusca] = useState("");

  const [novaConta, setNovaConta] = useState({
    nome: "",
    tipo: "corrente",
    banco: "",
    agencia: "",
    conta: "",
    digito: "",
    titular: "",
    cpfCnpj: "",
    saldoInicial: 0,
    status: "ativa" as const,
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
    historico: "",
    taxa: 0
  });

  const saldoTotal = contas.reduce((acc, c) => acc + (c.status === "ativa" ? c.saldoAtual : 0), 0);
  const saldoContasAtivas = contas.filter(c => c.status === "ativa").length;
  const saldoCaixas = contas.filter(c => c.tipo === "caixa").reduce((acc, c) => acc + c.saldoAtual, 0);
  const saldoBancario = contas.filter(c => c.tipo !== "caixa").reduce((acc, c) => acc + c.saldoAtual, 0);

  const filtradas = contas.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.banco.toLowerCase().includes(busca.toLowerCase()) ||
    c.titular.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSalvarConta = () => {
    if (!novaConta.nome || !novaConta.tipo) {
      toast.error("Preencha o nome e tipo da conta");
      return;
    }

    const conta: ContaFinanceira = {
      id: contaEditando?.id || Date.now().toString(),
      ...novaConta,
      saldoAtual: contaEditando ? contaEditando.saldoAtual : novaConta.saldoInicial,
      criadoEm: contaEditando?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    if (contaEditando) {
      setContas(contas.map(c => c.id === conta.id ? conta : c));
      toast.success("Conta atualizada com sucesso!");
    } else {
      setContas([...contas, conta]);
      toast.success("Conta cadastrada com sucesso!");
    }

    setShowNovaConta(false);
    setContaEditando(null);
    setNovaConta({
      nome: "", tipo: "corrente", banco: "", agencia: "", conta: "", digito: "", titular: "", cpfCnpj: "", saldoInicial: 0, status: "ativa", principal: false, contaContabil: "", centroResultado: "", unidade: "matriz_sp", observacoes: ""
    });
  };

  const handleTransferencia = () => {
    if (!novaTransferencia.contaOrigemId || !novaTransferencia.contaDestinoId || !novaTransferencia.valor) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (novaTransferencia.contaOrigemId === novaTransferencia.contaDestinoId) {
      toast.error("As contas de origem e destino devem ser diferentes");
      return;
    }

    const origem = contas.find(c => c.id === novaTransferencia.contaOrigemId);
    if (!origem || origem.saldoAtual < novaTransferencia.valor) {
      toast.error("Saldo insuficiente para transferência");
      return;
    }

    const transferencia: Transferencia = {
      id: Date.now().toString(),
      ...novaTransferencia,
      status: "realizada"
    };

    const valorFinal = novaTransferencia.valor + (novaTransferencia.taxa || 0);

    setContas(contas.map(c => {
      if (c.id === novaTransferencia.contaOrigemId) {
        return { ...c, saldoAtual: c.saldoAtual - valorFinal };
      }
      if (c.id === novaTransferencia.contaDestinoId) {
        return { ...c, saldoAtual: c.saldoAtual + novaTransferencia.valor };
      }
      return c;
    }));

    setTransferencias([...transferencias, transferencia]);
    toast.success("Transferência realizada com sucesso!");
    setShowTransferencia(false);
    setNovaTransferencia({ contaOrigemId: "", contaDestinoId: "", valor: 0, data: new Date().toISOString().split("T")[0], historico: "", taxa: 0 });
  };

  const handleEditar = (conta: ContaFinanceira) => {
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
      status: conta.status,
      principal: conta.principal,
      contaContabil: conta.contaContabil || "",
      centroResultado: conta.centroResultado || "",
      unidade: conta.unidade,
      observacoes: conta.observacoes || ""
    });
    setShowNovaConta(true);
  };

  const handleExcluir = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta conta?")) {
      setContas(contas.filter(c => c.id !== id));
      toast.success("Conta excluída");
    }
  };

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
              <Button variant="outline" className="gap-2"><ArrowRightLeft className="w-4 h-4"/> Transferência</Button>
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
                  <Select value={novaTransferencia.contaOrigemId} onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaOrigemId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                    <SelectContent>
                      {contas.filter(c => c.status === "ativa").map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} - Saldo: {formatCurrency(c.saldoAtual)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conta Destino *</Label>
                  <Select value={novaTransferencia.contaDestinoId} onValueChange={(v) => setNovaTransferencia({...novaTransferencia, contaDestinoId: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                    <SelectContent>
                      {contas.filter(c => c.status === "ativa" && c.id !== novaTransferencia.contaOrigemId).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$) *</Label>
                    <Input type="number" value={novaTransferencia.valor || ""} onChange={(e) => setNovaTransferencia({...novaTransferencia, valor: Number(e.target.value)})} placeholder="0,00" className="font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={novaTransferencia.data} onChange={(e) => setNovaTransferencia({...novaTransferencia, data: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Taxa/Tarifa (R$)</Label>
                  <Input type="number" value={novaTransferencia.taxa || ""} onChange={(e) => setNovaTransferencia({...novaTransferencia, taxa: Number(e.target.value)})} placeholder="0,00" className="text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Histórico</Label>
                  <Textarea value={novaTransferencia.historico} onChange={(e) => setNovaTransferencia({...novaTransferencia, historico: e.target.value})} placeholder="Descrição da transferência..." className="resize-none" />
                </div>
                {novaTransferencia.valor > 0 && (
                  <div className="bg-muted p-3 rounded-lg flex justify-between items-center">
                    <span className="text-sm font-medium">Total a debitar:</span>
                    <span className="font-bold text-lg">{formatCurrency(novaTransferencia.valor + (novaTransferencia.taxa || 0))}</span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTransferencia(false)}>Cancelar</Button>
                <Button onClick={handleTransferencia} className="gap-2"><Check className="w-4 h-4"/> Confirmar Transferência</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showNovaConta} onOpenChange={(open) => { setShowNovaConta(open); if (!open) setContaEditando(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"><Plus className="w-4 h-4"/> Nova Conta/Caixa</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{contaEditando ? "Editar Conta" : "Cadastro de Conta Financeira"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label>Nome da Conta/Identificação *</Label>
                    <Input value={novaConta.nome} onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})} placeholder="Ex: Conta Corrente Principal Itaú" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conta *</Label>
                    <Select value={novaConta.tipo} onValueChange={(v) => setNovaConta({...novaConta, tipo: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_CONTA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Instituição Financeira</Label>
                    <Select value={novaConta.banco} onValueChange={(v) => setNovaConta({...novaConta, banco: v})}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {BANCOS.map(b => <SelectItem key={b.value} value={b.label}>{b.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Agência</Label>
                    <Input value={novaConta.agencia} onChange={(e) => setNovaConta({...novaConta, agencia: e.target.value})} placeholder="0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Número da Conta</Label>
                    <Input value={novaConta.conta} onChange={(e) => setNovaConta({...novaConta, conta: e.target.value})} placeholder="00000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Dígito</Label>
                    <Input value={novaConta.digito} onChange={(e) => setNovaConta({...novaConta, digito: e.target.value})} placeholder="0" className="w-20" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Titularidade</Label>
                    <Select>
                      <SelectTrigger><SelectValue placeholder="Pessoa Jurídica" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                        <SelectItem value="pf">Pessoa Física</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>Titular da Conta / Razão Social</Label>
                    <Input value={novaConta.titular} onChange={(e) => setNovaConta({...novaConta, titular: e.target.value})} placeholder="Nome na conta..." />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>CPF/CNPJ do Titular</Label>
                    <Input value={novaConta.cpfCnpj} onChange={(e) => setNovaConta({...novaConta, cpfCnpj: e.target.value})} placeholder="00.000.000/0001-00" className="font-mono" />
                  </div>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-semibold text-sm">Configurações Financeiras</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Saldo Inicial R$</Label>
                      <Input type="number" value={novaConta.saldoInicial || ""} onChange={(e) => setNovaConta({...novaConta, saldoInicial: Number(e.target.value)})} placeholder="0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Vincular Empresa/Unidade</Label>
                      <Select value={novaConta.unidade} onValueChange={(v) => setNovaConta({...novaConta, unidade: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {UNIDADES.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Conta Contábil</Label>
                      <Input value={novaConta.contaContabil} onChange={(e) => setNovaConta({...novaConta, contaContabil: e.target.value})} placeholder="Código contábil" />
                    </div>
                    <div className="space-y-2">
                      <Label>Centro de Resultado</Label>
                      <Input value={novaConta.centroResultado} onChange={(e) => setNovaConta({...novaConta, centroResultado: e.target.value})} placeholder="Centro de resultado" />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={novaConta.status} onValueChange={(v: any) => setNovaConta({...novaConta, status: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ativa">Ativa</SelectItem>
                          <SelectItem value="inativa">Inativa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input type="checkbox" id="principal" checked={novaConta.principal} onChange={(e) => setNovaConta({...novaConta, principal: e.target.checked})} className="rounded" />
                      <Label htmlFor="principal" className="font-normal">Conta Principal (Padrão para operações)</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações Internas</Label>
                    <Textarea value={novaConta.observacoes} onChange={(e) => setNovaConta({...novaConta, observacoes: e.target.value})} placeholder="Observações sobre esta conta..." className="resize-none" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowNovaConta(false); setContaEditando(null); }}>Cancelar</Button>
                <Button onClick={handleSalvarConta}>{contaEditando ? "Atualizar" : "Salvar"} Conta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cards de Saldo Premium */}
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
              <CreditCard className="w-4 h-4"/> Contas Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contas.filter(c => c.status === "ativa").length}</div>
            <p className="text-xs text-slate-400 mt-1">Total de contas cadastradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Busca e Tabela */}
      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Contas Cadastradas</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar contas..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" />
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
              {filtradas.map(conta => (
                <TableRow key={conta.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="font-semibold text-sm">{conta.nome}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      {conta.tipo === "corrente" && <CreditCard className="w-3 h-3" />}
                      {conta.tipo === "caixa" && <Wallet className="w-3 h-3" />}
                      {conta.tipo === "digital" && <Banknote className="w-3 h-3" />}
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
                    <Badge variant="outline">{UNIDADES.find(u => u.value === conta.unidade)?.label}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-bold text-sm ${conta.saldoAtual < 0 ? "text-red-600" : "text-foreground"}`}>
                    {formatCurrency(conta.saldoAtual)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={conta.status === "ativa" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-50 text-gray-500 border-gray-200"}>
                      {conta.status === "ativa" ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {conta.principal && <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Star className="w-3 h-3 mr-1"/>Principal</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditar(conta)}><Pencil className="w-4 h-4 text-muted-foreground" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-red-500" onClick={() => handleExcluir(conta.id)}><Trash2 className="w-4 h-4" /></Button>
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
}

const Star = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);