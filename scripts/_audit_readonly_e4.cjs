// AUDITORIA READ-ONLY — evidências de produção (Eixo 2/4). NÃO executa DML.
const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const log = [];
  const p = (s) => { console.log(s); log.push(s); };

  // 1. f_aceitar_oportunidade_rede — corpo vivo (auth.uid? gates?)
  const def = await client.query(`SELECT pg_get_functiondef(p.oid) d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='f_aceitar_oportunidade_rede'`);
  if (def.rows.length) {
    const d = def.rows[0].d;
    p(`[1] f_aceitar_oportunidade_rede len=${d.length} auth.uid=${d.includes('auth.uid')} SEM_PERMISSAO=${d.includes('SEM_PERMISSAO_ACEITE')} PRESTADOR_INVALIDO=${d.includes('PRESTADOR_INVALIDO')} liberado_app=${d.includes('liberado_app')} GATE=${/GATE\s*\d/i.test(d)} etapa_atual=${d.includes('etapa_atual')}`);
  } else p('[1] f_aceitar_oportunidade_rede NOT FOUND');

  // 2. grants da função
  const g = await client.query(`
    SELECT p.proname, (aclexplode(p.proacl)).grantee::regrole::text AS grantee, (aclexplode(p.proacl)).privilege_type AS priv
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_aceitar_oportunidade_rede','f_avancar_etapa_app_motorista','f_buscar_operacoes_motorista')`);
  for (const r of g.rows) p(`[2] ${r.proname} -> ${r.grantee}: ${r.priv}`);

  // 3. trigger M66 viva — fórmula financeiro_pagar (fin_sane_02b aplicado?)
  const m66 = await client.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_trg_propagar_financeiro_alocacao'`);
  if (m66.rows.length) {
    const d = m66.rows[0].d;
    p(`[3] M66 live len=${d.length} sane02b_valor_liquido=${d.includes('v_valor_prestador + v_pedagio_valor + v_outros_custos')} m104a_outros=${d.includes('v_outros_custos := v_adicional_valor + v_ajudante_valor - v_desconto_valor')}`);
    const i = d.indexOf('INSERT INTO financeiro_pagar');
    if (i >= 0) p('[3] INSERT financeiro_pagar live: ' + d.substring(i, i + 700).replace(/\n/g, ' | '));
  } else p('[3] M66 NOT FOUND');

  // 4. M80 trigger (ordens_servico) — financeiro_pagar valor
  const m80 = await client.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_trg_propagar_financeiro_os'`);
  if (m80.rows.length) {
    const d = m80.rows[0].d;
    p(`[4] M80 live len=${d.length}`);
    const j = d.indexOf('v_valor_liquido :=');
    if (j >= 0) p('[4] v_valor_liquido formula: ' + d.substring(j, j + 300).replace(/\n/g, ' | '));
    const i = d.indexOf('INSERT INTO financeiro_pagar');
    if (i >= 0) p('[4] INSERT financeiro_pagar live: ' + d.substring(i, i + 700).replace(/\n/g, ' | '));
  } else p('[4] M80 f_trg_propagar_financeiro_os NOT FOUND');

  // 5. CHECK constraints financeiras
  const ck = await client.query(`
    SELECT conrelid::regclass::text tabela, conname, pg_get_constraintdef(oid) def
    FROM pg_constraint WHERE contype='c' AND conname IN ('ck_fp_status','ck_fr_status')`);
  p(`[5] CHECKs: ${ck.rows.map(r => `${r.tabela}.${r.conname} ${r.def.includes('NOT VALID') ? 'NOT_VALID' : 'VALID'}`).join(' ; ') || 'NENHUM'}`);

  // 6. RLS policies permissivas em tabelas core
  const pol = await client.query(`
    SELECT tablename, policyname, roles::text AS roles, cmd FROM pg_policies
    WHERE schemaname='public' AND tablename IN ('alocacoes_escala','ordens_servico','clientes')
      AND (qual LIKE '% USING (true)%' OR roles::text LIKE '%anon%')
    ORDER BY tablename, policyname`);
  p(`[6] policies anon/permissive: ${pol.rows.length ? '' : 'NENHUMA (anon bloqueado)'}`);
  for (const r of pol.rows) p(`    ${r.tablename} :: ${r.policyname} roles=${r.roles} cmd=${r.cmd}`);

  // 7. financeiro_pagar — status reais (roundtrip UI)
  const st = await client.query(`SELECT status, count(*) n, count(*) FILTER (WHERE os_id IS NOT NULL) com_os FROM financeiro_pagar GROUP BY status ORDER BY n DESC`);
  p(`[7] financeiro_pagar status: ${st.rows.map(r => `${r.status}=${r.n}(os:${r.com_os})`).join(', ')}`);

  // 8. pagamentos_prestadores — os_numero NULL (rede) + status
  const pp = await client.query(`SELECT count(*) total, count(*) FILTER (WHERE os_numero IS NULL) sem_osnumero, count(*) FILTER (WHERE status_pagamento='pendente') pend FROM pagamentos_prestadores`);
  p(`[8] pagamentos_prestadores: total=${pp.rows[0].total} os_numero_NULL=${pp.rows[0].sem_osnumero} pendentes=${pp.rows[0].pend}`);

  // 9. composicao_financeira_os — integridade margens
  const cf = await client.query(`SELECT count(*) total, count(*) FILTER (WHERE margem_bruta IS NULL) mb_null, count(*) FILTER (WHERE outros_custos IS DISTINCT FROM COALESCE(adicional_valor,0)+COALESCE(ajudante_valor,0)-COALESCE(desconto_valor,0)) divergente_outros FROM composicao_financeira_os`);
  p(`[9] composicao_financeira_os: total=${cf.rows[0].total} mb_null=${cf.rows[0].mb_null} outros_custos_divergente=${cf.rows[0].divergente_outros}`);

  // 10. triggers de OS/Escala
  const tr = await client.query(`
    SELECT t.tgname, c.relname, pg_get_triggerdef(t.oid) d FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE NOT t.tgisinternal AND c.relname IN ('ordens_servico','alocacoes_escala')`);
  p(`[10] triggers: ${tr.rows.map(r => r.relname + ':' + r.tgname).join(', ') || 'NENHUM'}`);
  p(`[10] com "status" no corpo: ${tr.rows.filter(r => /status/i.test(r.d)).map(r => r.tgname).join(', ') || 'NENHUM'}`);

  // 11. cadastro prestadores/veiculos
  const cad = await client.query(`
    SELECT (SELECT count(*) FROM prestadores) prestadores,
           (SELECT count(*) FROM prestadores WHERE status='ativo') prest_ativos,
           (SELECT count(*) FROM prestadores WHERE liberado_app IS TRUE) liberados,
           (SELECT count(*) FROM prestadores WHERE cpf_cnpj IS NULL OR cpf_cnpj='') sem_doc,
           (SELECT count(*) FROM veiculos) veiculos,
           (SELECT count(*) FROM veiculos WHERE placa IS NULL OR placa='') sem_placa`);
  p(`[11] cadastro: ${JSON.stringify(cad.rows[0])}`);

  // 12. volatility RPCs
  const vol = await client.query(`
    SELECT p.proname, p.provolatile FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_avancar_etapa_app_motorista','f_buscar_operacoes_motorista','f_atualizar_reversa_app','f_registrar_baixa_financeira','f_aprovar_pagamento_prestadores')`);
  p(`[12] volatility: ${vol.rows.map(r => `${r.proname}=${r.provolatile}`).join(', ')}`);

  // 13. migrações aplicadas? (se houver schema_migrations)
  try {
    const mg = await client.query(`SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 6`);
    p(`[13] últimas migrations aplicadas: ${mg.rows.map(r => r.version).join(', ')}`);
  } catch (e) {
    try {
      const mg = await client.query(`SELECT name FROM _supabase_migrations.migrations ORDER BY name DESC LIMIT 6`);
      p(`[13] últimas migrations: ${mg.rows.map(r => r.name).join(', ')}`);
    } catch (e2) { p(`[13] controle de migrations indisponível: ${e2.message}`); }
  }

  // 14. locale/encoding + horário (contexto time-bomb)
  const dt = await client.query(`SELECT now()::text agora, current_setting('TimeZone') tz`);
  p(`[14] db now=${dt.rows[0].agora} tz=${dt.rows[0].tz}`);

  await client.end();
  require('fs').writeFileSync('scripts/_audit_readonly_e4.out.txt', log.join('\n'), 'utf8');
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
