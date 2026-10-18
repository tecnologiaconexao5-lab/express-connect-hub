const pg = require('pg');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await c.connect();

  // 1. contas_financeiras
  const r1 = await c.query('SELECT id, nome, banco, agencia, numero_conta, ativa, principal FROM contas_financeiras ORDER BY principal DESC, nome');
  console.log('=== contas_financeiras ===');
  console.table(r1.rows);

  // 2. configuracoes_sistema keys related to contas
  const r2 = await c.query("SELECT chave FROM configuracoes_sistema WHERE chave ILIKE '%conta%' OR chave ILIKE '%financeiro%' OR chave ILIKE '%banco%'");
  console.log('=== configuracoes_sistema (contas/financeiro/banco) ===');
  console.table(r2.rows);

  // 3. Phantom RECEBER: status=pago without baixa
  const r3 = await c.query(`
    SELECT fr.id, fr.fatura, fr.descricao, fr.cliente_id, fr.valor, fr.status, fr.data_pagamento, fr.created_at
    FROM financeiro_receber fr
    WHERE fr.status = 'pago'
    AND NOT EXISTS (SELECT 1 FROM financeiro_baixas fb WHERE fb.titulo_tabela = 'financeiro_receber' AND fb.titulo_id = fr.id)
    ORDER BY fr.created_at DESC
    LIMIT 10
  `);
  console.log('=== PHANTOM RECEBER: status=pago sem baixa ===');
  console.table(r3.rows);

  // 4. NULL records
  const r4 = await c.query(`SELECT id, fatura, valor, status, cliente_id, created_at FROM financeiro_receber WHERE valor IS NULL OR status IS NULL LIMIT 10`);
  console.log('=== NULL RECEBER (valor/status) ===');
  console.table(r4.rows);

  const r5 = await c.query(`SELECT id, descricao, valor, status, fornecedor_id, created_at FROM financeiro_pagar WHERE valor IS NULL OR status IS NULL LIMIT 10`);
  console.log('=== NULL PAGAR (valor/status) ===');
  console.table(r5.rows);

  // 5. Dashboard KPI queries
  const r6 = await c.query(`SELECT COUNT(*) as qtd, SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as total_pago, SUM(CASE WHEN status IN ('pendente','a vencer') THEN valor ELSE 0 END) as total_pendente FROM financeiro_pagar`);
  console.log('=== financeiro_pagar summary ===');
  console.table(r6.rows);

  const r7 = await c.query(`SELECT COUNT(*) as qtd, SUM(CASE WHEN status = 'pago' THEN valor ELSE 0 END) as total_pago, SUM(CASE WHEN status IN ('pendente','a vencer') THEN valor ELSE 0 END) as total_pendente FROM financeiro_receber`);
  console.log('=== financeiro_receber summary ===');
  console.table(r7.rows);

  // 6. Baixas summary
  const r8 = await c.query(`SELECT titulo_tabela, COUNT(*) as qtd, SUM(valor_baixado) as total_baixado FROM financeiro_baixas GROUP BY titulo_tabela`);
  console.log('=== financeiro_baixas summary ===');
  console.table(r8.rows);

  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
