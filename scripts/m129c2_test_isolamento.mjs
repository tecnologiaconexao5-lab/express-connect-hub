import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client } = pg;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DB_URL = process.env.DATABASE_URL;

async function main() {
  const failures = [];
  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  // ── Create a second prestador + auth user for isolation test ──
  // We need another auth user to test cross-prestador isolation
  // Let's use the existing "prestador.teste.app@gmail.com" user
  const otherEmail = 'prestador.teste.app@gmail.com';
  const otherPw = 'Isolamento99!';

  // Check if this user has a prestador link
  const otherUser = await pgClient.query(
    "SELECT id, email FROM auth.users WHERE email = $1", [otherEmail]
  );

  if (otherUser.rows.length === 0) {
    console.log('❌ Usuário alternativo não encontrado. Teste de isolamento não realizado.');
    await pgClient.end();
    return;
  }

  const otherAuthId = otherUser.rows[0].id;
  console.log(`Outro auth user: ${otherEmail} (${otherAuthId})`);

  // Check if this user already has a prestador
  const hasPrest = await pgClient.query(
    "SELECT id, nome_completo FROM public.prestadores WHERE auth_user_id = $1",
    [otherAuthId]
  );

  let otherPrestadorId;
  let otherPrestadorNome;

  if (hasPrest.rows.length === 0) {
    // Create a temporary prestador and link it
    console.log('Criando prestador temporário para teste de isolamento...');
    const newPrest = await pgClient.query(`
      INSERT INTO public.prestadores (nome_completo, auth_user_id, tenant_id, status)
      VALUES ('PRESTADOR ISOLAMENTO TESTE', $1, '00000000-0000-0000-0000-000000000001', 'ativo')
      RETURNING id, nome_completo
    `, [otherAuthId]);
    otherPrestadorId = newPrest.rows[0].id;
    otherPrestadorNome = newPrest.rows[0].nome_completo;
  } else {
    otherPrestadorId = hasPrest.rows[0].id;
    otherPrestadorNome = hasPrest.rows[0].nome_completo;
  }

  console.log(`Prestador alternativo: ${otherPrestadorNome} (${otherPrestadorId})`);

  // Set password for other user
  const { genSaltSync, hashSync } = await import('bcryptjs');
  const hash = hashSync(otherPw, genSaltSync(10));
  await pgClient.query(
    "UPDATE auth.users SET encrypted_password = $1 WHERE id = $2",
    [hash, otherAuthId]
  );

  // ── Login as prestador 1 (teste@conexao.com) ──
  const supabase1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: login1 } = await supabase1.auth.signInWithPassword({
    email: 'teste@conexao.com', password: 'Homologar129c2!',
  });
  if (!login1?.user) { console.log('❌ Login prestador 1 falhou'); process.exit(1); }
  console.log(`\n✅ Login P1: ${login1.user.email}`);

  // Create a reembolso as P1
  const osId = 'bf466936-b5b5-4526-b9e4-fa77229eb4dd';
  const { data: ins } = await supabase1
    .from('reembolsos_prestador')
    .insert({
      os_id: osId,
      tipo: 'outros',
      descricao: 'TESTE ISOLAMENTO PRESTADOR',
      valor: 1.0,
      data_despesa: '2026-07-18',
    })
    .select()
    .single();

  if (!ins) { console.log('❌ INSERT P1 falhou'); process.exit(1); }
  const createdId = ins.id;
  console.log(`✅ REEMBOLSO P1 criado: ${createdId}`);

  // ── Login as prestador 2 (prestador.teste.app@gmail.com) ──
  const supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: login2 } = await supabase2.auth.signInWithPassword({
    email: otherEmail, password: otherPw,
  });

  if (login2?.user) {
    console.log(`✅ Login P2: ${login2.user.email}`);

    // Try to read P1's reembolso
    const { data: readP2, error: readP2Err } = await supabase2
      .from('reembolsos_prestador')
      .select('id')
      .eq('id', createdId);

    const isolated = readP2Err !== null || !readP2 || readP2.length === 0;
    if (isolated) {
      const errMsg = readP2Err ? readP2Err.message : 'vazio';
      console.log('   [OK] P2 nao ve registro do P1 (isolamento): ' + errMsg);
    } else {
      console.log('   [FAIL] P2 CONSEGUIU ver registro do P1: ' + readP2.length + ' registro(s)');
      failures.push('Isolamento entre prestadores falhou');
    }

    // Try INSERT as P2 with P1's OS
    const { data: insP2, error: insP2Err } = await supabase2
      .from('reembolsos_prestador')
      .insert({
        os_id: osId,
        tipo: 'outros',
        descricao: 'TENTATIVA P2 USAR OS DO P1',
        valor: 1.0,
        data_despesa: '2026-07-18',
      })
      .select()
      .single();

    if (insP2Err) {
      console.log(`   ✅ P2 rejeitado ao usar OS do P1: ${insP2Err.message}`);
    } else {
      console.log(`   ❌ P2 conseguiu criar reembolso na OS do P1: ${insP2.id}`);
      // Cleanup
      await pgClient.query("DELETE FROM public.reembolsos_prestador WHERE id = $1", [insP2.id]);
      failures.push('P2 conseguiu inserir na OS de outro prestador');
    }
  } else {
    console.log(`❌ Login P2 falhou`);
  }

  // ── Cleanup all test data ──
  await pgClient.query("DELETE FROM public.reembolsos_prestador WHERE id = $1", [createdId]);

  // Remove temporary prestador if we created one
  if (hasPrest.rows.length === 0) {
    await pgClient.query("DELETE FROM public.prestadores WHERE id = $1", [otherPrestadorId]);
    console.log('Prestador temporário removido');
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  if (failures.length === 0) {
    console.log(`  ✅ TESTE DE ISOLAMENTO APROVADO`);
  } else {
    console.log(`  ❌ ${failures.length} falha(s):`);
    failures.forEach((f, i) => console.log(`     ${i+1}. ${f}`));
  }
  console.log(`═══════════════════════════════════════════════════════════`);

  await pgClient.end();
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
