import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSignature, Plus, FileText, Download, Settings, Eye, Trash, Save, X, Loader2, Search, Filter } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { buscarContratos, buscarModelosContratos, criarModeloContrato, atualizarModeloContrato, excluirModeloContrato, excluirContrato, type ContratoGerado, type ContratoModelo, type BuscarContratosFiltros } from "@/services/contratosService";

interface ModeloLocal {
  id: string;
  nome: string;
  tipo: string;
  conteudo: string;
  isDefault: boolean;
  createdAt: string;
}

const VARIAVEIS = [
  { categoria: "EMPRESA", vars: ["empresa_nome", "empresa_cnpj", "empresa_endereco"] },
  { categoria: "PRESTADOR", vars: ["prestador_nome", "prestador_cpf", "prestador_cnpj", "prestador_telefone", "prestador_whatsapp", "prestador_email", "prestador_pix", "prestador_banco", "prestador_rua", "prestador_numero", "prestador_bairro", "prestador_cidade", "prestador_estado", "prestador_cep", "prestador_endereco"] },
  { categoria: "VEÍCULO", vars: ["veiculo_tipo", "veiculo_placa", "veiculo_modelo", "veiculo_tipo_carga"] },
  { categoria: "VALORES", vars: ["valor_saida", "pagamento_prazo"] },
  { categoria: "DADOS", vars: ["data_atual", "numero_contrato", "hash_documento"] },
  { categoria: "CLIENTE", vars: ["cliente_nome", "cliente_cnpj", "cliente_endereco"] },
];

export default function Contratos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "modelos";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [modelos, setModelos] = useState<ContratoModelo[]>([]);
  const [contratosGerados, setContratosGerados] = useState<ContratoGerado[]>([]);
  const [modeloEditando, setModeloEditando] = useState<ContratoModelo | null>(null);
  const [showNovoModelo, setShowNovoModelo] = useState(false);
  const [novoModelo, setNovoModelo] = useState({ nome: "", tipo: "TAC", conteudo_base: "" });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState("");
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingGerados, setLoadingGerados] = useState(false);
  const [savingModelo, setSavingModelo] = useState(false);
  const [configs, setConfigs] = useState({ obrigatorio: true, layoutAutomatico: true, salvamentoAutomatico: true });
  const [filtros, setFiltros] = useState<BuscarContratosFiltros>({});
  const [contratoVisualizar, setContratoVisualizar] = useState<ContratoGerado | null>(null);
  const [contratoExcluir, setContratoExcluir] = useState<ContratoGerado | null>(null);
  const [excluindoContrato, setExcluindoContrato] = useState(false);

  useEffect(() => {
    const storedConfigs = localStorage.getItem('contratos_configs');
    if (storedConfigs) {
      try { setConfigs(JSON.parse(storedConfigs)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (currentTab === 'modelos') carregarModelos();
    if (currentTab === 'gerados') carregarContratosGerados();
  }, [currentTab]);

  const carregarModelos = async () => {
    setLoadingModelos(true);
    try {
      const modelosDb = await buscarModelosContratos();
      setModelos(modelosDb);
    } catch (e) {
      console.error('[Contratos] Erro ao carregar modelos:', e);
      toast.error("Erro ao carregar modelos do banco de dados.");
    } finally {
      setLoadingModelos(false);
    }
  };

  const carregarContratosGerados = async () => {
    setLoadingGerados(true);
    try {
      const contratos = await buscarContratos(filtros);
      setContratosGerados(contratos);
    } catch (e) {
      console.error('[Contratos] Erro ao carregar contratos:', e);
      toast.error("Erro ao carregar contratos do banco de dados.");
    } finally {
      setLoadingGerados(false);
    }
  };

  const handleNovoModelo = async () => {
    if (!novoModelo.nome.trim()) {
      toast.error("Informe o nome do modelo.");
      return;
    }
    setSavingModelo(true);
    try {
      const modeloPadrao = `CONTRATO DE TRANSPORTE AUTÔNOMO DE CARGA - ${novoModelo.tipo}

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}
ENDEREÇO: {{empresa_endereco}}

CONTRATADO: {{prestador_nome}}
DOCUMENTO: {{prestador_cpf}}
TELEFONE: {{prestador_telefone}}
ENDEREÇO: {{prestador_endereco}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

CLÁUSULA 1ª - DO OBJETO
O presente contrato tem como objeto a prestação de serviços de transporte de cargas pelo Contratado, utilizando veículo próprio, em regime de execução autônoma.

CLÁUSULA 2ª - DAS OBRIGAÇÕES DO CONTRATADO
2.1 - Realizar o transporte com diligence e segurança, zelando pela integridade da carga.
2.2 - Manter o veículo em perfeito estado de conservação e com documentação regular.
2.3 - Responsabilizar-se civil e criminalmente pela carga transportada.

CLÁUSULA 3ª - DO VALOR E PAGAMENTO
3.1 - O valor por viagem/saída é de {{valor_saida}}.
3.2 - O pagamento será efetuado em até {{pagamento_prazo}} dias após a conclusão do serviço.

CLÁUSULA 4ª - DO VÍNCULO
4.1 - O presente contrato não gera vínculo empregatício entre as partes.

CLÁUSULA 5ª - DO FORO
5.1 - Fica eleito o foro da Comarca de São Caetano do Sul/SP.

CLÁUSULA 6ª - DO ACEITE ELETRÔNICO
6.1 - O aceite deste contrato via WhatsApp ou assinatura eletrônica tem valor jurídico equivalente à assinatura física, conforme MP 2.200-2/2001 e Lei 11.419/2006.

DATA: {{data_atual}}
NÚMERO: {{numero_contrato}}

_______________________________________
{{empresa_nome}}
CNPJ: {{empresa_cnpj}}

_______________________________________
{{prestador_nome}}
DOCUMENTO: {{prestador_cpf}}

HASH DE VALIDAÇÃO: {{hash_documento}}`;

      const resultado = await criarModeloContrato({
        nome: novoModelo.nome.trim(),
        tipo: novoModelo.tipo,
        conteudo_base: modeloPadrao,
        variaveis: ["empresa_nome", "empresa_cnpj", "empresa_endereco", "prestador_nome", "prestador_cpf", "prestador_telefone", "prestador_endereco", "veiculo_tipo", "veiculo_placa", "veiculo_modelo", "valor_saida", "pagamento_prazo", "data_atual", "numero_contrato", "hash_documento"],
        ativa: true,
      });

      if (resultado) {
        toast.success(`Modelo "${novoModelo.nome}" criado com sucesso!`);
        setShowNovoModelo(false);
        setNovoModelo({ nome: "", tipo: "TAC", conteudo_base: "" });
        await carregarModelos();
      } else {
        toast.error("Erro ao criar modelo no banco de dados.");
      }
    } catch (e) {
      console.error("[Contratos] Erro ao criar modelo:", e);
      toast.error("Erro ao criar modelo.");
    } finally {
      setSavingModelo(false);
    }
  };

  const handleSalvarModelo = async () => {
    if (!modeloEditando) return;
    setSavingModelo(true);
    try {
      const resultado = await atualizarModeloContrato(modeloEditando.id, {
        nome: modeloEditando.nome,
        tipo: modeloEditando.tipo,
        conteudo_base: modeloEditando.conteudo_base,
        variaveis: modeloEditando.variaveis || [],
      });

      if (resultado) {
        toast.success("Modelo salvo com sucesso!");
        setModeloEditando(null);
        await carregarModelos();
      } else {
        toast.error("Erro ao salvar modelo no banco de dados.");
      }
    } catch (e) {
      console.error("[Contratos] Erro ao salvar:", e);
      toast.error("Erro ao salvar modelo.");
    } finally {
      setSavingModelo(false);
    }
  };

  const handleExcluirModelo = async (id: string, nome: string) => {
    if (!confirm(`Excluir modelo "${nome}"? Esta ação não pode ser desfeita.`)) return;
    try {
      const ok = await excluirModeloContrato(id);
      if (ok) {
        toast.success("Modelo excluído!");
        await carregarModelos();
      } else {
        toast.error("Erro ao excluir modelo.");
      }
    } catch (e) {
      console.error("[Contratos] Erro ao excluir:", e);
      toast.error("Erro ao excluir modelo.");
    }
  };

  const handlePreview = () => {
    if (!modeloEditando) return;
    let preview = modeloEditando.conteudo_base || "";

    const replacements: Array<[RegExp, string]> = [
      [/\{\{empresa_nome\}\}/g, "Conexão Express Transportes LTDA"],
      [/\{\{empresa_cnpj\}\}/g, "42.796.040/0001-31"],
      [/\{\{empresa_endereco\}\}/g, "Avenida Goitacazes, 45, São Caetano do Sul/SP"],
      [/\{\{prestador_nome\}\}/g, "João da Silva"],
      [/\{\{prestador_cpf\}\}/g, "123.456.789-00"],
      [/\{\{prestador_telefone\}\}/g, "(11) 99999-9999"],
      [/\{\{prestador_whatsapp\}\}/g, "(11) 99999-9999"],
      [/\{\{prestador_email\}\}/g, "joao@email.com"],
      [/\{\{prestador_pix\}\}/g, "joao@email.com"],
      [/\{\{prestador_banco\}\}/g, "Banco do Brasil"],
      [/\{\{prestador_rua\}\}/g, "Av. Paulista"],
      [/\{\{prestador_numero\}\}/g, "1000"],
      [/\{\{prestador_bairro\}\}/g, "Bela Vista"],
      [/\{\{prestador_cidade\}\}/g, "São Paulo"],
      [/\{\{prestador_estado\}\}/g, "SP"],
      [/\{\{prestador_cep\}\}/g, "01310-100"],
      [/\{\{prestador_endereco\}\}/g, "Av. Paulista, 1000 - Bela Vista, São Paulo/SP - CEP: 01310-100"],
      [/\{\{prestador_cnpj\}\}/g, "12.345.678/0001-90"],
      [/\{\{veiculo_tipo\}\}/g, "Caminhão Truck"],
      [/\{\{veiculo_placa\}\}/g, "ABC-1234"],
      [/\{\{veiculo_modelo\}\}/g, "Ford Cargo 2423"],
      [/\{\{veiculo_tipo_carga\}\}/g, "Diversos"],
      [/\{\{valor_saida\}\}/g, "R$ 350,00"],
      [/\{\{pagamento_prazo\}\}/g, "30 dias"],
      [/\{\{data_atual\}\}/g, new Date().toLocaleDateString("pt-BR", { day: '2-digit', month: 'long', year: 'numeric' })],
      [/\{\{numero_contrato\}\}/g, "CTR-2025-000001"],
      [/\{\{hash_documento\}\}/g, "a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd"],
    ];

    for (const [regex, value] of replacements) {
      preview = preview.replace(regex, value);
    }

    setPreviewContent(preview);
    setShowPreviewModal(true);
  };

  const insertVar = (v: string) => {
    if (!modeloEditando) return;
    setModeloEditando({ ...modeloEditando, conteudo_base: modeloEditando.conteudo_base + `{{${v}}}` });
  };

  const mapStatus = (status: string) => {
    switch (status) {
      case 'gerado': return 'Gerado';
      case 'pendente': return 'Aguardando';
      case 'enviado': return 'Enviado';
      case 'aceito_whatsapp': return 'Aceito WhatsApp';
      case 'assinado': return 'Assinado';
      case 'recusado': return 'Recusado';
      case 'cancelado': return 'Cancelado';
      default: return status;
    }
  };

  const handleBaixarPDF = (pdfUrl?: string) => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
    } else {
      toast.error('PDF ainda não foi gerado.');
    }
  };

  const handleConfigChange = (key: keyof typeof configs, val: boolean) => {
    const newConfigs = { ...configs, [key]: val };
    setConfigs(newConfigs);
    localStorage.setItem('contratos_configs', JSON.stringify(newConfigs));
  };

  const handleVisualizar = (contrato: ContratoGerado) => {
    setContratoVisualizar(contrato);
  };

  const handleExcluirContrato = (contrato: ContratoGerado) => {
    setContratoExcluir(contrato);
  };

  const confirmExcluirContrato = async () => {
    if (!contratoExcluir) return;
    setExcluindoContrato(true);
    try {
      const ok = await excluirContrato(contratoExcluir.id);
      if (ok) {
        toast.success(`Contrato ${contratoExcluir.numero_contrato} excluído com sucesso!`);
        setContratoExcluir(null);
        await carregarContratosGerados();
      } else {
        toast.error("Erro ao excluir contrato.");
      }
    } catch (e) {
      console.error("[Contratos] Erro ao excluir:", e);
      toast.error("Erro ao excluir contrato.");
    } finally {
      setExcluindoContrato(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="w-8 h-8 text-primary" /> Central de Contratos Automáticos
          </h1>
          <p className="text-muted-foreground">Criação, edição e emissão de contratos corporativos inteligentes.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => setShowNovoModelo(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Modelo
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-4 justify-start overflow-x-auto flex-wrap">
          <TabsTrigger value="modelos" className="gap-2"><FileText className="w-4 h-4"/>Modelos</TabsTrigger>
          <TabsTrigger value="gerados" className="gap-2"><FileSignature className="w-4 h-4"/>Contratos Gerados</TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-2"><Settings className="w-4 h-4"/>Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="pt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Modelos de Contrato</CardTitle>
                <CardDescription>Modelos salvos no banco de dados (Supabase).</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingModelos ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando modelos...</span>
                </div>
              ) : modelos.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum modelo cadastrado</p>
                  <p className="text-sm mt-1">Clique em "Novo Modelo" para criar seu primeiro modelo.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Variáveis</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelos.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-semibold">{m.nome}</TableCell>
                        <TableCell><Badge variant="outline">{m.tipo}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR') : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {m.variaveis?.length || 0} variável(is)
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setModeloEditando(m)} title="Editar">
                              <Eye className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExcluirModelo(m.id, m.nome)} title="Excluir">
                              <Trash className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {modeloEditando && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Editando: {modeloEditando.nome}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePreview}>
                    <Eye className="w-4 h-4 mr-2" /> Visualizar
                  </Button>
                  <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvarModelo} disabled={savingModelo}>
                    {savingModelo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Salvar
                  </Button>
                  <Button variant="ghost" onClick={() => setModeloEditando(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>Nome do Modelo</Label>
                    <Input value={modeloEditando.nome} onChange={(e) => setModeloEditando({ ...modeloEditando, nome: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={modeloEditando.tipo} onValueChange={(v) => setModeloEditando({ ...modeloEditando, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TAC">TAC</SelectItem>
                        <SelectItem value="ETC">ETC</SelectItem>
                        <SelectItem value="Prestador">Prestador</SelectItem>
                        <SelectItem value="Cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden flex flex-col md:flex-col bg-white">
                  <div className="flex-1 p-4 border-b min-h-[400px]">
                    <Textarea
                      value={modeloEditando.conteudo_base || ""}
                      onChange={(e) => setModeloEditando({ ...modeloEditando, conteudo_base: e.target.value })}
                      className="min-h-[350px] font-mono text-xs bg-slate-50 border-0 resize-none focus-visible:ring-0"
                      placeholder="Digite o conteúdo do contrato usando variáveis como {{prestador_nome}}, {{valor_saida}}..."
                    />
                  </div>
                  <div className="w-full bg-slate-50 p-4 overflow-y-auto max-h-[300px]">
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Variáveis Disponíveis</h4>
                    <div className="space-y-4">
                      {VARIAVEIS.map((cat) => (
                        <div key={cat.categoria}>
                          <p className="text-[10px] font-semibold text-slate-400 mb-2">{cat.categoria}</p>
                          <div className="flex flex-wrap gap-1">
                            {cat.vars.map((v) => (
                              <button
                                key={v}
                                onClick={() => insertVar(v)}
                                className="text-left text-[10px] font-mono text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition truncate"
                                title="Clique para inserir"
                              >
                                {`{{${v}}}`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="gerados" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Contratos Gerados</CardTitle>
              <CardDescription>Histórico de contratos emitidos salvos no banco de dados.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg border">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Prestador..."
                  className="w-40 h-8 text-xs"
                  value={filtros.prestadorNome}
                  onChange={(e) => setFiltros(f => ({ ...f, prestadorNome: e.target.value }))}
                />
                <Select value={filtros.tipo || ""} onValueChange={(v) => setFiltros(f => ({ ...f, tipo: v || undefined }))}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Todos</SelectItem>
                    <SelectItem value="TAC">TAC</SelectItem>
                    <SelectItem value="ETC">ETC</SelectItem>
                    <SelectItem value="Prestador">Prestador</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filtros.status || ""} onValueChange={(v) => setFiltros(f => ({ ...f, status: v || undefined }))}>
                  <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Todos</SelectItem>
                    <SelectItem value="gerado">Gerado</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="aceito_whatsapp">Aceito WhatsApp</SelectItem>
                    <SelectItem value="assinado">Assinado</SelectItem>
                    <SelectItem value="recusado">Recusado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nº contrato..."
                  className="w-36 h-8 text-xs"
                  value={filtros.numeroContrato}
                  onChange={(e) => setFiltros(f => ({ ...f, numeroContrato: e.target.value }))}
                />
                <Input
                  type="date"
                  className="w-32 h-8 text-xs"
                  value={filtros.dataInicio || ""}
                  onChange={(e) => setFiltros(f => ({ ...f, dataInicio: e.target.value || undefined }))}
                />
                <Input
                  type="date"
                  className="w-32 h-8 text-xs"
                  value={filtros.dataFim || ""}
                  onChange={(e) => setFiltros(f => ({ ...f, dataFim: e.target.value || undefined }))}
                />
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={carregarContratosGerados}>
                  <Search className="w-3 h-3 mr-1" /> Filtrar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => {
                  setFiltros({});
                  setTimeout(carregarContratosGerados, 100);
                }}>
                  Limpar
                </Button>
              </div>

              {loadingGerados ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Carregando contratos...</span>
                </div>
              ) : contratosGerados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSignature className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhum contrato gerado</p>
                  <p className="text-sm mt-1">Gere contratos a partir do cadastro de prestadores.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contratosGerados.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-mono text-xs font-semibold">{g.numero_contrato || "—"}</TableCell>
                        <TableCell className="font-semibold">{g.prestador_nome || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{g.tipo_contrato}</TableCell>
                        <TableCell className="text-xs">
                          {g.created_at ? new Date(g.created_at).toLocaleDateString('pt-BR') : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            g.status === 'assinado' || g.status === 'aceito_whatsapp' ? 'bg-green-50 text-green-700 border-green-200' :
                            g.status === 'gerado' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            g.status === 'enviado' || g.status === 'pendente' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                            g.status === 'cancelado' ? 'bg-slate-100 text-slate-600' :
                            'bg-red-50 text-red-700 border-red-200'
                          }>{mapStatus(g.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleVisualizar(g)} title="Visualizar">
                              <Eye className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleBaixarPDF(g.pdf_url)} title="Baixar PDF">
                              <Download className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExcluirContrato(g)} title="Excluir">
                              <Trash className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracoes" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Parâmetros de Contratos</CardTitle></CardHeader>
            <CardContent className="space-y-6 max-w-lg">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Obrigatoriedade de Contrato</p>
                  <p className="text-xs text-muted-foreground">Impedir OS para prestadores sem contrato ativo</p>
                </div>
                <Switch checked={configs.obrigatorio} onCheckedChange={(val) => handleConfigChange('obrigatorio', val)} />
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Layout Automático</p>
                  <p className="text-xs text-muted-foreground">Adicionar cabeçalho, logo e rodapé automaticamente</p>
                </div>
                <Switch checked={configs.layoutAutomatico} onCheckedChange={(val) => handleConfigChange('layoutAutomatico', val)} />
              </div>
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-bold text-sm text-slate-800">Salvamento Automático</p>
                  <p className="text-xs text-muted-foreground">Salvar contratos gerados no histórico</p>
                </div>
                <Switch checked={configs.salvamentoAutomatico} onCheckedChange={(val) => handleConfigChange('salvamentoAutomatico', val)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showNovoModelo} onOpenChange={setShowNovoModelo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Modelo de Contrato</DialogTitle>
            <DialogDescription>O modelo será salvo no banco de dados (Supabase).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Modelo *</Label>
              <Input
                placeholder="Ex: TAC - Transporte Autônomo de Carga"
                value={novoModelo.nome}
                onChange={(e) => setNovoModelo({ ...novoModelo, nome: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={novoModelo.tipo} onValueChange={(v) => setNovoModelo({ ...novoModelo, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAC">TAC - Transporte Autônomo de Carga</SelectItem>
                  <SelectItem value="ETC">ETC - Transporte Emergencial de Carga</SelectItem>
                  <SelectItem value="Prestador">Prestador</SelectItem>
                  <SelectItem value="Cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNovoModelo(false)}>Cancelar</Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={handleNovoModelo} disabled={savingModelo}>
              {savingModelo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Contrato</DialogTitle>
            <DialogDescription>Visualização com variáveis substituídas por dados de exemplo.</DialogDescription>
          </DialogHeader>
          <div className="bg-white p-8 rounded border shadow-sm font-serif text-sm whitespace-pre-wrap leading-relaxed">
            {previewContent}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPreviewModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contratoVisualizar} onOpenChange={(o) => !o && setContratoVisualizar(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato {contratoVisualizar?.numero_contrato}</DialogTitle>
            <DialogDescription>
              {contratoVisualizar?.prestador_nome} — {contratoVisualizar?.tipo_contrato}
            </DialogDescription>
          </DialogHeader>
          {contratoVisualizar?.conteudo_html ? (
            <div className="bg-white p-8 rounded border shadow-sm font-serif text-sm whitespace-pre-wrap leading-relaxed">
              {contratoVisualizar.conteudo_html}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Conteúdo do contrato não disponível.</p>
            </div>
          )}
          <DialogFooter>
            {contratoVisualizar?.pdf_url && (
              <Button variant="outline" onClick={() => window.open(contratoVisualizar.pdf_url, '_blank')}>
                <Download className="w-4 h-4 mr-2" /> Baixar PDF
              </Button>
            )}
            <Button onClick={() => setContratoVisualizar(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!contratoExcluir} onOpenChange={(o) => !o && setContratoExcluir(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Contrato</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o contrato <strong>{contratoExcluir?.numero_contrato}</strong> de <strong>{contratoExcluir?.prestador_nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita. O PDF será removido do Storage e o registro será excluído permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContratoExcluir(null)} disabled={excluindoContrato}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmExcluirContrato} disabled={excluindoContrato}>
              {excluindoContrato ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash className="w-4 h-4 mr-2" />}
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
