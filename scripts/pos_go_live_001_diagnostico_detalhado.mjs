/**
 * PÓS GO-LIVE 001 — Diagnóstico detalhado
 * 
 * Foca nos gaps encontrados na validação:
 * 1. trg_cancelar_financeiro_escala ausente
 * 2. Alocações sem OS vinculada
 * 3. Alocações canceladas com financeiro ativo
 * 4. Qualidade dos dados de tracking
 * 5. Conversão de pedidos
 * 6. Fluxo financeiro completo
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function run(label, query) {
  try {
    const res = await pool.query(query);
    console.log(`\n══════════════════ ${label} ══════════════════`);
    if (res.rows.length === 0) console.log('(0 rows)');
    else console.table(res.rows);
    return res.rows;
  } catch (err) {
    console.log(`\n══════════════════ ${label} ══════════════════`);
    console.log(`ERROR: ${err.message}`);
    return [];
  }
}

async function main() {
  await pool.connect();
  console.log('✅ Conectado\n');

  // ============================================================
  // 1. DIAGNÓSTICO DO CANCEL TRIGGER
  // ============================================================
  await run('1.1 Trigger cancel ausente — detalhes',
    `SELECT tgname, tgrelid::regclass::text AS tbl, pg_get_triggerdef(oid) AS def
     FROM pg_trigger
     WHERE tgname ILIKE '%cancel%' AND NOT tgisinternal`
  );

  await run('1.2 Alocações canceladas que ainda têm financeiro ativo',
    `SELECT ae.id, ae.status, ae.status_pagamento,
            fr.id AS freceber_id, fr.status AS fr_status, fr.valor,
            fp.id AS fpagar_id, fp.status AS fp_status, fp.valor AS fp_valor,
            pp.id AS ppag_id, pp.status_pagamento AS pp_status
     FROM alocacoes_escala ae
     LEFT JOIN financeiro_receber fr ON fr.os_id = ae.id::TEXT
     LEFT JOIN financeiro_pagar fp ON fp.os_id = ae.id::TEXT
     LEFT JOIN pagamentos_prestadores pp ON pp.os_id = ae.id
     WHERE ae.status = 'cancelada'
       AND (fr.id IS NOT NULL OR fp.id IS NOT NULL OR pp.id IS NOT NULL)
     LIMIT 20`
  );

  // ============================================================
  // 2. QUALIDADE DAS ALOCAÇÕES
  // ============================================================
  await run('2.1 Distribuição de status das alocações',
    `SELECT status, COUNT(*) AS qtd,
            COUNT(*) FILTER (WHERE finalizada = true) AS finalizadas,
            COUNT(*) FILTER (WHERE aceite_prestador = true) AS aceitas,
            COUNT(*) FILTER (WHERE ordem_servico_id IS NOT NULL) AS com_os,
            COUNT(*) FILTER (WHERE cliente_id IS NOT NULL) AS com_cliente,
            COUNT(*) FILTER (WHERE prestador_id IS NOT NULL) AS com_prestador,
            COUNT(*) FILTER (WHERE valor_frete > 0) AS com_valor
     FROM alocacoes_escala
     GROUP BY status
     ORDER BY qtd DESC`
  );

  await run('2.2 Alocações sem OS vinculada',
    `SELECT id, status, prestador_id, cliente_id, created_at,
            aceite_prestador, data_aceite, finalizada, valor_frete
     FROM alocacoes_escala
     WHERE ordem_servico_id IS NULL
     ORDER BY created_at DESC
     LIMIT 20`
  );

  await run('2.3 Alocações com valores financeiros',
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE valor_frete > 0) AS com_frete,
            COUNT(*) FILTER (WHERE valor_repasse > 0) AS com_repasse,
            COUNT(*) FILTER (WHERE valor_pedagio > 0) AS com_pedagio,
            COUNT(*) FILTER (WHERE valor_adicional > 0) AS com_adicional,
            COUNT(*) FILTER (WHERE status_pagamento IS NOT NULL) AS com_status_pag,
            ROUND(AVG(COALESCE(valor_frete,0))::numeric, 2) AS media_frete,
            ROUND(AVG(COALESCE(valor_repasse,0))::numeric, 2) AS media_repasse,
            SUM(COALESCE(valor_frete,0)) AS total_frete,
            SUM(COALESCE(valor_repasse,0)) AS total_repasse
     FROM alocacoes_escala
     WHERE status NOT IN ('cancelada', 'rascunho')`
  );

  // ============================================================
  // 3. FLUXO DE CRIAÇÃO DE PEDIDO
  // ============================================================
  await run('3.1 Pedidos do Portal — status e conversão',
    `SELECT status, COUNT(*) AS qtd,
            COUNT(*) FILTER (WHERE os_vinculada_id IS NOT NULL) AS convertidos,
            COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS com_data_conversao,
            COUNT(*) FILTER (WHERE erro_processamento IS NOT NULL) AS com_erro
     FROM portal_pedidos
     GROUP BY status
     ORDER BY qtd DESC`
  );

  await run('3.2 Pedidos convertidos — OS vinculada existe?',
    `SELECT pp.id AS pedido_id, pp.numero_pedido, pp.status AS status_pedido,
            pp.os_vinculada_id, os.numero AS numero_os, os.status AS status_os
     FROM portal_pedidos pp
     LEFT JOIN ordens_servico os ON os.id = pp.os_vinculada_id
     WHERE pp.os_vinculada_id IS NOT NULL
     ORDER BY pp.created_at DESC`
  );

  // ============================================================
  // 4. FLUXO DE TRACKING
  // ============================================================
  await run('4.1 Tracking — resumo',
    `SELECT COUNT(*) AS total_pontos,
            COUNT(DISTINCT alocacao_id) AS alocacoes_rastreadas,
            MIN(created_at) AS primeiro_ponto,
            MAX(created_at) AS ultimo_ponto,
            COUNT(*) FILTER (WHERE velocidade > 0) AS com_velocidade,
            COUNT(*) FILTER (WHERE precisao IS NOT NULL) AS com_precisao,
            COUNT(*) FILTER (WHERE captured_at IS NOT NULL) AS com_captured_at
     FROM portal_tracking_realtime`
  );

  await run('4.2 Alocações concluídas com POD e tracking',
    `SELECT ae.id AS aloc_id, ae.status,
            ep.id IS NOT NULL AS tem_pod,
            ptr.alocacao_id IS NOT NULL AS tem_tracking,
            ae.horario_inicio_real IS NOT NULL AS iniciou,
            ae.horario_fim_real IS NOT NULL AS finalizou,
            ae.km_realizados, ae.comprovante_url IS NOT NULL AS tem_comprovante
     FROM alocacoes_escala ae
     LEFT JOIN entregas_protocolo ep ON ep.alocacao_id = ae.id
     LEFT JOIN (SELECT DISTINCT alocacao_id FROM portal_tracking_realtime) ptr ON ptr.alocacao_id = ae.id
     WHERE ae.status = 'concluida' AND ae.finalizada = true
     ORDER BY ae.data_finalizacao DESC
     LIMIT 20`
  );

  // ============================================================
  // 5. FLUXO FINANCEIRO — PROPAGAÇÃO FUNCIONANDO
  // ============================================================
  await run('5.1 Financeiro Receber — status',
    `SELECT status, COUNT(*) AS qtd,
            ROUND(SUM(COALESCE(valor,0))::numeric, 2) AS total_valor
     FROM financeiro_receber
     GROUP BY status
     ORDER BY qtd DESC`
  );

  await run('5.2 Financeiro Pagar — status',
    `SELECT status, COUNT(*) AS qtd,
            ROUND(SUM(COALESCE(valor,0))::numeric, 2) AS total_valor
     FROM financeiro_pagar
     GROUP BY status
     ORDER BY qtd DESC`
  );

  await run('5.3 Composição financeira — margens',
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE margem_bruta > 0) AS com_margem_positiva,
            COUNT(*) FILTER (WHERE margem_bruta <= 0) AS com_margem_negativa,
            ROUND(AVG(COALESCE(margem_bruta,0))::numeric,2) AS media_margem_bruta,
            ROUND(AVG(COALESCE(percentual_margem_bruta,0))::numeric,2) AS media_percentual_margem,
            ROUND(SUM(COALESCE(margem_bruta,0))::numeric,2) AS total_margem
     FROM composicao_financeira_os`
  );

  await run('5.4 Composição financeira — amostra',
    `SELECT os_id, valor_cliente, valor_prestador, pedagio_valor, outros_custos,
            margem_bruta, percentual_margem_bruta,
            imposto_valor, seguro_valor, margem_liquida, percentual_margem_liquida
     FROM composicao_financeira_os
     ORDER BY created_at DESC
     LIMIT 10`
  );

  // ============================================================
  // 6. EVENT BUS — EVENTOS POR ENTIDADE
  // ============================================================
  await run('6.1 Eventos — por entidade',
    `SELECT entity_type, event_type, COUNT(*) AS qtd
     FROM eventos_oficiais
     GROUP BY entity_type, event_type
     ORDER BY entity_type, qtd DESC`
  );

  // ============================================================
  // 7. ALOCAÇÕES COM FLUXO COMPLETO
  // ============================================================
  await run('7.1 Alocações com fluxo completo (criada→aceita→concluida→financeiro)',
    `SELECT ae.id, ae.status, ae.aceite_prestador, ae.data_aceite,
            ae.horario_inicio_real, ae.horario_fim_real, ae.finalizada,
            ep.nome_recebedor, fr.valor AS valor_fatura,
            fp.valor AS valor_pagar, cfo.margem_bruta, cfo.percentual_margem_bruta
     FROM alocacoes_escala ae
     LEFT JOIN entregas_protocolo ep ON ep.alocacao_id = ae.id
     LEFT JOIN financeiro_receber fr ON fr.os_id = ae.id::TEXT
     LEFT JOIN financeiro_pagar fp ON fp.os_id = ae.id::TEXT
     LEFT JOIN composicao_financeira_os cfo ON cfo.os_id = ae.id
     WHERE ae.status = 'concluida' AND ae.finalizada = true
     ORDER BY ae.data_finalizacao DESC
     LIMIT 10`
  );

  await pool.end();
  console.log('\n✅ Diagnóstico concluído');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
