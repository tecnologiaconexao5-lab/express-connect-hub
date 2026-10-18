import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, CheckCheck, Clock, Phone, AlertCircle, CheckCircle, XCircle, Loader2, RefreshCw, ChevronRight, ArrowLeft, Search, Ban, WifiOff, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { portalWhatsAppService, type ConversaWhatsApp, type MensagemWhatsApp, type TemplateMensagem, type StatusConexao } from "@/services/portalCliente/portalWhatsAppService";

interface PortalWhatsAppProps {
  clienteId?: string;
}

export function PortalWhatsApp({ clienteId }: PortalWhatsAppProps) {
  const [conversas, setConversas] = useState<ConversaWhatsApp[]>([]);
  const [mensagens, setMensagens] = useState<MensagemWhatsApp[]>([]);
  const [templates, setTemplates] = useState<TemplateMensagem[]>([]);
  const [statusConexao, setStatusConexao] = useState<StatusConexao | null>(null);
  const [loadingConversas, setLoadingConversas] = useState(true);
  const [loadingMensagens, setLoadingMensagens] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [conversaSelecionada, setConversaSelecionada] = useState<string | null>(null);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [templateSelecionado, setTemplateSelecionado] = useState<string>("");
  const [busca, setBusca] = useState("");

  const carregarConversas = useCallback(async () => {
    if (!clienteId) return;
    setLoadingConversas(true);
    const data = await portalWhatsAppService.buscarConversas(clienteId);
    setConversas(data);
    setLoadingConversas(false);
  }, [clienteId]);

  const carregarMensagens = useCallback(async (conversaId: string) => {
    setLoadingMensagens(true);
    const data = await portalWhatsAppService.buscarMensagens(conversaId);
    setMensagens(data);
    setMensagens(data);
    setLoadingMensagens(false);
  }, []);

  const verificarConexao = useCallback(async () => {
    const status = await portalWhatsAppService.verificarStatusConexao();
    setStatusConexao(status);
  }, []);

  useEffect(() => {
    carregarConversas();
    verificarConexao();
    portalWhatsAppService.buscarTemplates().then(setTemplates);
  }, [carregarConversas, verificarConexao]);

  useEffect(() => {
    if (!conversaSelecionada) return;
    carregarMensagens(conversaSelecionada);
  }, [conversaSelecionada, carregarMensagens]);

  useEffect(() => {
    if (!clienteId) return;
    const unsubscribe = portalWhatsAppService.inscreverMensagens(clienteId, (nova) => {
      setMensagens((prev) => [...prev, nova]);
      setConversas((prev) =>
        prev.map((c) =>
          c.id === nova.conversa_id
            ? { ...c, ultima_mensagem: nova.mensagem, ultimo_evento_em: nova.created_at }
            : c
        )
      );
    });
    return unsubscribe;
  }, [clienteId]);

  const handleSelecionarConversa = (conversaId: string) => {
    setConversaSelecionada(conversaId);
  };

  const handleVoltar = () => {
    setConversaSelecionada(null);
    setMensagens([]);
  };

  const handleTemplateChange = (templateId: string) => {
    setTemplateSelecionado(templateId);
    if (templateId) {
      const template = templates.find((t) => t.id === templateId);
      if (template) setNovaMensagem(template.mensagem);
    }
  };

  const handleEnviar = async () => {
    if (!clienteId || !conversaSelecionada || !novaMensagem.trim()) return;
    setEnviando(true);
    const conversa = conversas.find((c) => c.id === conversaSelecionada);
    const result = await portalWhatsAppService.enviarMensagem({
      conversaId: conversaSelecionada,
      mensagem: novaMensagem.trim(),
      clienteId,
      telefone: conversa?.telefone,
    });
    setEnviando(false);
    setNovaMensagem("");
    setTemplateSelecionado("");

    if (result.sucesso) {
      toast({ title: "Mensagem registrada", description: result.motivo || "Mensagem enviada para aprova\u00e7\u00e3o." });
    } else {
      toast({
        title: result.status === "aguardando_aprovacao" ? "Aguardando aprova\u00e7\u00e3o" : "Mensagem registrada",
        description: result.motivo || "Sua mensagem foi registrada e ser\u00e1 analisada.",
        variant: result.status === "bloqueado" ? "destructive" : "default",
      });
    }
  };

  const conversasFiltradas = conversas.filter((c) => {
    if (!busca.trim()) return true;
    const termo = busca.toLowerCase();
    return (
      c.nome_contato?.toLowerCase().includes(termo) ||
      c.telefone?.includes(termo) ||
      c.ultima_mensagem?.toLowerCase().includes(termo)
    );
  });

  const conversaAtual = conversas.find((c) => c.id === conversaSelecionada);

  if (!clienteId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
        <p className="text-lg font-medium text-slate-600">WhatsApp</p>
        <p className="text-sm text-slate-400">Selecione um cliente para visualizar mensagens.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#111827]">WhatsApp</h2>
            <p className="text-sm text-[#475569]">Conversas e mensagens</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {statusConexao && (
            <Badge variant={statusConexao.conectado ? "secondary" : "outline"} className={statusConexao.conectado ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
              {statusConexao.conectado ? (
                <><Smartphone className="w-3 h-3 mr-1" />Conectado</>
              ) : (
                <><WifiOff className="w-3 h-3 mr-1" />{statusConexao.mode === "homologacao" ? "Simula\u00e7\u00e3o" : "Desconectado"}</>
              )}
            </Badge>
          )}
          <Button variant="ghost" size="icon" onClick={() => { carregarConversas(); verificarConexao(); }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: "500px" }}>
        {/* Left panel - conversations list */}
        <Card className="lg:col-span-1 bg-white border-[#E5E7EB] shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-2 space-y-2">
            <CardTitle className="text-sm text-[#111827]">Conversas</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar conversa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loadingConversas ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : conversasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageSquare className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma conversa encontrada</p>
                  <p className="text-xs text-slate-400 mt-1">As mensagens de WhatsApp aparecer\u00e3o aqui.</p>
                </div>
              ) : (
                conversasFiltradas.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelecionarConversa(conv.id)}
                    className={`w-full text-left p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                      conversaSelecionada === conv.id ? "bg-emerald-50 border-l-2 border-l-emerald-500" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {conv.nome_contato?.[0] || conv.telefone?.[0] || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#111827] truncate">
                            {conv.nome_contato || conv.telefone || "Desconhecido"}
                          </span>
                          {conv.ultimo_evento_em && (
                            <span className="text-[10px] text-slate-400 ml-2 flex-shrink-0">
                              {new Date(conv.ultimo_evento_em).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {conv.ultima_mensagem || (conv.mensagens_count ? `${conv.mensagens_count} mensagens` : "Sem mensagens")}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    </div>
                  </button>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel - message thread */}
        <Card className="lg:col-span-2 bg-white border-[#E5E7EB] shadow-sm rounded-2xl overflow-hidden flex flex-col">
          {!conversaSelecionada ? (
            <div className="flex flex-col items-center justify-center h-[500px] text-center px-8">
              <MessageSquare className="w-16 h-16 text-slate-200 mb-4" />
              <p className="text-lg font-medium text-slate-600">Selecione uma conversa</p>
              <p className="text-sm text-slate-400 mt-1">Escolha uma conversa \u00e0 esquerda para visualizar as mensagens.</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="lg:hidden" onClick={handleVoltar}>
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {conversaAtual?.nome_contato?.[0] || conversaAtual?.telefone?.[0] || "?"}
                  </div>
                  <div>
                    <CardTitle className="text-sm text-[#111827]">
                      {conversaAtual?.nome_contato || conversaAtual?.telefone || "Conversa"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {conversaAtual?.telefone ? `+${conversaAtual.telefone}` : ""}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              {/* Messages area */}
              <ScrollArea className="flex-1 p-4" style={{ maxHeight: "350px" }}>
                {loadingMensagens ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
                    <p className="text-sm text-slate-500">Nenhuma mensagem ainda</p>
                    <p className="text-xs text-slate-400 mt-1">As mensagens aparecer\u00e3o aqui.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mensagens.map((msg) => {
                      const isSent = msg.direction === "sent";
                      return (
                        <div key={msg.id} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                              isSent
                                ? "bg-emerald-500 text-white rounded-br-md"
                                : "bg-slate-100 text-slate-800 rounded-bl-md"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.mensagem}</p>
                            <div className={`flex items-center gap-1 mt-1 ${isSent ? "justify-end" : "justify-start"}`}>
                              <span className={`text-[10px] ${isSent ? "text-white/70" : "text-slate-400"}`}>
                                {new Date(msg.created_at).toLocaleString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {isSent && msg.status === "enviada" && <CheckCheck className="w-3 h-3 text-white/70" />}
                              {isSent && msg.status === "pendente" && <Clock className="w-3 h-3 text-white/70" />}
                              {isSent && msg.status === "bloqueado" && <Ban className="w-3 h-3 text-red-300" />}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              {/* Composer */}
              <CardContent className="p-4 border-t border-slate-100 space-y-3">
                {templates.length > 0 && (
                  <Select value={templateSelecionado} onValueChange={handleTemplateChange}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Usar template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex gap-2 items-end">
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={novaMensagem}
                    onChange={(e) => setNovaMensagem(e.target.value)}
                    className="flex-1 min-h-[44px] max-h-[120px] text-sm resize-none"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleEnviar();
                      }
                    }}
                  />
                  <Button
                    onClick={handleEnviar}
                    disabled={enviando || !novaMensagem.trim()}
                    className="h-[44px] px-4 bg-emerald-500 hover:bg-emerald-600"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Mensagens passam por aprova\u00e7\u00e3o antes do envio real.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
