/* READ-ONLY: blocos de geracao de numero nas funcoes que criam OS */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  for (const fn of ["f_cotacao_detalhes_para_os", "converter_pedido_para_os"]) {
    const r = await c.query(
      `SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=$1`,
      [fn]
    );
    console.log(`\n===== ${fn} =====`);
    const lines = r.rows[0].prosrc.split("\n");
    lines.forEach((l, i) => {
      if (/OS-|random|numero/i.test(l)) console.log(`${i + 1}: ${l}`);
    });
  }
  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
