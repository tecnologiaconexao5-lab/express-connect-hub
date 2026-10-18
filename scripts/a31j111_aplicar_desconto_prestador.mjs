// A31-J1.11 — Aplica valor_desconto_prestador (coluna aditiva) + integração mínima
// no trigger f_trg_propagar_financeiro_alocacao EM PRODUÇÃO.
// Abordagem: transforma a função VIVA (que difere do repo) com edições localizadas,
// preservando todo o comportamento atual. SEM DROP/DELETE/UPDATE em massa.
// Uso: node scripts/a31j111_aplicar_desconto_prestador.mjs
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
config({ path: path.join(root, ".env") });

const OUT_MIG = path.join(root, "supabase", "migrations", "20260819_a31j111_desconto_prestador.sql");
const BACKUP = path.join(root, "scripts", "_live_trg_before_a31j111.sql");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Pré-cheque: coluna financeiro_pagar.desconto (usada na integração mínima)
const fpCol = await client.query(
  `SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='financeiro_pagar' AND column_name='desconto'`
);
if (!fpCol.rows[0]) { console.error("ABORT: financeiro_pagar.desconto não existe."); process.exit(2); }
console.log("[0] financeiro_pagar.desconto OK.");

// ── 1. Função VIVA ──
const { rows } = await client.query(
  "SELECT pg_get_functiondef('public.f_trg_propagar_financeiro_alocacao'::regproc) AS def"
);
if (!rows[0]?.def) { console.error("ABORT: função não encontrada."); process.exit(2); }
const live = rows[0].def;
fs.writeFileSync(BACKUP, live + "\n");
console.log(`[1] Backup da função viva: ${path.relative(root, BACKUP)}`);

// ── 2. Edições localizadas (cada uma DEVE casar exatamente 1x) ──
function replaceOnce(text, from, to, nome) {
  const idx = text.indexOf(from);
  if (idx === -1 || text.indexOf(from, idx + 1) !== -1) {
    console.error(`ABORT: âncora '${nome}' não encontrada 1x na função viva.`);
    process.exit(2);
  }
  return text.slice(0, idx) + to + text.slice(idx + from.length);
}

let fn = live;
// A. desconto do PRESTADOR passa a vir do campo próprio
fn = replaceOnce(
  fn,
  "v_desconto_valor := COALESCE(NEW.valor_desconto, 0);",
  "v_desconto_valor := COALESCE(NEW.valor_desconto_prestador, 0);",
  "v_desconto_valor source"
);
// B. financeiro_pagar grava o desconto prestador (INSERT coluna)
fn = replaceOnce(
  fn,
  "status, prestador, fornecedor_id, fornecedor_nome)",
  "status, prestador, fornecedor_id, fornecedor_nome, desconto)",
  "financeiro_pagar insert cols"
);
// C. financeiro_pagar grava o desconto prestador (VALUES)
fn = replaceOnce(
  fn,
  "v_prestador_nome, NEW.prestador_id, v_prestador_nome)",
  "v_prestador_nome, NEW.prestador_id, v_prestador_nome, v_desconto_valor)",
  "financeiro_pagar insert values"
);
// D. financeiro_pagar grava o desconto prestador (ON CONFLICT UPDATE)
fn = replaceOnce(
  fn,
  "fornecedor_nome = v_prestador_nome, prestador = v_prestador_nome;",
  "fornecedor_nome = v_prestador_nome, desconto = v_desconto_valor, prestador = v_prestador_nome;",
  "financeiro_pagar update set"
);
console.log("[2] Edições localizadas aplicadas na função viva (4).");

// ── 3. Trigger UPDATE OF: incluir a coluna ──
const trgRes = await client.query(
  `SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_propagar_financeiro_alocacao'`
);
const trgDef = trgRes.rows[0]?.def;
if (!trgDef) { console.error("ABORT: trigger não encontrado."); process.exit(2); }
if (!trgDef.includes("valor_adicional, valor_desconto")) {
  console.error("ABORT: trigger UPDATE OF inesperado (âncora ausente)."); process.exit(2);
}
const trgNew = trgDef.replace("valor_adicional, valor_desconto", "valor_adicional, valor_desconto, valor_desconto_prestador");
const triggerSql = "DROP TRIGGER IF EXISTS trg_propagar_financeiro_alocacao ON public.alocacoes_escala;\n" + trgNew + ";\n";

// ── 4. Monta SQL final ──
const finalSql = `
-- A31-J1.11 — APLICADO ${new Date().toISOString()}
ALTER TABLE public.alocacoes_escala
  ADD COLUMN IF NOT EXISTS valor_desconto_prestador numeric(14,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.alocacoes_escala.valor_desconto_prestador IS
  'A31-J1.11 — Desconto/Ajuste EXCLUSIVO do prestador por serviço (NÃO afeta o cliente).';

` + fn.trimEnd() + ";\n" + triggerSql;

fs.writeFileSync(OUT_MIG, finalSql);
console.log(`[3] Migration final (repo=produção): ${path.relative(root, OUT_MIG)}`);

// ── 5. Aplica em transação ──
await client.query("BEGIN");
try {
  await client.query(finalSql);
  await client.query("COMMIT");
  console.log("[4] Aplicado em transação COMMIT OK.");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("ABORT: rollback —", e.message);
  process.exit(2);
}

// ── 6. Verificação read-only ──
const col = await client.query(
  `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
    WHERE table_schema='public' AND table_name='alocacoes_escala'
      AND column_name='valor_desconto_prestador'`
);
console.log("[5] Coluna:", col.rows[0] ? JSON.stringify(col.rows[0]) : "AUSENTE");

const fn2 = await client.query(
  `SELECT pg_get_functiondef('public.f_trg_propagar_financeiro_alocacao'::regproc) LIKE '%valor_desconto_prestador%' AS usa_vdp,
          pg_get_functiondef('public.f_trg_propagar_financeiro_alocacao'::regproc) LIKE '%desconto = v_desconto_valor%' AS grava_fp`
);
console.log("[6] Trigger usa valor_desconto_prestador:", fn2.rows[0].usa_vdp, "| grava desconto em financeiro_pagar:", fn2.rows[0].grava_fp);

const trg2 = await client.query(
  `SELECT pg_get_triggerdef(t.oid) AS def FROM pg_trigger t
     JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname='trg_propagar_financeiro_alocacao'`
);
console.log("[7] Trigger UPDATE OF inclui a coluna:", trg2.rows[0]?.def.includes("valor_desconto_prestador") ?? false);

const dados = await client.query(
  `SELECT count(*)::int AS total,
          count(*) FILTER (WHERE valor_desconto_prestador = 0)::int AS zeros
     FROM public.alocacoes_escala`
);
console.log("[8] Alocações preservadas — total:", dados.rows[0].total, "| com default 0:", dados.rows[0].zeros);

await client.end();
