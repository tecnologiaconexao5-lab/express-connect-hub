import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`select name, created_at from storage.objects
  where bucket_id='documentos_prestadores'
    and (lower(name) like '%gap%' or lower(name) like '%e2e%' or lower(name) like '%purge%')
  order by name`);
console.log("OBJETOS GAP/E2E PRESERVADOS:", r.rows.length);
for (const x of r.rows) console.log("  ", x.name, "|", x.created_at.toISOString());
const d = await c.query(`select count(*)::int n from documentos_prestadores`);
console.log("linhas documentos_prestadores:", d.rows[0].n);
const p = await c.query(`select count(*)::int n from prestadores where nome_completo like '02D2 FIXTURE %'`);
console.log("prestadores fixture restantes:", p.rows[0].n);
await c.end();
