const { Client } = require("pg");
require("dotenv").config();
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const def = (await c.query("select pg_get_functiondef('public.f_usuario_pode_acessar_cliente(uuid)'::regprocedure) d")).rows[0]?.d;
  console.log(def || "function not found");
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });
