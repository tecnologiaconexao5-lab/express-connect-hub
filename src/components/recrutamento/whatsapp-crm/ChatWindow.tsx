import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, User, Phone, Info, MoreVertical, ArrowLeft,
  Check, CheckCheck, Clock, SendHorizonal, Smile,
  Paperclip, PanelsTopLeft, PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppCRMStore, type MessageOrigin } from "@/stores/whatsappCRMStore";
import TemplateSelector from "./TemplateSelector";

const ORIGIN_CONFIG = {
  prestador: { icon: User, label: "Prestador", color: "bg-primary/10 text-primary border-primary/20" },
  ia: { icon: Bot, label: "IA", color: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/20" },
  humano: { icon: User, label: "Recrutador", color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/20" },
  sistema: { icon: Info, label: "Sistema", color: "bg-muted text-muted-foreground border-border" },
  automacao: { icon: Clock, label: "Auto", color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/20" },
};

export default function ChatWindow({ onToggleDetails }: { onToggleDetails: () => void }) {
  const { conversas, mensagens, conversaAtiva, enviarMensagem, assumirConversa, liberarConversa, iaGlobalAtiva } = useWhatsAppCRMStore();
  const [texto, setTexto] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contato = conversas.find((c) => c.id === conversaAtiva);
  const msgs = conversaAtiva ? mensagens[conversaAtiva] || [] : [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const handleSend = () => {
    if (!texto.trim() || !conversaAtiva) return;
    enviarMensagem(conversaAtiva, texto.trim(), contato?.humanoAssumiu ? "humano" : "ia");
    setTexto("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!contato) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
          <p className="text-sm font-medium">Selecione uma conversa</p>
          <p className="text-xs">para começar a atender</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onToggleDetails} className="xl:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            <PanelRight className="w-4 h-4" />
          </button>
          <div className="relative">
            <div className="w-9 h-9 rounded-xl overflow-hidden bg-muted">
              <img src={contato.avatar} alt="" className="w-full h-full object-cover" />
            </div>
            <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card", contato.humanoAssumiu ? "bg-orange-500" : "bg-primary")} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{contato.nome}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{contato.telefone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, "+$1 ($2) $3-$4")}</span>
              {contato.intentClassificada && <span className="px-1.5 py-0.5 rounded bg-muted font-medium">{contato.intentClassificada}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {contato.humanoAssumiu ? (
            <button onClick={() => liberarConversa(contato.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 dark:bg-purple-950/20">
              <Bot className="w-3 h-3" /> Voltar p/ IA
            </button>
          ) : (
            <button onClick={() => assumirConversa(contato.id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-orange-700 bg-orange-50 border border-orange-200 hover:bg-orange-100 dark:bg-orange-950/20">
              <User className="w-3 h-3" /> Assumir
            </button>
          )}
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((msg) => {
          const config = ORIGIN_CONFIG[msg.origem] || ORIGIN_CONFIG.sistema;
          const isPrestador = msg.origem === "prestador";
          const Icon = config.icon;
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex", isPrestador ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[85%] space-y-1", !isPrestador && "flex flex-col items-end")}>
                <div className={cn("flex items-center gap-1.5", !isPrestador && "flex-row-reverse")}>
                  <span className={cn("flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border", config.color)}>
                    <Icon className="w-2.5 h-2.5" />
                    {config.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{formatTime(msg.timestamp)}</span>
                </div>
                <div className={cn("p-3 rounded-2xl text-sm leading-relaxed", isPrestador ? "bg-muted text-foreground rounded-tl-sm" : "bg-primary text-primary-foreground rounded-tr-sm")}>
                  <p className="whitespace-pre-wrap">{msg.texto}</p>
                  {msg.templateUsado && <span className="block mt-1 text-[9px] opacity-60">📋 {msg.templateUsado}</span>}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border bg-card p-3 space-y-2 shrink-0">
        <AnimatePresence>
          {showTemplates && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <TemplateSelector onSelect={(template) => { setTexto(template); setShowTemplates(false); }} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-end gap-2">
          <button onClick={() => setShowTemplates(!showTemplates)} className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-border shrink-0">
            <PanelsTopLeft className="w-4 h-4" />
          </button>
          <button className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-border shrink-0">
            <Paperclip className="w-4 h-4" />
          </button>
          <div className="flex-1 relative">
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={handleKeyDown} placeholder={contato.iaAtiva && !contato.humanoAssumiu ? "IA vai responder automaticamente..." : "Digite sua mensagem..."} rows={1} className="w-full min-h-[36px] max-h-24 px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button onClick={handleSend} disabled={!texto.trim()} className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 shrink-0">
            <SendHorizonal className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
