import pg from 'pg';

const pool = new pg.Pool({
  host: 'aws-1-sa-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.uwrvzsjtpgaifkktpepn',
  password: 'ConexaoExpress_DB_2026!#',
  ssl: { rejectUnauthorized: false }
});

const queries = [
  { id: 'A', title: 'PHANTOM PAGAR (status=pago without baixa)', sql: `
SELECT fp.id, fp.descricao, fp.valor, fp.valor_bruto, fp.valor_liquido, fp.status, 
       fp.fornecedor, fp.fornecedor_id, fp.fornecedor_nome, fp.fornecedor_documento,
       fp.data_vencimento, fp.data_pagamento, fp.data_emissao, fp.os_id, fp.os_vinculada,
       fp.categoria, fp.centro_resultado, fp.plano_conta, fp.conta_pagadora,
       fp.documento, fp.tipo_documento, fp.observacoes, fp.created_at, fp.updated_at,
       CASE WHEN fp.fornecedor_id IS NOT NULL THEN 
         (SELECT nome_completo FROM prestadores WHERE id = fp.fornecedor_id)
       ELSE NULL END as prestador_nome_real
FROM financeiro_pagar fp
WHERE fp.status IN ('pago','paga')
AND NOT EXISTS (
  SELECT 1 FROM financeiro_baixas b 
  WHERE b.titulo_tabela = 'financeiro_pagar' AND b.titulo_id = fp.id AND NOT b.estornada
)
ORDER BY fp.created_at DESC
  `},
  { id: 'B', title: 'PHANTOM RECEBER (status=pago without baixa)', sql: `
SELECT fr.id, fr.descricao, fr.valor, fr.valor_bruto, fr.valor_liquido, fr.status,
       fr.cliente, fr.cliente_id, fr.cliente_nome, fr.cliente_documento,
       fr.data_vencimento, fr.data_pagamento, fr.data_emissao, fr.os_id, fr.fatura_id,
       fr.categoria, fr.centro_resultado, fr.plano_conta, fr.conta_entrada,
       fr.numero, fr.serie, fr.observacoes, fr.created_at, fr.updated_at,
       CASE WHEN fr.cliente_id IS NOT NULL THEN
         (SELECT nome_fantasia FROM clientes WHERE id = fr.cliente_id)
       ELSE NULL END as cliente_nome_real
FROM financeiro_receber fr
WHERE fr.status IN ('pago','paga')
AND NOT EXISTS (
  SELECT 1 FROM financeiro_baixas b 
  WHERE b.titulo_tabela = 'financeiro_receber' AND b.titulo_id = fr.id AND NOT b.estornada
)
ORDER BY fr.created_at DESC
  `},
  { id: 'C', title: 'NULL VALOR RECEBER', sql: `SELECT * FROM financeiro_receber WHERE valor IS NULL` },
  { id: 'D', title: 'NULL STATUS PAGAR', sql: `SELECT * FROM financeiro_pagar WHERE status IS NULL` },
  { id: 'E', title: 'TEST/HOMOLOGATION RECORDS', sql: `
SELECT 'pagar' as tabela, fp.id, fp.descricao, fp.valor, fp.status, fp.fornecedor, 
       fp.fornecedor_id, fp.os_id, fp.categoria, fp.created_at, fp.observacoes
FROM financeiro_pagar fp 
WHERE fp.descricao ILIKE '%TESTE%' OR fp.descricao ILIKE '%HOMOLOGACAO%' OR fp.descricao ILIKE '%SEED%' 
   OR fp.descricao ILIKE '%MOCK%' OR fp.descricao ILIKE '%AUDITORIA%' OR fp.descricao ILIKE '%FIN01%'
   OR fp.descricao ILIKE '%FIN361%' OR fp.descricao ILIKE '%DUPLICATE%'
UNION ALL
SELECT 'receber' as tabela, fr.id, fr.descricao, fr.valor, fr.status, fr.cliente as fornecedor,
       fr.cliente_id as fornecedor_id, fr.os_id, fr.categoria, fr.created_at, fr.observacoes
FROM financeiro_receber fr
WHERE fr.descricao ILIKE '%TESTE%' OR fr.descricao ILIKE '%HOMOLOGACAO%' OR fr.descricao ILIKE '%SEED%'
   OR fr.descricao ILIKE '%MOCK%' OR fr.descricao ILIKE '%AUDITORIA%' OR fr.descricao ILIKE '%FIN01%'
   OR fr.descricao ILIKE '%FIN361%' OR fr.descricao ILIKE '%DUPLICATE%'
ORDER BY created_at DESC
  `},
  { id: 'F', title: 'PAGAMENTOS PRESTADORES (top 20)', sql: `
SELECT pp.*
FROM pagamentos_prestadores pp
WHERE pp.status = 'pago'
ORDER BY pp.created_at DESC
LIMIT 20
  `},
  { id: 'G', title: 'CAMILA / PEREIRA', sql: `
SELECT pp.*
FROM pagamentos_prestadores pp
WHERE pp.prestador_nome ILIKE '%camila%' OR pp.prestador_nome ILIKE '%pereira%'
  `},
  { id: 'H', title: 'CONTAS FINANCEIRAS', sql: `SELECT * FROM contas_financeiras ORDER BY nome` },
  { id: 'I', title: 'CONFIGURACOES_SISTEMA (financial)', sql: `
SELECT chave, valor FROM configuracoes_sistema 
WHERE chave ILIKE '%financ%' OR chave ILIKE '%conta%' OR chave ILIKE '%pagar%' OR chave ILIKE '%receber%'
  `},
  { id: 'J', title: 'BAIXAS (top 20)', sql: `
SELECT b.id, b.titulo_tabela, b.titulo_id, b.valor_baixado, b.valor_original, 
       b.data_baixa, b.estornada, b.conta_financeira_id, b.conta_financeira,
       b.forma_pagamento, b.usuario_nome, b.created_at
FROM financeiro_baixas b
ORDER BY b.created_at DESC
LIMIT 20
  `},
  { id: 'K', title: 'TRANSFERENCIAS', sql: `
SELECT t.*, 
       COALESCE((SELECT nome FROM contas_financeiras WHERE id = t.conta_origem_id), 'N/A') as conta_origem_nome,
       COALESCE((SELECT nome FROM contas_financeiras WHERE id = t.conta_destino_id), 'N/A') as conta_destino_nome
FROM financeiro_transferencias t
ORDER BY t.created_at DESC
  `},
  { id: 'L', title: 'COMPOSICAO FINANCEIRA OS (top 20)', sql: `
SELECT cfo.os_id, cfo.valor_cliente, cfo.valor_prestador, cfo.margem_bruta, 
       cfo.margem_liquida, cfo.percentual_margem_liquida, cfo.outros_custos,
       cfo.pedagio_valor, cfo.imposto_valor, cfo.seguro_valor
FROM composicao_financeira_os cfo
ORDER BY cfo.os_id
LIMIT 20
  `},
  { id: 'M', title: 'FATURAS (top 20)', sql: `
SELECT f.*
FROM faturas f
LIMIT 20
  `},
];

async function run() {
  const client = await pool.connect();
  try {
    for (const q of queries) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`QUERY ${q.id} — ${q.title}`);
      console.log(`${'='.repeat(80)}`);
      try {
        const result = await client.query(q.sql);
        console.log(`Rows: ${result.rows.length}`);
        if (result.rows.length === 0) {
          console.log('(empty)');
        } else {
          // Print header
          const cols = result.fields.map(f => f.name);
          console.log(`Columns: ${cols.join(' | ')}`);
          console.log('-'.repeat(80));
          // Print each row
          for (let i = 0; i < result.rows.length; i++) {
            const row = result.rows[i];
            console.log(`\n--- Row ${i + 1} ---`);
            for (const col of cols) {
              let val = row[col];
              if (val === null || val === undefined) val = 'NULL';
              else if (typeof val === 'object') val = JSON.stringify(val);
              else val = String(val);
              // Truncate long values but show first 500 chars
              if (val.length > 500) val = val.substring(0, 500) + `... [${val.length} chars total]`;
              console.log(`  ${col}: ${val}`);
            }
          }
        }
      } catch (err) {
        console.error(`ERROR: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
