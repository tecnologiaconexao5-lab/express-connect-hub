/**
 * MISSÃO 124-B.2 — CORRECAO COMPLETA DO FINANCEIRO APÓS TROCA DE PRESTADOR
 * 
 * CAUSA REAL: O trigger f_trg_propagar_financeiro_alocacao tem ON CONFLICT DO UPDATE
 * que NÃO atualiza fornecedor_id/fornecedor_nome/prestador em financeiro_pagar e
 * prestador_id/prestador_nome em pagamentos_prestadores.
 * 
 * Solução: modificar a função do trigger para incluir esses campos no DO UPDATE.
 */
import pg from "pg";
import "dotenv/config";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL nao definida"); process.exit(1); }
const pool = new pg.Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
const q = async (t: string, p?: any[]) => { const c = await pool.connect(); try { return await c.query(t, p); } finally { c.release(); } };

const ALOC_ID = "1e9b311e-c701-4469-8f8e-ed99b9cd9a73";
const OS_ID = "405fe001-4947-44a6-8cd2-c0203a701cfd";
const PREST_CORRETO = "e6646799-fbac-453e-a3ef-afdfc01a7085";

let passed = 0, failed = 0;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label} — ${detail || "falhou"}`); failed++; }
}
function info(label: string, value: string) { console.log(`  📋 ${label}: ${value}`); }

(async () => {
  console.log("=".repeat(72));
  console.log("  MISSAO 124-B.2 — CORRECAO COMPLETA");
  console.log("=".repeat(72));

  // ── CAUSA RAIZ ──
  console.log("\n── CAUSA RAIZ CONFIRMADA ──");
  console.log("O trigger f_trg_propagar_financeiro_alocacao tem dois bugs:");
  console.log("1. prestador_id não está na lista UPDATE OF do trigger.");
  console.log("2. O ON CONFLICT DO UPDATE não atualiza os campos do prestador:");
  console.log("   - financeiro_pagar: falta fornecedor_id, fornecedor_nome, prestador");
  console.log("   - pagamentos_prestadores: falta prestador_id, prestador_nome");

  // ── FIX THE TRIGGER FUNCTION ──
  console.log("\n── CORRECAO: RECRIAR FUNCAO DO TRIGGER ──");

  // Get current function source
  const { rows: [fnSource] } = await q(`SELECT pg_get_functiondef(p.oid) as body FROM pg_proc p WHERE p.proname = 'f_trg_propagar_financeiro_alocacao'`);
  let body = fnSource.body;

  // Fix 1: ON CONFLICT DO UPDATE for financeiro_pagar
  // OLD: ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_prestador, status = ..., data_vencimento = v_data_venc_30;
  // NEW: add fornecedor_id, fornecedor_nome, prestador
  body = body.replace(
    /ON CONFLICT \(os_id\) DO UPDATE SET valor = v_valor_prestador, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar\.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30;/g,
    `ON CONFLICT (os_id) DO UPDATE SET valor = v_valor_prestador, status = CASE WHEN v_is_concluida THEN 'aberto' WHEN financeiro_pagar.status = 'aberto' THEN 'aberto' ELSE 'pendente' END, data_vencimento = v_data_venc_30, fornecedor_id = NEW.prestador_id, fornecedor_nome = v_prestador_nome, prestador = v_prestador_nome;`
  );
  
  // Fix 2: ON CONFLICT DO UPDATE for pagamentos_prestadores
  // OLD: ON CONFLICT (os_id) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = ...;
  // NEW: add prestador_id, prestador_nome, prestador_documento
  body = body.replace(
    /ON CONFLICT \(os_id\) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END;/g,
    `ON CONFLICT (os_id) DO UPDATE SET valor_liquido = v_valor_liquido, valor_servicos = v_valor_prestador, status_conferencia = CASE WHEN v_is_concluida THEN 'em_aberto' ELSE 'pendente' END, prestador_id = NEW.prestador_id, prestador_nome = v_prestador_nome, prestador_documento = COALESCE(v_prestador_doc, '');`
  );

  // Extract the function body (between first $function$ and last $function$)
  const startMarker = '$function$';
  const startIdx = body.indexOf(startMarker);
  const endIdx = body.lastIndexOf(startMarker);
  const fnBody = body.substring(startIdx + startMarker.length, endIdx);

  // Drop existing function and recreate
  try {
    await q(`DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON alocacoes_escala`);
    await q(`DROP FUNCTION IF EXISTS f_trg_propagar_financeiro_alocacao() CASCADE`);
    
    const newFn = `CREATE OR REPLACE FUNCTION public.f_trg_propagar_financeiro_alocacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
${fnBody}
$function$`;
    
    await q(newFn);
    console.log("  ✅ Funcao recriada com DO UPDATE corrigido");
  } catch (e: any) {
    console.log("  ❌ Erro ao recriar funcao:", e.message);
    process.exit(1);
  }

  // Recreate trigger with prestador_id in UPDATE OF list
  try {
    await q(`CREATE TRIGGER trg_propagar_financeiro_alocacao 
      AFTER INSERT OR UPDATE OF status, finalizada, valor_frete, valor_repasse, valor_pedagio, valor_combustivel, valor_ajudante, valor_adicional, valor_desconto, tipo_reversa, reversa_valor_cliente, reversa_valor_prestador, prestador_id 
      ON alocacoes_escala 
      FOR EACH ROW EXECUTE FUNCTION f_trg_propagar_financeiro_alocacao()`);
    console.log("  ✅ Trigger recriado");
  } catch (e: any) {
    console.log("  ❌ Erro ao recriar trigger:", e.message);
    process.exit(1);
  }

  // Verify fixes applied
  const { rows: [fixedFn] } = await q(`SELECT pg_get_functiondef(p.oid) as body FROM pg_proc p WHERE p.proname = 'f_trg_propagar_financeiro_alocacao'`);
  const newBody = fixedFn.body;
  const temFornId = newBody.includes('fornecedor_id = NEW.prestador_id');
  const temPrestId = newBody.includes('prestador_id = NEW.prestador_id');
  assert("Fix: financeiro_pagar DO UPDATE inclui fornecedor_id", temFornId);
  assert("Fix: pagamentos_prestadores DO UPDATE inclui prestador_id", temPrestId);

  // ── TRIGGER TOUCH-UPDATE TO REPAIR EXISTING DATA ──
  console.log("\n── REPARAR DADOS EXISTENTES ──");
  
  const { rows: [aloc] } = await q(
    `SELECT valor_frete, prestador_id FROM alocacoes_escala WHERE id = $1`, [ALOC_ID]
  );
  
  // Touch update to trigger the fix
  await q(`UPDATE alocacoes_escala SET valor_frete = $1 WHERE id = $2`, [aloc.valor_frete, ALOC_ID]);
  console.log("  ✅ Touch-update executado");
  await new Promise(r => setTimeout(r, 500));

  // ── VALIDACAO ──
  console.log("\n── VALIDACAO FINAL ──");

  const { rows: finPag } = await q(
    `SELECT fornecedor_id, fornecedor_nome, prestador, valor, status, data_vencimento FROM financeiro_pagar WHERE os_id = $1`, [OS_ID]
  );
  for (const p of finPag) {
    info("fornecedor_id", p.fornecedor_id);
    info("fornecedor_nome", p.fornecedor_nome);
    assert("financeiro_pagar.fornecedor_id = PRESTADOR TESTE APP", p.fornecedor_id === PREST_CORRETO);
    assert("financeiro_pagar.valor = 1200.00", p.valor === '1200.00');
    assert("financeiro_pagar.sem_duplicidade", finPag.length === 1);
  }

  const { rows: pagPrest } = await q(
    `SELECT prestador_id, prestador_nome, valor_servicos, valor_liquido, data_prevista_pagamento, status FROM pagamentos_prestadores WHERE os_id = $1`, [OS_ID]
  );
  for (const pp of pagPrest) {
    info("prestador_id", pp.prestador_id);
    info("prestador_nome", pp.prestador_nome);
    assert("pagamentos_prestadores.prestador_id = PRESTADOR TESTE APP", pp.prestador_id === PREST_CORRETO);
    assert("pagamentos_prestadores.valor_servicos = 1200.00", pp.valor_servicos === '1200.00');
    assert("pagamentos_prestadores.sem_duplicidade", pagPrest.length === 1);
    assert("pagamentos_prestadores.vencimento_preservado", !!pp.data_prevista_pagamento);
  }

  const { rows: finRec } = await q(
    `SELECT cliente_id, cliente_nome, valor FROM financeiro_receber WHERE os_id = $1`, [OS_ID]
  );
  info("financeiro_receber.cliente_id", finRec[0]?.cliente_id);
  assert("financeiro_receber.nao_alterado", finRec[0]?.cliente_id === '3525e99f-64dd-43d1-ba0a-7e7559638841');
  assert("financeiro_receber.sem_duplicidade", finRec.length === 1);

  const { rows: [alocFinal] } = await q(
    `SELECT prestador_id, status FROM alocacoes_escala WHERE id = $1`, [ALOC_ID]
  );
  assert("alocacao.prestador_correto", alocFinal.prestador_id === PREST_CORRETO);
  assert("alocacao.status_mantido", alocFinal.status === 'aguardando_aceite');

  // ── RELATÓRIO ──
  console.log("\n" + "=".repeat(72));
  console.log("  VEREDITO: " + (failed === 0 ? "PRONTO PARA ACEITE NO APP" : "CORRECAO PARCIAL"));
  console.log(`  ${passed}/${passed + failed} validações aprovadas`);
  console.log("=".repeat(72));

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
})();