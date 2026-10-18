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
  "TABELA_operacao_mensagens": `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name='operacao_mensagens'
    ORDER BY ordinal_position;`,
  "RLS_operacao_mensagens": `
    SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='operacao_mensagens' ORDER BY policyname;`,
  "RPCs_A22": `
    SELECT p.proname, pg_get_function_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('f_enviar_mensagem_torre','f_responder_mensagem_torre','f_marcar_mensagens_lidas_app','f_marcar_mensagens_lidas_torre','f_contar_mensagens_nao_lidas_torre')
    ORDER BY p.proname;`,
  "GRANTS_RPCs": `
    SELECT routine_name, grantee, privilege_type FROM information_schema.routine_privileges
    WHERE routine_schema='public' AND routine_name IN
      ('f_enviar_mensagem_torre','f_responder_mensagem_torre','f_marcar_mensagens_lidas_app','f_marcar_mensagens_lidas_torre','f_contar_mensagens_nao_lidas_torre')
    ORDER BY routine_name, grantee, privilege_type;`,
  "REALTIME_operacao_mensagens": `
    SELECT pubname, schemaname, tablename FROM pg_publication_tables
    WHERE tablename='operacao_mensagens';`,
  "RLS_portal_notificacoes_POS": `
    SELECT policyname, roles, cmd, qual FROM pg_policies WHERE tablename='portal_notificacoes' ORDER BY policyname;`,
  "INDICES_operacao_mensagens": `
    SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='operacao_mensagens';`,
  "FK_operacao_mensagens": `
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.table_name='operacao_mensagens' AND tc.constraint_type='FOREIGN KEY';`,
};

for (const [nome, sql] of Object.entries(queries)) {
  try {
    const res = await client.query(sql);
    console.log("\n===== " + nome + " =====");
    console.table(res.rows);
  } catch (e) {
    console.log("\n===== " + nome + " =====");
    console.log("ERRO: " + e.message);
  }
}

await client.end();
console.log("\nFIM_VERIFICACAO");
