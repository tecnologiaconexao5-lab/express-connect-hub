import pg from "pg";
import fs from "node:fs";
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const arq = "supabase/migrations/20260927000001_adm_app_02c2_rollback.sql";
const sql = fs.readFileSync(arq, "utf8");
const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await client.connect();
const r = { arquivo: arq, bytes: Buffer.byteLength(sql) };
try {
  await client.query(sql);                 // arquivo comeca com BEGIN; e NAO tem COMMIT
  r.parse_ok = true;
  r.policies_rollback = (await client.query(
    `select count(*)::int n from pg_policies where schemaname='public'
       and tablename in ('recrutamento_candidatos','recrutamento_prestadores',
                         'recrutamento_operacoes','candidato_documentos','candidatos')
       and policyname not like '%_tms_%'`)).rows[0].n;
  await client.query("ROLLBACK");          // desfaz o rollback de teste
  r.rollback_aplicado_de_volta = true;
  const pos = (await client.query(
    `select count(*)::int n from pg_policies where schemaname='public'
       and tablename in ('recrutamento_candidatos') and policyname like '%_tms_%'`)).rows[0].n;
  r.policies_tms_intactas = pos;
  r.estado_final = (pos === 4) ? "MIGRATION PERMANECE APLICADA" : "ATENCAO - verificar";
} catch (e) {
  try { await client.query("ROLLBACK"); } catch (_) {}
  r.parse_ok = false; r.erro = e.message; r.sqlstate = e.code;
}
console.log(JSON.stringify(r, null, 2));
await client.end();
