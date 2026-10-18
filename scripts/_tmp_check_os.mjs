import { readFileSync } from "node:fs";
import pg from "pg";

const root = process.argv[2];
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();

const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  SELECT numero, data, status, created_at, custo_prestador
  FROM ordens_servico
  ORDER BY created_at DESC
  LIMIT 8
`);
console.log("=== ordens_servico (8 mais recentes) ===");
for (const r of rows) {
  console.log(
    ` ${r.numero} | data=${String(r.data).slice(0,10)} | status=${r.status} | criada=${new Date(r.created_at).toISOString()} | custo_prestador=${r.custo_prestador}`
  );
}
const hoje = await c.query(`SELECT count(*)::int AS n FROM ordens_servico WHERE created_at::date = CURRENT_DATE`);
console.log(`\nOS criadas HOJE (producao): ${hoje.rows[0].n}`);
await c.end();
