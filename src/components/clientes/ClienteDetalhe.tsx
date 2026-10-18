import { useState, useEffect } from "react";
import { ArrowLeft, Plus, CheckCircle, Save, Calendar, Copy, MapPin, Trash2, Edit, AlertTriangle, FileText, Download, Eye, Loader2, Upload, Paperclip } from "lucide-react";
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
import { paraInputDate } from "@/lib/formatDates";
import { useAuth } from "@/contexts/AuthContext";
import { useFormExitGuard } from "@/hooks/useFormExitGuard";

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
  observacoes?: string;
  anexoUrl?: string;
  anexoNome?: string;
}

interface Props {
  clienteId?: string;
  onBack: () => void;
}

const dataLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const defaultCliente: Partial<Cliente> = {
  status: "Ativo",
  dataCadastro: dataLocalISO(),
  exigeAgendamento: false,
  exigeSla: false,
  exigePortal: false,
  aceitaApi: false,
};

const ClienteDetalhe = ({ clienteId, onBack }: Props) => {
  const { user } = useAuth();
  const isNew = !clienteId;
  const [c, setC] = useState<Partial<Cliente>>(defaultCliente);
  const [baselineC, setBaselineC] = useState<Partial<Cliente>>(defaultCliente);
  const exitGuard = useFormExitGuard({ current: c, initial: baselineC });
  const handleExit = async () => {
    if (await exitGuard.confirmExit()) onBack();
  };
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
  const [novoEndereco, setNovoEndereco] = useState<{
    tipo_endereco: string; cep: string; logradouro: string; numero: string;
    complemento: string; bairro: string; cidade: string; uf: string;
    nome_local?: string; referencia?: string; contato_local?: string;
    telefone_local?: string; instrucoes?: string; janela_inicio?: string;
    janela_fim?: string; restricoes?: string; portaria?: string; doca?: string;
  }>({tipo_endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: ""});
  const [cepLoading, setCepLoading] = useState(false);
  const [listaTabelasValores, setListaTabelasValores] = useState<{id: string; nome: string; tipo_veiculo: string}[]>([]);

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

  

  useEffect(() => {
    if (clienteId) {
      fetchCliente();
      fetchEnderecos();
      fetchContratos();
    }
    fetchTabelasValores();
  }, [clienteId]);

  const fetchTabelasValores = async () => {
    try {
      const { data, error } = await supabase
        .from("tabelas_valores")
        .select("id, nome, tipo_veiculo")
        .order("nome", { ascending: true });
      if (!error && data) {
        setListaTabelasValores(data.map((item: any) => ({ id: item.id, nome: item.nome, tipo_veiculo: item.tipo_veiculo })));
      }
    } catch (e) {
      console.warn("Erro ao carregar tabelas de valores:", e);
    }
  };

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
        const loaded = fromClienteRow(data as ClienteRow) as Partial<Cliente>;
        // data_cadastro ainda é nulo em clientes antigos → origem = created_at
        if (!loaded.dataCadastro && data.created_at) {
          loaded.dataCadastro = paraInputDate(data.created_at) || null;
        }
        setC(loaded);
        setBaselineC(loaded);
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

  const fetchContratos = async () => {
    if (!clienteId) return;
    try {
      const { data, error } = await supabase
        .from("clientes_contratos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      if (error) {
        console.warn("[fetchContratos] Tabela clientes_contratos indisponível:", error.message);
        return;
      }
      setContratos((data || []).map((row: any) => ({
        id: row.id,
        numero: row.numero || "",
        tipo: row.tipo || "",
        objeto: row.objeto || "",
        vigenciaInicio: row.vigencia_inicio || "",
        vigenciaFim: row.vigencia_fim || "",
        valor: Number(row.valor) || 0,
        status: row.status || "ativo",
        urlPdf: row.anexo_url,
        observacoes: row.observacoes,
        anexoUrl: row.anexo_url,
        anexoNome: row.anexo_nome,
      })));
    } catch (error: any) {
      console.error("[fetchContratos] Erro:", error.message);
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
    if (isSaving) return;

    try {
      setIsSaving(true);
      const isUpdate = !!c.id;
      let formData = { ...c };

      if (!isUpdate && !formData.tenantId) {
        const { data: tenantData } = await supabase.rpc('current_tenant_id_safe');
        if (tenantData) formData.tenantId = tenantData;
      }

      const TABLE_NAME = "clientes";
      const payload = isUpdate ? toClienteUpdate(formData) : toClienteInsert(formData);

      let result;
      if (isUpdate) {
        result = await supabase.from(TABLE_NAME).update(payload).eq("id", c.id).select();
      } else {
        result = await supabase.from(TABLE_NAME).insert([payload]).select();
      }

      const { data, error } = result;
      if (error) {
        toast.error(`Falha no banco: ${error.message}`);
        return;
      }

      const savedCliente = data?.[0];
      if (!savedCliente) {
        toast.error("Erro: resposta vazia do Supabase");
        return;
      }

      if (isNew && savedCliente.id) {
        const tempEnds = enderecos.filter((e: any) => e._temp);
        if (tempEnds.length > 0) {
          const endPayload = tempEnds.map((e: any) => ({
            cliente_id: savedCliente.id,
            tipo_endereco: e.tipo_endereco || null,
            cep: e.cep || null,
            logradouro: e.logradouro || null,
            numero: e.numero || null,
            complemento: e.complemento || null,
            bairro: e.bairro || null,
            cidade: e.cidade || null,
            uf: e.uf || null,
          }));
          const { error: endErr } = await supabase.from("enderecos_clientes").insert(endPayload);
          if (endErr) console.error("Erro ao persistir endereços:", endErr.message);
        }
      }

      toast.success(isNew ? "Cliente cadastrado com sucesso!" : "Cliente atualizado com sucesso!");
      exitGuard.markClean();
      onBack();
    } catch (error: any) {
      toast.error("Erro ao persistir cliente no Supabase.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-10 text-center animate-pulse">Carregando dados do cliente...</div>;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleExit}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{isNew ? "Novo Cliente" : c.razaoSocial || "Detalhes do Cliente"}</h2>
            <p className="text-sm text-muted-foreground">{c.cnpj ? `CNPJ: ${c.cnpj}` : 'Preencha os dados abaixo'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExit}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="w-4 h-4" /> {isSaving ? "Salvando..." : "Salvar Cliente"}
          </Button>
        </div>
      </div>

      {/* Abas */}
      <Tabs defaultValue="gerais" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 bg-muted/60 mb-6 h-auto p-1">
          <TabsTrigger value="gerais" className="py-2.5">Dados Gerais</TabsTrigger>
          <TabsTrigger value="enderecos" className="py-2.5">Endereços</TabsTrigger>
          <TabsTrigger value="estrutura" className="py-2.5">Estrutura</TabsTrigger>
          <TabsTrigger value="comercial" className="py-2.5">Comercial</TabsTrigger>
          <TabsTrigger value="fiscal" className="py-2.5">Fiscal</TabsTrigger>
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
              <div>
                <Label>Data de Cadastro</Label>
                <Input type="date" value={paraInputDate(c.dataCadastro)} onChange={e => handleChange("dataCadastro", e.target.value)} />
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
              <div><Label>Origem Comercial</Label><Input value={c.origemComercial || ""} onChange={e => handleChange("origemComercial", e.target.value)} placeholder="Ex: Indicações, Prospecção" /></div>
              
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
              <CardTitle className="text-base text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Condição Comercial e Tabelas
              </CardTitle>
              <CardDescription>Defina as preferências de faturamento, exigências operacionais e vincule a tabela de valores.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tipo de Cobrança Padrão</Label>
                  <Select value={c.tipoCobranca || ""} onValueChange={v => handleChange("tipoCobranca", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="por_cte">Por CT-e</SelectItem>
                      <SelectItem value="por_os">Por OS</SelectItem>
                      <SelectItem value="avulso">Avulso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Vencimento Padrão (dias)</Label>
                  <Input type="number" value={c.vencimentoPadrao ?? ""} onChange={e => handleChange("vencimentoPadrao", Number(e.target.value))} placeholder="Ex: 15" />
                </div>
                <div>
                  <Label>Agrupamento de Faturamento</Label>
                  <Select value={c.agrupamentoFaturamento || ""} onValueChange={v => handleChange("agrupamentoFaturamento", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="por_cte">Por CT-e</SelectItem>
                      <SelectItem value="por_os">Por OS</SelectItem>
                      <SelectItem value="por_periodo">Por Período</SelectItem>
                      <SelectItem value="por_romaneio">Por Romaneio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Exigências Operacionais
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.cteObrigatorio} onCheckedChange={v => handleChange("cteObrigatorio", v)} />
                    <Label className="text-xs">CT-e obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.xmlObrigatorio} onCheckedChange={v => handleChange("xmlObrigatorio", v)} />
                    <Label className="text-xs">XML obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.comprovanteObrigatorio} onCheckedChange={v => handleChange("comprovanteObrigatorio", v)} />
                    <Label className="text-xs">Comprovante obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.canhotoObrigatorio} onCheckedChange={v => handleChange("canhotoObrigatorio", v)} />
                    <Label className="text-xs">Canhoto obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.assinaturaLegivel} onCheckedChange={v => handleChange("assinaturaLegivel", v)} />
                    <Label className="text-xs">Assinatura legível</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.protocoloObrigatorio} onCheckedChange={v => handleChange("protocoloObrigatorio", v)} />
                    <Label className="text-xs">Protocolo obrigatório</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.geolocalizacao} onCheckedChange={v => handleChange("geolocalizacao", v)} />
                    <Label className="text-xs">Geolocalização</Label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Tabela de Valores Vinculada
                </h4>
                <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                  <Label className="text-xs mb-2 block">Tabela de Valores Padrão</Label>
                  <Select value={c.tabelaValoresPadraoId || "__none__"} onValueChange={v => handleChange("tabelaValoresPadraoId", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecione a tabela de valores padrão deste cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma (definir por veículo na tabela comercial)</SelectItem>
                      {listaTabelasValores.filter(t => t.id !== c.tabelaValoresPadraoId || !c.tabelaValoresPadraoId).map(tv => (
                        <SelectItem key={tv.id} value={tv.id}>
                          {tv.nome} ({tv.tipo_veiculo || "geral"})
                        </SelectItem>
                      ))}
                      {c.tabelaValoresPadraoId && listaTabelasValores.filter(t => t.id === c.tabelaValoresPadraoId).map(tv => (
                        <SelectItem key={tv.id} value={tv.id}>
                          {tv.nome} ({tv.tipo_veiculo || "geral"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    A tabela de valores completa por veículo é configurada na aba "Comercial › Tabela de Valores".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fiscal">
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Configuração Fiscal
              </CardTitle>
              <CardDescription>Defina as regras fiscais, tributos e preferências de emissão para este cliente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tomador Padrão</Label>
                  <Select value={c.tomador || ""} onValueChange={v => handleChange("tomador", v)}>
                    <SelectTrigger><SelectValue placeholder="Tipo de tomador" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proprio">Próprio (remetente)</SelectItem>
                      <SelectItem value="terceiro">Terceiro (por conta de)</SelectItem>
                      <SelectItem value="destinatario">Destinatário</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>CNAE</Label>
                  <Input value={c.cnae || ""} onChange={e => handleChange("cnae", e.target.value)} placeholder="Ex: 4930-2/01" />
                </div>
                <div>
                  <Label>CFOP Padrão</Label>
                  <Select value={c.cfopPadrao || ""} onValueChange={v => handleChange("cfopPadrao", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o CFOP" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5101">5101 - Venda produção estabelecimento</SelectItem>
                      <SelectItem value="5102">5102 - Venda mercadoria adquirida</SelectItem>
                      <SelectItem value="5351">5351 - Transporte interestadual</SelectItem>
                      <SelectItem value="5352">5352 - Transporte intermunicipal</SelectItem>
                      <SelectItem value="5353">5353 - Transporte municipal</SelectItem>
                      <SelectItem value="5354">5354 - Transporte redespacho</SelectItem>
                      <SelectItem value="5355">5355 - Transporte sub-contratação</SelectItem>
                      <SelectItem value="5932">5932 - Prestação serviço comunicação</SelectItem>
                      <SelectItem value="6949">6949 - Outras saídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Regime Tributário</Label>
                  <Select value={c.regimeTributario || ""} onValueChange={v => handleChange("regimeTributario", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Simples Nacional</SelectItem>
                      <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                      <SelectItem value="lucro_real">Lucro Real</SelectItem>
                      <SelectItem value="mei">MEI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input type="number" value={c.aliquotaIss ?? ""} onChange={e => handleChange("aliquotaIss", Number(e.target.value))} placeholder="Ex: 2.0" step="0.1" />
                </div>
                <div>
                  <Label>Município Padrão (IBGE)</Label>
                  <Input value={c.municipioPadrao || ""} onChange={e => handleChange("municipioPadrao", e.target.value)} placeholder="Ex: 3550308 - São Paulo" />
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Retenções e Impostos
                </h4>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                  <div>
                    <Label>Regras de Retenção</Label>
                    <Select value={c.retencoes || ""} onValueChange={v => handleChange("retencoes", v)}>
                      <SelectTrigger><SelectValue placeholder="Tipo de retenção" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">Nenhuma</SelectItem>
                        <SelectItem value="iss_retido">ISS Retido na Fonte</SelectItem>
                        <SelectItem value="pis_cofins_csll">PIS/COFINS/CSLL Retido</SelectItem>
                        <SelectItem value="inss">INSS Retido</SelectItem>
                        <SelectItem value="completa">Retenção Completa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.incentivoFiscal} onCheckedChange={v => handleChange("incentivoFiscal", v)} />
                    <Label className="text-sm">Possui incentivo fiscal</Label>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Envio de Documentos
                </h4>
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!c.envioXml} onCheckedChange={v => handleChange("envioXml", v)} />
                    <Label className="text-sm">Envio automático de XML/NFe por e-mail</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 ml-8">
                    Quando ativado, o sistema enviará os XMLs de CT-e e NF-e automaticamente para o e-mail do cliente.
                  </p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold text-sm mb-3">Observações Fiscais</h4>
                <Textarea
                  value={c.observacoesFiscais || ""}
                  onChange={e => handleChange("observacoesFiscais", e.target.value)}
                  rows={3}
                  placeholder="Informações adicionais para emissão fiscal, CFRC, observações no CT-e..."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block mb-1">Integração Fiscal</strong>
                  <p>Os campos fiscais estão preparados para integração futura com o módulo Focus NFe. 
                  No momento, os dados são apenas informativos e não realizam emissão automática.</p>
                </div>
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
            <div><Label>Observações</Label><Textarea value={novoContrato.observacoes || ''} onChange={e => setNovoContrato({...novoContrato, observacoes: e.target.value})} rows={2} placeholder="Informações adicionais..." /></div>
            <div>
              <Label className="flex items-center gap-2 mb-2"><Paperclip className="w-4 h-4" /> Anexo do Contrato</Label>
              <div
                className="border-2 border-dashed border-muted rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('contrato-file-input')?.click()}
              >
                {novoContrato.anexoNome ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">{novoContrato.anexoNome}</span>
                    <button onClick={e => { e.stopPropagation(); setNovoContrato({...novoContrato, anexoNome: undefined, anexoUrl: undefined}); }} className="text-destructive ml-2">✕</button>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs">Clique para selecionar PDF ou documento do contrato</p>
                  </div>
                )}
              </div>
              <input id="contrato-file-input" type="file" accept=".pdf,.doc,.docx" className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setNovoContrato({...novoContrato, anexoNome: f.name, anexoUrl: URL.createObjectURL(f)});
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setModalContratoOpen(false); setNovoContrato({}); }}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                if (clienteId) {
                  const payload: Record<string, unknown> = {
                    cliente_id: clienteId,
                    numero: novoContrato.numero || null,
                    tipo: novoContrato.tipo || null,
                    valor: novoContrato.valor || 0,
                    objeto: novoContrato.objeto || null,
                    vigencia_inicio: novoContrato.vigenciaInicio || null,
                    vigencia_fim: novoContrato.vigenciaFim || null,
                    status: novoContrato.status || 'ativo',
                    observacoes: novoContrato.observacoes || null,
                    anexo_nome: novoContrato.anexoNome || null,
                  };
                  const { data: saved, error } = await supabase.from("clientes_contratos").insert([payload]).select();
                  if (error) throw error;
                  const row = saved?.[0];
                  setContratos([...contratos, {
                    id: row?.id || String(Date.now()),
                    numero: row?.numero || novoContrato.numero || '',
                    tipo: row?.tipo || novoContrato.tipo || '',
                    objeto: row?.objeto || novoContrato.objeto || '',
                    vigenciaInicio: row?.vigencia_inicio || novoContrato.vigenciaInicio || '',
                    vigenciaFim: row?.vigencia_fim || novoContrato.vigenciaFim || '',
                    valor: Number(row?.valor) || novoContrato.valor || 0,
                    status: row?.status || novoContrato.status || 'ativo',
                    observacoes: novoContrato.observacoes,
                    anexoNome: novoContrato.anexoNome,
                  }]);
                } else {
                  setContratos([...contratos, { ...novoContrato, id: String(Date.now()) } as Contrato]);
                }
                setModalContratoOpen(false);
                setNovoContrato({});
                toast.success("Contrato adicionado!");
              } catch (err: any) {
                toast.error("Erro ao salvar contrato: " + err.message);
              }
            }}>Salvar Contrato</Button>
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
            <div>
              <Label className="text-xs text-muted-foreground">Nome do Local</Label>
              <Input value={novoEndereco.nome_local || ""} onChange={e => setNovoEndereco({...novoEndereco, nome_local: e.target.value})} placeholder="CD, Filial, Depósito..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Contato no Local</Label>
                <Input value={novoEndereco.contato_local || ""} onChange={e => setNovoEndereco({...novoEndereco, contato_local: e.target.value})} placeholder="Nome do contato" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefone do Local</Label>
                <Input value={novoEndereco.telefone_local || ""} onChange={e => setNovoEndereco({...novoEndereco, telefone_local: e.target.value})} placeholder="(11) 99999-0000" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Referência</Label>
              <Input value={novoEndereco.referencia || ""} onChange={e => setNovoEndereco({...novoEndereco, referencia: e.target.value})} placeholder="Próximo a..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Instruções / Observações</Label>
              <Textarea value={novoEndereco.instrucoes || ""} onChange={e => setNovoEndereco({...novoEndereco, instrucoes: e.target.value})} rows={2} placeholder="Instruções para acesso ao local..." />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setModalEnderecoOpen(false);
              setNovoEndereco({tipo_endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: ""});
            }}>Cancelar</Button>
            <Button onClick={async () => {
              try {
                if (!clienteId) {
                  setEnderecos(prev => [...prev, {
                    id: `temp_${Date.now()}`,
                    tipo_endereco: novoEndereco.tipo_endereco,
                    cep: novoEndereco.cep,
                    logradouro: novoEndereco.logradouro,
                    numero: novoEndereco.numero,
                    complemento: novoEndereco.complemento,
                    bairro: novoEndereco.bairro,
                    cidade: novoEndereco.cidade,
                    uf: novoEndereco.uf,
                    _temp: true,
                  } as any]);
                  setModalEnderecoOpen(false);
                  setNovoEndereco({tipo_endereco: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: ""});
                  toast.success("Endereço adicionado! Será vinculado ao salvar o cliente.");
                  return;
                }
                const payload: Record<string, any> = {
                  cliente_id: clienteId,
                  tipo_endereco: novoEndereco.tipo_endereco,
                  cep: novoEndereco.cep,
                  logradouro: novoEndereco.logradouro,
                  numero: novoEndereco.numero,
                  complemento: novoEndereco.complemento || null,
                  bairro: novoEndereco.bairro,
                  cidade: novoEndereco.cidade,
                  uf: novoEndereco.uf,
                };
                if (novoEndereco.nome_local) payload.nome_local = novoEndereco.nome_local;
                if (novoEndereco.referencia) payload.referencia = novoEndereco.referencia;
                if (novoEndereco.contato_local) payload.contato_local = novoEndereco.contato_local;
                if (novoEndereco.telefone_local) payload.telefone_local = novoEndereco.telefone_local;
                if (novoEndereco.instrucoes) payload.instrucoes = novoEndereco.instrucoes;
                const { error } = await supabase.from("enderecos_clientes").insert([payload]);
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
