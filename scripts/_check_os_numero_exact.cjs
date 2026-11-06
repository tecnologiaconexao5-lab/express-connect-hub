/* READ-ONLY: imprime blocos exatos de geracao de numero (com margem) */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const alvos = [
    { fn: "f_cotacao_detalhes_para_os", de: 388, ate: 402 },
    { fn: "converter_pedido_para_os", de: 66, ate: 80 },
  ];
  for (const a of alvos) {
    const r = await c.query(
      `SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND p.proname=$1`,
      [a.fn]
    );
    const lines = r.rows[0].prosrc.split("\n");
    console.log(`\n===== ${a.fn} linhas ${a.de}..${a.ate} =====`);
    for (let i = a.de - 1; i < Math.min(lines.length, a.ate); i++) {
      console.log(`${i + 1}|${lines[i]}`);
    }
  }
  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
