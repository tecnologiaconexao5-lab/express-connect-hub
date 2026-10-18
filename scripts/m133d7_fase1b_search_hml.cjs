// MISSÃO 133-D.7 — FASE 1 (v2): Buscar registros HML/TEST/QA/DEMO
// Colunas corrigidas conforme schema real

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

// Patterns to search
const P = ['HML', 'TEST', 'QA', 'DEMO', 'AUDITORIA', 'PLAYWRIGHT', 'E2E', 'MISSAO', 'HOMOLOG'];
function likeAny(cols) { return P.map(p => `UPPER(${cols.join("||' '||")}) LIKE '%${p}%'`).join(' OR '); }

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await client.connect();
  console.log('=== FASE 1 — BUSCA POR REGISTROS DE HOMOLOGACAO ===\n');

  let found = [];

  // 1. ordens_servico
  const condOS = likeAny(['COALESCE(numero,\'\')','COALESCE(observacoes,\'\')','COALESCE(descricao,\'\')','COALESCE(origem,\'\')','COALESCE(destino,\'\')']);
  const r1 = await client.query(`SELECT id, numero, status, cliente::text, data_servico FROM public.ordens_servico WHERE ${condOS} LIMIT 20`);
  for (const r of r1.rows) found.push({ T:'ordens_servico', ID:r.id, I:`Numero:${r.numero} Status:${r.status} Cliente:${(r.cliente||'').substring(0,8)} Data:${r.data_servico}` });

  // 2. alocacoes_escala — search observacoes and rota
  const condAE = likeAny(['COALESCE(observacoes,\'\')','COALESCE(rota,\'\')','COALESCE(origem,\'\')','COALESCE(destino,\'\')','COALESCE(tipo_veiculo,\'\')','COALESCE(turno,\'\')']);
  const r2 = await client.query(`SELECT id, status, prestador_id::text, data_escala FROM public.alocacoes_escala WHERE ${condAE} LIMIT 20`);
  for (const r of r2.rows) found.push({ T:'alocacoes_escala', ID:r.id, I:`Status:${r.status} Prest:${(r.prestador_id||'').substring(0,8)} Data:${r.data_escala}` });

  // 3. prestadores
  const condPR = likeAny(['COALESCE(nome_completo,\'\')','COALESCE(cpf_cnpj,\'\')','COALESCE(telefone,\'\')','COALESCE(email,\'\')','COALESCE(regiao_principal,\'\')']);
  const r3 = await client.query(`SELECT id, nome_completo, status, auth_user_id IS NOT NULL AS tem_auth FROM public.prestadores WHERE ${condPR} LIMIT 20`);
  for (const r of r3.rows) found.push({ T:'prestadores', ID:r.id, I:`Nome:${r.nome_completo} Status:${r.status} auth:${r.tem_auth?'SIM':'NAO'}` });

  // 4. clientes
  const condCL = likeAny(['COALESCE(razao_social,\'\')','COALESCE(nome_fantasia,\'\')','COALESCE(cnpj,\'\')','COALESCE(segmento,\'\')']);
  const r4 = await client.query(`SELECT id, razao_social, nome_fantasia, status FROM public.clientes WHERE ${condCL} LIMIT 20`);
  for (const r of r4.rows) found.push({ T:'clientes', ID:r.id, I:`Razao:${r.razao_social} Fantasia:${r.nome_fantasia} Status:${r.status}` });

  // 5. veiculos
  const condVE = likeAny(['COALESCE(placa,\'\')','COALESCE(tipo_veiculo,\'\')','COALESCE(marca,\'\')','COALESCE( modelo,\'\')','COALESCE(renavam,\'\')']);
  const r5 = await client.query(`SELECT id, placa, tipo_veiculo, status, prestador_vinculado::text FROM public.veiculos WHERE ${condVE} LIMIT 20`);
  for (const r of r5.rows) found.push({ T:'veiculos', ID:r.id, I:`Placa:${r.placa} Tipo:${r.tipo_veiculo} Status:${r.status} Prest:${(r.prestador_vinculado||'').substring(0,8)}` });

  // 6. eventos_oficiais
  const condEV = likeAny(['COALESCE(event_type,\'\')','COALESCE(entity_type,\'\')','COALESCE(source,\'\')']);
  const r6 = await client.query(`SELECT id, event_type, entity_type, entity_id::text, source, created_at FROM public.eventos_oficiais WHERE ${condEV} LIMIT 20`);
  for (const r of r6.rows) found.push({ T:'eventos_oficiais', ID:r.id, I:`Event:${r.event_type} Entity:${r.entity_type}:${(r.entity_id||'').substring(0,8)} Source:${r.source}` });

  // 7. operation_timeline_events
  const condTL = likeAny(['COALESCE(type,\'\')','COALESCE(title,\'\')']);
  const r7 = await client.query(`SELECT id, operation_id::text, type, title, event_time FROM public.operation_timeline_events WHERE ${condTL} LIMIT 20`);
  for (const r of r7.rows) found.push({ T:'operation_timeline_events', ID:r.id, I:`Op:${(r.operation_id||'').substring(0,8)} Type:${r.type} Title:${r.title}` });

  // 8-11. Financeiro tables
  const condFR = likeAny(['COALESCE(descricao,\'\')','COALESCE(os_id::text,\'\')','COALESCE(cliente_nome,\'\')','COALESCE(categoria,\'\')']);
  const r8 = await client.query(`SELECT id, os_id::text, valor, status FROM public.financeiro_receber WHERE ${condFR} LIMIT 20`);
  for (const r of r8.rows) found.push({ T:'financeiro_receber', ID:r.id, I:`OS:${(r.os_id||'').substring(0,8)} Valor:${r.valor} Status:${r.status}` });
  const r9 = await client.query(`SELECT id, os_id::text, valor, status FROM public.financeiro_pagar WHERE ${condFR} LIMIT 20`);
  for (const r of r9.rows) found.push({ T:'financeiro_pagar', ID:r.id, I:`OS:${(r.os_id||'').substring(0,8)} Valor:${r.valor} Status:${r.status}` });
  const r10 = await client.query(`SELECT id, os_id::text, prestador_id::text, valor, status FROM public.pagamentos_prestadores WHERE ${condFR} LIMIT 20`);
  for (const r of r10.rows) found.push({ T:'pagamentos_prestadores', ID:r.id, I:`OS:${(r.os_id||'').substring(0,8)} Prest:${(r.prestador_id||'').substring(0,8)} Valor:${r.valor}` });

  if (found.length === 0) {
    console.log('NENHUM REGISTRO HML/TEST/QA/DEMO encontrado nas 11 tabelas.\n');
  } else {
    console.log(`Encontrados ${found.length} candidatos:\n`);
    for (const f of found) {
      console.log(`  [${f.T}] ${f.ID.toString().substring(0,8)}... | ${f.I}`);
    }
    console.log();
  }

  await client.end();
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
