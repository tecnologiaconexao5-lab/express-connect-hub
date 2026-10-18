/**
 * MISSÃO 127-E.1-TMS-B — APLICAR MIGRATION (v2 — com DROP VIEW)
 *
 * Aplica a migration do contrato App Motorista no Supabase TMS.
 * Usa DROP VIEW + CREATE VIEW para contornar limitação de column rename.
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("❌ DATABASE_URL não definida no .env"); process.exit(1); }

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function run(client, label, sql) {
  try {
    await client.query(sql);
    console.log(`  ✅ ${label}`);
    return true;
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("already has")) {
      console.log(`  ⏭️  ${label} (já existe)`);
      return true;
    }
    console.log(`  ❌ ${label}: ${msg.substring(0, 200)}`);
    return false;
  }
}

const VIEW_SQL = `
CREATE VIEW public.vw_app_motorista_operacoes AS
SELECT
  a.id AS alocacao_id,
  a.ordem_servico_id AS os_id,
  a.prestador_id AS motorista_id,
  a.prestador_id AS prestador_id,
  a.cliente_id,
  a.status,
  a.data_escala,
  COALESCE(a.metadata->>'operation_mode',
    CASE WHEN a.tipo_reversa IS DISTINCT FROM 'sem_reversa' THEN 'reverse_logistics' ELSE 'standard_delivery' END
  ) AS operation_mode,
  a.metadata,
  os.numero AS os_numero,
  os.romaneio,
  os.tipo_operacao,
  os.prioridade,
  os.instrucoes_operacionais_os,
  os.enderecos,
  a.data_aceite,
  a.horario_inicio_real,
  a.horario_fim_real,
  a.tempo_total_minutos,
  r.horario_previsto,
  a.origem,
  a.destino,
  v.id AS veiculo_id,
  a.tipo_veiculo,
  a.placa AS veiculo_placa,
  a.placa,
  CASE WHEN v.id IS NOT NULL THEN 'prestador_fallback' ELSE NULL END AS veiculo_origem,
  os.carga_tipo,
  os.carga_refrigerada,
  os.tipo_carga,
  os.carga_descricao,
  os.volumes,
  os.peso,
  os.cubagem,
  os.pallets,
  os.valor_declarado,
  p.nome_completo AS motorista_nome,
  p.nome_completo AS prestador_nome,
  NULL::text AS prestador_nome_fantasia,
  p.telefone AS motorista_telefone,
  p.whatsapp AS motorista_whatsapp,
  c.nome_fantasia AS cliente_nome,
  c.razao_social AS cliente_razao_social,
  c.telefone AS cliente_telefone,
  c.cidade AS cliente_cidade,
  c.uf AS cliente_uf,
  a.valor_frete,
  a.valor_repasse,
  a.km_previstos,
  a.km_realizados,
  a.aceite_prestador,
  r.id AS rota_id,
  r.nome AS rota_nome,
  r.status AS rota_status,
  r.distancia_km AS rota_distancia_km,
  r.numero_paradas,
  r.paradas_pendentes,
  (SELECT COUNT(*) FROM public.rota_paradas rp WHERE rp.rota_id = r.id AND rp.status = 'pendente') AS paradas_pendentes_count,
  r.operation_mode AS rota_operation_mode,
  a.tipo_reversa,
  CASE WHEN a.tipo_reversa IS DISTINCT FROM 'sem_reversa' THEN true ELSE false END AS possui_reversa,
  a.reversa_status,
  a.reversa_qtd_volumes,
  a.reversa_qtd_coletada,
  a.reversa_unidade_cobranca,
  a.reversa_motivo_divergencia,
  a.reversa_responsavel,
  a.reversa_telefone,
  a.reversa_data_prevista,
  a.reversa_observacoes,
  a.reversa_endereco_coleta,
  a.reversa_endereco_devolucao,
  a.reversa_valor_prestador,
  a.reversa_pod_url,
  a.reversa_fotos,
  a.reversa_realizada_em,
  a.reversa_assinatura_url,
  a.reversa_latitude,
  a.reversa_longitude,
  a.observacoes,
  a.instrucoes_operacionais,
  tr.latitude,
  tr.longitude,
  tr.velocidade,
  tr.ultima_atualizacao
FROM public.alocacoes_escala a
LEFT JOIN public.clientes c ON c.id = a.cliente_id
LEFT JOIN public.ordens_servico os ON os.id = a.ordem_servico_id
LEFT JOIN public.prestadores p ON p.id = a.prestador_id
LEFT JOIN LATERAL (
  SELECT id FROM public.veiculos
  WHERE prestador_vinculado::text = a.prestador_id::text
    AND UPPER(TRIM(placa)) = UPPER(TRIM(a.placa))
    AND (status IS NULL OR status = 'Ativo')
  LIMIT 1
) v ON true
LEFT JOIN public.rotas r ON r.alocacao_id = a.id
LEFT JOIN LATERAL (
  SELECT latitude, longitude, velocidade, updated_at AS ultima_atualizacao
  FROM public.portal_tracking_realtime WHERE alocacao_id = a.id
  ORDER BY updated_at DESC NULLS LAST LIMIT 1
) tr ON true
WHERE a.prestador_id IS NOT NULL;
`;

const RPC_SQL = `
CREATE OR REPLACE FUNCTION public.f_buscar_operacoes_motorista(
  p_prestador_id UUID,
  p_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result JSONB;
  v_total INTEGER;
  v_auth_uid UUID;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Usuário não autenticado');
  END IF;
  IF EXISTS (SELECT 1 FROM public.prestadores WHERE id = p_prestador_id AND auth_user_id IS NOT NULL AND auth_user_id != v_auth_uid) THEN
    RETURN jsonb_build_object('sucesso', false, 'erro', 'Acesso negado: prestador não corresponde ao usuário autenticado');
  END IF;
  SELECT jsonb_agg(row_to_json(t)) INTO v_result
  FROM (
    SELECT * FROM public.vw_app_motorista_operacoes v
    WHERE v.prestador_id = p_prestador_id
      AND (p_status IS NULL OR v.status = p_status)
    ORDER BY v.data_escala DESC, v.alocacao_id DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  SELECT COUNT(*) INTO v_total
  FROM public.vw_app_motorista_operacoes v
  WHERE v.prestador_id = p_prestador_id
    AND (p_status IS NULL OR v.status = p_status);
  RETURN jsonb_build_object(
    'sucesso', true,
    'prestador_id', p_prestador_id,
    'operacoes', COALESCE(v_result, '[]'::jsonb),
    'total', v_total
  );
END;
$$;
`;

const SECTIONS = [
  { label: "ALTER TABLE ordens_servico ADD romaneio",
    sql: "ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS romaneio TEXT;" },
  { label: "COMMENT ON COLUMN romaneio",
    sql: "COMMENT ON COLUMN public.ordens_servico.romaneio IS 'Numero do romaneio/lote da operacao. Missao 127-E.1.';" },
  { label: "DROP VIEW IF EXISTS vw_app_motorista_operacoes",
    sql: "DROP VIEW IF EXISTS public.vw_app_motorista_operacoes CASCADE;" },
  { label: "CREATE VIEW vw_app_motorista_operacoes", sql: VIEW_SQL },
  { label: "COMMENT ON VIEW",
    sql: "COMMENT ON VIEW public.vw_app_motorista_operacoes IS 'M127-E.1 — View oficial App Motorista. Contrato unico TMS→App. Inclui veiculo_id, motorista_nome, prestador_nome, possui_reversa, romaneio, horario_previsto, paradas_pendentes_count.';" },
  { label: "GRANT SELECT TO anon, authenticated",
    sql: "GRANT SELECT ON public.vw_app_motorista_operacoes TO anon, authenticated;" },
  { label: "CREATE OR REPLACE FUNCTION f_buscar_operacoes_motorista", sql: RPC_SQL },
  { label: "COMMENT ON FUNCTION",
    sql: "COMMENT ON FUNCTION public.f_buscar_operacoes_motorista IS 'M127-E.1 — Busca operações do motorista. Consome vw_app_motorista_operacoes. Valida auth.uid() contra prestadores.auth_user_id.';" },
  { label: "GRANT EXECUTE TO authenticated",
    sql: "GRANT EXECUTE ON FUNCTION public.f_buscar_operacoes_motorista TO authenticated;" },
];

async function main() {
  console.log("=".repeat(72));
  console.log("  APLICAR MIGRATION — MISSÃO 127-E.1-TMS (v2)");
  console.log("  CONTRATO OFICIAL DE DADOS DA OPERACAO PARA O APP MOTORISTA");
  console.log("=".repeat(72));

  const client = await pool.connect();
  try {
    let ok = 0, err = 0;
    for (const section of SECTIONS) {
      const result = await run(client, section.label, section.sql);
      if (result) ok++; else err++;
    }
    console.log(`\n  RESULTADO: ${ok} ok, ${err} erros`);
  } finally {
    client.release();
  }

  await pool.end();
  process.exit(err > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
