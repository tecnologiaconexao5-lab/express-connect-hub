const { Client } = require('pg');
const c = new Client({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await c.connect();

  // 1. ALL distinct status values in financeiro_pagar
  console.log('=== 1. ALL FP STATUS VALUES ===');
  const fpStatus = await c.query(`
    SELECT status, COUNT(*) as cnt
    FROM financeiro_pagar
    GROUP BY status
    ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(fpStatus.rows, null, 2));

  // 2. ALL distinct status_pagamento values in pagamentos_prestadores
  console.log('\n=== 2. ALL PP STATUS_PAGAMENTO VALUES ===');
  const ppStatus = await c.query(`
    SELECT status_pagamento, status, COUNT(*) as cnt
    FROM pagamentos_prestadores
    GROUP BY status_pagamento, status
    ORDER BY cnt DESC
  `);
  console.log(JSON.stringify(ppStatus.rows, null, 2));

  // 3. Check for CHECK constraints on status columns
  console.log('\n=== 3. CHECK CONSTRAINTS ON STATUS COLUMNS ===');
  const checks = await c.query(`
    SELECT conname, pg_get_constraintdef(oid) as def
    FROM pg_constraint
    WHERE conrelid IN ('financeiro_pagar'::regclass, 'pagamentos_prestadores'::regclass)
    AND contype = 'c'
  `);
  console.log(JSON.stringify(checks.rows, null, 2));

  // 4. RPC f_confirmar_pagamento_prestador — FULL source (status logic)
  console.log('\n=== 4. RPC pagamento_prestador — STATUS LOGIC ===');
  const rpc = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  const src = rpc.rows[0]?.prosrc || '';
  // Find all lines related to status
  const statusLines = src.split('\n').filter(l =>
    l.includes('status') || l.includes('pago') || l.includes('saldo')
    || l.includes('valor') || l.includes('baixa') || l.includes('UPDATE')
  );
  console.log(statusLines.join('\n'));

  // 5. Trigger trg_guardar_pagar_pago_sem_baixa — FULL source
  console.log('\n=== 5. TRIGGER guardar_pagar_pago_sem_baixa ===');
  const trig = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'fn_guardar_pagar_pago_sem_baixa'
  `);
  console.log(trig.rows[0]?.prosrc || 'NOT FOUND');

  // 6. Check if there's any computed status based on saldo
  console.log('\n=== 6. FP WITH STATUS != pago THAT HAVE BAIXAS ===');
  const partialBaixa = await c.query(`
    SELECT fp.id, fp.valor, fp.status,
           COALESCE(SUM(fb.valor_baixado), 0) as total_baixado,
           fp.valor - COALESCE(SUM(fb.valor_baixado), 0) as saldo
    FROM financeiro_pagar fp
    LEFT JOIN financeiro_baixas fb ON fb.titulo_tabela = 'financeiro_pagar'
      AND fb.titulo_id = fp.id AND NOT COALESCE(fb.estornada, false)
    WHERE fp.status != 'pago'
    GROUP BY fp.id, fp.valor, fp.status
    HAVING COALESCE(SUM(fb.valor_baixado), 0) > 0
    ORDER BY saldo DESC
    LIMIT 10
  `);
  console.log(JSON.stringify(partialBaixa.rows, null, 2));

  // 7. Check if any FP has 'parcial' or 'parcialmente_pago' status
  console.log('\n=== 7. SEARCH FOR parcial STATUS ===');
  const parcial = await c.query(`
    SELECT COUNT(*) as cnt FROM financeiro_pagar
    WHERE status LIKE '%parcial%' OR status LIKE '%partial%'
  `);
  console.log(JSON.stringify(parcial.rows, null, 2));

  // 8. TS service: how does UI handle status?
  console.log('\n=== 8. FP STATUS DISTRIBUTION ===');
  const dist = await c.query(`
    SELECT status,
           COUNT(*) as total,
           SUM(CASE WHEN os_id IS NOT NULL THEN 1 ELSE 0 END) as com_os,
           SUM(CASE WHEN os_id IS NULL THEN 1 ELSE 0 END) as sem_os,
           SUM(CASE WHEN fornecedor_id IS NOT NULL THEN 1 ELSE 0 END) as com_fornecedor,
           ROUND(AVG(valor), 2) as avg_valor
    FROM financeiro_pagar
    GROUP BY status
    ORDER BY total DESC
  `);
  console.log(JSON.stringify(dist.rows, null, 2));

  // 9. Check how Fluxo de Caixa reads FP
  console.log('\n=== 9. CHECK: does Fluxo de Caixa use FP.status or baixas? ===');
  // Look for the service pattern
  const fcQuery = await c.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'financeiro_pagar'
    AND column_name IN ('status', 'data_pagamento', 'data_efetiva_pgto', 'conta_pagadora')
  `);
  console.log('FP columns used by FC:', JSON.stringify(fcQuery.rows.map(r => r.column_name)));

  // 10. Check how many FP with 'aberto' or 'pendente' have baixas
  console.log('\n=== 10. FP PAGO WITH MULTIPLE BAIXAS (latent support) ===');
  const multiBaixa = await c.query(`
    SELECT titulo_id, COUNT(*) as baixa_count,
           SUM(valor_baixado) as total_baixado,
           MAX(valor_original) as valor_original
    FROM financeiro_baixas
    WHERE titulo_tabela = 'financeiro_pagar' AND NOT COALESCE(estornada, false)
    GROUP BY titulo_id
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  console.log(JSON.stringify(multiBaixa.rows, null, 2));

  // 11. Check RPC f_confirmar_pagamento_fechamento — how it handles status
  console.log('\n=== 11. RPC FECHAMENTO — STATUS HANDLING ===');
  const rpcFech = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_fechamento'
  `);
  const srcFech = rpcFech.rows[0]?.prosrc || '';
  const statusFech = srcFech.split('\n').filter(l =>
    l.includes('status') || l.includes('pago') || l.includes('item')
  );
  console.log(statusFech.join('\n'));

  // 12. Check TS: pagamentoPrestadorService — confirmarPagamento
  console.log('\n=== 12. TS: confirmarPagamento pattern (search) ===');
  // Check if there's any logic that updates FP.status based on saldo
  const tsStatus = await c.query(`
    SELECT prosrc FROM pg_proc WHERE proname = 'f_confirmar_pagamento_prestador'
  `);
  const tsSrc = tsStatus.rows[0]?.prosrc || '';
  // Find the final UPDATE of FP status
  const updateFpIdx = tsSrc.lastIndexOf('UPDATE public.financeiro_pagar');
  if (updateFpIdx > 0) {
    console.log('FP UPDATE block:', tsSrc.substring(updateFpIdx, updateFpIdx + 300));
  }

  // 13. Check if there's any view or function that computes "saldo" for FP
  console.log('\n=== 13. VIEWS/FUNCTIONS with saldo computation ===');
  const views = await c.query(`
    SELECT routine_name, routine_type
    FROM information_schema.routines
    WHERE routine_definition LIKE '%saldo_restante%'
    OR routine_definition LIKE '%financeiro_pagar%saldo%'
  `);
  console.log(JSON.stringify(views.rows, null, 2));

  // 14. Check the UI service for ContasPagar — how it lists FP
  console.log('\n=== 14. FP PAGO with data_pagamento (baixa flow indicator) ===');
  const pagoData = await c.query(`
    SELECT fp.id, fp.valor, fp.status, fp.data_pagamento, fp.observacoes,
           COALESCE(SUM(fb.valor_baixado), 0) as total_baixado
    FROM financeiro_pagar fp
    LEFT JOIN financeiro_baixas fb ON fb.titulo_tabela = 'financeiro_pagar'
      AND fb.titulo_id = fp.id AND NOT COALESCE(fb.estornada, false)
    WHERE fp.status = 'pago'
    GROUP BY fp.id, fp.valor, fp.status, fp.data_pagamento, fp.observacoes
    HAVING fp.valor != COALESCE(SUM(fb.valor_baixado), 0)
    LIMIT 5
  `);
  console.log(JSON.stringify(pagoData.rows, null, 2));

  // 15. Check the EXACT trigger guard — does it block setting status='aberto'?
  console.log('\n=== 15. TRIGGER GUARD — EXACT CONDITION ===');
  const guardSrc = trig.rows[0]?.prosrc || '';
  console.log(guardSrc);

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
