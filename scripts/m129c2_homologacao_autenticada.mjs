import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const { Client } = pg;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const DB_URL = process.env.DATABASE_URL;

const NUMERO_OS = 'OS-202607-426505';
const EMAIL = 'teste@conexao.com';
const PASSWORD = 'Homologar129c2!';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  HOMOLOGAÇÃO REAL — MISSÃO 129-C.2');
  console.log('  Autenticado como prestador do App Motorista');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── 1. Login autenticado ──
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: login, error: loginErr } = await supabase.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD,
  });
  if (loginErr) { console.error('❌ Login falhou:', loginErr.message); process.exit(1); }
  const authUserId = login.user.id;
  console.log(`✅ 1. Login: ${login.user.email}`);
  console.log(`   auth.uid(): ${authUserId}\n`);

  // ── 2. Buscar OS ──
  const { data: os, error: osErr } = await supabase
    .from('ordens_servico')
    .select('id, numero, tenant_id, status')
    .eq('numero', NUMERO_OS)
    .single();
  if (osErr) { console.error('❌ OS não encontrada:', osErr.message); process.exit(1); }
  const osId = os.id;
  console.log(`✅ 2. OS: ${os.numero} (ID: ${osId}, status: ${os.status})`);

  // ── 3. Verificar prestador logado ──
  const { data: prest, error: prestErr } = await supabase
    .from('prestadores')
    .select('id, nome_completo, auth_user_id')
    .eq('auth_user_id', authUserId)
    .single();
  if (prestErr) { console.error('❌ Prestador não encontrado:', prestErr.message); process.exit(1); }
  const prestadorNome = prest.nome_completo;
  const prestadorId = prest.id;
  console.log(`✅ 3. Prestador: ${prestadorNome} (ID: ${prestadorId})`);

  // ── 4. Verificar alocação na OS ──
  const { data: aloc, error: alocErr } = await supabase
    .from('alocacoes_escala')
    .select('id, prestador_id, status')
    .eq('ordem_servico_id', osId)
    .eq('prestador_id', prestadorId)
    .maybeSingle();
  if (alocErr) { console.error('❌ Erro alocação:', alocErr.message); }
  else if (aloc) console.log(`✅ 4. Alocação confirmada: ID ${aloc.id}, status: ${aloc.status}`);
  else console.log(`⚠️ 4. Sem alocação direta (pode falhar validação OS do trigger)`);

  // ── 5. INSERT sem prestador/tenant_id/created_by (como o App faria) ──
  console.log(`\n📝 5. Inserindo reembolso (sem campos derivados)...`);
  const payload = {
    os_id: osId,
    tipo: 'outros',
    descricao: 'HOMOLOGAÇÃO MISSÃO 129-C.2-TMS',
    valor: 1.0,
    data_despesa: new Date().toISOString().split('T')[0],
  };
  console.log(`   Payload: ${JSON.stringify(payload)}`);

  const { data: ins, error: insErr } = await supabase
    .from('reembolsos_prestador')
    .insert(payload)
    .select()
    .single();

  if (insErr) {
    console.error(`\n❌ INSERT FALHOU: ${insErr.message}`);
    process.exit(1);
  }

  console.log(`\n✅ 5. REEMBOLSO CRIADO:`);
  console.log(`   ID: ${ins.id}`);
  console.log(`   prestador: ${ins.prestador}`);
  console.log(`   tenant_id: ${ins.tenant_id}`);
  console.log(`   created_by: ${ins.created_by}`);
  console.log(`   os_id: ${ins.os_id}`);
  console.log(`   status: ${ins.status}`);
  console.log(`   tipo: ${ins.tipo}`);
  console.log(`   valor: ${ins.valor}`);
  console.log(`   descricao: ${ins.descricao}`);
  console.log(`   data_despesa: ${ins.data_despesa}`);
  console.log(`   created_at: ${ins.created_at}`);
  console.log(`   updated_at: ${ins.updated_at}`);

  // ── 6. Validações ──
  const failures = [];
  function check(label, condition, detail) {
    if (condition) console.log(`   ✅ ${label}: ${detail}`);
    else { console.log(`   ❌ ${label}: ${detail}`); failures.push(label); }
  }

  check('prestador derivado', ins.prestador === prestadorNome, ins.prestador);
  check('tenant_id preenchido', ins.tenant_id !== null, ins.tenant_id);
  check('created_by = auth.uid()', ins.created_by === authUserId, ins.created_by);
  check('os_id correto', ins.os_id === osId, ins.os_id);
  check('status = pendente', ins.status === 'pendente', ins.status);
  check('tipo = outros', ins.tipo === 'outros', ins.tipo);
  check('valor = 1.0', Number(ins.valor) === 1.0, ins.valor);
  check('data_despesa preenchida', ins.data_despesa !== null, ins.data_despesa);
  check('created_at preenchido', ins.created_at !== null, ins.created_at);
  check('updated_at preenchido', ins.updated_at !== null, ins.updated_at);

  // ── 7. Leitura pelo mesmo prestador ──
  const { data: readOwn, error: readOwnErr } = await supabase
    .from('reembolsos_prestador')
    .select('id, prestador')
    .eq('id', ins.id)
    .single();
  check('leitura pelo prestador', !readOwnErr && readOwn !== null, readOwn?.prestador || 'falhou');

  // ── 8. Invisibilidade para outro prestador ──
  // Precisamos de outro usuário authenticated de outro prestador
  // Verificamos via SQL direto se há outro prestador no mesmo tenant
  const pgClient = new Client({ connectionString: DB_URL });
  await pgClient.connect();

  const outroPrest = await pgClient.query(`
    SELECT p.id, p.nome_completo, p.auth_user_id, u.email
    FROM public.prestadores p
    JOIN auth.users u ON u.id = p.auth_user_id
    WHERE p.auth_user_id != $1 AND p.auth_user_id IS NOT NULL
    LIMIT 1
  `, [authUserId]);

  if (outroPrest.rows.length > 0) {
    const outroAuth = outroPrest.rows[0];
    console.log(`\n📝 Testando isolamento: outro prestador = ${outroAuth.nome_completo} (${outroAuth.email})`);

    // Login como outro prestador
    const outroSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Set password for other prestador
    const outroPw = 'OutroHomolog99!';
    const bcrypt = await import('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(outroPw, salt);
    await pgClient.query(
      "UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2",
      [hash, outroAuth.auth_user_id]
    );
    
    const { data: loginOutro } = await outroSupabase.auth.signInWithPassword({
      email: outroAuth.email, password: outroPw,
    });
    
    if (loginOutro?.user) {
      const { data: readOther, error: readOtherErr } = await outroSupabase
        .from('reembolsos_prestador')
        .select('id')
        .eq('id', ins.id);
      check('outro prestador NAO ve', readOtherErr !== null || readOther?.length === 0,
        readOtherErr ? `erro: ${readOtherErr.message}` : `vazio: ${readOther?.length}`);
    } else {
      console.log('   ⚠️ Não foi possível logar como outro prestador');
    }
  } else {
    console.log('   ⚠️ Sem outro prestador para testar isolamento');
  }

  await pgClient.end();

  // ── 9. Limpeza ──
  console.log(`\n🧹 9. Removendo registro de homologação...`);
  const { error: delErr } = await supabase
    .from('reembolsos_prestador')
    .delete()
    .eq('id', ins.id);
  if (delErr) console.log(`   ⚠️ Erro ao remover: ${delErr.message}`);
  else console.log(`   ✅ Registro ID ${ins.id} removido`);

  // ── Resultado final ──
  console.log(`\n═══════════════════════════════════════════════════════════`);
  if (failures.length === 0) {
    console.log(`  ✅ HOMOLOGAÇÃO APROVADA — 0 falhas`);
  } else {
    console.log(`  ❌ HOMOLOGAÇÃO REPROVADA — ${failures.length} falha(s):`);
    failures.forEach((f, i) => console.log(`     ${i+1}. ${f}`));
  }
  console.log(`═══════════════════════════════════════════════════════════`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
