const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. Check if there's any 'estorno' baixa pattern in the system
  console.log('=== 1. ESTORNOS EXISTENTES ===');
  const estornos = await c.query(`
    SELECT id, titulo_id, valor_baixado, estornada, data_estorno, motivo_estorno, observacao
    FROM financeiro_baixas
    WHERE estornada = true
    LIMIT 10
  `);
  console.log(JSON.stringify(estornos.rows, null, 2));

  // 2. Check how many FP have multiple baixas (partial payments pattern)
  console.log('\n=== 2. FP WITH MULTIPLE BAIXAS ===');
  const multiBaixa = await c.query(`
    SELECT titulo_id, COUNT(*) as baixa_count, SUM(valor_baixado) as total_baixado
    FROM financeiro_baixas
    WHERE titulo_tabela = 'financeiro_pagar' AND NOT COALESCE(estornada, false)
    GROUP BY titulo_id
    HAVING COUNT(*) > 1
    ORDER BY total_baixado DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(multiBaixa.rows, null, 2));

  // 3. Check if any FP has saldo_restante > 0 (partial payment pattern)
  console.log('\n=== 3. FP WITH SALDO RESTANTE > 0 ===');
  const saldoPositivo = await c.query(`
    SELECT fb.titulo_id, fb.valor_original, fb.valor_baixado, fb.saldo_restante,
           fp.valor as fp_valor, fp.status as fp_status
    FROM financeiro_baixas fb
    INNER JOIN financeiro_pagar fp ON fp.id = fb.titulo_id
    WHERE fb.titulo_tabela = 'financeiro_pagar'
      AND NOT COALESCE(fb.estornada, false)
      AND fb.saldo_restante > 0
    ORDER BY fb.saldo_restante DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(saldoPositivo.rows, null, 2));

  // 4. Check the RPC fechamento logic (full source)
  console.log('\n=== 4. RPC fechamento FULL SOURCE ===');
  const rpcFn = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento'
  `);
  console.log(rpcFn.rows[0]?.prosrc || 'NOT FOUND');

  // 5. Check the RPC pagamento_prestador full source (the one that validates FP=PP)
  console.log('\n=== 5. RPC pagamento_prestador FULL SOURCE ===');
  const rpcPrest = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  console.log(rpcPrest.rows[0]?.prosrc || 'NOT FOUND');

  // 6. Check what happens to FP.status when baixa is created
  console.log('\n=== 6. FP STATUS TRANSITIONS (sample) ===');
  const statusTransitions = await c.query(`
    SELECT fp.status, fb.valor_baixado, fb.saldo_restante, fb.observacao
    FROM financeiro_baixas fb
    INNER JOIN financeiro_pagar fp ON fp.id = fb.titulo_id
    WHERE fb.titulo_tabela = 'financeiro_pagar' AND NOT COALESCE(fb.estornada, false)
    ORDER BY fb.created_at DESC
    LIMIT 15
  `);
  console.log(JSON.stringify(statusTransitions.rows, null, 2));

  // 7. Check if there's a trigger that auto-updates FP.status based on baixa
  console.log('\n=== 7. TRIGGERS ON financeiro_pagar ===');
  const triggersFP = await c.query(`
    SELECT tgname, tgenabled, tgtype,
           (SELECT prosrc FROM pg_proc WHERE oid = tgfoid) as trigger_src
    FROM pg_trigger
    WHERE tgrelid = 'financeiro_pagar'::regclass AND NOT tgisinternal
  `);
  for (const t of triggersFP.rows) {
    console.log(`Trigger: ${t.tgname}, enabled: ${t.tgenabled}`);
    // Show relevant lines
    const src = t.trigger_src || '';
    const lines = src.split('\n').filter(l =>
      l.includes('status') || l.includes('pago') || l.includes('baixa') || l.includes('saldo')
    );
    if (lines.length > 0) console.log('  Relevant:', lines.join('\n  '));
  }

  // 8. Check the TS service confirmarPagamento — what does it do?
  console.log('\n=== 8. CHECK TS: confirmarPagamento in pagamentoPrestadorService ===');
  // Just check the RPC call signature
  const rpcCall = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  const rpcSrc = rpcCall.rows[0]?.prosrc || '';
  // Find the baixa creation logic
  const baixaLines = rpcSrc.split('\n').filter(l =>
    l.includes('financeiro_baixas') || l.includes('INSERT') || l.includes('saldo_restante')
  );
  console.log('Baixa creation in RPC:', baixaLines.join('\n'));

  // 9. Check if there's a 'valor_original' column in baixas that auto-populates
  console.log('\n=== 9. BAIXAS for CESAR FP — all columns ===');
  const cesarBaixa = await c.query(`
    SELECT * FROM financeiro_baixas
    WHERE titulo_id = '9f2be89f-5ece-4cc5-be29-50010b64e64e'
  `);
  console.log(JSON.stringify(cesarBaixa.rows, null, 2));

  // 10. Check all baixas that have different valor_original vs fp.valor
  console.log('\n=== 10. BAIXAS WHERE valor_original <> FP.valor ===');
  const divergent = await c.query(`
    SELECT fb.id as baixa_id, fb.valor_original, fb.valor_baixado, fb.saldo_restante,
           fp.id as fp_id, fp.valor as fp_valor, fp.os_id
    FROM financeiro_baixas fb
    INNER JOIN financeiro_pagar fp ON fp.id = fb.titulo_id
    WHERE fb.titulo_tabela = 'financeiro_pagar'
      AND NOT COALESCE(fb.estornada, false)
      AND ROUND(fb.valor_original::NUMERIC, 2) <> ROUND(fp.valor::NUMERIC, 2)
    LIMIT 10
  `);
  console.log(JSON.stringify(divergent.rows, null, 2));

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
