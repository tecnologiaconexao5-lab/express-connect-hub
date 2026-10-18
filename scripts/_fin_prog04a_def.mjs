import pg from "pg";
import fs from "node:fs";
import crypto from "node:crypto";
pg.types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
pg.types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const p = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (sql, pr = []) => (await p.query(sql, pr)).rows;

const defs = await q(`select p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f_emitir_fatura','f_gerar_numero_fatura','f_cancelar_fatura') order by 1`);
for (const d of defs) {
  const sha = crypto.createHash("sha256").update(d.def).digest("hex").slice(0, 16);
  console.log(`== ${d.proname} (sha256:${sha}, chars:${d.def.length}) ==`);
  console.log(d.def);
  console.log("");
}

console.log("== fatura oficial (numero not null) ==");
console.log(JSON.stringify(await q(`select id, numero, status, cliente_id, valor_total, conta_receber_id, metadata, data_emissao, vencimento from faturas where numero is not null`), null, 2));

console.log("== financeiro_receber com fatura_id (criado pela RPC) ==");
console.log(JSON.stringify(await q(`select id, cliente_id, descricao, valor, valor_bruto, valor_liquido, status, data_vencimento, data_emissao, fatura, numero, os_id, os_vinculadas, fatura_id from financeiro_receber where fatura_id is not null`), null, 2));

console.log("== receber legado com fatura texto (fatura_id null) ==");
console.log(JSON.stringify(await q(`select id, fatura, numero, os_id, valor, status, data_vencimento from financeiro_receber where fatura is not null and fatura <> '' and fatura_id is null order by fatura`), null, 2));

console.log("== faturas.tenant_id default ==");
console.log(JSON.stringify(await q(`select column_name, column_default from information_schema.columns where table_schema='public' and table_name='faturas' and column_name in ('tenant_id','numero','status','conta_receber_id')`), null, 2));

await p.end();
