import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const F = JSON.parse(fs.readFileSync("scripts/_os_oper_01_fixture.json", "utf8"));
const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const a = (await c.query(
  `select id, status, aceite_prestador, data_aceite, finalizada, data_finalizacao,
          horario_inicio_real, horario_fim_real, metadata
     from alocacoes_escala where id = $1`, [F.alocacao_id]
)).rows[0] ?? null;

const os = (await c.query(
  `select id, numero, status from ordens_servico where id = $1`, [F.os_id]
)).rows[0] ?? null;

const proofs = (await c.query(
  `select id, status, receiver_name, signature_url, operation_id
     from delivery_proofs where operation_id = $1`, [F.alocacao_id]
)).rows;

console.log(JSON.stringify({
  alocacao: a && {
    id: a.id,
    status: a.status,
    aceite_prestador: a.aceite_prestador,
    data_aceite: a.data_aceite,
    finalizada: a.finalizada,
    data_finalizacao: a.data_finalizacao,
    horario_inicio_real: a.horario_inicio_real,
    horario_fim_real: a.horario_fim_real,
    etapa_atual: a.metadata?.app_motorista?.etapa_atual ?? null,
    servico_finalizado: a.metadata?.app_motorista?.servico_finalizado ?? null,
  },
  os,
  delivery_proofs: proofs,
}, null, 2));
await c.end();
