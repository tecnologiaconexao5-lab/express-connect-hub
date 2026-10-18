import fs from "node:fs";
import { Client } from "pg";

const env = fs.readFileSync(".env", "utf8");
const db = env.match(/^DATABASE_URL=(.+)$/m)[1];
const fix = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const c = new Client({ connectionString: db, ssl: { rejectUnauthorized: false } });
await c.connect();

const cols = await c.query(
  `select column_name from information_schema.columns
    where table_name = 'prestadores' and column_name in ('liberado_app','status','origem')`
);
console.log("colunas relevantes em prestadores:", JSON.stringify(cols.rows));

const r = await c.query(
  `select id, nome_completo, cpf_cnpj, tipo_parceiro, status, auth_user_id, created_at from prestadores where id = $1`,
  [fix.A.prestador_id]
);
console.log("prestador A:", JSON.stringify(r.rows, null, 2));

if (cols.rows.some((x) => x.column_name === "liberado_app")) {
  const r2 = await c.query("select liberado_app from prestadores where id = $1", [fix.A.prestador_id]);
  console.log("liberado_app:", JSON.stringify(r2.rows));
}

// distribuicao geral (somente leitura) para contexto
const dist = await c.query(
  `select status, coalesce(liberado_app::text,'<nulo>') as liberado, count(*)::int as n
     from prestadores group by 1, 2 order by 3 desc`
).catch((e) => ({ rows: [["erro", e.message, 0]] }));
console.log("distribuicao status/liberado_app:", JSON.stringify(dist.rows));

// row do documento TESTE (status coluna -> divergencia TMS x App / G3)
const doc = await c.query(
  `select id, tipo, status, url from documentos_prestadores where prestador_id = $1 order by created_at desc limit 5`,
  [fix.A.prestador_id]
).catch((e) => ({ rows: [["erro", e.message]] }));
console.log("docs do prestador A:", JSON.stringify(doc.rows, null, 2));

await c.end();
