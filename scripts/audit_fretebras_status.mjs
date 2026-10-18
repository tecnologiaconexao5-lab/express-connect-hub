import pg from 'pg';
const pool = new pg.Pool({
  connectionString: 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const queries = [
  {
    title: 'QUERY 1 — FRETEBRAS Record (Status Persistido vs Efetivo)',
    sql: `
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
WHERE id = '717c5280-6b26-4129-bf74-aa06a0a3989f';
`
  },
  {
    title: 'QUERY 2 — Overdue PAGAR Records with Effective Status',
    sql: `
SELECT 
  id,
  fornecedor,
  data_vencimento,
  valor,
  status as status_persistido,
  CASE 
    WHEN data_pagamento IS NOT NULL THEN 'pago'
    WHEN status IN ('cancelado', 'cancelada') THEN 'cancelado'
    WHEN status = 'renegociado' THEN 'renegociado'
    WHEN data_vencimento IS NULL THEN 'desconhecido'
    WHEN data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'a_vencer'
  END as status_efetivo
FROM financeiro_pagar 
WHERE data_vencimento < CURRENT_DATE
  AND status NOT IN ('pago', 'paga', 'cancelado', 'cancelada')
  AND data_pagamento IS NULL
ORDER BY data_vencimento ASC
LIMIT 20;
`
  },
  {
    title: 'QUERY 3 — Overdue RECEBER Records with Effective Status',
    sql: `
SELECT 
  id,
  cliente,
  cliente_nome,
  data_vencimento,
  valor,
  status as status_persistido,
  CASE 
    WHEN data_pagamento IS NOT NULL THEN 'pago'
    WHEN status IN ('cancelado', 'cancelada') THEN 'cancelado'
    WHEN status = 'renegociado' THEN 'renegociado'
    WHEN data_vencimento IS NULL THEN 'desconhecido'
    WHEN data_vencimento < CURRENT_DATE THEN 'atrasado'
    WHEN data_vencimento = CURRENT_DATE THEN 'vence_hoje'
    ELSE 'a_vencer'
  END as status_efetivo
FROM financeiro_receber 
WHERE data_vencimento < CURRENT_DATE
  AND status NOT IN ('pago', 'paga', 'recebido', 'cancelado', 'cancelada')
  AND data_pagamento IS NULL
ORDER BY data_vencimento ASC
LIMIT 20;
`
  },
  {
    title: 'QUERY 4 — Summary: Records That Would Change Status',
    sql: `
SELECT 
  'PAGAR que muda para atrasado' as categoria,
  COUNT(*) as qtd
FROM financeiro_pagar 
WHERE data_vencimento < CURRENT_DATE
  AND status NOT IN ('pago', 'paga', 'cancelado', 'cancelada', 'renegociado')
  AND data_pagamento IS NULL
UNION ALL
SELECT 
  'RECEBER que muda para atrasado' as categoria,
  COUNT(*) as qtd
FROM financeiro_receber 
WHERE data_vencimento < CURRENT_DATE
  AND status NOT IN ('pago', 'paga', 'recebido', 'cancelado', 'cancelada', 'renegociado')
  AND data_pagamento IS NULL;
`
  }
];

async function run() {
  const client = await pool.connect();
  try {
    for (const q of queries) {
      console.log('\n' + '='.repeat(80));
      console.log(q.title);
      console.log('='.repeat(80));
      const res = await client.query(q.sql);
      console.table(res.rows);
      console.log('(' + res.rowCount + ' rows)');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
