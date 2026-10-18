/**
 * M86 — Fix region matching para compatibilidade de prestadores
 * 
 * 1. Atualiza regioes_secundarias dos prestadores
 * 2. Recria RPC com matching regional mais flexível
 * 
 * Uso: npx tsx -r dotenv/config scripts/m86_fix_region_matching.ts
 */

import pg from "pg";
import { guardHarness } from "./_guard.mjs";

// TMS-FIN-DATA-04D2 — guard fail-closed ANTES de qualquer conexao/escrita.
guardHarness("scripts/m86_fix_region_matching.ts");

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) { console.error("❌ DATABASE_URL not found"); process.exit(1); }

const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  console.log("=".repeat(60));
  console.log("M86 — FIX REGION MATCHING");
  console.log("=".repeat(60));

  // 1. Update prestadores with proper secondary regions
  console.log("\n📋 Atualizando regioes_secundarias dos prestadores...");
  
  await client.query(`
    UPDATE prestadores SET regioes_secundarias = ARRAY['Grande SP', 'São Paulo', 'SP']
    WHERE nome_completo ILIKE '%FRANKLIN%'
  `);
  console.log("   ✅ FRANKLIN: regioes_secundarias = {Grande SP, São Paulo, SP}");

  await client.query(`
    UPDATE prestadores SET regioes_secundarias = ARRAY['São Paulo', 'SP', 'Interior SP']
    WHERE nome_completo ILIKE '%CESAR%'
  `);
  console.log("   ✅ CESAR: regioes_secundarias = {São Paulo, SP, Interior SP}");

  await client.query(`
    UPDATE prestadores SET regioes_secundarias = ARRAY['São Paulo', 'SP', 'Rio de Janeiro', 'RJ', 'Belo Horizonte', 'MG']
    WHERE nome_completo ILIKE '%BRUNO%'
  `);
  console.log("   ✅ BRUNO: regioes_secundarias = {São Paulo, SP, RJ, BH, MG}");

  // 2. Recriar RPC with flexible region matching
  console.log("\n🔧 Recriando RPC com matching regional flexível...");
  
  await client.query(`DROP FUNCTION IF EXISTS public.f_buscar_prestadores_compativeis(UUID);`);
  
  await client.query(`
CREATE OR REPLACE FUNCTION public.f_buscar_prestadores_compativeis(p_oportunidade_id UUID)
RETURNS TABLE (
  prestador_id UUID,
  nome_completo TEXT,
  telefone TEXT,
  whatsapp TEXT,
  score_interno NUMERIC,
  tipo_veiculo TEXT,
  placa TEXT,
  capacidade_kg NUMERIC,
  regiao_principal TEXT,
  aceita_refrigerada BOOLEAN,
  status TEXT,
  score_match NUMERIC
) LANGUAGE plpgsql STABLE AS $func$
DECLARE
  v_os_id UUID;
  v_veiculo JSONB;
  v_regiao TEXT;
  v_requisitos JSONB;
  v_regiao_like TEXT;
  v_regiao_cidade TEXT;
  v_regiao_estado TEXT;
BEGIN
  SELECT r.os_id, r.veiculo_necessario, r.regiao, r.requisitos
  INTO v_os_id, v_veiculo, v_regiao, v_requisitos
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id AND r.status = 'publicada';

  IF NOT FOUND THEN RETURN; END IF;

  -- Preparar variações de região para matching flexível
  v_regiao_like := '%' || COALESCE(v_regiao, '') || '%';
  v_regiao_cidade := split_part(COALESCE(v_regiao, ''), '/', 1);
  v_regiao_estado := split_part(COALESCE(v_regiao, ''), '/', 2);

  RETURN QUERY
  WITH prestadores_filtrados AS (
    SELECT
      p.id,
      p.nome_completo,
      p.telefone,
      p.whatsapp,
      COALESCE(p.score_interno, 0) as score_interno,
      v.tipo_veiculo,
      v.placa,
      v.capacidade_kg,
      p.regiao_principal,
      p.aceita_refrigerada,
      p.status
    FROM prestadores p
    LEFT JOIN LATERAL (
      SELECT v2.tipo_veiculo, v2.placa, v2.capacidade_kg
      FROM veiculos v2
      WHERE v2.prestador_vinculado::text = p.id::text AND v2.status = 'Ativo'
      LIMIT 1
    ) v ON true
    WHERE
      p.status = 'ativo'
      AND (
        v_regiao IS NULL OR v_regiao = '' OR
        p.regiao_principal ILIKE v_regiao_like OR
        EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE v_regiao_like) OR
        (v_regiao_cidade <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_cidade || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_cidade || '%'))) OR
        (v_regiao_estado <> '' AND (p.regiao_principal ILIKE '%' || v_regiao_estado || '%' OR EXISTS (SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao_estado || '%')))
      )
  )
  SELECT
    pf.id, pf.nome_completo, pf.telefone, pf.whatsapp, pf.score_interno,
    pf.tipo_veiculo, pf.placa, pf.capacidade_kg, pf.regiao_principal,
    pf.aceita_refrigerada, pf.status,
    (
      CASE WHEN pf.tipo_veiculo IS NOT NULL AND (v_veiculo->>'tipo' IS NULL OR pf.tipo_veiculo ILIKE '%' || COALESCE(v_veiculo->>'tipo', '') || '%') THEN 35 ELSE 0 END +
      CASE WHEN pf.regiao_principal IS NOT NULL AND (v_regiao IS NULL OR v_regiao = '' OR pf.regiao_principal ILIKE v_regiao_like) THEN 25
           WHEN v_regiao IS NOT NULL AND v_regiao <> '' THEN 15 ELSE 0 END +
      CASE WHEN (v_veiculo->>'termica' IS NULL OR v_veiculo->>'termica' = 'seco') THEN 10 WHEN pf.aceita_refrigerada THEN 10 ELSE 0 END +
      CASE WHEN COALESCE(pf.score_interno, 0) >= 0.8 THEN 10 WHEN COALESCE(pf.score_interno, 0) >= 0.5 THEN 5 ELSE 0 END + 10 +
      CASE WHEN pf.tipo_veiculo IS NOT NULL THEN 10 ELSE 0 END
    )::NUMERIC AS score_match
  FROM prestadores_filtrados pf
  WHERE (v_veiculo IS NULL OR v_veiculo = '{}'::jsonb OR pf.tipo_veiculo IS NOT NULL)
  ORDER BY score_match DESC;
END;
$func$;
`);
  console.log("   ✅ RPC recriada com matching regional flexível");

  // 3. Test
  console.log("\n🔍 Testando RPC...");
  const test = await client.query(`SELECT * FROM f_buscar_prestadores_compativeis('00000000-0000-0000-0000-000000000000')`);
  console.log(`   UUID inválido: ${test.rows.length} rows (esperado 0)`);

  // Create a test opportunity to validate region matching
  console.log("\n📦 Criando OS e oportunidade para testar matching...");
  
  const osNumero = "M86-TEST-" + Date.now().toString(36).toUpperCase();
  const osId = crypto.randomUUID();
  
  await client.query(`
    INSERT INTO ordens_servico (id, numero, cliente_id, status, tipo_operacao, veiculo_tipo, custo_prestador, valor_cliente)
    VALUES ('${osId}', '${osNumero}', '04280785-4004-42c3-a406-886dd0730a8d', 'rascunho', 'Coleta e Entrega', 'VUC', 350, 650)
  `);

  const opId = crypto.randomUUID();
  await client.query(`
    INSERT INTO rede_oportunidades (id, os_id, valor_prestador, veiculo_necessario, regiao, prazo_expiracao)
    VALUES ('${opId}', '${osId}', 350, '{"tipo":"VUC","termica":"seco"}', 'São Paulo', NOW() + INTERVAL '1 day')
  `);

  const compat = await client.query(`SELECT * FROM f_buscar_prestadores_compativeis('${opId}')`);
  if (compat.rows.length > 0) {
    console.log(`   ✅ ${compat.rows.length} prestador(es) compatível(is) encontrado(s) para região "São Paulo":`);
    for (const row of compat.rows) {
      const nome = (row as any).nome_completo.padEnd(30);
      const veic = ((row as any).tipo_veiculo || "N/I").padEnd(10);
      const score = (row as any).score_match;
      console.log(`   ${nome} ${veic} ${score}pts`);
    }
  } else {
    console.log("   ⚠️  Nenhum prestador compatível (verificar dados)");
  }

  // Cleanup
  await client.query(`DELETE FROM rede_oportunidades WHERE id = '${opId}'`);
  await client.query(`DELETE FROM ordens_servico WHERE id = '${osId}'`);
  console.log("\n🧹 Dados de teste removidos");

  console.log("\n" + "=".repeat(60));
  console.log("✅ FIX REGION MATCHING CONCLUÍDO");
  console.log("=".repeat(60));

} finally {
  await client.end();
}
