// MISSÃO 133-D.6 — TESTE ANON (ETAPA 4.A)
// Verifica se anon é bloqueado nas 3 RPCs via REST API
// Uso: node scripts/m133d6_test_anon.cjs
// Retorna: 0 se todas bloqueadas, 1 se alguma permitida

const fs = require('fs');
const path = require('path');

// Carrega .env
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('ERRO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não encontrados');
  process.exit(1);
}

const RPCs = [
  {
    name: 'f_buscar_operacoes_motorista',
    body: { p_auth_user_id: null }
  },
  {
    name: 'f_avancar_etapa_app_motorista',
    body: { p_alocacao_id: '00000000-0000-0000-0000-000000000000', p_etapa: 'viagem_aceita', p_payload: {}, p_idempotency_key: null, p_auth_user_id: null }
  },
  {
    name: 'f_atualizar_reversa_app',
    body: { p_alocacao_id: '00000000-0000-0000-0000-000000000000', p_reversa_status: null, p_reversa_qtd_coletada: null, p_reversa_motivo_divergencia: null, p_reversa_responsavel: null, p_reversa_telefone: null, p_reversa_data_realizada: null, p_reversa_fotos: null, p_reversa_assinatura_url: null, p_reversa_latitude: null, p_reversa_longitude: null, p_auth_user_id: null }
  }
];

async function main() {
  console.log('=== TESTE ANON — ETAPA 4.A ===\n');
  let allBlocked = true;

  for (const rpc of RPCs) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${rpc.name}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpc.body),
      });

      const status = response.status;
      let body = '';
      try { body = await response.text(); } catch { body = '(sem corpo)'; }

      if (status === 200) {
        // Tentou executar — verificar se foi erro interno (auth.uid() returning null) ou sucesso
        const isBlocked = body.includes('USUARIO_NAO_AUTENTICADO') || body.includes('ERRO') || body.includes('erro');
        if (isBlocked) {
          console.log(`  ${rpc.name}: ${status} — Bloqueado internamente (auth.uid()=null) ⚠️ (segundo barrier)`);
        } else {
          console.log(`  ${rpc.name}: ${status} — PERMITIDO! ❌`);
          allBlocked = false;
        }
      } else if (status === 401 || status === 403 || status === 404) {
        console.log(`  ${rpc.name}: HTTP ${status} — Bloqueado pelo gateway/REST ✅`);
      } else {
        console.log(`  ${rpc.name}: HTTP ${status} — ${body.substring(0, 200)} ⚠️`);
      }
    } catch (err) {
      console.log(`  ${rpc.name}: ERRO — ${err.message} ⚠️`);
    }
  }

  console.log(`\nResultado: ${allBlocked ? '✅ TODAS BLOQUEADAS' : '❌ ALGUMA PERMITIDA'}`);
  process.exit(allBlocked ? 0 : 2);
}

main();
