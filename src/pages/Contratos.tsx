import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FileSignature, Plus, FileText, Download, Printer, Copy, Settings, Eye, Trash, RefreshCw, Save, Check, X, ChevronDown } from "lucide-react";
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

interface ModeloContrato {
  id: string;
  nome: string;
  tipo: "prestador" | "cliente" | "agregado" | "autonomo";
  conteudo: string;
  isDefault: boolean;
  createdAt: string;
}

interface ContratoGerado {
  id: string;
  modeloId: string;
  modeloNome: string;
  prestadorNome?: string;
  clienteNome?: string;
  data: string;
  status: "Aguardando" | "Assinado" | "Recusado";
  usuario: string;
}

const MODELOS_DEFAULT: ModeloContrato[] = [
  {
    id: "1",
    nome: "Contrato Padrão Autônomo (ANTT)",
    tipo: "autonomo",
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE AUTÔNOMO DE CARGAS

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

CONTRATADO(A): {{prestador_nome}}
CPF: {{prestador_cpf}}
RG: {{prestador_rg}}
ENDEREÇO: {{prestador_rua}}, {{prestador_numero}} - {{prestador_bairro}}, {{prestador_cidade}}/{{prestador_estado}} - CEP: {{prestador_cep}}
TELEFONE: {{prestador_telefone}}
WHATSAPP: {{prestador_whatsapp}}
E-MAIL: {{prestador_email}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

DADOS PARA PAGAMENTO:
Chave PIX: {{prestador_pix}}
Banco: {{prestador_banco}}

VALORES:
Valor Diária: {{valor_diaria}}
Valor KM: {{valor_km}}

DATA: {{data_atual}}

O presente contrato tem como objeto a prestação de serviços de transporte de cargas pelo Contratado, utilizando veículo próprio ou agregado, em regime de execução autônoma, nos termos da Lei 11.442/2007 (ANTT).

{{empresa_nome}} se compromete a pagar ao Contratado os valores acordados nas condições especificadas acima.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}
CNPJ: {{empresa_cnpj}}                       CPF: {{prestador_cpf}}`,
    isDefault: true,
    createdAt: "27/03/2026"
  },
  {
    id: "2",
    nome: "Contrato Frota Agregada Mensal",
    tipo: "agregado",
    conteudo: `CONTRATO DE AGREGAMENTO COMERCIAL

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

AGREGADO: {{prestador_nome}}
CPF: {{prestador_cpf}}
ENDEREÇO: {{prestador_rua}}, {{prestador_numero}} - {{prestador_bairro}}, {{prestador_cidade}}/{{prestador_estado}}

VEÍCULO: {{veiculo_tipo}} - PLACA: {{veiculo_placa}} - MODELO: {{veiculo_modelo}}

DATA: {{data_atual}}

O Contratado declara ter conhecimento integral das normas internas da Contratante e se compromete a seguir rigorosamente os procedimentos operacionais estabelecidos.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}`,
    isDefault: false,
    createdAt: "20/03/2026"
  },
  {
    id: "3",
    nome: "Termo de Parceria Eventual",
    tipo: "autonomo",
    conteudo: `TERMO DE COMPROMISSO EVENTUAL

CONTRATANTE: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

PARCEIRO: {{prestador_nome}}
CPF: {{prestador_cpf}}
VEÍCULO: {{veiculo_placa}}
CONTATO: {{prestador_telefone}} / {{prestador_whatsapp}}

DATA: {{data_atual}}

O parceiro acima identificado declara interesse em realizar operações de transporte de forma esporádica, mediante as condições comerciais acordadas em cada operação.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{prestador_nome}}`,
    isDefault: false,
    createdAt: "15/03/2026"
  },
  {
    id: "4",
    nome: "Contrato de Prestação de Serviços - Cliente",
    tipo: "cliente",
    conteudo: `CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TRANSPORTE

CONTRATANTE: {{cliente_nome}}
CNPJ: {{cliente_cnpj}}
ENDEREÇO: {{cliente_endereco}}

CONTRATADA: {{empresa_nome}}
CNPJ: {{empresa_cnpj}}

OBJETO: Prestação de serviços de transporte de cargas

DATA: {{data_atual}}

{{empresa_nome}} se compromete a realizar o transporte das mercadorias do Contratante conforme rotas e prazos acordados.

_______________________________________          _______________________________________
{{empresa_nome}}                              {{cliente_nome}}`,
    isDefault: false,
    createdAt: "10/03/2026"
  }
];

const STORAGE_MODELOS_KEY = 'contratos_modelos';
const STORAGE_GERADOS_KEY = 'contratos_gerados';

export default function Contratos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "modelos";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [modelos, setModelos] = useState<ModeloContrato[]>([]);
  const [contratosGerados, setContratosGerados] = useState<ContratoGerado[]>([]);
  const [modeloEditando, setModeloEditando] = useState<ModeloContrato | null>(null);
  const [showNovoModelo, setShowNovoModelo] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewContent, setPreviewContent] = useState("");

  useEffect(() => {
    const storedModelos = localStorage.getItem(STORAGE_MODELOS_KEY);
    if (storedModelos) {
      setModelos(JSON.parse(storedModelos));
    } else {
      setModelos(MODELOS_DEFAULT);
      localStorage.setItem(STORAGE_MODELOS_KEY, JSON.stringify(MODELOS_DEFAULT));
    }

    const storedGerados = localStorage.getItem(STORAGE_GERADOS_KEY);
    if (storedGerados) {
      setContratosGerados(JSON.parse(storedGerados));
    }
  }, []);

  const saveModelos = (novosModelos: ModeloContrato[]) => {
    setModelos(novosModelos);
    localStorage.setItem(STORAGE_MODELOS_KEY, JSON.stringify(novosModelos));
  };

  const saveGerados = (novosGerados: ContratoGerado[]) => {
    setContratosGerados(novosGerados);
    localStorage.setItem(STORAGE_GERADOS_KEY, JSON.stringify(novosGerados));
  };

  const insertVar = (v: string) => {
    if (!modeloEditando) return;
    const newContent = modeloEditando.conteudo + `{{${v}}}`;
    setModeloEditando({ ...modeloEditando, conteudo: newContent });
  };

  const handleSalvarModelo = () => {
    if (!modeloEditando) return;
    
    const existentes = modelos.filter(m => m.id !== modeloEditando.id);
    const novosModelos = [...existentes, { ...modeloEditando, createdAt: new Date().toLocaleDateString("pt-BR") }];
    saveModelos(novosModelos);
    setModeloEditando(null);
    toast.success("Modelo salvo com sucesso!");
  };

  const handleNovoModelo = () => {
    const novo: ModeloContrato = {
      id: Date.now().toString(),
      nome: "Novo Modelo",
      tipo: "prestador",
      conteudo: "Digite o conteúdo do contrato aqui...",
      isDefault: false,
      createdAt: new Date().toLocaleDateString("pt-BR")
    };
    setModeloEditando(novo);
    setShowNovoModelo(false);
  };

  const handleExcluirModelo = (id: string) => {
    const novosModelos = modelos.filter(m => m.id !== id);
    saveModelos(novosModelos);
    toast.success("Modelo excluído!");
  };

  const handleDuplicarModelo = (modelo: ModeloContrato) => {
    const duplicado: ModeloContrato = {
      ...modelo,
      id: Date.now().toString(),
      nome: `${modelo.nome} (Cópia)`,
      isDefault: false,
      createdAt: new Date().toLocaleDateString("pt-BR")
    };
    saveModelos([...modelos, duplicado]);
    toast.success("Modelo duplicado!");
  };

  const handlePreview = () => {
    if (!modeloEditando) return;
    
    let preview = modeloEditando.conteudo;
    preview = preview.replace(/{{empresa_nome}}/g, "Conexão Express Transportes LTDA");
    preview = preview.replace(/{{empresa_cnpj}}/g, "42.796.040/0001-31");
    preview = preview.replace(/{{prestador_nome}}/g, "João da Silva");
    preview = preview.replace(/{{prestador_cpf}}/g, "123.456.789-00");
    preview = preview.replace(/{{prestador_rg}}/g, "12.345.678-9");
    preview = preview.replace(/{{prestador_rua}}/g, "Av. Paulista");
    preview = preview.replace(/{{prestador_numero}}/g, "1000");
    preview = preview.replace(/{{prestador_bairro}}/g, "Bela Vista");
    preview = preview.replace(/{{prestador_cidade}}/g, "São Paulo");
    preview = preview.replace(/{{prestador_estado}}/g, "SP");
    preview = preview.replace(/{{prestador_cep}}/g, "01310-100");
    preview = preview.replace(/{{prestador_telefone}}/g, "(11) 99999-9999");
    preview = preview.replace(/{{prestador_whatsapp}}/g, "(11) 99999-9999");
    preview = preview.replace(/{{prestador_email}}/g, "joao@email.com");
    preview = preview.replace(/{{prestador_pix}}/g, "joao@email.com");
    preview = preview.replace(/{{prestador_banco}}/g, "Banco do Brasil");
    preview = preview.replace(/{{veiculo_tipo}}/g, "Caminhão Truck");
    preview = preview.replace(/{{veiculo_placa}}/g, "ABC-1234");
    preview = preview.replace(/{{veiculo_modelo}}/g, "Ford Cargo 2423");
    preview = preview.replace(/{{valor_diaria}}/g, "R$ 350,00");
    preview = preview.replace(/{{valor_km}}/g, "R$ 2,50");
    preview = preview.replace(/{{data_atual}}/g, new Date().toLocaleDateString("pt-BR"));
    preview = preview.replace(/{{cliente_nome}}/g, "Empresa Cliente LTDA");
    preview = preview.replace(/{{cliente_cnpj}}/g, "12.345.678/0001-90");
    preview = preview.replace(/{{cliente_endereco}}/g, "Av. Brasil, 500 - São Paulo/SP");

    setPreviewContent(preview);
    setShowPreviewModal(true);
  };

  const filteredGerados = contratosGerados.filter(g => {
    if (filtroTipo !== "todos" && g.modeloNome.toLowerCase().includes(filtroTipo)) return false;
    if (filtroStatus !== "todos" && g.status !== filtroStatus) return false;
    return true;
  });

  const variaveis = [
    { categoria: "EMPRESA", vars: ["empresa_nome", "empresa_cnpj", "empresa_endereco"] },
    { categoria: "PRESTADOR", vars: ["prestador_nome", "prestador_cpf", "prestador_rg", "prestador_telefone", "prestador_whatsapp", "prestador_email", "prestador_pix", "prestador_banco", "prestador_rua", "prestador_numero", "prestador_bairro", "prestador_cidade", "prestador_estado", "prestador_cep"] },
    { categoria: "VEÍCULO", vars: ["veiculo_tipo", "veiculo_placa", "veiculo_modelo"] },
    { categoria: "VALORES", vars: ["valor_diaria", "valor_km"] },
    { categoria: "DADOS", vars: ["data_atual"] },
    { categoria: "CLIENTE", vars: ["cliente_nome", "cliente_cnpj", "cliente_endereco"] },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSignature className="w-8 h-8 text-primary" /> Central de Contratos Automáticos
          </h1>
          <p className="text-muted-foreground">Criação, edição e emissão de contratos corporativos inteligentes.</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleNovoModelo}>
          <Plus className="w-4 h-4 mr-2" /> Novo Modelo
        </Button>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="modelos" className="px-5"><FileText className="w-4 h-4 mr-2"/> Modelos</TabsTrigger>
           <TabsTrigger value="gerados" className="px-5"><FileSignature className="w-4 h-4 mr-2"/> Contratos Gerados</TabsTrigger>
           <TabsTrigger value="configuracoes" className="px-5"><Settings className="w-4 h-4 mr-2"/> Configurações</TabsTrigger>
        </TabsList>

        {/* --- MODELOS --- */}
        <TabsContent value="modelos" className="pt-4 space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Modelos de Contrato</CardTitle>
                  <CardDescription>Gerencie os modelos que serão usados na geração automática.</CardDescription>
                </div>
             </CardHeader>
             <CardContent>
                <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Nome do Modelo</TableHead>
                       <TableHead>Tipo</TableHead>
                       <TableHead>Criado em</TableHead>
                       <TableHead>Status</TableHead>
                       <TableHead className="text-right">Ações</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {modelos.map((m) => (
                       <TableRow key={m.id}>
                         <TableCell className="font-semibold text-sm flex items-center gap-2">
                           {m.nome} 
                           {m.isDefault && <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-[9px] uppercase">Padrão</Badge>}
                         </TableCell>
                         <TableCell>
                           <Badge variant="outline" className="capitalize">{m.tipo}</Badge>
                         </TableCell>
                         <TableCell className="text-xs text-muted-foreground">{m.createdAt}</TableCell>
                         <TableCell><span className="text-green-600 font-semibold text-xs">Ativo</span></TableCell>
                         <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setModeloEditando(m); setPreviewMode(false); }}><Eye className="w-4 h-4"/></Button>
                               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-black" onClick={() => handleDuplicarModelo(m)}><Copy className="w-4 h-4"/></Button>
                               {!m.isDefault && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleExcluirModelo(m.id)}><Trash className="w-4 h-4"/></Button>}
                            </div>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                </Table>
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
                   <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvarModelo}>
                     <Save className="w-4 h-4 mr-2" /> Salvar
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
                     <Input value={modeloEditando.nome} onChange={(e) => setModeloEditando({...modeloEditando, nome: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                     <Label>Tipo</Label>
                     <Select value={modeloEditando.tipo} onValueChange={(v: any) => setModeloEditando({...modeloEditando, tipo: v})}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="prestador">Prestador</SelectItem>
                         <SelectItem value="cliente">Cliente</SelectItem>
                         <SelectItem value="agregado">Agregado</SelectItem>
                         <SelectItem value="autonomo">Autônomo</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
                 
                 <div className="border rounded-lg overflow-hidden flex flex-col md:flex-row bg-white">
                    <div className="flex-1 p-4 border-r min-h-[400px]">
                       <Textarea 
                         value={modeloEditando.conteudo} 
                         onChange={(e) => setModeloEditando({...modeloEditando, conteudo: e.target.value})}
                         className="min-h-[350px] font-mono text-xs bg-slate-50 border-0 resize-none focus-visible:ring-0"
                         placeholder="Digite o conteúdo do contrato usando {{variavel}} para inserir dados dinâmicos..."
                       />
                    </div>
                    <div className="w-full md:w-64 bg-slate-50 p-4 shrink-0 overflow-y-auto max-h-[450px]">
                       <h4 className="text-xs font-bold uppercase text-slate-500 mb-4 tracking-wider">Variáveis Disponíveis</h4>
                       <div className="space-y-4">
                          {variaveis.map((cat) => (
                            <div key={cat.categoria}>
                              <p className="text-[10px] font-semibold text-slate-400 mb-2">{cat.categoria}</p>
                              <div className="flex flex-col gap-1">
                                {cat.vars.map(v => (
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

        {/* --- GERADOS --- */}
        <TabsContent value="gerados" className="pt-4 space-y-4">
           <Card>
             <CardHeader>
               <CardTitle>Contratos Gerados</CardTitle>
               <CardDescription>Histórico de contratos emitidos pelo sistema.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="flex gap-4 mb-4">
                 <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                   <SelectTrigger className="w-48"><SelectValue placeholder="Tipo" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="todos">Todos os tipos</SelectItem>
                     <SelectItem value="prestador">Prestador</SelectItem>
                     <SelectItem value="cliente">Cliente</SelectItem>
                   </SelectContent>
                 </Select>
                 <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                   <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="todos">Todos os status</SelectItem>
                     <SelectItem value="Aguardando">Aguardando</SelectItem>
                     <SelectItem value="Assinado">Assinado</SelectItem>
                     <SelectItem value="Recusado">Recusado</SelectItem>
                   </SelectContent>
                 </Select>
               </div>

               <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Contratado</TableHead>
                     <TableHead>Modelo</TableHead>
                     <TableHead>Data Geração</TableHead>
                     <TableHead>Gerado Por</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Ações</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                    {filteredGerados.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum contrato gerado ainda.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredGerados.map(g => (
                        <TableRow key={g.id}>
                           <TableCell className="font-semibold">{g.prestadorNome || g.clienteNome || "—"}</TableCell>
                           <TableCell className="text-xs text-muted-foreground">{g.modeloNome}</TableCell>
                           <TableCell className="text-xs">{g.data}</TableCell>
                           <TableCell className="text-xs">{g.usuario}</TableCell>
                           <TableCell>
                              <Badge variant="outline" className={
                                g.status === 'Assinado' ? 'bg-green-50 text-green-700 border-green-200' : 
                                g.status === 'Aguardando' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                'bg-red-50 text-red-700 border-red-200'
                              }>{g.status}</Badge>
                           </TableCell>
                           <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Download className="w-4 h-4"/></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600"><Printer className="w-4 h-4"/></Button>
                           </TableCell>
                        </TableRow>
                      ))
                    )}
                 </TableBody>
               </Table>
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
                   <Switch checked={true} />
                </div>
                <div className="flex items-center justify-between border-b pb-4">
                   <div>
                     <p className="font-bold text-sm text-slate-800">Layout Automático (Identidade Visual)</p>
                     <p className="text-xs text-muted-foreground">Adicionar cabeçalho, logo e rodapé automaticamente</p>
                   </div>
                   <Switch checked={true} />
                </div>
                <div className="flex items-center justify-between border-b pb-4">
                   <div>
                     <p className="font-bold text-sm text-slate-800">Salvamento Automático</p>
                     <p className="text-xs text-muted-foreground">Salvar contratos gerados no histórico</p>
                   </div>
                   <Switch checked={true} />
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview do Contrato</DialogTitle>
            <DialogDescription>Visualize como o contrato ficará após a substituição das variáveis.</DialogDescription>
          </DialogHeader>
          <div className="bg-white p-6 rounded border font-mono text-sm whitespace-pre-wrap">
            {previewContent}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPreviewModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
