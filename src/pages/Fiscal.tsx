import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FileSpreadsheet, UploadCloud, Link as LinkIcon, Plus, Stamp, Search, Download, Truck, Printer, Send, CreditCard, FileCheck, AlertCircle, Settings, Eye, Trash2, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const mockCtes: any[] = [];
const mockMdfes: any[] = [];
const mockNfses: any[] = [];
const mockXmls: any[] = [];

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Simulação de configuração Focus NFe
const FOCUS_CONFIG = {
  token: import.meta.env.VITE_FOCUS_TOKEN || "",
  ambiente: import.meta.env.VITE_FOCUS_AMBIENTE || "homologacao",
  configured: false // Alterar para true quando configurar
};

const isFocusConfigured = () => {
  if (!FOCUS_CONFIG.token) {
    toast.warning("Integração Focus NFe pendente de configuração. Defina VITE_FOCUS_TOKEN nas variáveis de ambiente.");
    return false;
  }
  return true;
};

export default function Fiscal() {
  useEffect(() => {
    const sCtes = localStorage.getItem("fiscal_ctes");
    if(sCtes) setCtes(JSON.parse(sCtes)); else { setCtes(mockCtes); localStorage.setItem("fiscal_ctes", JSON.stringify(mockCtes)); }
    const sMdfes = localStorage.getItem("fiscal_mdfes");
    if(sMdfes) setMdfes(JSON.parse(sMdfes)); else { setMdfes(mockMdfes); localStorage.setItem("fiscal_mdfes", JSON.stringify(mockMdfes)); }
    const sNfses = localStorage.getItem("fiscal_nfses");
    if(sNfses) setNfses(JSON.parse(sNfses)); else { setNfses(mockNfses); localStorage.setItem("fiscal_nfses", JSON.stringify(mockNfses)); }
    const sXmls = localStorage.getItem("fiscal_xmls");
    if(sXmls) setXmls(JSON.parse(sXmls)); else { setXmls(mockXmls); localStorage.setItem("fiscal_xmls", JSON.stringify(mockXmls)); }
  }, []);

  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "cte";
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [tipoEmitir, setTipoEmitir] = useState<"cte" | "mdfe" | "nfse" | "boleto">("nfse");
  const [osSelecionada, setOsSelecionada] = useState("");

  const [ctes, setCtes] = useState<any[]>([]);
  const [mdfes, setMdfes] = useState<any[]>([]);
  const [nfses, setNfses] = useState<any[]>([]);
  const [xmls, setXmls] = useState<any[]>([]);
  
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

  const handleEmitirDocumento = (tipo: "cte" | "mdfe" | "nfse" | "boleto") => {
    if (!isFocusConfigured()) return;
    setTipoEmitir(tipo);
    setShowEmitirModal(true);
    console.log(`[FISCAL] Emitir ${tipo} - Fluxo: selecionar OS → emitir via Focus NFe → gerar documento`);
  };

  const handleConfirmarEmissao = () => {
    if (!isFocusConfigured()) return;
    toast.info(`Emitindo ${tipoEmitir.toUpperCase()} via Focus NFe... simulated`);
    toast.success(`${tipoEmitir.toUpperCase()} emitido com sucesso! (Simulação)`);
    setShowEmitirModal(false);
    console.log(`[FISCAL] ${tipoEmitir.toUpperCase()} emitido para OS: ${osSelecionada}`);
  };

  const handleGerarBoleto = () => {
    if (!isFocusConfigured()) return;
    toast.info("Gerando Boleto via Efí... (simulação)");
    toast.success("Boleto gerado! Para enviar, use Comunicação.");
    console.log(`[FISCAL] Boleto gerado para OS: ${osSelecionada}`);
  };

  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportXmlClick = () => { fileInputRef.current?.click(); };
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;
     if (!file.name.endsWith('.xml')) { toast.error("Apenas arquivos XML são aceitos."); return; }
     
     toast.success("XML " + file.name + " validado com sucesso! Preview gerado.");
     const newXml = { arquivo: file.name, tipo: "CT-e", emissor: "IMPORTAÇÃO MANUAL", data: new Date().toISOString(), valor: 0, status: "Pendente Importação" };
     const updated = [newXml, ...xmls];
     setXmls(updated);
     localStorage.setItem("fiscal_xmls", JSON.stringify(updated));
  };


  const handleVincularOS = () => {
    toast.info("Selecione a OS para vincular...");
    console.log(`[FISCAL] Vincular OS - Abrir seleção de OS`);
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText className="w-8 h-8 text-primary" /> Central Fiscal
          </h1>
          <p className="text-muted-foreground">Emissão de NFS-e, CT-e, MDF-e e Boletos via Focus NFe / Efí</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfigModal(true)} className="gap-1">
            <Settings className="w-4 h-4" /> Configurar
          </Button>
          <Badge variant="secondary" className={FOCUS_CONFIG.configured ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
            <AlertCircle className="w-3 h-3 mr-1" />
            {FOCUS_CONFIG.configured ? "Focus OK" : "Pendente"}
          </Badge>
        </div>
      </div>

      {/* Cards de Status Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-xs text-blue-600 font-medium">CT-e Autorizados</p><p className="text-2xl font-bold text-blue-700">{ctes.filter(c => c.status === "Autorizado").length}</p></div>
            <FileSpreadsheet className="w-8 h-8 text-blue-400" />
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-xs text-purple-600 font-medium">MDF-e Abertos</p><p className="text-2xl font-bold text-purple-700">{mdfes.filter(m => m.status === "Aberto").length}</p></div>
            <Truck className="w-8 h-8 text-purple-400" />
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-xs text-green-600 font-medium">NFS-e Emitidas</p><p className="text-2xl font-bold text-green-700">{nfses.filter(n => n.status === "Autorizado").length}</p></div>
            <Stamp className="w-8 h-8 text-green-400" />
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div><p className="text-xs text-orange-600 font-medium">Boletos Gerados</p><p className="text-2xl font-bold text-orange-700">0</p></div>
            <CreditCard className="w-8 h-8 text-orange-400" />
          </CardContent>
        </Card>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 justify-start overflow-x-auto flex-wrap">
           <TabsTrigger value="cte" className="gap-2"><FileSpreadsheet className="w-4 h-4"/>CT-e</TabsTrigger>
           <TabsTrigger value="mdfe" className="gap-2"><Truck className="w-4 h-4"/>MDF-e</TabsTrigger>
           <TabsTrigger value="nfse" className="gap-2"><Stamp className="w-4 h-4"/>NFS-e</TabsTrigger>
        </TabsList>

        {/* --- CT-e --- */}
        <TabsContent value="cte" className="space-y-4 pt-4">
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar CT-e, chave ou tomador..." className="pl-9 w-full" />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
                 <Button variant="outline" onClick={handleVincularOS} className="border-dashed"><LinkIcon className="w-4 h-4 mr-2"/> Vincular à OS</Button>
                 <Button variant="outline" onClick={handleImportXmlClick}><UploadCloud className="w-4 h-4 mr-2"/> Importar XML</Button>
                 <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleEmitirDocumento("cte")}><FileSpreadsheet className="w-4 h-4 mr-2"/> Emitir CT-e</Button>
              </div>
           </div>

           <Card>
             <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Nº CT-e</TableHead><TableHead>Chave de Acesso</TableHead><TableHead>Emitente</TableHead><TableHead>Tomador</TableHead><TableHead>CFOP</TableHead><TableHead>Data Emissão</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead className="text-center">Ações</TableHead></TableRow></TableHeader>
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
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Visualizar"><Eye className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Imprimir DANFE"><Printer className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Baixar XML"><Download className="w-4 h-4" /></Button>
                          </div>
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
                 <Button variant="outline"><LinkIcon className="w-4 h-4 mr-2"/> Vincular CT-es</Button>
                 <Button variant="outline"><FileText className="w-4 h-4 mr-2"/> Encerrar MDF-e</Button>
                 <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => handleEmitirDocumento("mdfe")}><Truck className="w-4 h-4 mr-2"/> Emitir MDF-e</Button>
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
                 <Button variant="outline" onClick={handleVincularOS}><LinkIcon className="w-4 h-4 mr-2"/> Vincular OS</Button>
                 <Button variant="outline" onClick={() => handleEmitirDocumento("nfse")}><Stamp className="w-4 h-4 mr-2"/> Emitir NFS-e</Button>
                 <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleEmitirDocumento("boleto")}><CreditCard className="w-4 h-4 mr-2"/> Gerar Boleto Efí</Button>
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

      {/* Modal Configuração Focus NFe */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5"/> Configuração Fiscal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800">Focus NFe / Efí</p>
              <p className="text-xs text-amber-600 mt-1">Configure as credenciais no arquivo .env para ativar a emissão:</p>
              <ul className="text-xs text-amber-600 mt-2 space-y-1">
                <li>• VITE_FOCUS_TOKEN=seu_token</li>
                <li>• VITE_FOCUS_AMBIENTE=homologacao ou producao</li>
                <li>• VITE_EFI_CLIENT_ID=seu_client_id</li>
                <li>• VITE_EFI_CLIENT_SECRET=seu_secret</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Token Focus</Label>
                <Input type="password" placeholder="••••••••••••" disabled />
              </div>
              <div>
                <Label>Ambiente</Label>
                <Select disabled>
                  <SelectTrigger><SelectValue placeholder="Homologação" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="homologacao">Homologação</SelectItem>
                    <SelectItem value="producao">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Prefeitura (NFS-e)</Label>
              <Select disabled>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sp">São Paulo</SelectItem>
                  <SelectItem value="campinas">Campinas</SelectItem>
                  <SelectItem value="guarulhos">Guarulhos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)}>Fechar</Button>
            <Button disabled>Salvar Configuração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Emitir Documento */}
      <Dialog open={showEmitirModal} onOpenChange={setShowEmitirModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoEmitir === "cte" && <FileSpreadsheet className="w-5 h-5 text-blue-600"/>}
              {tipoEmitir === "mdfe" && <Truck className="w-5 h-5 text-purple-600"/>}
              {tipoEmitir === "nfse" && <Stamp className="w-5 h-5 text-green-600"/>}
              {tipoEmitir === "boleto" && <CreditCard className="w-5 h-5 text-orange-600"/>}
              Emitir {tipoEmitir.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm font-medium text-blue-800">Fluxo: OS → Focus NFe → Documento</p>
              <p className="text-xs text-blue-600 mt-1">Selecione a OS para emitir o documento fiscal.</p>
            </div>
            <div>
              <Label>Vincular à OS</Label>
              <Select value={osSelecionada} onValueChange={setOsSelecionada}>
                <SelectTrigger><SelectValue placeholder="Selecione a OS..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="os001">OS-2026-001 - Magazine Luiza</SelectItem>
                  <SelectItem value="os002">OS-2026-002 - Amazon</SelectItem>
                  <SelectItem value="os003">OS-2026-003 - Mercado Livre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoEmitir === "boleto" && (
              <div>
                <Label>Tipo Boleto</Label>
                <Select defaultValue="cobranca">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cobranca">Cobrança Simples</SelectItem>
                    <SelectItem value="carne">Carnê</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmitirModal(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarEmissao} className={tipoEmitir === "cte" ? "bg-blue-600" : tipoEmitir === "mdfe" ? "bg-purple-600" : tipoEmitir === "nfse" ? "bg-green-600" : "bg-orange-600"}>
              {tipoEmitir === "boleto" ? "Gerar Boleto" : `Emitir ${tipoEmitir.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
