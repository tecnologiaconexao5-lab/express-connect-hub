import pg from 'pg';
const { Client } = pg;

const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const queries = [
  { name: '9e. Status pago sem data_pagamento (pagar) - fixed columns', sql: `
SELECT 'pagar' as tabela, id, fornecedor, status, data_pagamento, data_efetiva_pgto, valor
FROM financeiro_pagar
WHERE status IN ('pago', 'paga')
  AND data_pagamento IS NULL
  AND data_efetiva_pgto IS NULL
LIMIT 10;` },

  { name: '9f. Status pago sem data_pagamento (receber) - fixed columns', sql: `
SELECT 'receber' as tabela, id, cliente, status, data_pagamento, data_previsao_recebimento, valor
FROM financeiro_receber
WHERE status IN ('pago', 'paga', 'recebido')
  AND data_pagamento IS NULL
  AND data_previsao_recebimento IS NULL
LIMIT 10;` },

  { name: '7c. All columns in financeiro_pagar', sql: `
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'financeiro_pagar' ORDER BY ordinal_position;` },

  { name: '7d. All columns in financeiro_receber', sql: `
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'financeiro_receber' ORDER BY ordinal_position;` },

  { name: '4b. ALL records with data_pagamento < data_vencimento (pagar, full)', sql: `
SELECT 'pagar' as tabela, id, fornecedor, data_vencimento, data_pagamento, status, valor
FROM financeiro_pagar
WHERE data_pagamento IS NOT NULL AND data_vencimento IS NOT NULL
  AND data_pagamento < data_vencimento
ORDER BY data_pagamento;` },

  { name: '4c. ALL records with data_pagamento < data_vencimento (receber)', sql: `
SELECT 'receber' as tabela, id, cliente, data_vencimento, data_pagamento, status, valor
FROM financeiro_receber
WHERE data_pagamento IS NOT NULL AND data_vencimento IS NOT NULL
  AND data_pagamento < data_vencimento
LIMIT 10;` },

  { name: '3b. Re-examine impossible dates - wider range', sql: `
SELECT 'pagar' as tabela, id, data_vencimento, data_emissao, data_pagamento
FROM financeiro_pagar
WHERE data_vencimento IS NOT NULL 
  AND (data_vencimento < '2020-01-01' OR data_vencimento > '2030-12-31')
UNION ALL
SELECT 'receber', id, data_vencimento, data_emissao, data_pagamento
FROM financeiro_receber
WHERE data_vencimento IS NOT NULL 
  AND (data_vencimento < '2020-01-01' OR data_vencimento > '2030-12-31')
UNION ALL
SELECT 'pagar', id, data_emissao, data_vencimento, data_pagamento
FROM financeiro_pagar
WHERE data_emissao IS NOT NULL 
  AND (data_emissao < '2020-01-01' OR data_emissao > '2030-12-31')
UNION ALL
SELECT 'receber', id, data_emissao, data_vencimento, data_pagamento
FROM financeiro_receber
WHERE data_emissao IS NOT NULL 
  AND (data_emissao < '2020-01-01' OR data_emissao > '2030-12-31');` },
];

(async () => {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  
  for (const q of queries) {
    console.log('\n' + '='.repeat(80));
    console.log(q.name);
    console.log('='.repeat(80));
    try {
      const res = await client.query(q.sql);
      if (res.rows.length === 0) {
        console.log('(0 rows returned)');
      } else {
        console.table(res.rows);
      }
    } catch(e) {
      console.log('ERROR:', e.message);
    }
  }
  
  await client.end();
  console.log('\n✅ Round 2 complete');
})();
