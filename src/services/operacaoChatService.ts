// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO A22 — CHAT OPERACIONAL APP PRESTADOR ⇄ TORRE DE CONTROLE
// operacaoChatService.ts
// Service dedicado de mensagens da operação. Toda comunicação passa por aqui.
// Backend: tabela operacao_mensagens + RPCs SECURITY DEFINER (migration A22).
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "@/lib/supabase";

export type OperacaoMensagemSenderType = "prestador" | "torre";
export type OperacaoMensagemStatus = "enviada" | "lida";

export interface OperacaoMensagem {
  id: string;
  alocacao_id: string;
  os_id: string | null;
  prestador_id: string | null;
  sender_type: OperacaoMensagemSenderType;
  sender_user_id: string | null;
  mensagem: string;
  status: OperacaoMensagemStatus;
  read_at: string | null;
  idempotency_key: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface EnvioMensagemResultado {
  success: boolean;
  mensagem_id?: string;
  notificacao_id?: string | null;
  duplicada?: boolean;
  atualizadas?: number;
  erro?: string;
}

function novoIdempotencyKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

// MISSÃO A24-HOTFIX:
// O realtime-js REUTILIZA canais com o mesmo topic (supabase.channel(topic)).
// Se dois componentes chamam .channel("operacao-mensagens-topbar"), o 2º recebe
// o MESMO canal já subscrito e o .on() dispara:
//   "cannot add 'postgres_changes' callbacks ... after 'subscribe()'".
// Correção: gerar um topic ÚNICO por inscrição e registrar o handler ANTES do
// subscribe (ordem .on() → .subscribe()). Cleanup remove apenas o canal criado.
let canalContador = 0;

function topicCanalUnico(base: string): string {
  canalContador += 1;
  return `${base}-${canalContador}-${Date.now().toString(36)}`;
}

/** Lista mensagens da operação (ordenadas cronologicamente). */
export async function listarMensagens(alocacaoId: string): Promise<OperacaoMensagem[]> {  try {
    const { data, error } = await supabase
      .from("operacao_mensagens")
      .select("*")
      .eq("alocacao_id", alocacaoId)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("[operacaoChatService] Erro ao listar mensagens:", error.message);
      return [];
    }
    return (data || []) as OperacaoMensagem[];
  } catch (err: any) {
    console.warn("[operacaoChatService] Exceção ao listar mensagens:", err);
    return [];
  }
}

/** App (prestador) → Torre. Contrato backend: f_enviar_mensagem_torre. */
export async function enviarMensagemAppParaTorre(
  alocacaoId: string,
  mensagem: string,
  idempotencyKey?: string
): Promise<EnvioMensagemResultado> {
  try {
    const { data, error } = await supabase.rpc("f_enviar_mensagem_torre", {
      p_alocacao_id: alocacaoId,
      p_mensagem: mensagem,
      p_idempotency_key: idempotencyKey || novoIdempotencyKey(),
    });
    if (error) return { success: false, erro: error.message };
    return (data || { success: false, erro: "Sem retorno do servidor" }) as EnvioMensagemResultado;
  } catch (err: any) {
    return { success: false, erro: err.message || "Não foi possível enviar. Tente novamente." };
  }
}

/** Torre → App (prestador). Contrato backend: f_responder_mensagem_torre. */
export async function responderMensagem(
  alocacaoId: string,
  mensagem: string,
  idempotencyKey?: string
): Promise<EnvioMensagemResultado> {
  try {
    const { data, error } = await supabase.rpc("f_responder_mensagem_torre", {
      p_alocacao_id: alocacaoId,
      p_mensagem: mensagem,
      p_idempotency_key: idempotencyKey || novoIdempotencyKey(),
    });
    if (error) return { success: false, erro: error.message };
    return (data || { success: false, erro: "Sem retorno do servidor" }) as EnvioMensagemResultado;
  } catch (err: any) {
    return { success: false, erro: err.message || "Não foi possível enviar. Tente novamente." };
  }
}

/** Torre marca como lidas as mensagens do prestador da operação. */
export async function marcarComoLidaTorre(alocacaoId: string): Promise<EnvioMensagemResultado> {
  try {
    const { data, error } = await supabase.rpc("f_marcar_mensagens_lidas_torre", {
      p_alocacao_id: alocacaoId,
    });
    if (error) return { success: false, erro: error.message };
    return (data || { success: false }) as EnvioMensagemResultado;
  } catch (err: any) {
    return { success: false, erro: err.message };
  }
}

/** App marca como lidas as mensagens da Torre da operação (uso futuro Fase 3). */
export async function marcarComoLidaApp(alocacaoId: string): Promise<EnvioMensagemResultado> {
  try {
    const { data, error } = await supabase.rpc("f_marcar_mensagens_lidas_app", {
      p_alocacao_id: alocacaoId,
    });
    if (error) return { success: false, erro: error.message };
    return (data || { success: false }) as EnvioMensagemResultado;
  } catch (err: any) {
    return { success: false, erro: err.message };
  }
}

/** Contagem real de mensagens do prestador não lidas pela Torre (badge). */
export async function contarNaoLidasTorre(): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("f_contar_mensagens_nao_lidas_torre");
    if (error) return 0;
    return Number(data) || 0;
  } catch {
    return 0;
  }
}

/** Inscreve em novas mensagens da operação (Realtime). Retorna função de cleanup. */
export function inscreverMensagensOperacao(
  alocacaoId: string,
  onNova: (mensagem: OperacaoMensagem) => void,
  onAtualizada?: (mensagem: OperacaoMensagem) => void
): () => void {
  // HOTFIX A24: topic único por inscrição (evita reutilizar canal já subscrito)
  const channel = supabase
    .channel(topicCanalUnico(`operacao-mensagens-${alocacaoId}`))
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "operacao_mensagens",
        filter: `alocacao_id=eq.${alocacaoId}`,
      },
      (payload) => {
        if (payload.new) onNova(payload.new as OperacaoMensagem);
      }
    )
    // A28 — read receipt ao vivo: quando o App marca como lida (UPDATE),
    // o painel da Torre reflete "Visualizada" sem refresh manual.
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "operacao_mensagens",
        filter: `alocacao_id=eq.${alocacaoId}`,
      },
      (payload) => {
        if (payload.new && onAtualizada) onAtualizada(payload.new as OperacaoMensagem);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Inscreve em qualquer mudança de operacao_mensagens (badge global da Torre). Retorna cleanup. */
export function inscreverMensagensTorre(onChange: () => void): () => void {
  // HOTFIX A24: topic único por inscrição (evita reutilizar canal já subscrito
  // por AppTopbar, TorreControle e ChatTorrePanel simultaneamente)
  const channel = supabase
    .channel(topicCanalUnico("operacao-mensagens-topbar"))
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "operacao_mensagens" },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* ============================================================
 * MISSÃO A24 — CHAT VISÍVEL NA TORRE
 * Lista de conversas (agrupada por alocação) reutilizando a A22.
 * Nenhuma nova tabela/RPC — somente leitura das tabelas existentes.
 * ============================================================ */

export interface ConversaOperacaoTorre {
  alocacaoId: string;
  osId: string | null;
  prestadorId: string | null;
  prestadorNome: string;
  osNumero: string;
  destino: string | null;
  origem: string | null;
  statusOperacao: string | null;
  veiculoPlaca: string | null;
  veiculoTipo: string | null;
  ultimaMensagem: string;
  ultimoHorario: string | null;
  totalMensagens: number;
  naoLidas: number;
  ultimoRemetente: OperacaoMensagemSenderType | null;
}

export interface MensagemConversaRaw {
  id: string;
  alocacao_id: string;
  os_id: string | null;
  prestador_id: string | null;
  sender_type: OperacaoMensagemSenderType;
  mensagem: string;
  status: OperacaoMensagemStatus;
  created_at: string;
}

export interface InfoAlocacaoConversa {
  prestadorNome?: string | null;
  osNumero?: string | null;
  destino?: string | null;
  origem?: string | null;
  status?: string | null;
  placa?: string | null;
  tipoVeiculo?: string | null;
}

/**
 * Função pura — agrupa mensagens cruas por alocação e monta as conversas.
 * Testável sem banco. `enriquecer` fornece prestador/OS/status/veículo/destino.
 */
export function montarConversasTorre(
  mensagens: MensagemConversaRaw[],
  enriquecer: (alocacaoId: string, ultima: MensagemConversaRaw) => InfoAlocacaoConversa
): ConversaOperacaoTorre[] {
  if (!mensagens.length) return [];

  const porAlocacao = new Map<string, MensagemConversaRaw[]>();
  for (const m of mensagens) {
    if (!m.alocacao_id) continue;
    const grupo = porAlocacao.get(m.alocacao_id) || [];
    grupo.push(m);
    porAlocacao.set(m.alocacao_id, grupo);
  }

  const conversas: ConversaOperacaoTorre[] = [];
  for (const [alocacaoId, grupoRaw] of porAlocacao.entries()) {
    const grupo = [...grupoRaw].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    const ultima = grupo[grupo.length - 1];
    const naoLidas = grupo.filter(
      (m) => m.sender_type === "prestador" && m.status === "enviada"
    ).length;
    const info = enriquecer(alocacaoId, ultima);
    conversas.push({
      alocacaoId,
      osId: ultima.os_id || null,
      prestadorId: ultima.prestador_id || null,
      prestadorNome: info.prestadorNome || "Motorista",
      osNumero: info.osNumero || "",
      destino: info.destino || null,
      origem: info.origem || null,
      statusOperacao: info.status || null,
      veiculoPlaca: info.placa || null,
      veiculoTipo: info.tipoVeiculo || null,
      ultimaMensagem: ultima.mensagem || "",
      ultimoHorario: ultima.created_at || null,
      totalMensagens: grupo.length,
      naoLidas,
      ultimoRemetente: ultima.sender_type || null,
    });
  }

  // Ordenação operacional: (1) não lidas primeiro; (2) mais recente; (3) data decrescente.
  conversas.sort((a, b) => {
    const ta = a.ultimoHorario ? new Date(a.ultimoHorario).getTime() : 0;
    const tb = b.ultimoHorario ? new Date(b.ultimoHorario).getTime() : 0;
    if ((a.naoLidas > 0 ? 1 : 0) !== (b.naoLidas > 0 ? 1 : 0)) {
      return (b.naoLidas > 0 ? 1 : 0) - (a.naoLidas > 0 ? 1 : 0);
    }
    return tb - ta;
  });

  return conversas;
}

/**
 * Lista todas as conversas (por alocação) que possuem mensagens,
 * com prestador, OS/Romaneio, status, veículo, última mensagem, horário e não lidas.
 * Fonte: operacao_mensagens + alocacoes_escala + prestadores + ordens_servico.
 */
export async function listarConversasTorre(limit: number = 100): Promise<ConversaOperacaoTorre[]> {
  try {
    const { data, error } = await supabase
      .from("operacao_mensagens")
      .select("id, alocacao_id, os_id, prestador_id, sender_type, mensagem, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("[operacaoChatService] Erro ao listar conversas:", error.message);
      return [];
    }
    if (!data || data.length === 0) return [];

    const alocacaoIds = [...new Set((data as any[]).map((m) => m.alocacao_id).filter(Boolean))];
    const osIds = [...new Set((data as any[]).map((m) => m.os_id).filter(Boolean))];
    const prestadorIds = [...new Set((data as any[]).map((m) => m.prestador_id).filter(Boolean))];

    const [alocRes, osRes, prestRes] = await Promise.all([
      alocacaoIds.length
        ? supabase
            .from("alocacoes_escala")
            .select("id, prestador_id, ordem_servico_id, origem, destino, status, placa, tipo_veiculo")
            .in("id", alocacaoIds)
        : { data: [] as any[] },
      osIds.length
        ? supabase.from("ordens_servico").select("id, numero").in("id", osIds)
        : { data: [] as any[] },
      prestadorIds.length
        ? supabase.from("prestadores").select("id, nome_completo").in("id", prestadorIds)
        : { data: [] as any[] },
    ]);

    const alocMap = new Map((alocRes.data || []).map((a: any) => [a.id, a]));
    const osMap = new Map((osRes.data || []).map((o: any) => [o.id, o]));
    const prestMap = new Map((prestRes.data || []).map((p: any) => [p.id, p]));

    return montarConversasTorre(data as MensagemConversaRaw[], (alocacaoId, ultima) => {
      const aloc = alocMap.get(alocacaoId);
      const osId = aloc?.ordem_servico_id || ultima.os_id;
      const os = osId ? osMap.get(osId) : undefined;
      const prest = aloc?.prestador_id ? prestMap.get(aloc.prestador_id) : undefined;
      return {
        prestadorNome: prest?.nome_completo || "Motorista",
        osNumero: os?.numero || "",
        destino: aloc?.destino || null,
        origem: aloc?.origem || null,
        status: aloc?.status || null,
        placa: aloc?.placa || null,
        tipoVeiculo: aloc?.tipo_veiculo || null,
      };
    });
  } catch (err: any) {
    console.warn("[operacaoChatService] Exceção ao listar conversas:", err);
    return [];
  }
}
