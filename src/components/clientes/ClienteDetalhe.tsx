import { useState, useEffect } from "react";
import { ArrowLeft, Plus, CheckCircle, Save, Calendar, Copy, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Cliente } from "./types";

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
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-primary">Estrutura do Cliente</CardTitle>
              <CardDescription>Gestão hierárquica e controle departamental</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground py-10 text-center border rounded-lg border-dashed">
              [Módulo de Filiais, Unidades e Departamentos em desenvolvimento]
            </CardContent>
          </Card>
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
            <CardHeader>
              <CardTitle className="text-base text-primary">Contratos e Histórico Comercial</CardTitle>
              <CardDescription>Acompanhe os contratos vigentes vinculados a este cliente</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="text-center py-10 border rounded-lg bg-muted/10 border-dashed">
                <Calendar className="w-8 h-8 mx-auto text-muted-foreground opacity-50 mb-3" />
                <p className="text-sm font-medium">Nenhum contrato ativo</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Você poderá vincular contratos do módulo Jurídico aqui.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
      </Tabs>
    </div>
  );
};

export default ClienteDetalhe;
