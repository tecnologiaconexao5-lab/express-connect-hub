/* READ-ONLY: colunas de ordens_servico usadas para marcar cancelamento + trecho INSERT da RPC */
const fs = require("fs");
const { Client } = require("pg");
const url = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const cols = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='ordens_servico'
       AND column_name IN ('status','observacoes','observacao','historico','metadata','updated_at','orcamento_origem','pedido_interno')`
  );
  console.log("ordens_servico cols:", cols.rows.map((r) => `${r.column_name}:${r.data_type}`).join(" | "));

  const r = await c.query(
    `SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname='f_cotacao_detalhes_para_os'`
  );
  const lines = r.rows[0].prosrc.split("\n");
  console.log("\n== INSERT ordens_servico (contexto) ==");
  for (let i = 395; i < Math.min(lines.length, 445); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
  console.log("\n== orcamentos relevantes ==");
  const oc = await c.query(
    `SELECT column_name, data_type FROM information_schema.columns
     WHERE table_schema='public' AND table_name='orcamentos'
       AND column_name IN ('id','os_vinculada_id','pedido_interno','status','numero')`
  );
  console.log(oc.rows.map((x) => `${x.column_name}:${x.data_type}`).join(" | "));

  await c.end();
})().catch((e) => { console.error("ERRO:", e.message); process.exit(2); });
