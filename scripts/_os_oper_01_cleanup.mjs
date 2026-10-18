import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const before = {
  proofs: (await c.query(`select count(*)::int n from delivery_proofs where operation_id=$1`, [F.alocacao_id])).rows[0].n,
  aloc: (await c.query(`select count(*)::int n from alocacoes_escala where id=$1`, [F.alocacao_id])).rows[0].n,
  os: (await c.query(`select count(*)::int n from ordens_servico where id=$1`, [F.os_id])).rows[0].n,
  osTotal: (await c.query(`select count(*)::int n from ordens_servico`)).rows[0].n,
  alocTotal: (await c.query(`select count(*)::int n from alocacoes_escala`)).rows[0].n,
};

const dProofs = await c.query(`delete from delivery_proofs where operation_id=$1`, [F.alocacao_id]);
const dAloc = await c.query(`delete from alocacoes_escala where id=$1`, [F.alocacao_id]);
const dOs = await c.query(`delete from ordens_servico where id=$1`, [F.os_id]);

const after = {
  proofs: (await c.query(`select count(*)::int n from delivery_proofs where operation_id=$1`, [F.alocacao_id])).rows[0].n,
  aloc: (await c.query(`select count(*)::int n from alocacoes_escala where id=$1`, [F.alocacao_id])).rows[0].n,
  os: (await c.query(`select count(*)::int n from ordens_servico where id=$1`, [F.os_id])).rows[0].n,
  osTotal: (await c.query(`select count(*)::int n from ordens_servico`)).rows[0].n,
  alocTotal: (await c.query(`select count(*)::int n from alocacoes_escala`)).rows[0].n,
};

const provas = {
  proof_removida: after.proofs === 0,
  alocacao_removida: after.aloc === 0,
  os_removida: after.os === 0,
  alocacao_total_menos_1: after.alocTotal === before.alocTotal - dAloc.rowCount,
  os_total_menos_1: after.osTotal === before.osTotal - dOs.rowCount,
};

console.log(JSON.stringify({ before, depois: after, removidos: { proofs: dProofs.rowCount, aloc: dAloc.rowCount, os: dOs.rowCount }, provas }, null, 2));
const falhas = Object.entries(provas).filter(([, v]) => !v).map(([k]) => k);
if (falhas.length) { console.error("FALHAS:", falhas.join(",")); process.exit(1); }
await c.end();
console.log("OS-OPER-01 CLEANUP OK");
