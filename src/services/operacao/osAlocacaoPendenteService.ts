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

type EnderecoOS = { tipo?: string; cidade?: string; uf?: string };

interface OsResumo {
  id: string;
  numero: string | null;
  tipo_operacao: string | null;
  veiculo_tipo: string | null;
  carga_refrigerada: boolean | null;
  peso: number | null;
  enderecos: EnderecoOS[] | null;
}

function cidadeColeta(enderecos: OsResumo["enderecos"]): string {
  try {
    const lista = Array.isArray(enderecos) ? enderecos : [];
    const coleta = lista.find((e) => e?.tipo === "coleta") || lista[0];
    return coleta?.cidade || coleta?.uf || "";
  } catch {
    return "";
  }
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
      .select("id, numero, tipo_operacao, veiculo_tipo, carga_refrigerada, peso, enderecos, prestador, prestador_id")
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
    const cidade = cidadeColeta(osResumo.enderecos);

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
    const titulo = "Operação aguardando alocação";
    const mensagem = cidade
      ? `OS ${numero} ainda não possui prestador. Região: ${cidade}. Verifique a Rede de Oportunidades.`
      : `OS ${numero} ainda não possui prestador. Verifique a Rede de Oportunidades.`;

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
    }));

    const { error: nErr } = await supabase.from("portal_notificacoes").insert(registros);
    if (nErr) throw nErr;

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
