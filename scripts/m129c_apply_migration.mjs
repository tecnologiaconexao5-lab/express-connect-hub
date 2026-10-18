// MISSAO 129-C — Aplicar migration da tabela reembolsos_prestador
// Uso: node scripts/m129c_apply_migration.mjs
import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  console.error("❌ Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260805_m129c_reembolsos_prestador_oficial.sql"),
  "utf8"
);

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    await client.connect();
    console.log("✅ Conectado ao Supabase");
    console.log("📦 Aplicando migration M129C...");
    await client.query(sql);
    console.log("✅ Migration M129C aplicada com sucesso!");

    // Verificar que a tabela existe
    const { rows } = await client.query(
      "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reembolsos_prestador') AS existe"
    );
    console.log(`📊 Tabela reembolsos_prestador existe: ${rows[0].existe}`);

    // Verificar RLS
    const { rows: rlsRows } = await client.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname = 'reembolsos_prestador'"
    );
    console.log(`🔒 RLS ativo: ${rlsRows[0]?.relrowsecurity === true}`);

    // Listar policies
    const { rows: policies } = await client.query(
      "SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'reembolsos_prestador' ORDER BY policyname"
    );
    console.log(`📋 Policies (${policies.length}):`);
    for (const p of policies) {
      console.log(`   - ${p.policyname} (${p.cmd}) [${p.roles.join(", ")}]`);
    }

    // Schema cache reload
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log("🔄 Schema cache reloaded!");

  } catch (err) {
    console.error("❌ Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
