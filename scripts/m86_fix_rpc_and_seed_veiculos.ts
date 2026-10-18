/**
 * M86 — Fix RPC + Seed veículos
 * 
 * 1. Recria RPC f_buscar_prestadores_compativeis usando veiculos (não veiculos_prestadores)
 * 2. Cadastra veículos para FRANKLIN, CESAR, BRUNO
 * 
 * Uso: npx tsx -r dotenv/config scripts/m86_fix_rpc_and_seed_veiculos.ts
 */

import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";
if (!DATABASE_URL) { console.error("❌ DATABASE_URL not found"); process.exit(1); }

async function query(sql: string) {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const result = await client.query(sql);
    return result;
  } finally {
    await client.end();
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("M86 — FIX RPC + SEED VEÍCULOS");
  console.log("=".repeat(60));

  // ============================================================
  // FASE 1: Atualizar RPC
  // ============================================================
  console.log("\n🔧 FASE 1 — Recriando RPC f_buscar_prestadores_compativeis...");
  console.log("   (Substituindo veiculos_prestadores → veiculos)");
  
  const dropSQL = `DROP FUNCTION IF EXISTS public.f_buscar_prestadores_compativeis(UUID);`;
  await query(dropSQL);
  console.log("   ✅ Função antiga removida");

  const createSQL = `
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
BEGIN
  SELECT r.os_id, r.veiculo_necessario, r.regiao, r.requisitos
  INTO v_os_id, v_veiculo, v_regiao, v_requisitos
  FROM rede_oportunidades r
  WHERE r.id = p_oportunidade_id AND r.status = 'publicada';

  IF NOT FOUND THEN RETURN; END IF;

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
      WHERE v2.prestador_vinculado = p.id::text AND v2.status = 'Ativo'
      LIMIT 1
    ) v ON true
    WHERE
      p.status = 'ativo'
      AND (p.historico_bloqueios IS NULL OR NOT (p.historico_bloqueios @> '[{"status": "ativo"}]'::jsonb))
      AND (v_regiao IS NULL OR p.regiao_principal ILIKE '%' || v_regiao || '%' OR EXISTS (
        SELECT 1 FROM unnest(p.regioes_secundarias) rs WHERE rs ILIKE '%' || v_regiao || '%'
      ))
  )
  SELECT
    pf.id, pf.nome_completo, pf.telefone, pf.whatsapp, pf.score_interno,
    pf.tipo_veiculo, pf.placa, pf.capacidade_kg, pf.regiao_principal,
    pf.aceita_refrigerada, pf.status,
    CASE WHEN pf.tipo_veiculo IS NOT NULL AND (v_veiculo->>'tipo' IS NULL OR pf.tipo_veiculo ILIKE '%' || COALESCE(v_veiculo->>'tipo', '') || '%') THEN 35 ELSE 0 END +
    CASE WHEN pf.regiao_principal IS NOT NULL AND (v_regiao IS NULL OR pf.regiao_principal ILIKE '%' || v_regiao || '%') THEN 25 ELSE 0 END +
    CASE WHEN (v_veiculo->>'termica' IS NULL OR v_veiculo->>'termica' = 'seco') THEN 10 WHEN pf.aceita_refrigerada THEN 10 ELSE 0 END +
    CASE WHEN COALESCE(pf.score_interno, 0) >= 0.8 THEN 10 WHEN COALESCE(pf.score_interno, 0) >= 0.5 THEN 5 ELSE 0 END + 10 +
    CASE WHEN pf.tipo_veiculo IS NOT NULL THEN 10 ELSE 0 END AS score_match
  FROM prestadores_filtrados pf
  WHERE (v_veiculo IS NULL OR v_veiculo = '{}'::jsonb OR pf.tipo_veiculo IS NOT NULL)
  ORDER BY score_match DESC;
END;
$func$;
`;

  await query(createSQL);
  console.log("   ✅ RPC recriada usando tabela veiculos");

  // ============================================================
  // FASE 2: Cadastrar veículos
  // ============================================================
  console.log("\n🚚 FASE 2 — Cadastrando veículos...");

  const veiculosData = [
    { tipo: "VUC", placa: "ABC-1F23", kg: 3000, m3: 15, prestador: "be420cfc-878e-49b3-8a0d-1827b34762a5" },
    { tipo: "Van", placa: "ABC-1F24", kg: 1500, m3: 8, prestador: "be420cfc-878e-49b3-8a0d-1827b34762a5" },
    { tipo: "Toco", placa: "DEF-2C45", kg: 8000, m3: 40, prestador: "fe7a75cc-a49f-43ef-a0b7-f869fbf07744" },
    { tipo: "VUC", placa: "GHI-3B67", kg: 3000, m3: 15, prestador: "659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce" },
    { tipo: "Van", placa: "GHI-3B68", kg: 1000, m3: 6, prestador: "659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce" },
    { tipo: "Bitruck", placa: "GHI-3B69", kg: 5000, m3: 25, prestador: "659f95ec-779b-4d6e-9fc7-e06ee8a6b6ce" },
  ];

  for (const v of veiculosData) {
    // Check if exists
    const exists = await query(`SELECT id FROM veiculos WHERE placa = '${v.placa}'`);
    if (exists.rows.length > 0) {
      console.log(`   ⏭️  ${v.placa} já existe`);
      continue;
    }

    await query(`
      INSERT INTO veiculos (placa, tipo_veiculo, capacidade_kg, capacidade_m3, prestador_vinculado, status)
      VALUES ('${v.placa}', '${v.tipo}', ${v.kg}, ${v.m3}, '${v.prestador}', 'Ativo')
    `);
    console.log(`   ✅ ${v.placa} — ${v.tipo} ${v.kg}kg → ${v.prestador.slice(0, 8)}...`);
  }

  // ============================================================
  // FASE 3: Verificar
  // ============================================================
  console.log("\n📊 FASE 3 — Verificando...");
  const veiculos = await query(`
    SELECT v.placa, v.tipo_veiculo, v.status, p.nome_completo
    FROM veiculos v
    LEFT JOIN prestadores p ON p.id::text = v.prestador_vinculado
    WHERE v.placa IN ('ABC-1F23','ABC-1F24','DEF-2C45','GHI-3B67','GHI-3B68','GHI-3B69')
  `);

  if (veiculos.rows.length > 0) {
    for (const v of veiculos.rows) {
      console.log(`   ${v.placa.padEnd(10)} ${(v.tipo_veiculo || "N/I").padEnd(10)} [${v.status}] → ${v.nome_completo || "N/I"}`);
    }
  }

  // Test RPC
  console.log("\n🔍 Testando RPC...");
  const test = await query(`SELECT * FROM f_buscar_prestadores_compativeis('00000000-0000-0000-0000-000000000000')`);
  console.log(`   RPC executada: ${test.rows.length} linhas`);

  // Complete M85 validation
  console.log("\n🔍 Executando validação M85 completa...");
  const { execSync } = await import("child_process");
  try {
    const output = execSync("npx tsx -r dotenv/config scripts/m85_validar_rede.ts", {
      cwd: process.cwd(),
      encoding: "utf8",
      timeout: 60000,
    });
    console.log(output);
  } catch (err: any) {
    console.log(`   Validação: ${err.stdout || err.message}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ MISSAO 86 — SEED CONCLUÍDO");
  console.log("=".repeat(60));
}

main().catch(console.error);
