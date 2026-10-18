import pg from 'pg';
const { Client } = pg;

const DATABASE_URL = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

const queries = [
  {
    num: 1,
    name: 'Financeiro Pagar - Status Overview',
    sql: `SELECT status, COUNT(*) as qtd, COALESCE(SUM(valor),0) as total_valor 
FROM financeiro_pagar GROUP BY status ORDER BY qtd DESC`
  },
  {
    num: 2,
    name: 'Financeiro Pagar - Legacy: status=pago/paga WITHOUT baixa',
    sql: `SELECT fp.id, fp.descricao, fp.valor, fp.data_vencimento, fp.data_pagamento, fp.status, 
       fp.fornecedor, fp.fornecedor_id, fp.os_id, fp.categoria, fp.created_at,
       fp.observacoes
FROM financeiro_pagar fp
WHERE fp.status IN ('pago','paga')
AND NOT EXISTS (
  SELECT 1 FROM financeiro_baixas b 
  WHERE b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = fp.id AND NOT b.estornada
)
ORDER BY fp.created_at DESC`
  },
  {
    num: 3,
    name: 'Financeiro Receber - Status Overview',
    sql: `SELECT status, COUNT(*) as qtd, COALESCE(SUM(valor),0) as total_valor 
FROM financeiro_receber GROUP BY status ORDER BY qtd DESC`
  },
  {
    num: 4,
    name: 'Financeiro Receber - Legacy: status=pago/paga WITHOUT baixa',
    sql: `SELECT fr.id, fr.descricao, fr.valor, fr.data_vencimento, fr.data_pagamento, fr.status,
       fr.cliente, fr.cliente_id, fr.os_id, fr.fatura_id, fr.categoria, fr.created_at,
       fr.observacoes
FROM financeiro_receber fr
WHERE fr.status IN ('pago','paga')
AND NOT EXISTS (
  SELECT 1 FROM financeiro_baixas b 
  WHERE b.titulo_tabela = 'financeiro_receber' AND b.titulo_id = fr.id AND NOT b.estornada
)
ORDER BY fr.created_at DESC`
  },
  {
    num: 5,
    name: 'Financeiro Receber with NULL valor',
    sql: `SELECT id, descricao, valor, status, cliente_id, os_id, created_at 
FROM financeiro_receber WHERE valor IS NULL`
  },
  {
    num: 6,
    name: 'Financeiro Pagar with NULL status',
    sql: `SELECT id, descricao, valor, status, fornecedor_id, os_id, created_at 
FROM financeiro_pagar WHERE status IS NULL`
  },
  {
    num: 7,
    name: 'Financeiro Baixas Overview',
    sql: `SELECT titulo_tabela, COUNT(*) as qtd, 
       COALESCE(SUM(valor_baixado),0) as total_baixado,
       SUM(CASE WHEN estornada THEN 1 ELSE 0 END) as estornadas
FROM financeiro_baixas GROUP BY titulo_tabela`
  },
  {
    num: 8,
    name: 'Contas Financeiras',
    sql: `SELECT id, nome, banco, agencia, numero_conta, tipo, saldo, saldo_inicial, ativa, principal
FROM contas_financeiras ORDER BY nome`
  },
  {
    num: 9,
    name: 'Pagamentos Prestadores Overview',
    sql: `SELECT status, COUNT(*) as qtd, COALESCE(SUM(valor_liquido),0) as total
FROM pagamentos_prestadores GROUP BY status ORDER BY qtd DESC`
  },
  {
    num: 10,
    name: 'Faturas Overview',
    sql: `SELECT status, COUNT(*) as qtd, COALESCE(SUM(valor_total),0) as total
FROM faturas GROUP BY status ORDER BY qtd DESC`
  },
  {
    num: 11,
    name: 'Ordens de Servico - financeiro relevance',
    sql: `SELECT COUNT(*) as total_os, 
       SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as concluidas,
       SUM(CASE WHEN valor_cliente IS NOT NULL THEN 1 ELSE 0 END) as com_valor
FROM ordens_servico`
  },
  {
    num: 12,
    name: 'Test/Homologation data search',
    sql: `SELECT 'pagar' as tabela, id, descricao, valor, status, created_at 
FROM financeiro_pagar 
WHERE descricao ILIKE '%TESTE%' OR descricao ILIKE '%HOMOLOGACAO%' OR descricao ILIKE '%SEED%' OR descricao ILIKE '%MOCK%' OR descricao ILIKE '%AUDITORIA%'
UNION ALL
SELECT 'receber' as tabela, id, descricao, valor, status, created_at 
FROM financeiro_receber 
WHERE descricao ILIKE '%TESTE%' OR descricao ILIKE '%HOMOLOGACAO%' OR descricao ILIKE '%SEED%' OR descricao ILIKE '%MOCK%' OR descricao ILIKE '%AUDITORIA%'
ORDER BY created_at DESC`
  },
  {
    num: 13,
    name: 'Transferencias',
    sql: `SELECT COUNT(*) as qtd, COALESCE(SUM(valor),0) as total 
FROM financeiro_transferencias`
  },
  {
    num: 14,
    name: 'Duplicate baixas check',
    sql: `SELECT titulo_tabela, titulo_id, COUNT(*) as qtd 
FROM financeiro_baixas WHERE NOT estornada 
GROUP BY titulo_tabela, titulo_id HAVING COUNT(*) > 1`
  },
  {
    num: 15,
    name: 'Orphan baixas',
    sql: `SELECT b.id, b.titulo_tabela, b.titulo_id, b.valor_baixado, b.data_baixa
FROM financeiro_baixas b
WHERE NOT EXISTS (SELECT 1 FROM financeiro_pagar WHERE id = b.titulo_id)
AND NOT EXISTS (SELECT 1 FROM financeiro_receber WHERE id = b.titulo_id)
LIMIT 20`
  }
];

function pad(str, len) {
  return String(str).padEnd(len);
}

function printTable(rows, columns) {
  if (rows.length === 0) {
    console.log('  (0 rows)\n');
    return;
  }
  const widths = columns.map(col => {
    const maxData = rows.reduce((m, r) => Math.max(m, String(r[col] ?? '').length), 0);
    return Math.max(col.length, maxData);
  });
  const header = columns.map((c, i) => pad(c, widths[i])).join(' | ');
  const sep = widths.map(w => '-'.repeat(w)).join('+-');
  console.log('  ' + header);
  console.log('  ' + sep);
  rows.forEach(row => {
    const line = columns.map((c, i) => pad(row[c] ?? '', widths[i])).join(' | ');
    console.log('  ' + line);
  });
  console.log(`  (${rows.length} rows)\n`);
}

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('=== FINANCIAL AUDIT SCRIPT - READ ONLY ===');
    console.log(`Connected at: ${new Date().toISOString()}\n`);

    for (const q of queries) {
      console.log(`\n========== QUERY ${q.num}: ${q.name} ==========`);
      try {
        const result = await client.query(q.sql);
        if (result.rows.length === 0) {
          console.log('  (0 rows)\n');
          continue;
        }
        const columns = result.fields.map(f => f.name);
        printTable(result.rows, columns);
      } catch (err) {
        console.error(`  ERROR: ${err.message}\n`);
      }
    }

    console.log('\n=== AUDIT COMPLETE ===');
    console.log(`Finished at: ${new Date().toISOString()}`);

  } catch (err) {
    console.error('Connection error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

main();
