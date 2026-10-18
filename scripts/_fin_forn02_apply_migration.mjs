import pg from "pg";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const connStr = process.env.DATABASE_URL;

if (!connStr) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const migrationFile = resolve(__dirname, "..", "supabase", "migrations", "20260908_fin_forn02_tabela_fornecedores.sql");
const sql = readFileSync(migrationFile, "utf8");

const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function main() {
  try {
    await client.connect();
    console.log("Conectado. Aplicando migration FIN-FORN-02...");
    await client.query(sql);
    console.log("Migration aplicada com sucesso!");
    
    // Verificar tabela criada
    const check = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'fornecedores' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log("\nColunas criadas:");
    for (const row of check.rows) {
      console.log(`  ${row.column_name} (${row.data_type}) nullable=${row.is_nullable}`);
    }

    // Verificar FK
    const fk = await client.query(`
      SELECT constraint_name, column_name, foreign_table_name, foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_name = 'financeiro_pagar' AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'fornecedores'
    `);
    console.log("\nFK em financeiro_pagar:");
    for (const row of fk.rows) {
      console.log(`  ${row.constraint_name}: ${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    }

    // Verificar RLS
    const rls = await client.query(`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'fornecedores'
    `);
    console.log(`\nRLS: ${rls.rows[0]?.relrowsecurity ? 'ATIVO' : 'INATIVO'}`);

    // Verificar policies
    const policies = await client.query(`
      SELECT policyname, cmd FROM pg_policies WHERE tablename = 'fornecedores'
    `);
    console.log("Policies:");
    for (const row of policies.rows) {
      console.log(`  ${row.policyname} (${row.cmd})`);
    }

    // Verificar anon bloqueado
    const anon = await client.query(`
      SELECT has_table_privilege('anon', 'public.fornecedores', 'SELECT')
    `);
    console.log(`\nAnon SELECT: ${anon.rows[0].has_table_privilege ? 'PERMITIDO (ERRO!)' : 'BLOQUEADO (OK)'}`);

    // Verificar 101 titulos intactos
    const titulos = await client.query(`
      SELECT count(*) as total, 
             count(fornecedor_id) as com_fornecedor_id,
             count(fornecedor_cadastro_id) as com_cadastro_id
      FROM financeiro_pagar
    `);
    console.log(`\nTitulos financeiro_pagar: total=${titulos.rows[0].total}, fornecedor_id legado=${titulos.rows[0].com_fornecedor_id}, fornecedor_cadastro_id novo=${titulos.rows[0].com_cadastro_id}`);

  } catch (err) {
    console.error("Erro:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
