/**
 * CORE-E2E-OS-APP-POD-01 — Auditoria da Cadeia Completa OS→APP→POD→Protocol
 * 
 * READ-ONLY. Conecta via pg.Client a produção Supabase.
 * Roda: node scripts/_core_e2e_chain_audit.cjs
 * 
 * Coleta:
 * 1. Visão geral: contagens de tabelas-chave
 * 2. Alocações com/sem OS vinculada
 * 3. delivery_proofs: schema + contagens + 3 cadeias reais
 * 4. entregas_protocolo: sync trigger
 * 5. VW_app_motorista_operacoes: definição
 * 6. Storage: referências em delivery_proofs
 * 7. Rastreamento de 3 cases reais (OS→Alocação→App→POD→Protocol)
 */

const pg = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error('❌ DATABASE_URL não definida no .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
const results = {};

async function query(label, sql, deserialize = false) {
  try {
    const res = await client.query(sql);
    const rows = res.rows;
    if (deserialize) {
      const deserialized = rows.map(r => {
        const out = {};
        for (const [k, v] of Object.entries(r)) {
          if (typeof v === 'string' && v.startsWith('{') && v.length > 2) {
            try { out[k] = JSON.parse(v); } catch { out[k] = v; }
          } else if (typeof v === 'string' && v.startsWith('[') && v.length > 2) {
            try { out[k] = JSON.parse(v); } catch { out[k] = v; }
          } else {
            out[k] = v;
          }
        }
        return out;
      });
      results[label] = deserialized;
    } else {
      results[label] = rows;
    }
    console.log(`  ✅ ${label}: ${rows.length} rows`);
    return rows;
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
    results[label] = { error: e.message };
    return [];
  }
}

async function main() {
  try {
    await client.connect();
    console.log('🔗 Conectado a produção. Iniciando auditoria da cadeia...\n');

    // === FASE 1: Contagens gerais ===
    console.log('=== FASE 1: Contagens Gerais ===');
    await query('1.1_alocacoes_total', "SELECT count(*) as total FROM alocacoes_escala");
    await query('1.2_alocacoes_com_os', "SELECT count(*) as total FROM alocacoes_escala WHERE ordem_servico_id IS NOT NULL");
    await query('1.3_alocacoes_sem_os', "SELECT count(*) as total FROM alocacoes_escala WHERE ordem_servico_id IS NULL");
    await query('1.4_os_total', "SELECT count(*) as total FROM ordens_servico");
    await query('1.5_delivery_proofs_total', "SELECT count(*) as total FROM delivery_proofs");
    await query('1.6_entregas_protocolo_total', "SELECT count(*) as total FROM entregas_protocolo");
    await query('1.7_entregas_com_os', "SELECT count(*) as total FROM entregas_protocolo WHERE ordem_servico_id IS NOT NULL");
    await query('1.8_entregas_com_foto', "SELECT count(*) as total FROM entregas_protocolo WHERE foto_entrega_url IS NOT NULL");
    await query('1.9_entregas_com_assinatura', "SELECT count(*) as total FROM entregas_protocolo WHERE assinatura_url IS NOT NULL");
    await query('1.10_entregas_com_canhoto', "SELECT count(*) as total FROM entregas_protocolo WHERE foto_canhoto_url IS NOT NULL");

    // === FASE 2: Schema das tabelas-chave ===
    console.log('\n=== FASE 2: Schema das Tabelas-Chave ===');
    await query('2.1_dp_columns', `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'delivery_proofs' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    await query('2.2_ep_columns', `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'entregas_protocolo' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    await query('2.3_ae_columns', `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'alocacoes_escala' AND table_schema = 'public'
      AND column_name IN ('ordem_servico_id','status','prestador_id','cliente_id','metadata','veiculo_tipo','veiculo_placa','romaneio','fotos_entrega','data_finalizacao','aceite_prestador')
      ORDER BY ordinal_position
    `);

    // === FASE 3: delivery_proofs sample + vínculos ===
    console.log('\n=== FASE 3: delivery_proofs (últimos 5) ===');
    await query('3.1_dp_recent', `
      SELECT dp.id, dp.operation_id, dp.driver_id, dp.status, dp.receiver_name,
             dp.photo_url, dp.signature_url, dp.observation, dp.delivered_at,
             dp.os_id, dp.rota_id, dp.created_at, dp.tenant_id
      FROM delivery_proofs dp
      ORDER BY dp.created_at DESC
      LIMIT 5
    `, true);

    // === FASE 4: delivery_proofs ↔ alocacoes_escala vínculo ===
    console.log('\n=== FASE 4: delivery_proofs ↔ alocacoes_escala ===');
    await query('4.1_dp_with_ae', `
      SELECT dp.id as dp_id, dp.operation_id, dp.status, dp.delivered_at,
             ae.id as ae_id, ae.ordem_servico_id, ae.status as ae_status,
             ae.prestador_id, ae.cliente_id
      FROM delivery_proofs dp
      LEFT JOIN alocacoes_escala ae ON ae.id::text = dp.operation_id
      ORDER BY dp.created_at DESC
      LIMIT 5
    `, true);

    await query('4.2_dp_operation_id_is_uuid', `
      SELECT count(*) as total,
             SUM(CASE WHEN dp.operation_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 ELSE 0 END) as is_uuid
      FROM delivery_proofs dp
    `);

    // === FASE 5: entregas_protocolo ↔ delivery_proofs sync ===
    console.log('\n=== FASE 5: entregas_protocolo ↔ delivery_proofs ===');
    await query('5.1_ep_from_dp', `
      SELECT ep.id as ep_id, ep.alocacao_id, ep.status as ep_status,
             ep.ordem_servico_id, ep.data_hora_entrega,
             dp.id as dp_id, dp.status as dp_status
      FROM entregas_protocolo ep
      LEFT JOIN delivery_proofs dp ON dp.operation_id = ep.alocacao_id::text
      ORDER BY ep.created_at DESC
      LIMIT 5
    `, true);

    await query('5.2_ep_sem_dp', `
      SELECT count(*) as total FROM entregas_protocolo ep
      WHERE NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ep.alocacao_id::text
      )
    `);

    // === FASE 6: Storage references ===
    console.log('\n=== FASE 6: Storage References ===');
    await query('6.1_dp_photo_urls', `
      SELECT photo_url, signature_url, foto_canhoto_url
      FROM delivery_proofs 
      WHERE photo_url IS NOT NULL 
      LIMIT 5
    `, true);

    await query('6.2_ep_photo_urls', `
      SELECT foto_entrega_url, foto_canhoto_url, assinatura_url
      FROM entregas_protocolo 
      WHERE foto_entrega_url IS NOT NULL 
      LIMIT 5
    `, true);

    // === FASE 7: 3 CASOS REAIS — rastreamento ponta-a-ponta ===
    console.log('\n=== FASE 7: 3 CASOS REAIS ===');

    // Caso 1: Última entrega com protocolo + OS vinculada
    await query('7.1_caso1_protocolo', `
      SELECT ep.id as ep_id, ep.alocacao_id, ep.prestador_id, ep.ordem_servico_id,
             ep.nome_recebedor, ep.status as ep_status, ep.data_hora_entrega,
             ep.latitude, ep.longitude, ep.foto_entrega_url, ep.foto_canhoto_url,
             ep.assinatura_url, ep.created_at
      FROM entregas_protocolo ep
      WHERE ep.ordem_servico_id IS NOT NULL
      ORDER BY ep.created_at DESC
      LIMIT 1
    `, true);

    if (results['7.1_caso1_protocolo'] && results['7.1_caso1_protocolo'].length > 0) {
      const c1 = results['7.1_caso1_protocolo'][0];
      const alocId = c1.alocacao_id;
      const osId = c1.ordem_servico_id;
      const prestadorId = c1.prestador_id;

      await query('7.2_caso1_alocacao', `
        SELECT id, ordem_servico_id, prestador_id, cliente_id, status,
               veiculo_tipo, veiculo_placa, romaneio, data_finalizacao,
               aceite_prestador, metadata
        FROM alocacoes_escala 
        WHERE id = '${alocId}'
      `, true);

      await query('7.3_caso1_os', `
        SELECT id, numero, cliente, prestador, status, status_financeiro,
               origem, destino, valor_total, data_criacao
        FROM ordens_servico 
        WHERE id = '${osId}'
      `, true);

      if (prestadorId) {
        await query('7.4_caso1_prestador', `
          SELECT id, nome_completo, cpf_cnpj, telefone
          FROM prestadores 
          WHERE id = '${prestadorId}'
        `, true);
      }

      await query('7.5_caso1_dp', `
        SELECT id, operation_id, status, receiver_name, 
               photo_url, signature_url, foto_canhoto_url,
               observation, delivered_at, os_id
        FROM delivery_proofs 
        WHERE operation_id = '${alocId}' OR os_id = '${osId}'
        ORDER BY created_at DESC
        LIMIT 3
      `, true);
    }

    // Caso 2: Último delivery_proofs com delivered
    await query('7.6_caso2_dp', `
      SELECT id, operation_id, driver_id, status, receiver_name,
             photo_url, signature_url, observation, delivered_at,
             os_id, rota_id, created_at
      FROM delivery_proofs 
      WHERE status = 'delivered' OR status = 'delivered_with_note'
      ORDER BY created_at DESC
      LIMIT 1
    `, true);

    if (results['7.6_caso2_dp'] && results['7.6_caso2_dp'].length > 0) {
      const c2 = results['7.6_caso2_dp'][0];
      const opId = c2.operation_id;

      await query('7.7_caso2_alocacao', `
        SELECT id, ordem_servico_id, prestador_id, cliente_id, status,
               romaneio, data_finalizacao, metadata
        FROM alocacoes_escala 
        WHERE id::text = '${opId}'
      `, true);

      await query('7.8_caso2_ep', `
        SELECT id, alocacao_id, nome_recebedor, status, 
               ordem_servico_id, data_hora_entrega
        FROM entregas_protocolo 
        WHERE alocacao_id = '${opId}' OR ordem_servico_id = '${c2.os_id}'
        ORDER BY created_at DESC
        LIMIT 2
      `, true);
    }

    // Caso 3: Alocação finalizada SEM delivery_proof (gargalo)
    await query('7.9_caso3_alocacao_sem_dp', `
      SELECT ae.id, ae.ordem_servico_id, ae.prestador_id, ae.cliente_id,
             ae.status, ae.data_finalizacao, ae.romaneio
      FROM alocacoes_escala ae
      WHERE ae.status IN ('finalizada', 'concluida')
        AND ae.ordem_servico_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
        )
      ORDER BY ae.data_finalizacao DESC
      LIMIT 1
    `, true);

    if (results['7.9_caso3_alocacao_sem_dp'] && results['7.9_caso3_alocacao_sem_dp'].length > 0) {
      const c3 = results['7.9_caso3_alocacao_sem_dp'][0];
      await query('7.10_caso3_os', `
        SELECT id, numero, cliente, prestador, status, 
               status_financeiro, valor_total
        FROM ordens_servico 
        WHERE id = '${c3.ordem_servico_id}'
      `, true);

      await query('7.11_caso3_ep', `
        SELECT id, alocacao_id, nome_recebedor, status, 
               foto_entrega_url, assinatura_url
        FROM entregas_protocolo 
        WHERE alocacao_id = '${c3.id}'
        LIMIT 2
      `, true);
    }

    // === FASE 8: Contagens de gargalo ===
    console.log('\n=== FASE 8: Contagens de Gargalo ===');
    await query('8.1_finalizadas_sem_dp', `
      SELECT count(*) as total FROM alocacoes_escala ae
      WHERE ae.status IN ('finalizada', 'concluida')
        AND NOT EXISTS (
          SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
        )
    `);

    await query('8.2_finalizadas_com_dp', `
      SELECT count(*) as total FROM alocacoes_escala ae
      WHERE ae.status IN ('finalizada', 'concluida')
        AND EXISTS (
          SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
        )
    `);

    await query('8.3_dp_sem_ep', `
      SELECT count(*) as total FROM delivery_proofs dp
      WHERE NOT EXISTS (
        SELECT 1 FROM entregas_protocolo ep WHERE ep.alocacao_id::text = dp.operation_id
      )
    `);

    await query('8.4_ep_with_null_fields', `
      SELECT 
        count(*) as total,
        SUM(CASE WHEN foto_entrega_url IS NULL THEN 1 ELSE 0 END) as sem_foto,
        SUM(CASE WHEN assinatura_url IS NULL THEN 1 ELSE 0 END) as sem_assinatura,
        SUM(CASE WHEN foto_canhoto_url IS NULL THEN 1 ELSE 0 END) as sem_canhoto,
        SUM(CASE WHEN nome_recebedor IS NULL THEN 1 ELSE 0 END) as sem_recebedor
      FROM entregas_protocolo
    `);

    // === FASE 9: TRIGGER sync check ===
    console.log('\n=== FASE 9: Trigger sync ===');
    await query('9.1_trigger_exists', `
      SELECT trigger_name, event_manipulation, event_object_table
      FROM information_schema.triggers 
      WHERE event_object_table = 'delivery_proofs'
        AND trigger_schema = 'public'
    `);

    await query('9.2_sync_function', `
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_name LIKE '%entregas%'
        AND routine_schema = 'public'
    `);

    // === FASE 10: VW_app_motorista_operacoes ===
    console.log('\n=== FASE 10: VW_app_motorista_operacoes ===');
    await query('10.1_view_columns', `
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'vw_app_motorista_operacoes' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    await query('10.2_view_count', "SELECT count(*) as total FROM vw_app_motorista_operacoes");

    await query('10.3_view_sample', `
      SELECT id, prestador_id, status, romaneio, cliente_id,
             veiculo_tipo, veiculo_placa
      FROM vw_app_motorista_operacoes
      WHERE prestador_id IS NOT NULL
      LIMIT 3
    `, true);

    // === FASE 11: OS criadas vs alocações ===
    console.log('\n=== FASE 11: OS vs Alocações ===');
    await query('11.1_os_from_alocacao', `
      SELECT count(*) as total FROM ordens_servico os
      WHERE EXISTS (
        SELECT 1 FROM alocacoes_escala ae WHERE ae.ordem_servico_id = os.id
      )
    `);

    await query('11.2_os_standalone', `
      SELECT count(*) as total FROM ordens_servico os
      WHERE NOT EXISTS (
        SELECT 1 FROM alocacoes_escala ae WHERE ae.ordem_servico_id = os.id
      )
    `);

    // Salvar relatório
    const reportPath = path.join(__dirname, '..', '_core_e2e_chain_audit_results.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Resultados salvos em: ${reportPath}`);

  } catch (e) {
    console.error(`\n❌ ERRO GERAL: ${e.message}\n${e.stack}`);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada.');
  }
}

main();
