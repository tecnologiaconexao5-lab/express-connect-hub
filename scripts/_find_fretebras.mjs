import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const r = await pool.query(`
SELECT 
  id,
  fornecedor,
  fornecedor_nome,
  descricao,
  data_vencimento,
  valor,
  status as status_persistido,
  data_pagamento,
  data_efetiva_pgto,
  is_teste,
  CASE 
    WHEN data_pagamento IS NOT NULL THEN 'pago'
    WHEN status IN ('cancelado', 'cancelada') THEN 'cancelado'
    WHEN status = 'renegociado' THEN 'renegociado'
    WHEN data_vencimento IS NULL THEN 'desconhecido'
    WHEN data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'a_vencer'
  END as status_efetivo_calc
FROM financeiro_pagar 
WHERE fornecedor ILIKE '%FRETEBRAS%'
   OR fornecedor_nome ILIKE '%FRETEBRAS%'
   OR descricao ILIKE '%FRETEBRAS%'
ORDER BY created_at DESC
LIMIT 10;
`);
console.log('FRETEBRAS search:');
console.table(r.rows);
console.log('(' + r.rowCount + ' rows)');

await pool.end();
