// APP-E2E-11C — FKs que referenciam as tabelas da fixture (ordem de delete).
import pg from "pg";
import fs from "node:fs";
const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const alvos = ["alocacoes_escala", "ordens_servico", "prestadores", "financeiro_pagar", "pagamentos_prestadores", "composicao_financeira_os", "entregas_protocolo", "delivery_proofs"];
const out = {};

out.fks = await q(
  `select
      con.conname as fk,
      src.relname as tabela_filha,
      (select string_agg(a.attname, ',') from unnest(con.conkey) k join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k) as colunas_filha,
      tgt.relname as tabela_pai,
      con.confdeltype as on_delete
    from pg_constraint con
    join pg_class src on src.oid=con.conrelid
    join pg_class tgt on tgt.oid=con.confrelid
    join pg_namespace n on n.oid=src.relnamespace
   where con.contype='f' and n.nspname='public'
     and tgt.relname = any($1)
   order by tgt.relname, src.relname`, [alvos]);

// triggistas nas tabelas alvo que possam criar dependências em DELETE
out.triggers = await q(
  `select tgrelid::regclass::text as tabela, tgname, tgenabled
     from pg_trigger
    where not tgisinternal and tgrelid::regclass::text = any($1)
    order by 1`, [alvos]);

// on_delete codes legíveis
const map = { a: "NO ACTION", r: "RESTRICT", c: "CASCADE", n: "SET NULL", d: "SET DEFAULT" };
out.fks.forEach(f => { f.on_delete = map[f.on_delete] || f.on_delete; });

console.log(JSON.stringify(out, null, 2));
await pool.end();
