const { Client } = require('pg');
require('dotenv').config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  // 1. f_calcular_financeiro_operacao — auth.uid? (severidade do grant anon)
  const r1 = await c.query(`SELECT pg_get_functiondef(oid) d FROM pg_proc WHERE proname='f_calcular_financeiro_operacao'`);
  if (r1.rows.length) console.log('[1] f_calcular_financeiro_operacao auth.uid=' + r1.rows[0].d.includes('auth.uid') + ' len=' + r1.rows[0].d.length);

  // 2. Explotabilidade: oportunidades em estado aceitavel
  const r2 = await c.query(`SELECT status, count(*) n FROM rede_oportunidades GROUP BY status ORDER BY n DESC`).catch(e => ({ rows: [{ status: 'ERRO:' + e.message, n: 0 }] }));
  console.log('[2] rede_oportunidades:', r2.rows.map(x => `${x.status}=${x.n}`).join(', ') || 'vazia');

  // 3. linhas divergentes composicao — OS correspondentes tem JSONB adicionais?
  const r3 = await c.query(`
    SELECT c.os_id, c.outros_custos, c.adicional_valor, o.adicionais, o.ajudante, o.descontos, o.pedagio
    FROM composicao_financeira_os c
    LEFT JOIN ordens_servico o ON o.id::text = c.os_id::text
    WHERE c.outros_custos IS DISTINCT FROM COALESCE(c.adicional_valor,0)+COALESCE(c.ajudante_valor,0)-COALESCE(c.desconto_valor,0)`);
  console.log('[3] divergentes (jsonb das OS):');
  for (const row of r3.rows) console.log('   ', row.os_id, 'outros=' + row.outros_custos, 'cols(adic/aju/desc)=' + row.adicional_valor + '/' + (row.ajudante || '-'), 'os_jsonb(adic/aju/desc/ped)=' + JSON.stringify(row.adicionais) + '/' + JSON.stringify(row.ajudante) + '/' + row.descontos + '/' + row.pedagio);

  // 4. prestadores com liberado_app ativo vs veiculos vinculados
  const r4 = await c.query(`SELECT count(*) FILTER (WHERE p.status='ativo' AND p.liberado_app IS TRUE) habilitados FROM prestadores p`);
  console.log('[4] prestadores ativo+liberado_app:', r4.rows[0].habilitados);

  // 5. vocabulario de status de OS live (drift)
  const r5 = await c.query(`SELECT status, count(*) n FROM ordens_servico GROUP BY status ORDER BY n DESC`);
  console.log('[5] OS.status vocab:', r5.rows.map(x => `${x.status}=${x.n}`).join(', '));

  await c.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
