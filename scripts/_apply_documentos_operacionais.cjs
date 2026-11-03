/**
 * Aplica a migration de Documentos Operacionais (bucket + documentos_metadata).
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
  "20261102000001_documentos_operacionais_metadata.sql"
);

function connectionString() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

async function provas(client) {
  const checks = [];
  const bucket = await client.query(
    "select id, public from storage.buckets where id = 'documentos_operacionais'"
  );
  checks.push({
    prova: "bucket documentos_operacionais existe e é privado",
    ok: bucket.rowCount === 1 && bucket.rows[0].public === false,
  });

  const tabela = await client.query(
    "select to_regclass('public.documentos_metadata') as tabela"
  );
  checks.push({
    prova: "tabela documentos_metadata existe",
    ok: Boolean(tabela.rows[0]?.tabela),
  });

  const colunas = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='documentos_metadata'`
  );
  const nomes = new Set(colunas.rows.map((r) => r.column_name));
  const obrigatorias = [
    "id",
    "url",
    "nome",
    "tipo",
    "modulo_origem",
    "entidade_id",
    "status_ia",
    "relatorio_ia",
    "data_inclusao",
  ];
  checks.push({
    prova: "colunas obrigatórias de documentos_metadata",
    ok: obrigatorias.every((c) => nomes.has(c)),
  });

  const policies = await client.query(
    `select policyname from pg_policies
     where schemaname='public' and tablename='documentos_metadata'`
  );
  checks.push({
    prova: "RLS/policies de documentos_metadata (4)",
    ok: policies.rowCount >= 4,
  });

  const trigger = await client.query(
    `select tgname from pg_trigger
     where tgname='trg_documentos_prestadores_metadata' and not tgisinternal`
  );
  checks.push({
    prova: "trigger de espelhamento App -> metadata",
    ok: trigger.rowCount === 1,
  });

  const storagePolicies = await client.query(
    `select policyname from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname like 'documentos_operacionais_%'`
  );
  checks.push({
    prova: "policies do bucket documentos_operacionais (4)",
    ok: storagePolicies.rowCount >= 4,
  });

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
    const allOk = checks.every((c) => c.ok);
    if (!allOk) throw new Error("Provas falharam — transação revertida.");

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
