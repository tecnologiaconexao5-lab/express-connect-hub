// MISSÃO 133-D.7 — FASE 1: Buscar registros HML/TEST/QA/DEMO em produção
// Somente SELECT. Nenhuma modificação.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

const HML_PATTERNS = ['HML', 'TEST', 'QA', 'DEMO', 'AUDITORIA', 'PLAYWRIGHT', 'E2E', 'MISSAO', 'HOMOLOG'];
const HML_COND = HML_PATTERNS.map(p => `(UPPER(COALESCE(identificador,'')||' '||COALESCE(observacoes,'')||' '||COALESCE(descricao,'')||' '||COALESCE(razao_social,'')||' '||COALESCE(nome_fantasia,'')||' '||COALESCE(nome,'')||' '||COALESCE(placa,'')) LIKE '%${p}%')`).join(' OR ');
const HML_COND_OS = HML_PATTERNS.map(p => `(UPPER(COALESCE(numero_os,'')||' '||COALESCE(observacoes,'')||' '||COALESCE(descricao,'')||' '||COALESCE(origem,'')||' '||COALESCE(destino,'')) LIKE '%${p}%')`).join(' OR ');

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await client.connect();
  console.log('=== FASE 1 — BUSCA POR REGISTROS DE HOMOLOGACAO ===\n');

  let results = [];

  // 1. ordens_servico
  const osRes = await client.query(`SELECT id, numero_os, status, cliente, created_at FROM public.ordens_servico WHERE ${HML_COND_OS} LIMIT 20`);
  for (const r of osRes.rows) results.push({ tabela: 'ordens_servico', id: r.id, info: `OS: ${r.numero_os} | Status: ${r.status} | Cliente: ${r.cliente?.toString().substring(0,8)} | Criada: ${r.created_at}` });

  // 2. alocacoes_escala
  const aeRes = await client.query(`SELECT id, status, prestador_id, cliente_id, data_escala, created_at FROM public.alocacoes_escala WHERE ${HML_COND} LIMIT 20`);
  for (const r of aeRes.rows) results.push({ tabela: 'alocacoes_escala', id: r.id, info: `Status: ${r.status} | Prestador: ${r.prestador_id?.toString().substring(0,8)} | Data: ${r.data_escala} | Criada: ${r.created_at}` });

  // 3. prestadores
  const prRes = await client.query(`SELECT id, razao_social, nome_fantasia, status, auth_user_id IS NOT NULL AS tem_auth FROM public.prestadores WHERE ${HML_COND} LIMIT 20`);
  for (const r of prRes.rows) results.push({ tabela: 'prestadores', id: r.id, info: `Razao: ${r.razao_social} | Status: ${r.status} | auth: ${r.tem_auth ? 'SIM' : 'NAO'}` });

  // 4. clientes
  const clRes = await client.query(`SELECT id, razao_social, nome_fantasia, status FROM public.clientes WHERE ${HML_COND} LIMIT 20`);
  for (const r of clRes.rows) results.push({ tabela: 'clientes', id: r.id, info: `Razao: ${r.razao_social} | Status: ${r.status}` });

  // 5. veiculos
  const veRes = await client.query(`SELECT id, placa, prestador_vinculado, status FROM public.veiculos WHERE ${HML_COND} LIMIT 20`);
  for (const r of veRes.rows) results.push({ tabela: 'veiculos', id: r.id, info: `Placa: ${r.placa} | Status: ${r.status} | Prestador: ${r.prestador_vinculado?.toString().substring(0,8)}` });

  // 6. eventos_oficiais (usar event_type)
  const evCond = HML_PATTERNS.map(p => `(UPPER(COALESCE(event_type,'')||' '||COALESCE(source,'')) LIKE '%${p}%')`).join(' OR ');
  const evRes = await client.query(`SELECT id, event_type, entity_type, entity_id, source, created_at FROM public.eventos_oficiais WHERE ${evCond} LIMIT 20`);
  for (const r of evRes.rows) results.push({ tabela: 'eventos_oficiais', id: r.id, info: `Type: ${r.event_type} | Entity: ${r.entity_type}:${r.entity_id?.toString().substring(0,8)} | Source: ${r.source} | Criado: ${r.created_at}` });

  // 7. operation_timeline_events
  const tlCond = HML_PATTERNS.map(p => `(UPPER(COALESCE(type,'')||' '||COALESCE(title,'')) LIKE '%${p}%')`).join(' OR ');
  const tlRes = await client.query(`SELECT id, operation_id, type, title, event_time FROM public.operation_timeline_events WHERE ${tlCond} LIMIT 20`);
  for (const r of tlRes.rows) results.push({ tabela: 'operation_timeline_events', id: r.id, info: `Operation: ${r.operation_id?.toString().substring(0,8)} | Type: ${r.type} | Time: ${r.event_time}` });

  // 8. financeiro_receber
  const frCond = HML_PATTERNS.map(p => `(UPPER(COALESCE(descricao,'')||' '||COALESCE(os_id,'')) LIKE '%${p}%')`).join(' OR ');
  const frRes = await client.query(`SELECT id, os_id, valor, status, created_at FROM public.financeiro_receber WHERE ${frCond} LIMIT 20`);
  for (const r of frRes.rows) results.push({ tabela: 'financeiro_receber', id: r.id, info: `OS: ${r.os_id?.toString().substring(0,8)} | Valor: ${r.valor} | Status: ${r.status}` });

  // 9. financeiro_pagar
  const fpRes = await client.query(`SELECT id, os_id, valor, status FROM public.financeiro_pagar WHERE ${frCond} LIMIT 20`);
  for (const r of fpRes.rows) results.push({ tabela: 'financeiro_pagar', id: r.id, info: `OS: ${r.os_id?.toString().substring(0,8)} | Valor: ${r.valor} | Status: ${r.status}` });

  // 10. pagamentos_prestadores
  const ppRes = await client.query(`SELECT id, os_id, prestador_id, valor, status FROM public.pagamentos_prestadores WHERE ${frCond} LIMIT 20`);
  for (const r of ppRes.rows) results.push({ tabela: 'pagamentos_prestadores', id: r.id, info: `OS: ${r.os_id?.toString().substring(0,8)} | Prest: ${r.prestador_id?.toString().substring(0,8)} | Valor: ${r.valor} | Status: ${r.status}` });

  // 11. composicao_financeira_os
  const cfRes = await client.query(`SELECT id, os_id, created_at FROM public.composicao_financeira_os WHERE ${frCond} LIMIT 20`);
  for (const r of cfRes.rows) results.push({ tabela: 'composicao_financeira_os', id: r.id, info: `OS: ${r.os_id?.toString().substring(0,8)} | Criado: ${r.created_at}` });

  // Report
  if (results.length === 0) {
    console.log('NENHUM REGISTRO HML/TEST/QA/DEMO encontrado nas 11 tabelas consultadas.\n');
  } else {
    console.log(`Encontrados ${results.length} candidatos:\n`);
    for (const r of results) {
      console.log(`  [${r.tabela}] ID: ${r.id.toString().substring(0,8)}... | ${r.info}`);
    }
    console.log();
  }

  // Summary counts per table
  console.log('--- SUMARIO POR TABELA ---');
  const tables = ['ordens_servico','alocacoes_escala','prestadores','clientes','veiculos','eventos_oficiais','operation_timeline_events','financeiro_receber','financeiro_pagar','pagamentos_prestadores','composicao_financeira_os'];
  for (const tbl of tables) {
    const count = results.filter(r => r.tabela === tbl).length;
    if (count > 0) console.log(`  ${tbl}: ${count}`);
  }

  await client.end();
  process.exit(0);
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
