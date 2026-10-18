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

  // ESCALA OPERACIONAL LEGADO
  console.log('=== ESCALA OPERACIONAL (legado) ===');
  const eo = await client.query('SELECT count(*) as total FROM escala_operacional');
  console.log('Total:', eo.rows[0].total);
  if (eo.rows[0].total > 0) {
    const eoD = await client.query('SELECT * FROM escala_operacional ORDER BY data_operacao DESC LIMIT 10');
    eoD.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| OS:', r.os_id?.slice(0,8), '| prest:', r.prestador_id?.slice(0,8), '|', r.placa, '|', r.data_operacao, '|', r.status));
  }

  // DELIVERY PROOFS
  console.log('\n=== DELIVERY PROOFS ===');
  const dp = await client.query('SELECT count(*) as total FROM delivery_proofs');
  console.log('Total:', dp.rows[0].total);
  if (dp.rows[0].total > 0) {
    const dpD = await client.query('SELECT * FROM delivery_proofs LIMIT 5');
    dpD.rows.forEach(r => console.log(' ', JSON.stringify(r)));
  }

  // OS_POD
  console.log('\n=== OS_POD ===');
  const op = await client.query('SELECT count(*) as total FROM os_pod');
  console.log('Total:', op.rows[0].total);
  if (op.rows[0].total > 0) {
    const opD = await client.query('SELECT * FROM os_pod LIMIT 5');
    opD.rows.forEach(r => console.log(' ', JSON.stringify(r)));
  }

  // EVENTOS OFICIAIS
  console.log('\n=== EVENTOS OFICIAIS ===');
  const ev = await client.query('SELECT count(*) as total FROM eventos_oficiais');
  console.log('Total:', ev.rows[0].total);
  const evTipo = await client.query('SELECT tipo, count(*) FROM eventos_oficiais GROUP BY tipo ORDER BY count DESC');
  evTipo.rows.forEach(r => console.log(' ', r.tipo + ':', r.count));
  const evDest = await client.query('SELECT id, tipo, alocacao_id, prestador_id, created_at, origem FROM eventos_oficiais ORDER BY created_at DESC LIMIT 5');
  evDest.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.tipo, '| aloc:', r.alocacao_id?.slice(0,8), '| prest:', r.prestador_id?.slice(0,8), '|', r.created_at, '| origem:', r.origem));

  // TENANTS
  console.log('\n=== TENANTS ===');
  const ten = await client.query('SELECT id, nome, cnpj, created_at FROM tenants');
  console.log('Tenants:', ten.rows.length);
  ten.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.nome, '|', r.cnpj, '|', r.created_at));

  // AUTH USERS
  console.log('\n=== AUTH USERS ===');
  const au = await client.query("SELECT count(*) as total FROM auth.users");
  console.log('Total auth.users:', au.rows[0].total);
  const auDet = await client.query("SELECT id, email, created_at, last_sign_in_at, raw_user_meta_data FROM auth.users ORDER BY created_at");
  auDet.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.email, '| created:', r.created_at, '| last_login:', r.last_sign_in_at, '| meta:', JSON.stringify(r.raw_user_meta_data)));

  // TENANT_USUARIOS
  console.log('\n=== TENANT_USUARIOS ===');
  const tu = await client.query('SELECT tu.id, tu.user_id, tu.tenant_id, tu.papel, t.nome as tenant_nome FROM tenant_usuarios tu LEFT JOIN tenants t ON tu.tenant_id = t.id');
  console.log('Total:', tu.rows.length);
  tu.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| user:', r.user_id?.slice(0,8), '| tenant:', r.tenant_nome||r.tenant_id?.slice(0,8), '| papel:', r.papel));

  // PORTAL TABELAS DETALHADAS
  console.log('\n=== PORTAL CLIENTE - DETALHADO ===');
  const pp = await client.query('SELECT id, cliente_id, numero_pedido, status, os_vinculada_id, created_at, converted_at, processado_em FROM portal_pedidos ORDER BY created_at DESC');
  console.log('portal_pedidos:', pp.rows.length, 'registros:');
  pp.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '| cliente:', r.cliente_id?.slice(0,8), '| pedido:', r.numero_pedido||'NULO', '| status:', r.status, '| OS:', r.os_vinculada_id?.slice(0,8)||'NENHUMA', '| convertido:', r.converted_at, '| processado:', r.processado_em));

  // TENTAR VERIFICAR O FLUXO REAL: CLIENTE DVL
  console.log('\n=== FLUXO COMPLETO: DVL ===');
  const dvlId = 'c4ee38d6';
  console.log('Cliente DVL:', dvlId);
  const dvlOS = await client.query("SELECT id, numero, status, data, created_at FROM ordens_servico WHERE cliente=$1 OR cliente_id=$2", [dvlId, dvlId]);
  console.log('OS da DVL:', dvlOS.rows.length);
  dvlOS.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.numero, '|', r.status, '|', r.data));

  const dvlAloc = await client.query("SELECT id, data_escala, status, prestador_id, ordem_servico_id FROM alocacoes_escala WHERE cliente_id=$1", [dvlId]);
  console.log('Alocacoes DVL:', dvlAloc.rows.length);
  dvlAloc.rows.forEach(r => console.log(' ', r.id?.slice(0,8), '|', r.data_escala, '|', r.status, '| prest:', r.prestador_id?.slice(0,8), '| OS:', r.ordem_servico_id?.slice(0,8)));

  const dvlFin = await client.query("SELECT id, descricao, valor, status FROM financeiro_receber WHERE cliente_id=$1 OR cliente=$2", [dvlId, dvlId]);
  console.log('Financeiro DVL:', dvlFin.rows.length);

  const dvlPod = await client.query("SELECT ep.id FROM entregas_protocolo ep JOIN alocacoes_escala a ON ep.alocacao_id = a.id WHERE a.cliente_id=$1", [dvlId]);
  console.log('POD DVL:', dvlPod.rows.length);

  // TENTAR VERIFICAR O FLUXO REAL: CLIENTE CYDAK
  console.log('\n=== FLUXO COMPLETO: CYDAK ===');
  const cydakId = '1baf3223';
  const cydakOS = await client.query("SELECT id, numero, status FROM ordens_servico WHERE cliente=$1", [cydakId]);
  console.log('OS da Cydak:', cydakOS.rows.length);
  const cydakAloc = await client.query("SELECT id, data_escala, status, prestador_id FROM alocacoes_escala WHERE cliente_id=$1", [cydakId]);
  console.log('Alocacoes Cydak:', cydakAloc.rows.length);
  const cydakFin = await client.query("SELECT id, valor, status FROM financeiro_receber WHERE cliente_id=$1", [cydakId]);
  console.log('Financeiro Cydak:', cydakFin.rows.length);

  // ALOCACOES COM VALORES FINANCEIROS
  console.log('\n=== ALOCACOES COM VALORES FINANCEIROS !===');
  const alocVal = await client.query("SELECT count(*) FROM alocacoes_escala WHERE (valor_frete IS NOT NULL AND valor_frete > 0) OR (valor_repasse IS NOT NULL AND valor_repasse > 0)");
  console.log('Alocacoes com valor_frete > 0 ou valor_repasse > 0:', alocVal.rows[0].count);

  // PRESTADORES REAIS MAIS USADOS
  console.log('\n=== PRESTADORES MAIS USADOS (em alocacoes) ===');
  const topPrest = await client.query(`
    SELECT a.prestador_id, p.nome_completo, count(*) as qtd
    FROM alocacoes_escala a
    LEFT JOIN prestadores p ON a.prestador_id = p.id
    WHERE a.prestador_id IS NOT NULL
    GROUP BY a.prestador_id, p.nome_completo
    ORDER BY qtd DESC LIMIT 10
  `);
  topPrest.rows.forEach(r => console.log(' ', r.prestador_id?.slice(0,8), '|', r.nome_completo, '|', r.qtd, 'alocacoes'));

  await client.end();
} catch (err) {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
}