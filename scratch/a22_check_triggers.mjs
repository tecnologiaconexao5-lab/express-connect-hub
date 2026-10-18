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
  "TRIGGERS_alocacoes_escala": `
    SELECT tgname, tgtype, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t WHERE t.tgrelid='alocacoes_escala'::regclass AND NOT t.tgisinternal
    ORDER BY tgname;`,
  "NOT_NULL_alocacoes": `
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='alocacoes_escala' AND is_nullable='NO'
    ORDER BY ordinal_position;`,
  "CONSTRAINTS_alocacoes": `
    SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c WHERE c.conrelid='alocacoes_escala'::regclass
    ORDER BY conname;`,
  "PRESTADOR_COM_AUTH": `
    SELECT id, nome_completo, auth_user_id, status, liberado_app, cpf_cnpj, telefone
    FROM prestadores WHERE auth_user_id IS NOT NULL LIMIT 5;`,
  "TENANT_PRINCIPAL": `
    SELECT id, nome FROM tenants WHERE id='00000000-0000-0000-0000-000000000001' OR nome ILIKE '%conexao%' LIMIT 5;`,
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
console.log("\nFIM_TRIGGERS");
