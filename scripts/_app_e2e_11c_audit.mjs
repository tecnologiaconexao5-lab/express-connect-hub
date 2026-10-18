// APP-E2E-11C — auditoria READ-ONLY da fixture TESTE E2E-11.
// NAO executa DDL/DML. Somente SELECT.
import pg from "pg";
import fs from "node:fs";

const env = fs.readFileSync(".env", "utf8");
const cs = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const ALOC = "18d50f0b-704f-4361-8626-ed43c8000601";
const PREST = "b45890ff-454c-40a0-a89e-5333a88eb316";
const TENANT = "00000000-0000-0000-0000-000000000001";

const out = {};

// --- Descoberta de tabelas relevantes ---
out.tabelas = await q(
  `select table_name from information_schema.tables
   where table_schema='public'
     and (table_name ilike '%tracking%' or table_name ilike '%proof%'
          or table_name ilike '%protocolo%' or table_name ilike '%entrega%'
          or table_name ilike '%evento%' or table_name ilike '%histor%'
          or table_name ilike '%pagar%' or table_name ilike '%receber%'
          or table_name ilike '%aprov%' or table_name ilike '%indica%'
          or table_name='alocacoes_escala' or table_name='prestadores')
   order by table_name`
);

// Colunas de alocacoes_escala
out.aloc_cols = (await q(
  `select column_name from information_schema.columns where table_schema='public' and table_name='alocacoes_escala' order by ordinal_position`
)).map(r => r.column_name);

// --- Fixture: alocacao ---
out.alocacao = await q(`select * from alocacoes_escala where id=$1`, [ALOC]);

// --- Prestador ---
out.prestador = await q(`select * from prestadores where id=$1`, [PREST]);

// --- Delivery proofs / entregas_protocolo ---
for (const t of ["delivery_proofs", "entregas_protocolo"]) {
  try {
    out[t] = await q(
      `select * from ${t} where operation_id=$1 or alocacao_id=$1 or os_id=$1 or ordem_servico_id=$1`,
      [ALOC]
    );
  } catch (e) {
    out[t] = { erro: e.message };
  }
}

// --- Tracking ---
for (const t of ["portal_tracking_realtime", "tracking_realtime", "operacao_localizacao"]) {
  try {
    const cols = (await q(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
      [t]
    )).map(r => r.column_name);
    if (!cols.length) { out[t] = { nao_existe: true }; continue; }
    const link = ["alocacao_id", "ordem_servico_id", "os_id"].filter(c => cols.includes(c));
    const where = link.length
      ? link.map(c => `${c}=$1`).join(" or ")
      : (cols.includes("prestador_id") ? "prestador_id=$2" : "false");
    out[t] = { cols, rows: await q(`select * from ${t} where ${where} order by created_at nulls last`, [ALOC, PREST]) };
  } catch (e) {
    out[t] = { erro: e.message };
  }
}

// --- Eventos / histórico ---
for (const t of ["historico_alocacoes_escala", "eventos_oficiais", "operation_timeline_events"]) {
  try {
    const cols = (await q(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1`,
      [t]
    )).map(r => r.column_name);
    if (!cols.length) { out[t] = { nao_existe: true }; continue; }
    const link = ["alocacao_id", "operation_id", "ordem_servico_id"].filter(c => cols.includes(c));
    if (!link.length) { out[t] = { cols, rows: [] }; continue; }
    out[t] = { cols, rows: await q(`select * from ${t} where ${link.map(c => `${c}=$1`).join(" or ")}`, [ALOC]) };
  } catch (e) {
    out[t] = { erro: e.message };
  }
}

console.log(JSON.stringify(out, null, 2));
await pool.end();
