import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { 
  Library, Folder, Upload, Download, Search, FileText, Image, Video, 
  ShieldAlert, Trash, Filter, Plus, Copy, MessageSquare, Users, Truck, 
  Package, DollarSign, Send, Check, ChevronRight, ArrowRight, Save, 
  Pencil, X, Share2, ExternalLink, AlertCircle, Loader2 
} from "lucide-react";
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
  cnpj?: string;
  telefone?: string;
}

interface Prestador {
  id: string;
  nome_completo?: string;
  cpf_cnpj?: string;
  telefone?: string;
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
  "Captação de prestadores": "bg-blue-50 text-blue-700 border-blue-200",
  "Operacional": "bg-orange-50 text-orange-700 border-orange-200",
  "Ocorrências": "bg-red-50 text-red-700 border-red-200",
  "Financeiro": "bg-green-50 text-green-700 border-green-200",
  "Clientes": "bg-purple-50 text-purple-700 border-purple-200",
};

const CATEGORIA_BORDA: Record<string, string> = {
  "Captação de prestadores": "border-l-blue-500",
  "Operacional": "border-l-orange-500",
  "Ocorrências": "border-l-red-500",
  "Financeiro": "border-l-green-500",
  "Clientes": "border-l-purple-500",
};

const getDocIcon = (tipo: string) => {
  if (tipo.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  if (tipo.includes("image")) return <Image className="w-5 h-5 text-blue-500" />;
  if (tipo.includes("video")) return <Video className="w-5 h-5 text-purple-500" />;
  return <FileText className="w-5 h-5 text-slate-400" />;
};

const getCategoriaIcon = (categoria: string) => {
  if (categoria.includes("Captação")) return <Users className="w-4 h-4" />;
  if (categoria.includes("Operacional")) return <Truck className="w-4 h-4" />;
  if (categoria.includes("Financeiro")) return <DollarSign className="w-4 h-4" />;
  if (categoria.includes("Ocorrência")) return <ShieldAlert className="w-4 h-4" />;
  return <Package className="w-4 h-4" />;
};

export default function Biblioteca() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "operacional";
  const handleTabChange = (val: string) => setSearchParams({ tab: val });

  // Tabelas do banco de dados
  const [mensagens, setMensagens] = useState<MensagemRapida[]>([]);
  const [fluxoEtapas, setFluxoEtapas] = useState<FluxoEtapa[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  
  // Controle de estados
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [bucketExists, setBucketExists] = useState(true);
  
  // Modais de Edição
  const [showNovaMensagem, setShowNovaMensagem] = useState(false);
  const [mensagemEditando, setMensagemEditando] = useState<MensagemRapida | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
  // WhatsApp Export Dialog
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [whatsappDoc, setWhatsappDoc] = useState<any | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappMessage, setWhatsappMessage] = useState("");

  // Filtros e Categorias
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroCliente, setFiltroCliente] = useState("todos");
  
  // Filtros e Associações de Documentos por aba
  const [clienteFiltroId, setClienteFiltroId] = useState<string>("todos");
  const [prestadorFiltroId, setPrestadorFiltroId] = useState<string>("todos");
  const [selectedUploadCategory, setSelectedUploadCategory] = useState<string>("");
  const [selectedUploadClient, setSelectedUploadClient] = useState<string>("geral");
  const [selectedUploadProvider, setSelectedUploadProvider] = useState<string>("geral");
  const [searchQuery, setSearchQuery] = useState("");

  // Dicionário de arquivos reais
  const [documentos, setDocumentos] = useState<Record<string, any[]>>({
    operacional: [],
    prestador: [],
    cliente: [],
    modelos: [],
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const BUCKET_NAME = "biblioteca-global";

  // Categorias de Documento por Pasta
  const CATEGORIES_BY_TAB: Record<string, string[]> = {
    operacional: ["POP Operacional", "Plano de Risco (PGR)", "Manual de Treinamento", "Normas Internas", "Instrução de Segurança", "Outros"],
    prestador: ["CNH", "CRLV", "ANTT", "Comprovante de Residência", "Contrato de Adesão", "Outros"],
    cliente: ["Contrato Comercial", "Ficha Cadastral", "Tabela de Fretes", "Canhoto de Entrega", "Relatório de SLA", "Outros"],
    modelos: ["Template PDF", "Template Planilha (XLSX)", "Template Word (DOCX)", "Formulário", "Outros"],
  };

  useEffect(() => {
    // Definir categoria inicial com base na aba
    const cats = CATEGORIES_BY_TAB[currentTab];
    if (cats && cats.length > 0) {
      setSelectedUploadCategory(cats[0]);
    }
  }, [currentTab]);

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    if (["operacional", "prestador", "cliente", "modelos"].includes(currentTab)) {
      loadDocuments(currentTab);
    }
  }, [currentTab, bucketExists]);

  const isTabelaInexistente = (error: any) => {
    if (!error) return false;
    const msg = error.message || String(error);
    const code = error.code || '';
    return code === '42P01' || code === '404' || msg.includes('not found') || msg.includes('does not exist') || msg.includes('relation') || msg.toLowerCase().includes('tabela');
  };

  const carregarDados = async () => {
    setIsLoading(true);
    const missing: string[] = [];

    // 1. Diagnóstico de Tabelas no Supabase
    try {
      const { error: msgErr } = await supabase.from('modelos_mensagens').select('id').limit(1);
      if (msgErr && isTabelaInexistente(msgErr)) missing.push('modelos_mensagens');
      
      const { error: fluxoErr } = await supabase.from('fluxo_recrutamento').select('id').limit(1);
      if (fluxoErr && isTabelaInexistente(fluxoErr)) missing.push('fluxo_recrutamento');

      const { error: docsErr } = await supabase.from('biblioteca_documentos').select('id').limit(1);
      if (docsErr && isTabelaInexistente(docsErr)) missing.push('biblioteca_documentos');

      setMissingTables(missing);
    } catch (err) {
      console.warn("Erro ao fazer diagnóstico de tabelas:", err);
    }

    // 2. Carregar Mensagens Rápidas
    try {
      const { data: msgsData, error: msgsError } = await supabase
        .from('modelos_mensagens')
        .select('*')
        .order('created_at', { ascending: true });

      if (!msgsError && msgsData) {
        setMensagens(msgsData);
        localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(msgsData));
      } else {
        throw new Error(msgsError?.message || 'Tabela vazia');
      }
    } catch (error) {
      const local = localStorage.getItem('conexao_mensagens_rapidas');
      if (local) {
        setMensagens(JSON.parse(local));
      } else {
        setMensagens(MENSAGENS_DEFAULT);
      }
    }

    // 3. Carregar Etapas do Fluxo
    try {
      const { data: fluxoData, error: fluxoError } = await supabase
        .from('fluxo_recrutamento')
        .select('*')
        .order('ordem', { ascending: true });

      if (!fluxoError && fluxoData && fluxoData.length > 0) {
        setFluxoEtapas(fluxoData);
        localStorage.setItem('conexao_fluxo_recrutamento', JSON.stringify(fluxoData));
      } else {
        throw new Error(fluxoError?.message || 'Tabela vazia');
      }
    } catch {
      const local = localStorage.getItem('conexao_fluxo_recrutamento');
      if (local) {
        setFluxoEtapas(JSON.parse(local));
      } else {
        setFluxoEtapas(FLUXO_DEFAULT);
      }
    }

    // 4. Carregar Clientes
    try {
      const { data: clientesData } = await supabase
        .from('clientes')
        .select('id, razao_social, nome_fantasia, cnpj')
        .order('nome_fantasia', { ascending: true });
      if (clientesData) {
        setClientes(clientesData);
      }
    } catch (e) {
      console.warn('Erro ao carregar clientes:', e);
    }

    // 5. Carregar Prestadores
    try {
      const { data: prestadoresData } = await supabase
        .from('prestadores')
        .select('id, nome_completo, cpf_cnpj, telefone')
        .order('nome_completo', { ascending: true });
      if (prestadoresData) {
        setPrestadores(prestadoresData.map(p => ({
          id: p.id,
          nome_completo: p.nome_completo,
          cpf_cnpj: p.cpf_cnpj,
          telefone: p.telefone
        })));
      }
    } catch (e) {
      console.warn('Erro ao carregar prestadores:', e);
    }

    setIsLoading(false);
  };

  const getStoragePath = (tab: string) => {
    const paths: Record<string, string> = {
      operacional: "central-operacional",
      prestador: "pasta-prestador",
      cliente: "pasta-cliente",
      modelos: "modelos-templates",
    };
    return paths[tab] || "outros";
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
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return "image";
    if (["mp4", "webm", "avi"].includes(ext)) return "video";
    return "file";
  };

  // Carregar documentos
  const loadDocuments = async (tab: string) => {
    try {
      // 1. Tentar carregar metadados da tabela biblioteca_documentos no Supabase
      const { data: dbData, error: dbError } = await supabase
        .from('biblioteca_documentos')
        .select('*')
        .eq('pasta', tab)
        .order('created_at', { ascending: false });

      if (!dbError && dbData) {
        const docs = dbData.map(d => ({
          id: d.id,
          nome: d.nome,
          caminho: d.caminho,
          url: d.url,
          tamanho: d.tamanho,
          categoria: d.categoria,
          pasta: d.pasta,
          cliente_id: d.cliente_id,
          prestador_id: d.prestador_id,
          usuario_nome: d.usuario_nome || "Sistema",
          data: new Date(d.created_at).toLocaleDateString("pt-BR"),
          tipo: getFileType(d.nome),
        }));
        setDocumentos(prev => ({ ...prev, [tab]: docs }));
        return;
      }

      // 2. Se a tabela não existir, tentamos listar diretamente do storage (fallback)
      console.warn("[BIBLIOTECA] Erro na tabela, usando fallback direto do storage:", dbError?.message);
      if (!bucketExists) return;

      const path = getStoragePath(tab);
      const { data: storageData, error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(path, { limit: 100 });

      if (storageError) {
        if (storageError.message.includes("bucket") || storageError.message.includes("not found")) {
          setBucketExists(false);
        }
        return;
      }

      if (storageData) {
        const docs = storageData.map(file => {
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
            categoria: "Geral",
            usuario_nome: "Storage Fallback",
          };
        });
        setDocumentos(prev => ({ ...prev, [tab]: docs }));
      }
    } catch (err) {
      console.error("[BIBLIOTECA] Erro ao carregar documentos:", err);
    }
  };

  // Upload de arquivo
  const handleUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'xml', 'webp', 'mp4', 'avi'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExts.includes(ext)) {
      toast.error("Extensão de arquivo não permitida.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const path = getStoragePath(currentTab);
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const fileName = `${timestamp}_${safeName}`;
      const fullPath = `${path}/${fileName}`;

      setUploadProgress(30);

      // 1. Upload para o storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fullPath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setUploadProgress(70);

      // 2. Gerar URL pública
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fullPath);
      const publicUrl = urlData?.publicUrl || "";

      // 3. Salvar metadados na tabela
      const { error: dbError } = await supabase
        .from('biblioteca_documentos')
        .insert([{
          nome: file.name,
          caminho: fullPath,
          url: publicUrl,
          tamanho: formatFileSize(file.size),
          categoria: selectedUploadCategory || "Geral",
          pasta: currentTab,
          cliente_id: currentTab === 'cliente' && selectedUploadClient !== 'geral' ? selectedUploadClient : null,
          prestador_id: currentTab === 'prestador' && selectedUploadProvider !== 'geral' ? selectedUploadProvider : null,
          usuario_nome: "Administrador",
        }]);

      if (dbError) {
        console.warn("[BIBLIOTECA] Metadados não inseridos na tabela (provavelmente sem tabela):", dbError.message);
        toast.warning("Arquivo enviado para o storage, mas metadados não puderam ser salvos no banco.");
      } else {
        toast.success("Arquivo enviado e cadastrado com sucesso!");
      }

      setUploadProgress(100);
      await loadDocuments(currentTab);
    } catch (err: any) {
      console.error("[BIBLIOTECA] Erro no upload:", err);
      toast.error("Erro ao enviar arquivo: " + err.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Excluir arquivo
  const handleDeleteFile = async (doc: any) => {
    const confirmar = window.confirm(`Tem certeza que deseja excluir o arquivo "${doc.nome}"?`);
    if (!confirmar) return;

    try {
      // 1. Remover do Storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([doc.caminho]);

      if (storageError) {
        console.warn("[BIBLIOTECA] Erro ao remover do storage:", storageError.message);
      }

      // 2. Remover do Banco de Dados
      const { error: dbError } = await supabase
        .from('biblioteca_documentos')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        // Se a tabela não existir, podemos precisar encontrar uma forma de limpar o estado local
        console.error("[BIBLIOTECA] Erro ao excluir metadados do banco:", dbError.message);
      }

      toast.success("Arquivo excluído com sucesso!");
      await loadDocuments(currentTab);
    } catch (err: any) {
      console.error("[BIBLIOTECA] Erro na exclusão:", err);
      toast.error("Erro ao excluir arquivo.");
    }
  };

  // Abrir arquivo
  const handleOpenFile = (doc: any) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
    } else {
      toast.error("Link do arquivo não disponível.");
    }
  };

  // Compartilhar arquivo (Copiar link)
  const handleShareFile = (doc: any) => {
    if (doc.url) {
      navigator.clipboard.writeText(doc.url);
      toast.success("Link do arquivo copiado para a área de transferência!");
    } else {
      toast.error("Link indisponível para compartilhamento.");
    }
  };

  // Abrir modal de exportação WhatsApp
  const handleOpenWhatsAppExport = (doc: any) => {
    setWhatsappDoc(doc);
    setWhatsappMessage(`Olá! Segue o link para o arquivo "${doc.nome}":\n\n${doc.url}`);
    
    // Tentar localizar telefone do cliente/prestador vinculado
    let defaultPhone = "";
    if (doc.cliente_id) {
      const cli = clientes.find(c => c.id === doc.cliente_id);
      if (cli?.telefone) defaultPhone = cli.telefone;
    } else if (doc.prestador_id) {
      const prest = prestadores.find(p => p.id === doc.prestador_id);
      if (prest?.telefone) defaultPhone = prest.telefone;
    }
    
    setWhatsappPhone(defaultPhone);
    setShowWhatsAppDialog(true);
  };

  // Executar exportação de WhatsApp
  const handleConfirmWhatsAppExport = () => {
    if (!whatsappPhone.trim()) {
      toast.error("Por favor, digite o número do WhatsApp.");
      return;
    }
    
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    const finalPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    
    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(url, "_blank");
    setShowWhatsAppDialog(false);
    toast.success("Redirecionando para o WhatsApp...");
  };

  // Criar nova mensagem rápida
  const handleNovaMensagem = () => {
    setMensagemEditando({
      id: "",
      titulo: "",
      categoria: "Operacional",
      texto: "",
      cliente_id: null,
      cliente_nome: null,
      cliente_documento: null,
    });
    setEditandoId(null);
    setShowNovaMensagem(true);
  };

  // Salvar Mensagem Rápida
  const handleSalvarMensagem = async () => {
    if (!mensagemEditando) return;
    if (!mensagemEditando.titulo?.trim() || !mensagemEditando.texto?.trim()) {
      toast.error("Título e mensagem são obrigatórios!");
      return;
    }

    const idMsg = mensagemEditando.id || Date.now().toString();
    const msgNormalizada = {
      id: idMsg,
      titulo: mensagemEditando.titulo.trim(),
      categoria: mensagemEditando.categoria,
      texto: mensagemEditando.texto.trim(),
      cliente_id: mensagemEditando.cliente_id || null,
      cliente_nome: mensagemEditando.cliente_nome || null,
      cliente_documento: mensagemEditando.cliente_documento || null
    };

    // Atualizar localmente
    const novasMsgs = mensagens.some(m => m.id === idMsg)
      ? mensagens.map(m => m.id === idMsg ? msgNormalizada : m)
      : [...mensagens, msgNormalizada];
    
    setMensagens(novasMsgs);
    localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(novasMsgs));

    // Tentar persistência no Supabase
    try {
      const { error } = await supabase
        .from('modelos_mensagens')
        .upsert([{
          id: idMsg,
          titulo: msgNormalizada.titulo,
          categoria: msgNormalizada.categoria,
          texto: msgNormalizada.texto,
          cliente_id: msgNormalizada.cliente_id,
          cliente_nome: msgNormalizada.cliente_nome,
          cliente_documento: msgNormalizada.cliente_documento,
          updated_at: new Date().toISOString()
        }], { onConflict: 'id' });

      if (error) {
        if (isTabelaInexistente(error)) {
          toast.warning("Tabela modelos_mensagens não encontrada. Salvo localmente neste navegador.");
        } else {
          toast.error("Erro ao sincronizar com Supabase: " + error.message);
        }
      } else {
        toast.success("Mensagem salva e sincronizada com sucesso!");
      }
    } catch (e: any) {
      console.warn("Erro ao salvar mensagem no Supabase:", e);
    }

    setMensagemEditando(null);
    setEditandoId(null);
    setShowNovaMensagem(false);
  };

  // Excluir Mensagem Rápida
  const handleExcluirMensagem = async (id: string) => {
    const confirmar = window.confirm("Excluir esta mensagem rápida?");
    if (!confirmar) return;

    // Atualizar localmente
    const filtradas = mensagens.filter(m => m.id !== id);
    setMensagens(filtradas);
    localStorage.setItem('conexao_mensagens_rapidas', JSON.stringify(filtradas));

    // Tentar apagar no Supabase
    try {
      const { error } = await supabase
        .from('modelos_mensagens')
        .delete()
        .eq('id', id);

      if (error) {
        if (!isTabelaInexistente(error)) {
          toast.error("Erro ao deletar do Supabase: " + error.message);
        }
      } else {
        toast.success("Mensagem excluída do banco com sucesso.");
      }
    } catch (e) {
      console.warn("Erro ao deletar no Supabase:", e);
    }
  };

  // Salvar Fluxo de Recrutamento
  const handleSalvarFluxo = async () => {
    localStorage.setItem('conexao_fluxo_recrutamento', JSON.stringify(fluxoEtapas));
    
    try {
      let errosCount = 0;
      for (const etapa of fluxoEtapas) {
        const { error } = await supabase
          .from('fluxo_recrutamento')
          .upsert([{
            id: etapa.id,
            titulo: etapa.titulo,
            texto: etapa.texto,
            ordem: etapa.ordem,
            updated_at: new Date().toISOString()
          }], { onConflict: 'id' });
        
        if (error) errosCount++;
      }

      if (errosCount > 0) {
        toast.warning("Fluxo salvo localmente, mas ocorreram erros ao sincronizar com o banco.");
      } else {
        toast.success("Fluxo de recrutamento atualizado e salvo com sucesso!");
      }
    } catch (e) {
      console.warn("Erro ao salvar fluxo:", e);
      toast.error("Erro de sincronização.");
    }
  };

  const handleFluxoChange = (id: string, campo: 'titulo' | 'texto', valor: string) => {
    setFluxoEtapas(fluxoEtapas.map(e => e.id === id ? { ...e, [campo]: valor } : e));
  };

  const copyToClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto);
    toast.success("Mensagem copiada para transferência!");
  };

  // Filtros aplicados aos documentos listados
  const getFilteredDocs = () => {
    const list = documentos[currentTab] || [];
    
    return list.filter(doc => {
      // Filtro de busca de texto
      const matchSearch = searchQuery.trim() === "" || 
        doc.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (doc.categoria && doc.categoria.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filtro de cliente na aba de clientes
      const matchCliente = currentTab !== "cliente" || 
        clienteFiltroId === "todos" || 
        doc.cliente_id === clienteFiltroId;

      // Filtro de prestador na aba de prestadores
      const matchPrestador = currentTab !== "prestador" || 
        prestadorFiltroId === "todos" || 
        doc.prestador_id === prestadorFiltroId;

      return matchSearch && matchCliente && matchPrestador;
    });
  };

  const activeTabDocs = getFilteredDocs();

  return (
    <div className="space-y-6 w-full px-6 py-4">
      {/* Banner de Diagnóstico do Supabase */}
      {missingTables.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 shadow-sm animate-pulse">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h4 className="text-sm font-bold text-red-800">
                Tabelas do Módulo Ausentes no Supabase
              </h4>
              <p className="text-xs text-red-700 leading-relaxed">
                As tabelas <code className="font-mono bg-red-100 px-1 rounded">{missingTables.join(', ')}</code> não foram encontradas no banco remoto. 
                Por favor, acesse seu <strong>Supabase Dashboard &gt; SQL Editor</strong> e execute o script de migração completo localizado em 
                <span className="font-mono bg-red-100 px-1 rounded text-red-900 ml-1">supabase_biblioteca_fix.sql</span> na raiz deste projeto para estabilizar a persistência.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
            <Library className="w-8 h-8 text-orange-500" /> Biblioteca de Manuais e Arquivos
          </h1>
          <p className="text-sm text-slate-500">
            Hospedagem documental, templates, controle operacional e gerenciador de mensagens rápidas da transportadora.
          </p>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-slate-100/80 p-1 border rounded-xl w-full justify-start overflow-x-auto gap-1">
           <TabsTrigger value="operacional" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <ShieldAlert className="w-4 h-4 mr-2 text-orange-500"/> Central Operacional
           </TabsTrigger>
           <TabsTrigger value="prestador" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <Folder className="w-4 h-4 mr-2 text-blue-500"/> Pasta do Prestador (App)
           </TabsTrigger>
           <TabsTrigger value="cliente" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <Folder className="w-4 h-4 mr-2 text-purple-500"/> Pasta do Cliente (Portal)
           </TabsTrigger>
           <TabsTrigger value="modelos" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <FileText className="w-4 h-4 mr-2 text-green-500"/> Modelos e Templates
           </TabsTrigger>
           <TabsTrigger value="mensagens" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <MessageSquare className="w-4 h-4 mr-2 text-sky-500"/> Mensagens Rápidas
           </TabsTrigger>
           <TabsTrigger value="fluxo" className="rounded-lg px-4 py-2 text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm">
             <Users className="w-4 h-4 mr-2 text-emerald-500"/> Fluxo de Recrutamento
           </TabsTrigger>
        </TabsList>

        {/* --- CONTEÚDO DOCUMENTOS (ABAS OPERACIONAL, PRESTADOR, CLIENTE, MODELOS) --- */}
        {["operacional", "prestador", "cliente", "modelos"].includes(currentTab) && (
          <TabsContent value={currentTab} className="pt-4 space-y-4">
            
            {/* Bloco de descrição / Banner informativo */}
            {currentTab === "operacional" && (
              <Card className="bg-orange-50/40 border-orange-200 shadow-none">
                <CardContent className="p-4 text-xs text-orange-950 font-medium leading-relaxed">
                  🔐 <strong>Central Operacional:</strong> Espaço voltado a POPs, normas de segurança e planos de gerenciamento de risco da transportadora. Estes documentos são de acesso exclusivo aos funcionários internos.
                </CardContent>
              </Card>
            )}
            {currentTab === "prestador" && (
              <Card className="bg-blue-50/40 border-blue-200 shadow-none">
                <CardContent className="p-4 text-xs text-blue-950 font-medium leading-relaxed">
                  🚚 <strong>Pasta do Prestador:</strong> Documentos vinculados diretamente aos agregados e motoristas parceiros (ex: CNH, CRLV, ANTT). Ficam visíveis na consulta cadastral e no app do prestador.
                </CardContent>
              </Card>
            )}
            {currentTab === "cliente" && (
              <Card className="bg-purple-50/40 border-purple-200 shadow-none">
                <CardContent className="p-4 text-xs text-purple-950 font-medium leading-relaxed">
                  🏢 <strong>Pasta do Cliente:</strong> Central de faturamento, tabelas de tarifas, contratos e acordos de nível de serviço (SLA) específicos para cada cliente corporativo.
                </CardContent>
              </Card>
            )}
            {currentTab === "modelos" && (
              <Card className="bg-green-50/40 border-green-200 shadow-none">
                <CardContent className="p-4 text-xs text-green-950 font-medium leading-relaxed">
                  📄 <strong>Modelos e Templates:</strong> Repositório de arquivos padrão para download, como fichas cadastrais em PDF, modelos de proposta comercial e planilhas de referência.
                </CardContent>
              </Card>
            )}

            {/* Painel Geral de Upload e Filtros */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Busca e Filtros de Listagem */}
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Buscar por nome..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs focus-visible:ring-slate-400" 
                      />
                    </div>

                    {/* Filtro Cliente (Apenas na aba cliente) */}
                    {currentTab === "cliente" && (
                      <Select value={clienteFiltroId} onValueChange={setClienteFiltroId}>
                        <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
                          <SelectValue placeholder="Filtrar por Cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os Clientes</SelectItem>
                          {clientes.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome_fantasia || c.razao_social}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Filtro Prestador (Apenas na aba prestador) */}
                    {currentTab === "prestador" && (
                      <Select value={prestadorFiltroId} onValueChange={setPrestadorFiltroId}>
                        <SelectTrigger className="w-full sm:w-64 h-9 text-xs">
                          <SelectValue placeholder="Filtrar por Prestador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os Prestadores</SelectItem>
                          {prestadores.map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Formulário de Upload */}
                  <div className="flex flex-wrap items-center gap-2 border-t lg:border-t-0 pt-4 lg:pt-0">
                    
                    {/* Categoria do documento */}
                    <div className="flex flex-col gap-1">
                      <Select value={selectedUploadCategory} onValueChange={setSelectedUploadCategory}>
                        <SelectTrigger className="w-44 h-9 text-xs">
                          <SelectValue placeholder="Escolha a categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES_BY_TAB[currentTab]?.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Vincular Cliente ao Upload (na aba cliente) */}
                    {currentTab === "cliente" && (
                      <div className="flex flex-col gap-1">
                        <Select value={selectedUploadClient} onValueChange={setSelectedUploadClient}>
                          <SelectTrigger className="w-48 h-9 text-xs">
                            <SelectValue placeholder="Vincular Cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geral">Geral / Sem vínculo</SelectItem>
                            {clientes.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nome_fantasia || c.razao_social}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Vincular Prestador ao Upload (na aba prestador) */}
                    {currentTab === "prestador" && (
                      <div className="flex flex-col gap-1">
                        <Select value={selectedUploadProvider} onValueChange={setSelectedUploadProvider}>
                          <SelectTrigger className="w-48 h-9 text-xs">
                            <SelectValue placeholder="Vincular Prestador" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="geral">Geral / Sem vínculo</SelectItem>
                            {prestadores.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome_completo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Botão de Upload */}
                    <div className="relative">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleUploadFile}
                        disabled={isUploading}
                      />
                      <Button 
                        type="button"
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-9 shadow-md shadow-orange-500/10"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Enviando {uploadProgress}%
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2"/>
                            Subir Arquivo
                          </>
                        )}
                      </Button>
                    </div>

                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Nome do Documento</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Categoria</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Modificado Em</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Tamanho</TableHead>
                      <TableHead className="text-xs font-bold text-slate-700">Uploader</TableHead>
                      <TableHead className="text-right text-xs font-bold text-slate-700">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTabDocs.map((doc, idx) => (
                      <TableRow key={doc.id || `doc-${idx}`} className="hover:bg-slate-50/40">
                        <TableCell>{getDocIcon(doc.nome)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-sm text-slate-800 leading-none">{doc.nome}</p>
                            {currentTab === "cliente" && doc.cliente_id && (
                              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                Cliente: {clientes.find(c => c.id === doc.cliente_id)?.nome_fantasia || "Carregando..."}
                              </span>
                            )}
                            {currentTab === "prestador" && doc.prestador_id && (
                              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                                Prestador: {prestadores.find(p => p.id === doc.prestador_id)?.nome_completo || "Carregando..."}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-700 text-[10px] font-medium font-mono">
                            {doc.categoria || "Geral"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium">{doc.data || "-"}</TableCell>
                        <TableCell className="text-xs text-slate-500 font-medium font-mono">{doc.tamanho || "-"}</TableCell>
                        <TableCell className="text-xs text-slate-500">{doc.usuario_nome || "Sistema"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                              onClick={() => handleOpenFile(doc)}
                              title="Abrir em Nova Aba"
                            >
                              <ExternalLink className="w-4 h-4"/>
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-slate-600 hover:bg-slate-50"
                              onClick={() => handleShareFile(doc)}
                              title="Copiar Link"
                            >
                              <Share2 className="w-4 h-4"/>
                            </Button>
                            {(currentTab === "cliente" || currentTab === "prestador") && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-emerald-600 hover:bg-emerald-50"
                                onClick={() => handleOpenWhatsAppExport(doc)}
                                title="Enviar via WhatsApp"
                              >
                                <Send className="w-4 h-4"/>
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-600 hover:bg-red-50"
                              onClick={() => handleDeleteFile(doc)}
                              title="Excluir"
                            >
                              <Trash className="w-4 h-4"/>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {activeTabDocs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-16 text-slate-400 border-dashed border-2 bg-slate-50/20">
                          <Folder className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                          Nenhum documento encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* --- ABA MENSAGENS RÁPIDAS --- */}
        <TabsContent value="mensagens" className="pt-4 space-y-4">
           <Card className="border-slate-200 shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
               <div>
                 <CardTitle className="text-lg flex items-center gap-2 text-slate-900 font-bold">
                   <MessageSquare className="w-5 h-5 text-sky-500" />
                   Mensagens Rápidas para WhatsApp
                 </CardTitle>
                 <CardDescription className="text-xs">Modelos e templates de WhatsApp para contato instantâneo com prestadores e clientes.</CardDescription>
               </div>
               <Button className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs h-9 shadow-md shadow-sky-600/10" onClick={handleNovaMensagem}>
                 <Plus className="w-4 h-4 mr-2" /> Nova Mensagem
               </Button>
             </CardHeader>
             <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                    <SelectTrigger className="w-64 h-9 text-xs"><SelectValue placeholder="Filtrar por categoria" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas as categorias</SelectItem>
                      {["Captação de prestadores", "Operacional", "Ocorrências", "Financeiro", "Clientes"].map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filtroCliente} onValueChange={setFiltroCliente}>
                    <SelectTrigger className="w-64 h-9 text-xs"><SelectValue placeholder="Filtrar por cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os clientes</SelectItem>
                      {clientes.length === 0 ? (
                        <SelectItem value="none" disabled className="text-sm text-muted-foreground italic">
                          Nenhum cliente cadastrado
                        </SelectItem>
                      ) : (
                        clientes.map(cli => (
                          <SelectItem key={cli.id} value={cli.id}>
                            {cli.nome_fantasia || cli.razao_social}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mensagens.filter(m => {
                    const matchCat = filtroCategoria === "todas" || m.categoria === filtroCategoria;
                    const matchCli = filtroCliente === "todos" || m.cliente_id === filtroCliente;
                    return matchCat && matchCli;
                  }).map((msg) => {
                    const corCategoria = CATEGORIA_CORES[msg.categoria] || "bg-slate-50 text-slate-700 border-slate-200";
                    const bordaCategoria = CATEGORIA_BORDA[msg.categoria] || "border-l-slate-400";
                    return (
                      <Card key={msg.id} className={`border-l-4 ${bordaCategoria} hover:shadow-md transition-shadow ${editandoId === msg.id ? 'ring-2 ring-primary' : ''}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className={`flex items-center gap-1 ${corCategoria} font-medium text-[10px]`}>
                              {getCategoriaIcon(msg.categoria)}
                              {msg.categoria}
                            </Badge>
                            <div className="flex gap-0.5">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-100" onClick={() => { setMensagemEditando(msg); setShowNovaMensagem(true); setEditandoId(msg.id); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-sky-500 hover:bg-sky-50" onClick={() => copyToClipboard(msg.texto)} title="Copiar Texto">
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleExcluirMensagem(msg.id)} title="Excluir">
                                <Trash className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          {msg.cliente_nome ? (
                            <div className="mt-1">
                              <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-md">
                                Cliente: {msg.cliente_nome}
                              </span>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <span className="text-[10px] text-slate-500 font-semibold bg-slate-50 px-1.5 py-0.5 rounded-md">
                                Geral
                              </span>
                            </div>
                          )}
                          <CardTitle className="text-sm font-bold text-slate-800 mt-2">{msg.titulo}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-slate-600 line-clamp-4 min-h-[64px] font-mono leading-relaxed bg-slate-50 p-2 rounded-lg mt-1 whitespace-pre-wrap">{msg.texto}</p>
                          <div className="flex justify-between items-center mt-3">
                            <span className="text-[10px] text-slate-400 font-semibold">{msg.texto.length} caracteres</span>
                            <Button variant="outline" size="sm" className="h-7 text-xs font-semibold" onClick={() => copyToClipboard(msg.texto)}>
                              <Copy className="w-3 h-3 mr-1" /> Copiar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {mensagens.length === 0 && (
                  <div className="text-center py-16 text-slate-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    Nenhuma mensagem rápida cadastrada.
                  </div>
                )}
             </CardContent>
           </Card>
        </TabsContent>

        {/* --- FLUXO DE RECRUTAMENTO --- */}
        <TabsContent value="fluxo" className="pt-4 space-y-4">
           <Card className="border-slate-200 shadow-sm">
             <CardHeader className="border-b pb-4">
               <CardTitle className="text-lg flex items-center gap-2 text-slate-900 font-bold">
                 <Users className="w-5 h-5 text-emerald-500" />
                 Fluxo de Recrutamento de Prestadores
               </CardTitle>
               <CardDescription className="text-xs">
                 Passo a passo com mensagens padronizadas de recrutamento e onboardings. Edite os textos e clique em salvar.
               </CardDescription>
             </CardHeader>
             <CardContent className="pt-6">
                <div className="space-y-4">
                  {fluxoEtapas.sort((a, b) => a.ordem - b.ordem).map((etapa, index) => (
                    <div key={etapa.id} className="relative">
                      <div className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-emerald-500/10">
                            {etapa.ordem}
                          </div>
                          {index < fluxoEtapas.length - 1 && (
                            <div className="w-0.5 h-20 bg-slate-200 mt-2"></div>
                          )}
                        </div>
                        <Card className="flex-1 shadow-none border-slate-200">
                          <CardHeader className="pb-2 p-4">
                            <Input 
                              value={etapa.titulo} 
                              onChange={(e) => handleFluxoChange(etapa.id, 'titulo', e.target.value)}
                              className="font-bold text-sm border-0 focus-visible:ring-0 px-0 h-7"
                            />
                          </CardHeader>
                          <CardContent className="p-4 pt-0">
                            <Textarea 
                              value={etapa.texto} 
                              onChange={(e) => handleFluxoChange(etapa.id, 'texto', e.target.value)}
                              className="min-h-[70px] text-xs font-mono bg-slate-50 focus-visible:ring-slate-400"
                              placeholder="Digite a mensagem padrão desta etapa..."
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => copyToClipboard(etapa.texto)}>
                                <Copy className="w-3.5 h-3.5 mr-1" /> Copiar Texto
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/10" onClick={handleSalvarFluxo}>
                    <Save className="w-4 h-4 mr-2" /> Salvar Alterações do Funil
                  </Button>
                </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: NOVA MENSAGEM RÁPIDA */}
      <Dialog open={showNovaMensagem} onOpenChange={setShowNovaMensagem}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-800 text-base">Nova Mensagem Rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Título</Label>
              <Input 
                value={mensagemEditando?.titulo || ''} 
                onChange={(e) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, titulo: e.target.value } : null)}
                placeholder="Ex: Confirmação de OS"
                className="h-9 text-xs focus-visible:ring-slate-400"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Categoria</Label>
              <Select 
                value={mensagemEditando?.categoria || 'Operacional'} 
                onValueChange={(v) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, categoria: v } : null)}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Captação de prestadores", "Operacional", "Ocorrências", "Financeiro", "Clientes"].map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Cliente vinculado (opcional)</Label>
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
                      cliente_documento: cliente?.cnpj || null
                    } : null);
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Mensagem geral (Sem cliente)</SelectItem>
                  {clientes.map(cli => (
                    <SelectItem key={cli.id} value={cli.id}>
                      {cli.nome_fantasia || cli.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Conteúdo da Mensagem</Label>
              <Textarea 
                value={mensagemEditando?.texto || ''} 
                onChange={(e) => setMensagemEditando(mensagemEditando ? { ...mensagemEditando, texto: e.target.value } : null)}
                placeholder="Ex: Olá {{nome}}, o pagamento de R$ {{valor}} foi realizado."
                className="min-h-[100px] text-xs font-mono focus-visible:ring-slate-400"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <span>Variáveis: {"{{nome}}"}, {"{{os}}"}, {"{{valor}}"}, {"{{origem}}"}, {"{{destino}}"}</span>
                <span>{mensagemEditando?.texto?.length || 0} caract.</span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => { setShowNovaMensagem(false); setMensagemEditando(null); setEditandoId(null); }}>Cancelar</Button>
            <Button size="sm" className="bg-sky-600 hover:bg-sky-700 text-white font-semibold h-8 text-xs" onClick={handleSalvarMensagem}>Salvar Mensagem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EXPORTAR PARA WHATSAPP */}
      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-bold text-slate-800 text-base">Exportar Documento para WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Número do WhatsApp (com DDD)</Label>
              <Input 
                value={whatsappPhone} 
                onChange={(e) => setWhatsappPhone(e.target.value)}
                placeholder="Ex: 11999998888"
                className="h-9 text-xs focus-visible:ring-slate-400"
              />
              <p className="text-[10px] text-slate-400">Prefixo DDI 55 (Brasil) será adicionado automaticamente se omitido.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">Mensagem que será enviada</Label>
              <Textarea 
                value={whatsappMessage} 
                onChange={(e) => setWhatsappMessage(e.target.value)}
                className="min-h-[100px] text-xs focus-visible:ring-slate-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => setShowWhatsAppDialog(false)}>Cancelar</Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-8 text-xs flex items-center gap-1" onClick={handleConfirmWhatsAppExport}>
              <Send className="w-3.5 h-3.5" /> Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
