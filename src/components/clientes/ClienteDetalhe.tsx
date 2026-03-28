import { useState, useEffect } from "react";
import { ArrowLeft, Plus, CheckCircle, Save, Calendar, Copy, MapPin, Trash2, Edit, AlertTriangle, FileText, Download, Eye } from "lucide-react";
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
  exige_agendamento: false,
  exige_sla: false,
  exige_portal: false,
  aceita_api: false,
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

  useEffect(() => {
    if (clienteId) {
      fetchCliente();
    }
  }, [clienteId]);

  const fetchCliente = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("clientes").select("*").eq("id", clienteId).single();
      if (error) throw error;
      if (data) {
        setC(data as Partial<Cliente>);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar detalhes do cliente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof Cliente, value: any) => {
    setC(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!c.razao_social || !c.cnpj) {
      toast.error("Razão Social e CNPJ são obrigatórios");
      return;
    }

    try {
      setIsSaving(true);
      const isUpdate = !!c.id;
      const dataToSave = { ...c };
      
      let query;
      if (isUpdate) {
        query = supabase.from("clientes").update(dataToSave).eq("id", c.id);
      } else {
        query = supabase.from("clientes").insert([dataToSave]);
      }

      const { error } = await query;
      
      if (error) throw error;
      
      toast.success(isNew ? "Cliente cadastrado com sucesso!" : "Cliente atualizado com sucesso!");
      onBack();
    } catch (error) {
      console.error(error);
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
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h2 className="text-2xl font-bold">{isNew ? "Novo Cliente" : c.razao_social || "Detalhes do Cliente"}</h2>
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
              <div className="md:col-span-2"><Label>Razão Social*</Label><Input value={c.razao_social || ""} onChange={e => handleChange("razao_social", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Nome Fantasia</Label><Input value={c.nome_fantasia || ""} onChange={e => handleChange("nome_fantasia", e.target.value)} /></div>
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
              <div><Label>Contato Principal</Label><Input value={c.contato_principal || ""} onChange={e => handleChange("contato_principal", e.target.value)} /></div>
              <div><Label>Telefone Fixo</Label><Input value={c.telefone || ""} onChange={e => handleChange("telefone", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input value={c.whatsapp || ""} onChange={e => handleChange("whatsapp", e.target.value)} /></div>
              <div><Label>E-mail Corporativo</Label><Input value={c.email || ""} onChange={e => handleChange("email", e.target.value)} /></div>
              <div><Label>Site Institucional</Label><Input value={c.site || ""} onChange={e => handleChange("site", e.target.value)} /></div>
              <div><Label>Origem Comercial</Label><Input value={c.origem_comercial || ""} onChange={e => handleChange("origem_comercial", e.target.value)} placeholder="Ex: Indicações, Prospecção" /></div>
              
              <div><Label>Resp. Operacional</Label><Input value={c.responsavel_operacional || ""} onChange={e => handleChange("responsavel_operacional", e.target.value)} /></div>
              <div><Label>Resp. Financeiro</Label><Input value={c.responsavel_financeiro || ""} onChange={e => handleChange("responsavel_financeiro", e.target.value)} /></div>
              <div><Label>Resp. Comercial</Label><Input value={c.responsavel_comercial || ""} onChange={e => handleChange("responsavel_comercial", e.target.value)} /></div>
              
              <div className="md:col-span-3"><Label>Observações Gerais</Label><Textarea value={c.observacoes || ""} onChange={e => handleChange("observacoes", e.target.value)} rows={3} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base text-primary">Parametrizações Operacionais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-muted/30 rounded-lg">
              <div className="flex items-center space-x-2"><Switch checked={!!c.exige_agendamento} onCheckedChange={v => handleChange("exige_agendamento", v)} /><Label>Exige Agendamento</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.exige_sla} onCheckedChange={v => handleChange("exige_sla", v)} /><Label>Exige SLA Específico</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.exige_portal} onCheckedChange={v => handleChange("exige_portal", v)} /><Label>Exige Portal do Cliente</Label></div>
              <div className="flex items-center space-x-2"><Switch checked={!!c.aceita_api} onCheckedChange={v => handleChange("aceita_api", v)} /><Label>Aceita Integração API</Label></div>
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
              <Button size="sm" variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Adicionar Endereço</Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-10 border rounded-lg bg-muted/10 border-dashed">
                <MapPin className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
                <p className="text-sm font-medium">Nenhum endereço cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Aperte o botão acima para inserir filiais ou locais de cobrança</p>
              </div>
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
    </div>
  );
};

export default ClienteDetalhe;
