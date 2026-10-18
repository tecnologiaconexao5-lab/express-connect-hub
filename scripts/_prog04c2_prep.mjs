import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s) => (await p.query(s)).rows;
for (const fn of ["trg_guardar_receber_pago_sem_baixa", "current_tenant_id_safe"]) {
  const r = await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${fn}'`);
  console.log("=== " + fn + " ===");
  console.log(r[0]?.def || "(nao encontrado)");
}
await p.end();
