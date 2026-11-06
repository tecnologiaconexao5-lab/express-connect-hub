/* READ-ONLY: NOT NULL de ordens_servico/orcamentos + tipos de vinculo */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  for (const tbl of ["ordens_servico", "orcamentos"]) {
    const r = await c.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND is_nullable='NO'
       ORDER BY ordinal_position`,
      [tbl]
    );
    console.log(`== ${tbl} NOT NULL ==`);
    console.log("  " + r.rows.map((x) => `${x.column_name}(${x.data_type})`).join(", "));
  }

  const t = await c.query(
    `SELECT column_name, data_type, udt_name FROM information_schema.columns
     WHERE table_schema='public'
       AND ((table_name='ordens_servico' AND column_name IN ('orcamento_id','numero','cliente','cliente_id','data'))
         OR (table_name='orcamentos' AND column_name IN ('os_vinculada_id','pedido_interno','numero','cliente','cliente_id','id')))`
  );
  console.log("\n== tipos de vinculo ==");
  for (const row of t.rows) console.log(`  ${row.table_name}.${row.column_name}: ${row.data_type}/${row.udt_name}`);

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
