/* READ-ONLY: logica de duplicatas do app_s6_criar_prestador (SELECT previo? ON CONFLICT?) */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const r = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'app_s6_criar_prestador'`);
  const b = r.rows[0].prosrc;

  console.log("== marcadores de duplicatas ==");
  console.log("  'SELECT' previo (retornar existente):", /SELECT[\s\S]{0,80}prestadores/.test(b));
  console.log("  'WHERE auth':", b.includes("auth_user_id"), "| 'WHERE email':", /auth_email|email/i.test(b));
  console.log("  'ON CONFLICT':", b.includes("ON CONFLICT"));
  console.log("  'EXISTS':", b.includes("EXISTS"));
  console.log("  INSERT:", b.includes("INSERT"));

  // linhas com SELECT/IF/INSERT relevantes
  console.log("== corpo (linhas relevantes) ==");
  b.split("\n").forEach((ln, i) => {
    if (/SELECT|INSERT|IF |RETURN|EXISTS|prestador_id/i.test(ln)) {
      console.log(`  ${String(i + 1).padStart(3)}: ${ln.trim().slice(0, 150)}`);
    }
  });

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
