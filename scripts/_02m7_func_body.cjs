const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres' });

(async () => {
  await c.connect();

  const rpcs = [
    'f_confirmar_pagamento_prestador',
    'f_confirmar_pagamento_fechamento',
    'f_registrar_baixa_financeira',
    'f_estornar_baixa_financeira',
    'f_trg_propagar_financeiro_os',
  ];

  for (const fn of rpcs) {
    const r = await c.query(`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname = $1
      LIMIT 1
    `, [fn]);
    if (r.rows.length > 0) {
      console.log(`\n========== ${fn} ==========`);
      console.log(r.rows[0].def);
    } else {
      console.log(`\n========== ${fn} ========== NOT FOUND`);
    }
  }

  // Also get M66 trigger function
  const m66 = await c.query(`
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'f_trg_propagar_financeiro_alocacao'
    LIMIT 1
  `);
  if (m66.rows.length > 0) {
    console.log(`\n========== f_trg_propagar_financeiro_alocacao (M66) ==========`);
    console.log(m66.rows[0].def);
  }

  // Block triggers
  const blocks = await c.query(`
    SELECT p.proname, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname IN ('trg_guardar_pagar_pago_sem_baixa', 'trg_guardar_receber_pago_sem_baixa')
  `);
  blocks.rows.forEach(r => {
    console.log(`\n========== ${r.proname} ==========`);
    console.log(r.def);
  });

  await c.end();
})();
