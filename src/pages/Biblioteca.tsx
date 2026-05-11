import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Library, Folder, Upload, Download, Search, FileText, Image, Video, ShieldAlert, Trash, Filter, Plus, Copy, MessageSquare, Users, Truck, Package, DollarSign, Send, Check, ChevronRight, ArrowRight, Save, Pencil, X } from "lucide-react";
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
import { supabase } from "@/lib/supabase";

interface MensagemRapida {
  id: string;
  titulo: string;
  categoria: string;
  texto: string;
  cliente_id?: string | null;
  cliente_nome?: string | null;
  cliente_documento?: string | null;
}

interface Cliente {
  id: string;
  razao_social?: string;
  nome_fantasia?: string;
  cnpj_cpf?: string;
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

const CATEGORIA_CORES: Record<string, string> = {
  "Captação de prestadores": "bg-blue-100 text-blue-700 border-blue-300",
  "Operacional": "bg-orange-100 text-orange-700 border-orange-300",
  "Ocorrências": "bg-red-100 text-red-700 border-red-300",
  "Financeiro": "bg-green-100 text-green-700 border-green-300",
  "Clientes": "bg-purple-100 text-purple-700 border-purple-300",
};

const CATEGORIA_BORDA: Record<string, string> = {
  "Captação de prestadores": "border-l-blue-500",
  "Operacional": "border-l-orange-500",
  "Ocorrências": "border-l-red-500",
  "Financeiro": "border-l-green-500",
  "Clientes": "border-l-purple-500",
};

export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacional";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  const [mensagens, setMensagens] = useState<MensagemRapida[]>([]);
  const [fluxoEtapas, setFluxoEtapas] = useState<FluxoEtapa[]>([]);
  const [showNovaMensagem, setShowNovaMensagem] = useState(false);
  const [mensagemEditando, setMensagemEditando] = useState<MensagemRapida | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Record<string, any[]>>({
    operacional: [],
    prestador: [],
    cliente: [],
    modelos: [],
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bucketExists, setBucketExists] = useState(true);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setIsLoading(true);
    let usouSupabaseMsgs = false;
    let usouSupabaseFluxo = false;

    // Helper para verificar se é erro de tabela inexistente
    const isTabelaInexistente = (error: any) => {
      if (!error) return false;
      const msg = error.message || String(error);
      const code = error.code || '';
      return code === '42P01' || code === '404' || msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation') || msg.toLowerCase().includes('tabela');
    };

    try {
      // Carregar mensagens do Supabase
      const { data: msgsData, error: msgsError } = await supabase
        .from('modelos_mensagens')
        .select('*')
        .order('created_at', { ascending: true });

      if (!msgsError && msgsData && msgsData.length > 0) {
        const loaded = msgsData.map((m: any) => ({
          id: m.id,
          titulo: m.titulo,
          categoria: m.categoria,
          texto: m.texto,
          cliente_id: m.cliente_id || null,
          cliente_nome: m.cliente_nome || null,
          cliente_documento: m.cliente_documento || null
        }));
        setMensagens(loaded);
        localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(loaded));
        usouSupabaseMsgs = true;
        console.log('[MENSAGENS RAPIDAS] Fonte usada: Supabase');
      } else {
        if (isTabelaInexistente(msgsError)) {
          console.warn('[MENSAGENS RAPIDAS] Tabela modelos_mensagens não encontrada no Supabase. Usando localStorage.');
        } else {
          console.warn('[MENSAGENS RAPIDAS] Erro ao carregar do Supabase:', msgsError?.message);
        }
        throw new Error(msgsError?.message || 'Tabela vazia ou inexistente');
      }
    } catch (error: any) {
      if (!isTabelaInexistente(error)) {
        console.warn('[MENSAGENS RAPIDAS] Supabase falhou, tentando localStorage:', error);
      }
      const local = localStorage.getItem('conexao_mensagens_rapidas');
      if (local) {
        try {
          setMensagens(JSON.parse(local));
          console.log('[MENSAGENS RAPIDAS] Fonte usada: localStorage');
        } catch {
          setMensagens(MENSAGENS_DEFAULT);
          localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(MENSAGENS_DEFAULT));
          console.log('[MENSAGENS RAPIDAS] Fonte usada: defaults');
        }
      } else {
        setMensagens(MENSAGENS_DEFAULT);
        localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(MENSAGENS_DEFAULT));
        console.log('[MENSAGENS RAPIDAS] Fonte usada: defaults (primeiro acesso)');
      }
    }

    try {
      // Carregar fluxo de recrutamento do Supabase
      const { data: fluxoData, error: fluxoError } = await supabase
        .from('fluxo_recrutamento')
        .select('*')
        .order('ordem', { ascending: true });

      if (!fluxoError && fluxoData && fluxoData.length > 0) {
        const loaded = fluxoData.map((f: any) => ({
          id: f.id,
          titulo: f.titulo,
          texto: f.texto,
          ordem: f.ordem
        }));
        setFluxoEtapas(loaded);
        localStorage.setItem('conexao_fluxo_recrutamento', JSON.stringify(loaded));
        usouSupabaseFluxo = true;
      } else {
        throw new Error(fluxoError?.message || 'Tabela vazia');
      }
    } catch {
      const local = localStorage.getItem('conexao_fluxo_recrutamento');
      if (local) {
        try { setFluxoEtapas(JSON.parse(local)); } catch { setFluxoEtapas(FLUXO_DEFAULT); }
      } else {
        setFluxoEtapas(FLUXO_DEFAULT);
        localStorage.setItem('conexao_fluxo_recrutamento', JSON.stringify(FLUXO_DEFAULT));
      }
    }

    console.log(`[BIBLIOTECA] Dados carregados — Msgs: ${usouSupabaseMsgs ? 'Supabase' : 'localStorage'} | Fluxo: ${usouSupabaseFluxo ? 'Supabase' : 'localStorage'}`);

    try {
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj_cpf')
        .order('nome_fantasia', { ascending: true });
      if (clientesData) {
        setClientes(clientesData);
      }
    } catch (e) {
      console.warn('[BIBLIOTECA] Erro ao carregar clientes:', e);
    }

    setIsLoading(false);
  };

  const saveMensagens = async (novas: MensagemRapida[]) => {
    setMensagens(novas);
    // Sempre salvar no localStorage (garante persistência imediata)
    localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(novas));
    console.log('[MENSAGENS RAPIDAS] Salvo em localStorage');
    // Tentar Supabase em background (best-effort)
    try {
      const results = await Promise.all(
        novas.map(msg =>
          supabase
            .from('modelos_mensagens')
            .upsert([{
              id: msg.id,
              titulo: msg.titulo,
              categoria: msg.categoria,
              texto: msg.texto,
              cliente_id: msg.cliente_id || null,
              cliente_nome: msg.cliente_nome || null,
              cliente_documento: msg.cliente_documento || null,
              updated_at: new Date().toISOString()
            }], { onConflict: 'id' })
        )
      );

      const hasError = results.some(r => r.error);
      if (hasError) {
        const errorCodes = results.filter(r => r.error).map(r => r.error?.code || r.error?.message).join(', ');
        if (errorCodes.includes('42P01') || errorCodes.includes('404') || errorCodes.toLowerCase().includes('not found') || errorCodes.toLowerCase().includes('does not exist')) {
          toast.warning('Tabela de mensagens não encontrada. Salvando localmente neste navegador.');
          console.warn('[MENSAGENS RAPIDAS] Tabela não existe no Supabase, usando localStorage');
        } else {
          console.warn('[MENSAGENS RAPIDAS] Supabase sync falhou (localStorage já salvo):', errorCodes);
        }
      } else {
        console.log('[MENSAGENS RAPIDAS] Sincronizado com Supabase');
      }
    } catch (e: any) {
      const msgErro = e?.message || String(e);
      if (msgErro.includes('42P01') || msgErro.includes('404') || msgErro.toLowerCase().includes('not found') || msgErro.toLowerCase().includes('does not exist')) {
        toast.warning('Tabela de mensagens não encontrada. Salvando localmente neste navegador.');
        console.warn('[MENSAGENS RAPIDAS] Tabela não existe no Supabase, usando localStorage');
      } else {
        console.warn('[MENSAGENS RAPIDAS] Supabase sync falhou (localStorage já salvo):', e);
      }
    }
  };

  const saveFluxo = async (novoFluxo: FluxoEtapa[]) => {
    setFluxoEtapas(novoFluxo);
    localStorage.setItem('conexao_fluxo_recrutamento', JSON.stringify(novoFluxo));
    try {
      for (const etapa of novoFluxo) {
        await supabase
          .from('fluxo_recrutamento')
          .upsert([{
            id: etapa.id,
            titulo: etapa.titulo,
            texto: etapa.texto,
            ordem: etapa.ordem,
            updated_at: new Date().toISOString()
          }], { onConflict: 'id' });
      }
      console.log('[BIBLIOTECA] Fluxo sincronizado com Supabase');
    } catch (e) {
      console.warn('[BIBLIOTECA] Fluxo Supabase sync falhou (localStorage já salvo):', e);
    }
  };

  const copyToClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Mensagem copiada!");
  };

  const BUCKET_NAME = "biblioteca-global";

  const getStoragePath = (tab: string) => {
    const paths: Record<string, string> = {
      operacional: "central-operacional",
      prestador: "pasta-prestador",
      cliente: "pasta-cliente",
      modelos: "modelos-templates",
    };
    return paths[tab] || "outros";
  };

  const loadDocuments = async (tab: string) => {
    if (!bucketExists) return;
    try {
      const path = getStoragePath(tab);
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(path, { limit: 100 });

      if (error) {
        if (error.message.includes("bucket")) {
          console.warn("[BIBLIOTECA] Bucket não encontrado:", error.message);
          setBucketExists(false);
          toast.warning("Bucket biblioteca-global não encontrado. Configure o Supabase Storage.");
          return;
        }
        console.error("[BIBLIOTECA] Erro ao listar:", error);
        return;
      }

      if (data && data.length > 0) {
        const docsWithDetails = await Promise.all(
          data.map(async (file) => {
            const { data: urlData } = supabase.storage
              .from(BUCKET_NAME)
              .getPublicUrl(`${path}/${file.name}`);
            return {
              id: file.id,
              nome: file.name,
              caminho: `${path}/${file.name}`,
              url: urlData.publicUrl,
              tamanho: file.metadata?.size ? formatFileSize(file.metadata.size) : "-",
              data: file.updated_at ? new Date(file.updated_at).toLocaleDateString("pt-BR") : "-",
              tipo: getFileType(file.name),
            };
          })
        );
        setDocumentos(prev => ({ ...prev, [tab]: docsWithDetails }));
      } else {
        setDocumentos(prev => ({ ...prev, [tab]: [] }));
      }
      console.log(`[BIBLIOTECA] Carregados ${data?.length || 0} arquivos de ${path}`);
    } catch (err) {
      console.error("[BIBLIOTECA] Erro ao carregar documentos:", err);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileType = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(ext)) return "pdf";
    if (["doc", "docx"].includes(ext)) return "doc";
    if (["xls", "xlsx"].includes(ext)) return "xls";
    if (["png", "jpg", "jpeg", "gif"].includes(ext)) return "image";
    if (["mp4", "webm", "avi"].includes(ext)) return "video";
    return "file";
  };

  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>, tab: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "text/plain",
      "text/xml",
      "application/xml",
    ];

    // Também aceitar por extensão (xml pode ter mime variado)
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['pdf','doc','docx','xls','xlsx','png','jpg','jpeg','txt','xml'];
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast.error("Tipo de arquivo não permitido. Use PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG, XML ou TXT.");
      return;
    }

    setIsUploading(true);
    const fileId = Date.now().toString();
    setUploadingProgress(prev => ({ ...prev, [fileId]: 0 }));

    try {
      const path = getStoragePath(tab);
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${timestamp}_${safeName}`;
      const fullPath = `${path}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fullPath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        if (error.message.includes("bucket") || error.message.includes("not found")) {
          console.warn("[BIBLIOTECA] Bucket não encontrado:", error.message);
          setBucketExists(false);
          toast.error("Bucket 'biblioteca-global' não encontrado. Crie o bucket no Supabase Storage.");
          return;
        }
        console.error("[BIBLIOTECA] Erro ao fazer upload:", error);
        toast.error("Erro ao enviar arquivo: " + error.message);
        return;
      }

      setUploadingProgress(prev => ({ ...prev, [fileId]: 100 }));
      toast.success("Arquivo enviado com sucesso!");
      
      await loadDocuments(tab);
      console.log(`[BIBLIOTECA] Upload concluído: ${fileName}`);
    } catch (err: any) {
      console.error("[BIBLIOTECA] Erro no upload:", err);
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadingProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadFile = async (doc: any) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(doc.caminho, 60);

      if (error) {
        console.error("[BIBLIOTECA] Erro ao gerar link:", error);
        toast.error("Não foi possível baixar o arquivo.");
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
        console.log(`[BIBLIOTECA] Download: ${doc.nome}`);
      }
    } catch (err) {
      console.error("[BIBLIOTECA] Erro no download:", err);
      toast.error("Não foi possível baixar o arquivo.");
    }
  };

  const handleDeleteFile = async (doc: any, tab: string) => {
    const confirmar = window.confirm(`Tem certeza que deseja excluir "${doc.nome}"?`);
    if (!confirmar) return;

    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([doc.caminho]);

      if (error) {
        console.error("[BIBLIOTECA] Erro ao excluir:", error);
        toast.error("Erro ao excluir arquivo: " + error.message);
        return;
      }

      toast.success("Arquivo excluído com sucesso!");
      await loadDocuments(tab);
      console.log(`[BIBLIOTECA] Excluído: ${doc.nome}`);
    } catch (err) {
      console.error("[BIBLIOTECA] Erro na exclusão:", err);
      toast.error("Erro ao excluir arquivo.");
    }
  };

  useEffect(() => {
    if (bucketExists && currentTab && ["operacional", "prestador", "cliente", "modelos"].includes(currentTab)) {
      loadDocuments(currentTab);
    }
  }, [currentTab, bucketExists]);

  const handleNovaMensagem = () => {
    const nova: MensagemRapida = {
      id: Date.now().toString(),
      titulo: "Nova mensagem",
      categoria: "Operacional",
      texto: "Digite sua mensagem aqui...",
      cliente_id: null,
      cliente_nome: null,
      cliente_documento: null
    };
    setMensagemEditando(nova);
    setShowNovaMensagem(true);
  };

  const handleSalvarMensagem = () => {
    if (!mensagemEditando) return;
    if (!mensagemEditando.titulo?.trim() || !mensagemEditando.texto?.trim()) {
      toast.error("Título e mensagem são obrigatórios!");
      return;
    }
    
    const isEdicao = mensagens.some(m => m.id === mensagemEditando.id);
    const existentes = mensagens.filter(m => m.id !== mensagemEditando.id);
    const msgNormalizada = { ...mensagemEditando, titulo: mensagemEditando.titulo.trim(), texto: mensagemEditando.texto.trim() };
    saveMensagens([...existentes, msgNormalizada]);
    setMensagemEditando(null);
    setEditandoId(null);
    setShowNovaMensagem(false);
    console.log(`[MENSAGENS RAPIDAS] Mensagem ${isEdicao ? 'editada' : 'criada'}: ${msgNormalizada.titulo}`);
    toast.success(isEdicao ? "Mensagem atualizada com sucesso!" : "Mensagem criada com sucesso!");
  };

  const handleExcluirMensagem = (id: string) => {
    const msg = mensagens.find(m => m.id === id);
    console.log(`[MENSAGENS RAPIDAS] Mensagem excluída: ${msg?.titulo || id}`);
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
  
  const mensagensFiltradas = mensagens.filter(m => {
    const matchCategoria = filtroCategoria === "todas" || m.categoria === filtroCategoria;
    const matchCliente = filtroCliente === "todos" || !m.cliente_id || m.cliente_id === filtroCliente;
    return matchCategoria && matchCliente;
  });

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

const renderBibliotecaTable = (tab: string, demoDocs: any[]) => {
    const tabDocs = documentos[tab] || [];
    const hasRealDocs = tabDocs.length > 0;
    // Combinar: arquivos reais primeiro, depois demos marcados
    const demosMarcados = demoDocs.map(d => ({ ...d, _isDemo: true }));
    const displayDocs = hasRealDocs ? [...tabDocs, ...demosMarcados] : demosMarcados;

    const handleDocDownload = (d: any) => {
      if (d._isDemo) {
        toast.info("Arquivo demonstrativo sem anexo real. Faça upload de um arquivo para esta pasta.");
        return;
      }
      if (d.caminho) {
        handleDownloadFile(d);
      } else {
        toast.info("Arquivo sem caminho de storage.");
      }
    };

    const handleDocDelete = (d: any) => {
      if (d._isDemo) {
        toast.info("Arquivo demonstrativo não pode ser excluído.");
        return;
      }
      handleDeleteFile(d, tab);
    };

    return (
      <Card>
        <CardHeader className="flex flex-row justify-between items-center py-4">
           <div className="relative w-full max-w-md">
             <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Buscar por nome de documento ou tag..." className="pl-9 h-9" />
           </div>
           <div className="flex gap-2">
             <Button variant="outline" type="button"><Filter className="w-4 h-4 mr-1"/> Categorias</Button>
             <div className="relative">
               <input
                 ref={fileInputRef}
                 type="file"
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.xml"
                 className="hidden"
                 onChange={(e) => { e.stopPropagation(); handleUploadFile(e, tab); }}
                 disabled={isUploading}
               />
               <Button 
                 type="button"
                 className="bg-orange-500 hover:bg-orange-600 text-white"
                 onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
                 disabled={isUploading}
               >
                 {isUploading ? (
                   <>
                     <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                     Enviando...
                   </>
                 ) : (
                   <><Upload className="w-4 h-4 mr-1"/> Subir Arquivo</>
                 )}
               </Button>
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
           <Table>
             <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome e Descrição</TableHead><TableHead>Categoria / Pasta</TableHead><TableHead>Modificado Em</TableHead><TableHead>Tamanho</TableHead><TableHead className="text-right">Ação</TableHead></TableRow></TableHeader>
             <TableBody>
               {displayDocs.map((d: any, idx: number) => (
                 <TableRow key={d?.id || `doc-${idx}`} className={d._isDemo ? "opacity-60" : ""}>
                   <TableCell>{getDocIcon(d?.tipo || "file")}</TableCell>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       <p className="font-bold text-sm text-slate-800">{d?.nome || d?.titulo || "Documento sem nome"}</p>
                       {d._isDemo && <Badge variant="outline" className="text-[9px] py-0 text-slate-400">Demo</Badge>}
                     </div>
                     {d?.desc && <p className="text-xs text-muted-foreground truncate w-48 lg:w-96">{d.desc}</p>}
                   </TableCell>
                   <TableCell><Badge variant="secondary" className="bg-slate-100 text-slate-700 font-mono text-[10px]"><Folder className="w-3 h-3 mr-1 inline"/> {d?.cat || "-"}</Badge></TableCell>
                   <TableCell className="text-xs">{d?.data || "-"}</TableCell>
                   <TableCell className="text-xs">{d?.tamanho || "-"}</TableCell>
                   <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-blue-600"
                        onClick={() => handleDocDownload(d)}
                        title={d._isDemo ? "Arquivo demonstrativo" : "Baixar"}
                        type="button"
                      >
                        <Download className="w-4 h-4"/>
                      </Button>
                      {!d._isDemo && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-red-600 hover:bg-red-50"
                          onClick={() => handleDocDelete(d)}
                          title="Excluir"
                          type="button"
                        >
                          <Trash className="w-4 h-4"/>
                        </Button>
                      )}
                   </TableCell>
                 </TableRow>
               ))}
               {displayDocs.length === 0 && (
                 <TableRow>
                   <TableCell colSpan={6} className="text-center py-12 text-muted-foreground border-dashed border-2">
                     Nenhum documento encontrado. Use "Subir Arquivo" para adicionar.
                   </TableCell>
                 </TableRow>
               )}
             </TableBody>
           </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 w-full px-6">
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
{renderBibliotecaTable("operacional", [
              { id: 1, nome: "PGR Corporativo Versão 2.1", desc: "Plano de Gerenciamento de Risco Integrado com a Seguradora", tipo: "pdf", cat: "SGR / Risco", data: "26/03/2026", tamanho: "2.4 MB", admin: true },
              { id: 2, nome: "Guia de Cubagem Prática", desc: "Como conferir volumes x peso de mercadorias atípicas na rodo", tipo: "pdf", cat: "Mesa Treinamento", data: "10/01/2026", tamanho: "600 KB", admin: true },
              { id: 3, nome: "Videoaulas Supabase ERP", desc: "Link para playlists do time de dev", tipo: "video", cat: "Treinamento Módulos", data: "27/03/2026", tamanho: "URL Externa", admin: true },
            ])}
        </TabsContent>

        <TabsContent value="prestador" className="pt-4">
{renderBibliotecaTable("prestador", [
              { id: 10, nome: "Regulamento do Agregado SP", desc: "Regras de convivência, estadias e fardamento obrigatório", tipo: "pdf", cat: "Onboarding Motoristas", data: "12/02/2026", tamanho: "1.2 MB", admin: true },
              { id: 11, nome: "Tutorial de Baixa de Ocorrência", desc: "Como reportar chuva ou transito via WhatsApp", tipo: "image", cat: "Infográficos", data: "22/03/2026", tamanho: "150 KB", admin: true },
            ])}
        </TabsContent>

        <TabsContent value="cliente" className="pt-4">
{renderBibliotecaTable("cliente", [
              { id: 20, nome: "Apresentação Institucional 2026", desc: "Nosso deck pra fechar com C-Levels", tipo: "pdf", cat: "Materiais Venda", data: "05/01/2026", tamanho: "5.1 MB", admin: true },
              { id: 21, nome: "SLA Operacional Standard.pdf", desc: "Qualidade de Entrega vs Reversas Prazo Comum", tipo: "pdf", cat: "Políticas SLA Púb.", data: "18/03/2026", tamanho: "15 MB", admin: true },
            ])}
        </TabsContent>

        <TabsContent value="modelos" className="pt-4">
           {renderBibliotecaTable("modelos", [])}
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
                  <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="w-64"><SelectValue placeholder={clientes.length > 0 ? "Filtrar por cliente" : "Nenhum cliente"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os clientes</SelectItem>
                      {clientes.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground italic">Nenhum cliente cadastrado</div>
                      ) : (
                        clientes.map(cli => (
                          <SelectItem key={cli.id} value={cli.id}>
                            {(cli.nome_fantasia || cli.razao_social)} {cli.cnpj_cpf ? `/ ${cli.cnpj_cpf}` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mensagensFiltradas.map((msg) => {
                    const corCategoria = CATEGORIA_CORES[msg.categoria] || "bg-gray-100 text-gray-700 border-gray-300";
                    const bordaCategoria = CATEGORIA_BORDA[msg.categoria] || "border-l-gray-500";
                    return (
                      <Card key={msg.id} className={`border-l-4 ${bordaCategoria} hover:shadow-md transition-shadow ${editandoId === msg.id ? 'ring-2 ring-primary' : ''}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className={`flex items-center gap-1 ${corCategoria}`}>
                              {getCategoriaIcon(msg.categoria)}
                              {msg.categoria}
                            </Badge>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setMensagemEditando(msg); setShowNovaMensagem(true); setEditandoId(msg.id); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(msg.texto)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleExcluirMensagem(msg.id)}>
                                <Trash className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          {msg.cliente_nome ? (
                            <div className="mt-2">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs">
                                Cliente: {msg.cliente_nome}
                              </Badge>
                            </div>
                          ) : (
                            <div className="mt-2">
                              <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-300 text-xs">
                                Geral
                              </Badge>
                            </div>
                          )}
                          <CardTitle className="text-sm mt-2">{msg.titulo}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground line-clamp-3">{msg.texto}</p>
                          <div className="flex justify-between items-center mt-3">
                            <span className="text-xs text-muted-foreground">{msg.texto.length} caracteres</span>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(msg.texto)}>
                              <Copy className="w-4 h-4 mr-2" /> Copiar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
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
              <Label>Cliente vinculado</Label>
              <Select 
                value={mensagemEditando?.cliente_id || "nenhum"} 
                onValueChange={(v) => {
                  if (v === "nenhum") {
                    setMensagemEditando(mensagemEditando ? { ...mensagemEditando, cliente_id: null, cliente_nome: null, cliente_documento: null } : null);
                  } else {
                    const cliente = clientes.find(c => c.id === v);
                    setMensagemEditando(mensagemEditando ? { 
                      ...mensagemEditando, 
                      cliente_id: v,
                      cliente_nome: cliente?.nome_fantasia || cliente?.razao_social || null,
                      cliente_documento: cliente?.cnpj_cpf || null
                    } : null);
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder={clientes.length > 0 ? "Selecione um cliente" : "Nenhum cliente cadastrado"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Todos os clientes / Mensagem geral</SelectItem>
                  {clientes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground italic">Nenhum cliente cadastrado</div>
                  ) : (
                    clientes.map(cli => (
                      <SelectItem key={cli.id} value={cli.id}>
                        {(cli.nome_fantasia || cli.razao_social)} {cli.cnpj_cpf ? `/ ${cli.cnpj_cpf}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea 
                value={mensagemEditando?.texto || ''} 
                onChange={(e) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, texto: e.target.value } : null)}
                placeholder="Digite a mensagem usando variavel para dados dinâmicos... (sem limite de caracteres)"
                className="min-h-[120px] resize-y"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Use {"{{nome}}"}, {"{{os}}"}, {"{{valor}}"}, {"{{origem}}"}, {"{{destino}}"} como variáveis.</p>
                <p className="text-xs text-muted-foreground font-mono">{mensagemEditando?.texto?.length || 0} caracteres</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNovaMensagem(false); setMensagemEditando(null); setEditandoId(null); }}>Cancelar</Button>
            <Button onClick={handleSalvarMensagem}>Salvar Mensagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
