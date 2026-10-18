const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. What's in snapshot already?
  console.log('=== 1. EXISTING SNAPSHOT CONTENTS ===');
  const snap = await c.query(`
    SELECT * FROM fin_sane_02b_snapshot ORDER BY id
  `);
  console.log(JSON.stringify(snap.rows, null, 2));

  // 2. Check FP 'a vencer' vs PP
  console.log('\n=== 2. FP STATUS a vencer vs PP ===');
  const aVencer = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.os_id, fp.fornecedor_id,
           pp.id as pp_id, pp.valor_liquido, pp.status_pagamento, pp.tipo_pagamento,
           ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) - ROUND(COALESCE(fp.valor,0)::NUMERIC,2) as diff
    FROM financeiro_pagar fp
    LEFT JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE fp.status = 'a vencer'
  `);
  console.log(JSON.stringify(aVencer.rows, null, 2));

  // 3. FP pendente vs PP
  console.log('\n=== 3. FP PENDENTE vs PP ===');
  const pendente = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.os_id, fp.fornecedor_id,
           pp.id as pp_id, pp.valor_liquido, pp.status_pagamento, pp.tipo_pagamento,
           ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) - ROUND(COALESCE(fp.valor,0)::NUMERIC,2) as diff
    FROM financeiro_pagar fp
    LEFT JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE fp.status = 'pendente'
    ORDER BY diff DESC NULLS LAST
    LIMIT 10
  `);
  console.log(JSON.stringify(pendente.rows, null, 2));

  // 4. FP aberto vs PP
  console.log('\n=== 4. FP ABERTO vs PP ===');
  const aberto = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.os_id, fp.fornecedor_id,
           pp.id as pp_id, pp.valor_liquido, pp.status_pagamento, pp.tipo_pagamento,
           ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) - ROUND(COALESCE(fp.valor,0)::NUMERIC,2) as diff
    FROM financeiro_pagar fp
    LEFT JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE fp.status = 'aberto'
    ORDER BY diff DESC NULLS LAST
    LIMIT 10
  `);
  console.log(JSON.stringify(aberto.rows, null, 2));

  // 5. How many FP have matching PP os_id+fornecedor_id
  console.log('\n=== 5. FP WITH MATCHING PP (os_id + fornecedor_id) ===');
  const matchCount = await c.query(`
    SELECT
      COUNT(*) as total_matched,
      SUM(CASE WHEN fp.status NOT IN ('pago','paga','cancelado','cancelada','estornado') THEN 1 ELSE 0 END) as matched_nao_pago,
      SUM(CASE WHEN fp.status IN ('pago','paga') THEN 1 ELSE 0 END) as matched_pago,
      SUM(CASE WHEN fp.status IN ('cancelado','cancelada','estornado') THEN 1 ELSE 0 END) as matched_cancelado
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
  `);
  console.log(JSON.stringify(matchCount.rows, null, 2));

  // 6. FP without matching PP
  console.log('\n=== 6. FP WITHOUT MATCHING PP ===');
  const noMatch = await c.query(`
    SELECT COUNT(*) as total_no_match,
           SUM(CASE WHEN fp.status NOT IN ('pago','paga','cancelado','cancelada','estornado') THEN 1 ELSE 0 END) as no_match_nao_pago
    FROM financeiro_pagar fp
    WHERE NOT EXISTS (
      SELECT 1 FROM pagamentos_prestadores pp
      WHERE pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    )
  `);
  console.log(JSON.stringify(noMatch.rows, null, 2));

  // 7. Snapshot 02B criteria: non-pago FP with PP match AND value differs
  // (the exact query from migration SEÇÃO 4)
  console.log('\n=== 7. SNAPSHOT 02B EXACT CRITERIA ===');
  const exact = await c.query(`
    SELECT COUNT(*) as eligible_count,
           SUM(ROUND(COALESCE(fp.valor,0)::NUMERIC,2)) as total_fp,
           SUM(ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2)) as total_pp
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp
           ON pp.os_id::TEXT = fp.os_id
          AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
  `);
  console.log(JSON.stringify(exact.rows, null, 2));

  // 8. Check 'a vencer' in exclusion list
  console.log('\n=== 8. FP status NOT in exclusion ===');
  const notExcluded = await c.query(`
    SELECT status, COUNT(*) as qtd
    FROM financeiro_pagar
    WHERE COALESCE(status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
    GROUP BY status
    ORDER BY qtd DESC
  `);
  console.log(JSON.stringify(notExcluded.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
