import { readFileSync } from "node:fs";
import pg from "pg";
const root = process.argv[2];
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`SELECT * FROM ordens_servico WHERE numero = 'OS-202610-562467'`);
const r = rows[0];
if (!r) { console.log("nao achou"); }
else {
  const cols = ["numero","tipo_operacao","peso","veiculo","valor_cliente","custo_prestador","valor_prestador_calculado","status","prestador","cliente","romaneio"];
  for (const k of cols) if (k in r) console.log(` ${k} = ${JSON.stringify(r[k])}`);
  console.log("--- enderecos ---");
  for (const k of Object.keys(r)) if (/endereco|origem|destino|parada|coleta|entrega/i.test(k)) console.log(` ${k} = ${JSON.stringify(r[k])}`);
}
await c.end();
