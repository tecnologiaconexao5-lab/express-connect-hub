import { useState, useEffect } from "react";
import { ArrowLeft, Plus, CheckCircle, Save, Calendar, Copy, MapPin, Trash2, Edit, AlertTriangle, FileText, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Cliente } from "./types";
import { EnderecoCompleto } from "@/components/ui/EnderecoCompleto";
import { toClienteInsert, toClienteUpdate, fromClienteRow, ClienteRow } from "@/lib/dbMappers";
import { buscarCEP, limparCEP, validarCEP, CEPResponse } from "@/services/cepService";

interface Filial {
  id: string;
  nome: string;
  endereco: string;
  responsavel: string;
  telefone: string;
  status: string;
}

interface CentroCusto {
  id: string;
  codigo: string;
  nome: string;
  filialId: string;
  status: string;
}

interface Departamento {
  id: string;
  nome: string;
  responsavel: string;
  email: string;
}

interface Contrato {
  id: string;
  numero: string;
  tipo: string;
  objeto: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  valor: number;
  status: string;
  urlPdf?: string;
}

interface Props {
  clienteId?: string;
  onBack: () => void;
}

const defaultCliente: Partial<Cliente> = {
  status: "Ativo",
  exigeAgendamento: false,
  exigeSla: false,
  exigePortal: false,
  aceitaApi: false,
};

const ClienteDetalhe = ({ clienteId, onBack }: Props) => {
  const isNew = !clienteId;
  const [c, setC] = useState<Partial<Cliente>>(defaultCliente);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [modalFilialOpen, setModalFilialOpen] = useState(false);
  const [modalCCOpen, setModalCCOpen] = useState(false);
  const [modalDeptoOpen, setModalDeptoOpen] = useState(false);
  const [modalContratoOpen, setModalContratoOpen] = useState(false);
  const [novaFilial, setNovaFilial] = useState<Partial<Filial>>({});
  const [novoCC, setNovoCC] = useState<Partial<CentroCusto>>({});
  const [novoDepto, setNovoDepto] = useState<Partial<Departamento>>({});
  const [novoContrato, setNovoContrato] = useState<Partial<Contrato>>({});
  const [enderecos, setEnderecos] = useState<Array<{id: string; tipo_endereco: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string}>>([]);
  const [modalEnderecoOpen, setModalEnderecoOpen] = useState(false);
  const [novoEndereco, setNovoEndereco] = useState<{tipo_endereco: string; cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string}>({tipo_endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: ""});
  const [cepLoading, setCepLoading] = useState(false);

  const handleCEPBlur = async () => {
    const cepDigitado = novoEndereco.cep.replace(/\D/g, '');
    if (cepDigitado.length !== 8) return;
    if (novoEndereco.logradouro || novoEndereco.bairro || novoEndereco.cidade) return;
    
    setCepLoading(true);
    const resultado = await buscarCEP(novoEndereco.cep);
    
    if ('logradouro' in resultado) {
      setNovoEndereco(prev => ({
        ...prev,
        logradouro: resultado.logradouro,
        bairro: resultado.bairro,
        cidade: resultado.cidade,
        uf: resultado.estado,
        ...(resultado.complemento ? { complemento: resultado.complemento } : {})
      }));
      toast.success('Endereço preenchido automaticamente.');
    } else {
      toast.warning(resultado.message);
    }
    setCepLoading(false);
  };

  const [debugInfo, setDebugInfo] = useState<{
    url: string;
    tabela: string;
    operacao: string;
    testeTecnico: { success: boolean; message?: string; details?: string; hint?: string; code?: string; count?: number; requestUrl?: string; requestMethod?: string; responseStatus?: number; responseBody?: unknown };
    saveResult: { success: boolean; message?: string; details?: string; hint?: string; code?: string; requestUrl?: string; requestMethod?: string; responseStatus?: number; responseBody?: unknown };
    payload: object;
  } | null>(null);
  
  const mapCause = (code?: string, testeSuccess?: boolean): string => {
    if (!code) {
      if (!testeSuccess) return "conexão/projeto/url incorreta";
      return "erro desconhecido";
    }
    const map: Record<string, string> = {
      "42P01": "tabela não encontrada",
      "42703": "coluna inexistente",
      "23502": "campo obrigatório ausente",
      "22P02": "tipo inválido",
      "P0001": "trigger/function falhou",
      "42501": "policy/RLS/permissão negada"
    };
    return map[code] || "erro Supabase (code: " + code + ")";
  };
  
  const getConclusao = (testeSuccess: boolean, saveSuccess: boolean, code?: string): string => {
    if (saveSuccess) return "✅ Cadastro salvo com sucesso";
    if (!testeSuccess) return "❌ Falha por conexão/projeto/url incorreta";
    if (code === "42P01") return "❌ Falha por tabela não encontrada";
    if (code === "42703") return "❌ Falha por coluna inexistente";
    if (code === "23502") return "❌ Falha por campo obrigatório ausente";
    if (code === "22P02") return "❌ Falha por tipo de dado inválido";
    if (code === "42501") return "❌ Falha por policy/permissão";
    if (code === "P0001") return "❌ Falha por trigger/function";
    return "❌ Falha por causa ainda não mapeada";
  };
  
  const copyDiagnostico = async () => {
    if (!debugInfo) return;
    const d = debugInfo;
    const texto = [
      `=== DIAGNÓSTICO SUPABASE - CLIENTES ===`,
      `url: ${d.url}`,
      `fallback: ${!import.meta.env.VITE_SUPABASE_URL ? "SIM" : "NÃO"}`,
      `tabela: ${d.tabela}`,
      `operação: ${d.operacao}`,
      `teste técnico: ${d.testeTecnico.success ? "OK" : "FALHOU"}`,
      `save: ${d.saveResult.success ? "OK" : "FALHOU"}`,
      `code: ${d.saveResult.code || "N/A"}`,
      `cause_provavel: ${mapCause(d.saveResult.code, d.testeTecnico.success)}`,
      `message: ${d.saveResult.message || "OK"}`,
      `=== FIM ===`
    ].join("\n");
    await navigator.clipboard.writeText(texto);
    toast.success("Diagnóstico copiado!");
  };

  useEffect(() => {
    if (clienteId) {
      fetchCliente();
      fetchEnderecos();
    }
  }, [clienteId]);

  const fetchCliente = async () => {
    setIsLoading(true);
    try {
      const TABLE_NAME = "clientes";
      console.log(`[ClienteDetalhe] FETCH - Buscando ID: ${clienteId} da tabela: ${TABLE_NAME}`);
      const { data, error } = await supabase.from(TABLE_NAME).select("*").eq("id", clienteId).single();
      if (error) {
        console.error(`[ClienteDetalhe] Erro no fetch da '${TABLE_NAME}':`, error.message);
        throw error;
      }
      console.log(`[ClienteDetalhe] Fetch OK da '${TABLE_NAME}':`, data);
      if (data) {
        setC(fromClienteRow(data as ClienteRow) as Partial<Cliente>);
      }
    } catch (error) {
      console.error("[ClienteDetalhe] Erro catch fetch:", error);
      toast.error("Erro ao carregar detalhes do cliente.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEnderecos = async () => {
    if (!clienteId) return;
    try {
      const { data, error } = await supabase
        .from("enderecos_clientes")
        .select("*")
        .eq("cliente_id", clienteId);
      if (error) throw error;
      setEnderecos(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar endereços:", error.message);
    }
  };

  const handleChange = (field: keyof Cliente, value: any) => {
    setC(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!c.razaoSocial || !c.cnpj) {
      toast.error("Razão Social e CNPJ são obrigatórios");
      return;
    }

    try {
      setIsSaving(true);
      const isUpdate = !!c.id;
      
      const TABLE_NAME = "clientes";
      console.log(`[ClienteDetalhe] INICIO - Tabela: ${TABLE_NAME}, Operacao: ${isUpdate ? 'UPDATE' : 'INSERT'}`);
      
      console.log(`%c🔍 TESTE TÉCNICO: Verificando acesso a tabela '${TABLE_NAME}'...`, "color: blue; font-weight: bold;");
      const teste = await supabase.from(TABLE_NAME).select("*", { head: true, count: "exact" });
      const testeResult = {
        success: !teste.error,
        message: teste.error?.message,
        details: teste.error?.details,
        hint: teste.error?.hint,
        code: teste.error?.code,
        count: teste.count
      };
      if (teste.error) {
        console.error(`[ClienteDetalhe] ERRO no teste técnico da tabela '${TABLE_NAME}':`);
        console.error("  message:", teste.error.message);
        console.error("  details:", teste.error.details);
        console.error("  hint:", teste.error.hint);
        console.error("  code:", teste.error.code);
      } else {
        console.log(`[ClienteDetalhe] ✅ Teste técnico OK - Count: ${teste.count}`);
      }
      
      setDebugInfo({
        url: debugUrl,
        tabela: TABLE_NAME,
        operacao: isUpdate ? "UPDATE" : "INSERT",
        testeTecnico: testeResult,
        saveResult: { success: true },
        payload: {}
      });
      
      const payload = isUpdate ? toClienteUpdate(c) : toClienteInsert(c);

      console.log(`[ClienteDetalhe] Payload enviado para '${TABLE_NAME}':`, JSON.stringify(payload, null, 2));

      let result;
      if (isUpdate) {
        result = await supabase.from(TABLE_NAME).update(payload).eq("id", c.id).select();
      } else {
        result = await supabase.from(TABLE_NAME).insert([payload]).select();
      }

      const { data, error } = result;

      if (error) {
        console.error(`====== ERRO SUPABASE '${TABLE_NAME}' ======`);
        console.error("Mensagem:", error.message);
        console.error("Detalhes:", error.details);
        console.error("Hint:", error.hint);
        console.error("Code:", error.code);
        console.error("Payload que falhou:", JSON.stringify(payload, null, 2));
        console.error("==================================");
        
        setDebugInfo(prev => prev ? {
          ...prev,
          saveResult: {
            success: false,
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          },
          payload
        } : null);
        
        toast.error(`Falha no banco: ${error.message} - Dica: ${error.hint || 'Nenhuma dica disponível'}`);
        return;
      }

      console.log(`%c[ClienteDetalhe] ✅ OPERAÇÃO ${isUpdate ? 'UPDATE' : 'INSERT'} CONCLUÍDA NA TABELA '${TABLE_NAME}'`, "color: green; font-weight: bold;");
      console.log(`[ClienteDetalhe] Resultado:`, data);
      
      setDebugInfo(prev => prev ? {
        ...prev,
        saveResult: { success: true },
        payload
      } : null);
      
      const savedCliente = data?.[0];
      if (!savedCliente) {
        console.error("[ClienteDetalhe] Response kosong meski tidak ada error");
        toast.error("Erro: response kosong dari Supabase");
        return;
      }

      toast.success(isNew ? "Cliente cadastrado com sucesso!" : "Cliente atualizado com sucesso!");
      onBack();
    } catch (error: any) {
      console.error("[ClienteDetalhe] Erro Catch (inesperado):", error);
      console.error("Error message:", error?.message);
      console.error("Error details:", error?.details);
      console.error("Error hint:", error?.hint);
      toast.error("Erro ao persistir cliente no Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center animate-pulse">Carregando dados do cliente...</div>;

  const debugUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Painel de Debug Temporário */}
      {debugInfo && (
        <div className="bg-slate-900 text-slate-200 p-3 rounded-md text-xs font-mono">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-bold text-yellow-400">PAINEL TÉCNICO DEBUG</span>
            <button onClick={copyDiagnostico} className="text-blue-400 hover:text-blue-300 ml-2">[Copiar diagnóstico]</button>
            <button onClick={() => setDebugInfo(null)} className="ml-auto text-slate-400 hover:text-white">✕</button>
          </div>
          <div className={"font-bold text-lg mb-2 " + (debugInfo.saveResult.success ? "text-green-400" : "text-red-400")}>
            {getConclusao(debugInfo.testeTecnico.success, debugInfo.saveResult.success, debugInfo.saveResult.code)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-400">URL:</span><span>{debugUrl.substring(0, 35)}...</span>
            <span className="text-slate-400">Fallback:</span><span className={!import.meta.env.VITE_SUPABASE_URL ? "text-red-400" : "text-green-400"}>{!import.meta.env.VITE_SUPABASE_URL ? "SIM" : "NÃO"}</span>
            <span className="text-slate-400">Tabela:</span><span>{debugInfo.tabela}</span>
            <span className="text-slate-400">Operação:</span><span className={debugInfo.operacao === "INSERT" ? "text-green-400" : "text-blue-400"}>{debugInfo.operacao}</span>
            <span className="text-slate-400">Teste Técnico:</span><span className={debugInfo.testeTecnico.success ? "text-green-400" : "text-red-400"}>{debugInfo.testeTecnico.success ? `OK (${debugInfo.testeTecnico.count})` : "FALHOU"}</span>
            <span className="text-slate-400">TesteMét:</span><span>{debugInfo.testeTecnico.requestMethod || 'N/A'}</span>
            <span className="text-slate-400">TesteURL:</span><span className="text-xs">{debugInfo.testeTecnico.requestUrl ? new URL(debugInfo.testeTecnico.requestUrl).pathname : 'N/A'}</span>
            <span className="text-slate-400">Save:</span><span className={debugInfo.saveResult.success ? "text-green-400" : "text-red-400"}>{debugInfo.saveResult.success ? "OK" : "FALHOU"}</span>
            <span className="text-slate-400">SaveMét:</span><span>{debugInfo.saveResult.requestMethod || 'N/A'}</span>
            <span className="text-slate-400">SaveURL:</span><span className="text-xs">{debugInfo.saveResult.requestUrl ? new URL(debugInfo.saveResult.requestUrl).pathname : 'N/A'}</span>
            <span className="text-slate-400">Status:</span><span className={debugInfo.saveResult.responseStatus && debugInfo.saveResult.responseStatus >= 400 ? "text-red-400" : "text-green-400"}>{debugInfo.saveResult.responseStatus || 'N/A'}</span>
          </div>
          {!debugInfo.saveResult.success && (
            <div className="mt-2 pt-2 border-t border-slate-700">
              <div className="text-yellow-400 font-bold">Cause provável:</div>
              <div className="text-orange-400">{mapCause(debugInfo.saveResult.code, debugInfo.testeTecnico.success)}</div>
              <div className="text-red-400 font-bold mt-1 mb-1">Code:</div>
              <div className="text-slate-300">{debugInfo.saveResult.code || "N/A"}</div>
              <div className="text-red-400 font-bold mt-1 mb-1">Erro details:</div>
              <div className="text-slate-300">{debugInfo.saveResult.details || "N/A"}</div>
              <div className="text-yellow-400 font-bold mt-1 mb-1">Hint:</div>
              <div className="text-slate-300">{debugInfo.saveResult.hint || "N/A"}</div>
              <div className="text-yellow-400 font-bold mt-1 mb-1">Response Body:</div>
              <pre className="text-slate-300 overflow-x-auto text-xs">{JSON.stringify(debugInfo.saveResult.responseBody, null, 2)}</pre>
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-slate-700">
            <div className="text-yellow-400 font-bold mb-1">Payload Enviado:</div>
            <pre className="text-slate-300 overflow-x-auto">{JSON.stringify(debugInfo.payload, null, 2)}</pre>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{isNew ? "Novo Cliente" : c.razaoSocial || "Detalhes do Cliente"}</h2>
            <p className="text-sm text-muted-foreground">{c.cnpj ? `CNPJ: ${c.cnpj}` : 'Preencha os dados abaixo'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar Cliente"}
          </Button>
        </div>
      </div>

      {/* Abas */}
      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 bg-muted/60 mb-6 h-auto p-1">
          <TabsTrigger value="gerais" className="py-2.5">Dados Gerais</TabsTrigger>
          <TabsTrigger value="enderecos" className="py-2.5">Endereços</TabsTrigger>
          <TabsTrigger value="estrutura" className="py-2.5">Estrutura</TabsTrigger>
          <TabsTrigger value="comercial" className="py-2.5">Comercial</TabsTrigger>
          <TabsTrigger value="contratos" className="py-2.5">Contratos</TabsTrigger>
        </TabsList>

        <TabsContent value="gerais" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Identificação Principal</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="md:col-span-2"><Label>Razão Social*</Label><Input value={c.razaoSocial || ""} onChange={e => handleChange("razaoSocial", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Nome Fantasia</Label><Input value={c.nomeFantasia || ""} onChange={e => handleChange("nomeFantasia", e.target.value)} /></div>
              <div><Label>CNPJ*</Label><Input value={c.cnpj || ""} onChange={e => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Inscrição Estadual (IE)</Label><Input value={c.ie || ""} onChange={e => handleChange("ie", e.target.value)} /></div>
              <div>
                <Label>Segmento</Label>
                <Select value={c.segmento || ""} onValueChange={v => handleChange("segmento", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="Varejo">Varejo</SelectItem><SelectItem value="Indústria">Indústria</SelectItem><SelectItem value="E-commerce">E-commerce</SelectItem><SelectItem value="Farmacêutico">Farmacêutico</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Porte</Label>
                <Select value={c.porte || ""} onValueChange={v => handleChange("porte", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="Pequeno">Pequeno</SelectItem><SelectItem value="Médio">Médio</SelectItem><SelectItem value="Grande">Grande</SelectItem><SelectItem value="Enterprise">Enterprise</SelectItem></SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Contatos e Comunicação</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><Label>Contato Principal</Label><Input value={c.contatoPrincipal || ""} onChange={e => handleChange("contatoPrincipal", e.target.value)} /></div>
              <div><Label>Telefone Fixo</Label><Input value={c.telefone || ""} onChange={e => handleChange("telefone", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input value={c.whatsapp || ""} onChange={e => handleChange("whatsapp", e.target.value)} /></div>
              <div><Label>E-mail Corporativo</Label><Input value={c.email || ""} onChange={e => handleChange("email", e.target.value)} /></div>
              <div><Label>Site Institucional</Label><Input value={c.site || ""} onChange={e => handleChange("site", e.target.value)} /></div>
              <div><Label>Origem Comercial</Label><Input value={c.origem_comercial || ""} onChange={e => handleChange("origem_comercial", e.target.value)} placeholder="Ex: Indicações, Prospecção" /></div>
              
              <div><Label>Resp. Operacional</Label><Input value={c.responsavelOperacional || ""} onChange={e => handleChange("responsavelOperacional", e.target.value)} /></div>
              <div><Label>Resp. Financeiro</Label><Input value={c.responsavelFinanceiro || ""} onChange={e => handleChange("responsavelFinanceiro", e.target.value)} /></div>
              <div><Label>Resp. Comercial</Label><Input value={c.responsavelComercial || ""} onChange={e => handleChange("responsavelComercial", e.target.value)} /></div>
              
              <div className="md:col-span-3"><Label>Observações Gerais</Label><Textarea value={c.observacoes || ""} onChange={e => handleChange("observacoes", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Parametrizações Operacionais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2"><Switch checked={!!c.exigeAgendamento} onCheckedChange={v => handleChange("exigeAgendamento", v)} /><Label>Exige Agendamento</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.exigeSla} onCheckedChange={v => handleChange("exigeSla", v)} /><Label>Exige SLA Específico</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.exigePortal} onCheckedChange={v => handleChange("exigePortal", v)} /><Label>Exige Portal do Cliente</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.aceitaApi} onCheckedChange={v => handleChange("aceitaApi", v)} /><Label>Aceita Integração API</Label></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enderecos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base text-primary">Múltiplos Endereços</CardTitle>
                <CardDescription>Gerencie matriz, filiais e pontos de coleta/entrega do cliente.</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setModalEnderecoOpen(true)}><Plus className="w-4 h-4" /> Adicionar Endereço</Button>
            </CardHeader>
            <CardContent>
              {enderecos.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-muted/10 border-dashed">
                  <MapPin className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
                  <p className="text-sm font-medium">Nenhum endereço cadastrado</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Clique no botão acima para adicionar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enderecos.map((end) => (
                    <div key={end.id} className="p-4 border rounded-lg flex justify-between items-start">
                      <div className="flex gap-3">
                        <MapPin className="w-5 h-5 text-muted-foreground mt-1" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{end.tipo_endereco}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{end.logradouro}, {end.numero}{end.complemento ? `, ${end.complemento}` : ""}</p>
                          <p className="text-sm text-muted-foreground">{end.bairro} - {end.cidade}/{end.uf}</p>
                          <p className="text-xs text-muted-foreground">{end.cep ? `CEP: ${end.cep}` : ""}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setEnderecos(enderecos.filter(e => e.id !== end.id))}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="estrutura">
          <div className="space-y-6">
            {/* Filiais */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-primary">Filiais do Cliente</CardTitle>
                  <CardDescription>Unidades, filiais e pontos de cobrança</CardDescription>
                </div>
                <Button size="sm" onClick={() => setModalFilialOpen(true)}><Plus className="w-4 h-4 mr-1"/> Nova Filial</Button>
              </CardHeader>
              <CardContent>
                {filiais.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                    Nenhuma filial cadastrada
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Endereço</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {filiais.map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.nome}</TableCell>
                          <TableCell>{f.endereco}</TableCell>
                          <TableCell>{f.responsavel}</TableCell>
                          <TableCell><Badge variant={f.status === 'ativo' ? 'default' : 'secondary'}>{f.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4"/></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Centros de Custo */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-primary">Centros de Custo</CardTitle>
                  <CardDescription>Códigos de custo por filial</CardDescription>
                </div>
                <Button size="sm" onClick={() => setModalCCOpen(true)}><Plus className="w-4 h-4 mr-1"/> Novo Centro de Custo</Button>
              </CardHeader>
              <CardContent>
                {centrosCusto.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                    Nenhum centro de custo cadastrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Nome</TableHead><TableHead>Filial</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {centrosCusto.map(cc => (
                        <TableRow key={cc.id}>
                          <TableCell className="font-mono">{cc.codigo}</TableCell>
                          <TableCell>{cc.nome}</TableCell>
                          <TableCell>{filiais.find(f => f.id === cc.filialId)?.nome || '-'}</TableCell>
                          <TableCell><Badge variant={cc.status === 'ativo' ? 'default' : 'secondary'}>{cc.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4"/></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Departamentos */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-primary">Departamentos</CardTitle>
                  <CardDescription>Áreas e responsáveis internos</CardDescription>
                </div>
                <Button size="sm" onClick={() => setModalDeptoOpen(true)}><Plus className="w-4 h-4 mr-1"/> Novo Departamento</Button>
              </CardHeader>
              <CardContent>
                {departamentos.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg border-dashed text-muted-foreground">
                    Nenhum departamento cadastrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Responsável</TableHead><TableHead>E-mail</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {departamentos.map(d => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.nome}</TableCell>
                          <TableCell>{d.responsavel}</TableCell>
                          <TableCell>{d.email}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="w-4 h-4"/></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comercial">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary">Condição Comercial e Tabelas</CardTitle>
              <CardDescription>Defina as preferências de faturamento e exigências da operação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><Label>Tipo de Cobrança Padrão</Label><Input placeholder="Ex: Quinzenal" /></div>
                <div><Label>Vencimento Padrão (dias)</Label><Input type="number" placeholder="Ex: 15" /></div>
                <div><Label>Agrupamento de Faturamento</Label><Input placeholder="Ex: Por CT-e" /></div>
              </div>
              
              <h4 className="font-semibold text-sm pt-4">Exigências Operacionais</h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg">
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">CT-e obrigatório</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">XML obrigatório</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">Comprovante obrigatório</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">Canhoto obrigatório</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">Assinatura legível</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">Protocolo obrigatório</Label></div>
                <div className="flex items-center gap-2"><Switch /><Label className="text-xs">Geolocalização</Label></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contratos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base text-primary">Contratos do Cliente</CardTitle>
                <CardDescription>Contratos comerciais vinculados</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled><Calendar className="w-4 h-4 mr-1"/> IA — em breve</Button>
                <Button size="sm" onClick={() => setModalContratoOpen(true)}><Plus className="w-4 h-4 mr-1"/> Novo Contrato</Button>
              </div>
            </CardHeader>
            <CardContent>
              {contratos.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-muted/10 border-dashed">
                  <Calendar className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
                  <p className="text-sm font-medium">Nenhum contrato ativo</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Contrato" para adicionar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {contratos.map(contrato => {
                    const hoje = new Date();
                    const fim = new Date(contrato.vigenciaFim);
                    const diasRestantes = Math.ceil((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                    const vencido = diasRestantes < 0;
                    const vencendo = diasRestantes >= 0 && diasRestantes <= 30;
                    
                    return (
                      <div key={contrato.id} className={`p-4 border rounded-lg ${vencido ? 'border-red-200 bg-red-50' : vencendo ? 'border-yellow-200 bg-yellow-50' : 'border-slate-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded flex items-center justify-center ${vencido ? 'bg-red-100' : vencendo ? 'bg-yellow-100' : 'bg-green-100'}`}>
                              <FileText className={`w-5 h-5 ${vencido ? 'text-red-600' : vencendo ? 'text-yellow-600' : 'text-green-600'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{contrato.numero}</p>
                                <Badge variant={contrato.status === 'ativo' ? 'default' : 'secondary'}>{contrato.status}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{contrato.tipo} - {contrato.objeto}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Vigência: {new Date(contrato.vigenciaInicio).toLocaleDateString('pt-BR')} até {new Date(contrato.vigenciaFim).toLocaleDateString('pt-BR')}
                              </p>
                              {vencido && <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Contrato vencido</p>}
                              {vencendo && !vencido && <p className="text-xs text-yellow-600 font-medium mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Vencendo em {diasRestantes} dias</p>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <p className="font-bold text-lg">R$ {contrato.valor.toLocaleString('pt-BR')}</p>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="w-4 h-4"/></Button>
                              {contrato.urlPdf && <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="w-4 h-4"/></Button>}
                              <Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="w-4 h-4"/></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>

      {/* Modal Nova Filial */}
      <Dialog open={modalFilialOpen} onOpenChange={setModalFilialOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nova Filial</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nome da Filial</Label><Input value={novaFilial.nome || ''} onChange={e => setNovaFilial({...novaFilial, nome: e.target.value})} /></div>
              <div><Label>Responsável</Label><Input value={novaFilial.responsavel || ''} onChange={e => setNovaFilial({...novaFilial, responsavel: e.target.value})} /></div>
              <div><Label>Telefone</Label><Input value={novaFilial.telefone || ''} onChange={e => setNovaFilial({...novaFilial, telefone: e.target.value})} /></div>
              <div><Label>Status</Label>
                <Select value={novaFilial.status || 'ativo'} onValueChange={v => setNovaFilial({...novaFilial, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Endereço</Label><Input value={novaFilial.endereco || ''} onChange={e => setNovaFilial({...novaFilial, endereco: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalFilialOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setFiliais([...filiais, { ...novaFilial, id: String(Date.now()) } as Filial]); setModalFilialOpen(false); toast.success("Filial adicionada!"); }}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Centro de Custo */}
      <Dialog open={modalCCOpen} onOpenChange={setModalCCOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Centro de Custo</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código</Label><Input value={novoCC.codigo || ''} onChange={e => setNovoCC({...novoCC, codigo: e.target.value})} /></div>
              <div><Label>Nome</Label><Input value={novoCC.nome || ''} onChange={e => setNovoCC({...novoCC, nome: e.target.value})} /></div>
              <div><Label>Filial</Label>
                <Select value={novoCC.filialId || ''} onValueChange={v => setNovoCC({...novoCC, filialId: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent>{filiais.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select value={novoCC.status || 'ativo'} onValueChange={v => setNovoCC({...novoCC, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalCCOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setCentrosCusto([...centrosCusto, { ...novoCC, id: String(Date.now()) } as CentroCusto]); setModalCCOpen(false); toast.success("Centro de custo adicionado!"); }}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Departamento */}
      <Dialog open={modalDeptoOpen} onOpenChange={setModalDeptoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Departamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Nome</Label><Input value={novoDepto.nome || ''} onChange={e => setNovoDepto({...novoDepto, nome: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Responsável</Label><Input value={novoDepto.responsavel || ''} onChange={e => setNovoDepto({...novoDepto, responsavel: e.target.value})} /></div>
              <div><Label>E-mail</Label><Input type="email" value={novoDepto.email || ''} onChange={e => setNovoDepto({...novoDepto, email: e.target.value})} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalDeptoOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setDepartamentos([...departamentos, { ...novoDepto, id: String(Date.now()) } as Departamento]); setModalDeptoOpen(false); toast.success("Departamento adicionado!"); }}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Contrato */}
      <Dialog open={modalContratoOpen} onOpenChange={setModalContratoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Contrato</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Número</Label><Input value={novoContrato.numero || ''} onChange={e => setNovoContrato({...novoContrato, numero: e.target.value})} /></div>
              <div><Label>Tipo</Label>
                <Select value={novoContrato.tipo || ''} onValueChange={v => setNovoContrato({...novoContrato, tipo: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Serviços">Serviços</SelectItem>
                    <SelectItem value="Frete">Frete</SelectItem>
                    <SelectItem value="Tarifação">Tarifação</SelectItem>
                    <SelectItem value="Mensalista">Mensalista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor (R$)</Label><Input type="number" value={novoContrato.valor || ''} onChange={e => setNovoContrato({...novoContrato, valor: Number(e.target.value)})} /></div>
            </div>
            <div><Label>Objeto</Label><Input value={novoContrato.objeto || ''} onChange={e => setNovoContrato({...novoContrato, objeto: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Vigência Início</Label><Input type="date" value={novoContrato.vigenciaInicio || ''} onChange={e => setNovoContrato({...novoContrato, vigenciaInicio: e.target.value})} /></div>
              <div><Label>Vigência Fim</Label><Input type="date" value={novoContrato.vigenciaFim || ''} onChange={e => setNovoContrato({...novoContrato, vigenciaFim: e.target.value})} /></div>
            </div>
            <div><Label>Status</Label>
              <Select value={novoContrato.status || 'ativo'} onValueChange={v => setNovoContrato({...novoContrato, status: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="renovacao">Em renovação</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalContratoOpen(false)}>Cancelar</Button>
            <Button onClick={() => { setContratos([...contratos, { ...novoContrato, id: String(Date.now()) } as Contrato]); setModalContratoOpen(false); toast.success("Contrato adicionado!"); }}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Endereço */}
      <Dialog open={modalEnderecoOpen} onOpenChange={setModalEnderecoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo Endereço</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Endereço</Label>
                <Select value={novoEndereco.tipo_endereco} onValueChange={v => setNovoEndereco({...novoEndereco, tipo_endereco: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                  <SelectContent><SelectItem value="Matriz">Matriz</SelectItem><SelectItem value="Filial">Filial</SelectItem><SelectItem value="Cobraça">Cobrança</SelectItem><SelectItem value="Entrega">Entrega</SelectItem><SelectItem value="Coleta">Coleta</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>CEP</Label>
                  <div className="relative">
                    <Input 
                      value={novoEndereco.cep} 
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '');
                        const formatted = v.length > 5 ? v.replace(/^(\d{5})(\d)/, '$1-$2') : v;
                        setNovoEndereco({...novoEndereco, cep: formatted});
                      }}
                      onBlur={handleCEPBlur}
                      placeholder="00000-000" 
                      maxLength={9}
                      className={cepLoading ? "pr-8" : ""}
                    />
                    {cepLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                </div>
            </div>
            <div><Label>Logradouro</Label><Input value={novoEndereco.logradouro} onChange={e => setNovoEndereco({...novoEndereco, logradouro: e.target.value})} placeholder="Rua, Av., etc." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Número</Label><Input value={novoEndereco.numero} onChange={e => setNovoEndereco({...novoEndereco, numero: e.target.value})} /></div>
              <div><Label>Complemento</Label><Input value={novoEndereco.complemento} onChange={e => setNovoEndereco({...novoEndereco, complemento: e.target.value})} placeholder="Sala, Andar, etc." /></div>
            </div>
            <div><Label>Bairro</Label><Input value={novoEndereco.bairro} onChange={e => setNovoEndereco({...novoEndereco, bairro: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Cidade</Label><Input value={novoEndereco.cidade} onChange={e => setNovoEndereco({...novoEndereco, cidade: e.target.value})} /></div>
              <div>
                <Label>UF</Label>
                <Select value={novoEndereco.uf} onValueChange={v => setNovoEndereco({...novoEndereco, uf: v})}>
                  <SelectTrigger><SelectValue placeholder="UF"/></SelectTrigger>
                  <SelectContent><SelectItem value="AC">AC</SelectItem><SelectItem value="AL">AL</SelectItem><SelectItem value="AP">AP</SelectItem><SelectItem value="AM">AM</SelectItem><SelectItem value="BA">BA</SelectItem><SelectItem value="CE">CE</SelectItem><SelectItem value="DF">DF</SelectItem><SelectItem value="ES">ES</SelectItem><SelectItem value="GO">GO</SelectItem><SelectItem value="MA">MA</SelectItem><SelectItem value="MT">MT</SelectItem><SelectItem value="MS">MS</SelectItem><SelectItem value="MG">MG</SelectItem><SelectItem value="PA">PA</SelectItem><SelectItem value="PB">PB</SelectItem><SelectItem value="PR">PR</SelectItem><SelectItem value="PE">PE</SelectItem><SelectItem value="PI">PI</SelectItem><SelectItem value="RJ">RJ</SelectItem><SelectItem value="RN">RN</SelectItem><SelectItem value="RS">RS</SelectItem><SelectItem value="RO">RO</SelectItem><SelectItem value="RR">RR</SelectItem><SelectItem value="SC">SC</SelectItem><SelectItem value="SP">SP</SelectItem><SelectItem value="SE">SE</SelectItem><SelectItem value="TO">TO</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalEnderecoOpen(false)}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                const payload = {
                  cliente_id: clienteId,
                  tipo_endereco: novoEndereco.tipo_endereco,
                  cep: novoEndereco.cep,
                  logradouro: novoEndereco.logradouro,
                  numero: novoEndereco.numero,
                  complemento: novoEndereco.complemento,
                  bairro: novoEndereco.bairro,
                  cidade: novoEndereco.cidade,
                  uf: novoEndereco.uf
                };
                const { data, error } = await supabase.from("enderecos_clientes").insert([payload]).select();
                if (error) throw error;
                toast.success("Endereço adicionado!");
                setModalEnderecoOpen(false);
                setNovoEndereco({tipo_endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: ""});
                fetchEnderecos();
              } catch (error: any) {
                toast.error("Erro ao salvar endereço: " + error.message);
              }
            }}>Salvar Endereço</Button>
          </div>
        </DialogContent>
      </Dialog>

      </div>
  );
};

export default ClienteDetalhe;
