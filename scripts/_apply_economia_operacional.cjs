/**
 * Aplica a migration de economia operacional/CRM.
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
  "20261103000000_economia_operacional_crm.sql"
);

function connectionString() {
  const env = fs.readFileSync(path.resolve(__dirname, "..", ".env"), "utf8");
  const m = env.match(/^DATABASE_URL=(.*)$/m);
  if (!m) throw new Error("DATABASE_URL ausente no .env");
  return m[1].trim();
}

async function provas(client) {
  const checks = [];
  const crm = await client.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='crm_leads' and column_name='endereco'"
  );
  checks.push({ prova: "crm_leads.endereco", ok: crm.rowCount === 1 });

  const v = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='veiculos'
       and column_name in ('media_consumo_km_l','custo_manutencao_km','tipo_combustivel')`
  );
  checks.push({ prova: "veiculos consumo/manutenção/combustível", ok: v.rowCount === 3 });

  const p = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='prestadores'
       and column_name in ('media_consumo_km_l','custo_manutencao_km','tipo_combustivel')`
  );
  checks.push({ prova: "prestadores consumo/manutenção/combustível", ok: p.rowCount === 3 });

  const t = await client.query("select to_regclass('public.combustivel_precos') as t");
  checks.push({ prova: "tabela combustivel_precos", ok: Boolean(t.rows[0]?.t) });
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
