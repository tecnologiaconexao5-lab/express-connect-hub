const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // For each non-explained record: check if pp.valor_liquido = pp.valor_servicos + something
  // The 02I formula said diferenca = pedagio + adicionais. But some records have ped+adic < diferenca.
  // Let's check: pp.valor_liquido = pp.valor_servicos + X? What is X?
  const r = await c.query(`
    SELECT 
      fp.id AS fp_id,
      fp.valor AS fp_valor,
      pp.valor_liquido,
      pp.valor_servicos,
      pp.pedagio,
      pp.adicionais,
      ROUND((pp.valor_liquido - pp.valor_servicos - COALESCE(pp.pedagio,0) - COALESCE(pp.adicionais,0))::numeric, 2) AS residual_liquido,
      ROUND((pp.valor_liquido - fp.valor)::numeric, 2) AS diferenca
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp 
      ON pp.os_id::TEXT = fp.os_id 
      AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status,'') NOT IN ('pago','paga','cancelado','cancelada','estornado')
      AND fp.os_id IS NOT NULL AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor,0)::numeric,2) <> ROUND(COALESCE(pp.valor_liquido,0)::numeric,2)
    ORDER BY fp.id
  `);

  // Group by residual_liquido
  const groups = {};
  for (const row of r.rows) {
    const res = row.residual_liquido;
    if (!groups[res]) groups[res] = [];
    groups[res].push(row.fp_id);
  }

  console.log('=== RESIDUAL GROUPS (pp.valor_liquido - pp.valor_servicos - ped - adic) ===');
  for (const [res, ids] of Object.entries(groups)) {
    console.log('residual=' + res + ': ' + ids.length + ' records');
  }

  // Check: the sum of residual should equal the sum of diferenca - (ped+adic)
  let totalDif = 0, totalRes = 0;
  for (const row of r.rows) {
    totalDif += parseFloat(row.diferenca);
    totalRes += parseFloat(row.residual_liquido);
  }
  console.log('\nTotal diferenca:', totalDif.toFixed(2));
  console.log('Total residual_liquido:', totalRes.toFixed(2));

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
