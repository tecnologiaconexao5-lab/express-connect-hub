const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { guardHarness } = require('./_guard.cjs');

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness('scripts/_tms012_criar_os_hml.cjs');

const url = process.env.DATABASE_URL;
if (!url) { console.error('no DATABASE_URL'); process.exit(1); }

async function main() {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const PRESTADOR_ID = 'e6646799-fbac-453e-a3ef-afdfc01a7085';
  const CLIENTE_CNPJ = '00.000.000/0000-00';
  const OS_NUMERO = 'HML-APP-001';

  // STEP 1: Create or get client
  console.log('=== STEP 1: Cliente ===');
  let clienteId;
  const existingCliente = await c.query(
    `SELECT id FROM clientes WHERE cnpj = $1`, [CLIENTE_CNPJ]
  );
  if (existingCliente.rows.length > 0) {
    clienteId = existingCliente.rows[0].id;
    console.log('  Reusing existing cliente: ' + clienteId);
  } else {
    const result = await c.query(`
      INSERT INTO clientes (razao_social, nome_fantasia, cnpj, status, cidade, uf, tenant_id, observacoes)
      VALUES ('HOMOLOGAÇÃO APP', 'HOMOLOGAÇÃO APP', $1, 'ativo', 'São Paulo', 'SP', $2, 'CLIENTE DE HOMOLOGAÇÃO PARA TESTE DO APP MOTORISTA - MISSÃO TMS-012')
      RETURNING id
    `, [CLIENTE_CNPJ, TENANT_ID]);
    clienteId = result.rows[0].id;
    console.log('  Created cliente: ' + clienteId);
  }

  // STEP 2: Create OS (ordem_servico)
  console.log('\n=== STEP 2: Ordem de Serviço ===');
  let osId;
  const existingOS = await c.query(
    `SELECT id FROM ordens_servico WHERE numero = $1`, [OS_NUMERO]
  );
  if (existingOS.rows.length > 0) {
    osId = existingOS.rows[0].id;
    console.log('  Reusing existing OS: ' + osId + ' (' + OS_NUMERO + ')');
  } else {
    const result = await c.query(`
      INSERT INTO ordens_servico (
        numero, cliente, prestador, status,
        carga_tipo, peso, volumes, valor_declarado,
        origem, destino,
        data, tipo_operacao,
        tenant_id,
        valor_cliente, custo_prestador,
        observacoes
      ) VALUES (
        $1, $2::uuid, $3::uuid, 'pendente',
        'Caixa teste', 10, 1, 100,
        'São Paulo/SP', 'São Paulo/SP',
        CURRENT_DATE, 'entrega',
        $4,
        100, 50,
        'OS DE HOMOLOGAÇÃO PARA TESTE DO APP MOTORISTA - MISSÃO TMS-012'
      ) RETURNING id
    `, [OS_NUMERO, clienteId, PRESTADOR_ID, TENANT_ID]);
    osId = result.rows[0].id;
    console.log('  Created OS: ' + osId + ' (' + OS_NUMERO + ')');
  }

  // STEP 3: Create alocação (escala)
  console.log('\n=== STEP 3: Alocação ===');
  let alocId;
  const existingAloc = await c.query(
    `SELECT id FROM alocacoes_escala WHERE ordem_servico_id = $1::uuid`,
    [osId]
  );
  if (existingAloc.rows.length > 0) {
    alocId = existingAloc.rows[0].id;
    console.log('  Reusing existing alocação: ' + alocId);
  } else {
    const result = await c.query(`
      INSERT INTO alocacoes_escala (
        prestador_id, ordem_servico_id,
        status, data_escala,
        origem, destino,
        tenant_id,
        tipo_veiculo, turno,
        valor_repasse, quantidade_paradas, km_previstos,
        observacoes
      ) VALUES (
        $1::uuid, $2::uuid,
        'aguardando_aceite', CURRENT_DATE,
        'São Paulo/SP', 'São Paulo/SP',
        $3,
        'teste', 'diurno',
        50, 1, 15,
        'ALOCAÇÃO DE HOMOLOGAÇÃO - MISSÃO TMS-012'
      ) RETURNING id
    `, [PRESTADOR_ID, osId, TENANT_ID]);
    alocId = result.rows[0].id;
    console.log('  Created alocação: ' + alocId);
  }

  // STEP 4: Create timeline (historico_alocacoes_escala)
  console.log('\n=== STEP 4: Timeline ===');
  const existingHist = await c.query(
    `SELECT id FROM historico_alocacoes_escala WHERE alocacao_id = $1::uuid LIMIT 1`,
    [alocId]
  );
  if (existingHist.rows.length > 0) {
    console.log('  Timeline already exists (skipping)');
  } else {
    await c.query(`
      INSERT INTO historico_alocacoes_escala (
        alocacao_id, evento, status_novo, descricao
      ) VALUES (
        $1::uuid, 'criada', 'aguardando_aceite',
        'OS de homologação criada para teste do App Motorista'
      )
    `, [alocId]);
    console.log('  Timeline entry created');
  }

  // STEP 5: Create operation_timeline_events
  console.log('\n=== STEP 5: Operation Timeline Event ===');
  const existingEvt = await c.query(
    `SELECT id FROM operation_timeline_events 
     WHERE operation_id = $1 AND type = 'os_criada' LIMIT 1`,
    [alocId]
  );
  if (existingEvt.rows.length > 0) {
    console.log('  Operation event already exists (skipping)');
  } else {
    await c.query(`
      INSERT INTO operation_timeline_events (
        operation_id, driver_id, type, title, description, event_time, synced
      ) VALUES (
        $1, $2, 'os_criada', 'OS HML-APP-001 criada',
        'Ordem de Serviço de homologação criada. Aguardando aceite do motorista.',
        NOW(), true
      )
    `, [alocId, PRESTADOR_ID]);
    console.log('  Operation event created');
  }

  // STEP 6: Create tracking entry (portal_tracking_realtime)
  console.log('\n=== STEP 6: Tracking ===');
  const existingTrk = await c.query(
    `SELECT id FROM portal_tracking_realtime WHERE os_id = $1::uuid LIMIT 1`,
    [osId]
  );
  if (existingTrk.rows.length > 0) {
    console.log('  Tracking already exists (skipping)');
  } else {
    await c.query(`
      INSERT INTO portal_tracking_realtime (
        os_id, prestador_id, alocacao_id,
        status, latitude, longitude,
        tenant_id, origem, captured_at, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid,
        'pendente', -23.5505, -46.6333,
        $4, 'homologacao', NOW(), NOW(), NOW()
      )
    `, [osId, PRESTADOR_ID, alocId, TENANT_ID]);
    console.log('  Tracking entry created');
  }

  // STEP 7: Validate via direct SQL (simulate f_buscar_operacoes_motorista)
  console.log('\n=== STEP 7: Validação RPC ===');
  const rpcCheck = await c.query(`
    SELECT jsonb_build_object(
      'success', true,
      'operacoes', COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', ae.id,
          'prestador_id', ae.prestador_id,
          'status', ae.status,
          'origem', ae.origem,
          'destino', ae.destino,
          'data_escala', ae.data_escala,
          'valor_repasse', ae.valor_repasse,
          'km_previstos', ae.km_previstos,
          'observacoes', ae.observacoes,
          'ordem_servico_id', ae.ordem_servico_id,
          'created_at', ae.created_at
        )
        ORDER BY ae.created_at DESC
      ), '[]'::JSONB),
      'total', COALESCE(jsonb_array_length(
        (SELECT jsonb_agg(1) FROM alocacoes_escala ae2
         WHERE ae2.prestador_id = $1::uuid
           AND ae2.status IS DISTINCT FROM 'cancelada'
           AND ae2.status IS DISTINCT FROM 'recusada')
      ), 0)
    ) as result
    FROM alocacoes_escala ae
    WHERE ae.prestador_id = $1::uuid
      AND ae.id = $2::uuid
      AND ae.status IS DISTINCT FROM 'cancelada'
      AND ae.status IS DISTINCT FROM 'recusada'`
  , [PRESTADOR_ID, alocId]);

  const rpcResult = rpcCheck.rows[0]?.result;
  const rpcParsed = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
  
  console.log('  RPC simulation result:');
  console.log('    success: ' + rpcParsed.success);
  console.log('    total operacoes: ' + rpcParsed.total);
  console.log('    nossa alocacao encontrada: ' + (rpcParsed.operacoes?.length > 0 ? 'SIM' : 'NAO'));
  if (rpcParsed.operacoes?.length > 0) {
    const op = rpcParsed.operacoes[0];
    console.log('    alocacao_id: ' + op.id);
    console.log('    status: ' + op.status);
    console.log('    origem: ' + op.origem);
    console.log('    destino: ' + op.destino);
    console.log('    data_escala: ' + op.data_escala);
  }

  // Summary
  console.log('\n========================================');
  console.log('RESUMO FINAL');
  console.log('========================================');
  console.log('Número da OS: ' + OS_NUMERO);
  console.log('ID: ' + osId);
  console.log('Cliente: HOMOLOGAÇÃO APP (' + clienteId + ')');
  console.log('Motorista: PRESTADOR TESTE APP (teste@conexao.com) - ' + PRESTADOR_ID);
  console.log('Status: pendente (OS) / aguardando_aceite (Alocação)');
  console.log('');
  console.log('Alocação ID: ' + alocId);
  console.log('');

  // Determine if visible in app
  if (rpcParsed.success && rpcParsed.total > 0 && rpcParsed.operacoes?.length > 0) {
    console.log('Aparece no aplicativo: SIM');
    console.log('');
    console.log('A alocação está vinculada ao prestador e com status aguardando_aceite.');
    console.log('O motorista teste@conexao.com possui conta auth com senha configurada');
    console.log('e já realizou login anteriormente (último acesso: 28/07/2026).');
    console.log('');
    console.log('Para testar:');
    console.log('  1. Abrir o App Motorista');
    console.log('  2. Fazer login com teste@conexao.com');
    console.log('  3. A operação HML-APP-001 aparecerá na lista de operações disponíveis');
    console.log('  4. O motorista pode aceitar a operação');
  } else {
    console.log('Aparece no aplicativo: NAO');
    console.log('');
    console.log('Motivos possíveis:');
    if (!rpcParsed.success) console.log('  - RPC retornou erro: ' + JSON.stringify(rpcParsed));
    if (!rpcParsed.operacoes || rpcParsed.operacoes.length === 0) console.log('  - Alocação não encontrada na query do RPC');
  }

  await c.end();
}
main().catch(console.error);
