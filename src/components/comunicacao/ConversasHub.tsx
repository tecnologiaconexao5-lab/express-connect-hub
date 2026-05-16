import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare, Phone, Send, Loader2, RefreshCw,
  User, Clock, CheckCircle2, Circle, ChevronRight,
  Mail, Filter, Search, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { HubConversa, HubMensagem, buscarConversas, buscarMensagens, enviarMensagem, criarConversa } from "@/services/hubComunicacaoService";
import { FOLLOWUP_TEMPLATES } from "@/services/zohoEmailService";

function formatHora(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}

function badgeStatus(status: string) {
  const map: Record<string, string> = {
    aberta: "bg-green-100 text-green-800",
    arquivada: "bg-slate-100 text-slate-600",
    aguardando: "bg-amber-100 text-amber-800",
    resolvida: "bg-blue-100 text-blue-800",
  };
  return map[status] || "bg-slate-100 text-slate-600";
}

export function ConversasHub() {
  const [conversas, setConversas] = useState<HubConversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroCanal, setFiltroCanal] = useState("todos");
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<HubConversa | null>(null);
  const [mensagens, setMensagens] = useState<HubMensagem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [novaOpen, setNovaOpen] = useState(false);
  
  // Nova conversa state
  const [novoCanal, setNovoCanal] = useState<"whatsapp"|"email">("whatsapp");
  const [novoNome, setNovoNome] = useState("");
  const [novoContato, setNovoContato] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await buscarConversas(filtroCanal);
      setConversas(data);
    } catch (e: any) {
      toast.error("Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, [filtroCanal]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarMensagens = useCallback(async (id: string) => {
    setLoadingMsgs(true);
    const data = await buscarMensagens(id);
    setMensagens(data);
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    if (selecionada) {
      carregarMensagens(selecionada.id);
    }
  }, [selecionada, carregarMensagens]);

  const filtradas = conversas.filter(c =>
    !busca ||
    (c.telefone && c.telefone.includes(busca)) ||
    (c.email && c.email.includes(busca)) ||
    (c.nome_contato && c.nome_contato.toLowerCase().includes(busca.toLowerCase()))
  );

  async function handleEnviar() {
    if (!texto.trim() || !selecionada) return;
    setEnviando(true);
    try {
      const res = await enviarMensagem(selecionada, texto);
      if (res.success) {
        toast.success("Mensagem na fila de envio");
        setTexto("");
        carregarMensagens(selecionada.id);
        carregar(); // Atualiza lista
      } else {
        toast.error(res.erro || "Erro ao enviar");
      }
    } finally {
      setEnviando(false);
    }
  }

  async function handleNovaConversa() {
    if (!novoNome || !novoContato) return toast.error("Preencha nome e contato");
    const conversa = await criarConversa(novoCanal, novoContato, novoNome);
    if (conversa) {
      toast.success("Conversa criada!");
      setNovaOpen(false);
      await carregar();
      setSelecionada(conversa);
    }
  }

  const handleTemplate = (key: string) => {
    const tpl = FOLLOWUP_TEMPLATES[key];
    if (tpl) {
      setTexto(tpl.mensagem.replace(/{{nome}}/g, selecionada?.nome_contato || "Cliente"));
    }
  };

  return (
    <div className="flex h-[calc(100vh-200px)] border rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Sidebar: Lista de Conversas */}
      <div className="w-1/3 border-r flex flex-col bg-slate-50/50">
        <div className="p-4 border-b space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Caixa de Entrada
            </h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={carregar}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button size="icon" className="h-8 w-8 bg-primary hover:bg-primary/90" onClick={() => setNovaOpen(true)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-2 top-2 text-muted-foreground" />
              <Input 
                placeholder="Buscar..." 
                className="pl-8 h-8 text-xs" 
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
            </div>
            <Select value={filtroCanal} onValueChange={setFiltroCanal}>
              <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Nenhuma conversa encontrada.
            </div>
          ) : (
            filtradas.map(c => (
              <button
                key={c.id}
                onClick={() => setSelecionada(c)}
                className={`w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                  selecionada?.id === c.id ? "bg-primary/5 border-primary/30" : "bg-white hover:bg-slate-50 border-slate-200"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${c.canal === 'whatsapp' ? 'bg-green-100' : 'bg-blue-100'}`}>
                  {c.canal === "whatsapp" ? <Phone className="w-4 h-4 text-green-600" /> : <Mail className="w-4 h-4 text-blue-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-semibold text-sm truncate">{c.nome_contato || c.telefone || c.email}</span>
                    <span className="text-[10px] text-muted-foreground">{formatHora(c.ultimo_evento_em).split(" ")[1]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-[9px] h-3.5 px-1 ${badgeStatus(c.status)}`}>{c.status}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{c.ultima_mensagem || "Nova conversa"}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main: Chat Area */}
      {selecionada ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="p-4 border-b flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selecionada.canal === 'whatsapp' ? 'bg-green-100' : 'bg-blue-100'}`}>
                {selecionada.canal === "whatsapp" ? <Phone className="w-5 h-5 text-green-600" /> : <Mail className="w-5 h-5 text-blue-600" />}
              </div>
              <div>
                <h3 className="font-bold text-slate-800">{selecionada.nome_contato || selecionada.telefone || selecionada.email}</h3>
                <p className="text-xs text-muted-foreground">{selecionada.canal === "whatsapp" ? selecionada.telefone : selecionada.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {selecionada.lead_id && (
                <Button size="sm" variant="outline" className="text-xs gap-1 border-primary/20 text-primary">
                  <User className="w-3.5 h-3.5" /> Abrir Lead
                </Button>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {loadingMsgs ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : mensagens.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm flex flex-col items-center">
                <MessageSquare className="w-10 h-10 mb-2 opacity-20" />
                Nenhuma mensagem enviada ou recebida.
              </div>
            ) : (
              mensagens.map(m => (
                <div key={m.id} className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm shadow-sm ${
                    m.direction === "outbound"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-white border text-slate-800 rounded-bl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap">{m.mensagem}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${m.direction === "outbound" ? "text-primary-foreground/70" : "text-slate-400"}`}>
                      <span className="text-[10px]">{formatHora(m.created_at)}</span>
                      {m.direction === "outbound" && (
                        m.status === "pendente" ? <Clock className="w-3 h-3" /> :
                        m.status === "erro" ? <Circle className="w-3 h-3 text-red-300" /> :
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white border-t space-y-2">
            {selecionada.canal === "email" && (
               <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                 {Object.entries(FOLLOWUP_TEMPLATES).map(([k, t]) => (
                   <Button key={k} variant="outline" size="sm" className="text-[10px] h-6 px-2 shrink-0" onClick={() => handleTemplate(k)}>
                     {t.titulo}
                   </Button>
                 ))}
               </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="min-h-[44px] max-h-[120px] resize-none text-sm"
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(); } }}
              />
              <Button className="shrink-0 h-11 w-11 p-0" disabled={enviando || !texto.trim()} onClick={handleEnviar}>
                {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-muted-foreground">
          <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
          <p className="font-medium">Selecione uma conversa</p>
          <p className="text-sm">Ou inicie uma nova para começar a interagir</p>
        </div>
      )}

      <Dialog open={novaOpen} onOpenChange={setNovaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Conversa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Canal</label>
              <Select value={novoCanal} onValueChange={(v: any) => setNovoCanal(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome do Contato</label>
              <Input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Ex: João da Silva" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{novoCanal === 'whatsapp' ? 'Telefone' : 'Endereço de E-mail'}</label>
              <Input value={novoContato} onChange={e => setNovoContato(e.target.value)} placeholder={novoCanal === 'whatsapp' ? "5511999999999" : "email@exemplo.com"} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaOpen(false)}>Cancelar</Button>
            <Button onClick={handleNovaConversa}>Criar Conversa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
