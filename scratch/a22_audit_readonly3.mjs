import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const queries = {
  "FUNCAO_f_registrar_notificacao_app": `
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_registrar_notificacao_app';`,
  "FUNCAO_reportar_ocorrencia_motorista": `
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='reportar_ocorrencia_motorista';`,
  "FUNCAO_f_obter_prestador_por_auth": `
    SELECT pg_get_functiondef(p.oid) AS def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='f_obter_prestador_por_auth';`,
  "GRANTS_f_registrar_notificacao_app": `
    SELECT grantee, privilege_type FROM information_schema.routine_privileges
    WHERE routine_schema='public' AND routine_name='f_registrar_notificacao_app'
    ORDER BY grantee;`,
  "TRIGGER_os_para_app": `
    SELECT tgname, tgrelid::regclass AS tabela, pg_get_triggerdef(oid) AS def
    FROM pg_trigger WHERE tgname='trg_notificar_os_para_app' OR tgname LIKE '%os_para_app%';`,
  "PROCS_NOTIFICACAO": `
    SELECT proname, pg_get_function_arguments(oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND (proname ~* 'notific')
    ORDER BY proname;`,
};

for (const [nome, sql] of Object.entries(queries)) {
  try {
    const res = await client.query(sql);
    console.log("\n===== " + nome + " =====");
    for (const r of res.rows) {
      for (const v of Object.values(r)) console.log(String(v));
    }
    if (res.rows.length === 0) console.log("(vazio)");
  } catch (e) {
    console.log("\n===== " + nome + " =====");
    console.log("ERRO: " + e.message);
  }
}

await client.end();
console.log("\nFIM3");
