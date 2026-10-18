import { readFileSync } from "node:fs";
import pg from "pg";
const root = process.env.ROOT;
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const PREST = "f61e4161-6be7-46d8-be90-984b86222d08";
const VEI = "e674550f-c577-4d14-956c-b83df5e903b0";

const antes = await c.query(`SELECT id, prestador_vinculado, capacidade_kg, tipo_veiculo, status, placa FROM veiculos WHERE id=$1`, [VEI]);
console.log("ANTES:", JSON.stringify(antes.rows[0]));

await c.query(`UPDATE veiculos SET prestador_vinculado=$1, capacidade_kg=20, status='Ativo', updated_at=now() WHERE id=$2`, [PREST, VEI]);
const depois = await c.query(`SELECT id, prestador_vinculado, capacidade_kg, tipo_veiculo, status, placa FROM veiculos WHERE id=$1`, [VEI]);
console.log("DEPOIS:", JSON.stringify(depois.rows[0]));

const rpc = await c.query(`SELECT f_buscar_oportunidades_para_prestador($1::uuid) AS r`, [PREST]);
const r = rpc.rows[0].r;
console.log("RPC success:", r.success, "| total:", r.total);
for (const o of (r.oportunidades || [])) console.log("  -", o.numero, "| valor_prestador:", o.valor_prestador, "| tipo:", o.veiculo_necessario?.tipo, "| cap:", o.veiculo_necessario?.capacidade_kg, "| status:", o.status);
await c.end();
