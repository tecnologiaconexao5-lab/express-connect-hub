// ============================================================================
// helpers/idempotencia.ts — Cenário 1 (Mobile / Resiliência Offline)
// ----------------------------------------------------------------------------
// Harness para testar o CONTRATO do App Motorista no nível de transporte,
// usando a RPC oficial:
//   f_avancar_etapa_app_motorista(p_alocacao_id, p_etapa, p_payload,
//                                 p_idempotency_key, p_auth_user_id)
//
// Estratégia de resiliência (offline -> online):
//   O cliente do motorista usa um `fetch` custom que LANÇA erro quando o
//   "controle de rede" está offline. Isso simula a perda de conectividade no
//   exato ponto de transporte (igual ao app Flutter). Ao voltar online, a fila
//   (outbox) é drenada e a MESMA idempotency_key é reenviada — inclusive em
//   dupla entrega (at-least-once) — provando que o backend aplica UMA vez.
//
// Requisitos de ambiente:
//   - SUPABASE_SERVICE_ROLE_KEY  (fixture mock + leitura sem RLS + cleanup)
//   - SUPABASE_URL/ANON           (via VITE_SUPABASE_URL / fallback)
//   - OU fixture fixa: E2E_MOTORISTA_EMAIL / E2E_MOTORISTA_PASSWORD /
//                      E2E_ALOCACAO_ID / E2E_PRESTADOR_ID
//   - DATABASE_URL (opcional) → permite checar a volatilidade da RPC (A01)
// ============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";

const TENANT_PADRAO = "00000000-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Contrato da RPC
// ---------------------------------------------------------------------------
export interface RpcAvancarResponse {
  success: boolean;
  error?: string;
  message?: string;
  etapa?: string;
  etapa_anterior?: string;
  status?: string;
  event_id?: string;
  idempotent?: boolean;
}

/** Mapa etapa -> event_type usado pela RPC (para asserção na timeline). */
export const ETAPA_PARA_EVENTO: Record<string, string> = {
  viagem_aceita: "operation_accepted",
  cheguei_coleta: "arrived_pickup",
  carregamento_iniciado: "loading_started",
  carregamento_finalizado: "loading_finished",
  romaneio_informado: "romaneio_informado",
  foto_romaneio: "romaneio_foto",
  km_inicial_informado: "km_registered",
  saiu_em_rota: "route_started",
  chegou_entrega: "arrived_delivery",
  descarregamento_iniciado: "unloading_started",
  descarga_finalizada: "unloading_finished",
  km_final_informado: "km_final",
  assinatura_capturada: "signature_captured",
  pod_registrado: "pod_sent",
  servico_finalizado: "operation_finished",
};

/** Sequência mínima válida da máquina de estados até a baixa (POD). */
export const CAMINHO_ATE_POD: string[] = [
  "viagem_aceita",
  "cheguei_coleta",
  "carregamento_iniciado",
  "carregamento_finalizado",
  "km_inicial_informado",
  "saiu_em_rota",
  "chegou_entrega",
  "descarregamento_iniciado",
  "descarga_finalizada",
  "km_final_informado",
  "assinatura_capturada",
  "pod_registrado",
];

export const CAMINHO_ATE_FINALIZACAO: string[] = [
  ...CAMINHO_ATE_POD,
  "servico_finalizado",
];

export function novoIdempotencyKey(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Cliente de administração (service role) e cliente do motorista
// ---------------------------------------------------------------------------
export function criarClienteAdmin(): SupabaseClient {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) {
    throw new Error(
      "[E2E] SUPABASE_SERVICE_ROLE_KEY ausente — necessário para fixture mock, " +
        "leitura sem RLS e cleanup.",
    );
  }
  return createClient(SUPABASE_URL, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Controle de rede compartilhado — o "modo avião" do motorista. */
export interface ControleRede {
  online: boolean;
}

export class ErroRedeOffline extends Error {
  constructor() {
    super("Failed to fetch (rede simuladamente OFFLINE no dispositivo do motorista)");
    this.name = "ErroRedeOffline";
  }
}

/** `fetch` que simula queda de conectividade no ponto de transporte. */
export function criarFetchComControleRede(ctrl: ControleRede): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    if (!ctrl.online) throw new ErroRedeOffline();
    return fetch(input, init);
  }) as typeof fetch;
}

/**
 * Autentica como o motorista (JWT real em auth.uid()) e retorna um cliente cujo
 * transporte pode ser derrubado via `controleRede.online = false`.
 */
export async function criarClienteMotorista(
  email: string,
  password: string,
  controleRede: ControleRede = { online: true },
): Promise<{ client: SupabaseClient; userId: string; controleRede: ControleRede }> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: criarFetchComControleRede(controleRede) },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`[E2E] Falha ao autenticar motorista ${email}: ${error?.message}`);
  }
  return { client, userId: data.user.id, controleRede };
}

// ---------------------------------------------------------------------------
// Chamada da RPC + idempotência
// ---------------------------------------------------------------------------
export interface ParametrosAvancar {
  alocacaoId: string;
  etapa: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string | null;
}

export async function avancarEtapa(
  client: SupabaseClient,
  params: ParametrosAvancar,
): Promise<RpcAvancarResponse> {
  const { data, error } = await client.rpc("f_avancar_etapa_app_motorista", {
    p_alocacao_id: params.alocacaoId,
    p_etapa: params.etapa,
    p_payload: params.payload ?? {},
    p_idempotency_key: params.idempotencyKey ?? null,
  });
  if (error) {
    // Erro de transporte/servidor (ex.: A01 — "INSERT is not allowed in a
    // non-volatile function" quando a RPC está STABLE em produção).
    throw new Error(
      `[E2E] RPC f_avancar_etapa_app_motorista falhou (${params.etapa}): ${error.message}`,
    );
  }
  return data as unknown as RpcAvancarResponse;
}

// ---------------------------------------------------------------------------
// Outbox offline do motorista
// ---------------------------------------------------------------------------
export interface EventoOutbox {
  alocacaoId: string;
  etapa: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  tentativas: number;
  sincronizado: boolean;
  resposta?: RpcAvancarResponse;
}

export class OutboxMotorista {
  private fila: EventoOutbox[] = [];

  constructor(
    private readonly client: SupabaseClient,
    private readonly rede: ControleRede,
  ) {}

  get pendentes(): EventoOutbox[] {
    return this.fila.filter((e) => !e.sincronizado);
  }

  get todos(): EventoOutbox[] {
    return [...this.fila];
  }

  /** Enfileira um evento (acontece mesmo com a rede caída). */
  enfileirar(
    alocacaoId: string,
    etapa: string,
    payload: Record<string, unknown> = {},
    idempotencyKey = novoIdempotencyKey(),
  ): EventoOutbox {
    const evento: EventoOutbox = {
      alocacaoId,
      etapa,
      payload,
      idempotencyKey,
      tentativas: 0,
      sincronizado: false,
    };
    this.fila.push(evento);
    return evento;
  }

  /**
   * Drena a fila em ordem. Se offline, lança ErroRedeOffline e NADA é enviado
   * (os eventos permanecem pendentes para a próxima tentativa).
   */
  async sincronizar(): Promise<RpcAvancarResponse[]> {
    if (!this.rede.online) throw new ErroRedeOffline();
    const aplicados: RpcAvancarResponse[] = [];
    for (const evento of this.fila.filter((e) => !e.sincronizado)) {
      evento.tentativas += 1;
      const resposta = await avancarEtapa(this.client, {
        alocacaoId: evento.alocacaoId,
        etapa: evento.etapa,
        payload: evento.payload,
        idempotencyKey: evento.idempotencyKey,
      });
      evento.resposta = resposta;
      evento.sincronizado = true;
      aplicados.push(resposta);
    }
    return aplicados;
  }

  /**
   * At-least-once: reenvia o MESMO item duas vezes com a mesma idempotency_key.
   * A 1ª deve aplicar; a 2ª deve retornar { idempotent: true } (e não duplicar).
   */
  async enviarComDuplaEntrega(
    evento: EventoOutbox,
  ): Promise<[RpcAvancarResponse, RpcAvancarResponse]> {
    const primeira = await avancarEtapa(this.client, {
      alocacaoId: evento.alocacaoId,
      etapa: evento.etapa,
      payload: evento.payload,
      idempotencyKey: evento.idempotencyKey,
    });
    const segunda = await avancarEtapa(this.client, {
      alocacaoId: evento.alocacaoId,
      etapa: evento.etapa,
      payload: evento.payload,
      idempotencyKey: evento.idempotencyKey,
    });
    evento.tentativas += 2;
    evento.sincronizado = true;
    evento.resposta = primeira;
    return [primeira, segunda];
  }
}

// ---------------------------------------------------------------------------
// Fixture: motorista + prestador + veículo + alocação
// ---------------------------------------------------------------------------
export interface FixtureMotorista {
  alocacaoId: string;
  prestadorId: string;
  veiculoId: string | null;
  authUserId: string;
  email: string;
  password: string;
  criadoAutomaticamente: boolean;
}

/**
 * Resolve a fixture: usa a fixa (env) quando informada; caso contrário,
 * provisiona mock via service role (auth user + prestador + veículo + alocação).
 */
export async function resolverOuCriarFixtureMotorista(): Promise<FixtureMotorista> {
  const email = process.env.E2E_MOTORISTA_EMAIL;
  const password = process.env.E2E_MOTORISTA_PASSWORD;
  const alocacaoId = process.env.E2E_ALOCACAO_ID;
  const prestadorId = process.env.E2E_PRESTADOR_ID;

  if (email && password && alocacaoId && prestadorId) {
    return {
      alocacaoId,
      prestadorId,
      veiculoId: process.env.E2E_VEICULO_ID || null,
      authUserId: process.env.E2E_MOTORISTA_AUTH_USER_ID || "",
      email,
      password,
      criadoAutomaticamente: false,
    };
  }

  console.warn(
    "[E2E] Fixture fixa incompleta — provisionando motorista mock via SERVICE ROLE.",
  );
  return provisionarMotoristaMock();
}

export async function provisionarMotoristaMock(): Promise<FixtureMotorista> {
  const admin = criarClienteAdmin();
  const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `e2e.motorista.${run}@conexaoexpress.test`;
  const password = `E2e#${run}Aa1`;
  const placa = `E2E${run.slice(0, 5).toUpperCase()}`;

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: `MOTORISTA E2E ${run}`, e2e: true },
  });
  if (userErr || !userData?.user) {
    throw new Error(`[E2E] Falha ao criar auth user mock: ${userErr?.message}`);
  }
  const authUserId = userData.user.id;

  const { data: prestador, error: presErr } = await admin
    .from("prestadores")
    .insert({
      nome_completo: `MOTORISTA E2E ${run}`,
      cpf_cnpj: String(10000000000 + Math.floor(Math.random() * 8_999_999_999)),
      status: "ativo",
      auth_user_id: authUserId,
      liberado_app: true,
      email,
      origem: "e2e_mock",
    })
    .select("id")
    .single();
  if (presErr || !prestador) {
    throw new Error(`[E2E] Falha ao criar prestador mock: ${presErr?.message}`);
  }
  const prestadorId = prestador.id as string;

  const { data: veiculo } = await admin
    .from("veiculos")
    .insert({
      placa,
      tipo: "VUC",
      tipo_veiculo: "VUC",
      prestador_vinculado: prestadorId,
      status: "disponivel",
    })
    .select("id")
    .single();
  const veiculoId = (veiculo?.id as string) || null;

  const { data: alocacao, error: alocErr } = await admin
    .from("alocacoes_escala")
    .insert({
      data_escala: new Date().toISOString().slice(0, 10),
      tipo_veiculo: "VUC",
      placa,
      prestador_id: prestadorId,
      status: "aguardando_aceite",
      origem: `CD ORIGEM E2E ${run}`,
      destino: `DESTINO E2E ${run}`,
      valor_frete: 1000,
      valor_repasse: 700,
      valor_pedagio: 50,
      valor_adicional: 30,
      valor_desconto: 80,
      tenant_id: TENANT_PADRAO,
      metadata: { origem_tms: true, e2e: true, run },
    })
    .select("id")
    .single();
  if (alocErr || !alocacao) {
    throw new Error(`[E2E] Falha ao criar alocação mock: ${alocErr?.message}`);
  }

  return {
    alocacaoId: alocacao.id as string,
    prestadorId,
    veiculoId,
    authUserId,
    email,
    password,
    criadoAutomaticamente: true,
  };
}

/** Remove tudo que a fixture mock criou (best-effort, ordem reversa). */
export async function limparFixtureMotorista(fixture: FixtureMotorista): Promise<void> {
  if (!fixture.criadoAutomaticamente) return;
  const admin = criarClienteAdmin();
  const osId = fixture.alocacaoId; // M66 cria OS/financeiro com id = alocação (sem OS vinculada)

  const tentar = async (tabela: string, coluna: string, valor: string) => {
    const { error } = await admin.from(tabela).delete().eq(coluna, valor);
    if (error) console.warn(`[E2E] cleanup ${tabela}.${coluna}: ${error.message}`);
  };

  await tentar("eventos_oficiais", "entity_id", fixture.alocacaoId);
  await tentar("operation_timeline_events", "operation_id", fixture.alocacaoId);
  await tentar("composicao_financeira_os", "os_id", osId);
  await tentar("financeiro_receber", "os_id", osId);
  await tentar("financeiro_pagar", "os_id", osId);
  await tentar("pagamentos_prestadores", "os_id", osId);
  await tentar("ordens_servico", "id", osId);
  await tentar("alocacoes_escala", "id", fixture.alocacaoId);
  if (fixture.veiculoId) await tentar("veiculos", "id", fixture.veiculoId);
  await tentar("prestadores", "id", fixture.prestadorId);
  if (fixture.authUserId) {
    const { error } = await admin.auth.admin.deleteUser(fixture.authUserId);
    if (error) console.warn(`[E2E] cleanup auth user: ${error.message}`);
  }
  console.log(`[E2E] Fixture mock removida (alocacao=${fixture.alocacaoId}).`);
}

// ---------------------------------------------------------------------------
// Asserções de idempotência / estado
// ---------------------------------------------------------------------------
export interface EstadoMotorista {
  status: string | null;
  finalizada: boolean | null;
  etapaAtual: string | null;
  ultimaIdempotency: string | null;
  podRegistrado: boolean;
  metadata: Record<string, unknown>;
}

export async function obterEstadoMotorista(
  admin: SupabaseClient,
  alocacaoId: string,
): Promise<EstadoMotorista | null> {
  const { data, error } = await admin
    .from("alocacoes_escala")
    .select("status, finalizada, metadata")
    .eq("id", alocacaoId)
    .maybeSingle();
  if (error || !data) return null;
  const metadata = (data.metadata as Record<string, unknown>) || {};
  const app = (metadata.app_motorista as Record<string, unknown>) || {};
  return {
    status: (data.status as string) ?? null,
    finalizada: (data.finalizada as boolean) ?? null,
    etapaAtual: (app.etapa_atual as string) ?? null,
    ultimaIdempotency: (app.ultima_idempotency as string) ?? null,
    podRegistrado: app.pod_registrado === true,
    metadata,
  };
}

/** Eventos em `eventos_oficiais` cujo payload carrega a idempotency_key. */
export async function eventosPorIdempotencyKey(
  admin: SupabaseClient,
  alocacaoId: string,
  idempotencyKey: string,
): Promise<Array<{ id: string; event_type: string; payload: Record<string, unknown> }>> {
  const { data, error } = await admin
    .from("eventos_oficiais")
    .select("id, event_type, payload")
    .eq("entity_id", alocacaoId);
  if (error) throw new Error(`[E2E] eventos_oficiais: ${error.message}`);
  return (data || [])
    .map((r) => ({
      id: r.id as string,
      event_type: r.event_type as string,
      payload: (r.payload as Record<string, unknown>) || {},
    }))
    .filter((r) => r.payload?.idempotency_key === idempotencyKey);
}

/** Eventos de timeline de uma etapa (operation_timeline_events.type). */
export async function timelinePorEtapa(
  admin: SupabaseClient,
  alocacaoId: string,
  etapa: string,
): Promise<Array<{ id: string; type: string }>> {
  const tipo = ETAPA_PARA_EVENTO[etapa] || etapa;
  const { data, error } = await admin
    .from("operation_timeline_events")
    .select("id, type")
    .eq("operation_id", alocacaoId)
    .eq("type", tipo);
  if (error) throw new Error(`[E2E] operation_timeline_events: ${error.message}`);
  return (data || []) as Array<{ id: string; type: string }>;
}

// ---------------------------------------------------------------------------
// Preflight de volatilidade da RPC (anomalia A01)
// ---------------------------------------------------------------------------
/**
 * Lê `pg_proc.provolatile` da RPC via conexão direta (pg + DATABASE_URL).
 * Retorna 'v' (VOLATILE), 's' (STABLE), 'i' (IMMUTABLE) ou null se indisponível.
 *
 * A01: se a função estiver 's'/'i', qualquer INSERT/UPDATE interno lança
 * "is not allowed in a non-volatile function". Fix pronto e NÃO aplicado:
 * supabase/migrations/20260722000003_m133d4_fix_rpc_app_security.sql
 */
export async function verificarVolatilidadeRpc(
  nome = "f_avancar_etapa_app_motorista",
): Promise<string | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  try {
    const pg: any = await import("pg");
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
      const r = await client.query(
        `SELECT p.provolatile FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname = $1`,
        [nome],
      );
      return (r.rows[0]?.provolatile as string) ?? null;
    } finally {
      await client.end();
    }
  } catch (e: any) {
    console.warn(`[E2E] Não foi possível verificar volatilidade da RPC: ${e?.message}`);
    return null;
  }
}
