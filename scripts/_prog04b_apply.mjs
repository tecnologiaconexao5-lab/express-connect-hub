// TMS-FIN-PROG-04B — aplica a migration em transação única.
import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = fs.readFileSync("supabase/migrations/20260924000000_fin_prog04b_numero_cliente_emissao_oficial.sql", "utf8");
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("MIGRATION APPLIED (COMMIT OK)");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
