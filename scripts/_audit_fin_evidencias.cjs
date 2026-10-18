const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

(async () => {
  await client.connect();

  // 1. Definições dos triggers de propagação financeira
  console.log('=== 1. f_trg_propagar_financeiro_alocacao (M66) ===');
  const r1 = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_trg_propagar_financeiro_alocacao'`);
  console.log(r1.rows[0] ? r1.rows[0].def.slice(0, 3500) : 'NÃO EXISTE');

  console.log('\n=== 2. f_trg_propagar_financeiro_os (M80) ===');
  const r2 = await client.query(`
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_trg_propagar_financeiro_os'`);
  console.log(r2.rows[0] ? r2.rows[0].def.slice(0, 3500) : 'NÃO EXISTE');

  // 2. Contagens das tabelas financeiras
  console.log('\n=== 3. CONTAGENS DE REGISTROS ===');
  for (const t of ['alocacoes_escala','ordens_servico','financeiro_receber','financeiro_pagar','pagamentos_prestadores','pagamentos_prestadores_itens','composicao_financeira','composicao_financeira_os','tabelas_valores','tabela_prestador','entregas_protocolo','delivery_proofs','os_pod','fiscal_ctes','fiscal_nfse','fiscal_mdfes','fiscal_documentos_vinculados','reembolsos_prestador','despesas_operacionais','portal_faturas','escala_operacional','prestador_os','prestadores','clientes','veiculos','operacoes','rotas','rota_paradas']) {
    const c = await client.query(`SELECT count(*)::int AS n FROM public.${t}`);
    console.log(`  ${t}: ${c.rows[0].n}`);
  }

  // 3. Distribuição de status reais
  console.log('\n=== 4. DISTRIBUIÇÃO DE STATUS ===');
  const st1 = await client.query(`SELECT status, count(*)::int AS n FROM alocacoes_escala GROUP BY status ORDER BY n DESC`);
  console.log('  alocacoes_escala.status:', st1.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st2 = await client.query(`SELECT status, count(*)::int AS n FROM ordens_servico GROUP BY status ORDER BY n DESC`);
  console.log('  ordens_servico.status:', st2.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st3 = await client.query(`SELECT status, count(*)::int AS n FROM financeiro_receber GROUP BY status ORDER BY n DESC`);
  console.log('  financeiro_receber.status:', st3.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st4 = await client.query(`SELECT status, count(*)::int AS n FROM financeiro_pagar GROUP BY status ORDER BY n DESC`);
  console.log('  financeiro_pagar.status:', st4.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st5 = await client.query(`SELECT status, count(*)::int AS n FROM pagamentos_prestadores GROUP BY status ORDER BY n DESC`);
  console.log('  pagamentos_prestadores.status:', st5.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st6 = await client.query(`SELECT status_pagamento, status_conferencia, status_aprovacao, count(*)::int AS n FROM pagamentos_prestadores GROUP BY 1,2,3 ORDER BY n DESC LIMIT 8`);
  console.log('  pagamentos_prestadores (status_pagamento/conf/apr):', st6.rows.map(r=>`${r.status_pagamento}/${r.status_conferencia}/${r.status_aprovacao}=${r.n}`).join(', '));
  const st7 = await client.query(`SELECT status, count(*)::int AS n FROM entregas_protocolo GROUP BY status ORDER BY n DESC`);
  console.log('  entregas_protocolo.status:', st7.rows.map(r=>`${r.status}=${r.n}`).join(', '));
  const st8 = await client.query(`SELECT faturamento_status, count(*)::int AS n FROM ordens_servico GROUP BY faturamento_status ORDER BY n DESC`);
  console.log('  ordens_servico.faturamento_status:', st8.rows.map(r=>`${r.faturamento_status}=${r.n}`).join(', '));
  const st9 = await client.query(`SELECT repasse_status, count(*)::int AS n FROM ordens_servico GROUP BY repasse_status ORDER BY n DESC`);
  console.log('  ordens_servico.repasse_status:', st9.rows.map(r=>`${r.repasse_status}=${r.n}`).join(', '));

  // 4. Dados de romaneio e OC
  console.log('\n=== 5. ROMANEIO / OC ===');
  const rom = await client.query(`SELECT count(*)::int AS total, count(romaneio)::int AS com_romaneio FROM ordens_servico`);
  console.log('  ordens_servico.romaneio:', JSON.stringify(rom.rows[0]));
  const oc = await client.query(`SELECT count(*)::int AS total, count(ordem_carregamento_id)::int AS com_oc FROM alocacoes_escala`);
  console.log('  alocacoes_escala.ordem_carregamento_id:', JSON.stringify(oc.rows[0]));
  const ocMeta = await client.query(`SELECT count(*)::int AS n FROM alocacoes_escala WHERE metadata->>'numeroOC' IS NOT NULL AND metadata->>'numeroOC' <> ''`);
  console.log('  alocacoes com metadata.numeroOC:', ocMeta.rows[0].n);
  const osFatura = await client.query(`SELECT status_faturamento, count(*)::int AS n FROM ordens_servico GROUP BY status_faturamento`);
  console.log('  ordens_servico.status_faturamento:', osFatura.rows.map(r=>`${r.status_faturamento}=${r.n}`).join(', '));

  // 5. storage buckets
  console.log('\n=== 6. STORAGE BUCKETS ===');
  const b = await client.query(`SELECT id, name, public FROM storage.buckets ORDER BY name`);
  b.rows.forEach(r => console.log(`  ${r.name} (public=${r.public})`));

  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });