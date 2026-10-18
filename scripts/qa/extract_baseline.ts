/**
 * scripts/qa/extract_baseline.ts
 *
 * MISSÃO: ENV-QA-02-BASELINE-PACKAGE
 *
 * Extrai o schema LIVE completo de produção para reconstrução segura de QA.
 *
 * REGRAS DE SEGURANÇA:
 * - Somente leitura (SELECTs em metadados).
 * - ZERO DDL em produção.
 * - ZERO DML em produção.
 * - ZERO dados de negócio (DATA_ROWS_EXPORTED = 0, BUSINESS_INSERTS = 0, COPY_DATA_BLOCKS = 0).
 * - Confirmação estrita do project-ref de produção (uwrvzsjtpgaifkktpepn).
 * - Secrets mascarados e carregados apenas de variáveis de ambiente.
 */

import { Client } from "pg";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

dotenv.config();

const EXPECTED_PROD_REF = "uwrvzsjtpgaifkktpepn";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("FATAL: DATABASE_URL not defined in environment.");
  process.exit(1);
}

if (!DB_URL.includes(EXPECTED_PROD_REF)) {
  console.error(`BLOCKED: Connection string does not match expected production project ref: ${EXPECTED_PROD_REF}`);
  process.exit(1);
}

const OUTPUT_FILE = path.resolve("supabase/baseline/full_production_schema_20260920.sql");

function escapeIdentifier(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

async function main() {
  console.log("================================================================================");
  console.log("ENV-QA-02: EXTRAÇÃO DE BASELINE ESTRUTURAL LIVE (READ-ONLY)");
  console.log("================================================================================");
  console.log("Data/Hora:", new Date().toISOString());
  console.log("Production Project Ref:", EXPECTED_PROD_REF);
  console.log("Modo: SOMENTE LEITURA / ZERO WRITES");
  console.log("Destino:", OUTPUT_FILE);
  console.log("================================================================================\n");

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const lines: string[] = [];

  function write(line: string = "") {
    lines.push(line);
  }

  // Header
  write("-- ============================================================================");
  write("-- BASELINE ESTRUTURAL LIVE — PRODUÇÃO CONEXAO EXPRESS");
  write("-- Project Ref: uwrvzsjtpgaifkktpepn");
  write(`-- Extração realizada em: ${new Date().toISOString()}`);
  write("-- MISSÃO: ENV-QA-02-BASELINE-PACKAGE");
  write("-- CONTEÚDO: DDL ESTRUTURAL COMPLETO (ZERO DADOS REAIS / ZERO INSERTS)");
  write("-- ============================================================================\n");

  write("SET statement_timeout = 0;");
  write("SET client_encoding = 'UTF8';");
  write("SET standard_conforming_strings = on;");
  write("SET check_function_bodies = false;");
  write("SET client_min_messages = warning;");
  write("SET row_security = off;\n");

  // 1. EXTENSIONS
  console.log("[1/9] Extraindo Extensões...");
  write("-- ============================================================================");
  write("-- 1. EXTENSÕES");
  write("-- ============================================================================");
  const { rows: extensions } = await client.query(`
    SELECT extname 
    FROM pg_extension 
    WHERE extname NOT IN ('plpgsql')
    ORDER BY extname;
  `);
  for (const ext of extensions) {
    write(`CREATE EXTENSION IF NOT EXISTS ${escapeIdentifier(ext.extname)} WITH SCHEMA public;`);
  }
  write();

  // 2. SCHEMAS
  console.log("[2/9] Extraindo Schemas...");
  write("-- ============================================================================");
  write("-- 2. SCHEMAS");
  write("-- ============================================================================");
  write("CREATE SCHEMA IF NOT EXISTS public;");
  write();

  // 3. ENUMS & TYPES
  console.log("[3/9] Extraindo Tipos e Enums...");
  write("-- ============================================================================");
  write("-- 3. ENUMS E DOMAIN TYPES");
  write("-- ============================================================================");
  const { rows: enumRows } = await client.query(`
    SELECT 
      t.typname,
      e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder;
  `);

  const enumsMap = new Map<string, string[]>();
  for (const r of enumRows) {
    if (!enumsMap.has(r.typname)) enumsMap.set(r.typname, []);
    enumsMap.get(r.typname)!.push(r.enumlabel);
  }

  for (const [typname, labels] of enumsMap.entries()) {
    const vals = labels.map((v: string) => `'${v.replace(/'/g, "''")}'`).join(", ");
    write(`DO $$ BEGIN`);
    write(`    CREATE TYPE public.${escapeIdentifier(typname)} AS ENUM (${vals});`);
    write(`EXCEPTION WHEN duplicate_object THEN NULL;`);
    write(`END $$;`);
    write();
  }

  // 4. SEQUENCES
  console.log("[4/9] Extraindo Sequences...");
  write("-- ============================================================================");
  write("-- 4. SEQUENCES");
  write("-- ============================================================================");
  const { rows: seqs } = await client.query(`
    SELECT sequence_name, data_type, start_value, minimum_value, maximum_value, increment
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
    ORDER BY sequence_name;
  `);
  for (const seq of seqs) {
    write(`CREATE SEQUENCE IF NOT EXISTS public.${escapeIdentifier(seq.sequence_name)} START WITH ${seq.start_value} INCREMENT BY ${seq.increment};`);
  }
  write();

  // 5. BASE TABLES & COLUMNS
  console.log("[5/9] Extraindo Tabelas Base...");
  write("-- ============================================================================");
  write("-- 5. TABELAS BASE E COLUNAS");
  write("-- ============================================================================");
  const { rows: tables } = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const { rows: cols } = await client.query(`
    SELECT 
      c.relname as table_name,
      a.attname as col_name,
      pg_catalog.format_type(a.atttypid, a.atttypmod) as full_type,
      pg_catalog.pg_get_expr(ad.adbin, ad.adrelid) as default_val,
      a.attnotnull as not_null
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef ad ON (a.attrelid = ad.adrelid AND a.attnum = ad.adnum)
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r'
      AND a.attnum > 0 
      AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum;
  `);

  const colsByTable = new Map<string, any[]>();
  for (const c of cols) {
    if (!colsByTable.has(c.table_name)) colsByTable.set(c.table_name, []);
    colsByTable.get(c.table_name)!.push(c);
  }

  for (const tbl of tables) {
    const tName = tbl.table_name;
    const tCols = colsByTable.get(tName) || [];
    write(`CREATE TABLE IF NOT EXISTS public.${escapeIdentifier(tName)} (`);
    const colStrs = tCols.map((col) => {
      let s = `    ${escapeIdentifier(col.col_name)} ${col.full_type}`;
      if (col.not_null) s += " NOT NULL";
      if (col.default_val) s += ` DEFAULT ${col.default_val}`;
      return s;
    });
    write(colStrs.join(",\n"));
    write(");\n");
  }

  // 6. CONSTRAINTS (PK, UNIQUE, CHECK, FK)
  console.log("[6/9] Extraindo Constraints...");
  write("-- ============================================================================");
  write("-- 6. CONSTRAINTS (PRIMARY KEY, UNIQUE, CHECK)");
  write("-- ============================================================================");
  const { rows: constraints } = await client.query(`
    SELECT 
      c.relname as table_name,
      r.conname as constraint_name,
      r.contype,
      pg_catalog.pg_get_constraintdef(r.oid, true) as condef
    FROM pg_constraint r
    JOIN pg_class c ON c.oid = r.conrelid
    JOIN pg_namespace n ON n.oid = r.connamespace
    WHERE n.nspname = 'public'
      AND r.contype IN ('p', 'u', 'c')
    ORDER BY r.contype, c.relname, r.conname;
  `);

  for (const con of constraints) {
    write(`DO $$ BEGIN`);
    write(`    ALTER TABLE public.${escapeIdentifier(con.table_name)} ADD CONSTRAINT ${escapeIdentifier(con.constraint_name)} ${con.condef};`);
    write(`EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;`);
    write(`END $$;`);
  }
  write();

  write("-- ============================================================================");
  write("-- 6.1 FOREIGN KEYS");
  write("-- ============================================================================");
  const { rows: fks } = await client.query(`
    SELECT 
      c.relname as table_name,
      r.conname as constraint_name,
      pg_catalog.pg_get_constraintdef(r.oid, true) as condef
    FROM pg_constraint r
    JOIN pg_class c ON c.oid = r.conrelid
    JOIN pg_namespace n ON n.oid = r.connamespace
    WHERE n.nspname = 'public'
      AND r.contype = 'f'
    ORDER BY c.relname, r.conname;
  `);
  for (const fk of fks) {
    write(`DO $$ BEGIN`);
    write(`    ALTER TABLE public.${escapeIdentifier(fk.table_name)} ADD CONSTRAINT ${escapeIdentifier(fk.constraint_name)} ${fk.condef};`);
    write(`EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;`);
    write(`END $$;`);
  }
  write();

  // 7. INDEXES (NON-PK, NON-UNIQUE CONSTRAINTS)
  console.log("[7/9] Extraindo Indexes...");
  write("-- ============================================================================");
  write("-- 7. INDEXES");
  write("-- ============================================================================");
  const { rows: indexes } = await client.query(`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' 
      AND indexname NOT IN (SELECT conname FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
    ORDER BY indexname;
  `);
  for (const idx of indexes) {
    // Adiciona IF NOT EXISTS
    const safeIdx = idx.indexdef.replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
                               .replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
    write(`${safeIdx};`);
  }
  write();

  // 8. FUNCTIONS & RPCS (Antes das views para suportar views que usam functions)
  console.log("[8/9] Extraindo Funções e RPCs...");
  write("-- ============================================================================");
  write("-- 8. FUNCTIONS & RPCS");
  write("-- ============================================================================");
  const { rows: funcs } = await client.query(`
    SELECT 
      p.proname,
      pg_catalog.pg_get_functiondef(p.oid) as funcdef
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    ORDER BY p.proname;
  `);
  for (const fn of funcs) {
    write(`${fn.funcdef};`);
    write();
  }

  // 9. VIEWS
  console.log("[9/9] Extraindo Views, Triggers e RLS Policies...");
  write("-- ============================================================================");
  write("-- 9. VIEWS");
  write("-- ============================================================================");
  const { rows: views } = await client.query(`
    SELECT 
      c.relname as view_name,
      pg_catalog.pg_get_viewdef(c.oid, true) as viewdef
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'v'
    ORDER BY c.relname;
  `);
  for (const v of views) {
    write(`CREATE OR REPLACE VIEW public.${escapeIdentifier(v.view_name)} AS\n${v.viewdef};`);
    write();
  }

  // 10. TRIGGERS
  write("-- ============================================================================");
  write("-- 10. TRIGGERS");
  write("-- ============================================================================");
  const { rows: triggers } = await client.query(`
    SELECT 
      c.relname as table_name,
      t.tgname,
      pg_catalog.pg_get_triggerdef(t.oid, true) as trigdef
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY c.relname, t.tgname;
  `);
  for (const trg of triggers) {
    write(`DROP TRIGGER IF EXISTS ${escapeIdentifier(trg.tgname)} ON public.${escapeIdentifier(trg.table_name)};`);
    write(`${trg.trigdef};`);
  }
  write();

  // 11. RLS ENABLE & POLICIES
  write("-- ============================================================================");
  write("-- 11. ROW LEVEL SECURITY (RLS) & POLICIES");
  write("-- ============================================================================");
  const { rows: rlsTables } = await client.query(`
    SELECT relname, relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND relrowsecurity = true
    ORDER BY relname;
  `);
  for (const rt of rlsTables) {
    write(`ALTER TABLE public.${escapeIdentifier(rt.relname)} ENABLE ROW LEVEL SECURITY;`);
  }
  write();

  const { rows: policies } = await client.query(`
    SELECT 
      c.relname as table_name,
      p.polname,
      p.polcmd,
      CASE 
        WHEN p.polroles = '{0}' THEN 'public'
        ELSE array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles)), ', ')
      END as role_names,
      p.polpermissive,
      pg_catalog.pg_get_expr(p.polqual, p.polrelid, true) as qual,
      pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid, true) as with_check
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    ORDER BY c.relname, p.polname;
  `);

  for (const pol of policies) {
    const cmdMap: Record<string, string> = {
      r: "SELECT",
      a: "INSERT",
      w: "UPDATE",
      d: "DELETE",
      "*": "ALL",
    };
    const forCmd = cmdMap[pol.polcmd] || "ALL";
    const roles = pol.role_names || "public";
    write(`DROP POLICY IF EXISTS ${escapeIdentifier(pol.polname)} ON public.${escapeIdentifier(pol.table_name)};`);
    let polStmt = `CREATE POLICY ${escapeIdentifier(pol.polname)} ON public.${escapeIdentifier(pol.table_name)} FOR ${forCmd} TO ${roles}`;
    if (pol.qual) {
      polStmt += ` USING (${pol.qual})`;
    }
    if (pol.with_check) {
      polStmt += ` WITH CHECK (${pol.with_check})`;
    }
    polStmt += ";";
    write(polStmt);
  }
  write();

  await client.end();

  const fullContent = lines.join("\n");
  fs.writeFileSync(OUTPUT_FILE, fullContent, "utf8");

  console.log("================================================================================");
  console.log("EXTRAÇÃO CONCLUÍDA COM SUCESSO!");
  console.log("Arquivo:", OUTPUT_FILE);
  console.log("Tamanho:", (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2), "KB");
  console.log("Linhas:", lines.length);
  console.log("================================================================================");
}

main().catch((err) => {
  console.error("FATAL ERROR in extraction:", err.message);
  process.exit(1);
});
