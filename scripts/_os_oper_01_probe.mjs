import pg from "pg";
import { DB } from "./_adm_app_02d2_env.mjs";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

async function fn(name) {
  try {
    const r = await c.query(
      `select pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where p.proname = $1 limit 1`, [name]
    );
    return r.rows[0]?.def ?? null;
  } catch (e) { return "erro: " + e.message; }
}

async function cols(t) {
  return (await c.query(
    `select column_name, data_type from information_schema.columns
      where table_name=$1 order by ordinal_position`, [t]
  )).rows;
}

const out = {
  f_buscar_operacoes_motorista: await fn("f_buscar_operacoes_motorista"),
  f_atualizar_etapa_app: await fn("f_atualizar_etapa_app"),
  alocacoes_escala_cols: await cols("alocacoes_escala"),
  ordens_servico_cols: await cols("ordens_servico"),
};

try {
  out.sample_alocacao = (await c.query(
    `select * from alocacoes_escala order by created_at desc nulls last limit 1`
  )).rows[0] ?? null;
} catch (e) { out.sample_alocacao = "erro: " + e.message; }

console.log(JSON.stringify(out, null, 2));
await c.end();
