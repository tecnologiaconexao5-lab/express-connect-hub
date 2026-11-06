/**
 * GD-11 — Bucket `propostas` + 4 policies.
 * Default: dry-run (BEGIN → migration → provas → ROLLBACK).
 * --apply: transação única + COMMIT + pós-verificação.
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
  "20261105000000_bucket_propostas.sql"
);

function connectionString() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

async function provas(client) {
  const checks = [];

  const b = await client.query(
    "select id, public, file_size_limit from storage.buckets where id = 'propostas'"
  );
  checks.push({
    prova: "bucket propostas existe e é privado (50MB)",
    ok: b.rowCount === 1 && b.rows[0].public === false && Number(b.rows[0].file_size_limit) === 52428800,
  });

  const p = await client.query(
    `select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('propostas_select','propostas_insert','propostas_update','propostas_delete')`
  );
  checks.push({ prova: "4 policies propostas_*", ok: p.rowCount === 4 });

  const ins = await client.query(
    `select has_table_privilege('authenticated', 'storage.objects', 'INSERT') as ok`
  );
  checks.push({ prova: "authenticated tem INSERT em storage.objects", ok: ins.rows[0].ok === true });

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
      console.log("\nDRY-RUN: nada alterado. Use --apply para efetivar.");
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
