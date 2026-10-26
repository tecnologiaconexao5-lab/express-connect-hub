// Read-only: inspeciona cotacoes_publicas + tabelas_valores antes da refatoração V2.
const fs = require("node:fs");
const path = require("node:path");
const pg = require("pg");

const env = path.resolve(__dirname, "..", ".env");
const linha = fs.readFileSync(env, "utf8").split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");

(async () => {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const cols = await c.query(
      "select column_name, data_type from information_schema.columns where table_name='cotacoes_publicas' order by ordinal_position",
    );
    console.log("COLS:", cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(", "));

    const cons = await c.query(
      "select conname, pg_get_constraintdef(oid) as d from pg_constraint where conrelid = 'public.cotacoes_publicas'::regclass",
    );
    console.log("CONSTRAINTS:", cons.rows.map((r) => `${r.conname} => ${r.d}`).join(" | "));

    const n = await c.query("select count(*)::int as n from public.cotacoes_publicas");
    console.log("ROWS cotacoes:", n.rows[0].n);

    const tv = await c.query(
      "select tipo_veiculo, universal, cliente, valor_base, franquia_km, valor_km_excedente from tabelas_valores where ativo = true order by universal desc nulls last limit 15",
    );
    console.log("TABELAS_VALORES ativas:", tv.rows.length);
    console.table(tv.rows);
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
