import pg from "pg";
import fs from "node:fs";
import { DB } from "./_adm_app_02d2_env.mjs";

const FIX = JSON.parse(fs.readFileSync("scripts/_adm_app_02d2_fixture.json", "utf8"));
const PRESTADOR = FIX.A.prestador_id;
const TENANT = FIX.tenant || "00000000-0000-0000-0000-000000000001";

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

// Remove residuos de execucoes anteriores do teste (idempotente).
await c.query(
  `delete from alocacoes_escala
    where metadata->>'os_oper_01' = 'true'
       or ordem_servico_id in (select id from ordens_servico where numero like 'OS-TESTE-OSOPER01-%')`
);
await c.query(`delete from ordens_servico where numero like 'OS-TESTE-OSOPER01-%'`);

// Cliente real existente (evita novo cliente). Fallback: null.
const cli = (await c.query(
  `select id from clientes order by created_at limit 1`
)).rows[0]?.id ?? null;

const os = (await c.query(
  `insert into ordens_servico
     (numero, cliente, prestador, status, data, tipo_operacao, carga_tipo,
      peso, volumes, carga_descricao, veiculo_tipo, origem, destino,
      tenant_id, is_teste, created_at, updated_at)
   values ($1,$2,$3,'programada', current_date, 'entrega', 'seca',
      120, 6, 'CARGA TESTE OS-OPER-01', 'Fiorino', 'SAO PAULO - SP', 'CAMPINAS - SP',
      $4, true, now(), now())
   returning id, numero`,
  [`OS-TESTE-OSOPER01-${Date.now()}`, cli, PRESTADOR, TENANT]
)).rows[0];

const aloc = (await c.query(
  `insert into alocacoes_escala
     (prestador_id, ordem_servico_id, cliente_id, data_escala, turno,
      tipo_veiculo, placa, origem, destino, status, quantidade_paradas,
      km_previstos, valor_repasse, operation_mode, coleta_reversa,
      metadata, tenant_id, created_at, updated_at)
   values ($1,$2,$3, current_date, 'diurno',
      'Fiorino', 'TST1A23', 'SAO PAULO - SP', 'CAMPINAS - SP', 'aguardando_aceite', 1,
      100, 250, 'standard_delivery', false,
      '{"os_oper_01": true}'::jsonb, $4, now(), now())
   returning id`,
  [PRESTADOR, os.id, cli, TENANT]
)).rows[0];

const saida = {
  ts: new Date().toISOString(),
  prestador_id: PRESTADOR,
  os_id: os.id,
  os_numero: os.numero,
  alocacao_id: aloc.id,
  cliente_id: cli,
};
fs.writeFileSync("scripts/_os_oper_01_fixture.json", JSON.stringify(saida, null, 2));
console.log(JSON.stringify(saida, null, 2));
await c.end();
console.log("OS-OPER-01 SEED OK");
