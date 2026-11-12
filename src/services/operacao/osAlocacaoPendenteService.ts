// ============================================================================
// REFINAMENTO-FLUXO-ALOCACAO-TMS
//
// Ações de alocação para OSs ÓRFÃS (sem prestador vinculado). Usado pela
// Listagem de Ordens de Serviço para o gestor agir rápido:
//   (a) "Publicar na Rede"          -> src/services/operacao/redePrestadoresService
//   (b) "Notificar base/Agregados"  -> este serviço
//
// Não cria tabelas novas: usa `portal_notificacoes` (a mesma lida pelo app do
// prestador via vw_app_notificacoes_pendentes) e registra histórico na OS.
// ============================================================================
import { supabase } from "@/lib/supabase";
import { bairroComSigla } from "@/lib/resumoRotaOS";
import { veiculoCompativel, tiposVeiculoDoPrestador } from "@/services/operacao/redeVeiculoFiltro";

/** Horas sem prestador a partir das quais a OS entra em "Risco de SLA". */
export const HORAS_RISCO_SEM_ALOCACAO = 4;

export interface NotificacaoBaseResultado {
  sucesso: boolean;
  /** Quantidade de prestadores notificados (compatíveis e elegíveis). */
  total: number;
  erro?: string;
}

interface PrestadorCandidato {
  id: string;
  nome_completo: string | null;
  tipo_parceiro: string | null;
  status: string | null;
  liberado_app: boolean | null;
  veiculo_tipo: string | null;
  regiao_principal: string | null;
  veiculos?: Array<{ tipo_veiculo?: string | null; status?: string | null }> | null;
}

type EnderecoOS = {
  tipo?: string;
  cidade?: string;
  uf?: string;
  estado?: string;
  bairro?: string;
  endereco?: string;
  logradouro?: string;
};

interface OsResumo {
  id: string;
  numero: string | null;
  tipo_operacao: string | null;
  veiculo_tipo: string | null;
  carga_refrigerada: boolean | null;
  peso: number | null;
  custo_prestador: number | null;
  enderecos: EnderecoOS[] | null;
}

function cidadeColeta(enderecos: OsResumo["enderecos"]): string {
  try {
    const lista = Array.isArray(enderecos) ? enderecos : [];
    const coleta = lista.find((e) => e?.tipo === "coleta") || lista[0];
    return bairroComSigla(coleta) || "";
  } catch {
    return "";
  }
}

function cidadeEntrega(enderecos: OsResumo["enderecos"]): string {
  try {
    const lista = Array.isArray(enderecos) ? enderecos : [];
    const entrega =
      [...lista].reverse().find((e) => e?.tipo === "entrega" || e?.tipo === "destino") ||
      lista[lista.length - 1];
    return bairroComSigla(entrega) || "";
  } catch {
    return "";
  }
}

function formatarValorBR(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return "";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Notifica prestadores cadastrados (base) e agregados elegíveis para uma OS
 * que ainda não possui prestador. Cria uma notificação no app do prestador
 * (`portal_notificacoes`) para cada candidato compatível.
 */
export async function notificarBaseAgregados(osId: string): Promise<NotificacaoBaseResultado> {
  try {
    if (!osId) return { sucesso: false, total: 0, erro: "OS inválida" };

    const { data: os, error: osErr } = await supabase
      .from("ordens_servico")
      .select("id, numero, tipo_operacao, veiculo_tipo, carga_refrigerada, peso, custo_prestador, enderecos, prestador, prestador_id")
      .eq("id", osId)
      .single();
    if (osErr) throw osErr;

    const osResumo = os as unknown as OsResumo & { prestador?: string; prestador_id?: string };

    // Defesa: não notifica base para OS que já possui prestador.
    if ((osResumo.prestador || "").trim() || String(osResumo.prestador_id || "").trim()) {
      return { sucesso: false, total: 0, erro: "OS já possui prestador vinculado." };
    }

    const { data: prestadores, error: pErr } = await supabase
      .from("prestadores")
      .select("id, nome_completo, tipo_parceiro, status, liberado_app, veiculo_tipo, regiao_principal, veiculos(tipo_veiculo, status)")
      .eq("status", "ativo");
    if (pErr) throw pErr;

    const tipoNecessario = osResumo.veiculo_tipo || "";
    const cidadeOrigem = cidadeColeta(osResumo.enderecos);
    const cidadeDestino = cidadeEntrega(osResumo.enderecos);
    const valorPrestador = Number(osResumo.custo_prestador) || 0;

    const elegiveis = ((prestadores || []) as PrestadorCandidato[]).filter((p) => {
      // Elegibilidade operacional básica: liberado para o app (quando informado).
      if (p.liberado_app === false) return false;
      // Compatibilidade de veículo (rigorosa, mesma regra da Rede).
      return veiculoCompativel(tipoNecessario, tiposVeiculoDoPrestador(p));
    });

    if (elegiveis.length === 0) {
      return { sucesso: true, total: 0 };
    }

    const numero = osResumo.numero || osId;
    const rota = [cidadeOrigem, cidadeDestino].filter(Boolean).join(" ━➤ ");
    const valorTexto = formatarValorBR(valorPrestador);
    const titulo = "Operação aguardando alocação";
    const detalheRota = rota ? ` Rota: ${rota}.` : "";
    const detalheValor = valorTexto ? ` Repasse: R$ ${valorTexto}.` : "";
    const mensagem = `OS ${numero} ainda não possui prestador.${detalheRota}${detalheValor} Verifique a Rede de Oportunidades.`;

    // PAYLOAD DO ALERTA — dados formatados consumidos pelo payload de push/FCM
    // e pelo broadcast Realtime. O trigger de `portal_notificacoes` copia este
    // `metadata` para `push_notificacoes_fila.payload`.
    const alertaPayload = {
      os_id: osId,
      numero,
      cidade_origem: cidadeOrigem,
      cidade_destino: cidadeDestino,
      valor_prestador: valorPrestador,
      rota,
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      routing: "/notifications",
    };

    const registros = elegiveis.map((p) => ({
      prestador_id: p.id,
      os_id: osId,
      tipo: "os_sem_alocacao",
      titulo,
      mensagem,
      canal: "app",
      lida: false,
      prioridade: "alta",
      referencia_id: osId,
      origem_id: osId,
      origem_tipo: "ordem_servico",
      metadata: alertaPayload,
    }));

    const { error: nErr } = await supabase.from("portal_notificacoes").insert(registros);
    if (nErr) throw nErr;

    // 1) Broadcast Realtime para a rede de prestadores (app pode escutar online).
    try {
      const canal = supabase.channel(`rede-prestadores-${osId}`);
      canal.subscribe();
      await canal.send({
        type: "broadcast",
        event: "notificar_base",
        payload: alertaPayload,
      });
      await supabase.removeChannel(canal);
    } catch (broadcastErr) {
      console.warn("[OSAlocacaoPendente] Broadcast Realtime indisponível:", broadcastErr);
    }

    // 2) Aciona a Edge Function FCM para consumir a fila (melhor esforço).
    // Se não estiver deployada/configurada, a fila permanece para o cron/webhook.
    try {
      const { error: pushErr } = await supabase.functions.invoke("enviar-push", {
        body: { motivo: "notificar_base", os_id: osId },
      });
      if (pushErr) {
        console.warn("[OSAlocacaoPendente] Edge enviar-push indisponível:", pushErr.message);
      }
    } catch (pushErr) {
      console.warn("[OSAlocacaoPendente] Falha ao acionar enviar-push:", pushErr);
    }

    await supabase.from("os_historico").insert([{
      os_id: osId,
      acao: `Base/agregados notificados (${registros.length})`,
      usuario: "Torre de Controle",
    }]);

    return { sucesso: true, total: registros.length };
  } catch (err: unknown) {
    console.error("[OSAlocacaoPendente] Erro ao notificar base/agregados:", err);
    const msg = err instanceof Error ? err.message : "Falha ao notificar base/agregados";
    return { sucesso: false, total: 0, erro: msg };
  }
}

/** Indica se uma OS criada há muito tempo ainda está sem prestador (risco de SLA). */
export function emRiscoSlaSemAlocacao(
  createdAt: string | null | undefined,
  semPrestador: boolean,
  referenciaEmHoras: number = HORAS_RISCO_SEM_ALOCACAO
): boolean {
  if (!semPrestador || !createdAt) return false;
  const criada = new Date(createdAt).getTime();
  if (Number.isNaN(criada)) return false;
  return Date.now() - criada >= referenciaEmHoras * 60 * 60 * 1000;
}


/** Horas em status pendente/aguardando programacao para alerta de SLA. */
export const HORAS_RISCO_SLA_PENDENTE = 2;

const STATUS_SLA_PENDENTE = new Set([
  "pendente",
  "aguardando_programacao",
  "aguardando programacao",
  "aguardando programação",
  "enviado",
  "em_analise",
]);

/**
 * Indica se uma OS/solicitacao segue pendente (ou aguardando programacao)
 * alem do limite de SLA configurado.
 */
export function emRiscoSlaPendente(
  status: string | null | undefined,
  createdAt: string | null | undefined,
  referenciaEmHoras: number = HORAS_RISCO_SLA_PENDENTE
): boolean {
  const s = String(status || "").toLowerCase().trim();
  if (!STATUS_SLA_PENDENTE.has(s)) return false;
  if (!createdAt) return false;
  const criada = new Date(createdAt).getTime();
  if (Number.isNaN(criada)) return false;
  return Date.now() - criada >= referenciaEmHoras * 60 * 60 * 1000;
}

// ==========================================================================
// LOTE 2 — FAROL DE SLA DE ALOCAÇÃO (OS sem prestador)
//
// Regra baseada no `created_at` (minutos desde a solicitação):
//   • até 20 min  → "ok"       (verde — recente/no prazo)
//   • 20 a 40 min → "atencao"  (amarelo)
//   • acima de 40 → "atrasado" (vermelho)
// ==========================================================================
export const MINUTOS_SLA_ALOCACAO_ATENCAO = 20;
export const MINUTOS_SLA_ALOCACAO_ATRASADO = 40;

export type NivelSlaAlocacao = "ok" | "atencao" | "atrasado";

export interface SlaAlocacao {
  nivel: NivelSlaAlocacao;
  minutos: number;
  label: string;
}

/** Classifica o farol de SLA de uma OS ainda sem prestador. */
export function classificarSlaAlocacao(
  createdAt: string | null | undefined,
  semPrestador: boolean,
): SlaAlocacao | null {
  if (!semPrestador || !createdAt) return null;
  const criada = new Date(createdAt).getTime();
  if (Number.isNaN(criada)) return null;
  const minutos = Math.max(0, Math.floor((Date.now() - criada) / (1000 * 60)));

  if (minutos <= MINUTOS_SLA_ALOCACAO_ATENCAO) {
    return { nivel: "ok", minutos, label: "No prazo" };
  }
  if (minutos <= MINUTOS_SLA_ALOCACAO_ATRASADO) {
    return { nivel: "atencao", minutos, label: "Atenção" };
  }
  return { nivel: "atrasado", minutos, label: "Atrasado" };
}
