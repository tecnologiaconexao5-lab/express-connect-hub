import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FileSpreadsheet, UploadCloud, Link as LinkIcon, Plus, Stamp, Search, Download, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Fiscal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "cte";

  const [ctes, setCtes] = useState<any[]>([]);
  const [mdfes, setMdfes] = useState<any[]>([]);
  const [nfses, setNfses] = useState<any[]>([]);
  
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  useEffect(() => {
    fetchCtes();
    fetchMdfes();
    fetchNfses();
  }, []);

  const fetchCtes = async () => {
    try {
      const { data } = await supabase.from("cte").select("*").order("data_emissao", { ascending: false });
      if (data && data.length > 0) setCtes(data);
      else setCtes([
         { id: 1, numero: "105001", chave: "352610123...4501", emitente: "Matriz SP", tomador: "Tech Solutions", valor: 1450.00, cfop: "5351", data_emissao: new Date().toISOString(), status: "Autorizado" },
         { id: 2, numero: "105000", chave: "352610123...4400", emitente: "Matriz SP", tomador: "Indústria Global", valor: 850.50, cfop: "6352", data_emissao: new Date(new Date().setDate(new Date().getDate() - 1)).toISOString(), status: "Cancelado" },
      ]);
    } catch {}
  };

  const fetchMdfes = async () => {
    try {
      const { data } = await supabase.from("mdfe").select("*").order("data", { ascending: false });
      if (data && data.length > 0) setMdfes(data);
      else setMdfes([
         { id: 1, numero: "5020", data: new Date().toISOString(), prestador_veiculo: "João Silva - ABC1D23", uf: "SP -> RJ", cte_vinculados: 4, status: "Aberto" },
         { id: 2, numero: "5019", data: new Date().toISOString(), prestador_veiculo: "Carlos Souza - DEF4E56", uf: "SP", cte_vinculados: 1, status: "Encerrado" },
      ]);
    } catch {}
  };

  const fetchNfses = async () => {
    try {
      const { data } = await supabase.from("nfse").select("*").order("data_emissao", { ascending: false });
      if (data && data.length > 0) setNfses(data);
      else setNfses([
         { id: 1, numero: "90001", cliente: "Tech Solutions", valor: 1450.00, servico: "14.01", data_emissao: new Date().toISOString(), status: "Autorizado" },
      ]);
    } catch {}
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" /> Central Fiscal
          </h1>
          <p className="text-muted-foreground">Gestão de Conhecimentos, Manifestos e NFS-e.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="cte" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700"><FileSpreadsheet className="w-4 h-4 mr-2"/> CT-e</TabsTrigger>
           <TabsTrigger value="mdfe" className="data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700"><Truck className="w-4 h-4 mr-2"/> MDF-e</TabsTrigger>
           <TabsTrigger value="nfse" className="data-[state=active]:bg-green-50 data-[state=active]:text-green-700"><Stamp className="w-4 h-4 mr-2"/> NFS-e</TabsTrigger>
        </TabsList>

        {/* --- CT-e --- */}
        <TabsContent value="cte" className="space-y-4 pt-4">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar CT-e, chave ou tomador..." className="pl-9 w-full" />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                 <Badge variant="secondary" className="bg-blue-100 text-blue-700 mr-2 whitespace-nowrap">Emissão integrada SEFAZ em breve</Badge>
                 <Button variant="outline" className="border-dashed"><LinkIcon className="w-4 h-4 mr-2"/> Vincular à OS</Button>
                 <Button className="bg-blue-600 hover:bg-blue-700 text-white"><UploadCloud className="w-4 h-4 mr-2"/> Importar XML</Button>
              </div>
           </div>

           <Card>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nº CT-e</TableHead><TableHead>Chave de Acesso</TableHead><TableHead>Emitente</TableHead><TableHead>Tomador</TableHead><TableHead>CFOP</TableHead><TableHead>Data Emissão</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {ctes.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-blue-700">{c.numero}</TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[150px]">{c.chave}</TableCell>
                        <TableCell className="text-xs">{c.emitente}</TableCell>
                        <TableCell className="text-sm font-medium">{c.tomador}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.cfop}</TableCell>
                        <TableCell className="text-xs">{new Date(c.data_emissao).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{fmtFin(c.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={c.status === "Autorizado" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>{c.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- MDF-e --- */}
        <TabsContent value="mdfe" className="space-y-4 pt-4">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar MDF-e, veículo ou prestador..." className="pl-9 w-full" />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                 <Badge variant="secondary" className="bg-purple-100 text-purple-700 mr-2 whitespace-nowrap">Emissão e encerramento em breve</Badge>
                 <Button variant="outline"><FileText className="w-4 h-4 mr-2"/> Encerrar MDF-e</Button>
                 <Button className="bg-purple-600 hover:bg-purple-700 text-white"><Plus className="w-4 h-4 mr-2"/> Novo MDF-e</Button>
              </div>
           </div>

           <Card>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nº MDF-e</TableHead><TableHead>Data</TableHead><TableHead>Prestador / Veículo</TableHead><TableHead>UFs Percorridas</TableHead><TableHead>CT-es Vinculados</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {mdfes.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-purple-700">{m.numero}</TableCell>
                        <TableCell className="text-xs">{new Date(m.data).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm font-medium">{m.prestador_veiculo}</TableCell>
                        <TableCell className="text-sm">{m.uf}</TableCell>
                        <TableCell className="font-medium text-center">{m.cte_vinculados}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={m.status === "Aberto" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-700 border-gray-200"}>{m.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- NFS-e --- */}
        <TabsContent value="nfse" className="space-y-4 pt-4">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar NFS-e, tomador..." className="pl-9 w-full" />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                 <Badge variant="secondary" className="bg-green-100 text-green-700 mr-2 whitespace-nowrap">Integração prefeitura em breve</Badge>
                 <Button className="bg-green-600 hover:bg-green-700 text-white"><Plus className="w-4 h-4 mr-2"/> Nova NFS-e</Button>
              </div>
           </div>

           <Card>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nº NFS-e</TableHead><TableHead>Tomador (Cliente)</TableHead><TableHead className="text-center">Cod. Serviço</TableHead><TableHead>Data Emissão</TableHead><TableHead className="text-right">Valor do Serviço</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Documento</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {nfses.map((n, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold text-green-700">{n.numero}</TableCell>
                        <TableCell className="text-sm font-medium">{n.cliente}</TableCell>
                        <TableCell className="text-xs text-center">{n.servico}</TableCell>
                        <TableCell className="text-xs">{new Date(n.data_emissao).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right font-medium">{fmtFin(n.valor)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={n.status === "Autorizado" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>{n.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4 text-muted-foreground"/></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </CardContent>
           </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
