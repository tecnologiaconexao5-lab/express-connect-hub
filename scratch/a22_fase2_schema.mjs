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
  "PRESTADORES_PK": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='prestadores'
    ORDER BY ordinal_position;`,
  "PRESTADORES_PK_CONSTRAINT": `
    SELECT c.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage c ON c.constraint_name=tc.constraint_name AND c.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.table_name='prestadores' AND tc.constraint_type='PRIMARY KEY';`,
  "ALOCACOES_EScala_COLS": `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns WHERE table_schema='public' AND table_name='alocacoes_escala'
    ORDER BY ordinal_position;`,
  "ALOCACOES_FK": `
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.table_schema=tc.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.table_name='alocacoes_escala' AND tc.constraint_type='FOREIGN KEY';`,
  "OS_COLS_KEY": `
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ordens_servico'
      AND column_name IN ('id','numero','numero_os','cliente','prestador','prestador_id','tenant_id')
    ORDER BY column_name;`,
  "TENANT_USUARIOS_COLS": `
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenant_usuarios'
    ORDER BY ordinal_position;`,
  "PK_ALOCACAO": `
    SELECT c.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage c ON c.constraint_name=tc.constraint_name AND c.table_schema=tc.table_schema
    WHERE tc.table_schema='public' AND tc.table_name='alocacoes_escala' AND tc.constraint_type='PRIMARY KEY';`,
  "RLS_PORTAL_NOTIFICACOES_DETAIL": `
    SELECT policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename='portal_notificacoes' ORDER BY policyname;`,
  "PROC_F_OBTER_CLIENTE": `
    SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('f_obter_cliente_id_do_usuario','current_tenant_id_safe','f_usuario_pode_acessar_cliente');`,
  "SAMPLE_PRESTADOR_HML": `
    SELECT id, nome_completo, auth_user_id, tenant_id, status, liberado_app, telefone, whatsapp
    FROM prestadores ORDER BY created_at ASC LIMIT 5;`,
  "SAMPLE_ALOCACAO_HML": `
    SELECT id, ordem_servico_id, prestador_id, status, tenant_id, origem, destino, data_escala, created_at
    FROM alocacoes_escala ORDER BY created_at DESC LIMIT 5;`,
  "SAMPLE_OS_HML": `
    SELECT id, numero, numero_os, status, cliente, prestador, tenant_id, created_at
    FROM ordens_servico ORDER BY created_at DESC LIMIT 5;`,
  "EXISTS_HML_OPERACOES": `
    SELECT count(*) AS total, count(*) FILTER (WHERE ordem_servico_id IS NOT NULL) AS com_os,
           count(*) FILTER (WHERE prestador_id IS NOT NULL) AS com_prestador
    FROM alocacoes_escala;`,
  "REALTIME_PUB_TABLES": `
    SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY tablename;`,
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
console.log("\nFIM_FASE2A");
