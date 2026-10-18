const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL, statement_timeout: 30000 });
  await c.connect();

  // Check a few candidates - what are pp.pedagio, pp.adicionais vs os.pedagio, os.adicionais?
  const r = await c.query(`
    SELECT 
      fp.id AS fp_id,
      fp.valor AS fp_valor,
      pp.valor_liquido AS pp_valor_liquido,
      ROUND((pp.valor_liquido - fp.valor)::numeric, 2) AS diferenca,
      pp.pedagio AS pp_pedagio,
      pp.adicionais AS pp_adicionais,
      os.pedagio AS os_pedagio,
      CASE WHEN os.adicionais IS NULL THEN NULL
           WHEN jsonb_typeof(os.adicionais) = 'number' THEN (os.adicionais #>> '{}')::NUMERIC
           ELSE (os.adicionais->>'valor')::NUMERIC
      END AS os_adicionais,
      os.id AS os_id,
      fp.os_id AS fp_os_id
    FROM financeiro_pagar fp
    INNER JOIN pagamentos_prestadores pp 
      ON pp.os_id::TEXT = fp.os_id 
      AND pp.prestador_id = fp.fornecedor_id
    LEFT JOIN ordens_servico os ON os.id::TEXT = fp.os_id
    WHERE COALESCE(fp.status,'') NOT IN ('pago','paga','cancelado','cancelada','estornado')
      AND fp.os_id IS NOT NULL AND fp.fornecedor_id IS NOT NULL
      AND pp.tipo_pagamento IS DISTINCT FROM 'fechamento'
      AND ROUND(COALESCE(fp.valor,0)::numeric,2) <> ROUND(COALESCE(pp.valor_liquido,0)::numeric,2)
    ORDER BY fp.id
    LIMIT 10
  `);
  
  console.log('=== FIRST 10 CANDIDATES: COMPONENTS COMPARISON ===');
  for (const row of r.rows) {
    const dif = parseFloat(row.diferenca);
    const ppPed = parseFloat(row.pp_pedagio) || 0;
    const ppAdic = parseFloat(row.pp_adicionais) || 0;
    const osPed = parseFloat(row.os_pedagio) || 0;
    const osAdic = parseFloat(row.os_adicionais) || 0;
    console.log('---');
    console.log('fp_id:', row.fp_id);
    console.log('fp_os_id:', row.fp_os_id, 'os_id_match:', row.os_id !== null);
    console.log('fp_valor:', row.fp_valor, 'pp_valor_liquido:', row.pp_valor_liquido, 'diff:', row.diferenca);
    console.log('pp_pedagio:', row.pp_pedagio, 'pp_adicionais:', row.pp_adicionais, 'pp_sum:', ppPed + ppAdic);
    console.log('os_pedagio:', row.os_pedagio, 'os_adicionais:', row.os_adicionais, 'os_sum:', osPed + osAdic);
    console.log('pp_explains:', Math.abs(dif - (ppPed + ppAdic)) < 0.01 ? 'YES' : 'NO');
    console.log('os_explains:', Math.abs(dif - (osPed + osAdic)) < 0.01 ? 'YES' : 'NO');
  }

  await c.end();
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
