// APP-E2E-11F — snapshot pré-limpeza + LIMPEZA CONTROLADA da fixture 11E.
// Transação única, child->parent, guard de resíduos. NÃO toca auth.users.
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const A = "9314c8f8-1698-4bc9-b227-6c313c226b0b";
const P = "f35841b4-5fec-4bf1-961d-35d8f7e93e51";

const res = { antes: {}, detalhe: {}, deletes: {}, depois: {}, status: null };
const one = async (sql, pr = []) => (await client.query(sql, pr)).rows;
const del = async (label, sql, pr = []) => { const r = await client.query(sql, pr); res.deletes[label] = r.rowCount; return r.rowCount; };

try {
  await client.query("BEGIN");

  const cont = async () => ({
    alocacoes_escala: (await one(`select count(*)::int n from alocacoes_escala where id=$1`, [A]))[0].n,
    ordens_servico: (await one(`select count(*)::int n from ordens_servico where id=$1`, [A]))[0].n,
    historico_alocacoes_escala: (await one(`select count(*)::int n from historico_alocacoes_escala where alocacao_id=$1`, [A]))[0].n,
    operation_timeline_events: (await one(`select count(*)::int n from operation_timeline_events where operation_id=$1`, [A]))[0].n,
    portal_notificacoes: (await one(`select count(*)::int n from portal_notificacoes where origem_id=$1 or prestador_id=$2`, [A, P]))[0].n,
    financeiro_pagar: (await one(`select count(*)::int n from financeiro_pagar where os_id=$1 or fornecedor_id=$2`, [A, P]))[0].n,
    pagamentos_prestadores: (await one(`select count(*)::int n from pagamentos_prestadores where os_id=$1 or prestador_id=$2`, [A, P]))[0].n,
    prestadores: (await one(`select count(*)::int n from prestadores where id=$1`, [P]))[0].n,
  });

  res.antes = await cont();
  res.detalhe.financeiro_pagar = await one(`select id, descricao, valor, status, is_teste, os_id, fornecedor_id from financeiro_pagar where os_id=$1 or fornecedor_id=$2`, [A, P]);
  res.detalhe.pagamentos_prestadores = await one(`select id, valor_liquido, status, status_pagamento, origem_lancamento, is_teste, os_id, prestador_id from pagamentos_prestadores where os_id=$1 or prestador_id=$2`, [A, P]);
  res.detalhe.notificacoes = await one(`select id, tipo, titulo, lida from portal_notificacoes where origem_id=$1 or prestador_id=$2`, [A, P]);
  res.detalhe.timeline = await one(`select id, type, title, driver_id from operation_timeline_events where operation_id=$1`, [A]);
  res.detalhe.historico = await one(`select id, evento, status_anterior, status_novo from historico_alocacoes_escala where alocacao_id=$1 order by created_at`, [A]);

  // ---- deletes child -> parent ----
  await del("historico_alocacoes_escala", `delete from historico_alocacoes_escala where alocacao_id=$1`, [A]);
  await del("operation_timeline_events", `delete from operation_timeline_events where operation_id=$1`, [A]);
  await del("portal_notificacoes", `delete from portal_notificacoes where origem_id=$1 or prestador_id=$2`, [A, P]);
  await del("financeiro_pagar", `delete from financeiro_pagar where os_id=$1 or fornecedor_id=$2`, [A, P]);
  await del("pagamentos_prestadores", `delete from pagamentos_prestadores where os_id=$1 or prestador_id=$2`, [A, P]);
  await del("alocacoes_escala", `delete from alocacoes_escala where id=$1`, [A]);
  await del("ordens_servico", `delete from ordens_servico where id=$1`, [A]);

  // guard prestador
  const deps = [
    ["alocacoes_escala", `select count(*)::int n from alocacoes_escala where prestador_id=$1`],
    ["financeiro_pagar", `select count(*)::int n from financeiro_pagar where fornecedor_id=$1`],
    ["pagamentos_prestadores", `select count(*)::int n from pagamentos_prestadores where prestador_id=$1`],
    ["operation_timeline_events", `select count(*)::int n from operation_timeline_events where driver_id=$1`],
    ["portal_notificacoes", `select count(*)::int n from portal_notificacoes where prestador_id=$1`],
    ["entregas_protocolo", `select count(*)::int n from entregas_protocolo where prestador_id=$1`],
    ["candidatos", `select count(*)::int n from candidatos where prestador_id=$1`],
    ["crm_interacoes_prestadores", `select count(*)::int n from crm_interacoes_prestadores where prestador_id=$1`],
    ["motorista_app_sessoes", `select count(*)::int n from motorista_app_sessoes where motorista_id=$1`],
    ["motorista_checkins", `select count(*)::int n from motorista_checkins where prestador_id=$1`],
    ["provider_documents", `select count(*)::int n from provider_documents where prestador_id=$1`],
    ["prestador_disponibilidade", `select count(*)::int n from prestador_disponibilidade where prestador_id=$1`],
    ["rede_visualizacoes", `select count(*)::int n from rede_visualizacoes where prestador_id=$1`],
    ["veiculos", `select count(*)::int n from veiculos where prestador_vinculado=$1`],
    ["prestador_os", `select count(*)::int n from prestador_os where prestador_id=$1`],
  ];
  let total = 0;
  res.depsPrestador = {};
  for (const [t, sql] of deps) { try { const n = (await one(sql, [P]))[0].n; res.depsPrestador[t] = n; total += n; } catch { res.depsPrestador[t] = "n/a"; } }
  if (total === 0) await del("prestadores", `delete from prestadores where id=$1`, [P]);
  else res.blocked = `prestador resid=${total}`;

  res.depois = await cont();
  const resid = Object.entries(res.depois).filter(([k, v]) => v !== 0 && v !== "n/a");
  if (resid.length) throw new Error("Resíduos: " + JSON.stringify(resid));

  await client.query("COMMIT");
  res.status = "COMMIT";
} catch (e) {
  await client.query("ROLLBACK");
  res.status = "ROLLBACK";
  res.erro = e.message;
} finally {
  console.log(JSON.stringify(res, null, 2));
  client.release();
  await pool.end();
}
