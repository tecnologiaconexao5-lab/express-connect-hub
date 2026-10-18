/**
 * CORE-E2E-OS-APP-POD-02 — Classificação das 56 Alocações Finalizadas sem Proof
 * READ-ONLY. Produção Supabase.
 */
const pg = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const R = {};

async function q(label, sql) {
  try {
    const res = await client.query(sql);
    R[label] = res.rows;
    console.log(`  ✅ ${label}: ${res.rows.length} rows`);
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`);
    R[label] = { error: e.message };
  }
}

async function main() {
  await client.connect();
  console.log('🔗 Conectado. Etapa 1: Classificação das 56 finalizadas...\n');

  // 1.1 — Todas as 56 finalizadas sem delivery_proof, com colunas detalhadas
  await q('1.1_finalizadas_sem_dp', `
    SELECT 
      ae.id,
      ae.created_at,
      ae.updated_at,
      ae.data_finalizacao,
      ae.prestador_id,
      ae.ordem_servico_id,
      ae.status,
      ae.aceite_prestador,
      ae.data_aceite,
      ae.fotos_entrega,
      ae.comprovante_url,
      ae.assinatura_url,
      ae.metadata,
      ae.operation_mode,
      ae.coleta_reversa,
      ae.reversa_status,
      ae.tipo_veiculo,
      ae.placa,
      ae.origem,
      ae.destino,
      ae.cliente_id,
      ae.empresa_id,
      ae.turno,
      ae.data_escala,
      ae.tenant_id,
      p.nome_completo as prestador_nome,
      p.cpf_cnpj as prestador_cpf
    FROM alocacoes_escala ae
    LEFT JOIN prestadores p ON p.id = ae.prestador_id
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
    ORDER BY ae.data_finalizacao DESC NULLS LAST, ae.created_at DESC
  `);

  // 1.2 — Distribuição por prestador
  await q('1.2_por_prestador', `
    SELECT 
      ae.prestador_id,
      p.nome_completo,
      p.cpf_cnpj,
      count(*) as total
    FROM alocacoes_escala ae
    LEFT JOIN prestadores p ON p.id = ae.prestador_id
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
    GROUP BY ae.prestador_id, p.nome_completo, p.cpf_cnpj
    ORDER BY total DESC
  `);

  // 1.3 — Distribuição por tenant
  await q('1.3_por_tenant', `
    SELECT 
      ae.tenant_id,
      count(*) as total
    FROM alocacoes_escala ae
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
    GROUP BY ae.tenant_id
    ORDER BY total DESC
  `);

  // 1.4 — Presença em entregas_protocolo
  await q('1.4_em_entregas', `
    SELECT 
      ae.id,
      ae.data_finalizacao,
      ae.status,
      ep.id as ep_id,
      ep.status as ep_status,
      ep.foto_entrega_url,
      ep.assinatura_url,
      ep.foto_canhoto_url,
      ep.nome_recebedor,
      ep.data_hora_entrega
    FROM alocacoes_escala ae
    LEFT JOIN entregas_protocolo ep ON ep.alocacao_id = ae.id
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
    ORDER BY ae.data_finalizacao DESC NULLS LAST
  `);

  // 1.5 — Buscar romaneio via metadata (não coluna)
  await q('1.5_romaneio_metadata', `
    SELECT 
      ae.id,
      ae.data_finalizacao,
      ae.metadata->'app_motorista'->>'romaneio' as romaneio_app,
      ae.metadata->>'numeroOC' as numero_oc,
      ae.metadata->>'origem' as origem_meta,
      ae.metadata->>'central_financeira_manual' as manual_flag
    FROM alocacoes_escala ae
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
    ORDER BY ae.data_finalizacao DESC NULLS LAST
  `);

  // 1.6 — Verificar se há fotos no campo fotos_entrega (text[])
  await q('1.6_fotos_entrega_array', `
    SELECT 
      ae.id,
      ae.data_finalizacao,
      ae.fotos_entrega,
      array_length(ae.fotos_entrega, 1) as fotos_count
    FROM alocacoes_escala ae
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
      AND ae.fotos_entrega IS NOT NULL
      AND array_length(ae.fotos_entrega, 1) > 0
    ORDER BY ae.data_finalizacao DESC NULLS LAST
    LIMIT 20
  `);

  // 1.7 — Verificar se há fotos em metadata
  await q('1.7_fotos_metadata', `
    SELECT 
      ae.id,
      ae.data_finalizacao,
      ae.metadata->'fotos' as fotos_meta,
      ae.metadata->'pod' as pod_meta,
      ae.metadata->'entrega' as entrega_meta,
      ae.metadata->'comprovante' as comprovante_meta
    FROM alocacoes_escala ae
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
      AND (
        ae.metadata->'fotos' IS NOT NULL
        OR ae.metadata->'pod' IS NOT NULL
        OR ae.metadata->'entrega' IS NOT NULL
        OR ae.metadata->'comprovante' IS NOT NULL
      )
    ORDER BY ae.data_finalizacao DESC NULLS LAST
    LIMIT 20
  `);

  // 1.8 — Range de datas
  await q('1.8_range_datas', `
    SELECT 
      min(ae.data_finalizacao) as mais_antiga,
      max(ae.data_finalizacao) as mais_recente,
      min(ae.created_at) as criacao_min,
      max(ae.created_at) as criacao_max
    FROM alocacoes_escala ae
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
  `);

  // 1.9 — Comparar: as que TÊM delivery_proof
  await q('1.9_com_dp_referencia', `
    SELECT 
      ae.id,
      ae.created_at,
      ae.data_finalizacao,
      ae.prestador_id,
      ae.ordem_servico_id,
      ae.status,
      ae.metadata->'origem' as origem_meta,
      ae.metadata->>'central_financeira_manual' as manual_flag,
      dp.id as dp_id,
      dp.status as dp_status,
      dp.driver_id,
      dp.photo_url,
      dp.signature_url,
      dp.delivered_at,
      p.nome_completo as prestador_nome
    FROM alocacoes_escala ae
    INNER JOIN delivery_proofs dp ON dp.operation_id = ae.id::text
    LEFT JOIN prestadores p ON p.id = ae.prestador_id
    ORDER BY ae.data_finalizacao DESC NULLS LAST
  `);

  // 1.10 — Verificar OS vinculadas das 56
  await q('1.10_os_das_56', `
    SELECT 
      ae.id as alocacao_id,
      ae.ordem_servico_id,
      os.numero as os_numero,
      os.status as os_status,
      os.created_at as os_created,
      os.origem as os_origem,
      os.destino as os_destino
    FROM alocacoes_escala ae
    LEFT JOIN ordens_servico os ON os.id = ae.ordem_servico_id
    WHERE ae.status IN ('finalizada', 'concluida')
      AND NOT EXISTS (
        SELECT 1 FROM delivery_proofs dp WHERE dp.operation_id = ae.id::text
      )
      AND ae.ordem_servico_id IS NOT NULL
    ORDER BY ae.data_finalizacao DESC NULLS LAST
    LIMIT 20
  `);

  // Salvar
  const reportPath = path.join(__dirname, '..', '_core_e2e_pod02_classificacao.json');
  fs.writeFileSync(reportPath, JSON.stringify(R, null, 2));
  console.log(`\n📄 Salvo: ${reportPath}`);
}

main().catch(e => console.error(e)).finally(() => client.end());
