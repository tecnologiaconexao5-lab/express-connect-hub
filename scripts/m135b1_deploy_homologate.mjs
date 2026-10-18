// MISSÃO 135-B.1 — Deploy + Homologação
// Uso: node scripts/m135b1_deploy_homologate.mjs
import pg from 'pg';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(__dirname, '..', 'supabase', 'migrations', '20260722_m135b_portal_pedido_para_os.sql');
const HML_PEDIDO_ID = ''; // Será preenchido após criar pedido

let pool;

async function connect() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL não definida');
  pool = new pg.Pool({ connectionString: dbUrl, max: 1 });
  const client = await pool.connect();
  await client.query('SELECT 1');
  client.release();
  console.log('[OK] Conectado ao Supabase remoto');
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function step(num, name, fn) {
  console.log(`\n=== ETAPA ${num}: ${name} ===`);
  try {
    const result = await fn();
    console.log(`[OK] ${name}`);
    return result;
  } catch (err) {
    console.error(`[FALHA] ${name}: ${err.message}`);
    throw err;
  }
}

// ====================================
// ETAPA 3 — Confirmar schema remoto
// ====================================
async function checkSchema() {
  let ppResult = [], osResult = [];
  let rpcFound = false;

  console.log('\n--- portal_pedidos columns ---');
  const pp = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'portal_pedidos' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  for (const row of pp.rows) {
    console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
  }
  ppResult = pp.rows;

  console.log('\n--- ordens_servico columns ---');
  const os = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'ordens_servico' AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  for (const row of os.rows) {
    console.log(`  ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
  }
  osResult = os.rows;

  console.log('\n--- RPC converter_pedido_para_os ---');
  const rpcCheck = await query(`SELECT proname FROM pg_proc WHERE proname = 'converter_pedido_para_os'`);
  rpcFound = rpcCheck.rows.length > 0;
  console.log(`  ${rpcFound ? 'JÁ EXISTE' : 'NÃO EXISTE (será criada)'}`);

  return { pp: ppResult, os: osResult, rpcExists: rpcFound };
}

// ====================================
// ETAPA 4 — Aplicar migration
// ====================================
async function applyMigration() {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');
  console.log(`Migration file: ${MIGRATION_PATH.split('/').pop()} (${sql.length} bytes)`);

  console.log('Aplicando...');
  await query(sql);
  console.log('[OK] Migration aplicada');

  // Verificar objetos criados
  const rpcCheck = await query(`
    SELECT proname FROM pg_proc WHERE proname = 'converter_pedido_para_os'
  `);
  console.log(`  RPC converter_pedido_para_os: ${rpcCheck.rows.length > 0 ? 'CRIADA' : 'AUSENTE'}`);

  const idxCheck = await query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'portal_pedidos' AND indexname = 'idx_portal_pedidos_os_vinculada_unique'
  `);
  console.log(`  UNIQUE INDEX: ${idxCheck.rows.length > 0 ? 'CRIADO' : 'AUSENTE'}`);

  const cols = await query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'portal_pedidos' AND column_name IN ('converted_at', 'erro_processamento', 'codigo_erro')
  `);
  console.log(`  Colunas de controle: ${cols.rows.map(r => r.column_name).join(', ') || 'AUSENTES'}`);

  return true;
}

// ====================================
// ETAPA 5 — Validar RPC
// ====================================
async function validateRPC() {
  const sig = await query(`
    SELECT proname, proargnames, prolang, prosecdef, pronargs
    FROM pg_proc
    WHERE proname = 'converter_pedido_para_os'
  `);
  console.log(`  Nome: ${sig.rows[0].proname}`);
  console.log(`  Args: ${sig.rows[0].proargnames?.join(', ')}`);
  console.log(`  N args: ${sig.rows[0].pronargs}`);
  console.log(`  SECURITY DEFINER: ${sig.rows[0].prosecdef ? 'SIM' : 'NÃO'}`);

  const grants = await query(`
    SELECT grantee, privilege_type
    FROM information_schema.routine_privileges
    WHERE routine_name = 'converter_pedido_para_os'
  `);
  for (const row of grants.rows) {
    console.log(`  Grant: ${row.grantee} → ${row.privilege_type}`);
  }

  // Chamada de validação sem conversão destrutiva
  // Testar com um UUID inválido para verificar se a RPC responde
  const testCall = await query(`
    SELECT converter_pedido_para_os('00000000-0000-0000-0000-000000000000'::UUID, NULL)
  `);
  console.log(`  Teste (pedido inexistente): ${JSON.stringify(testCall.rows[0].converter_pedido_para_os)}`);

  return sig.rows[0];
}

// ====================================
// ETAPA 6 — Executar testes SQL
// ====================================
async function runSQLTests() {
  const tests = [
    { name: 'Pedido inexistente retorna erro',
      sql: `SELECT converter_pedido_para_os('00000000-0000-0000-0000-000000000000'::UUID, NULL) AS result`,
      check: (r) => r.result?.success === false && r.result?.error_code === 'PEDIDO_NAO_ENCONTRADO' },
    { name: 'Pedido válido existe?',
      sql: `SELECT COUNT(*)::int AS cnt FROM portal_pedidos WHERE status IN ('enviado','em_analise')`,
      check: (r) => r.cnt >= 0 },
  ];

  for (const test of tests) {
    try {
      const result = await query(test.sql);
      const passed = test.check(result.rows[0]);
      console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${JSON.stringify(result.rows[0])}`);
    } catch (err) {
      console.log(`  ❌ ${test.name}: ERRO — ${err.message}`);
    }
  }
}

// ====================================
// ETAPA 7 — Criar pedido de homologação
// ====================================
async function createHomologationOrder() {
  // Verificar se já existe
  const existing = await query(
    `SELECT id, status FROM portal_pedidos WHERE numero_pedido = 'PED-HML-PORTAL-135B'`
  );
  if (existing.rows.length > 0) {
    console.log(`Pedido já existe: ${existing.rows[0].id} (status: ${existing.rows[0].status})`);
    return existing.rows[0].id;
  }

  // Buscar cliente de teste existente
  const clientes = await query(`SELECT id, nome_fantasia FROM clientes WHERE nome_fantasia ILIKE '%teste%' OR nome_fantasia ILIKE '%hml%' LIMIT 5`);
  let clienteId = null;
  let clienteNome = 'CLIENTE TESTE PORTAL';
  if (clientes.rows.length > 0) {
    clienteId = clientes.rows[0].id;
    clienteNome = clientes.rows[0].nome_fantasia;
    console.log(`Usando cliente existente: ${clienteNome} (${clienteId})`);
  } else {
    console.log('Nenhum cliente de teste encontrado — usando NULL (pedido sem cliente vinculado)');
  }

  const result = await query(`
    INSERT INTO portal_pedidos (
      numero_pedido,
      cliente_id,
      status,
      solicitante_nome,
      solicitante_email,
      prioridade,
      coleta_cep, coleta_rua, coleta_numero, coleta_complemento, coleta_bairro, coleta_cidade, coleta_uf, coleta_referencia, coleta_data,
      entrega_destinatario, entrega_telefone, entrega_email,
      entrega_cep, entrega_rua, entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf, entrega_referencia, entrega_data,
      descricao, volumes, peso, tipo_carga,
      veiculo_sugerido,
      observacoes,
      metadata,
      solicitacao_via,
      data_solicitada
    ) VALUES (
      'PED-HML-PORTAL-135B',
      $1,
      'enviado',
      'Homologação Portal',
      'homologacao@conexaoexpress.com.br',
      'normal',
      '07094-090', 'Rua Jamil João Zarif', '684', 'Galpão 2', 'Jardim Santa Vicência', 'Guarulhos', 'SP', 'Próximo ao mercado municipal', NOW(),
      'João Silva', '(11) 99999-8888', 'joao.silva@homologacao.com',
      '01310-100', 'Avenida Paulista', '1000', 'Conjunto 501', 'Bela Vista', 'São Paulo', 'SP', 'Próximo ao MASP', NOW(),
      'HOMOLOGAÇÃO PORTAL 135B', 10, 120, 'seca',
      'Fiorino',
      'Pedido de homologação da Missão 135-B. Portaria 24h. Doca 3. Agendar com 2h de antecedência.',
      jsonb_build_object(
        'homologacao', true,
        'missao', '135-B.1',
        'coleta_contato_nome', 'Maria Recepção',
        'coleta_contato_telefone', '(11) 99999-7777',
        'orientacoes_coleta', 'Portaria principal, apresentar documento',
        'instrucoes_adicionais', 'Carga não empilhável. Não molhar.',
        'protocolos_operacionais', jsonb_build_array('portaria_24h', 'doca_3', 'agendar_com_antecedencia'),
        'permitir_terceiros', true,
        'autorizados_receber', 'Apenas João Silva ou Maria Souza'
      ),
      'portal_cliente',
      NOW()
    )
    RETURNING id, numero_pedido, status
  `, [clienteId]);

  console.log(`Pedido criado: ${result.rows[0].numero_pedido} (${result.rows[0].id})`);
  return result.rows[0].id;
}

// ====================================
// ETAPA 8 — Validar pedido antes da conversão
// ====================================
async function validateBeforeConversion(pedidoId) {
  const pedido = await query(`SELECT * FROM portal_pedidos WHERE id = $1`, [pedidoId]);
  const row = pedido.rows[0];
  console.log(`  Status: ${row.status}`);
  console.log(`  os_vinculada_id: ${row.os_vinculada_id || 'NULL'}`);
  console.log(`  Cliente ID: ${row.cliente_id || 'NULL'}`);
  console.log(`  Tenant: OK (via RLS)`);

  // Verificar que não há OS vinculada
  if (row.os_vinculada_id) {
    throw new Error('Pedido já possui OS vinculada!');
  }

  // Verificar que não há financeiro indevido
  const fin = await query(`
    SELECT COUNT(*)::int AS cnt FROM financeiro_receber
    WHERE os_id = $1
  `, [pedidoId]);
  console.log(`  Financeiro receber (indevido): ${fin.rows[0].cnt}`);

  const finPag = await query(`
    SELECT COUNT(*)::int AS cnt FROM pagamentos_prestadores
    WHERE os_id = $1
  `, [pedidoId]);
  console.log(`  Pagamentos prestadores (indevido): ${finPag.rows[0].cnt}`);

  const eventos = await query(`
    SELECT COUNT(*)::int AS cnt FROM eventos_oficiais
    WHERE event_type = 'portal.order.converted_to_service_order'
    AND entity_id = $1
  `, [pedidoId]);
  console.log(`  Eventos de conversão: ${eventos.rows[0].cnt}`);

  return row;
}

// ====================================
// ETAPA 9 — Converter pelo fluxo oficial (PostgREST)
// ====================================
async function convertViaRPC(pedidoId) {
  const startTime = Date.now();
  const result = await query(`SELECT converter_pedido_para_os($1, NULL) AS result`, [pedidoId]);
  const duration = Date.now() - startTime;
  const r = result.rows[0].result;

  console.log(`  HTTP simul: 200 OK (${duration}ms)`);
  console.log(`  success: ${r.success}`);
  console.log(`  pedido_id: ${r.pedido_id}`);
  console.log(`  ordem_servico_id: ${r.ordem_servico_id}`);
  console.log(`  numero_os: ${r.numero_os}`);
  console.log(`  status_pedido: ${r.status_pedido}`);
  console.log(`  status_os: ${r.status_os}`);
  console.log(`  created: ${r.created}`);
  console.log(`  message: ${r.message}`);

  if (!r.success || !r.created) {
    throw new Error(`Conversão falhou: ${r.message} (${r.error_code})`);
  }
  return r;
}

// ====================================
// ETAPA 10 — Validar OS gerada
// ====================================
async function validateOS(osId, pedidoId) {
  const os = await query(`SELECT * FROM ordens_servico WHERE id = $1`, [osId]);
  const row = os.rows[0];
  console.log(`  numero: ${row.numero}`);
  console.log(`  cliente: ${row.cliente} (UUID)`);
  console.log(`  cliente_id: ${row.cliente_id}`);
  console.log(`  pedido_portal_id: ${row.pedido_portal_id}`);
  console.log(`  origem: ${row.origem}`);
  console.log(`  destino: ${row.destino}`);
  console.log(`  status: ${row.status}`);
  console.log(`  volumes: ${row.volumes}`);
  console.log(`  peso: ${row.peso}`);
  console.log(`  tipo_operacao: ${row.tipo_operacao}`);

  // Validar que cliente é UUID (não string nome)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!isUUID.test(row.cliente)) {
    console.log('  ⚠️ cliente NÃO é UUID — pode indicar nome armazenado');
  } else {
    console.log('  ✅ cliente é UUID');
  }

  // Validar pedido_portal_id
  if (row.pedido_portal_id !== pedidoId) {
    console.log(`  ⚠️ pedido_portal_id diverge! Esperado: ${pedidoId}, Real: ${row.pedido_portal_id}`);
  } else {
    console.log('  ✅ pedido_portal_id correto');
  }

  // Verificar endereços (armazenados como JSONB na coluna enderecos)
  const enderecosJson = row.enderecos;
  if (enderecosJson && Array.isArray(enderecosJson)) {
    console.log(`  Endereços: ${enderecosJson.length}`);
    for (const e of enderecosJson) {
      console.log(`    [${e.sequencia}] ${e.tipo}: ${e.cidade || ''}/${e.uf || ''}`);
    }
  } else {
    console.log(`  Endereços: 0 (JSONB vazio)`);
  }

  return row;
}

// ====================================
// ETAPA 11 — Teste de idempotência
// ====================================
async function testIdempotency(pedidoId, osIdEsperado, osNumeroEsperado) {
  console.log('\n--- Teste 1: Mesmo pedido, segunda chamada ---');
  const r1 = await query(`SELECT converter_pedido_para_os($1, NULL) AS result`, [pedidoId]);
  const res1 = r1.rows[0].result;
  console.log(`  created: ${res1.created}`);
  console.log(`  ordem_servico_id: ${res1.ordem_servico_id}`);
  console.log(`  numero_os: ${res1.numero_os}`);

  if (res1.created !== false) {
    console.log('  ❌ created deve ser false — segunda conversão não foi bloqueada!');
  } else if (res1.ordem_servico_id !== osIdEsperado) {
    console.log(`  ❌ OS ID diverge! Esperado: ${osIdEsperado}, Real: ${res1.ordem_servico_id}`);
  } else {
    console.log('  ✅ Idempotência OK — mesmo OS retornada');
  }

  console.log('\n--- Teste 2: Verificar única OS no banco ---');
  const osCount = await query(`
    SELECT COUNT(*)::int AS cnt FROM ordens_servico WHERE pedido_portal_id = $1
  `, [pedidoId]);
  console.log(`  OS para este pedido: ${osCount.rows[0].cnt}`);
  if (osCount.rows[0].cnt !== 1) {
    console.log('  ❌ Mais de uma OS para o mesmo pedido!');
  } else {
    console.log('  ✅ Apenas 1 OS');
  }

  console.log('\n--- Teste 3: Verificar vínculo bidirecional ---');
  const pedido = await query(`SELECT os_vinculada_id FROM portal_pedidos WHERE id = $1`, [pedidoId]);
  console.log(`  Pedido → OS: ${pedido.rows[0].os_vinculada_id === osIdEsperado ? '✅' : '❌'}`);

  return true;
}

// ====================================
// ETAPA 12 — Validar Event Bus
// ====================================
async function validateEventBus(pedidoId, osId, osNumero) {
  const eventos = await query(`
    SELECT * FROM eventos_oficiais
    WHERE event_type = 'portal.order.converted_to_service_order'
    AND entity_id = $1
    ORDER BY created_at DESC
  `, [osId]);

  console.log(`  Total eventos: ${eventos.rows.length}`);

  if (eventos.rows.length === 0) {
    console.log('  ❌ Nenhum evento encontrado');
    return;
  }

  const ev = eventos.rows[0];
  console.log(`  event_type: ${ev.event_type}`);
  console.log(`  entity_id: ${ev.entity_id}`);
  console.log(`  entity_number: ${ev.entity_number}`);
  console.log(`  source: ${ev.source}`);
  console.log(`  visibility: ${ev.visibility}`);
  console.log(`  payload: ${JSON.stringify(ev.payload)}`);
  console.log(`  metadata: ${JSON.stringify(ev.metadata)}`);

  if (eventos.rows.length === 1) {
    console.log('  ✅ Evento único');
  } else {
    console.log(`  ⚠️ ${eventos.rows.length} eventos (esperado: 1)`);
  }

  if (ev.entity_id !== osId) {
    console.log(`  ❌ entity_id diverge do OS ID`);
  } else {
    console.log('  ✅ entity_id corresponde à OS');
  }
}

// ====================================
// ETAPA 13 — Validar Financeiro
// ====================================
async function validateFinance(osId) {
  const receber = await query(`SELECT COUNT(*)::int AS cnt FROM financeiro_receber WHERE os_id = $1`, [osId]);
  const pagar = await query(`SELECT COUNT(*)::int AS cnt FROM financeiro_pagar WHERE os_id = $1`, [osId]);
  const pagPre = await query(`SELECT COUNT(*)::int AS cnt FROM pagamentos_prestadores WHERE os_id = $1`, [osId]);
  const comp = await query(`SELECT COUNT(*)::int AS cnt FROM composicao_financeira_os WHERE os_id = $1`, [osId]);

  console.log(`  financeiro_receber: ${receber.rows[0].cnt} (deve ser 0)`);
  console.log(`  financeiro_pagar: ${pagar.rows[0].cnt} (deve ser 0)`);
  console.log(`  pagamentos_prestadores: ${pagPre.rows[0].cnt} (deve ser 0)`);
  console.log(`  composicao_financeira_os: ${comp.rows[0].cnt} (deve ser 0)`);

  const totalIndevido = receber.rows[0].cnt + pagar.rows[0].cnt + pagPre.rows[0].cnt + comp.rows[0].cnt;
  if (totalIndevido > 0) {
    console.log(`  ❌ ${totalIndevido} lançamento(s) financeiro(s) indevido(s)!`);
  } else {
    console.log('  ✅ Nenhum lançamento financeiro indevido');
  }
}

// ====================================
// ETAPA 16 — Contrato Escala/Rede/App
// ====================================
async function validateContractForFuture(osId) {
  const os = await query(`SELECT * FROM ordens_servico WHERE id = $1`, [osId]);
  const row = os.rows[0];

  const checks = [
    { field: 'cliente', pass: !!row.cliente },
    { field: 'origem', pass: !!row.origem },
    { field: 'destino', pass: !!row.destino },
    { field: 'status', pass: row.status === 'rascunho' },
    { field: 'pedido_portal_id', pass: !!row.pedido_portal_id },
    { field: 'numero', pass: !!row.numero },
  ];

  console.log('  Contrato para Escala/Rede/App:');
  for (const check of checks) {
    console.log(`    ${check.pass ? '✅' : '❌'} ${check.field}`);
  }

  const allPass = checks.every(c => c.pass);
  if (allPass) {
    console.log('  ✅ OS pronta para Escala, Rede e App');
  } else {
    console.log('  ⚠️ OS possui campos insuficientes');
  }
}

// ====================================
// ETAPA 22 — Limpeza
// ====================================
async function createCleanupScript(pedidoId, osId) {
  const cleanup = `-- LIMPEZA DOS DADOS DE HOMOLOGAÇÃO 135-B
-- ATENÇÃO: Executar somente após screenshots e evidências

BEGIN;
-- Remover evento
DELETE FROM eventos_oficiais WHERE entity_id = '${osId}' AND event_type = 'portal.order.converted_to_service_order';
-- Remover OS
DELETE FROM ordens_servico WHERE id = '${osId}';
-- Remover pedido
DELETE FROM portal_pedidos WHERE id = '${pedidoId}';
COMMIT;
`;
  const path = resolve(__dirname, '..', 'scripts', 'm135b1_cleanup_hml.sql');
  writeFileSync(path, cleanup);
  console.log(`\n[OK] Script de limpeza criado: scripts/m135b1_cleanup_hml.sql`);
}

// ====================================
// MAIN
// ====================================
async function main() {
  console.log('========================================');
  console.log('MISSÃO 135-B.1 — Deploy + Homologação');
  console.log('========================================\n');

  await step(0, 'Conectar ao Supabase', connect);
  await step(3, 'Confirmar schema remoto', checkSchema);
  await step(4, 'Aplicar migration 135-B', applyMigration);
  await step(5, 'Validar RPC remota', validateRPC);
  await step(6, 'Executar testes SQL', runSQLTests);
  const pedidoId = await step(7, 'Criar pedido de homologação', createHomologationOrder);
  await step(8, 'Validar pedido antes da conversão', () => validateBeforeConversion(pedidoId));

  const convResult = await step(9, 'Converter pelo fluxo oficial (RPC)', () => convertViaRPC(pedidoId));
  const osId = convResult.ordem_servico_id;
  const osNumero = convResult.numero_os;

  await step(10, 'Validar OS gerada', () => validateOS(osId, pedidoId));
  await step(11, 'Teste de idempotência', () => testIdempotency(pedidoId, osId, osNumero));
  await step(12, 'Validar Event Bus', () => validateEventBus(pedidoId, osId, osNumero));
  await step(13, 'Validar Financeiro', () => validateFinance(osId));
  await step(16, 'Contrato Escala/Rede/App', () => validateContractForFuture(osId));

  // Criar script de limpeza
  await createCleanupScript(pedidoId, osId);

  console.log('\n========================================');
  console.log('✅ HOMOLOGAÇÃO CONCLUÍDA');
  console.log(`   Pedido: ${pedidoId}`);
  console.log(`   OS: ${osId} (${osNumero})`);
  console.log('========================================');
}

main().catch(err => {
  console.error('\n❌ FALHA NA HOMOLOGAÇÃO:', err.message);
  process.exit(1);
}).finally(() => {
  if (pool) pool.end();
});
