// MISSÃO 77 — Aplicar migration P0 do Engine de Precificação
// Uso: node scripts/m77_aplicar_migration.cjs
const { Client } = require("pg");
const { readFileSync } = require("fs");
const { resolve } = require("path");
require("dotenv").config({ path: resolve(__dirname, "..", ".env") });

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error("❌ DATABASE_URL não encontrada no .env");
  console.error("   Para aplicar manualmente: abra Supabase Dashboard > SQL Editor e cole o conteúdo da migration.");
  process.exit(1);
}

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260705_m76_p0_precificacao_engine.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function checkBefore() {
  console.log("\n🔍 VERIFICAÇÃO PRÉ-MIGRAÇÃO\n");

  // Tabelas
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     AND table_name IN ('tabelas_valores', 'tabela_prestador', 'alocacoes_escala')
     ORDER BY table_name`
  );
  console.log("📋 Tabelas:", tables.rows.map(r => r.table_name).join(", "));

  // Colunas de tabelas_valores
  const colsTV = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'tabelas_valores' ORDER BY ordinal_position`
  );
  const colNamesTV = colsTV.rows.map(r => r.column_name);
  console.log("\n📋 tabelas_valores colunas:", colNamesTV.join(", "));
  console.log("   tenant_id existe:", colNamesTV.includes("tenant_id"));
  console.log("   franquia_km existe:", colNamesTV.includes("franquia_km"));
  console.log("   km_franquia existe:", colNamesTV.includes("km_franquia"));
  console.log("   percentual_prestador existe:", colNamesTV.includes("percentual_prestador"));

  // Colunas de tabela_prestador
  const colsTP = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'tabela_prestador' ORDER BY ordinal_position`
  );
  const colNamesTP = colsTP.rows.map(r => r.column_name);
  console.log("\n📋 tabela_prestador colunas:", colNamesTP.join(", "));
  console.log("   tenant_id existe:", colNamesTP.includes("tenant_id"));

  // Triggers
  const triggers = await client.query(
    `SELECT tgname, proname
     FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
     WHERE tgrelid = 'alocacoes_escala'::regclass AND t.tgisinternal = false`
  );
  console.log("\n🔍 Triggers em alocacoes_escala:");
  triggers.rows.forEach(r => console.log("   -", r.tgname));

  // RLS Policies
  const rlsTV = await client.query(
    `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tabelas_valores'`
  );
  console.log("\n🔒 RLS Policies em tabelas_valores:");
  if (rlsTV.rows.length === 0) console.log("   (nenhuma)");
  else rlsTV.rows.forEach(r => console.log("   -", r.policyname, `(${r.cmd})`));

  // RLS tabela_prestador
  const rlsTPenabled = await client.query(
    `SELECT relrowsecurity FROM pg_class WHERE relname = 'tabela_prestador'`
  );
  console.log("\n🔒 RLS ativa em tabela_prestador:", rlsTPenabled.rows[0]?.relrowsecurity ? "✅ Sim" : "❌ Não");
  const rlsTPpolicies = await client.query(
    `SELECT policyname FROM pg_policies WHERE tablename = 'tabela_prestador'`
  );
  if (rlsTPpolicies.rows.length > 0) {
    rlsTPpolicies.rows.forEach(r => console.log("   Policy:", r.policyname));
  }
}

async function main() {
  try {
    await client.connect();
    console.log("✅ Conectado ao Supabase via DATABASE_URL");

    await checkBefore();

    console.log("\n" + "=".repeat(60));
    console.log("🚀 APLICANDO MIGRATION...");
    console.log("=".repeat(60) + "\n");

    // Execute the migration SQL
    await client.query(sql);
    console.log("✅ Migration aplicada com sucesso!\n");

    // Verify post-migration
    console.log("🔍 VERIFICAÇÃO PÓS-MIGRAÇÃO\n");

    // Re-check columns
    const colsTV2 = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tabelas_valores' ORDER BY ordinal_position`
    );
    const colNamesTV2 = colsTV2.rows.map(r => r.column_name);
    console.log("📋 tabelas_valores colunas:", colNamesTV2.join(", "));
    console.log("   tenant_id:", colNamesTV2.includes("tenant_id") ? "✅" : "❌");
    console.log("   franquia_km:", colNamesTV2.includes("franquia_km") ? "✅" : "❌");
    console.log("   percentual_prestador:", colNamesTV2.includes("percentual_prestador") ? "✅" : "❌");

    const colsTP2 = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'tabela_prestador' ORDER BY ordinal_position`
    );
    const colNamesTP2 = colsTP2.rows.map(r => r.column_name);
    console.log("\n📋 tabela_prestador colunas:", colNamesTP2.join(", "));
    console.log("   tenant_id:", colNamesTP2.includes("tenant_id") ? "✅" : "❌");

    // Re-check triggers - P0 should be gone, M66 should remain
    const triggers2 = await client.query(
      `SELECT tgname, proname
       FROM pg_trigger t JOIN pg_proc p ON t.tgfoid = p.oid
       WHERE tgrelid = 'alocacoes_escala'::regclass AND t.tgisinternal = false`
    );
    console.log("\n🔍 Triggers em alocacoes_escala:");
    triggers2.rows.forEach(r => console.log("   -", r.tgname, r.tgname.includes("p0") ? "❌ P0 (deveria ter sido removida)" : "✅"));
    if (triggers2.rows.length === 0) console.log("   ⚠️ Nenhuma trigger encontrada! Trigger M66 pode não estar presente.");

    // Re-check RLS
    const rlsTV2 = await client.query(
      `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tabelas_valores' ORDER BY cmd`
    );
    console.log("\n🔒 RLS Policies em tabelas_valores:");
    rlsTV2.rows.forEach(r => console.log("   -", r.policyname, `(${r.cmd})`));

    const rlsTPenabled2 = await client.query(
      `SELECT relrowsecurity FROM pg_class WHERE relname = 'tabela_prestador'`
    );
    console.log("\n🔒 RLS ativa em tabela_prestador:", rlsTPenabled2.rows[0]?.relrowsecurity ? "✅ Sim" : "❌ Não");
    const rlsTPpolicies2 = await client.query(
      `SELECT policyname, cmd FROM pg_policies WHERE tablename = 'tabela_prestador'`
    );
    rlsTPpolicies2.rows.forEach(r => console.log("   -", r.policyname, `(${r.cmd})`));

    // Check índices
    console.log("\n📊 Índices criados:");
    const indices = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE tablename IN ('tabelas_valores', 'tabela_prestador')
       AND schemaname = 'public'
       ORDER BY tablename, indexname`
    );
    indices.rows.forEach(r => console.log("   -", r.indexname, `(${r.indexdef})`));

    console.log("\n" + "=".repeat(60));
    console.log("✅ MIGRAÇÃO VERIFICADA E CONCLUÍDA");
    console.log("=".repeat(60));

  } catch (err) {
    console.error("❌ Erro:", err.message);
    if (err.message.includes("syntax error") || err.message.includes("relation") || err.message.includes("column")) {
      console.error("\n   💡 Detalhe SQL do erro acima. Verifique a migration.");
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
