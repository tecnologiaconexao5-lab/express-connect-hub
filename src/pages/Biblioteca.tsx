import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Folder, Upload, Download, Search, FileText, Image, Video, ShieldAlert, Trash, Filter, Plus, Copy, MessageSquare, Users, Truck, Package, DollarSign, Send, Check, ChevronRight, ArrowRight, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface MensagemRapida {
  id: string;
  titulo: string;
  categoria: string;
  texto: string;
}

interface FluxoEtapa {
  id: string;
  titulo: string;
  texto: string;
  ordem: number;
}

const MENSAGENS_DEFAULT: MensagemRapida[] = [
  { id: "1", titulo: "Bem-vindo à equipe", categoria: "Captação de prestadores", texto: "Olá {{nome}}! Bem-vindo à nossa equipe de prestadores. Estamos muito felizes em tê-lo conosco. Em breve entraremos em contato com as primeiras operações." },
  { id: "2", titulo: "Nova OS disponível", categoria: "Operacional", texto: "Olá {{nome}}! Uma nova ordem de serviço está disponível para você. Acesse o app para aceitar. Origem: {{origem}} - Destino: {{destino}}" },
  { id: "3", titulo: "Pagamento realizado", categoria: "Financeiro", texto: "Olá {{nome}}! Informamos que o pagamento referente à OS {{os}} foi processado. Valor: R$ {{valor}}. O crédito deve cair em até 2 dias úteis." },
  { id: "4", titulo: "Entrega confirmada", categoria: "Clientes", texto: "Olá! Sua mercadoria foi entregue com sucesso. O comprovante de entrega está disponível no nosso portal. Agradecemos a preferência!" },
  { id: "5", titulo: "Ocorrência registrada", categoria: "Ocorrências", texto: "Informamos que uma ocorrência foi registrada na OS {{os}}. Detalhes: {{detalhes}}. Nossa equipe está acompanhando o caso." },
];

const FLUXO_DEFAULT: FluxoEtapa[] = [
  { id: "1", titulo: "Primeiro Contato", texto: "Olá {{nome}}! Vi seu interesse em trabalhar conosco como prestador de transporte. Temos oportunidades para {{tipo_veiculo}} na região de {{regiao}}. Você teria disponibilidade para uma conversa?", ordem: 1 },
  { id: "2", titulo: "Se Aceitar", texto: "Perfeito! Para darmos continuidade, precisamos que você envie os seguintes documentos: CNH, CRLV, comprovante de residência e certidões. Pode enviar pelo WhatsApp?", ordem: 2 },
  { id: "3", titulo: "Se Não Aceitar", texto: "Entendemos sua decisão. Caso mude de ideia no futuro, estamos à disposição. Boa sorte com suas atividades!", ordem: 3 },
  { id: "4", titulo: "Confirmação de Documentação", texto: "Documentos recebidos! Vamos analisar e em breve retornamos. Mientras, você pode baixar nosso app para se familiarizar com a plataforma.", ordem: 4 },
  { id: "5", titulo: "Aprovação e Ativação", texto: "Parabéns! Você foi aprovado. Agora você faz parte da nossa base de prestadores. Comece a aceitar operações quando receber notificação. Bem-vindo!", ordem: 5 },
];

const STORAGE_MENSAGENS_KEY = 'mensagens_rapidas';
const STORAGE_FLUXO_KEY = 'fluxo_recrutamento';

export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacional";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [mensagens, setMensagens] = useState<MensagemRapida[]>([]);
  const [fluxoEtapas, setFluxoEtapas] = useState<FluxoEtapa[]>([]);
  const [showNovaMensagem, setShowNovaMensagem] = useState(false);
  const [mensagemEditando, setMensagemEditando] = useState<MensagemRapida | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  useEffect(() => {
    const storedMensagens = localStorage.getItem(STORAGE_MENSAGENS_KEY);
    if (storedMensagens) {
      setMensagens(JSON.parse(storedMensagens));
    } else {
      setMensagens(MENSAGENS_DEFAULT);
      localStorage.setItem(STORAGE_MENSAGENS_KEY, JSON.stringify(MENSAGENS_DEFAULT));
    }

    const storedFluxo = localStorage.getItem(STORAGE_FLUXO_KEY);
    if (storedFluxo) {
      setFluxoEtapas(JSON.parse(storedFluxo));
    } else {
      setFluxoEtapas(FLUXO_DEFAULT);
      localStorage.setItem(STORAGE_FLUXO_KEY, JSON.stringify(FLUXO_DEFAULT));
    }
  }, []);

  const saveMensagens = (novas: MensagemRapida[]) => {
    setMensagens(novas);
    localStorage.setItem(STORAGE_MENSAGENS_KEY, JSON.stringify(novas));
  };

  const saveFluxo = (novoFluxo: FluxoEtapa[]) => {
    setFluxoEtapas(novoFluxo);
    localStorage.setItem(STORAGE_FLUXO_KEY, JSON.stringify(novoFluxo));
  };

  const copyToClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Mensagem copiada!");
  };

  const handleNovaMensagem = () => {
    const nova: MensagemRapida = {
      id: Date.now().toString(),
      titulo: "Nova mensagem",
      categoria: "Operacional",
      texto: "Digite sua mensagem aqui..."
    };
    setMensagemEditando(nova);
    setShowNovaMensagem(true);
  };

  const handleSalvarMensagem = () => {
    if (!mensagemEditando) return;
    
    const existentes = mensagens.filter(m => m.id !== mensagemEditando.id);
    saveMensagens([...existentes, mensagemEditando]);
    setMensagemEditando(null);
    setShowNovaMensagem(false);
    toast.success("Mensagem salva!");
  };

  const handleExcluirMensagem = (id: string) => {
    saveMensagens(mensagens.filter(m => m.id !== id));
    toast.success("Mensagem excluída!");
  };

  const handleSalvarFluxo = () => {
    saveFluxo(fluxoEtapas);
    toast.success("Fluxo de recrutamento salvo!");
  };

  const handleFluxoChange = (id: string, campo: 'titulo' | 'texto', valor: string) => {
    setFluxoEtapas(fluxoEtapas.map(e => e.id === id ? { ...e, [campo]: valor } : e));
  };

  const categorias = ["Captação de prestadores", "Operacional", "Ocorrências", "Financeiro", "Clientes"];
  
  const mensagensFiltradas = filtroCategoria === "todas" 
    ? mensagens 
    : mensagens.filter(m => m.categoria === filtroCategoria);

  const getDocIcon = (tipo: string) => {
     if(tipo.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
     if(tipo.includes("image")) return <Image className="w-5 h-5 text-blue-500" />;
     if(tipo.includes("video")) return <Video className="w-5 h-5 text-purple-500" />;
     return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const getCategoriaIcon = (categoria: string) => {
    if (categoria.includes("Captação")) return <Users className="w-4 h-4" />;
    if (categoria.includes("Operacional")) return <Truck className="w-4 h-4" />;
    if (categoria.includes("Financeiro")) return <DollarSign className="w-4 h-4" />;
    if (categoria.includes("Ocorrência")) return <ShieldAlert className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  const renderBibliotecaTable = (docs: any[]) => (
     <Card>
       <CardHeader className="flex flex-row justify-between items-center py-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome de documento ou tag..." className="pl-9 h-9" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Filter className="w-4 h-4 mr-1"/> Categorias</Button>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white"><Upload className="w-4 h-4 mr-1"/> Subir Arquivo</Button>
          </div>
       </CardHeader>
       <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome e Descrição</TableHead><TableHead>Categoria / Pasta</TableHead><TableHead>Modificado Em</TableHead><TableHead>Tamanho Autorizado</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
            <TableBody>
              {docs.map(d => (
                <TableRow key={d?.id || Math.random()}>
                  <TableCell>{getDocIcon(d?.tipo || "file")}</TableCell>
                  <TableCell>
                    <p className="font-bold text-sm text-slate-800">{d?.nome || d?.titulo || "Documento sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate w-48 lg:w-96">{d?.desc || ""}</p>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono text-[10px]"><Folder className="w-3 h-3 mr-1 inline"/> {d?.cat || "-"}</Badge></TableCell>
                  <TableCell className="text-xs">{d?.data || "-"}</TableCell>
                  <TableCell className="text-xs">{d?.tamanho || "-"}</TableCell>
                  <TableCell className="text-right">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600"><Download className="w-4 h-4"/></Button>
                     {d?.admin && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50"><Trash className="w-4 h-4"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {docs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground border-dashed border-2">Nenhum documento nessa restrição/categoria.</TableCell></TableRow>}
            </TableBody>
          </Table>
       </CardContent>
     </Card>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Library className="w-8 h-8 text-orange-500" /> Biblioteca de Manuais e Arquivos
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">Hospedagem unificada e versionada de anexos cruciais da empresa.</p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-card justify-start overflow-x-auto border-b rounded-none w-full">
           <TabsTrigger value="operacional" className="px-5"><ShieldAlert className="w-4 h-4 mr-2"/> Central Operacional</TabsTrigger>
           <TabsTrigger value="prestador" className="px-5"><Folder className="w-4 h-4 mr-2"/> Pasta do Prestador (App)</TabsTrigger>
           <TabsTrigger value="cliente" className="px-5"><Folder className="w-4 h-4 mr-2"/> Pasta do Cliente (Portal)</TabsTrigger>
           <TabsTrigger value="modelos" className="px-5"><FileText className="w-4 h-4 mr-2"/> Modelos e Templates</TabsTrigger>
           <TabsTrigger value="mensagens" className="px-5"><MessageSquare className="w-4 h-4 mr-2"/> Mensagens Rápidas</TabsTrigger>
           <TabsTrigger value="fluxo" className="px-5"><Users className="w-4 h-4 mr-2"/> Fluxo de Recrutamento</TabsTrigger>
        </TabsList>

        <TabsContent value="operacional" className="pt-4">
           <Card className="mb-4 bg-orange-50/50 border-orange-200">
             <CardContent className="p-4 text-sm text-orange-900 font-medium max-w-3xl">PGRs Oficiais, Procedimentos Operacionais Padrão (POP), e Guias Internos da Transportadora. Reservado apenas para logins corporativos.</CardContent>
           </Card>
           {renderBibliotecaTable([
             { id: 1, nome: "PGR Corporativo Versão 2.1", desc: "Plano de Gerenciamento de Risco Integrado com a Seguradora", tipo: "pdf", cat: "SGR / Risco", data: "26/03/2026", tamanho: "2.4 MB", admin: true },
             { id: 2, nome: "Guia de Cubagem Prática", desc: "Como conferir volumes x peso de mercadorias atípicas na rodo", tipo: "pdf", cat: "Mesa Treinamento", data: "10/01/2026", tamanho: "600 KB", admin: true },
             { id: 3, nome: "Videoaulas Supabase ERP", desc: "Link para playlists do time de dev", tipo: "video", cat: "Treinamento Módulos", data: "27/03/2026", tamanho: "URL Externa", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="prestador" className="pt-4">
           {renderBibliotecaTable([
             { id: 10, nome: "Regulamento do Agregado SP", desc: "Regras de convivência, estadias e fardamento obrigatório", tipo: "pdf", cat: "Onboarding Motoristas", data: "12/02/2026", tamanho: "1.2 MB", admin: true },
             { id: 11, nome: "Tutorial de Baixa de Ocorrência", desc: "Como reportar chuva ou transito via WhatsApp", tipo: "image", cat: "Infográficos", data: "22/03/2026", tamanho: "150 KB", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="cliente" className="pt-4">
           {renderBibliotecaTable([
             { id: 20, nome: "Apresentação Institucional 2026", desc: "Nosso deck pra fechar com C-Levels", tipo: "pdf", cat: "Materiais Venda", data: "05/01/2026", tamanho: "5.1 MB", admin: true },
             { id: 21, nome: "SLA Operacional Standard.pdf", desc: "Qualidade de Entrega vs Reversas Prazo Comum", tipo: "pdf", cat: "Políticas SLA Púb.", data: "18/03/2026", tamanho: "15 MB", admin: true },
           ])}
        </TabsContent>

        <TabsContent value="modelos" className="pt-4">
           {renderBibliotecaTable([])}
        </TabsContent>

        {/* --- MENSAGENS RÁPIDAS --- */}
        <TabsContent value="mensagens" className="pt-4 space-y-4">
           <Card>
             <CardHeader className="flex flex-row items-center justify-between">
               <div>
                 <CardTitle className="text-lg flex items-center gap-2">
                   <MessageSquare className="w-5 h-5 text-primary" />
                   Mensagens Rápidas para WhatsApp
                 </CardTitle>
                 <CardDescription>Modelos de mensagens prontos para copiar e enviar.</CardDescription>
               </div>
               <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNovaMensagem}>
                 <Plus className="w-4 h-4 mr-2" /> Nova Mensagem
               </Button>
             </CardHeader>
             <CardContent>
               <div className="flex gap-4 mb-6">
                 <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                   <SelectTrigger className="w-64"><SelectValue placeholder="Filtrar por categoria" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="todas">Todas as categorias</SelectItem>
                     {categorias.map(cat => (
                       <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {mensagensFiltradas.map((msg) => (
                   <Card key={msg.id} className="border-l-4 border-l-orange-500">
                     <CardHeader className="pb-2">
                       <div className="flex items-center justify-between">
                         <Badge variant="secondary" className="flex items-center gap-1">
                           {getCategoriaIcon(msg.categoria)}
                           {msg.categoria}
                         </Badge>
                         <div className="flex gap-1">
                           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(msg.texto)}>
                             <Copy className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleExcluirMensagem(msg.id)}>
                             <Trash className="w-4 h-4" />
                           </Button>
                         </div>
                       </div>
                       <CardTitle className="text-sm mt-2">{msg.titulo}</CardTitle>
                     </CardHeader>
                     <CardContent>
                       <p className="text-xs text-muted-foreground line-clamp-3">{msg.texto}</p>
                       <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => copyToClipboard(msg.texto)}>
                         <Copy className="w-4 h-4 mr-2" /> Copiar Mensagem
                       </Button>
                     </CardContent>
                   </Card>
                 ))}
               </div>

               {mensagensFiltradas.length === 0 && (
                 <div className="text-center py-12 text-muted-foreground">
                   <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                   <p>Nenhuma mensagem encontrada.</p>
                 </div>
               )}
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- FLUXO DE RECRUTAMENTO --- */}
        <TabsContent value="fluxo" className="pt-4 space-y-4">
           <Card>
             <CardHeader>
               <CardTitle className="text-lg flex items-center gap-2">
                 <Users className="w-5 h-5 text-primary" />
                 Fluxo de Recrutamento de Prestadores
               </CardTitle>
               <CardDescription>
                 Passo a passo padrão para captação e onboarding de novos prestadores. Edite os textos e clique em salvar.
               </CardDescription>
             </CardHeader>
             <CardContent>
               <div className="space-y-4">
                 {fluxoEtapas.sort((a, b) => a.ordem - b.ordem).map((etapa, index) => (
                   <div key={etapa.id} className="relative">
                     <div className="flex items-start gap-4">
                       <div className="flex flex-col items-center">
                         <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                           {etapa.ordem}
                         </div>
                         {index < fluxoEtapas.length - 1 && (
                           <div className="w-0.5 h-16 bg-orange-200 mt-2"></div>
                         )}
                       </div>
                       <Card className="flex-1">
                         <CardHeader className="pb-2">
                           <Input 
                             value={etapa.titulo} 
                             onChange={(e) => handleFluxoChange(etapa.id, 'titulo', e.target.value)}
                             className="font-bold text-lg border-0 focus-visible:ring-0 px-0"
                           />
                         </CardHeader>
                         <CardContent>
                           <Textarea 
                             value={etapa.texto} 
                             onChange={(e) => handleFluxoChange(etapa.id, 'texto', e.target.value)}
                             className="min-h-[80px] text-sm"
                             placeholder="Digite a mensagem padrão desta etapa..."
                           />
                           <Button variant="outline" size="sm" className="mt-3" onClick={() => copyToClipboard(etapa.texto)}>
                             <Copy className="w-4 h-4 mr-2" /> Copiar Mensagem
                           </Button>
                         </CardContent>
                       </Card>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="flex justify-end mt-6">
                 <Button className="bg-green-600 hover:bg-green-700" onClick={handleSalvarFluxo}>
                   <Save className="w-4 h-4 mr-2" /> Salvar Alterações
                 </Button>
               </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* Nova Mensagem Modal */}
      <Dialog open={showNovaMensagem} onOpenChange={setShowNovaMensagem}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Mensagem Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input 
                value={mensagemEditando?.titulo || ''} 
                onChange={(e) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, titulo: e.target.value } : null)}
                placeholder="Ex: Bem-vindo à equipe"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={mensagemEditando?.categoria || 'Operacional'} 
                onValueChange={(v) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, categoria: v } : null)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea 
                value={mensagemEditando?.texto || ''} 
                onChange={(e) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, texto: e.target.value } : null)}
                placeholder="Digite a mensagem usando variavel para dados dinâmicos..."
                className="min-h-[120px]"
              />
              <p className="text-xs text-muted-foreground">Use {"{{nome}}"}, {"{{os}}"}, {"{{valor}}"}, {"{{origem}}"}, {"{{destino}}"} como variáveis.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNovaMensagem(false)}>Cancelar</Button>
            <Button onClick={handleSalvarMensagem}>Salvar Mensagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
