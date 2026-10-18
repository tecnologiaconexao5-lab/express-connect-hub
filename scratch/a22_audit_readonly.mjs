import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.PROJECT_DIR;
if (PROJECT) config({ path: path.resolve(PROJECT, ".env") });

import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.log("NO_DATABASE_URL"); process.exit(0); }

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const queries = {
  "TABELAS_RELACIONADAS": `
    SELECT table_name, table_type
    FROM information_schema.tables
    WHERE table_schema='public'
      AND (table_name ~* 'chat|conversa|mensagem|notific|timeline|ocorrencia|suporte|support'
           OR table_name IN ('crm_leads','crm_historico','eventos_oficiais','operation_timeline_events',
                             'comunicacoes_mensagens','portal_ocorrencias','ocorrencias','alocacoes_escala'))
    ORDER BY table_name;`,
  "COLUNAS_CRM_CONVERSAS": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_conversas'
    ORDER BY ordinal_position;`,
  "COLUNAS_CRM_MENSAGENS": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_mensagens'
    ORDER BY ordinal_position;`,
  "COLUNAS_OPERATION_TIMELINE": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='operation_timeline_events'
    ORDER BY ordinal_position;`,
  "COLUNAS_COMUNICACOES_MENSAGENS": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='comunicacoes_mensagens'
    ORDER BY ordinal_position;`,
  "COLUNAS_PORTAL_OCORRENCIAS": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='portal_ocorrencias'
    ORDER BY ordinal_position;`,
  "RLS_CRM": `
    SELECT tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies WHERE tablename IN ('crm_conversas','crm_mensagens') ORDER BY tablename, policyname;`,
  "RLS_OPERATION_TIMELINE": `
    SELECT tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies WHERE tablename='operation_timeline_events';`,
  "REALTIME_PUBLICATION": `
    SELECT p.pubname, t.schemaname, t.tablename
    FROM pg_publication_tables t JOIN pg_publication p ON p.pubname=t.pubname
    WHERE t.tablename ~* 'chat|conversa|mensagem|notific|timeline|ocorrencia|evento|comunicacoes|tracking'
    ORDER BY t.tablename;`,
  "RPC_MOTORISTA": `
    SELECT p.proname, pg_get_function_result(p.oid) AS result,
           array_to_string(ARRAY(SELECT pg_get_function_argument_names(p.oid)), ',') AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname ~* 'motorista|prestador|reversa|etapa|operacoes|posicao|mensagem'
    ORDER BY p.proname;`,
  "COUNT_CRM": `
    SELECT (SELECT count(*) FROM crm_conversas) AS conv,
           (SELECT count(*) FROM crm_mensagens) AS msgs,
           (SELECT count(*) FROM operation_timeline_events) AS timeline,
           (SELECT count(*) FROM comunicacoes_mensagens) AS cm_mensagens;`,
  "PRESTADORES_APP": `
    SELECT count(*) FILTER (WHERE auth_user_id IS NOT NULL) AS com_auth,
           count(*) FILTER (WHERE telefone IS NOT NULL) AS com_telefone,
           count(*) AS total
    FROM prestadores;`,
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
console.log("\nFIM_AUDITORIA_READONLY");
