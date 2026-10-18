import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const nums = ["ALOC-20260626-DCE846FF", "OS-M43_2026-06-29_18-31-49", "ALOC-20260817-58E5751E", "OS-202610-915214"];
for (const n of nums) {
  const r = await c.query(`select numero, status, valor_cliente, custo_prestador, pedagio, adicionais, ajudante, descontos, created_at::date from ordens_servico where numero=$1 limit 1`, [n]);
  console.log(n, "=>", JSON.stringify(r.rows[0]));
}
// divergencias por data
const d = JSON.parse(fs.readFileSync("scripts/_e2e02fin_validacao.json", "utf8"));
console.log("\nTotal div APxPP:", d.divergencias.APxPP.length, "| div margem:", d.divergencias.margem.length);
await c.end();
