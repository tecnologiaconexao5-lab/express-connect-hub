import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const r = await pool.query(`
  select p.proname, p.provolatile, p.prosecdef, p.proowner::regrole as owner,
         p.proacl::text acl, length(p.prosrc) src_len, p.prosrc
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname in ('f_bridge_prestador_para_recrutamento','current_tenant_id_safe')
   order by p.proname`);
console.log(JSON.stringify(r.rows, null, 2));
// bypassrls de service_role
const s = await pool.query(`select rolname, rolbypassrls, rolsuper from pg_roles where rolname in ('service_role','anon','authenticated')`);
console.log(JSON.stringify(s.rows, null, 2));
await pool.end();
