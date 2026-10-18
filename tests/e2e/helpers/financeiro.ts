// ============================================================================
// helpers/financeiro.ts — E2E-02-FIN
// ----------------------------------------------------------------------------
// Utilitários de reconciliação financeira exata (sem perda de centavos) para a
// suíte E2E de integração. Lê as tabelas alimentadas pelos triggers de
// propagação financeira:
//   alocacoes_escala  -> M66 trg_propagar_financeiro_alocacao
//   ordens_servico    -> M80 trg_propagar_financeiro_os
// e valida:
//   financeiro_receber, financeiro_pagar, pagamentos_prestadores,
//   composicao_financeira_os
//
// Todas as comparações são feitas em CENTAVOS INTEIROS (Math.round(v*100))
// para eliminar erro de ponto flutuante.
//
// Cliente de dados (ordem de preferência):
//   1. SUPABASE_SERVICE_ROLE_KEY  (bypassa RLS — ideal p/ asserção de leitura)
//   2. login com usuário corporativo (PLAYWRIGHT_TAMIRIS_PASSWORD)
//   3. ANON (pode ser bloqueado por RLS — usado apenas como fallback)
// ============================================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uwrvzsjtpgaifkktpepn.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs";
const ADMIN_EMAIL = "tamiris.castilho@conexaoexpress.com.br";

/** Converte qualquer valor numérico para centavos inteiros (evita float drift). */
export function emCentavos(valor: number | string | null | undefined): number {
  const n = Number(valor ?? 0);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Formata centavos de volta para reais legíveis em mensagens de erro. */
export function formatarReais(valor: number | string | null | undefined): string {
  return `R$ ${(emCentavos(valor) / 100).toFixed(2)}`;
}

/**
 * Cria um cliente Supabase com o maior nível de acesso disponível no ambiente.
 * Nunca lança — se não houver credencial de escrita, retorna o cliente anon
 * (leituras podem ser restritas por RLS; o snapshot reporta o erro).
 */
export async function criarClienteDados(): Promise<SupabaseClient> {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRole) {
    return createClient(SUPABASE_URL, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const password = process.env.PLAYWRIGHT_TAMIRIS_PASSWORD;
  if (password) {
    const { error } = await client.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password,
    });
    if (error) {
      console.warn(
        `[FIN] Falha ao autenticar cliente de dados: ${error.message}. ` +
          `Leituras podem falhar por RLS.`,
      );
    }
  }
  return client;
}

// ---------------------------------------------------------------------------
// Tipos — apenas os campos usados nas asserções
// ---------------------------------------------------------------------------

export interface AlocacaoFinanceira {
  id: string;
  status: string;
  finalizada: boolean | null;
  ordem_servico_id: string | null;
  prestador_id: string | null;
  cliente_id: string | null;
  valor_frete: number | null;
  valor_repasse: number | null;
  valor_pedagio: number | null;
  valor_adicional: number | null;
  valor_desconto: number | null;
  placa: string | null;
}

export interface LinhaFinanceira {
  id: string;
  os_id: string | null;
  valor: number | null;
  status: string | null;
  [k: string]: unknown;
}

export interface LinhaPagamentoPrestador {
  id: string;
  os_id: string | null;
  prestador_id: string | null;
  valor_servicos: number | null;
  pedagio: number | null;
  adicionais: number | null;
  valor_liquido: number | null;
  [k: string]: unknown;
}

export interface LinhaComposicao {
  os_id: string | null;
  valor_cliente: number | null;
  valor_prestador: number | null;
  imposto_percentual: number | null;
  imposto_valor: number | null;
  seguro_valor: number | null;
  pedagio_valor: number | null;
  outros_custos: number | null;
  margem_bruta: number | null;
  margem_liquida: number | null;
  percentual_margem_bruta: number | null;
  percentual_margem_liquida: number | null;
  [k: string]: unknown;
}

export interface FinanceiroSnapshot {
  osId: string;
  receber: LinhaFinanceira[] | null;
  pagar: LinhaFinanceira[] | null;
  pagamentos: LinhaPagamentoPrestador[] | null;
  composicao: LinhaComposicao[] | null;
  erros: string[];
}

export interface Discrepancia {
  campo: string;
  esperado: number;
  obtido: number;
  diffCentavos: number;
  mensagem: string;
}

/** Resultado de uma reconciliação: lista vazia === tudo exato. */
export type ResultadoReconciliacao = Discrepancia[];

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function buscarAlocacaoPorId(
  alocacaoId: string,
  client?: SupabaseClient,
): Promise<AlocacaoFinanceira | null> {
  const c = client || (await criarClienteDados());
  const { data, error } = await c
    .from("alocacoes_escala")
    .select(
      "id, status, finalizada, ordem_servico_id, prestador_id, cliente_id, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_desconto, placa",
    )
    .eq("id", alocacaoId)
    .maybeSingle();
  if (error) {
    console.error(`[FIN] Erro ao buscar alocação ${alocacaoId}: ${error.message}`);
    return null;
  }
  return (data as unknown as AlocacaoFinanceira) || null;
}

export async function buscarAlocacaoPorDestino(
  destino: string,
  client?: SupabaseClient,
): Promise<AlocacaoFinanceira | null> {
  const c = client || (await criarClienteDados());
  const { data, error } = await c
    .from("alocacoes_escala")
    .select(
      "id, status, finalizada, ordem_servico_id, prestador_id, cliente_id, valor_frete, valor_repasse, valor_pedagio, valor_adicional, valor_desconto, placa",
    )
    .eq("destino", destino)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`[FIN] Erro ao buscar alocação por destino: ${error.message}`);
    return null;
  }
  return (data as unknown as AlocacaoFinanceira) || null;
}

/**
 * Coleta todas as linhas financeiras de um os_id (chave de propagação).
 * Retorna arrays (não single) para permitir a checagem anti-duplicidade.
 */
export async function capturarSnapshotFinanceiro(
  osId: string,
  client?: SupabaseClient,
): Promise<FinanceiroSnapshot> {
  const c = client || (await criarClienteDados());
  const erros: string[] = [];

  async function ler<T>(tabela: string, campos: string): Promise<T[] | null> {
    const { data, error } = await c
      .from(tabela)
      .select(campos)
      .eq("os_id", osId);
    if (error) {
      erros.push(`${tabela}: ${error.message}`);
      return null;
    }
    return (data as unknown as T[]) || [];
  }

  const [receber, pagar, pagamentos, composicao] = await Promise.all([
    ler<LinhaFinanceira>(
      "financeiro_receber",
      "id, os_id, valor, status, cliente, cliente_id",
    ),
    ler<LinhaFinanceira>(
      "financeiro_pagar",
      "id, os_id, valor, status, prestador, fornecedor_id, fornecedor_nome",
    ),
    ler<LinhaPagamentoPrestador>(
      "pagamentos_prestadores",
      "id, os_id, prestador_id, valor_servicos, pedagio, adicionais, valor_liquido",
    ),
    ler<LinhaComposicao>(
      "composicao_financeira_os",
      "os_id, valor_cliente, valor_prestador, imposto_percentual, imposto_valor, seguro_valor, pedagio_valor, outros_custos, margem_bruta, margem_liquida, percentual_margem_bruta, percentual_margem_liquida",
    ),
  ]);

  return { osId, receber, pagar, pagamentos, composicao, erros };
}

// ---------------------------------------------------------------------------
// Cálculo do esperado (fórmulas dos triggers M66/M80)
// ---------------------------------------------------------------------------

export interface EsperadoFinanceiro {
  valorCliente: number;
  valorRepasse: number;
  valorPedagio: number;
  valorAdicional: number;
  valorDesconto: number;
  valorLiquidoPrestador: number;
  impostoPercentual: number;
  impostoValor: number;
  seguroValor: number;
  margemBruta: number;
  margemLiquida: number;
  percentualMargemBruta: number;
  percentualMargemLiquida: number;
}

/** Arredonda para 2 casas como o ROUND(...,2) do Postgres. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularEsperado(aloc: AlocacaoFinanceira): EsperadoFinanceiro {
  const valorCliente = Number(aloc.valor_frete ?? 0);
  const valorRepasse = Number(aloc.valor_repasse ?? 0);
  const valorPedagio = Number(aloc.valor_pedagio ?? 0);
  const valorAdicional = Number(aloc.valor_adicional ?? 0);
  const valorDesconto = Number(aloc.valor_desconto ?? 0);

  const valorLiquidoPrestador =
    valorRepasse + valorPedagio + valorAdicional - valorDesconto;

  // M66: imposto fixo 4.5%, seguro fixo 1%
  const impostoValor = round2((valorCliente * 4.5) / 100);
  const seguroValor = round2((valorCliente * 1) / 100);
  const margemBruta =
    valorCliente - valorRepasse - valorPedagio - valorAdicional;
  const margemLiquida = margemBruta - impostoValor - seguroValor;

  return {
    valorCliente,
    valorRepasse,
    valorPedagio,
    valorAdicional,
    valorDesconto,
    valorLiquidoPrestador,
    impostoPercentual: 4.5,
    impostoValor,
    seguroValor,
    margemBruta,
    margemLiquida,
    percentualMargemBruta:
      valorCliente > 0 ? round2((margemBruta / valorCliente) * 100) : 0,
    percentualMargemLiquida:
      valorCliente > 0 ? round2((margemLiquida / valorCliente) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Reconciliação
// ---------------------------------------------------------------------------

function comparar(
  campo: string,
  esperado: number,
  obtido: number,
  acumular: Discrepancia[],
): void {
  const e = emCentavos(esperado);
  const o = emCentavos(obtido);
  if (e !== o) {
    acumular.push({
      campo,
      esperado: e / 100,
      obtido: o / 100,
      diffCentavos: o - e,
      mensagem: `${campo}: esperado ${formatarReais(esperado)}, obtido ${formatarReais(
        obtido,
      )} (diferença ${((o - e) / 100).toFixed(2)})`,
    });
  }
}

/**
 * Reconcilia o snapshot contra o esperado.
 * @param incluirComposicao  true quando a alocação já está finalizada (M66 só
 *                           cria composicao_financeira_os na conclusão).
 */
export function reconciliar(
  snap: FinanceiroSnapshot,
  esperado: EsperadoFinanceiro,
  incluirComposicao: boolean,
): ResultadoReconciliacao {
  const out: Discrepancia[] = [];

  // --- Anti-duplicidade (M80 UNIQUE financeiro_pagar + idempotência M66) ---
  const tabelas: Array<[string, unknown[] | null]> = [
    ["financeiro_receber", snap.receber],
    ["financeiro_pagar", snap.pagar],
    ["pagamentos_prestadores", snap.pagamentos],
    ["composicao_financeira_os", snap.composicao],
  ];
  for (const [nome, linhas] of tabelas) {
    if (linhas === null) continue; // erro de leitura já reportado em snap.erros
    const esperadoQtd = incluirComposicao || nome !== "composicao_financeira_os" ? 1 : 0;
    if (linhas.length !== esperadoQtd) {
      out.push({
        campo: `${nome}.quantidade`,
        esperado: esperadoQtd,
        obtido: linhas.length,
        diffCentavos: 0,
        mensagem: `${nome}: esperado ${esperadoQtd} linha(s), obtido ${linhas.length} (duplicidade/faltante)`,
      });
    }
  }

  // --- financeiro_receber (faturamento cliente) ---
  const receber = snap.receber?.[0];
  if (receber && esperado.valorCliente > 0) {
    comparar("financeiro_receber.valor", esperado.valorCliente, receber.valor ?? 0, out);
  }

  // --- financeiro_pagar (repasse ao prestador) ---
  const pagar = snap.pagar?.[0];
  if (pagar && esperado.valorRepasse > 0) {
    comparar("financeiro_pagar.valor", esperado.valorRepasse, pagar.valor ?? 0, out);
  }

  // --- pagamentos_prestadores (provisão de pagamento) ---
  const pgto = snap.pagamentos?.[0];
  if (pgto) {
    comparar("pagamentos_prestadores.valor_servicos", esperado.valorRepasse, pgto.valor_servicos ?? 0, out);
    comparar("pagamentos_prestadores.pedagio", esperado.valorPedagio, pgto.pedagio ?? 0, out);
    comparar("pagamentos_prestadores.adicionais", esperado.valorAdicional, pgto.adicionais ?? 0, out);
    comparar("pagamentos_prestadores.valor_liquido", esperado.valorLiquidoPrestador, pgto.valor_liquido ?? 0, out);
  }

  // --- composicao_financeira_os (margem/reconciliação, só na conclusão) ---
  if (incluirComposicao && esperado.valorCliente > 0) {
    const comp = snap.composicao?.[0];
    if (!comp) {
      out.push({
        campo: "composicao_financeira_os",
        esperado: 1,
        obtido: 0,
        diffCentavos: 0,
        mensagem: "composicao_financeira_os ausente após finalização (M66 não disparou?)",
      });
    } else {
      comparar("composicao.valor_cliente", esperado.valorCliente, comp.valor_cliente ?? 0, out);
      comparar("composicao.valor_prestador", esperado.valorRepasse, comp.valor_prestador ?? 0, out);
      comparar("composicao.imposto_percentual", esperado.impostoPercentual, comp.imposto_percentual ?? 0, out);
      comparar("composicao.imposto_valor", esperado.impostoValor, comp.imposto_valor ?? 0, out);
      comparar("composicao.seguro_valor", esperado.seguroValor, comp.seguro_valor ?? 0, out);
      comparar("composicao.pedagio_valor", esperado.valorPedagio, comp.pedagio_valor ?? 0, out);
      comparar("composicao.outros_custos", esperado.valorAdicional, comp.outros_custos ?? 0, out);
      comparar("composicao.margem_bruta", esperado.margemBruta, comp.margem_bruta ?? 0, out);
      comparar("composicao.margem_liquida", esperado.margemLiquida, comp.margem_liquida ?? 0, out);
      comparar("composicao.percentual_margem_bruta", esperado.percentualMargemBruta, comp.percentual_margem_bruta ?? 0, out);
      comparar("composicao.percentual_margem_liquida", esperado.percentualMargemLiquida, comp.percentual_margem_liquida ?? 0, out);
    }
  }

  return out;
}
