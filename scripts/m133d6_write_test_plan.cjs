// MISSÃO 133-D.6 — PLANO DE TESTE DE ESCRITA (NAO EXECUTAR)
// ========================================================
// ATENCAO: Este script contem o PLANO e a PREPARACAO.
// NAO EXECUTAR sem autorizacao especifica.
// ========================================================

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
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('ERRO: DATABASE_URL'); process.exit(1); }

async function main() {
  console.log('==============================================================');
  console.log('MISSAO 133-D.6 — PLANO DE TESTE DE ESCRITA');
  console.log('STATUS: PREPARADO — NAO EXECUTADO');
  console.log('==============================================================\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 15000,
  });
  await client.connect();

  // 1. Prestadores com auth_user_id
  const prestRes = await client.query(`
    SELECT COUNT(*) AS total
    FROM public.prestadores
    WHERE auth_user_id IS NOT NULL;
  `);
  const totalPrestadores = parseInt(prestRes.rows[0].total);
  console.log('Prestadores com auth_user_id: ' + totalPrestadores);

  // 2. Alocacoes pendentes
  const alocRes = await client.query(`
    SELECT COUNT(*) AS pendentes
    FROM public.alocacoes_escala
    WHERE status = 'pendente'
      AND prestador_id IS NOT NULL;
  `);
  const alocPendentes = parseInt(alocRes.rows[0].pendentes);
  console.log('Alocacoes pendentes: ' + alocPendentes);

  // 3. Alocacoes em andamento
  const alocAndRes = await client.query(`
    SELECT COUNT(*) AS andamento
    FROM public.alocacoes_escala
    WHERE status NOT IN ('cancelada', 'recusada', 'concluida', 'pendente')
      AND prestador_id IS NOT NULL;
  `);
  const alocAndamento = parseInt(alocAndRes.rows[0].andamento);
  console.log('Alocacoes em andamento: ' + alocAndamento);

  console.log('\n--- DADOS PARA AUTORIZACAO ---\n');

  // 4. Prestadores disponiveis
  const colsRes = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'prestadores'
    ORDER BY ordinal_position;
  `);
  const colNames = colsRes.rows.map(r => r.column_name);
  const nomeCol = colNames.includes('razao_social') ? 'razao_social'
    : colNames.includes('nome_fantasia') ? 'nome_fantasia'
    : colNames.includes('nome_completo') ? 'nome_completo'
    : colNames.includes('nome') ? 'nome' : colNames[1] || 'id';

  const prestDet = await client.query(`
    SELECT id, ` + nomeCol + ` AS nome, auth_user_id IS NOT NULL AS tem_auth
    FROM public.prestadores
    ORDER BY ` + nomeCol + `
    LIMIT 5;
  `);
  console.log('Prestadores disponiveis:');
  for (const p of prestDet.rows) {
    console.log('  - ID: ' + p.id.toString().substring(0, 8) + '... | Nome: ' + String(p.nome || '(sem nome)') + ' | Auth: ' + (p.tem_auth ? 'SIM' : 'NAO'));
  }

  console.log('\n--- PLANO DE TESTE ---');
  console.log('');
  console.log('A. f_avancar_etapa_app_motorista');
  console.log('   Fluxo: pendente -> viagem_aceita -> cheguei_coleta -> ... -> servico_finalizado');
  console.log('   Dados: Alocacao pendente, Prestador com auth_user_id');
  console.log('   Eventos esperados:');
  console.log('     - UPDATE alocacoes_escala (status, metadata, timestamps)');
  console.log('     - INSERT eventos_oficiais');
  console.log('     - INSERT operation_timeline_events');
  console.log('     - Triggers: trg_evento_*, trg_registrar_historico_alocacao');
  console.log('   Rollback: Restaurar alocacao ao estado original');
  console.log('   Cleanup: Remover eventos e timeline');
  console.log('');
  console.log('B. f_atualizar_reversa_app');
  console.log('   Fluxo: reversa sem divergencia');
  console.log('   Dados: Alocacao com reversa_qtd_volumes > 0');
  console.log('   Eventos esperados:');
  console.log('     - UPDATE alocacoes_escala (reversa_* campos)');
  console.log('     - INSERT eventos_oficiais');
  console.log('     - UPDATE financeiro_receber (valor + reversa)');
  console.log('     - UPDATE financeiro_pagar (valor + reversa)');
  console.log('   Rollback: Restaurar alocacao e financeiro');
  console.log('   Cleanup: Remover eventos');
  console.log('');
  console.log('C. Limitacoes atuais:');
  console.log('   - Prestadores com auth_user_id: ' + totalPrestadores);
  console.log('   - Alocacoes pendentes: ' + alocPendentes);
  console.log('   - Sem App Motorista real (Flutter externo)');
  console.log('   - auth.uid() retorna NULL em pg direto');
  console.log('');
  console.log('D. Pre-requisitos:');
  console.log('   1. Prestador com auth_user_id REAL (Supabase Auth)');
  console.log('   2. Alocacao vinculada ao prestador');
  console.log('   3. Chamada via REST API com JWT do prestador');
  console.log('   4. OU: service_role com SET LOCAL request.jwt.claims');
  console.log('');
  console.log('==============================================================');
  console.log('AUTORIZACAO PENDENTE — NAO EXECUTAR');
  console.log('==============================================================');

  await client.end();
  process.exit(0);
}

main().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
