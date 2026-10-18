import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const t = ["financeiro_pagar", "financeiro_receber", "financeiro_baixas", "pagamentos_prestadores", "ordens_servico", "faturas"];
for (const tb of t) {
  const r = await p.query("select column_name, data_type from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position", [tb]);
  console.log("=== " + tb + " (" + r.rows.length + ") ===");
  console.log(r.rows.map((x) => x.column_name + ":" + x.data_type).join(", "));
}
await p.end();
