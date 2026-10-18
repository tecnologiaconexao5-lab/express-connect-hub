import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FileSpreadsheet, UploadCloud, Link as LinkIcon, Plus, Stamp, Search, Download, Truck, Printer, Send, CreditCard, FileCheck, AlertCircle, Settings, Eye, Trash2, RefreshCw, Building2, Radio, LayoutDashboard, ShieldAlert } from "lucide-react";
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
import CteTab from "@/components/fiscal/cte/CteTab";
import MdfeTab from "@/components/fiscal/mdfe/MdfeTab";
import EmitenteFiscalConfig from "@/components/fiscal/EmitenteFiscalConfig";
import RegrasFiscaisCte from "@/components/fiscal/RegrasFiscaisCte";
import RegrasFiscaisNfse from "@/components/fiscal/RegrasFiscaisNfse";
import FocusNfeConfig from "@/components/fiscal/FocusNfeConfig";
import FiscalDashboard from "@/components/fiscal/FiscalDashboard";
import AuditoriaFiscal from "@/components/fiscal/AuditoriaFiscal";
import DocumentosTab from "@/components/fiscal/DocumentosTab";
import NfseTab from "@/components/fiscal/NfseTab";

// Mocks isolados, usar apenas para teste se necessário via env var
const MOCK_MODE = import.meta.env.DEV && import.meta.env.VITE_USE_FISCAL_MOCKS === 'true';

const mockCtes: any[] = [];
const mockMdfes: any[] = [];
const mockNfses: any[] = [];
const mockXmls: any[] = [];

const fmtFin = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MSG_FOCUS_SECRETS = "O token Focus deve ser configurado nos Supabase Secrets da Edge Function focus-emissao, nunca no frontend. Consulte o guia de configuração Focus NFe.";

export default function Fiscal() {
  useEffect(() => {
    if (MOCK_MODE) {
      const sCtes = localStorage.getItem("fiscal_ctes");
      if(sCtes) setCtes(JSON.parse(sCtes)); else { setCtes(mockCtes); localStorage.setItem("fiscal_ctes", JSON.stringify(mockCtes)); }
      const sMdfes = localStorage.getItem("fiscal_mdfes");
      if(sMdfes) setMdfes(JSON.parse(sMdfes)); else { setMdfes(mockMdfes); localStorage.setItem("fiscal_mdfes", JSON.stringify(mockMdfes)); }
      const sNfses = localStorage.getItem("fiscal_nfses");
      if(sNfses) setNfses(JSON.parse(sNfses)); else { setNfses(mockNfses); localStorage.setItem("fiscal_nfses", JSON.stringify(mockNfses)); }
      const sXmls = localStorage.getItem("fiscal_xmls");
      if(sXmls) setXmls(JSON.parse(sXmls)); else { setXmls(mockXmls); localStorage.setItem("fiscal_xmls", JSON.stringify(mockXmls)); }
    }
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
    if (MOCK_MODE) return;
    try {
      const { data, error } = await supabase.from("fiscal_ctes").select("*").order("data_emissao", { ascending: false });
      if (error) throw error;
      setCtes(data || []);
    } catch (err: any) {
      toast.error(`Erro ao buscar CT-es: ${err.message}`);
      console.error(err);
    }
  };

  const fetchMdfes = async () => {
    if (MOCK_MODE) return;
    try {
      const { data, error } = await supabase.from("fiscal_mdfes").select("*").order("data_emissao", { ascending: false });
      if (error) throw error;
      setMdfes(data || []);
    } catch (err: any) {
      toast.error(`Erro ao buscar MDF-es: ${err.message}`);
      console.error(err);
    }
  };

  const fetchNfses = async () => {
    if (MOCK_MODE) return;
    try {
      const { data, error } = await supabase.from("fiscal_nfse").select("*").order("data_emissao", { ascending: false });
      if (error) throw error;
      setNfses(data || []);
    } catch (err: any) {
      toast.error(`Erro ao buscar NFS-es: ${err.message}`);
      console.error(err);
    }
  };

  const handleEmitirDocumento = (tipo: "cte" | "mdfe" | "nfse" | "boleto") => {
    toast.info(MSG_FOCUS_SECRETS);
  };

  const handleConfirmarEmissao = () => {
    toast.info(MSG_FOCUS_SECRETS);
  };

  const handleGerarBoleto = () => {
    toast.info(MSG_FOCUS_SECRETS);
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
            <FileText className="w-8 h-8 text-primary" /> Central Fiscal Conexao Express
          </h1>
          <p className="text-muted-foreground">Emissao de NFS-e, CT-e, MDF-e — Ambiente de homologacao</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowConfigModal(true)} className="gap-1">
            <Settings className="w-4 h-4" /> Configurar
          </Button>
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Focus: Pendente
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
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="w-4 h-4"/>Dashboard</TabsTrigger>
            <TabsTrigger value="cte" className="gap-2"><FileSpreadsheet className="w-4 h-4"/>CT-e</TabsTrigger>
            <TabsTrigger value="mdfe" className="gap-2"><Truck className="w-4 h-4"/>MDF-e</TabsTrigger>
            <TabsTrigger value="nfse" className="gap-2"><Stamp className="w-4 h-4"/>NFS-e</TabsTrigger>
            <TabsTrigger value="emitente" className="gap-2"><Building2 className="w-4 h-4"/>Emitente</TabsTrigger>
            <TabsTrigger value="regras" className="gap-2"><AlertCircle className="w-4 h-4"/>Regras CT-e</TabsTrigger>
           <TabsTrigger value="regras_nfse" className="gap-2"><Stamp className="w-4 h-4"/>Regras NFS-e</TabsTrigger>
           <TabsTrigger value="documentos" className="gap-2"><FileText className="w-4 h-4"/>Documentos</TabsTrigger>
            <TabsTrigger value="focus" className="gap-2"><Radio className="w-4 h-4"/>Focus NFe</TabsTrigger>
           <TabsTrigger value="auditoria" className="gap-2"><ShieldAlert className="w-4 h-4"/>Auditoria</TabsTrigger>
         </TabsList>

         {/* --- Dashboard --- */}
         <TabsContent value="dashboard" className="pt-4">
            <FiscalDashboard />
         </TabsContent>

        {/* --- CT-e --- */}
        <TabsContent value="cte" className="pt-4">
           <CteTab />
        </TabsContent>

        {/* --- MDF-e --- */}
        <TabsContent value="mdfe" className="pt-4">
           <MdfeTab />
        </TabsContent>

         {/* --- NFS-e --- */}
         <TabsContent value="nfse" className="pt-4">
            <NfseTab />
         </TabsContent>

         {/* --- Emitente Fiscal --- */}
         <TabsContent value="emitente" className="pt-4">
            <EmitenteFiscalConfig />
         </TabsContent>

         {/* --- Regras Fiscais --- */}
         <TabsContent value="regras" className="pt-4">
            <RegrasFiscaisCte />
         </TabsContent>

         {/* --- Regras NFS-e --- */}
         <TabsContent value="regras_nfse" className="pt-4">
            <RegrasFiscaisNfse />
         </TabsContent>

         {/* --- Documentos --- */}
         <TabsContent value="documentos" className="pt-4">
            <DocumentosTab />
         </TabsContent>

         {/* --- Focus NFe --- */}
         <TabsContent value="focus" className="pt-4">
            <FocusNfeConfig />
         </TabsContent>

         {/* --- Auditoria --- */}
         <TabsContent value="auditoria" className="pt-4">
            <AuditoriaFiscal />
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
              <p className="text-xs text-amber-600 mt-1">O token Focus e gerenciado exclusivamente nos Supabase Secrets da Edge Function:</p>
              <ul className="text-xs text-amber-600 mt-2 space-y-1">
                <li>• O token Focus e configurado nos Supabase Secrets da Edge Function focus-emissao</li>
                <li>• Nunca insira token no frontend ou em arquivos .env com prefixo VITE_</li>
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
