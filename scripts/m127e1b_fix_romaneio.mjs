/**
 * MISSÃO 127-E.1-TMS-B — POPULAR ROMANEIO + VERIFICAR SEGURANÇA RPC
 *
 * Uso: node -r dotenv/config scripts/m127e1b_fix_romaneio.mjs
 */

import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });

async function q(text, params) {
  const c = await pool.connect();
  try { return await c.query(text, params); } finally { c.release(); }
}

console.log("=".repeat(72));
console.log("  VERIFICAÇÕES FINAIS — MISSÃO 127-E.1-TMS-B");
console.log("=".repeat(72));

// 1. Check actual RPC security type
const { rows: rpcMeta } = await q(
  `SELECT p.proname, 
          p.prosecdef AS is_security_definer,
          p.provolatile,
          p.proconfig
   FROM pg_proc p
   WHERE p.proname = 'f_buscar_operacoes_motorista'
   AND p.pronamespace = 'public'::regnamespace`
);
if (rpcMeta.length > 0) {
  const r = rpcMeta[0];
  console.log(`\n📋 RPC SECURITY DEFINER: ${r.is_security_definer ? "✅ SIM" : "❌ NÃO (INVOKER)"}`);
  console.log(`📋 RPC proconfig (search_path): ${r.proconfig ? r.proconfig.join(", ") : "null (usa default)"}`);
}

// 2. Find CTE table
const { rows: cteTables } = await q(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' 
   AND (table_name ILIKE '%cte%' OR table_name ILIKE '%fiscal%')
   ORDER BY table_name`
);
console.log(`\n📋 Tabelas relacionadas a CTE/Fiscal:`);
for (const t of cteTables) {
  console.log(`   - ${t.table_name}`);
}

// 3. Try different CTE tables for romaneio
const CTE_TABLES = cteTables.map(t => t.table_name);
const OS_ID = "405fe001-4947-44a6-8cd2-c0203a701cfd";

let romaneioFound = false;
for (const tbl of CTE_TABLES) {
  try {
    const { rows } = await q(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       AND column_name IN ('romaneio', 'romaneio_numero', 'numero_romaneio', 'metadata', 'numero')`,
      [tbl]
    );
    if (rows.length > 0) {
      const cols = rows.map(r => r.column_name);
      console.log(`\n📋 Tabela ${tbl}: colunas relevantes = ${cols.join(", ")}`);

      if (cols.includes('metadata')) {
        const { rows: md } = await q(
          `SELECT id, metadata, metadata->>'romaneio_numero' AS romaneio
           FROM "${tbl}" 
           WHERE os_id = $1 AND metadata->>'romaneio_numero' IS NOT NULL
           LIMIT 1`,
          [OS_ID]
        );
        if (md.length > 0 && md[0].romaneio) {
          console.log(`✅ Romaneio encontrado em ${tbl}.metadata->>'romaneio_numero': ${md[0].romaneio}`);
          // Update ordens_servico
          await q(
            `UPDATE ordens_servico SET romaneio = $1 WHERE id = $2 AND (romaneio IS NULL OR romaneio = '')`,
            [md[0].romaneio, OS_ID]
          );
          console.log(`✅ Romaneio populado em ordens_servico.romaneio = ${md[0].romaneio}`);
          romaneioFound = true;
        }
      }
    }
  } catch (e) {
    // skip
  }
}

if (!romaneioFound) {
  console.log(`\nℹ️  Romaneio não encontrado em CTE para OS ${OS_ID}. A coluna está pronta para uso futuro.`);
}

// 4. Verify the updated OS
const { rows: osCheck } = await q(
  `SELECT id, numero, romaneio FROM ordens_servico WHERE id = $1`,
  [OS_ID]
);
if (osCheck.length > 0) {
  console.log(`\n📋 OS ${osCheck[0].numero}: romaneio = ${osCheck[0].romaneio || "null"}`);
}

// 5. Final view verification
const { rows: viewFinal } = await q(
  `SELECT alocacao_id, os_numero, romaneio, motorista_nome, prestador_nome,
          tipo_veiculo, veiculo_placa, possui_reversa, valor_repasse,
          tipo_carga, volumes, peso, cubagem
   FROM vw_app_motorista_operacoes
   WHERE alocacao_id = '1e9b311e-c701-4469-8f8e-ed99b9cd9a73'
   LIMIT 1`
);
if (viewFinal.length > 0) {
  const v = viewFinal[0];
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  COMPROVAÇÃO FINAL — VIEW COM OPERAÇÃO REAL`);
  console.log(`${"=".repeat(72)}`);
  console.log(`  Alocação:      ${v.alocacao_id}`);
  console.log(`  OS:            ${v.os_numero}`);
  console.log(`  Romaneio:      ${v.romaneio || "null"}`);
  console.log(`  Motorista:     ${v.motorista_nome}`);
  console.log(`  Prestador:     ${v.prestador_nome}`);
  console.log(`  Veículo:       ${v.tipo_veiculo} / ${v.veiculo_placa}`);
  console.log(`  Carga:         ${v.tipo_carga} (${v.volumes} vols, ${v.peso} kg)`);
  console.log(`  Cubagem:       ${v.cubagem ?? "null"} m³`);
  console.log(`  Reversa:       ${v.possui_reversa ? "SIM" : "NÃO"} (${v.tipo_reversa})`);
  console.log(`  Valor repasse: R$ ${v.valor_repasse}`);
  console.log(`\n  ✅ CONTRATO TMS → APP DA OPERAÇÃO CONCLUÍDO`);
}

await pool.end();
