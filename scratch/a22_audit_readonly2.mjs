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
  "VIEW_APP_NOTIFICACOES": `
    SELECT definition FROM pg_views WHERE schemaname='public' AND viewname='vw_app_notificacoes_pendentes';`,
  "RPC_MOTORISTA_FIX": `
    SELECT r.routine_name, r.data_type AS retorno
    FROM information_schema.routines r
    WHERE r.routine_schema='public' AND r.routine_name ~* 'motorista|prestador|reversa|etapa|operacoes|posicao|mensagem|notific'
    ORDER BY r.routine_name;`,
  "COLUNAS_PREF_OCORRENCIAS": `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('prestadores_ocorrencias','os_ocorrencias','ocorrencias')
    ORDER BY table_name, ordinal_position;`,
  "COLUNAS_WHATSAPP_CONVERSAS": `
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name IN ('whatsapp_conversas','recrutamento_whatsapp_conversas')
    ORDER BY table_name, ordinal_position;`,
  "COLUNAS_PRESTADORES_CHAT": `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='prestadores'
      AND (column_name ~* 'auth|telefone|whatsapp|app|liberado|email|celular')
    ORDER BY ordinal_position;`,
  "COLUNAS_PORTAL_NOTIFICACOES": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='portal_notificacoes'
    ORDER BY ordinal_position;`,
  "RLS_OPERATION_TIMELINE_FULL": `
    SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='operation_timeline_events';`,
  "RLS_PORTAL_NOTIFICACOES": `
    SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='portal_notificacoes';`,
  "GRANTS_OPERATION_TIMELINE": `
    SELECT grantee, privilege_type FROM information_schema.role_table_grants
    WHERE table_schema='public' AND table_name='operation_timeline_events'
    ORDER BY grantee, privilege_type;`,
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
console.log("\nFIM2");
