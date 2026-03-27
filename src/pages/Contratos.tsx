import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSignature, Plus, FileText, Download, Printer, Copy, Settings, Eye, Trash, RefreshCw, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Contratos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "prestadores";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [modelos, setModelos] = useState([
    { id: 1, nome: "Contrato Padrão Agregados", tipo: "agregado", operacao: "Dedicada", status: "Ativo", padrao: true, data: "27/03/2026" },
    { id: 2, nome: "Termo de Responsabilidade - Autônomos", tipo: "autonomo", operacao: "Spot", status: "Ativo", padrao: false, data: "20/03/2026" }
  ]);

  const [gerados, setGerados] = useState([
    { id: 1, prestador: "Carlos Silva", modelo: "Contrato Padrão Agregados", data: "26/03/2026", status: "Assinado", user: "Diego Balbino" },
    { id: 2, prestador: "João Pereira", modelo: "Termo de Responsabilidade", data: "27/03/2026", status: "Aguardando", user: "Diego Balbino" }
  ]);

  const insertVar = (v: string) => {
    // mock helper to simulate inserting variable in cursor
    alert(`Inserindo \${{${v}}} no cursor...`);
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="w-8 h-8 text-primary" /> Central de Contratos Automáticos
          </h1>
          <p className="text-muted-foreground">Criação, edição e emissão de contratos corporativos inteligentes.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="prestadores" className="px-5"><FileText className="w-4 h-4 mr-2"/> Modelos de Contrato</TabsTrigger>
           <TabsTrigger value="gerados" className="px-5"><FileSignature className="w-4 h-4 mr-2"/> Contratos Gerados</TabsTrigger>
           <TabsTrigger value="anexos" className="px-5"><RefreshCw className="w-4 h-4 mr-2"/> Anexos Extras</TabsTrigger>
           <TabsTrigger value="configuracoes" className="px-5"><Settings className="w-4 h-4 mr-2"/> Configurações</TabsTrigger>
        </TabsList>

        {/* --- MODELOS DE CONTRATOS --- */}
        <TabsContent value="prestadores" className="pt-4 space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Construtor de Automodelos</CardTitle><CardDescription>Gerencie as regras dinâmicas e layouts usados na geração.</CardDescription></div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white"><Plus className="w-4 h-4 mr-2"/> Criar Novo Modelo</Button>
             </CardHeader>
             <CardContent>
                <Table>
                   <TableHeader><TableRow><TableHead>Nome do Modelo</TableHead><TableHead>Tipo Prestador</TableHead><TableHead>Operação</TableHead><TableHead>Status</TableHead><TableHead>Última Alteração</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                   <TableBody>
                     {modelos.map((m) => (
                       <TableRow key={m.id}>
                         <TableCell className="font-semibold text-sm flex items-center gap-2">{m.nome} {m.padrao && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-[9px] uppercase px-1.5 py-0">Padrão</Badge>}</TableCell>
                         <TableCell><Badge variant="outline" className="capitalize">{m.tipo}</Badge></TableCell>
                         <TableCell className="text-xs">{m.operacao}</TableCell>
                         <TableCell><span className="text-green-600 font-semibold text-xs">{m.status}</span></TableCell>
                         <TableCell className="text-xs text-muted-foreground">{m.data}</TableCell>
                         <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Eye className="w-4 h-4"/></Button>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-black"><Copy className="w-4 h-4"/></Button>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50"><Trash className="w-4 h-4"/></Button>
                            </div>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                </Table>

                <div className="mt-8 border rounded-lg overflow-hidden flex flex-col md:flex-row bg-white">
                   <div className="flex-1 p-4 border-r">
                      <h4 className="text-sm font-bold mb-4">Em Edição: Contrato Padrão Agregados</h4>
                      <div className="space-y-4">
                         <div className="grid grid-cols-2 gap-4">
                           <Input defaultValue="Contrato Padrão Agregados" />
                           <Input defaultValue="Agregado" disabled />
                         </div>
                         <Textarea defaultValue="Pelo presente instrumento particular, a empresa {{empresa_nome}}, CNPJ {{empresa_cnpj}} localizada em {{empresa_endereco}} neste ato designada como CONTRATANTE, e de outro lado {{prestador_nome}}, portador do CPF {{prestador_cpf}}, proprietário do veículo placas {{veiculo_placa}}..." className="min-h-[300px] font-mono text-xs bg-slate-50"/>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button className="bg-green-600 hover:bg-green-700 text-white"><FileSignature className="w-4 h-4 mr-2"/> Preview Inteligente</Button>
                        <Button variant="outline"><Save className="w-4 h-4 mr-2" /> Salvar Modelo</Button>
                      </div>
                   </div>
                   <div className="w-full md:w-64 bg-slate-50 p-4 shrink-0 overflow-y-auto max-h-[500px]">
                      <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Variáveis Dinâmicas</h4>
                      <div className="space-y-6">
                         <div>
                            <p className="text-[10px] font-semibold text-slate-400 mb-2">PRESTADOR</p>
                            <div className="flex flex-col gap-1.5">
                               {['prestador_nome', 'prestador_cpf', 'prestador_rg', 'prestador_telefone', 'prestador_pix', 'prestador_banco', 'prestador_cidade'].map(v => (
                                 <button key={v} onClick={() => insertVar(v)} className="text-left textxs font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition truncate text-[10px]">
                                   {`{{${v}}}`}
                                 </button>
                               ))}
                            </div>
                         </div>
                         <div>
                            <p className="text-[10px] font-semibold text-slate-400 mb-2">VEÍCULO & VALORES</p>
                            <div className="flex flex-col gap-1.5">
                               {['veiculo_tipo', 'veiculo_placa', 'veiculo_modelo', 'valor_diaria', 'valor_km'].map(v => (
                                 <button key={v} onClick={() => insertVar(v)} className="text-left textxs font-mono text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition truncate text-[10px]">
                                   {`{{${v}}}`}
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- GERADOS --- */}
        <TabsContent value="gerados" className="pt-4">
           <Card>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Prestador Contratado</TableHead><TableHead>Modelo Utilizado</TableHead><TableHead>Data Geração</TableHead><TableHead>Gerado Por</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                     {gerados.map(g => (
                       <TableRow key={g.id}>
                          <TableCell className="font-semibold">{g.prestador}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{g.modelo}</TableCell>
                          <TableCell className="text-xs">{g.data}</TableCell>
                          <TableCell className="text-xs">{g.user}</TableCell>
                          <TableCell>
                             <Badge variant="outline" className={g.status === 'Assinado' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}>{g.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Download className="w-4 h-4"/></Button>
                             <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600"><Printer className="w-4 h-4"/></Button>
                          </TableCell>
                       </TableRow>
                     ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- ANEXOS --- */}
        <TabsContent value="anexos" className="pt-4">
           <Card>
             <CardContent className="py-20 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <h3 className="font-bold text-lg text-slate-700 mb-1">Upload de Anexos Secundários</h3>
                <p className="text-sm">Guarde aditivos, certidões e outros arquivos (PDF, DOCX) atrelados a contratos específicos aqui.</p>
                <Button className="mt-4"><Plus className="w-4 h-4 mr-2"/> Fazer Upload</Button>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- CONFIGURAÇÕES --- */}
        <TabsContent value="configuracoes" className="pt-4">
           <Card>
             <CardHeader><CardTitle className="text-lg">Parâmetros de Contratos</CardTitle></CardHeader>
             <CardContent className="space-y-6 max-w-lg">
                <div className="flex items-center justify-between border-b pb-4">
                   <div>
                     <p className="font-bold text-sm text-slate-800">Obrigatoriedade de Contrato</p>
                     <p className="text-xs text-muted-foreground">Impedir OS para prestadores sem contrato ativo</p>
                   </div>
                   <input type="checkbox" className="toggle" checked readOnly/>
                </div>
                <div className="flex items-center justify-between border-b pb-4">
                   <div>
                     <p className="font-bold text-sm text-slate-800">Layout Automático (Conexão Express)</p>
                     <p className="text-xs text-muted-foreground">Adicionar cabeçalho, logo e rodapé automaticamente no gerador PDF</p>
                   </div>
                   <input type="checkbox" className="toggle" checked readOnly/>
                </div>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}


