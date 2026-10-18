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

  console.log('=== AUDITORIA OPERACIONAL COMPLETA - CONEXAO EXPRESS TMS ===\n');

  // 1. LISTAR TABELAS PRINCIPAIS
  const tables = await client.query(`
    SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
      (SELECT reltuples::bigint FROM pg_class WHERE oid = quote_ident(table_name)::regclass) as rows_estimate
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
    ORDER BY table_name
  `);
  console.log('TABELAS (' + tables.rows.length + '):');
  tables.rows.forEach(r => console.log('  ' + r.table_name + ' | ' + r.size + ' | ~' + (r.rows_estimate||0) + ' linhas'));

  // 2. CLIENTES
  console.log('\n=== CLIENTES ===');
  const clientes = await client.query('SELECT count(*) as total, count(*) filter (where status=\'ativo\') as ativos FROM clientes');
  console.log('Total:', clientes.rows[0].total, '| Ativos:', clientes.rows[0].ativos);
  const cliSample = await client.query('SELECT id, razao_social, cnpj_cpf, status, created_at FROM clientes ORDER BY created_at DESC LIMIT 3');
  cliSample.rows.forEach(r => console.log('  ID:', r.id, '| Razao:', r.razao_social, '| CNPJ:', r.cnpj_cpf, '| Status:', r.status, '| Criado:', r.created_at));

  // 3. ORDENS DE SERVICO
  console.log('\n=== ORDENS DE SERVICO ===');
  const os = await client.query('SELECT count(*) as total FROM ordens_servico WHERE deleted_at IS NULL');
  console.log('Total (nao deletadas):', os.rows[0].total);
  const osStatus = await client.query('SELECT status, count(*) FROM ordens_servico WHERE deleted_at IS NULL GROUP BY status ORDER BY count DESC');
  console.log('Por status:');
  osStatus.rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));
  const osSample = await client.query('SELECT id, cliente, status, created_at FROM ordens_servico WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 3');
  osSample.rows.forEach(r => console.log('  ID:', r.id, '| Cliente:', r.cliente, '| Status:', r.status, '| Criado:', r.created_at));

  // 4. PRESTADORES  
  console.log('\n=== PRESTADORES ===');
  const prest = await client.query('SELECT count(*) as total FROM prestadores');
  console.log('Total:', prest.rows[0].total);
  const prestStatus = await client.query('SELECT status, count(*) FROM prestadores GROUP BY status ORDER BY count DESC');
  prestStatus.rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));

  // 5. VEICULOS
  console.log('\n=== VEICULOS ===');
  const veic = await client.query('SELECT count(*) as total FROM veiculos');
  console.log('Total:', veic.rows[0].total);
  const veicStatus = await client.query('SELECT status, count(*) FROM veiculos GROUP BY status ORDER BY count DESC');
  veicStatus.rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));

  // 6. ALOCACOES_ESCALA
  console.log('\n=== ESCALA (alocacoes_escala) ===');
  const aloc = await client.query('SELECT count(*) as total FROM alocacoes_escala');
  console.log('Total:', aloc.rows[0].total);
  const alocStatus = await client.query("SELECT status, count(*) FROM alocacoes_escala GROUP BY status ORDER BY count DESC");
  alocStatus.rows.forEach(r => console.log('  ' + r.status + ': ' + r.count));
  // Orfaos
  const alocOrfaos = await client.query("SELECT count(*) FROM alocacoes_escala WHERE prestador_id IS NULL OR cliente_id IS NULL");
  console.log('Alocacoes sem prestador_id ou cliente_id:', alocOrfaos.rows[0].count);
  const alocSample = await client.query("SELECT id, os_vinculada, prestador_id, cliente_id, status, created_at FROM alocacoes_escala ORDER BY created_at DESC LIMIT 3");
  alocSample.rows.forEach(r => console.log('  ID:', r.id, '| OS:', r.os_vinculada, '| Prestador:', r.prestador_id, '| Cliente:', r.cliente_id, '| Status:', r.status));

  // 7. TRACKING
  console.log('\n=== TRACKING ===');
  const trackTables = ['operacao_localizacao', 'portal_tracking_realtime', 'tracking_eventos', 'tracking_links'];
  for (const t of trackTables) {
    const exists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [t]);
    if (exists.rows[0].cnt > 0) {
      const cnt = await client.query('SELECT count(*) as total FROM ' + t);
      const sample = await client.query('SELECT * FROM ' + t + ' LIMIT 1');
      console.log('  ' + t + ': ' + cnt.rows[0].total + ' registros');
      if (cnt.rows[0].total > 0) console.log('    Exemplo:', JSON.stringify(sample.rows[0]));
    } else {
      console.log('  ' + t + ': TABELA NAO EXISTE');
    }
  }

  // 8. POD - entregas_protocolo
  console.log('\n=== POD (entregas_protocolo) ===');
  const podExists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='entregas_protocolo'");
  if (podExists.rows[0].cnt > 0) {
    const pod = await client.query('SELECT count(*) as total FROM entregas_protocolo');
    console.log('Total:', pod.rows[0].total);
    const podSample = await client.query('SELECT id, alocacao_id, nome_recebedor, data_hora_entrega, foto_entrega_url FROM entregas_protocolo ORDER BY data_hora_entrega DESC LIMIT 3');
    podSample.rows.forEach(r => console.log('  ID:', r.id, '| Alocacao:', r.alocacao_id, '| Recebedor:', r.nome_recebedor, '| Data:', r.data_hora_entrega));
  } else {
    console.log('  TABELA NAO EXISTE');
  }

  // 9. FINANCEIRO
  console.log('\n=== FINANCEIRO ===');
  for (const t of ['financeiro_receber', 'financeiro_pagar', 'pagamentos_prestadores', 'composicao_financeira_os']) {
    const exists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [t]);
    if (exists.rows[0].cnt > 0) {
      const cnt = await client.query('SELECT count(*) as total FROM ' + t);
      console.log('  ' + t + ': ' + cnt.rows[0].total + ' registros');
      if (cnt.rows[0].total > 0 && t !== 'composicao_financeira_os') {
        const s = await client.query('SELECT * FROM ' + t + ' LIMIT 1');
        console.log('    Exemplo:', JSON.stringify(s.rows[0]));
      }
    } else {
      console.log('  ' + t + ': TABELA NAO EXISTE');
    }
  }

  // 10. PORTAL CLIENTE
  console.log('\n=== PORTAL CLIENTE ===');
  for (const t of ['portal_pedidos', 'portal_ocorrencias', 'portal_avaliacoes', 'portal_notificacoes', 'portal_faturas', 'portal_protocolos', 'portal_rotas', 'portal_preferencias_cliente']) {
    const exists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name=$1", [t]);
    if (exists.rows[0].cnt > 0) {
      const cnt = await client.query('SELECT count(*) as total FROM ' + t);
      console.log('  ' + t + ': ' + cnt.rows[0].total + ' registros');
    } else {
      console.log('  ' + t + ': TABELA NAO EXISTE');
    }
  }

  // 11. ESCALA_OPERACIONAL (legado)
  const eoExists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='escala_operacional'");
  if (eoExists.rows[0].cnt > 0) {
    const eo = await client.query('SELECT count(*) as total FROM escala_operacional');
    console.log('\nescala_operacional (legado):', eo.rows[0].total, 'registros');
  }

  // 12. OS_POD (alternativo)
  const ospExists = await client.query("SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_schema='public' AND table_name='os_pod'");
  if (ospExists.rows[0].cnt > 0) {
    const osp = await client.query('SELECT count(*) as total FROM os_pod');
    console.log('os_pod (alternativo):', osp.rows[0].total, 'registros');
  }

  // 13. USUARIOS / TENANTS
  console.log('\n=== AUTENTICACAO ===');
  const authUsers = await client.query("SELECT count(*) as total FROM auth.users");
  console.log('Auth users:', authUsers.rows[0].total);
  const tenUsers = await client.query("SELECT count(*) as total FROM tenant_usuarios");
  console.log('Tenant usuarios:', tenUsers.rows[0].total);
  const tenants = await client.query("SELECT id, nome, cnpj, created_at FROM tenants ORDER BY created_at DESC LIMIT 5");
  console.log('Tenants:');
  tenants.rows.forEach(r => console.log('  ID:', r.id, '| Nome:', r.nome, '| CNPJ:', r.cnpj));

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}