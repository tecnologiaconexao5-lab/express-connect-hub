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

  // FISCAL
  console.log('=== FISCAL ===');
  const cteCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='fiscal_ctes' ORDER BY ordinal_position");
  console.log('fiscal_ctes colunas:', cteCols.rows.map(c => c.column_name).join(', '));
  const cteS = await client.query('SELECT * FROM fiscal_ctes ORDER BY created_at DESC LIMIT 5');
  cteS.rows.forEach(r => console.log(' ', JSON.stringify(r).slice(0, 300)));
  
  const nfseS = await client.query('SELECT count(*) as total FROM fiscal_nfse');
  console.log('fiscal_nfse total:', nfseS.rows[0].total);
  
  // DOCUMENTOS PRESTADORES
  const docsP = await client.query('SELECT id, prestador_id, tipo, status, created_at FROM documentos_prestadores ORDER BY created_at DESC LIMIT 10');
  console.log('\ndocumentos_prestadores:', docsP.rows.length);
  docsP.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| prest:', r.prestador_id?.slice(0,8), '|', r.tipo, '|', r.status));

  // CLIENTES CONTRATOS
  const cc = await client.query('SELECT id, cliente_id, numero, tipo, status, created_at FROM clientes_contratos ORDER BY created_at DESC LIMIT 10');
  console.log('\nclientes_contratos:', cc.rows.length);
  cc.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_id?.slice(0,8), '|', r.numero, '|', r.tipo, '|', r.status));

  // ORCAMENTOS
  const orcS = await client.query('SELECT id, cliente_id, numero, status, valor_total, created_at FROM orcamentos ORDER BY created_at DESC LIMIT 5');
  console.log('\norcamentos:', orcS.rows.length);
  orcS.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_id?.slice(0,8), '|', r.numero, '|', r.status, '| R$', r.valor_total));

  // CHECK ROTA
  const rotas = await client.query('SELECT count(*) as total FROM rotas');
  console.log('\nrotas:', rotas.rows[0].total);
  const rotaP = await client.query('SELECT count(*) as total FROM rota_paradas');
  console.log('rota_paradas:', rotaP.rows[0].total);

  // IA LOGS
  const iaLogs = await client.query('SELECT count(*) as total FROM automacoes_logs');
  console.log('\nautomacoes_logs:', iaLogs.rows[0].total);
  const iaExec = await client.query('SELECT count(*) as total FROM ia_execucoes_ferramentas');
  console.log('ia_execucoes_ferramentas:', iaExec.rows[0].total);

  // SUMMARY - TABELAS CHAVE COM STATUS
  console.log('\n\n========================================');
  console.log('RESUMO FINAL - TABELAS OPERACIONAIS');
  console.log('========================================');
  const checkTables = [
    'clientes', 'ordens_servico', 'prestadores', 'veiculos',
    'alocacoes_escala', 'historico_alocacoes_escala',
    'entregas_protocolo', 'delivery_proofs',
    'operacao_localizacao', 'portal_tracking_realtime',
    'tracking_public_links', 'eventos_oficiais',
    'financeiro_receber', 'financeiro_pagar', 'pagamentos_prestadores',
    'composicao_financeira_os',
    'portal_pedidos', 'portal_ocorrencias', 'portal_avaliacoes',
    'portal_notificacoes', 'portal_faturas', 'portal_protocolos',
    'fiscal_ctes', 'fiscal_nfse', 'fiscal_mdfes',
    'clientes_contratos', 'orcamentos', 'contratos_operacao',
    'crm_leads', 'crm_conversas', 'crm_mensagens'
  ];

  for (const t of checkTables) {
    const exists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [t]);
    if (exists.rows[0].cnt > 0) {
      const cnt = await client.query('SELECT count(*) FROM ' + t);
      console.log('  ' + t.padEnd(35) + '| ' + String(cnt.rows[0].count).padStart(6) + ' registros');
    } else {
      console.log('  ' + t.padEnd(35) + '| TABLE NOT FOUND');
    }
  }

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}