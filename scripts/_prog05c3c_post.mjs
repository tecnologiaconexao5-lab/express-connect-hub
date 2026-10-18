import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await p.query(s, pr)).rows;
const out = {};
const FID = "e5318b9d-120a-4a2b-a077-bebcdf8cf34c";
const AR = "bb5c0efe-3193-49ee-a6cb-d213bee69f72";

out.fatura = (await q(`select id, status, numero, numero_cliente, conta_receber_id, valor_total, vencimento::text, cliente_id from faturas where id=$1`, [FID]))[0];
out.ar_oficial = await q(`select id, valor, status, cliente_id, data_vencimento::text, fatura_id, os_id from financeiro_receber where fatura_id=$1`, [FID]);
out.ar_legado = (await q(`select id, valor, status, os_id, observacoes, data_pagamento, is_teste from financeiro_receber where id=$1`, [AR]))[0];
out.ar_legado_baixas = (await q(`select count(*)::int n from financeiro_baixas where titulo_tabela='financeiro_receber' and titulo_id=$1`, [AR]))[0].n;

out.contagens = {
  receber_total: (await q(`select count(*)::int n from financeiro_receber`))[0].n,
  baixas_total: (await q(`select count(*)::int n from financeiro_baixas`))[0].n,
  faturas_total: (await q(`select count(*)::int n from faturas`))[0].n,
};
out.contador = (await q(`select ultimo_numero from fatura_contadores_cliente where cliente_id='91b80fdb-6b87-4982-a550-f863f7f15866'`))[0];
out.seq = (await q(`select last_value from pg_sequences where schemaname='public' and sequencename='seq_fatura_2026'`))[0]?.last_value;

// Impacto ativo (is_teste=false, nao cancelado)
out.ativo_apos = (await q(`select count(*)::int n, coalesce(sum(valor),0) v from financeiro_receber where is_teste=false and lower(status) not in ('cancelado','cancelada')`))[0];
out.ativo_antes = { n: out.ativo_apos.n - 1 + 0, v: out.ativo_apos.v - 1266.43 + 600 }; // remove novo oficial, devolve legado ativo

// 38/39/40./41/42 intactas
out.saneadas = await q(`select metadata->>'numeroManual' ref, numero, numero_cliente, status from faturas where metadata->>'numeroManual' in ('38','39','40.','41','42') order by numero_cliente`);

// Funcoes baseline intactas
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
out.anti_dup_sha = sha((await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_trg_fatura_itens_anti_duplicidade'`))[0].def);
out.f_emitir_sha = sha((await q(`select pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='f_emitir_fatura'`))[0].def);

console.log(JSON.stringify(out, null, 2));
await p.end();
