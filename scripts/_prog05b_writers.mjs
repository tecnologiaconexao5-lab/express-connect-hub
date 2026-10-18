import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;

const fns = await q(`select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`);
const insertFns = fns.filter((f) => /INSERT INTO financeiro_receber/i.test(f.def)).map((f) => f.proname);
const updateFns = fns.filter((f) => /UPDATE financeiro_receber/i.test(f.def)).map((f) => f.proname);
const delFns = fns.filter((f) => /DELETE FROM financeiro_receber/i.test(f.def)).map((f) => f.proname);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const g66 = fns.find((f) => f.proname === "f_trg_propagar_financeiro_alocacao").def;
const g80 = fns.find((f) => f.proname === "f_trg_propagar_financeiro_os").def;

const out = {
  funcoes_INSERT_financeiro_receber: insertFns,
  funcoes_UPDATE_financeiro_receber: updateFns,
  funcoes_DELETE_financeiro_receber: delFns,
  M66_tem_financeiro_receber: /financeiro_receber/i.test(g66),
  M80_tem_financeiro_receber: /financeiro_receber/i.test(g80),
  sha_pos: { M66: sha(g66), M80: sha(g80) },
  baseline_pos: {
    receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
    receber_por_os: (await q(`select count(*)::int n from financeiro_receber where os_id is not null`))[0].n,
    receber_por_fatura: (await q(`select count(*)::int n from financeiro_receber where fatura_id is not null`))[0].n,
    pagar_total: (await q(`select count(*)::int n from financeiro_pagar`))[0].n,
    pag_prest_total: (await q(`select count(*)::int n from pagamentos_prestadores`))[0].n,
    composicao_total: (await q(`select count(*)::int n from composicao_financeira_os`))[0].n,
    fat2026000001: await q(`select id, valor, status, fatura_id::text, os_id from financeiro_receber where fatura_id='f517b9bd-5cd6-4ac8-a316-d1bee0e304bb' or os_id='c0a7ee88-e0f9-470b-8fe0-0bb141ff4501'`),
    saneadas: await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, status, conta_receber_id is not null tem_ar from faturas where metadata->>'numeroManual' in ('38','39','40.','41','42') order by numero_cliente`),
  },
};
fs.writeFileSync("temp/prog05b_snapshot_pos.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await p.end();
