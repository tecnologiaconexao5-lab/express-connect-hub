import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UserPlus, Filter, Database, CheckCircle, Mail, History, Copy, Eye, Plus, ThumbsDown, ThumbsUp, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BancoTalentos } from "@/components/recrutamento/BancoTalentos";
import { TriagemIA } from "@/components/recrutamento/TriagemIA";
import { AcompanhamentoDocs } from "@/components/recrutamento/AcompanhamentoDocs";
import { Homologacao } from "@/components/recrutamento/Homologacao";
import { BancoReservas } from "@/components/recrutamento/BancoReservas";

export default function Recrutamento() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "captacao";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="w-8 h-8 text-primary" /> Recrutamento e Admissão
          </h1>
          <p className="text-muted-foreground">Formação da malha de parceiros, captação externa e banco de talentos logísticos.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="captacao" className="px-5"><UserPlus className="w-4 h-4 mr-2"/> Captação</TabsTrigger>
           <TabsTrigger value="triagem" className="px-5"><Filter className="w-4 h-4 mr-2"/> Triagem IA</TabsTrigger>
           <TabsTrigger value="documentacao" className="px-5"><FileText className="w-4 h-4 mr-2"/> Documentação</TabsTrigger>
           <TabsTrigger value="banco" className="px-5"><Database className="w-4 h-4 mr-2"/> Banco Talentos</TabsTrigger>
           <TabsTrigger value="reservas" className="px-5"><Database className="w-4 h-4 mr-2"/> Banco Reservas</TabsTrigger>
           <TabsTrigger value="homologacao" className="px-5"><CheckCircle className="w-4 h-4 mr-2"/> Homologação</TabsTrigger>
           <TabsTrigger value="convocacao" className="px-5"><Mail className="w-4 h-4 mr-2"/> Convocação</TabsTrigger>
           <TabsTrigger value="historico" className="px-5"><History className="w-4 h-4 mr-2"/> Histórico</TabsTrigger>
        </TabsList>

        {/* --- CAPTAÇÃO --- */}
        <TabsContent value="captacao" className="pt-4 space-y-4">
           <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                 <CardTitle className="text-primary flex items-center gap-2">Página de Captura Pública (Work with Us) <Badge variant="secondary" className="bg-primary/20 text-primary uppercase text-[10px]">Em Breve</Badge></CardTitle>
                 <CardDescription>Compartilhe seu link público em anúncios do Facebook, Google e Grupos de WhatsApp para receber cadastros automaticamente no ERP.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="flex items-center gap-2 max-w-lg">
                    <Input readOnly value="https://conexoexpress.app/recrutamento" className="bg-white text-slate-500 font-mono" />
                    <Button variant="outline" onClick={() => toast("Link copiado para área de transferência!")}><Copy className="w-4 h-4 mr-2"/> Copiar Link Público</Button>
                 </div>
              </CardContent>
           </Card>

           <Card>
              <CardHeader className="flex flex-row justify-between items-center">
                 <CardTitle>Entrada Manual de Candidatos</CardTitle>
                 <Button><Plus className="w-4 h-4 mr-2"/> Inserir Candidato</Button>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center text-muted-foreground bg-muted/10 border-dashed border-2 rounded-lg mx-6 mb-6">
                 Sem cadastros pendentes criados via formulário manual hoje.
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- TRIAGEM --- */}
        <TabsContent value="triagem" className="pt-4">
           <TriagemIA />
        </TabsContent>

        {/* --- BANCO DE TALENTOS --- */}
        <TabsContent value="banco" className="pt-4">
           <BancoTalentos />
        </TabsContent>

        {/* --- DOCUMENTAÇÃO --- */}
        <TabsContent value="documentacao" className="pt-4">
           <AcompanhamentoDocs />
        </TabsContent>

        {/* --- RESERVAS --- */}
        <TabsContent value="reservas" className="pt-4">
           <BancoReservas />
        </TabsContent>

        {/* --- HOMOLOGAÇÃO --- */}
        <TabsContent value="homologacao" className="pt-4">
           <Card>
              <CardHeader><CardTitle>Checklist Documental e Onboarding</CardTitle><CardDescription>Aprovação de PGR, apólices, e antecedentes de candidatos selecionados na fila.</CardDescription></CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Prestador Homologando</TableHead><TableHead>Documentos Pessoais</TableHead><TableHead>Documentos Veículo</TableHead><TableHead>PGR Risk / ANTT</TableHead><TableHead className="text-right">Cadastro Final</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow>
                       <TableCell className="font-bold">Felipe Santos</TableCell>
                       <TableCell><Badge variant="secondary" className="bg-green-100 text-green-800">100% Ok</Badge></TableCell>
                       <TableCell><Badge variant="secondary" className="bg-orange-100 text-orange-800">Falta CRLV</Badge></TableCell>
                       <TableCell><Badge variant="secondary" className="bg-red-100 text-red-800">Pendente P.R.</Badge></TableCell>
                       <TableCell className="text-right"><Button size="sm" disabled className="h-8">Efetivar em Cadastros</Button></TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- CONVOCAÇÃO --- */}
        <TabsContent value="convocacao" className="pt-4">
           <Card className="max-w-2xl mx-auto">
              <CardHeader className="text-center">
                 <Mail className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                 <CardTitle>Disparos Automáticos de Integração</CardTitle>
                 <CardDescription>Uma vez efetivados e gerado o login, você poderá enviar comunicados em lote e manuais de trabalho (link do app parceiro).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <Button className="w-full bg-blue-600">Disparar Kit Boas-Vindas para Ativados da Semana</Button>
                 <Button className="w-full" variant="outline">Ver Histórico de Comunicação</Button>
              </CardContent>
           </Card>
        </TabsContent>

        {/* --- HISTÓRICO --- */}
        <TabsContent value="historico" className="pt-4">
           <Card>
              <CardHeader><CardTitle>Histórico de Desistências e Reprovações</CardTitle></CardHeader>
              <CardContent className="p-0">
                 <Table>
                   <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Fase da Queda</TableHead><TableHead>Motivo Informado</TableHead><TableHead>Anotado Por</TableHead></TableRow></TableHeader>
                   <TableBody>
                     <TableRow className="bg-slate-50">
                       <TableCell className="font-semibold text-slate-600">Júlio Agregados 10</TableCell>
                       <TableCell>Homologação</TableCell>
                       <TableCell className="text-red-600 font-medium">ANTT Vencida há 3 anos. Bloqueio gerenciadora Risco.</TableCell>
                       <TableCell className="text-xs">SISTEMA (Auto)</TableCell>
                     </TableRow>
                     <TableRow className="bg-slate-50">
                       <TableCell className="font-semibold text-slate-600">Lucas M. Autônomo</TableCell>
                       <TableCell>Triagem (Contato 1)</TableCell>
                       <TableCell className="text-orange-600 font-medium">Achou valor do KM baixo, declinou oferta.</TableCell>
                       <TableCell className="text-xs">Diego Balbino</TableCell>
                     </TableRow>
                   </TableBody>
                 </Table>
              </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
