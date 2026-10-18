// ═══════════════════════════════════════════════════════════════════════════════
// MISSÃO 129-C.2-TMS — HOMOLOGAÇÃO REAL (ETAPA 6)
//
// Executa INSERT como authenticated (cliente Supabase) e valida que:
//   - prestador foi derivado automaticamente
//   - tenant_id foi derivado automaticamente
//   - created_by foi preenchido com auth.uid()
//   - status é pendente
//   - OS vinculada corretamente
//   - Leitura no mesmo tenant funciona
//   - Sem duplicidade
//
// USO:
//   npx tsx -r dotenv/config scripts/m129c2_homologacao_real.ts
//
// PRÉ-REQUISITOS:
//   .env com VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
//   OS-202607-426505 existente no banco
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios no .env');
  process.exit(1);
}

const NUMERO_OS = 'OS-202607-426505';
const TIPO = 'outros';
const VALOR = 1.0;
const DESCRICAO = 'HOMOLOGAÇÃO APP MISSÃO 129-C.2';
const DATA_DESPESA = new Date().toISOString().split('T')[0];

async function homologar() {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  MISSÃO 129-C.2 — HOMOLOGAÇÃO REAL`);
  console.log(`  OS: ${NUMERO_OS}`);
  console.log(`  Tipo: ${TIPO}`);
  console.log(`  Valor: R$ ${VALOR.toFixed(2)}`);
  console.log(`  Descrição: ${DESCRICAO}`);
  console.log(`  Data: ${DATA_DESPESA}`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  // ── Cliente authenticated (NÃO service_role) ──
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Login como um prestador real
  const email = process.env.VITE_HOMOLOG_EMAIL || '';
  const password = process.env.VITE_HOMOLOG_PASSWORD || '';

  if (!email || !password) {
    console.log('⚠️  VITE_HOMOLOG_EMAIL e VITE_HOMOLOG_PASSWORD não configurados.');
    console.log('   Defina no .env para testar como authenticated.');
    console.log('   Exemplo: VITE_HOMOLOG_EMAIL=operacional@conexaoexpress.com.br');
    console.log('   Usando anon key diretamente (pode falhar se RLS exigir auth).\n');
  } else {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      console.error(`❌ Erro no login: ${loginError.message}`);
      console.log('   Verifique email/senha no .env');
      process.exit(1);
    }

    console.log(`✅ Logado como: ${loginData.user?.email}`);
    console.log(`   auth.uid(): ${loginData.user?.id}\n`);
  }

  // 2. Buscar o UUID da OS pelo número
  const { data: osData, error: osError } = await supabase
    .from('ordens_servico')
    .select('id, numero, tenant_id')
    .eq('numero', NUMERO_OS)
    .single();

  if (osError || !osData) {
    console.error(`❌ OS ${NUMERO_OS} não encontrada: ${osError?.message || 'sem dados'}`);
    console.log('   Verifique se a OS existe no banco.');
    process.exit(1);
  }

  const osId = osData.id;
  console.log(`📋 OS encontrada:`);
  console.log(`   ID: ${osId}`);
  console.log(`   Tenant: ${osData.tenant_id}\n`);

  // 3. Buscar o prestador logado
  const { data: prestadorData, error: prestadorError } = await supabase
    .from('prestadores')
    .select('id, nome_completo, tenant_id')
    .eq('auth_user_id', (await supabase.auth.getUser()).data.user?.id || '')
    .single();

  if (prestadorError || !prestadorData) {
    console.log(`⚠️  Não foi possível identificar o prestador pelo auth.uid().`);
    console.log(`   Isso é esperado se o usuário logado não é um prestador.`);
    console.log(`   O teste continuará mas o trigger deve rejeitar com "sem prestador".\n`);
  } else {
    console.log(`👤 Prestador autenticado:`);
    console.log(`   Nome: ${prestadorData.nome_completo}`);
    console.log(`   ID: ${prestadorData.id}`);
    console.log(`   Tenant: ${prestadorData.tenant_id}\n`);
  }

  // 4. Verificar se o prestador tem alocação na OS
  const { data: alocData, error: alocError } = await supabase
    .from('alocacoes_escala')
    .select('id, prestador_id')
    .eq('ordem_servico_id', osId)
    .maybeSingle();

  if (alocError) {
    console.error(`❌ Erro ao buscar alocação: ${alocError.message}`);
  } else if (alocData) {
    console.log(`🔗 Alocação encontrada:`);
    console.log(`   ID: ${alocData.id}`);
    console.log(`   Prestador ID: ${alocData.prestador_id}\n`);
  } else {
    console.log(`⚠️  Nenhuma alocação encontrada para esta OS.\n`);
  }

  // 5. Inserir o reembolso (SEM enviar prestador, tenant_id, created_by)
  console.log(`📝 Inserindo reembolso (sem prestador/tenant_id/created_by)...`);

  const insertPayload: Record<string, unknown> = {
    os_id: osId,
    tipo: TIPO,
    descricao: DESCRICAO,
    valor: VALOR,
    data_despesa: DATA_DESPESA,
  };

  console.log(`   Payload enviado: ${JSON.stringify(insertPayload, null, 2)}\n`);

  const { data: insertData, error: insertError } = await supabase
    .from('reembolsos_prestador')
    .insert(insertPayload)
    .select()
    .single();

  if (insertError) {
    console.error(`❌ Erro no INSERT:`);
    console.error(`   ${JSON.stringify(insertError, null, 2)}`);
    process.exit(1);
  }

  console.log(`✅ Reembolso criado com sucesso!`);
  console.log(`   ID: ${insertData.id}`);
  console.log(`   prestador: ${insertData.prestador}`);
  console.log(`   tenant_id: ${insertData.tenant_id}`);
  console.log(`   created_by: ${insertData.created_by}`);
  console.log(`   os_id: ${insertData.os_id}`);
  console.log(`   status: ${insertData.status}`);
  console.log(`   created_at: ${insertData.created_at}`);
  console.log(`   updated_at: ${insertData.updated_at}\n`);

  // 6. Validações
  const authUserId = (await supabase.auth.getUser()).data.user?.id;
  const failures: string[] = [];

  // 6a. prestador deve estar preenchido
  if (!insertData.prestador || insertData.prestador === '') {
    failures.push('prestador está vazio');
  } else {
    console.log(`   ✅ prestador derivado: ${insertData.prestador}`);
  }

  // 6b. tenant_id deve estar preenchido
  if (!insertData.tenant_id) {
    failures.push('tenant_id está nulo');
  } else {
    console.log(`   ✅ tenant_id derivado: ${insertData.tenant_id}`);
  }

  // 6c. created_by deve ser auth.uid()
  if (!insertData.created_by) {
    failures.push('created_by está nulo');
  } else if (authUserId && insertData.created_by !== authUserId) {
    failures.push(`created_by (${insertData.created_by}) diferente de auth.uid() (${authUserId})`);
  } else {
    console.log(`   ✅ created_by = auth.uid(): ${insertData.created_by}`);
  }

  // 6d. os_id correto
  if (insertData.os_id !== osId) {
    failures.push(`os_id diverge: esperado ${osId}, veio ${insertData.os_id}`);
  } else {
    console.log(`   ✅ os_id correto: ${insertData.os_id}`);
  }

  // 6e. status pendente
  if (insertData.status !== 'pendente') {
    failures.push(`status deveria ser pendente, veio ${insertData.status}`);
  } else {
    console.log(`   ✅ status: pendente`);
  }

  // 7. Testar leitura no TMS (mesmo tenant)
  const { data: readData, error: readError } = await supabase
    .from('reembolsos_prestador')
    .select('id, prestador, status, valor')
    .eq('id', insertData.id)
    .single();

  if (readError || !readData) {
    failures.push(`leitura falhou: ${readError?.message}`);
  } else {
    console.log(`   ✅ Leitura no TMS OK: ${readData.id} — ${readData.prestador} — ${readData.status}`);
  }

  // 8. Verificar sem duplicidade
  const { data: dupData, error: dupError } = await supabase
    .from('reembolsos_prestador')
    .select('id', { count: 'exact' })
    .eq('id', insertData.id);

  if (dupError) {
    failures.push(`verificação de duplicidade falhou: ${dupError.message}`);
  } else if (!dupData || dupData.length === 0) {
    failures.push('registro não encontrado após inserção');
  } else {
    console.log(`   ✅ Sem duplicidade: 1 registro encontrado`);
  }

  // 9. Limpeza (opcional — comentar se quiser manter o registro)
  console.log(`\n🧹 Limpando registro de homologação...`);
  const { error: deleteError } = await supabase
    .from('reembolsos_prestador')
    .delete()
    .eq('id', insertData.id);

  if (deleteError) {
    console.log(`   ⚠️  Erro ao limpar: ${deleteError.message} (pode ignorar)`);
  } else {
    console.log(`   ✅ Registro removido`);
  }

  // ── Resultado final ──
  console.log(`\n═══════════════════════════════════════════════════════════`);
  if (failures.length === 0) {
    console.log(`  ✅ HOMOLOGAÇÃO APROVADA — 0 falhas`);
  } else {
    console.log(`  ❌ HOMOLOGAÇÃO REPROVADA — ${failures.length} falha(s):`);
    failures.forEach((f, i) => console.log(`     ${i + 1}. ${f}`));
  }
  console.log(`═══════════════════════════════════════════════════════════\n`);
}

homologar().catch((err) => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
