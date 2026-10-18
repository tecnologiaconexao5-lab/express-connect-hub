const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // Check all pp columns for non-explained records
  const r = await c.query(`
    SELECT 
      fp.id AS fp_id,
      fp.valor AS fp_valor,
      pp.id AS pp_id,
      pp.valor_liquido AS pp_valor_liquido,
      ROUND((pp.valor_liquido - fp.valor)::numeric, 2) AS diferenca,
      pp.valor_servicos,
      pp.pedagio,
      pp.adicionais,
      pp.reembolsos,
      pp.valor_bonus,
      pp.valor_descontos,
      pp.valor_adiantamentos,
      pp.multas,
      pp.ajustes,
      pp.qtd_os,
      pp.tipo_pagamento,
      pp.origem_lancamento
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
  
  let explicados = 0, naoExplicados = 0;
  const ids = [];
  
  for (const row of r.rows) {
    const dif = parseFloat(row.diferenca);
    const ped = parseFloat(row.pedagio) || 0;
    const adic = parseFloat(row.adicionais) || 0;
    const reemb = parseFloat(row.reembolsos) || 0;
    const bonus = parseFloat(row.valor_bonus) || 0;
    const desc = parseFloat(row.valor_descontos) || 0;
    const adiant = parseFloat(row.valor_adiantamentos) || 0;
    const multas = parseFloat(row.multas) || 0;
    const ajustes = parseFloat(row.ajustes) || 0;
    ids.push(row.fp_id);

    // Try: diferenca == pedagio + adicionais
    const exp1 = Math.abs(dif - (ped + adic)) < 0.01;
    // Try: diferenca == pedagio + adicionais - reembolsos
    const exp2 = Math.abs(dif - (ped + adic - reemb)) < 0.01;
    // Try: diferenca == pedagio + adicionais + ajustes
    const exp3 = Math.abs(dif - (ped + adic + ajustes)) < 0.01;
    // Try: diferenca == pedagio + adicionais + bonus - descontos
    const exp4 = Math.abs(dif - (ped + adic + bonus - desc)) < 0.01;

    if (exp1 || exp2 || exp3 || exp4) {
      explicados++;
    } else {
      naoExplicados++;
      console.log('---');
      console.log('fp_id:', row.fp_id, 'pp_id:', row.pp_id);
      console.log('fp_valor:', row.fp_valor, 'pp_valor_liquido:', row.pp_valor_liquido, 'diff:', row.diferenca);
      console.log('pedagio:', row.pedagio, 'adicionais:', row.adicionais, 'sum:', ped + adic);
      console.log('reembolsos:', row.reembolsos, 'bonus:', row.valor_bonus, 'descontos:', row.valor_descontos);
      console.log('adiantamentos:', row.valor_adiantamentos, 'multas:', row.multas, 'ajustes:', row.ajustes);
      console.log('qtd_os:', row.qtd_os, 'tipo:', row.tipo_pagamento, 'origem:', row.origem_lancamento);
    }
  }

  console.log('\n=== EXPLICABILIDADE (pagamentos_prestadores columns) ===');
  console.log('EXPLICADOS:', explicados + '/' + r.rowCount);
  console.log('NAO_EXPLICADOS:', naoExplicados + '/' + r.rowCount);

  // Also check: is valor_liquido == valor_servicos + pedagio + adicionais - reembolsos?
  console.log('\n=== CHECK: pp.valor_liquido == pp.valor_servicos + pp.pedagio + pp.adicionais ===');
  const check = await c.query(`
    SELECT 
      fp.id,
      pp.valor_liquido,
      pp.valor_servicos,
      pp.pedagio,
      pp.adicionais,
      pp.reembolsos,
      ROUND((pp.valor_servicos + pp.pedagio + pp.adicionais - COALESCE(pp.reembolsos,0))::numeric, 2) AS calc_liquido,
      ROUND((pp.valor_liquido - (pp.valor_servicos + pp.pedagio + pp.adicionais - COALESCE(pp.reembolsos,0)))::numeric, 2) AS residual
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp 
      ON pp.os_id::TEXT = fp.os_id 
      AND pp.prestador_id = fp.fornecedor_id
    WHERE COALESCE(fp.status,'') NOT IN ('pago','paga','cancelado','cancelada','estornado')
      AND fp.os_id IS NOT NULL AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor,0)::numeric,2) <> ROUND(COALESCE(pp.valor_liquido,0)::numeric,2)
    ORDER BY fp.id
    LIMIT 5
  `);
  for (const row of check.rows) {
    console.log('  fp:', row.id, 'pp_liq:', row.valor_liquido, 'calc:', row.calc_liquido, 'residual:', row.residual);
  }

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
