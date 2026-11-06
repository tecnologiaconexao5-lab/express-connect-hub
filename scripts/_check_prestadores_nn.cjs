/* READ-ONLY: colunas obrigatorias de prestadores + origem_cadastro/endereco para o teste funcional */
const fs = require("fs");
const { Client } = require("pg");

const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const notnull = await c.query(
    `SELECT column_name, data_type, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name='prestadores'
       AND is_nullable='NO'
     ORDER BY ordinal_position`
  );
  console.log("== prestadores NOT NULL ==");
  for (const r of notnull.rows) console.log(`  ${r.column_name} (${r.data_type}) default=${r.column_default}`);

  const esp = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='prestadores'
       AND column_name IN ('origem','origem_cadastro','endereco','metadata','auth_user_id','cpf_cnpj','whatsapp','cidade')`
  );
  console.log("== colunas-chave do bridge ==");
  for (const r of esp.rows) console.log(`  ${r.column_name}: ${r.data_type}`);

  const prec = await c.query(
    `SELECT column_name, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='recrutamento_prestadores'
       AND is_nullable='NO' ORDER BY ordinal_position`
  );
  console.log("== recrutamento_prestadores NOT NULL ==");
  for (const r of prec.rows) console.log(`  ${r.column_name} default=${r.column_default}`);

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
