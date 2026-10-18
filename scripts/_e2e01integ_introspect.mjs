import fs from "node:fs";
import { Client } from "pg";
const env = fs.readFileSync(".env", "utf8");
const DB = env.match(/^DATABASE_URL=(.+)$/m)[1];
const c = new Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const r = await c.query(`select pg_get_functiondef('f_buscar_operacoes_motorista(uuid)'::regprocedure) def`);
fs.writeFileSync("scripts/_e2e01integ_rpc.sql", r.rows[0].def, "utf8");
console.log(r.rows[0].def);

// colunas de vinculo
for (const [t, cols] of [["alocacoes_escala", ["id", "ordem_servico_id", "prestador_id", "cliente_id", "status", "finalizada", "aceite_prestador"]],
                          ["ordens_servico", ["id", "numero", "orcamento_id", "orcamento_origem", "prestador", "prestador_id", "cliente", "cliente_id", "status"]],
                          ["prestadores", ["id", "auth_user_id", "nome_completo", "status", "liberado_app"]],
                          ["orcamentos", ["id", "numero", "status", "os_vinculada_id", "os_vinculada_numero"]]]) {
  const rr = await c.query(`select column_name from information_schema.columns where table_name=$1 and column_name=any($2)`, [t, cols]);
  console.log(`\n${t}: ${rr.rows.map(x=>x.column_name).join(", ")}`);
}
await c.end();
