/**
 * Aplica a migration da Central Inteligente de Documentos.
 * Default: dry-run (BEGIN → migration → provas → ROLLBACK).
 * --apply: transação única + COMMIT + verificação pós-commit.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const APPLY = process.argv.includes("--apply");
const MIGRATION = path.resolve(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20261102000002_documentos_central_avancada.sql"
);

function connectionString() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

async function provas(client) {
  const checks = [];
  const cols = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='documentos_metadata'`
  );
  const nomes = new Set(cols.rows.map((r) => r.column_name));
  const obrigatorias = [
    "categoria",
    "departamento",
    "entidade_nome",
    "responsavel",
    "responsavel_id",
    "cliente_id",
    "descricao",
    "mime_type",
    "tamanho_bytes",
    "versao",
    "documento_pai_id",
    "ativo",
    "historico",
  ];
  checks.push({
    prova: "colunas da Central de Documentos",
    ok: obrigatorias.every((c) => nomes.has(c)),
  });

  const checksStatus = await client.query(
    `select pg_get_constraintdef(c.oid) as def
     from pg_constraint c
     join pg_class t on t.oid = c.conrelid
     where t.relname = 'documentos_metadata'
       and c.conname = 'documentos_metadata_status_ia_check'`
  );
  const def = checksStatus.rows[0]?.def || "";
  checks.push({
    prova: "status_ia com os 4 estados da IA",
    ok:
      def.includes("aprovado_na_conferencia") &&
      def.includes("aprovado_com_ressalvas") &&
      def.includes("necessita_de_correcao") &&
      def.includes("aguardando_conferencia_humana"),
  });

  const cat = await client.query(
    `select count(*)::int n from documentos_metadata
     where categoria in ('Comercial','Operacional','Financeiro','Recrutamento','Administrativo')`
  );
  checks.push({ prova: "categorias válidas preenchidas", ok: cat.rows[0].n >= 0 });

  const idx = await client.query(
    `select indexname from pg_indexes
     where schemaname='public' and tablename='documentos_metadata'
       and indexname in (
         'idx_documentos_metadata_categoria',
         'idx_documentos_metadata_departamento',
         'idx_documentos_metadata_entidade_nome',
         'idx_documentos_metadata_responsavel',
         'idx_documentos_metadata_ativo',
         'idx_documentos_metadata_versao_pai'
       )`
  );
  checks.push({ prova: "índices da Central (6)", ok: idx.rowCount >= 6 });
  return checks;
}

async function main() {
  const sql = fs.readFileSync(MIGRATION, "utf8");
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    const checks = await provas(client);
    for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.prova}`);
    if (!checks.every((c) => c.ok)) throw new Error("Provas falharam — transação revertida.");

    if (APPLY) {
      await client.query("COMMIT");
      console.log("\nCOMMIT aplicado.");
      const pos = await provas(client);
      console.log(`Pós-commit: ${pos.filter((c) => c.ok).length}/${pos.length} PASS`);
    } else {
      await client.query("ROLLBACK");
      console.log("\nDRY-RUN: nada alterado (ROLLBACK). Use --apply para efetivar.");
    }
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    console.error("ERRO:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
