import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck, History, ListChecks, Lock, Download, Search, AlertCircle, Eye, UserCog, UserCheck, Shield } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Governanca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "auditoria";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-primary" /> Conformidade e Governança Enterprise
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Gestão de acessos, logs de auditoria e diretrizes LGPD aplicadas.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="auditoria" className="px-5"><ListChecks className="w-4 h-4 mr-2"/> Auditoria Corporativa</TabsTrigger>
           <TabsTrigger value="historico" className="px-5"><History className="w-4 h-4 mr-2"/> Snapshots de Entidade</TabsTrigger>
           <TabsTrigger value="permissoes" className="px-5"><UserCog className="w-4 h-4 mr-2"/> Matriz de Acesso Completa</TabsTrigger>
           <TabsTrigger value="lgpd" className="px-5"><Lock className="w-4 h-4 mr-2"/> Processos LGPD</TabsTrigger>
        </TabsList>

        {/* --- AUDITORIA DE LOGS --- */}
        <TabsContent value="auditoria" className="pt-4 space-y-4">
           <Card>
             <CardHeader className="flex flex-row justify-between items-center py-4">
               <div><CardTitle>Global Activity Log</CardTitle><CardDescription>Registro auditável e imutável das requisições na plataforma.</CardDescription></div>
               <div className="flex gap-2">
                 <div className="relative w-64">
                   <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                   <Input placeholder="Buscar por ID ou usuário" className="pl-9 h-9" />
                 </div>
                 <Button variant="outline" size="sm" className="h-9"><Download className="w-4 h-4 mr-1"/> Exportar CSV</Button>
               </div>
             </CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Usuário</TableHead><TableHead>Ação Executada</TableHead><TableHead>Módulo</TableHead><TableHead>IP Origem</TableHead><TableHead>Status DB</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow>
                       <TableCell className="text-xs text-muted-foreground font-mono">27/03/26 18:24:12</TableCell>
                       <TableCell className="font-semibold text-sm">Diego Balbino</TableCell>
                       <TableCell><Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200">UPDATE :: PRICE_TABLE</Badge></TableCell>
                       <TableCell className="text-sm">Comercial</TableCell>
                       <TableCell className="text-xs font-mono text-muted-foreground">192.168.0.1 (BR)</TableCell>
                       <TableCell><span className="text-xs font-bold text-green-600 flex gap-1 items-center"><UserCheck className="w-3 h-3"/> Commit</span></TableCell>
                     </TableRow>
                     <TableRow className="bg-orange-50/30">
                       <TableCell className="text-xs text-muted-foreground font-mono">27/03/26 17:15:00</TableCell>
                       <TableCell className="font-semibold text-sm">João Operacional</TableCell>
                       <TableCell><Badge variant="outline" className="text-red-600 bg-red-50 border-red-200">DELETE :: OS_FILE (Dacte)</Badge></TableCell>
                       <TableCell className="text-sm">Operação_POD</TableCell>
                       <TableCell className="text-xs font-mono text-muted-foreground">177.25.14.99 (BR)</TableCell>
                       <TableCell><span className="text-xs font-bold text-red-600 flex gap-1 items-center"><AlertCircle className="w-3 h-3"/> Warn</span></TableCell>
                     </TableRow>
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- HISTÓRICO DE ALTERAÇÕES --- */}
        <TabsContent value="historico" className="pt-4 space-y-4">
           <Card>
             <CardHeader><CardTitle>Rollback & Versionamento de Entidades</CardTitle><CardDescription>Dados Before/After persistidos estruturalmente no BD para clientes, OS e prestadores.</CardDescription></CardHeader>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Entidade Atingida</TableHead><TableHead>Data Transação</TableHead><TableHead>Dado Anterior</TableHead><TableHead>Valor Modificado (Novo)</TableHead><TableHead>Operador Responsável</TableHead><TableHead className="text-right">Reverter</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow>
                       <TableCell className="font-bold text-sm text-slate-700">ORDEM DE SERVIÇO<br/><span className="text-xs font-normal text-muted-foreground">ID: OS-202610-8802</span></TableCell>
                       <TableCell className="text-xs">Hoje, 14:00</TableCell>
                       <TableCell className="text-sm text-red-600 font-medium line-through decoration-red-400">Status: Aguardando Parceiro</TableCell>
                       <TableCell className="text-sm text-green-600 font-bold bg-green-50/50 px-2 py-1">Status: Aguardando Veículo</TableCell>
                       <TableCell className="text-sm">Eduardo - Torre</TableCell>
                       <TableCell className="text-right flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Eye className="w-4 h-4"/></Button></TableCell>
                     </TableRow>
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- PERFIS --- */}
        <TabsContent value="permissoes" className="pt-4 space-y-4">
           <Card className="max-w-4xl mx-auto">
             <CardHeader className="flex flex-row justify-between items-center py-4">
               <div><CardTitle>RBAC: Controle Baseado em Papéis</CardTitle></div>
             </CardHeader>
             <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead>Módulo Interno</TableHead><TableHead className="text-center font-bold">Admin</TableHead><TableHead className="text-center">Operador</TableHead><TableHead className="text-center">Torre (Foco Dia)</TableHead><TableHead className="text-center">Prestador App</TableHead></TableRow></TableHeader>
                  <TableBody>
                     <TableRow>
                       <TableCell className="font-medium">Cadastros e CRM</TableCell>
                       <TableCell className="text-center font-bold text-green-600">Total (W/R/D)</TableCell><TableCell className="text-center">Somente Visão</TableCell><TableCell className="text-center text-slate-300">-</TableCell><TableCell className="text-center text-slate-300">-</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium">Financeiro & Fluxo Caixa</TableCell>
                       <TableCell className="text-center font-bold text-green-600">Total (W/R/D)</TableCell><TableCell className="text-center text-slate-300">-</TableCell><TableCell className="text-center text-slate-300">-</TableCell><TableCell className="text-center">Suas Faturas</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium">OS e Criação de Cargas</TableCell>
                       <TableCell className="text-center font-bold text-green-600">Total (W/R/D)</TableCell><TableCell className="text-center text-blue-600 font-bold">Edição</TableCell><TableCell className="text-center text-orange-500 font-medium">Aprovações</TableCell><TableCell className="text-center">Rotas Lícitas</TableCell>
                     </TableRow>
                     <TableRow>
                       <TableCell className="font-medium">Configurações Base DB</TableCell>
                       <TableCell className="text-center font-bold text-red-600 border-red-200">Exclusivo RLS</TableCell><TableCell className="text-center text-slate-300">-</TableCell><TableCell className="text-center text-slate-300">-</TableCell><TableCell className="text-center text-slate-300">-</TableCell>
                     </TableRow>
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- LGPD --- */}
        <TabsContent value="lgpd" className="pt-4 space-y-4">
           <Card className="max-w-3xl mx-auto border-emerald-500/30">
             <CardHeader className="text-center py-6 bg-emerald-50/50">
               <Shield className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
               <CardTitle className="text-emerald-900 text-xl">Selo de Proteção Adequada ao Titular</CardTitle>
               <CardDescription>O sistema não transfere externamente cópias não mascaradas.</CardDescription>
               <div className="mt-4"><Badge className="bg-emerald-500 text-white border-0 py-1.5 px-4 uppercase font-black tracking-wide">Plataforma em Conformidade (Nível 4)</Badge></div>
             </CardHeader>
             <CardContent className="space-y-4 pt-6">
                <Button className="w-full bg-slate-900 text-white justify-between h-12" variant="outline">Baixar Relatório Completo dos Dados Cifrados (DPO) <Download className="w-4 h-4"/></Button>
                <Button className="w-full justify-between h-12" variant="outline">Consultar Consentimentos de Aceite dos Contratos-Prestador <Search className="w-4 h-4 text-muted-foreground"/></Button>
                <Button className="w-full justify-between h-12 border-red-200 text-red-600 hover:bg-red-50" variant="outline">Processar Pedido Judicial / Lei do Esquecimento (Right to be Forgotten) <AlertCircle className="w-4 h-4"/></Button>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
