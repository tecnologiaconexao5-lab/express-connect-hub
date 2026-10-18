const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

const TABELAS = [
  'alocacoes_escala', 'ordens_servico', 'escala_operacional',
  'financeiro_receber', 'financeiro_pagar',
  'pagamento_prestadores', 'pagamentos_prestadores', 'pagamentos_prestadores_itens',
  'composicao_financeira', 'composicao_financeira_os',
  'tabelas_valores', 'tabela_valores', 'tabela_prestador', 'tabela_prestador_operacional',
  'delivery_proofs', 'entregas_protocolo', 'os_pod',
  'fiscal_ctes', 'fiscal_nfse', 'fiscal_mdfes', 'fiscal_documentos_vinculados',
  'reembolsos_prestador', 'despesas_operacionais', 'portal_faturas',
  'clientes_contratos', 'regras_fiscais_cte', 'regras_fiscais_nfse',
  'operation_km', 'historico_alocacoes_escala', 'os_historico',
  'configuracoes_fiscais', 'certificados_fiscais', 'centros_custo', 'unidades', 'filiais',
];

(async () => {
  await client.connect();
  for (const t of TABELAS) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position`, [t]);
    if (!cols.rows.length) { console.log(`\n### ${t}: NAO EXISTE`); continue; }
    console.log(`\n### ${t} (${cols.rows.length} cols)`);
    cols.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type}${r.is_nullable==='NO'?' NOT NULL':''}${r.column_default? ' = '+r.column_default : ''}`));

    const fks = await client.query(`
      SELECT conname, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid=con.conrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=$1 AND con.contype IN ('f','u','p')
      ORDER BY con.contype, con.conname`, [t]);
    fks.rows.forEach(r => console.log(`  [${r.conname}] ${r.def}`));
  }
  await client.end();
})().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });