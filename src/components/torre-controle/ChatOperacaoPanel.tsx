// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A22 — CHAT OPERACIONAL APP PRESTADOR ⇄ TORRE DE CONTROLE
// ChatOperacaoPanel.tsx — aba "Mensagens" da operação (Torre de Controle).
// Design segue o padrão visual do DetalhesOperacaoSheet / ConversasHub.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import {
  MessageSquare, Send, Loader2, Clock, CheckCircle2, Truck, User, Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  listarMensagens,
  responderMensagem,
  marcarComoLidaTorre,
  contarNaoLidasTorre,
  inscreverMensagensOperacao,
  type OperacaoMensagem,
} from "@/services/operacaoChatService";

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

interface ChatOperacaoPanelProps {
  alocacaoId: string;
  prestadorNome?: string;
  osNumero?: string;
  onUnreadChange?: (totalNaoLidas: number) => void;
}

export function ChatOperacaoPanel({
  alocacaoId,
  prestadorNome,
  osNumero,
  onUnreadChange,
}: ChatOperacaoPanelProps) {
  const [mensagens, setMensagens] = useState<OperacaoMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  const refrescarTotal = async (): Promise<number> => {
    const total = await contarNaoLidasTorre();
    onUnreadChange?.(total);
    return total;
  };

  const carregar = async () => {
    setLoading(true);
    const data = await listarMensagens(alocacaoId);
    setMensagens(data);
    setLoading(false);
    // Ao abrir a conversa, a Torre marca como lidas as mensagens do prestador
    const r = await marcarComoLidaTorre(alocacaoId);
    if (r.success && (r.atualizadas ?? 0) > 0 && onUnreadChange) {
      await refrescarTotal();
    }
  };

  useEffect(() => {
    if (!alocacaoId) return;
    setMensagens([]);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alocacaoId]);

  // Realtime: mensagens novas aparecem sem F5 + UPDATE reflete "Visualizada"
  useEffect(() => {
    if (!alocacaoId) return;
    const cleanup = inscreverMensagensOperacao(
      alocacaoId,
      (nova) => {
        setMensagens((prev) => {
          if (prev.some((m) => m.id === nova.id)) return prev;
          const next = [...prev, nova];
          marcarComoLidaTorre(alocacaoId).then((r) => {
            if (r.success && (r.atualizadas ?? 0) > 0) refrescarTotal();
          });
          return next;
        });
      },
      (atualizada) => {
        setMensagens((prev) => {
          if (!prev.some((m) => m.id === atualizada.id)) return prev;
          return prev.map((m) => (m.id === atualizada.id ? atualizada : m));
        });
      }
    );
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alocacaoId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens.length, loading]);

  async function handleEnviar() {
    const msg = texto.trim();
    if (!msg || !alocacaoId || enviando) return;
    setEnviando(true);
    setErro("");
    const res = await responderMensagem(alocacaoId, msg);
    if (res.success) {
      setTexto("");
      const data = await listarMensagens(alocacaoId);
      setMensagens(data);
    } else {
      setErro("Não foi possível enviar. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <div className="flex flex-col h-full min-h-[320px] rounded-lg border border-border/40 bg-white overflow-hidden">
      {/* Cabeçalho simples */}
      <div className="px-4 py-3 border-b bg-slate-50/70 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 min-w-0">
          <Truck className="w-4 h-4 text-primary shrink-0" />
          <span className="truncate">{prestadorNome || "Motorista"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {osNumero && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <Hash className="w-3 h-3" /> {osNumero}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] gap-1">
            <MessageSquare className="w-3 h-3" /> Mensagens
          </Badge>
        </div>
      </div>

      {/* Histórico */}
      <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : mensagens.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm flex flex-col items-center gap-1">
            <MessageSquare className="w-10 h-10 opacity-20" />
            Sem mensagens ainda
          </div>
        ) : (
          mensagens.map((m) => {
            const isTorre = m.sender_type === "torre";
            return (
              <div key={m.id} className={`flex ${isTorre ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
                  isTorre
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-white border text-slate-800 rounded-bl-sm"
                }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-semibold ${isTorre ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {isTorre ? "Torre" : "Motorista"}
                    </span>
                    {isTorre && <User className="w-3 h-3 opacity-60" />}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.mensagem}</p>
                  <div className={`flex items-center justify-end gap-1 mt-1 ${isTorre ? "text-primary-foreground/70" : "text-slate-400"}`}>
                    <span className="text-[10px]">{formatHora(m.created_at)}</span>
                    {isTorre && (
                      <>
                        {m.status === "lida"
                          ? <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                          : <Clock className="w-3 h-3" />}
                        <span className="text-[10px]">
                          {m.status === "lida" ? "Visualizada" : "Enviada"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Campo inferior */}
      <div className="p-3 bg-white border-t space-y-2">
        {erro && <p className="text-xs text-rose-600">{erro}</p>}
        <div className="flex gap-2 items-end">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Digite uma mensagem..."
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleEnviar();
              }
            }}
          />
          <Button
            className="shrink-0 h-11 w-11 p-0"
            disabled={enviando || !texto.trim() || !alocacaoId}
            onClick={handleEnviar}
            title="Enviar mensagem"
          >
            {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
