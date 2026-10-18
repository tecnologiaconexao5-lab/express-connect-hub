import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const A = FIX.A.prestador_id;

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const existing = await c.query(
  `select id from veiculos where prestador_vinculado = $1`, [A]
);
if (existing.rows.length === 0) {
  const r = await c.query(
    `insert into veiculos (tipo, placa, marca, modelo, ano, principal, status, prestador_vinculado)
     values ('Fiorino', 'TST1A23', 'Ford', 'Fiorino', 2022, true, 'ativo', $1)
     returning id`, [A]
  );
  console.log("veiculo TESTE inserido:", r.rows[0].id);
} else {
  console.log("veiculo ja existente:", existing.rows[0].id);
}

const rows = await c.query(
  `select id, tipo, placa, principal, status, prestador_vinculado
     from veiculos where prestador_vinculado = $1`, [A]
);
console.log(JSON.stringify(rows.rows, null, 2));
await c.end();
console.log("CAD-PERSIST-01 SEED VEICULO OK");
