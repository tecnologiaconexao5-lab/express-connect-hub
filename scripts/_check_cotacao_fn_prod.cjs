/* READ-ONLY: f_cotacao_detalhes_para_os — versão aplicada (janela de 31/10 presente?) */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_cotacao_detalhes_para_os'`,
  );
  if (!r.rowCount) { console.log("[FALTA] função não encontrada"); process.exit(1); }
  const def = r.rows[0].def;
  const checks = [
    ["janela (mig 31/10)", /janela/i.test(def)],
    ["janela_inicio (mig 31/10)", def.includes("janela_inicio")],
    ["enderecos (mig 29/10)", def.includes("enderecos")],
  ];
  checks.forEach(([name, ok]) => console.log(`${ok ? "[OK]  " : "[FALTA]"} corpo da função contém ${name}`));
  await c.end();
  process.exit(0);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
