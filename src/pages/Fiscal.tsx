import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FileSpreadsheet, UploadCloud, Link as LinkIcon, Plus, Stamp, Search, Download, Truck, Printer, Send, CreditCard, FileCheck, AlertCircle, Settings, Eye, Trash2, RefreshCw, Building2, Radio, LayoutDashboard, ShieldAlert, Loader2, Lock } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
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

// --- NFS-e Nacional / Certificado A1 ---
const CNPJ_MATRIZ_DIGITOS = "31227975000180";
const TAMANHO_MAX_CERTIFICADO = 10 * 1024 * 1024; // 10 MB (mesmo limite do bucket)
const somenteDigitosCnpj = (valor?: string | null) => (valor || "").replace(/\D/g, "");

type EmitenteMatriz = {
  id: string;
  razao_social: string | null;
  cnpj: string | null;
  ambiente_fiscal?: string | null;
};

type RespostaUploadCertificado = {
  success?: boolean;
  message?: string;
  error?: string;
};

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

  // Certificado A1 (NFS-e Nacional)
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState("");
  const [certEmitente, setCertEmitente] = useState<EmitenteMatriz | null>(null);
  const [ambienteFiscal, setAmbienteFiscal] = useState<string | null>(null);
  const [certCarregandoEmitente, setCertCarregandoEmitente] = useState(false);
  const [certEnviando, setCertEnviando] = useState(false);
  const certInputRef = useRef<HTMLInputElement>(null);

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

  // ------------------------------------------------------------------
  // Certificado A1 — carrega a matriz Conexão Express (CNPJ 31.227.975/0001-80)
  // Ao abrir o modal, resolve o emitente_fiscal usado no upload.
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelado = false;

    (async () => {
      setCertCarregandoEmitente(true);
      try {
        const { data, error } = await supabase
          .from("configuracoes_fiscais")
          .select("id, razao_social, cnpj, ambiente_fiscal")
          .eq("ativo", true);
        if (error) throw error;

        const lista = (data || []) as EmitenteMatriz[];
        let matriz =
          lista.find((e) => somenteDigitosCnpj(e.cnpj) === CNPJ_MATRIZ_DIGITOS) || null;

        if (!matriz) {
          const { data: padrao } = await supabase
            .from("configuracoes_fiscais")
            .select("id, razao_social, cnpj, ambiente_fiscal")
            .eq("padrao", true)
            .maybeSingle();
          matriz = (padrao as EmitenteMatriz | null) || null;
        }

        if (!cancelado) {
          setCertEmitente(matriz);
          setAmbienteFiscal(matriz?.ambiente_fiscal || "homologacao");
        }
      } catch (err: unknown) {
        console.error(
          "[Fiscal] Erro ao carregar emitente matriz:",
          err instanceof Error ? err.message : String(err),
        );
        if (!cancelado) {
          setCertEmitente(null);
          setAmbienteFiscal("homologacao");
        }
      } finally {
        if (!cancelado) setCertCarregandoEmitente(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [showConfigModal]);

  const resetFormCertificado = () => {
    setCertFile(null);
    setCertPassword("");
    if (certInputRef.current) certInputRef.current.value = "";
  };

  const fecharConfigModal = () => {
    if (certEnviando) return;
    setShowConfigModal(false);
    resetFormCertificado();
  };

  const handleUploadCertificado = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!certEmitente?.id) {
      toast.error("Emitente matriz não encontrado. Cadastre o emitente na aba Emitente.");
      return;
    }
    if (!certFile) {
      toast.error("Selecione o arquivo do certificado (.pfx ou .p12).");
      return;
    }
    const nome = certFile.name.toLowerCase();
    if (!nome.endsWith(".pfx") && !nome.endsWith(".p12")) {
      toast.error("Formato inválido. Envie um arquivo .pfx ou .p12.");
      return;
    }
    if (certFile.size > TAMANHO_MAX_CERTIFICADO) {
      toast.error("O arquivo excede o limite de 10 MB.");
      return;
    }
    if (!certPassword) {
      toast.error("Informe a senha do certificado.");
      return;
    }

    setCertEnviando(true);
    try {
      const { data: sessao, error: sessaoError } = await supabase.auth.getSession();
      const token = sessao?.session?.access_token;
      if (sessaoError || !token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("file", certFile);
      formData.append("password", certPassword);
      formData.append("emitente_id", certEmitente.id);

      const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || supabaseUrl;
      const anonKey =
        (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || supabaseAnonKey;

      const resposta = await fetch(`${baseUrl}/functions/v1/nfse-upload-certificado`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
        body: formData,
      });

      const json = (await resposta.json().catch(() => ({}))) as RespostaUploadCertificado;

      if (!resposta.ok || !json.success) {
        toast.error(json.error || "Não foi possível enviar o certificado.");
        return;
      }

      toast.success(json.message || "Certificado A1 enviado com sucesso!");
      resetFormCertificado();
      setShowConfigModal(false);
    } catch (err: unknown) {
      console.error(
        "[Fiscal] Erro ao enviar certificado:",
        err instanceof Error ? err.message : String(err),
      );
      toast.error("Erro de rede ao enviar o certificado. Tente novamente.");
    } finally {
      setCertEnviando(false);
    }
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
          <p className="text-muted-foreground">Emissao de NFS-e, CT-e, MDF-e - Ambiente de {String(ambienteFiscal || "").toLowerCase().startsWith("prod") ? "producao" : "homologacao"}</p>
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

      {/* Modal Configuração Fiscal — Certificado A1 (NFS-e Nacional) */}
      <Dialog
        open={showConfigModal}
        onOpenChange={(open) => {
          if (open) setShowConfigModal(true);
          else fecharConfigModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" /> Configuração Fiscal — Certificado A1
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUploadCertificado}>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs text-muted-foreground">Emitente (matriz)</p>
                {certCarregandoEmitente ? (
                  <p className="text-sm flex items-center gap-2 mt-1">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando emitente...
                  </p>
                ) : certEmitente ? (
                  <>
                    <p className="text-sm font-semibold mt-1">{certEmitente.razao_social}</p>
                    <p className="text-xs text-muted-foreground">{certEmitente.cnpj}</p>
                  </>
                ) : (
                  <p className="text-sm text-red-600 mt-1">
                    Matriz Conexão Express não encontrada. Cadastre o emitente na aba Emitente.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="cert-arquivo">Arquivo do certificado A1 (.pfx / .p12) *</Label>
                <Input
                  id="cert-arquivo"
                  ref={certInputRef}
                  type="file"
                  accept=".pfx,.p12"
                  disabled={certEnviando}
                  className="mt-1 cursor-pointer"
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0] || null;
                    setCertFile(arquivo);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {certFile
                    ? `${certFile.name} — ${(certFile.size / 1024).toFixed(1)} KB`
                    : "Máximo 10 MB. O arquivo é enviado ao cofre privado."}
                </p>
              </div>

              <div>
                <Label htmlFor="cert-senha">Senha do certificado *</Label>
                <div className="relative mt-1">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="cert-senha"
                    type="password"
                    className="pl-9"
                    placeholder="Senha do arquivo .pfx"
                    autoComplete="new-password"
                    value={certPassword}
                    disabled={certEnviando}
                    onChange={(e) => setCertPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                A senha é criptografada (AES-GCM) antes de ser gravada e nunca é
                retornada pela API. O certificado fica no bucket privado.
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={fecharConfigModal}
                disabled={certEnviando}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  certEnviando ||
                  certCarregandoEmitente ||
                  !certEmitente ||
                  !certFile ||
                  !certPassword
                }
              >
                {certEnviando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" /> Enviar Certificado
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
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
