import { readFileSync } from "node:fs";
import pg from "pg";
const root = process.env.ROOT;
const env = readFileSync(`${root}/.env`, "utf8");
const db = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL=")).slice("DATABASE_URL=".length).trim();
const c = new pg.Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  SELECT ro.status, ro.prestador_aceite_id, ro.aceite_em, os.numero, os.prestador_id, os.status AS os_status
  FROM rede_oportunidades ro LEFT JOIN ordens_servico os ON os.id=ro.os_id
  WHERE os.numero IN ('OS-202610-756051','OS-202610-634957') ORDER BY ro.created_at DESC`);
console.log(JSON.stringify(rows, null, 2));
await c.end();
