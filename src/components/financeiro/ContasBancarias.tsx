import React, { useState } from "react";
import { Plus, Building2, Wallet, Banknote, MoreHorizontal, ArrowRightLeft, Landmark } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContasBancarias() {
  const [contas, setContas] = useState([
    { id: 1, banco: "Itaú", nome: "Conta Corrente Principal", agencia: "1234", conta: "56789-0", tipo: "Conta Corrente", titular: "Express Connect Transportes LTDA", saldo: 145000.50, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 2, banco: "Bradesco", nome: "Conta Reserva / Impostos", agencia: "4321", conta: "98765-4", tipo: "C. Poupança", titular: "Express Connect Transportes LTDA", saldo: 85200.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 3, banco: "Nubank", nome: "Cartão Corporativo Digital", agencia: "0001", conta: "11223344-5", tipo: "Conta Digital", titular: "Express Connect Hub", saldo: 12500.00, status: "Ativa", empresa: "Matriz (SP)" },
    { id: 4, banco: "Caixa Física", nome: "Caixa Interno (Pequenos Gastos)", agencia: "-", conta: "-", tipo: "Caixinha", titular: "Financeiro Interno", saldo: 1250.75, status: "Ativa", empresa: "Matriz (SP)" },
  ]);

  const saldoTotal = contas.reduce((acc, c) => acc + c.saldo, 0);

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
           <Button variant="outline" className="gap-2"><ArrowRightLeft className="w-4 h-4"/> Transferência entre Contas</Button>
           <Dialog>
             <DialogTrigger asChild>
               <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"><Plus className="w-4 h-4"/> Nova Conta/Caixa</Button>
             </DialogTrigger>
             <DialogContent className="max-w-xl">
               <DialogHeader>
                 <DialogTitle>Cadastro de Conta Financeira</DialogTitle>
               </DialogHeader>
               <div className="grid grid-cols-2 gap-4 py-4">
                 <div className="col-span-2">
                   <Label>Nome da Conta/Identificação</Label>
                   <Input placeholder="Ex: Conta Corrente Principal Itaú" />
                 </div>
                 <div>
                   <Label>Tipo de Conta</Label>
                   <Select>
                     <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="corrente">Conta Corrente</SelectItem>
                       <SelectItem value="poupanca">Conta Poupança</SelectItem>
                       <SelectItem value="digital">Conta Digital / Carteira</SelectItem>
                       <SelectItem value="caixinha">Caixa Físico (Interno)</SelectItem>
                       <SelectItem value="investimento">Conta Investimento</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div>
                   <Label>Instituição Financeira / Banco</Label>
                   <Input placeholder="Itaú, Bradesco, Nubank, Caixa..." />
                 </div>
                 <div>
                   <Label>Agência</Label>
                   <Input placeholder="0000" />
                 </div>
                 <div>
                   <Label>Número da Conta</Label>
                   <Input placeholder="00000-0" />
                 </div>
                 <div className="col-span-2">
                   <Label>Titular da Conta / Razão Social</Label>
                   <Input placeholder="Nome na conta..." />
                 </div>
                 <div>
                   <Label>Saldo Inicial R$</Label>
                   <Input placeholder="0,00" type="number" />
                 </div>
                 <div>
                   <Label>Vincular Empresa/Unidade</Label>
                   <Select>
                     <SelectTrigger><SelectValue placeholder="Matriz (SP)" /></SelectTrigger>
                     <SelectContent>
                       <SelectItem value="matriz">Matriz (SP)</SelectItem>
                       <SelectItem value="filial_rj">Filial (RJ)</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>
               <DialogFooter>
                 <Button variant="outline">Cancelar</Button>
                 <Button>Salvar Conta</Button>
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
