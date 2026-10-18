import pg from 'pg';
const { Client } = pg;

const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const queries = [
  { name: '1. Financeiro_pagar - value integrity', sql: `
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN valor < 0 THEN 1 ELSE 0 END) as negativos,
  SUM(CASE WHEN valor IS NULL THEN 1 ELSE 0 END) as nulos,
  SUM(CASE WHEN valor = 0 THEN 1 ELSE 0 END) as zeros,
  SUM(CASE WHEN valor > 100000 THEN 1 ELSE 0 END) as acima_100k,
  MIN(valor) as min_valor,
  MAX(valor) as max_valor,
  ROUND(AVG(valor)::numeric, 2) as media_valor
FROM financeiro_pagar;` },

  { name: '2. Financeiro_receber - value integrity', sql: `
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN valor < 0 THEN 1 ELSE 0 END) as negativos,
  SUM(CASE WHEN valor IS NULL THEN 1 ELSE 0 END) as nulos,
  SUM(CASE WHEN valor = 0 THEN 1 ELSE 0 END) as zeros,
  SUM(CASE WHEN valor > 100000 THEN 1 ELSE 0 END) as acima_100k,
  MIN(valor) as min_valor,
  MAX(valor) as max_valor
FROM financeiro_receber;` },

  { name: '3. Date integrity - impossible dates', sql: `
SELECT 'pagar' as tabela, id, data_vencimento, data_emissao, data_pagamento
FROM financeiro_pagar
WHERE data_vencimento IS NOT NULL 
  AND (data_vencimento < '2020-01-01' OR data_vencimento > '2030-12-31')
UNION ALL
SELECT 'receber', id, data_vencimento, data_emissao, data_pagamento
FROM financeiro_receber
WHERE data_vencimento IS NOT NULL 
  AND (data_vencimento < '2020-01-01' OR data_vencimento > '2030-12-31');` },

  { name: '4. Data pagamento before data_vencimento (pagar)', sql: `
SELECT 'pagar' as tabela, id, fornecedor, data_vencimento, data_pagamento, status
FROM financeiro_pagar
WHERE data_pagamento IS NOT NULL AND data_vencimento IS NOT NULL
  AND data_pagamento < data_vencimento
LIMIT 10;` },

  { name: '5. FK integrity - financeiro_pagar orfas os_id', sql: `
SELECT COUNT(*) as orfas_os
FROM financeiro_pagar fp
WHERE fp.os_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ordens_servico os WHERE os.id = fp.os_id);` },

  { name: '6. FK integrity - financeiro_receber orfas os_id', sql: `
SELECT COUNT(*) as orfas_os
FROM financeiro_receber fr
WHERE fr.os_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM ordens_servico os WHERE os.id = fr.os_id);` },

  { name: '7. Tenant_id presence', sql: `
SELECT 'pagar' as tabela, 
  SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END) as sem_tenant,
  SUM(CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END) as com_tenant
FROM financeiro_pagar
UNION ALL
SELECT 'receber',
  SUM(CASE WHEN tenant_id IS NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN tenant_id IS NOT NULL THEN 1 ELSE 0 END)
FROM financeiro_receber;` },

  { name: '8. is_teste distribution', sql: `
SELECT 'pagar' as tabela, is_teste, COUNT(*) as qtd, SUM(valor) as total
FROM financeiro_pagar GROUP BY is_teste
UNION ALL
SELECT 'receber', is_teste, COUNT(*), SUM(valor)
FROM financeiro_receber GROUP BY is_teste;` },

  { name: '9a. Status pago sem data_pagamento (pagar)', sql: `
SELECT 'pagar' as tabela, id, fornecedor, status, data_pagamento, data_baixa, valor
FROM financeiro_pagar
WHERE status IN ('pago', 'paga')
  AND data_pagamento IS NULL
  AND data_baixa IS NULL
LIMIT 10;` },

  { name: '9b. Status pago sem data_pagamento (receber)', sql: `
SELECT 'receber' as tabela, id, cliente, status, data_pagamento, data_recebimento, valor
FROM financeiro_receber
WHERE status IN ('pago', 'paga', 'recebido')
  AND data_pagamento IS NULL
  AND data_recebimento IS NULL
LIMIT 10;` },

  { name: '10. Duplicatas pagar (fornecedor+data+valor)', sql: `
SELECT fornecedor, data_vencimento, valor, COUNT(*) as duplicatas
FROM financeiro_pagar
WHERE fornecedor IS NOT NULL
GROUP BY fornecedor, data_vencimento, valor
HAVING COUNT(*) > 1
ORDER BY duplicatas DESC
LIMIT 10;` }
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
  console.log('\n✅ Audit complete — all queries READ-ONLY');
})();
