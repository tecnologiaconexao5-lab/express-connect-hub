const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const QUERIES = [
  {
    name: 'QUERY 1: financeiro_pagar FRETEBRAS',
    sql: `SELECT id, fornecedor, fornecedor_nome, descricao, documento, data_vencimento, vencimento, 
       valor, valor_bruto, valor_liquido, status, data_pagamento, is_teste, 
       created_at, updated_at, os_id, categoria
FROM financeiro_pagar 
WHERE fornecedor ILIKE '%FRETEBRAS%' OR fornecedor_nome ILIKE '%FRETEBRAS%'
ORDER BY data_vencimento DESC;`
  },
  {
    name: 'QUERY 2: financeiro_pagar vencimento 2026-09-01 to 2026-09-15',
    sql: `SELECT id, fornecedor, fornecedor_nome, descricao, documento, data_vencimento, 
       valor, status, is_teste, os_id
FROM financeiro_pagar 
WHERE data_vencimento BETWEEN '2026-09-01' AND '2026-09-15'
ORDER BY data_vencimento ASC;`
  },
  {
    name: 'QUERY 3: financeiro_pagar status breakdown',
    sql: `SELECT status, COUNT(*) as qtd, SUM(valor) as total_valor 
FROM financeiro_pagar 
GROUP BY status 
ORDER BY qtd DESC;`
  },
  {
    name: 'QUERY 4: financeiro_pagar by is_teste',
    sql: `SELECT is_teste, COUNT(*) as qtd, SUM(valor) as total 
FROM financeiro_pagar 
GROUP BY is_teste;`
  },
  {
    name: 'QUERY 5: financeiro_pagar overdue',
    sql: `SELECT id, fornecedor, fornecedor_nome, data_vencimento, valor, status, is_teste
FROM financeiro_pagar 
WHERE (status IN ('a vencer', 'a_vencer', 'pendente', 'aberto'))
  AND data_vencimento < '2026-09-11'
ORDER BY data_vencimento ASC;`
  },
  {
    name: 'QUERY 6: financeiro_receber status breakdown',
    sql: `SELECT status, COUNT(*) as qtd, SUM(valor) as total_valor 
FROM financeiro_receber 
GROUP BY status 
ORDER BY qtd DESC;`
  },
  {
    name: 'QUERY 7: financeiro_receber by is_teste',
    sql: `SELECT is_teste, COUNT(*) as qtd, SUM(valor) as total 
FROM financeiro_receber 
GROUP BY is_teste;`
  },
  {
    name: 'QUERY 8: financeiro_receber overdue',
    sql: `SELECT id, cliente, cliente_nome, data_vencimento, valor, status, is_teste
FROM financeiro_receber 
WHERE (status IN ('pendente', 'aberto'))
  AND data_vencimento < '2026-09-11'
ORDER BY data_vencimento ASC;`
  },
  {
    name: 'QUERY 9: pg_stat_activity',
    sql: `SELECT pid, usename, application_name, client_addr, state, query, query_start, backend_start, state_change
FROM pg_stat_activity 
WHERE query LIKE '%vencid%' OR query LIKE '%atrasad%' OR query LIKE '%status%'
ORDER BY query_start DESC;`
  },
  {
    name: 'QUERY 10: financeiro_baixas breakdown',
    sql: `SELECT titulo_tabela, COUNT(*) as qtd, SUM(valor_baixado) as total_baixado 
FROM financeiro_baixas 
WHERE estornada = false
GROUP BY titulo_tabela;`
  }
];

async function runAudit() {
  const client = new Client({ connectionString: DATABASE_URL });
  const results = [];
  
  try {
    await client.connect();
    console.log('Connected to Supabase database (READ-ONLY audit)\n');
    
    for (const q of QUERIES) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`  ${q.name}`);
      console.log(`${'='.repeat(80)}`);
      
      try {
        const start = Date.now();
        const res = await client.query(q.sql);
        const elapsed = Date.now() - start;
        
        console.log(`(${res.rows.length} rows, ${elapsed}ms)\n`);
        
        if (res.rows.length === 0) {
          console.log('  (no rows returned)\n');
        } else {
          // Print as formatted table
          console.table(res.rows.map(row => {
            const formatted = {};
            for (const [k, v] of Object.entries(row)) {
              if (v === null) formatted[k] = 'NULL';
              else if (typeof v === 'string' && v.length > 80) formatted[k] = v.substring(0, 77) + '...';
              else formatted[k] = v;
            }
            return formatted;
          }));
        }
        
        results.push({ name: q.name, rowCount: res.rows.length, rows: res.rows, elapsed });
      } catch (err) {
        console.error(`  ERROR: ${err.message}`);
        results.push({ name: q.name, error: err.message });
      }
    }
    
    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('  AUDIT SUMMARY');
    console.log(`${'='.repeat(80)}`);
    for (const r of results) {
      if (r.error) {
        console.log(`  ❌ ${r.name}: ERROR — ${r.error}`);
      } else {
        console.log(`  ✅ ${r.name}: ${r.rowCount} rows (${r.elapsed}ms)`);
      }
    }
    
  } catch (err) {
    console.error('Connection error:', err.message);
  } finally {
    await client.end();
    console.log('\nConnection closed. READ-ONLY audit complete.');
  }
}

runAudit();
