// [READ-ONLY] TMS-FIN-DATA-04D3C4 — somente SELECT; credencial via env; sem fallback PROD.
import pg from 'pg';
const { Client } = pg;

// TMS-FIN-DATA-04D3C4 — READ-ONLY. Credencial SOMENTE via env explicita; sem fallback para .env PROD.
const DATABASE_URL = process.env.AUDIT_DATABASE_URL || process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[FAIL-CLOSED] Defina AUDIT_DATABASE_URL (ou DATABASE_URL). Nenhuma conexao foi feita.');
  process.exit(1);
}
const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  // DESCOBRIR COLUNAS DAS TABELAS PRINCIPAIS
  const tablesToCheck = ['clientes', 'ordens_servico', 'prestadores', 'veiculos', 'alocacoes_escala', 
    'entregas_protocolo', 'financeiro_receber', 'financeiro_pagar', 'pagamentos_prestadores',
    'composicao_financeira_os', 'escala_operacional', 'portal_pedidos', 'portal_ocorrencias',
    'portal_tracking_realtime', 'operacao_localizacao', 'tracking_public_links'];

  for (const t of tablesToCheck) {
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema='public' AND table_name=$1
      ORDER BY ordinal_position
    `, [t]);
    if (cols.rows.length === 0) {
      console.log(t + ': TABLE NOT FOUND');
    } else {
      console.log('\n' + t.toUpperCase() + ' (' + cols.rows.length + ' colunas):');
      cols.rows.forEach(c => console.log('  ' + c.column_name + ' (' + c.data_type + ', nullable=' + c.is_nullable + ')'));
    }
  }

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}