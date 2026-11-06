/* READ-ONLY:列 de recrutamento_avaliacoes + recrutamento_cenarios em produção */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const t of ["recrutamento_avaliacoes", "recrutamento_cenarios"]) {
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [t],
    );
    console.log(`\n${t} (${r.rowCount} colunas):`);
    r.rows.forEach((x) => console.log(`  - ${x.column_name} (${x.data_type})`));
  }
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
