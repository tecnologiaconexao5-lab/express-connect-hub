// APP-E2E-11C — ROLLBACK CONTROLADO da fixture TESTE E2E-11.
// Transação única. Deletes child->parent. NÃO toca em auth.users, nem em
// objetos/dados de outras missões. Falha => ROLLBACK total.
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const AUTHUID = "a5e51631-5ed8-430d-9041-4b185c03d821";

const res = { deletes: {}, antes: {}, depois: {}, storedRemoved: {}, blocked: [] };
const one = async (sql, pr = []) => (await client.query(sql, pr)).rows;
const del = async (label, sql, pr = []) => {
  const r = await client.query(sql, pr);
  res.deletes[label] = r.rowCount;
  return r.rowCount;
};

try {
  await client.query("BEGIN");

  const cont = async () => ({
    alocacoes_escala: (await one(`select count(*)::int n from alocacoes_escala where id=$1`, [ALOC]))[0].n,
    ordens_servico: (await one(`select count(*)::int n from ordens_servico where id=$1`, [ALOC]))[0].n,
    delivery_proofs: (await one(`select count(*)::int n from delivery_proofs where operation_id=$1`, [ALOC]))[0].n,
    entregas_protocolo: (await one(`select count(*)::int n from entregas_protocolo where alocacao_id=$1 or ordem_servico_id=$1`, [ALOC]))[0].n,
    historico_alocacoes_escala: (await one(`select count(*)::int n from historico_alocacoes_escala where alocacao_id=$1`, [ALOC]))[0].n,
    operation_timeline_events: (await one(`select count(*)::int n from operation_timeline_events where operation_id=$1`, [ALOC]))[0].n,
    portal_tracking_realtime: (await one(`select count(*)::int n from portal_tracking_realtime where alocacao_id=$1`, [ALOC]))[0].n,
    operacao_localizacao: (await one(`select count(*)::int n from operacao_localizacao where alocacao_id=$1`, [ALOC]))[0].n,
    financeiro_pagar: (await one(`select count(*)::int n from financeiro_pagar where os_id=$1`, [ALOC]))[0].n,
    pagamentos_prestadores: (await one(`select count(*)::int n from pagamentos_prestadores where os_id=$1`, [ALOC]))[0].n,
    composicao_financeira_os: (await one(`select count(*)::int n from composicao_financeira_os where os_id::text=$1`, [ALOC]))[0].n,
    portal_notificacoes: (await one(`select count(*)::int n from portal_notificacoes where origem_id=$1`, [ALOC]))[0].n,
    prestadores: (await one(`select count(*)::int n from prestadores where id=$1`, [PREST]))[0].n,
    storage_fixture: (await one(`select count(*)::int n from storage.objects where bucket_id='driver-evidence' and name like '%'||$1||'%'`, [ALOC]))[0].n,
  });

  res.antes = await cont();

  // ---- filhos ----
  await del("operation_timeline_events", `delete from operation_timeline_events where operation_id=$1`, [ALOC]);
  await del("delivery_proofs", `delete from delivery_proofs where operation_id=$1`, [ALOC]);
  await del("entregas_protocolo", `delete from entregas_protocolo where alocacao_id=$1 or ordem_servico_id=$1`, [ALOC]);
  await del("portal_tracking_realtime", `delete from portal_tracking_realtime where alocacao_id=$1`, [ALOC]);
  await del("operacao_localizacao", `delete from operacao_localizacao where alocacao_id=$1`, [ALOC]);
  await del("historico_alocacoes_escala", `delete from historico_alocacoes_escala where alocacao_id=$1`, [ALOC]);

  // ---- financeiro derivado ----
  await del("pagamentos_prestadores_itens", `delete from pagamentos_prestadores_itens where os_id=$1 or pagamento_id in (select id from pagamentos_prestadores where os_id=$1)`, [ALOC]);
  await del("composicao_financeira_os", `delete from composicao_financeira_os where os_id::text=$1`, [ALOC]);
  try { await del("composicao_financeira", `delete from composicao_financeira where os_id::text=$1`, [ALOC]); } catch (e) { res.deletes.composicao_financeira = "n/a:" + e.message; }
  await del("financeiro_pagar", `delete from financeiro_pagar where os_id=$1`, [ALOC]);
  await del("pagamentos_prestadores", `delete from pagamentos_prestadores where os_id=$1`, [ALOC]);
  await del("portal_notificacoes", `delete from portal_notificacoes where origem_id=$1`, [ALOC]);

  // ---- pais ----
  await del("alocacoes_escala", `delete from alocacoes_escala where id=$1`, [ALOC]);
  await del("ordens_servico", `delete from ordens_servico where id=$1`, [ALOC]);

  // ---- prestador: guarda de dependências ----
  const depQueries = [
    ["alocacoes_escala", `select count(*)::int n from alocacoes_escala where prestador_id=$1`],
    ["entregas_protocolo", `select count(*)::int n from entregas_protocolo where prestador_id=$1`],
    ["financeiro_pagar", `select count(*)::int n from financeiro_pagar where fornecedor_id=$1`],
    ["pagamentos_prestadores", `select count(*)::int n from pagamentos_prestadores where prestador_id=$1`],
    ["operacao_localizacao", `select count(*)::int n from operacao_localizacao where prestador_id=$1`],
    ["operation_timeline_events", `select count(*)::int n from operation_timeline_events where driver_id=$1`],
    ["portal_notificacoes", `select count(*)::int n from portal_notificacoes where prestador_id=$1`],
    ["portal_tracking_realtime", `select count(*)::int n from portal_tracking_realtime where prestador_id=$1`],
    ["ordens_servico", `select count(*)::int n from ordens_servico where prestador=$1`],
    ["candidatos", `select count(*)::int n from candidatos where prestador_id=$1`],
    ["crm_interacoes_prestadores", `select count(*)::int n from crm_interacoes_prestadores where prestador_id=$1`],
    ["motorista_app_sessoes", `select count(*)::int n from motorista_app_sessoes where motorista_id=$1`],
    ["motorista_checkins", `select count(*)::int n from motorista_checkins where prestador_id=$1`],
    ["ocorrencias", `select count(*)::int n from ocorrencias where prestador_id=$1`],
    ["provider_documents", `select count(*)::int n from provider_documents where prestador_id=$1`],
    ["prestador_disponibilidade", `select count(*)::int n from prestador_disponibilidade where prestador_id=$1`],
    ["prestadores_ocorrencias", `select count(*)::int n from prestadores_ocorrencias where prestador_id=$1`],
    ["rede_visualizacoes", `select count(*)::int n from rede_visualizacoes where prestador_id=$1`],
    ["rede_oportunidades", `select count(*)::int n from rede_oportunidades where prestador_aceite_id=$1`],
    ["veiculos", `select count(*)::int n from veiculos where prestador_vinculado=$1`],
    ["prestador_os", `select count(*)::int n from prestador_os where prestador_id=$1`],
    ["composicao_financeira_os", `select count(*)::int n from composicao_financeira_os where prestador_id=$1`],
  ];
  let totalDep = 0;
  res.depsPrestador = {};
  for (const [t, sql] of depQueries) {
    try { const n = (await one(sql, [PREST]))[0].n; res.depsPrestador[t] = n; totalDep += n; } catch (e) { res.depsPrestador[t] = "n/a"; }
  }
  if (totalDep === 0) {
    res.deletes.prestadores = await del("prestadores", `delete from prestadores where id=$1`, [PREST]);
  } else {
    res.blocked.push("prestador: dependências residuais=" + totalDep);
  }

  // ---- STORAGE (somente objetos com o id da fixture no path) ----
  // Guard do Supabase proíbe DELETE direto em storage.objects ("Use the Storage API").
  // Sem SERVICE_ROLE_KEY de PRODUÇÃO a remoção via Storage API é BLOCKED. Isolamos
  // com SAVEPOINT para não abortar o rollback do banco.
  try {
    await client.query("SAVEPOINT sp_storage");
    res.deletes.storage_fixture = (await client.query(
      `delete from storage.objects where bucket_id='driver-evidence' and name like '%'||$1||'%'`, [ALOC]
    )).rowCount;
    await client.query("RELEASE SAVEPOINT sp_storage");
  } catch (e) {
    await client.query("ROLLBACK TO SAVEPOINT sp_storage");
    res.deletes.storage_fixture = "BLOCKED";
    res.blocked.push("storage(driver-evidence): remoção exige Storage API + SERVICE_ROLE_KEY de produção — " + e.message);
  }

  res.depois = await cont();

  // Guard final: nenhuma contagem residual da fixture (storage é BLOCKED por design)
  const resid = Object.entries(res.depois).filter(([k, v]) => k !== "storage_fixture" && v !== 0);
  if (resid.length) {
    throw new Error("Resíduos após delete: " + JSON.stringify(resid));
  }

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
