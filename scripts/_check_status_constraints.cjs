/* READ-ONLY: constraints de status em cotacoes_publicas e ordens_servico */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  for (const tbl of ["cotacoes_publicas", "ordens_servico"]) {
    const r = await c.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint
       WHERE conrelid = $1::regclass AND contype = 'c'
       ORDER BY conname`,
      ["public." + tbl]
    );
    console.log(`== ${tbl} CHECKs ==`);
    for (const row of r.rows) console.log(`  ${row.conname}: ${row.def}`);
    const s = await c.query(
      `SELECT status, count(*)::int AS n FROM public.${tbl} GROUP BY status ORDER BY n DESC LIMIT 12`
    );
    console.log(`  valores atuais: ${s.rows.map((x) => `${x.status}(${x.n})`).join(", ")}`);
    console.log("");
  }

  const cols = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='cotacoes_publicas' AND column_name IN ('status','valor_aprovado','metadata')`
  );
  console.log("cotacoes_publicas cols:", cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(" "));

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
