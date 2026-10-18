import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const o = {};
o.cip = (await pool.query(`select schemaname, tablename, policyname, cmd, roles::text[] roles, qual, with_check
  from pg_policies where policyname like 'cip_%' or policyname like '%rec_062b%' or policyname ilike '%062b%'`)).rows;
o.policies_anon_public = (await pool.query(`select tablename, policyname, cmd from pg_policies
  where schemaname='public' and 'anon' = any(roles) order by tablename, policyname`)).rows;
o.tenant_users = (await pool.query(`select tu.user_id, tu.papel, u.email
  from tenant_usuarios tu left join auth.users u on u.id = tu.user_id limit 12`)).rows;
o.prestadores_com_auth = (await pool.query(`select id, nome_completo, auth_user_id, status, liberado_app from prestadores where auth_user_id is not null`)).rows;
o.candidatos_cols = (await pool.query(`select column_name from information_schema.columns where table_name='candidatos' and table_schema='public' order by ordinal_position`)).rows.map(r=>r.column_name);
console.log(JSON.stringify(o, null, 2));
await pool.end();
