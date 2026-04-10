import { useState, useMemo } from "react";
import {
  MessageSquare, Mail, Phone, Hash, Send, Search, Plus, Paperclip,
  CheckCheck, Clock, ArrowRight, User, Building, Filter, Zap,
  Bot, Copy, RefreshCw, Smile, Image, Mic, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Lead, TEMPLATES_MENSAGEM } from "./crmTypes";

interface CrmComunicacaoProps {
  leads: Lead[];
}

const CONVERSAS_WHATSAPP = [
  {
    id: "1", empresa: "Distribuidora Beta", contato: "Ana Costa", ultima: "Ok, aguardo a proposta!", hora: "09:14", naoLido: 2,
    mensagens: [
      { id: "m1", autor: "Ana Costa", texto: "Olá, recebi seu contato. Temos interesse em seus serviços.", hora: "08:50", minha: false },
      { id: "m2", autor: "Você", texto: "Oi Ana! Que ótimo! Vou preparar nossa proposta personalizada para a Distribuidora Beta.", hora: "09:00", minha: true },
      { id: "m3", autor: "Ana Costa", texto: "Ok, aguardo a proposta!", hora: "09:14", minha: false },
    ]
  },
  {
    id: "2", empresa: "Logística Alpha", contato: "Carlos Mendes", ultima: "Podemos agendar para amanhã?", hora: "Ontem", naoLido: 0,
    mensagens: [
      { id: "m1", autor: "Carlos Mendes", texto: "Vcs fazem coleta em SP Interior?", hora: "Ontem", minha: false },
      { id: "m2", autor: "Você", texto: "Sim! Atendemos toda a região. Podemos agendar uma apresentação?", hora: "Ontem", minha: true },
      { id: "m3", autor: "Carlos Mendes", texto: "Podemos agendar para amanhã?", hora: "Ontem", minha: false },
    ]
  },
  {
    id: "3", empresa: "Indústria Gamma", contato: "Roberto Alves", ultima: "Vou levar para aprovação da diretoria.", hora: "Seg", naoLido: 0,
    mensagens: [
      { id: "m1", autor: "Roberto Alves", texto: "Proposta recebida. Preciso de 2 dias para analisar.", hora: "Seg, 14:00", minha: false },
      { id: "m2", autor: "Você", texto: "Claro! Qualquer dúvida estou à disposição.", hora: "Seg, 14:05", minha: true },
      { id: "m3", autor: "Roberto Alves", texto: "Vou levar para aprovação da diretoria.", hora: "Seg, 14:10", minha: false },
    ]
  },
];

const EMAILS_MOCK = [
  {
    id: "e1", de: "ana.costa@betadist.com.br", assunto: "Re: Proposta Serviços de Transporte", empresa: "Dist. Beta", hora: "09:45",
    preview: "Obrigada pela proposta. Vou analisar com nosso time e retorno até quinta-feira.",
    lido: false
  },
  {
    id: "e2", de: "roberto@gammamecanica.com.br", assunto: "Dúvidas sobre o contrato", empresa: "Ind. Gamma", hora: "Ontem",
    preview: "Tenho algumas perguntas sobre as cláusulas de multa e reajuste anual da proposta.",
    lido: true
  },
  {
    id: "e3", de: "juliana@omegashop.com.br", assunto: "Solicitação de Proposta - Last Mile", empresa: "E-commerce Omega", hora: "Seg",
    preview: "Olá! Vi que vocês atendem a região de SP. Gostaria de receber uma proposta para nosso e-commerce.",
    lido: true
  },
];

export default function CrmComunicacao({ leads }: CrmComunicacaoProps) {
  const [conversaAtiva, setConversaAtiva] = useState(CONVERSAS_WHATSAPP[0]);
  const [mensagem, setMensagem] = useState("");
  const [busca, setBusca] = useState("");
  const [templateAtivo, setTemplateAtivo] = useState<string | null>(null);

  const conversasFiltradas = CONVERSAS_WHATSAPP.filter(c =>
    !busca || c.empresa.toLowerCase().includes(busca.toLowerCase()) || c.contato.toLowerCase().includes(busca.toLowerCase())
  );

  const enviarMensagem = () => {
    if (!mensagem.trim()) return;
    toast.success(`✅ Mensagem enviada para ${conversaAtiva.contato} via WhatsApp`);
    setMensagem("");
  };

  const usarTemplate = (key: string) => {
    const tpl = TEMPLATES_MENSAGEM[key];
    if (!tpl) return;
    const lead = leads.find(l => l.empresa === conversaAtiva.empresa);
    const texto = tpl.texto
      .replace("{{nome}}", lead?.nomeContato || conversaAtiva.contato)
      .replace("{{empresa}}", conversaAtiva.empresa)
      .replace("{{segmento}}", lead?.segmento || "seu segmento");
    setMensagem(texto);
    setTemplateAtivo(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Central de Comunicação
        </h3>
        <p className="text-xs text-muted-foreground">Unifique WhatsApp, E-mail e Ligações em um só lugar.</p>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp" className="text-xs gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-green-600" /> WhatsApp
            <Badge className="text-[10px] bg-green-500 text-white px-1.5 py-0">{CONVERSAS_WHATSAPP.filter(c => c.naoLido > 0).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1.5">
            <Mail className="w-3.5 h-3.5 text-blue-600" /> E-mail
            <Badge className="text-[10px] bg-blue-500 text-white px-1.5 py-0">{EMAILS_MOCK.filter(e => !e.lido).length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="ligacoes" className="text-xs gap-1.5">
            <Phone className="w-3.5 h-3.5 text-violet-600" /> Ligações
          </TabsTrigger>
        </TabsList>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp" className="mt-4">
          <div className="flex gap-0 rounded-xl border border-slate-200 overflow-hidden bg-white" style={{ height: "500px" }}>
            {/* Lista conversas */}
            <div className="w-72 border-r flex flex-col shrink-0">
              <div className="p-3 border-b">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-8 h-8 text-xs" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversasFiltradas.map(conversa => (
                  <button
                    key={conversa.id}
                    onClick={() => setConversaAtiva(conversa)}
                    className={`w-full text-left p-3 border-b hover:bg-slate-50 transition-colors ${conversaAtiva.id === conversa.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarFallback className="text-xs bg-green-100 text-green-700 font-bold">
                          {conversa.contato.split(" ").map(n => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-800 truncate">{conversa.empresa}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{conversa.hora}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground truncate">{conversa.ultima}</p>
                          {conversa.naoLido > 0 && (
                            <span className="text-[9px] bg-green-500 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0 font-bold">{conversa.naoLido}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Área de chat */}
            <div className="flex-1 flex flex-col">
              {/* Chat Header */}
              <div className="p-3 border-b flex items-center gap-3 bg-slate-50">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs bg-green-100 text-green-700 font-bold">
                    {conversaAtiva.contato.split(" ").map(n => n[0]).join("").slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-bold text-slate-800">{conversaAtiva.contato}</p>
                  <p className="text-[10px] text-muted-foreground">{conversaAtiva.empresa}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-7 w-7">
                    <Phone className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-7 w-7">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#e5ddd5]">
                {conversaAtiva.mensagens.map(msg => (
                  <div key={msg.id} className={`flex ${msg.minha ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs shadow-sm ${msg.minha ? "bg-[#dcf8c6] text-slate-800 rounded-br-sm" : "bg-white text-slate-800 rounded-bl-sm"}`}>
                      <p className="leading-relaxed">{msg.texto}</p>
                      <div className={`flex items-center gap-1 mt-1 ${msg.minha ? "justify-end" : "justify-start"}`}>
                        <span className="text-[10px] text-slate-500">{msg.hora}</span>
                        {msg.minha && <CheckCheck className="w-3 h-3 text-blue-500" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Templates IA */}
              {templateAtivo && (
                <div className="border-t p-2 bg-violet-50 flex flex-wrap gap-1.5">
                  {Object.entries(TEMPLATES_MENSAGEM).map(([key, tpl]) => (
                    <button
                      key={key}
                      onClick={() => usarTemplate(key)}
                      className="text-[10px] bg-white border border-violet-200 text-violet-700 px-2 py-1 rounded-md hover:bg-violet-100 transition-colors font-medium"
                    >
                      {tpl.titulo}
                    </button>
                  ))}
                  <button onClick={() => setTemplateAtivo(null)} className="text-[10px] text-muted-foreground px-2 py-1">
                    Cancelar
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-3 border-t bg-white flex items-end gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-violet-600 hover:bg-violet-50" onClick={() => setTemplateAtivo("open")} title="Templates IA">
                  <Bot className="w-4 h-4" />
                </Button>
                <Textarea
                  placeholder="Digite uma mensagem..."
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
                  className="flex-1 resize-none text-xs h-16 min-h-0"
                />
                <Button size="icon" className="h-8 w-8 shrink-0 bg-green-600 hover:bg-green-700" onClick={enviarMensagem}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="mt-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{EMAILS_MOCK.filter(e => !e.lido).length} não lidos</p>
              <Button size="sm" className="text-xs gap-1.5 h-8">
                <Plus className="w-3.5 h-3.5" /> Novo E-mail
              </Button>
            </div>
            {EMAILS_MOCK.map(email => (
              <Card
                key={email.id}
                className={`cursor-pointer hover:shadow-sm transition-all hover:border-primary/30 ${!email.lido ? "border-l-4 border-l-blue-500" : ""}`}
                onClick={() => toast.info(`Abrindo e-mail de ${email.de}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700 font-bold">
                        {email.empresa.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm ${!email.lido ? "font-bold" : "font-medium"} text-slate-800`}>{email.empresa}</p>
                          <p className="text-xs text-muted-foreground">{email.de}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{email.hora}</span>
                          {!email.lido && <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
                        </div>
                      </div>
                      <p className={`text-xs mt-1 ${!email.lido ? "font-semibold text-slate-700" : "text-slate-600"}`}>{email.assunto}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{email.preview}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* LIGAÇÕES */}
        <TabsContent value="ligacoes" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Ligações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { empresa: "Ind. Gamma", contato: "Roberto Alves", duracao: "8 min 34s", tipo: "saida", hora: "Hoje, 10:30", resultado: "Positivo" },
                  { empresa: "Dist. Beta", contato: "Ana Costa", duracao: "4 min 12s", tipo: "entrada", hora: "Ontem, 15:20", resultado: "Follow-up agendado" },
                  { empresa: "Farmácia Delta", contato: "Paulo Rodrigues", duracao: "12 min 55s", tipo: "saida", hora: "Seg, 11:00", resultado: "Diagnóstico confirmado" },
                ].map((lig, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${lig.tipo === "saida" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600"}`}>
                      <Phone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800">{lig.empresa}</p>
                      <p className="text-xs text-muted-foreground">{lig.contato} · {lig.hora}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-slate-700">{lig.duracao}</p>
                      <p className="text-[10px] text-muted-foreground">{lig.resultado}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${lig.tipo === "saida" ? "border-blue-300 text-blue-700" : "border-green-300 text-green-700"}`}>
                      {lig.tipo === "saida" ? "↑ Saída" : "↓ Entrada"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
