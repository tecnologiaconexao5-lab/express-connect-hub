// TMS-FIN-PROG-05B — build: snapshot + rollback + migration (remove bloco AR de M66/M80).
import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const def = async (fn) => (await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1`, [fn]))[0].def;
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

const orig66 = await def("f_trg_propagar_financeiro_alocacao");
const orig80 = await def("f_trg_propagar_financeiro_os");

// Splice: remove exatamente o bloco de financeiro_receber preservando o resto.
function cortaBloco(defTxt, iniMarker, fimMarker, novoComentario) {
  const i = defTxt.indexOf(iniMarker);
  const j = defTxt.indexOf(fimMarker);
  if (i < 0 || j < 0 || j <= i) throw new Error(`marcadores nao encontrados: ${iniMarker} | ${fimMarker}`);
  return defTxt.slice(0, i) + novoComentario + defTxt.slice(j);
}

const new66 = cortaBloco(orig66, "\n    -- Receber\n", "\n    -- Pagar", "\n    -- TMS-FIN-PROG-05B: AR do cliente REMOVIDO (fonte unica = f_emitir_fatura).\n");
const new80 = cortaBloco(orig80, "\n  -- 1. financeiro_receber\n", "\n  -- 2. financeiro_pagar", "\n  -- TMS-FIN-PROG-05B: AR do cliente REMOVIDO (fonte unica = f_emitir_fatura).\n");

if (new66.includes("INSERT INTO financeiro_receber") || new80.includes("INSERT INTO financeiro_receber")) {
  throw new Error("ainda contem INSERT financeiro_receber");
}

const HEADER = `-- ═══════════════════════════════════════════════════════════════════════════════
-- TMS-FIN-PROG-05B — AR SINGLE SOURCE
-- Remove EXCLUSIVAMENTE o bloco que cria/atualiza financeiro_receber de:
--   • f_trg_propagar_financeiro_alocacao (M66)
--   • f_trg_propagar_financeiro_os (M80)
-- Preserva: ordens_servico (vinculo), financeiro_pagar, pagamentos_prestadores,
-- composicao_financeira_os, calculos, status e idempotencia das demais tabelas.
-- Fonte unica de AR de faturamento = f_emitir_fatura (baseline PROG-04B/04C).
-- Sem saneamento de legado. Sem novo trigger.
-- ═══════════════════════════════════════════════════════════════════════════════

`;
fs.writeFileSync("supabase/migrations/20260924000002_fin_prog05b_ar_single_source.sql", HEADER + new66 + ";\n\n" + new80 + ";\n");

const rollback = `-- TMS-FIN-PROG-05B — ROLLBACK: restaura EXATAMENTE as duas funcoes originais.
-- (tambem disponivel em temp/prog05b_snapshot_pre.json)
BEGIN;
${orig66};

${orig80};
COMMIT;
`;
fs.writeFileSync("temp/prog05b_rollback.sql", rollback);

const snap = {
  gerado_em: new Date().toISOString(),
  sha_orig: { f_trg_propagar_financeiro_alocacao: sha(orig66), f_trg_propagar_financeiro_os: sha(orig80) },
  sha_novo: { f_trg_propagar_financeiro_alocacao: sha(new66), f_trg_propagar_financeiro_os: sha(new80) },
  definicoes_originais: { f_trg_propagar_financeiro_alocacao: orig66, f_trg_propagar_financeiro_os: orig80 },
  baseline: {
    receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
    receber_por_os: (await q(`select count(*)::int n from financeiro_receber where os_id is not null`))[0].n,
    receber_por_fatura: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
    fat2026000001_ars: await q(`select r.id, r.valor, r.status, r.fatura_id::text, r.os_id from financeiro_receber r where r.fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb' or r.os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
    saneadas: await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, status, conta_receber_id is not null tem_ar from faturas where metadata->>'numeroManual' in ('38','39','40.','41','42') order by numero_cliente`),
  },
};
fs.writeFileSync("temp/prog05b_snapshot_pre.json", JSON.stringify(snap, null, 2));

console.log("migration: supabase/migrations/20260924000002_fin_prog05b_ar_single_source.sql");
console.log("rollback : temp/prog05b_rollback.sql");
console.log("snapshot : temp/prog05b_snapshot_pre.json");
console.log("sha orig :", JSON.stringify(snap.sha_orig));
console.log("sha novo :", JSON.stringify(snap.sha_novo));
console.log("baseline :", JSON.stringify(snap.baseline.receber_total), snap.baseline.receber_por_os, snap.baseline.receber_por_fatura);
await p.end();
