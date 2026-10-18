const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. Does f_confirmar_pagamento_fechamento exist?
  console.log('=== 1. RPC fechamento exists? ===');
  const rpc = await c.query(`
    SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento') as exists
  `);
  console.log(JSON.stringify(rpc.rows, null, 2));

  // 2. Check the baixa that references PP 32fe474f
  console.log('\n=== 2. BAIXA for PP 32fe474f ===');
  const baixa = await c.query(`
    SELECT fb.* FROM financeiro_baixas fb
    WHERE fb.observacao LIKE '%32fe474f%'
  `);
  console.log(JSON.stringify(baixa.rows, null, 2));

  // 3. Check which FP was baixed by this payment
  console.log('\n=== 3. FP baixed by payment to CESAR ===');
  const fpBaixa = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.os_id, fp.fornecedor_id,
           fb.valor_baixado, fb.data_baixa, fb.observacao
    FROM financeiro_baixas fb
    INNER JOIN financeiro_pagar fp ON fp.id = fb.titulo_id
    WHERE fb.observacao LIKE '%32fe474f%'
  `);
  console.log(JSON.stringify(fpBaixa.rows, null, 2));

  // 4. Check all 02B trigger-related: current trigger uses v_valor_liquido?
  console.log('\n=== 4. M80 (OS trigger) — FP line ===');
  const fn80 = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_os'
  `);
  const src80 = fn80.rows[0]?.prosrc || '';
  const fpLines80 = src80.split('\n').filter(l =>
    l.includes('financeiro_pagar') && (l.includes('v_valor') || l.includes('INSERT'))
  );
  console.log(fpLines80.join('\n'));

  // 5. Grants on RPC
  console.log('\n=== 5. GRANTS on f_confirmar_pagamento_prestador ===');
  const grants = await c.query(`
    SELECT grantee, privilege_type
    FROM information_schema.role_routine_grants
    WHERE routine_name = 'f_confirmar_pagamento_prestador'
  `);
  console.log(JSON.stringify(grants.rows, null, 2));

  // 6. Count FP that would be affected IF the snapshot ran fresh today
  console.log('\n=== 6. WOULD-BE SNAPSHOT TODAY (fresh criteria) ===');
  const today = await c.query(`
    SELECT COUNT(*) as eligible,
           SUM(ROUND(COALESCE(fp.valor,0)::NUMERIC,2)) as fp_total,
           SUM(ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2)) as pp_total
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
  `);
  console.log(JSON.stringify(today.rows, null, 2));

  // 7. Check the 6 FP "a vencer" — are they generic expenses or prestador-linked?
  console.log('\n=== 7. FP a vencer detail ===');
  const avencer = await c.query(`
    SELECT id, valor, status, os_id, fornecedor_id, prestador, categoria, descricao
    FROM financeiro_pagar
    WHERE status = 'a vencer'
  `);
  console.log(JSON.stringify(avencer.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
