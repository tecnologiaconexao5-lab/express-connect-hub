const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. CESAR current state
  console.log('=== 1. CESAR CURRENT STATE ===');
  const cesar = await c.query(`
    SELECT
      fp.id as fp_id, fp.valor as fp_valor, fp.status as fp_status, fp.os_id as fp_os_id,
      fp.fornecedor_id, fp.created_at as fp_created, fp.updated_at as fp_updated,
      pp.id as pp_id, pp.valor_liquido as pp_valor_liquido, pp.valor_servicos as pp_valor_servicos,
      pp.pedagio as pp_pedagio, pp.adicionais as pp_adicionais,
      pp.status_pagamento as pp_status_pagamento, pp.status as pp_status,
      pp.created_at as pp_created, pp.updated_at as pp_updated,
      fb.id as fb_id, fb.valor_baixado as fb_valor_baixado, fb.valor_original as fb_valor_original,
      fb.saldo_restante as fb_saldo, fb.data_baixa as fb_data_baixa,
      fb.created_at as fb_created
    FROM financeiro_pagar fp
    LEFT JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    LEFT JOIN financeiro_baixas fb ON fb.titulo_tabela = 'financeiro_pagar' AND fb.titulo_id = fp.id AND NOT COALESCE(fb.estornada, false)
    WHERE fp.id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log(JSON.stringify(cesar.rows, null, 2));

  // 2. Snapshot query — exact same as migration SEÇÃO 4
  console.log('\n=== 2. SNAPSHOT CANDIDATES (02B SEÇÃO 4) ===');
  const snapshot = await c.query(`
    SELECT COUNT(*) as total, SUM(ROUND(COALESCE(fp.valor,0)::NUMERIC,2)) as total_fp_valor,
           SUM(ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2)) as total_pp_valor,
           SUM(ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) - ROUND(COALESCE(fp.valor,0)::NUMERIC,2)) as total_diferenca
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
  `);
  console.log(JSON.stringify(snapshot.rows, null, 2));

  // 3. Detail of each candidate
  console.log('\n=== 3. SNAPSHOT DETAIL (each record) ===');
  const detail = await c.query(`
    SELECT fp.id as fp_id, fp.valor as fp_valor, fp.status as fp_status, fp.os_id,
           pp.id as pp_id, pp.valor_liquido as pp_valor_liquido, pp.status_pagamento as pp_status_pagamento,
           pp.tipo_pagamento,
           ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) - ROUND(COALESCE(fp.valor,0)::NUMERIC,2) as diferenca
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status, '') NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'estornado')
      AND fp.os_id IS NOT NULL
      AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor, 0)::NUMERIC, 2) <> ROUND(COALESCE(pp.valor_liquido, 0)::NUMERIC, 2)
    ORDER BY diferenca DESC
  `);
  console.log(JSON.stringify(detail.rows, null, 2));

  // 4. FP by status
  console.log('\n=== 4. FP BY STATUS ===');
  const fpStatus = await c.query(`
    SELECT COALESCE(status, 'NULL') as status, COUNT(*) as qtd, SUM(valor) as total_valor
    FROM financeiro_pagar GROUP BY status ORDER BY qtd DESC
  `);
  console.log(JSON.stringify(fpStatus.rows, null, 2));

  // 5. PP by status_pagamento
  console.log('\n=== 5. PP BY STATUS_PAGAMENTO ===');
  const ppStatus = await c.query(`
    SELECT COALESCE(status_pagamento, 'NULL') as status_pagamento, COALESCE(status, 'NULL') as status,
           COUNT(*) as qtd, SUM(valor_liquido) as total_valor_liquido
    FROM pagamentos_prestadores GROUP BY status_pagamento, status ORDER BY qtd DESC
  `);
  console.log(JSON.stringify(ppStatus.rows, null, 2));

  // 6. FP pago — how many have PP with different valor?
  console.log('\n=== 6. FP PAGO vs PP (for comparison) ===');
  const fpPago = await c.query(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN ROUND(COALESCE(fp.valor,0)::NUMERIC,2) = ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) THEN 1 ELSE 0 END) as iguais,
           SUM(CASE WHEN ROUND(COALESCE(fp.valor,0)::NUMERIC,2) <> ROUND(COALESCE(pp.valor_liquido,0)::NUMERIC,2) THEN 1 ELSE 0 END) as divergentes
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    WHERE fp.status IN ('pago', 'paga')
  `);
  console.log(JSON.stringify(fpPago.rows, null, 2));

  // 7. Total FP and PP counts
  console.log('\n=== 7. TOTAL COUNTS ===');
  const counts = await c.query(`
    SELECT
      (SELECT COUNT(*) FROM financeiro_pagar) as total_fp,
      (SELECT COUNT(*) FROM financeiro_pagar WHERE status NOT IN ('pago','paga','cancelado','cancelada','estornado')) as fp_nao_pago,
      (SELECT COUNT(*) FROM financeiro_pagar WHERE status IN ('pago','paga')) as fp_pago,
      (SELECT COUNT(*) FROM financeiro_pagar WHERE status IN ('cancelado','cancelada','estornado')) as fp_cancelado,
      (SELECT COUNT(*) FROM financeiro_pagar WHERE status IS NULL) as fp_null_status,
      (SELECT COUNT(*) FROM pagamentos_prestadores) as total_pp,
      (SELECT COUNT(*) FROM financeiro_baixas WHERE titulo_tabela = 'financeiro_pagar' AND NOT COALESCE(estornada, false)) as total_fb
  `);
  console.log(JSON.stringify(counts.rows, null, 2));

  // 8. Snapshot table existence
  console.log('\n=== 8. SNAPSHOT TABLE CHECK ===');
  const snapExists = await c.query(`
    SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'fin_sane_02b_snapshot') as exists,
           (SELECT COUNT(*) FROM fin_sane_02b_snapshot) as current_rows
  `);
  console.log(JSON.stringify(snapExists.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
