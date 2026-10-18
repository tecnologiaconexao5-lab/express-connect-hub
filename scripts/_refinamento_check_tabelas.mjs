import { Client } from "pg";
import "dotenv/config";

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query(
  "SELECT tipo_veiculo, count(*) AS n FROM tabelas_valores WHERE ativo = true GROUP BY 1 ORDER BY 2 DESC"
);
console.table(r.rows);
const t = await c.query(
  "SELECT tipo_veiculo, nome, valor_base, franquia_km, valor_km_excedente, universal, cliente FROM tabelas_valores WHERE ativo = true ORDER BY tipo_veiculo LIMIT 20"
);
console.table(t.rows);
await c.end();
