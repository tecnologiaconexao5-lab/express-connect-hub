// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A24-B — REFINAMENTO FINAL DO CHAT PROFISSIONAL NA TORRE
// ChatTorrePanel.tsx — painel global de Mensagens / Chat com Prestadores.
// Reaproveita 100% da infraestrutura A22 (operacaoChatService + ChatOperacaoPanel)
// e o hotfix A24 (topic único por inscrição).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MessageSquare, Loader2, Truck, Hash, Inbox, ExternalLink, MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChatOperacaoPanel } from "@/components/torre-controle/ChatOperacaoPanel";
import {
  listarConversasTorre,
  contarNaoLidasTorre,
  inscreverMensagensTorre,
  type ConversaOperacaoTorre,
} from "@/services/operacaoChatService";

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  aguardando_aceite: "Aguardando Aceite",
  aceita: "Aceita",
  recusada: "Recusada",
  em_rota: "Em Rota",
  concluida: "Concluída",
  cancelada: "Cancelada",
  ocorrencia: "Ocorrência",
};

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const hoje = new Date();
    const mesmaData =
      d.getDate() === hoje.getDate() &&
      d.getMonth() === hoje.getMonth() &&
      d.getFullYear() === hoje.getFullYear();
    if (mesmaData) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

interface ChatTorrePanelProps {
  onTotalNaoLidas?: (total: number) => void;
  /** Ação "Abrir operação" — reutiliza DetalhesOperacaoSheet da Torre. */
  onAbrirOperacao?: (conversa: ConversaOperacaoTorre) => void;
}

/**
 * Painel global de conversas da Torre. Lista as conversas (por alocação),
 * prioriza não lidas e recentes, mostra OS/Romaneio/status/veículo e não lidas
 * por conversa. Ao selecionar abre o ChatOperacaoPanel (A22) e permite "Abrir operação".
 */
export function ChatTorrePanel({ onTotalNaoLidas, onAbrirOperacao }: ChatTorrePanelProps) {
  const [conversas, setConversas] = useState<ConversaOperacaoTorre[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);

  const refrescarTotal = useCallback(async () => {
    const total = await contarNaoLidasTorre();
    setTotalNaoLidas(total);
    onTotalNaoLidas?.(total);
  }, [onTotalNaoLidas]);

  const carregarConversas = useCallback(async (mostrarLoading = false) => {
    if (mostrarLoading) setLoading(true);
    const lista = await listarConversasTorre(100);
    setConversas(lista);
    setSelecionada((prev) => (prev && lista.some((c) => c.alocacaoId === prev) ? prev : null));
    if (mostrarLoading) setLoading(false);
    await refrescarTotal();
  }, [refrescarTotal]);

  useEffect(() => {
    carregarConversas(true);
    // Realtime A22 (topic único por inscrição — hotfix A24): nova mensagem
    // recarrega e a conversa sobe/atualiza automaticamente, sem polling.
    const cleanup = inscreverMensagensTorre(() => carregarConversas(false));
    return cleanup;
  }, [carregarConversas]);

  // Ao abrir uma conversa, atualiza a contagem global (o ChatOperacaoPanel marca leitura)
  const aoAbrirConversa = async (alocacaoId: string) => {
    setSelecionada(alocacaoId);
    setTimeout(() => refrescarTotal(), 600);
  };

  const conversaSelecionada = conversas.find((c) => c.alocacaoId === selecionada) || null;

  // Busca local (lista já carregada no frontend — sem consulta pesada por tecla)
  const filtradas = useMemo(() => {
    if (!busca.trim()) return conversas;
    const q = busca.trim().toLowerCase();
    return conversas.filter((c) =>
      `${c.prestadorNome} ${c.osNumero} ${c.destino || ""} ${c.origem || ""} ${c.statusOperacao || ""} ${c.ultimaMensagem} ${c.veiculoPlaca || ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [conversas, busca]);

  return (
    <div className="flex flex-col h-full min-h-[480px]">
      {/* Cabeçalho */}
      <div className="px-4 py-3 border-b bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <div className="w-8 h-8 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-[#F97316]" />
          </div>
          Mensagens / Chat com Prestadores
          {totalNaoLidas > 0 && (
            <Badge className="bg-[#F97316] text-white text-[10px] rounded-full px-2">
              {totalNaoLidas} não lida(s)
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => carregarConversas(true)}>
          Atualizar
        </Button>
      </div>

      {/* Corpo */}
      <div className="flex-1 flex min-h-0">
        {/* Lista de conversas */}
        <div className="w-[38%] min-w-[250px] border-r flex flex-col min-h-0 bg-white">
          <div className="p-2 border-b shrink-0">
            <Input
              placeholder="Buscar por prestador, OS, rota, mensagem..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtradas.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs flex flex-col items-center gap-1 px-3">
                <Inbox className="w-8 h-8 opacity-20" />
                {busca
                  ? "Nenhuma conversa encontrada para a busca."
                  : "Nenhuma conversa operacional no momento."}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtradas.map((c) => {
                  const temNaoLidas = c.naoLidas > 0;
                  const ativa = selecionada === c.alocacaoId;
                  return (
                    <button
                      key={c.alocacaoId}
                      onClick={() => aoAbrirConversa(c.alocacaoId)}
                      className={`w-full text-left px-3 py-2.5 transition-colors border-l-2 ${
                        ativa
                          ? "bg-[#F97316]/10 border-l-[#F97316]"
                          : temNaoLidas
                            ? "bg-[#FFF7ED] border-l-[#F97316] hover:bg-orange-50"
                            : "hover:bg-slate-50 border-l-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs flex items-center gap-1 min-w-0 truncate ${temNaoLidas ? "font-black text-slate-900" : "font-bold text-slate-800"}`}>
                          <Truck className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                          <span className="truncate">{c.prestadorNome}</span>
                        </span>
                        {temNaoLidas ? (
                          <span className="shrink-0 min-w-4 h-4 px-1 flex items-center justify-center text-[9px] font-bold text-white bg-[#F97316] rounded-full">
                            {c.naoLidas}
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-300 shrink-0">{formatHora(c.ultimoHorario)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 min-w-0 flex-wrap">
                        {c.osNumero ? (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-600 bg-slate-100 rounded px-1 py-px shrink-0">
                            <Hash className="w-2.5 h-2.5" /> OS {c.osNumero}
                          </span>
                        ) : null}
                        {c.statusOperacao ? (
                          <span className="inline-flex items-center text-[9px] font-medium text-indigo-600 bg-indigo-50 rounded px-1 py-px shrink-0">
                            {STATUS_LABEL[c.statusOperacao] || c.statusOperacao}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1 mt-1 min-w-0">
                        {c.veiculoPlaca ? (
                          <span className="text-[9px] font-mono text-slate-400 shrink-0">{c.veiculoPlaca}</span>
                        ) : null}
                        {c.destino ? (
                          <span className="text-[9px] text-slate-400 truncate inline-flex items-center gap-0.5 min-w-0">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{c.destino}</span>
                          </span>
                        ) : null}
                      </div>
                      <p className={`text-[10px] truncate mt-1 ${temNaoLidas ? "text-slate-700 font-medium" : "text-slate-500"}`}>
                        {c.ultimoRemetente === "torre" ? "Você: " : ""}
                        {c.ultimaMensagem}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Thread da conversa selecionada */}
        <div className="flex-1 min-w-0 bg-slate-50/40 flex flex-col min-h-0">
          {conversaSelecionada ? (
            <>
              {/* Cabeçalho da conversa — Prestador → OS/Romaneio → Status → Veículo */}
              <div className="px-4 py-2.5 border-b bg-white flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#F97316]/10 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-[#F97316]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-800 truncate">{conversaSelecionada.prestadorNome}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {conversaSelecionada.osNumero ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-600 bg-slate-100 rounded px-1 py-px">
                          <Hash className="w-2.5 h-2.5" /> OS {conversaSelecionada.osNumero}
                        </span>
                      ) : null}
                      {conversaSelecionada.statusOperacao ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1 py-px">
                          {STATUS_LABEL[conversaSelecionada.statusOperacao] || conversaSelecionada.statusOperacao}
                        </span>
                      ) : null}
                      {conversaSelecionada.veiculoPlaca ? (
                        <span className="inline-flex items-center text-[10px] font-mono text-slate-500 bg-slate-50 rounded px-1 py-px">
                          {conversaSelecionada.veiculoPlaca}
                          {conversaSelecionada.veiculoTipo ? ` · ${conversaSelecionada.veiculoTipo}` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                {conversaSelecionada.osId && onAbrirOperacao && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-[10px] shrink-0 border-[#E5E7EB] text-[#F97316] hover:bg-[#F97316]/10"
                    onClick={() => onAbrirOperacao(conversaSelecionada)}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir operação
                  </Button>
                )}
              </div>

              {/* Histórico + resposta (A22) */}
              <div className="flex-1 min-h-0">
                <ChatOperacaoPanel
                  alocacaoId={conversaSelecionada.alocacaoId}
                  prestadorNome={conversaSelecionada.prestadorNome}
                  osNumero={conversaSelecionada.osNumero || undefined}
                  onUnreadChange={(t) => { setTotalNaoLidas(t); onTotalNaoLidas?.(t); }}
                />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 opacity-20 mb-3" />
              <p className="text-sm font-medium text-slate-500">Selecione uma conversa</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[260px]">
                Escolha uma conversa à esquerda para ver o histórico, responder ao prestador
                e abrir a operação relacionada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatTorrePanel;
