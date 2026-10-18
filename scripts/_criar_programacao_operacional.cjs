/* eslint-disable no-console */
// MASSA-DE-DADOS-POG — Cria "Programação Operacional" (alocacoes_escala) com
// status aguardando_aceite (TMS: "pendente" / App: "Aguardando você aceitar"),
// vinculada ao prestador de teste e ao veículo HML001. NÃO cria OS.
const fs = require("fs");
const { Client } = require("pg");

function env(k) {
  for (const f of [".env", ".env.local"]) {
    try {
      const t = fs.readFileSync(f, "utf8");
      const l = t.split(/\r?\n/).find((x) => x.startsWith(k + "="));
      if (l) return l.slice(k.length + 1).trim();
    } catch {}
  }
  return "";
}

const PRESTADOR_ID = "f61e4161-6be7-46d8-be90-984b86222d08"; // PRESTADOR TESTE APP
const CLIENTE_ID = "336c5b17-cefd-488c-a927-32ea0dc9a161"; // CLIENTE HML 136A
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ROTA = "PROG-HML-001";
const ENDERECO_ORIGEM = "Rua Jamil Joao Zarif, 684 - Jardim Santa Vicencia - Guarulhos/SP";
const ENDERECO_DESTINO = "Avenida Paulista, 1500 - Bela Vista - Sao Paulo/SP";

(async () => {
  const c = new Client({ connectionString: env("DATABASE_URL"), ssl: { rejectUnauthorized: false } });
  await c.connect();
  const r = await c.query(
    `INSERT INTO public.alocacoes_escala (
       data_escala, turno, tipo_veiculo, placa,
       prestador_id, cliente_id, ordem_servico_id,
       rota, origem, destino, endereco_origem, endereco_destino,
       status, status_pagamento, aceite_prestador, finalizada,
       quantidade_paradas, quantidade_entregas,
       km_previstos, valor_frete, valor_repasse, valor_tipo, valor_fixo,
       horario_saida, horario_retorno_previsto,
       observacoes, metadata, tenant_id
     ) VALUES (
       CURRENT_DATE, 'diurno', 'Moto', 'HML001',
       $1, $2, NULL,
       $3,
       'Rua Jamil Joao Zarif, 684 - Jardim Santa Vicencia - Guarulhos/SP',
       'Avenida Paulista, 1500 - Bela Vista - Sao Paulo/SP',
       $6::jsonb,
       $7::jsonb,
       'aguardando_aceite', 'pendente', false, false,
       2, 2,
       35, 380, 250, 'fixo', 250,
       '08:00:00', '18:00:00',
       'MASSA-DE-DADOS-POG: Programacao Operacional de teste (pendente) para o app do motorista',
       $4::jsonb, $5
     )
     RETURNING id::text, rota, status, data_escala::text, tipo_veiculo, placa,
               prestador_id::text, cliente_id::text, ordem_servico_id, valor_repasse, tenant_id::text`,
    [
      PRESTADOR_ID,
      CLIENTE_ID,
      ROTA,
      JSON.stringify({
        tipo: "escala",
        missao: "MASSA-DE-DADOS-POG",
        homologacao: true,
        romaneio: "HML-PROG-001",
        app_motorista: { escala: ROTA, romaneio: "HML-PROG-001" },
      }),
      TENANT_ID,
      JSON.stringify(ENDERECO_ORIGEM),
      JSON.stringify(ENDERECO_DESTINO),
    ],
  );
  console.log("PROGRAMACAO OPERACIONAL CRIADA:");
  console.table(r.rows);

  // Prova via RPC do app (transação com ROLLBACK): a operacao cai para o motorista.
  await c.query("BEGIN");
  await c.query(`select set_config('request.jwt.claims', '{"sub":"a5e51631-5ed8-430d-9041-4b185c03d821","role":"authenticated"}', false)`);
  await c.query("set local role authenticated");
  const rpc = await c.query(
    `select o->>'rota' as rota, o->>'status' as status, o->>'placa' as placa,
            o->>'cliente_nome' as cliente, o->>'valor_repasse' as repasse
     from f_buscar_operacoes_motorista() t, jsonb_array_elements(t->'operacoes') o
     where o->>'rota' = $1`,
    [ROTA],
  );
  await c.query("ROLLBACK");
  console.log("PROVA RPC f_buscar_operacoes_motorista (rollback):");
  console.table(rpc.rows);
  console.log(rpc.rows.length === 1 ? "OK: a Programacao aparece para o motorista (status=" + rpc.rows[0].status + ")." : "FALHA: nao apareceu na RPC.");
  await c.end();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
