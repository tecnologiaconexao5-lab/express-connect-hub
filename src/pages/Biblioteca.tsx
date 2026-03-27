import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Folder, Upload, Download, Search, FileText, Image, Video, ShieldAlert, Trash, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacional";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const getDocIcon = (tipo: string) => {
     if(tipo.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
     if(tipo.includes("image")) return <Image className="w-5 h-5 text-blue-500" />;
     if(tipo.includes("video")) return <Video className="w-5 h-5 text-purple-500" />;
     return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const renderBibliotecaTable = (docs: any[]) => (
     <Card>
       <CardHeader className="flex flex-row justify-between items-center py-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome de documento ou tag..." className="pl-9 h-9" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Filter className="w-4 h-4 mr-1"/> Categorias</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white"><Upload className="w-4 h-4 mr-1"/> Subir Arquivo</Button>
          </div>
       </CardHeader>
       <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome e Descrição</TableHead><TableHead>Categoria / Pasta</TableHead><TableHead>Modificado Em</TableHead><TableHead>Tamanho Autorizado</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d.id}>
                  <TableCell>{getDocIcon(d.tipo)}</TableCell>
                  <TableCell>
                    <p className="font-bold text-sm text-slate-800">{d.nome}</p>
                    <p className="text-xs text-muted-foreground truncate w-48 lg:w-96">{d.desc}</p>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono text-[10px]"><Folder className="w-3 h-3 mr-1 inline"/> {d.cat}</Badge></TableCell>
                  <TableCell className="text-xs">{d.data}</TableCell>
                  <TableCell className="text-xs">{d.tamanho}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Download className="w-4 h-4"/></Button>
                     {d.admin && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash className="w-4 h-4"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {docs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground border-dashed border-2">Nenhum documento nessa restrição/categoria.</TableCell></TableRow>}
            </TableBody>
          </Table>
       </CardContent>
     </Card>
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="w-8 h-8 text-orange-500" /> Biblioteca de Manuais e Arquivos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Hospedagem unificada e versionada de anexos cruciais da empresa.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="operacional" className="px-5"><ShieldAlert className="w-4 h-4 mr-2"/> Central Operacional</TabsTrigger>
           <TabsTrigger value="prestador" className="px-5"><Folder className="w-4 h-4 mr-2"/> Pasta do Prestador (App)</TabsTrigger>
           <TabsTrigger value="cliente" className="px-5"><Folder className="w-4 h-4 mr-2"/> Pasta do Cliente (Portal)</TabsTrigger>
           <TabsTrigger value="modelos" className="px-5"><FileText className="w-4 h-4 mr-2"/> Modelos e Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="operacional" className="pt-4">
           <Card className="mb-4 bg-orange-50/50 border-orange-200">
             <CardContent className="p-4 text-sm text-orange-900 font-medium max-w-3xl">PGRs Oficiais, Procedimentos Operacionais Padrão (POP), e Guias Internos da Transportadora. Reservado apenas para logins corporativos.</CardContent>
           </Card>
           {renderBibliotecaTable([
             { id: 1, nome: "PGR Corporativo Versão 2.1", desc: "Plano de Gerenciamento de Risco Integrado com a Seguradora", tipo: "pdf", cat: "SGR / Risco", data: "26/03/2026", tamanho: "2.4 MB", admin: true },
             { id: 2, nome: "Guia de Cubagem Prática", desc: "Como conferir volumes x peso de mercadorias atípicas na rodo", tipo: "pdf", cat: "Mesa Treinamento", data: "10/01/2026", tamanho: "600 KB", admin: true },
             { id: 3, nome: "Videoaulas Supabase ERP", desc: "Link para playlists do time de dev", tipo: "video", cat: "Treinamento Módulos", data: "27/03/2026", tamanho: "URL Externa", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="prestador" className="pt-4">
           {renderBibliotecaTable([
             { id: 10, nome: "Regulamento do Agregado SP", desc: "Regras de convivência, estadias e fardamento obrigatório", tipo: "pdf", cat: "Onboarding Motoristas", data: "12/02/2026", tamanho: "1.2 MB", admin: true },
             { id: 11, nome: "Tutorial de Baixa de Ocorrência", desc: "Como reportar chuva ou transito via WhatsApp", tipo: "image", cat: "Infográficos", data: "22/03/2026", tamanho: "150 KB", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="cliente" className="pt-4">
           {renderBibliotecaTable([
             { id: 20, nome: "Apresentação Institucional 2026", desc: "Nosso deck pra fechar com C-Levels", tipo: "pdf", cat: "Materiais Venda", data: "05/01/2026", tamanho: "5.1 MB", admin: true },
             { id: 21, nome: "SLA Operacional Standard.pdf", desc: "Qualidade de Entrega vs Reversas Prazo Comum", tipo: "pdf", cat: "Políticas SLA Púb.", data: "18/03/2026", tamanho: "15 MB", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="modelos" className="pt-4">
           {renderBibliotecaTable([])}
        </TabsContent>

      </Tabs>
    </div>
  );
}
