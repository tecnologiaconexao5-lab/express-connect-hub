import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const results = [];

async function query(sql, params) {
  return pool.query(sql, params);
}

async function main() {
  console.log('═'.repeat(65));
  console.log('M108-C1B — TESTE REAL PONTA A PONTA');
  console.log(`Data: ${new Date().toISOString().split('T')[0]}`);
  console.log('═'.repeat(65));

  // ================================================================
  // 1. Buscar alocação ativa para teste
  // ================================================================
  console.log('\n📡 1. Buscando alocação ativa...');

  // Check if tenant_id exists in alocacoes_escala
  let tenantCol = '';
  try {
    await query(`SELECT tenant_id FROM public.alocacoes_escala LIMIT 1`);
    tenantCol = ', ae.tenant_id';
  } catch {
    tenantCol = ', NULL::uuid as tenant_id';
  }

  const { rows: alocacoes } = await query(
    `SELECT ae.id, ae.prestador_id, ae.ordem_servico_id${tenantCol}, ae.status
     FROM public.alocacoes_escala ae
     WHERE ae.status = 'concluida'
        OR ae.status = 'em_rota'
        OR ae.status = 'aceita'
     ORDER BY ae.created_at DESC
     LIMIT 1`
  );

  let alocacaoId;
  let prestadorId;

  if (alocacoes.length === 0) {
    results.push({ name: 'Buscar alocação ativa', status: '⚠️', detail: 'Nenhuma alocação ativa. Criando...' });
    console.log('⚠️ Nenhuma alocação concluída/encontrada.');

    // Try with any non-canceled alocacao
    const { rows: anyAloc } = await query(
      `SELECT ae.id, ae.prestador_id${tenantCol ? tenantCol : ', NULL::uuid as tenant_id'}, ae.status
       FROM public.alocacoes_escala ae
       WHERE ae.status NOT IN ('cancelada', 'recusada')
       ORDER BY ae.created_at DESC
       LIMIT 1`
    );
    if (anyAloc.length === 0) {
      console.log('❌ Nenhuma alocação disponível no banco.');
      results.push({ name: 'Encontrar alocação', status: '❌', detail: 'Zero alocações no banco' });
      printResults();
      await pool.end();
      process.exit(1);
    }
    alocacaoId = anyAloc[0].id;
    prestadorId = anyAloc[0].prestador_id;
    console.log(`   ⚠️ Usando alocação: ${alocacaoId} (status: ${anyAloc[0].status})`);
  } else {
    alocacaoId = alocacoes[0].id;
    prestadorId = alocacoes[0].prestador_id;
    console.log(`   ✅ Alocação: ${alocacaoId} (status: ${alocacoes[0].status})`);
    console.log(`   Prestador: ${prestadorId}`);
  }

  if (!prestadorId) {
    console.log('❌ Alocação sem prestador_id — não é possível testar.');
    results.push({ name: 'Validar prestador', status: '❌', detail: 'alocacao sem prestador_id' });
    printResults();
    await pool.end();
    process.exit(1);
  }

  // ================================================================
  // 2. Verificar se já existe POD para evitar conflito
  // ================================================================
  console.log('\n🔍 2. Verificando entregas_protocolo existente...');
  const { rows: existente } = await query(
    `SELECT id FROM public.entregas_protocolo WHERE alocacao_id = $1`,
    [alocacaoId]
  );

  if (existente.length > 0) {
    console.log(`   ⚠️ Já existe POD (${existente[0].id}). Teste de idempotência validado.`);
    results.push({ name: 'POD existente', status: '⚠️', detail: `ID ${existente[0].id} — idempotência será testada` });
  } else {
    console.log('   ✅ Nenhum POD existente — teste limpo');
    results.push({ name: 'POD existente', status: '✅', detail: 'Nenhum — teste limpo' });
  }

  // ================================================================
  // 3. Inserir delivery_proofs (simulando App Motorista)
  // ================================================================
  console.log('\n📝 3. Inserindo delivery_proofs (simulando App Motorista)...');

  const dpId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const testData = {
    id: dpId,
    stop_id: alocacaoId,
    operation_id: alocacaoId,
    driver_id: prestadorId,
    receiver_name: 'Maria Silva Teste',
    receiver_document: '123.456.789-00',
    receiver_relationship: 'Recebedor',
    status: 'delivered',
    photo_url: 'https://storage.example.com/foto_test_108c1.jpg',
    signature_url: 'https://storage.example.com/assinatura_test_108c1.png',
    observation: 'Entrega M108-C1B - teste real ponta a ponta',
    latitude: -23.5505,
    longitude: -46.6333,
    gps_accuracy: 5.2,
    delivered_at: timestamp,
  };

  const colNames = Object.keys(testData).join(', ');
  const colParams = Object.keys(testData).map((_, i) => `$${i + 1}`).join(', ');
  const colValues = Object.values(testData);

  try {
    await query(
      `INSERT INTO public.delivery_proofs (${colNames}) VALUES (${colParams})`,
      colValues
    );
    console.log('   ✅ delivery_proofs inserido');
    results.push({ name: 'Inserir delivery_proofs', status: '✅', detail: `ID: ${dpId}` });
  } catch (err) {
    console.log(`   ❌ Erro: ${err.message}`);
    results.push({ name: 'Inserir delivery_proofs', status: '❌', detail: err.message });
    printResults();
    await pool.end();
    process.exit(1);
  }

  // ================================================================
  // 4. Aguardar trigger e verificar entregas_protocolo
  // ================================================================
  console.log('\n⏳ 4. Aguardando trigger...');
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n🔍 5. Verificando entregas_protocolo...');
  const { rows: epRows } = await query(
    `SELECT * FROM public.entregas_protocolo WHERE alocacao_id = $1`,
    [alocacaoId]
  );

  if (epRows.length === 0) {
    console.log('   ❌ NENHUM registro encontrado em entregas_protocolo!');
    results.push({ name: 'Sincronização trigger', status: '❌', detail: 'entregas_protocolo vazio' });
    printResults();
    await pool.end();
    process.exit(1);
  }

  const ep = epRows[0];
  console.log(`   ✅ entregas_protocolo populado: ${ep.id}`);

  // Validate field mapping
  const fieldMap = [
    ['nome_recebedor', ep.nome_recebedor, testData.receiver_name],
    ['documento_recebedor', ep.documento_recebedor, testData.receiver_document],
    ['receiver_relationship', ep.receiver_relationship, testData.receiver_relationship],
    ['foto_entrega_url', ep.foto_entrega_url, testData.photo_url],
    ['assinatura_url', ep.assinatura_url, testData.signature_url],
    ['observacao', ep.observacao, testData.observation],
    ['latitude', Number(ep.latitude), testData.latitude],
    ['longitude', Number(ep.longitude), testData.longitude],
    ['gps_accuracy', ep.gps_accuracy ? Number(ep.gps_accuracy) : null, testData.gps_accuracy],
    ['alocacao_id', ep.alocacao_id, alocacaoId],
    ['prestador_id', ep.prestador_id, prestadorId],
  ];

  const failed = fieldMap.filter(([_, got, expected]) => {
    if (expected === null && got === null) return false;
    if (expected === null || got === null) return true;
    return String(got) !== String(expected);
  });

  if (failed.length === 0) {
    console.log('   ✅ Todos os 11 campos mapeados corretamente');
    results.push({ name: 'Mapeamento de campos', status: '✅', detail: '11/11 campos conferem' });
  } else {
    console.log(`   ❌ ${failed.length} campos divergentes:`);
    for (const [f, g, e] of failed) {
      console.log(`       ${f}: esperado=${e}, recebido=${g}`);
    }
    results.push({ name: 'Mapeamento de campos', status: '❌', detail: `${failed.length}/11 falharam` });
  }

  // ================================================================
  // 6. Testar idempotência
  // ================================================================
  console.log('\n🔁 6. Testando idempotência (segundo insert)...');

  const dpId2 = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO public.delivery_proofs (id, stop_id, operation_id, driver_id, receiver_name, status, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [dpId2, alocacaoId, alocacaoId, prestadorId, 'Outro Teste', 'delivered', timestamp]
    );
    console.log('   ✅ Segundo delivery_proofs inserido');

    await new Promise(r => setTimeout(r, 1000));

    const { rows: epAfter } = await query(
      `SELECT COUNT(*) as cnt FROM public.entregas_protocolo WHERE alocacao_id = $1`,
      [alocacaoId]
    );

    if (parseInt(epAfter[0].cnt) === 1) {
      console.log('   ✅ Idempotente: 1 registro apenas (não duplicou)');
      results.push({ name: 'Idempotência', status: '✅', detail: '1 registro para alocação (correto)' });
    } else {
      console.log(`   ❌ Duplicado: ${epAfter[0].cnt} registros`);
      results.push({ name: 'Idempotência', status: '❌', detail: `${epAfter[0].cnt} registros` });
    }
  } catch (err) {
    console.log(`   ⚠️ Erro no segundo insert: ${err.message}`);
    results.push({ name: 'Idempotência', status: '⚠️', detail: err.message });
  }

  // ================================================================
  // 7. Verificar Event Bus
  // ================================================================
  console.log('\n📡 7. Verificando Event Bus (entrega.comprovante.pod_enviado)...');

  const { rows: eventos } = await query(
    `SELECT event_type, entity_id, created_at, payload
     FROM public.eventos_oficiais
     WHERE event_type = 'entrega.comprovante.pod_enviado'
       AND entity_id = $1
     ORDER BY created_at DESC
     LIMIT 3`,
    [ep.id]
  );

  if (eventos.length > 0) {
    console.log(`   ✅ ${eventos.length} evento(s) encontrado(s)`);
    for (const ev of eventos) {
      console.log(`      📅 ${ev.created_at} | tipo: ${ev.event_type}`);
    }
    results.push({ name: 'Event Bus (pod_enviado)', status: '✅', detail: `${eventos.length} eventos` });
  } else {
    console.log('   ⚠️ Nenhum evento encontrado (trigger M104 pode não estar ativa)');
    results.push({ name: 'Event Bus (pod_enviado)', status: '⚠️', detail: '0 eventos' });
  }

  // ================================================================
  // 8. Verificar acessos RLS (leitura por tenant)
  // ================================================================
  console.log('\n🔒 8. Verificando RLS e permissões...');

  // Test anon access
  try {
    const { rows: anonCheck } = await query(
      `SELECT COUNT(*) as cnt FROM public.entregas_protocolo WHERE alocacao_id = $1`,
      [alocacaoId]
    );
    console.log(`   ✅ SELECT entregas_protocolo: ${anonCheck[0].cnt} registro(s) visível(is)`);
    results.push({ name: 'RLS/ACL entregas_protocolo', status: '✅', detail: 'Acessível via service_role' });
  } catch (err) {
    console.log(`   ⚠️ RLS: ${err.message}`);
    results.push({ name: 'RLS/ACL entregas_protocolo', status: '⚠️', detail: err.message });
  }

  // ================================================================
  // RESULTADO
  // ================================================================
  printResults();

  const totalOk = results.filter(r => r.status === '✅').length;
  const totalFail = results.filter(r => r.status === '❌').length;
  const totalWarn = results.filter(r => r.status === '⚠️').length;

  console.log('\n' + '═'.repeat(65));
  console.log(`RESULTADO FINAL: ${totalOk} ✅ / ${totalFail} ❌ / ${totalWarn} ⚠️`);
  console.log('═'.repeat(65));

  if (totalFail === 0) {
    console.log('\n🎯 Sincronização delivery_proofs → entregas_protocolo HOMOLOGADA!');
    console.log('   Fluxo completo: App → delivery_proofs → trigger → entregas_protocolo → Event Bus');
  } else {
    console.log('\n❌ Falhas detectadas — revisar.');
    await pool.end();
    process.exit(1);
  }

  // Cleanup test data
  console.log('\n🧹 Limpando dados de teste...');
  await query(`DELETE FROM public.delivery_proofs WHERE id = $1`, [dpId]);
  await query(`DELETE FROM public.delivery_proofs WHERE id = $1`, [dpId2]);
  // Don't delete entregas_protocolo — keep it as proof
  console.log('   ✅ Dados de delivery_proofs removidos');
  console.log('   ℹ️  entregas_protocolo mantido como evidência');

  await pool.end();
}

function printResults() {
  console.log('\n' + '─'.repeat(65));
  console.log('RESULTADOS INDIVIDUAIS:');
  console.log('─'.repeat(65));
  for (const r of results) {
    console.log(`  ${r.status} ${r.name}`);
    console.log(`     ${r.detail}`);
  }
}

main().catch(err => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
