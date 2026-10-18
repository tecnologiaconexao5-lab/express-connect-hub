// MISSÃO 133-D.7 — FASE 1: Busca definitiva com colunas reais
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const P = ['HML', 'TESTE', 'TEST', 'QA', 'DEMO', 'AUDITORIA', 'PLAYWRIGHT', 'E2E', 'MISSAO', 'HOMOLOG'];
function likeAny(cols) { return P.map(p => `UPPER(${cols.join("||' '||")}) LIKE '%${p}%'`).join(' OR '); }

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await c.connect();
  console.log('=== FASE 1 — BUSCA REGISTROS HOMOLOGACAO (v3) ===\n');

  // 1. ordens_servico — numero, observacoes_gerais
  const r1 = await c.query(`SELECT id, numero, status, LEFT(cliente::text,8) AS cli, data_servico, LEFT(observacoes_gerais,120) AS obs FROM public.ordens_servico WHERE ${likeAny(['COALESCE(numero,\'\')','COALESCE(observacoes_gerais,\'\')'])} LIMIT 20`);
  console.log(`ordens_servico: ${r1.rows.length}`);
  for (const r of r1.rows) console.log(`  ${r.id.toString().substring(0,8)}... "${r.numero}" | ${r.status} | ${r.obs || ''}`);

  // 2. alocacoes_escala — rota, observacoes, instrucoes_operacionais, ocorrencias_descricao, origem, destino
  const r2 = await c.query(`SELECT id, status, LEFT(prestador_id::text,8) AS prest, data_escala, LEFT(rota,80) AS rota, LEFT(observacoes,120) AS obs, LEFT(ocorrencias_descricao,80) AS ocorr FROM public.alocacoes_escala WHERE ${likeAny(['COALESCE(rota,\'\')','COALESCE(observacoes,\'\')','COALESCE(instrucoes_operacionais,\'\')','COALESCE(ocorrencias_descricao,\'\')','COALESCE(origem,\'\')','COALESCE(destino,\'\')'])} LIMIT 20`);
  console.log(`\nalocacoes_escala: ${r2.rows.length}`);
  for (const r of r2.rows) {
    const tags = [r.rota, r.obs, r.ocorr].filter(Boolean).join(' | ').substring(0, 120);
    console.log(`  ${r.id.toString().substring(0,8)}... ${r.status} | Prest:${r.prest} | ${tags}`);
  }

  // 3. prestadores
  const r3 = await c.query(`SELECT id, nome_completo, status, auth_user_id IS NOT NULL AS auth FROM public.prestadores WHERE ${likeAny(['COALESCE(nome_completo,\'\')','COALESCE(cpf_cnpj,\'\')','COALESCE(regiao_principal,\'\')'])} LIMIT 20`);
  console.log(`\nprestadores: ${r3.rows.length}`);
  for (const r of r3.rows) console.log(`  ${r.id.toString().substring(0,8)}... ${r.nome_completo} | ${r.status} | auth:${r.auth?'YES':'NO'}`);

  // 4. eventos_oficiais
  const r6 = await c.query(`SELECT id, event_type, LEFT(entity_id::text,8) AS eid, source, created_at FROM public.eventos_oficiais WHERE ${likeAny(['COALESCE(event_type,\'\')','COALESCE(source,\'\')'])} LIMIT 20`);
  console.log(`\neventos_oficiais: ${r6.rows.length}`);
  for (const r of r6.rows) console.log(`  ${r.id.toString().substring(0,8)}... ${r.event_type} | ${r.source} | ${r.eid}`);

  // 5. financeiro_receber
  const r7 = await c.query(`SELECT id, LEFT(os_id::text,8) AS osid, valor, status FROM public.financeiro_receber WHERE ${likeAny(['COALESCE(descricao,\'\')','COALESCE(categoria,\'\')','COALESCE(os_id::text,\'\')'])} LIMIT 20`);
  console.log(`\nfinanceiro_receber: ${r7.rows.length}`);
  for (const r of r7.rows) console.log(`  ${r.id.toString().substring(0,8)}... OS:${r.osid} R$${r.valor} ${r.status}`);

  await c.end();
})();
