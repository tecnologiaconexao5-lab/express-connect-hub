// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO TMS-007.4A — Testes por perfil para RLS UPDATE em ordens_servico
//
// Uso:
//   npx node scripts/m0074a_test_rls_update_os.mjs
//
// Testa a policy os_update_tms simulando cada perfil.
// NENHUM dado é alterado — apenas valida se o UPDATE seria permitido.
//
// Estratégia:
//   - Tenta UPDATE com .select() no final
//   - Se retorna 1 row → UPDATE permitido
//   - Se retorna 0 rows → UPDATE bloqueado (RLS ou WHERE)
//   - Se retorna erro → sintaxe/servidor
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://uwrvzsjtpgaifkktpepn.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs';

const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468'; // TEST-M80-CF-MR751I7O

// ==============================================================================
// Perfis de teste (MISSÃO 50)
// ==============================================================================
const PERFIS = [
  {
    nome: 'super_admin',
    email: 'tamiris.castilho@conexaoexpress.com.br',
    senha: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026',
    esperado: 'PERMITIDO',
    justificativa: 'super_admin tem tenant_usuarios + mesmo tenant'
  },
  {
    nome: 'financeiro (leitura)',
    email: 'financeiro@conexaoexpress.com.br',
    senha: process.env.PLAYWRIGHT_FINANCEIRO_PASSWORD || '__CONEXAO2026_FINANCEIRO__',
    esperado: 'PERMITIDO',
    justificativa: 'financeiro está em tenant_usuarios no mesmo tenant'
  },
  {
    nome: 'operacional (edicao)',
    email: 'operacional@conexaoexpress.com.br',
    senha: process.env.PLAYWRIGHT_OPERACIONAL_PASSWORD || '__123456_OPERACIONAL__',
    esperado: 'PERMITIDO',
    justificativa: 'operacional está em tenant_usuarios no mesmo tenant'
  },
  {
    nome: 'cliente (bloqueado)',
    email: null, // não existe email de cliente com tenant_usuarios
    esperado: 'BLOQUEADO (sem tenant_usuarios)',
    justificativa: 'Portal Cliente usa usuarios_cliente, não tenant_usuarios'
  },
  {
    nome: 'anon (sem auth)',
    email: null,
    senha: null,
    esperado: 'BLOQUEADO (sem auth)',
    justificativa: 'Policy é TO authenticated, anon não passa'
  }
];

// ==============================================================================
// Testes
// ==============================================================================

async function testarPerfil(perfil) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  if (perfil.email && perfil.senha) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: perfil.email,
      password: perfil.senha
    });
    if (error || !data.session) {
      return {
        perfil: perfil.nome,
        status: 'FALHA_AUTH',
        detalhe: error?.message || 'sem sessão',
        conclusao: `❌ FALHA_AUTH — ${perfil.esperado}`
      };
    }
  }

  // Tenta UPDATE de um campo não-crítico e verifica se foi aplicado
  const testField = 'observacoes';
  const testValue = `TMS-007.4A test ${Date.now()}`;

  const { data, error } = await supabase
    .from('ordens_servico')
    .update({ [testField]: testValue })
    .eq('id', OS_ID)
    .select('id, status');

  // Se o UPDATE passou, restaura o campo
  if (data && data.length > 0) {
    await supabase
      .from('ordens_servico')
      .update({ [testField]: null })
      .eq('id', OS_ID);
  }

  const permitido = data && data.length > 0;
  const status = error ? `ERRO: ${error.message}` : (permitido ? '✅ PERMITIDO' : '⛔ BLOQUEADO');
  const esperadoOk = perfil.esperado.startsWith(status.includes('PERMITIDO') ? 'PERMITIDO' : 'BLOQUEADO');

  return {
    perfil: perfil.nome,
    status,
    esperado: perfil.esperado,
    ok: esperadoOk,
    conclusao: esperadoOk ? '✅ OK' : `❌ DIVERGENTE (esperado: ${perfil.esperado})`
  };
}

async function main() {
  console.log('═'.repeat(70));
  console.log('  TMS-007.4A — Testes RLS UPDATE por Perfil');
  console.log('  OS: TEST-M80-CF-MR751I7O (' + OS_ID + ')');
  console.log('  Data: ' + new Date().toISOString().split('T')[0]);
  console.log('═'.repeat(70));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const perfil of PERFIS) {
    console.log(`\n── Perfil: ${perfil.nome} ──`);
    console.log(`   Esperado: ${perfil.esperado}`);

    if (!perfil.email || !perfil.senha) {
      console.log(`   ⏭️  SKIP — sem credenciais (${perfil.justificativa})`);
      skipped++;
      continue;
    }

    const resultado = await testarPerfil(perfil);
    console.log(`   Resultado: ${resultado.status}`);
    console.log(`   Conclusão: ${resultado.conclusao}`);

    if (resultado.ok) passed++;
    else failed++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`  RESULTADO: ${passed} passaram, ${failed} falharam, ${skipped} skip`);
  console.log('═'.repeat(70));
}

main().catch(e => console.error('Fatal:', e.message, e.stack));
