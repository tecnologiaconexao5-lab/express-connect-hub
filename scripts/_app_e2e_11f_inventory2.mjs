// APP-E2E-11F — dependências exatas da fixture 11E (read-only, defensivo).
import pg from "pg";
import fs from "node:fs";

const cs = fs.readFileSync(".env", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: cs, ssl: { rejectUnauthorized: false } });
const q = async (s, pr = []) => (await pool.query(s, pr)).rows;

const A = "9314c8f8-1698-4bc9-b227-6c313c226b0b";
const P = "f35841b4-5fec-4bf1-961d-35d8f7e93e51";
const AUTH = "a5e51631-5ed8-430d-9041-4b185c03d821";

const cols = async (t) => (await q(`select column_name from information_schema.columns where table_schema='public' and table_name=$1`, [t])).map(r => r.column_name);
const count = async (t, col, val) => (await q(`select count(*)::int n from "${t}" where "${col}"::text=$1`, [val]))[0].n;

const tables = [
  "delivery_proofs", "entregas_protocolo", "portal_tracking_realtime", "operacao_localizacao",
  "historico_alocacoes_escala", "operation_timeline_events", "financeiro_pagar", "financeiro_receber",
  "pagamentos_prestadores", "pagamento_prestadores", "composicao_financeira_os", "composicao_financeira",
  "portal_notificacoes", "os_pod", "reembolsos_prestador", "rotas", "rota_paradas", "ocorrencias",
  "os_ocorrencias", "fatura_itens", "communication_events", "contratos_operacao_execucao",
  "rede_oportunidades", "tracking_public_links", "pending_uploads", "driver_incidents",
  "operation_km", "route_stops", "prestador_os", "motorista_checkins", "patio_checkins",
  "sinistros", "fiscal_documentos_vinculados", "fiscal_ctes", "fiscal_mdfes", "fiscal_nfse",
  "escala_operacional", "os_historico", "eventos_oficiais", "patio_eventos", "crm_historico",
];

const out = { aloc: {}, prest: {} };
for (const t of tables) {
  const c = await cols(t);
  if (!c.length) continue;
  // vínculos por alocação/OS/operação
  for (const col of ["alocacao_id", "ordem_servico_id", "operation_id", "os_id", "escala_id"]) {
    if (c.includes(col)) {
      try { const n = await count(t, col, A); if (n) out.aloc[`${t}.${col}`] = n; } catch {}
    }
  }
  // vínculos por prestador
  for (const col of ["prestador_id", "driver_id", "fornecedor_id", "motorista_id", "prestador_vinculado", "prestador_aceite_id"]) {
    if (c.includes(col)) {
      try { const n = await count(t, col, P); if (n) out.prest[`${t}.${col}`] = n; } catch {}
    }
  }
}

// Origem por texto (origem_id em portal_notificacoes) — já coberto por os_id? conferir específico
out.notif_origem = await q(`select id, tipo, titulo, prestador_id, origem_id, origem_tipo from portal_notificacoes where origem_id=$1`, [A]);

// Sanidade: e a OS pelo número?
out.os_by_num = await q(`select id, numero, status from ordens_servico where numero='ALOC-20260928-9314C8F8'`);

console.log(JSON.stringify(out, null, 2));
await pool.end();
