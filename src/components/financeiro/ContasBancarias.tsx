import React, { useState } from "react";
import { Plus, Building2, Wallet, Banknote, MoreHorizontal, ArrowRightLeft, Landmark, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContasBancarias() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNovaConta, setShowNovaConta] = useState(false);
  const [novaConta, setNovaConta] = useState({
    nome: "", tipo: "", banco: "", agencia: "", conta: "", titular: "", saldoInicial: 0, empresa: ""
  });

  const [showTransferencia, setShowTransferencia] = useState(false);
  const [transferencia, setTransferencia] = useState({
    contaOrigemId: "", contaDestinoId: "", valor: 0, observacao: ""
  });

  const [contas, setContas] = useState([
    { id: 1, banco: "Itaú", nome: "Conta Corrente Principal", agencia: "1234", conta: "56789-0", tipo: "Conta Corrente", titular: "Express Connect Transportes LTDA", saldo: 145000.50, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 2, banco: "Bradesco", nome: "Conta Reserva / Impostos", agencia: "4321", conta: "98765-4", tipo: "C. Poupança", titular: "Express Connect Transportes LTDA", saldo: 85200.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 3, banco: "Nubank", nome: "Cartão Corporativo Digital", agencia: "0001", conta: "11223344-5", tipo: "Conta Digital", titular: "Express Connect Hub", saldo: 12500.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 4, banco: "Caixa Física", nome: "Caixa Interno (Pequenos Gastos)", agencia: "-", conta: "-", tipo: "Caixinha", titular: "Financeiro Interno", saldo: 1250.75, status: "Ativa", empresa: "Matriz (SP)" },
  ]);

  const saldoTotal = contas.reduce((acc, c) => acc + c.saldo, 0);

  const handleSalvarConta = async () => {
    try {
      setIsSubmitting(true);
      if (!novaConta.nome.trim() || !novaConta.tipo || !novaConta.banco.trim()) {
        toast.error("Preencha Nome, Tipo de Conta e Instituição Financeira.");
        return;
      }

      await new Promise(res => setTimeout(res, 800));

      const newAccount = {
        id: Date.now(),
        banco: novaConta.banco,
        nome: novaConta.nome,
        agencia: novaConta.agencia || "-",
        conta: novaConta.conta || "-",
        tipo: novaConta.tipo,
        titular: novaConta.titular || "Empresa",
        saldo: novaConta.saldoInicial || 0,
        status: "Ativa",
        empresa: novaConta.empresa || "Matriz (SP)"
      };

      setContas(prev => [...prev, newAccount]);
      setShowNovaConta(false);
      setNovaConta({ nome: "", tipo: "", banco: "", agencia: "", conta: "", titular: "", saldoInicial: 0, empresa: "" });
      toast.success("Conta cadastrada com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar conta:", error);
      toast.error("Ocorreu um erro ao salvar a conta. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferir = async () => {
    try {
      setIsSubmitting(true);
      if (!transferencia.contaOrigemId || !transferencia.contaDestinoId) {
        toast.error("Selecione conta de origem e destino.");
        return;
      }
      if (transferencia.contaOrigemId === transferencia.contaDestinoId) {
        toast.error("Conta de origem e destino devem ser diferentes.");
        return;
      }
      if (!transferencia.valor || transferencia.valor <= 0) {
        toast.error("Valor de transferência inválido.");
        return;
      }

      const origemId = parseInt(transferencia.contaOrigemId);
      const contaOrigem = contas.find(c => c.id === origemId);
      if (contaOrigem && contaOrigem.saldo < transferencia.valor) {
        toast.error("Saldo insuficiente na conta de origem.");
        return;
      }

      await new Promise(res => setTimeout(res, 800));

      setContas(prev => prev.map(c => {
        if (c.id === origemId) return { ...c, saldo: c.saldo - transferencia.valor };
        if (c.id === parseInt(transferencia.contaDestinoId)) return { ...c, saldo: c.saldo + transferencia.valor };
        return c;
      }));

      setShowTransferencia(false);
      setTransferencia({ contaOrigemId: "", contaDestinoId: "", valor: 0, observacao: "" });
      toast.success("Transferência realizada com sucesso!");
    } catch (error) {
      console.error("Erro na transferência:", error);
      toast.error("Erro ao realizar transferência. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Landmark className="w-6 h-6 text-primary" />
            Contas da Empresa, Caixas e Bancos
          </h2>
          <p className="text-sm text-muted-foreground">Gestão de saldos, contas bancárias e caixas internos</p>
        </div>
        <div className="flex gap-2">
           <Dialog open={showTransferencia} onOpenChange={setShowTransferencia}>
             <DialogTrigger asChild>
               <Button variant="outline" className="gap-2"><ArrowRightLeft className="w-4 h-4"/> Transferência entre Contas</Button>
             </DialogTrigger>
             <DialogContent className="max-w-md">
               <DialogHeader>
                 <DialogTitle>Transferência entre Contas</DialogTitle>
                 <DialogDescription>Mova fundos entre suas próprias contas e caixas.</DialogDescription>
               </DialogHeader>
               <div className="space-y-4 py-4">
                 <div className="space-y-1">
                   <Label>Conta de Origem</Label>
                   <Select value={transferencia.contaOrigemId} onValueChange={(v) => setTransferencia({...transferencia, contaOrigemId: v})}>
                     <SelectTrigger><SelectValue placeholder="Selecione a conta de origem" /></SelectTrigger>
                     <SelectContent>
                       {contas.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nome} ({formatCurrency(c.saldo)})</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label>Conta de Destino</Label>
                   <Select value={transferencia.contaDestinoId} onValueChange={(v) => setTransferencia({...transferencia, contaDestinoId: v})}>
                     <SelectTrigger><SelectValue placeholder="Selecione a conta de destino" /></SelectTrigger>
                     <SelectContent>
                       {contas.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>)}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-1">
                   <Label>Valor R$</Label>
                   <Input type="number" min="0.01" step="0.01" value={transferencia.valor || ""} onChange={(e) => setTransferencia({...transferencia, valor: Number(e.target.value)})} placeholder="0,00" />
                 </div>
                 <div className="space-y-1">
                   <Label>Observação (Opcional)</Label>
                   <Input value={transferencia.observacao} onChange={(e) => setTransferencia({...transferencia, observacao: e.target.value})} placeholder="Ex: Reposição de caixa" />
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setShowTransferencia(false)} disabled={isSubmitting}>Cancelar</Button>
                 <Button className="bg-primary" onClick={handleTransferir} disabled={isSubmitting}>{isSubmitting ? "Transferindo..." : <><Check className="w-4 h-4 mr-2"/> Transferir</>}</Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>

           <Dialog open={showNovaConta} onOpenChange={setShowNovaConta}>
             <DialogTrigger asChild>
               <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"><Plus className="w-4 h-4"/> Nova Conta/Caixa</Button>
             </DialogTrigger>
             <DialogContent className="max-w-xl">
               <DialogHeader>
                 <DialogTitle>Cadastro de Conta Financeira</DialogTitle>
               </DialogHeader>
               <div className="grid grid-cols-2 gap-4 py-4">
                 <div className="col-span-2">
                   <Label>Nome da Conta/Identificação *</Label>
                   <Input placeholder="Ex: Conta Corrente Principal Itaú" value={novaConta.nome} onChange={(e) => setNovaConta({...novaConta, nome: e.target.value})} />
                 </div>
                 <div>
                   <Label>Tipo de Conta *</Label>
                   <Select value={novaConta.tipo} onValueChange={(v) => setNovaConta({...novaConta, tipo: v})}>
                     <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Conta Corrente">Conta Corrente</SelectItem>
                       <SelectItem value="Conta Poupança">Conta Poupança</SelectItem>
                       <SelectItem value="Conta Digital">Conta Digital / Carteira</SelectItem>
                       <SelectItem value="Caixinha">Caixa Físico (Interno)</SelectItem>
                       <SelectItem value="Conta Investimento">Conta Investimento</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label>Instituição Financeira / Banco *</Label>
                   <Input placeholder="Itaú, Bradesco..." value={novaConta.banco} onChange={(e) => setNovaConta({...novaConta, banco: e.target.value})} />
                 </div>
                 <div>
                   <Label>Agência</Label>
                   <Input placeholder="0000" value={novaConta.agencia} onChange={(e) => setNovaConta({...novaConta, agencia: e.target.value})} />
                 </div>
                 <div>
                   <Label>Número da Conta</Label>
                   <Input placeholder="00000-0" value={novaConta.conta} onChange={(e) => setNovaConta({...novaConta, conta: e.target.value})} />
                 </div>
                 <div className="col-span-2">
                   <Label>Titular da Conta / Razão Social</Label>
                   <Input placeholder="Nome na conta..." value={novaConta.titular} onChange={(e) => setNovaConta({...novaConta, titular: e.target.value})} />
                 </div>
                 <div>
                   <Label>Saldo Inicial R$</Label>
                   <Input placeholder="0,00" type="number" value={novaConta.saldoInicial || ""} onChange={(e) => setNovaConta({...novaConta, saldoInicial: Number(e.target.value)})} />
                 </div>
                 <div>
                   <Label>Vincular Empresa/Unidade</Label>
                   <Select value={novaConta.empresa} onValueChange={(v) => setNovaConta({...novaConta, empresa: v})}>
                     <SelectTrigger><SelectValue placeholder="Matriz (SP)" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="Matriz (SP)">Matriz (SP)</SelectItem>
                       <SelectItem value="Filial (RJ)">Filial (RJ)</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline" onClick={() => setShowNovaConta(false)} disabled={isSubmitting}>Cancelar</Button>
                 <Button onClick={handleSalvarConta} disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar Conta"}</Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-600 to-blue-800 text-white shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100 flex items-center gap-2">
              <Wallet className="w-4 h-4"/> Saldo Consolidado Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{formatCurrency(saldoTotal)}</div>
            <p className="text-xs text-indigo-200 mt-2">Soma de todas as contas e caixas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-semibold">Contas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Conta/Identificação</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead>Agência/Conta</TableHead>
                <TableHead>Empresa Vinculada</TableHead>
                <TableHead className="text-right">Saldo Atual (R$)</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.map(conta => (
                <TableRow key={conta.id} className="hover:bg-muted/20">
                  <TableCell>
                    <div className="font-semibold text-sm">{conta.nome}</div>
                    <div className="text-xs text-muted-foreground">{conta.tipo}</div>
                  </TableCell>
                  <TableCell className="font-medium text-sm flex items-center gap-2 mt-2">
                     <Building2 className="w-4 h-4 text-slate-400" />
                     {conta.banco}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{conta.agencia} / {conta.conta}</TableCell>
                  <TableCell className="text-xs">{conta.empresa}</TableCell>
                  <TableCell className="text-right font-bold text-sm text-foreground">
                    {formatCurrency(conta.saldo)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{conta.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4 text-muted-foreground"/></Button>
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
