const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. historico_alocacoes for CESAR
  console.log('=== 1. historico_alocacoes for CESAR ===');
  const hist = await c.query(`
    SELECT id, alocacao_id, evento, status_anterior, status_novo, created_at
    FROM historico_alocacoes_escala
    WHERE alocacao_id = '58e5751e-bd54-43c5-9bcf-55fe4e575e6b'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(hist.rows, null, 2));

  // 2. ALL PP with prestador=CESAR
  console.log('\n=== 2. ALL PP prestador=CESAR ===');
  const cesarPPs = await c.query(`
    SELECT id, os_id, valor_liquido, valor_servicos, status_pagamento, status,
           data_pagamento, created_at, updated_at
    FROM pagamentos_prestadores
    WHERE prestador_id = 'fe7a75cc-a49f-43ef-a0b7-f869fbf07744'
    ORDER BY created_at
  `);
  console.log(JSON.stringify(cesarPPs.rows, null, 2));

  // 3. SNAPSHOT execution history
  console.log('\n=== 3. SNAPSHOT EXECUTION HISTORY ===');
  const snapHist = await c.query(`
    SELECT processado_em, COUNT(*) as records,
           SUM(valor_novo - valor_anterior) as total_adjustment
    FROM fin_sane_02b_snapshot
    GROUP BY processado_em
    ORDER BY processado_em
  `);
  console.log(JSON.stringify(snapHist.rows, null, 2));

  // 4. SNAPSHOT TABLE SCHEMA
  console.log('\n=== 4. SNAPSHOT TABLE SCHEMA ===');
  const snapSchema = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'fin_sane_02b_snapshot'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(snapSchema.rows, null, 2));

  // 5. Are there any FP with status='pago' that have a baixa with valor_baixado < PP.valor_liquido?
  console.log('\n=== 5. FP PAGO WITH BAIXA < PP VALOR (potential CESAR-like) ===');
  const partialBaixa = await c.query(`
    SELECT fp.id as fp_id, fp.valor as fp_valor, fp.status as fp_status, fp.os_id,
           pp.id as pp_id, pp.valor_liquido as pp_valor, pp.status_pagamento as pp_status,
           fb.valor_baixado, fb.saldo_restante,
           pp.valor_liquido - fb.valor_baixado as diff
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp ON pp.os_id::TEXT = fp.os_id AND pp.prestador_id = fp.fornecedor_id
    INNER JOIN financeiro_baixas fb ON fb.titulo_tabela = 'financeiro_pagar' AND fb.titulo_id = fp.id AND NOT COALESCE(fb.estornada, false)
    WHERE fp.status IN ('pago', 'paga')
      AND fb.valor_baixado < pp.valor_liquido
    ORDER BY diff DESC
  `);
  console.log(JSON.stringify(partialBaixa.rows, null, 2));

  // 6. Check existing trigger function body for M66
  console.log('\n=== 6. CURRENT M66 TRIGGER FUNCTION — FP LINE ===');
  const fn = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_trg_propagar_financeiro_alocacao'
  `);
  const src = fn.rows[0]?.prosrc || '';
  // Find the FP INSERT line
  const lines = src.split('\n');
  const fpLines = lines.filter(l => l.includes('financeiro_pagar') || l.includes('v_valor_liquido') || l.includes('v_valor_prestador'));
  console.log('Lines with FP/v_valor:', fpLines.join('\n'));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
