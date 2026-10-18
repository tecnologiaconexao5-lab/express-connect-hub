import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = fs.readFileSync("supabase/migrations/20260924000002_fin_prog05b_ar_single_source.sql", "utf8");
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  await c.query("BEGIN");
  await c.query(sql);
  await c.query("COMMIT");
  console.log("MIGRATION APPLIED (COMMIT OK)");
} catch (e) {
  await c.query("ROLLBACK").catch(() => {});
  console.error("ROLLBACK:", e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
