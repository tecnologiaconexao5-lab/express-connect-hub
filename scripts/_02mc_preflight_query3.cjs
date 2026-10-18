const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. CESAR PP full detail
  console.log('=== 1. CESAR PP FULL DETAIL ===');
  const pp = await c.query(`
    SELECT id, prestador_id, prestador_nome, os_id, valor_liquido, valor_servicos,
           pedagio, adicionais, status_pagamento, status, status_conferencia,
           data_pagamento, created_at, updated_at, origem_lancamento, tipo_pagamento
    FROM pagamentos_prestadores
    WHERE id = '7461daf6-438b-43b3-abde-4d30e1609574'
  `);
  console.log(JSON.stringify(pp.rows, null, 2));

  // 2. CESAR FP full detail
  console.log('\n=== 2. CESAR FP FULL DETAIL ===');
  const fp = await c.query(`
    SELECT id, os_id, valor, status, fornecedor_id, fornecedor_nome, prestador,
           created_at, updated_at, data_pagamento, data_efetiva_pgto,
           conta_pagadora, observacoes
    FROM financeiro_pagar
    WHERE id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log(JSON.stringify(fp.rows, null, 2));

  // 3. CESAR baixa full detail
  console.log('\n=== 3. CESAR BAIXA FULL DETAIL ===');
  const fb = await c.query(`
    SELECT id, titulo_tabela, titulo_id, valor_original, valor_baixado, saldo_restante,
           data_baixa, forma_pagamento, conta_financeira, conta_financeira_id,
           observacao, created_at, estornada
    FROM financeiro_baixas
    WHERE titulo_tabela = 'financeiro_pagar' AND titulo_id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log(JSON.stringify(fb.rows, null, 2));

  // 4. Check if there's a historico for CESAR PP
  console.log('\n=== 4. CHECK historico_alocacoes for CESAR allocation ===');
  const hist = await c.query(`
    SELECT id, alocacao_id, evento, status_anterior, status_novo, created_at, metadata
    FROM historico_alocacoes_escala
    WHERE alocacao_id = '58e5751e-bd54-43c5-9bcf-55fe4e575e6b'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(hist.rows, null, 2));

  // 5. Check PP status changes — was it ever 'pago'?
  console.log('\n=== 5. ALL PP with prestador=CESAR ===');
  const cesarPPs = await c.query(`
    SELECT id, os_id, valor_liquido, valor_servicos, status_pagamento, status,
           data_pagamento, created_at, updated_at
    FROM pagamentos_prestadores
    WHERE prestador_id = 'fe7a75cc-a49f-43ef-a0b7-f869fbf07744'
    ORDER BY created_at
  `);
  console.log(JSON.stringify(cesarPPs.rows, null, 2));

  // 6. What does the snapshot table tell us about when it was run?
  console.log('\n=== 6. SNAPSHOT EXECUTION HISTORY ===');
  const snapHist = await c.query(`
    SELECT processado_em, execucao_id, COUNT(*) as records,
           SUM(valor_novo - valor_anterior) as total_adjustment
    FROM fin_sane_02b_snapshot
    GROUP BY processado_em, execucao_id
    ORDER BY processado_em
  `);
  console.log(JSON.stringify(snapHist.rows, null, 2));

  // 7. Check if snapshot table has execucao_id column
  console.log('\n=== 7. SNAPSHOT TABLE SCHEMA ===');
  const snapSchema = await c.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'fin_sane_02b_snapshot'
    ORDER BY ordinal_position
  `);
  console.log(JSON.stringify(snapSchema.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
