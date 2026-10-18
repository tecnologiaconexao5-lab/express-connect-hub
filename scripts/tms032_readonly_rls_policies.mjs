/**
 * TMS-032 — AUDITORIA READ-ONLY de RLS do App Prestador (somente SELECT)
 * Executa consultas exclusivamente de leitura contra Produção.
 * Não altera nada. Não imprime segredos.
 *
 * Uso: node scripts/tms032_readonly_rls_policies.mjs
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL nao definida'); process.exit(1); }

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TABELAS = [
  'alocacoes_escala',
  'historico_alocacoes_escala',
  'ordens_servico',
  'prestadores',
  'veiculos',
  'portal_tracking_realtime',
  'entregas_protocolo',
  'delivery_proofs',
  'ocorrencias',
  'portal_ocorrencias',
  'operacao_localizacao',
  'portal_notificacoes',
  'eventos_oficiais',
  'operation_timeline_events',
  'os_historico',
  'rede_oportunidades',
  'rotas',
  'rota_paradas',
  'clientes',
];

async function main() {
  await client.connect();
  console.log('=== TMS-032 AUDITORIA READ-ONLY RLS ===');
  console.log('Banco: producao (somente leitura)\n');

  // 1. Policies por tabela
  const qPolicies = `
    SELECT p.tablename AS tabela, p.policyname, p.cmd, p.roles::text AS roles,
           left(p.qual::text, 200) AS qual, left(p.with_check::text, 200) AS wc
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = ANY($1)
    ORDER BY p.tablename, p.policyname`;
  const { rows: policies } = await client.query(qPolicies, [TABELAS]);

  console.log('1. POLICIES ATIVAS (por tabela)\n');
  const byTable = {};
  for (const p of policies) {
    if (!byTable[p.tabela]) byTable[p.tabela] = [];
    byTable[p.tabela].push(p);
  }
  for (const t of Object.keys(byTable).sort()) {
    console.log('--- ' + t + ' ---');
    for (const p of byTable[t]) {
      console.log(`  [${p.cmd}] ${p.policyname} roles=${p.roles}`);
      if (p.qual) console.log(`      USING: ${p.qual}`);
      if (p.wc) console.log(`      CHECK: ${p.wc}`);
    }
    console.log('');
  }

  // 2. RLS enabled + grants por tabela
  console.log('2. RLS ENABLED + GRANTS (anon/authenticated)\n');
  for (const t of TABELAS) {
    const qRls = "SELECT relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1";
    const { rows: rls } = await client.query(qRls, [t]);
    const qGrants = `SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema='public' AND table_name=$1 AND grantee IN ('anon','authenticated','service_role') ORDER BY grantee`;
    const { rows: grants } = await client.query(qGrants, [t]);
    const rlsState = rls.length ? `rls=${rls[0].relrowsecurity ? 'ON' : 'OFF'} force=${rls[0].relforcerowsecurity ? 'ON' : 'OFF'}` : 'NAO-EXISTE';
    const grantStr = grants.length ? grants.map(g => `${g.grantee}:${g.privilege_type}`).join(', ') : '(nenhum anon/auth/sr)';
    console.log(`  ${t} | ${rlsState} | ${grantStr}`);
  }
  console.log('');

  // 3. Funcoes de trigger relevantes — SECURITY
  console.log('3. FUNCOES DE TRIGGER (SECURITY DEFINER/INVOKER)\n');
  const qFuncs = `
    SELECT p.proname, p.prosecdef AS security_definer, p.prosecdef IS NULL AS is_invoker,
           left(pg_get_functiondef(p.oid), 120) AS def_head
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'registrar_historico_alocacao','f_sync_delivery_proof_to_entregas',
      'f_trg_propagar_financeiro_alocacao','f_trg_cancelar_financeiro_alocacao',
      'trg_evento_prestador_aceitou','trg_evento_operacao_finalizada',
      'update_alocacoes_escala_updated_at'
    ) ORDER BY p.proname`;
  const { rows: funcs } = await client.query(qFuncs);
  for (const f of funcs) {
    console.log(`  ${f.proname} | security_definer=${f.security_definer}`);
    if (f.def_head) console.log(`    ${f.def_head}...`);
  }
  console.log('');

  // 4. Triggers nas tabelas do fluxo
  console.log('4. TRIGGERS (alocacoes_escala, delivery_proofs, entregas_protocolo, ordens_servico)\n');
  const qTrig = `
    SELECT tgrelid::regclass::text AS tabela, tgname, tgenabled,
           left(pg_get_triggerdef(oid), 250) AS def
    FROM pg_trigger
    WHERE NOT tgisinternal AND tgrelid::regclass::text IN (
      'alocacoes_escala','delivery_proofs','entregas_protocolo','ordens_servico'
    ) ORDER BY tgrelid::regclass::text, tgname`;
  const { rows: trigs } = await client.query(qTrig);
  for (const t of trigs) {
    console.log(`  ${t.tabela} | ${t.tgname} | enabled=${t.tgenabled}`);
    console.log(`    ${t.def}`);
  }
  console.log('');

  // 5. RPCs do App — existência + SECURITY DEFINER + grants
  console.log('5. RPCs DO APP (existencia + SECURITY DEFINER)\n');
  const qRpc = `
    SELECT p.proname, p.prosecdef AS security_definer, p.provolatile,
           pg_get_function_identity_arguments(p.oid) AS args,
           (SELECT string_agg(grantee::text, ', ') FROM information_schema.routine_privileges rp
             WHERE rp.routine_name=p.proname AND rp.routine_schema='public') AS grantees
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'f_aceitar_oportunidade_rede','f_buscar_operacoes_motorista',
      'f_avancar_etapa_app_motorista','f_atualizar_reversa_app',
      'registrar_posicao_motorista','f_atualizar_status_parada',
      'f_registrar_notificacao_app','f_calcular_financeiro_operacao'
    ) ORDER BY p.proname`;
  const { rows: rpcs } = await client.query(qRpc);
  for (const r of rpcs) {
    console.log(`  ${r.proname}(${r.args})`);
    console.log(`     secdef=${r.security_definer} volatile=${r.provolatile} grants=${r.grantees || '?'}`);
  }
  console.log('');

  // 6. Coluna tenant_id em historico_alocacoes_escala
  console.log('6. SCHEMA historico_alocacoes_escala (existe tenant_id?)\n');
  const qCols = `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='historico_alocacoes_escala'
    ORDER BY ordinal_position`;
  const { rows: cols } = await client.query(qCols);
  console.log('  colunas: ' + (cols.length ? cols.map(c => c.column_name).join(', ') : '(tabela nao existe)'));
  const hasTenant = cols.some(c => c.column_name === 'tenant_id');
  console.log('  tenant_id presente: ' + hasTenant);

  await client.end();
  console.log('\n=== FIM AUDITORIA READ-ONLY (sem alteracoes) ===');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
