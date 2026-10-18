const { Client } = require('pg');
const connStr = 'postgresql://postgres.uwrvzsjtpgaifkktpepn:ConexaoExpress_DB_2026%21%23@aws-1-sa-east-1.pooler.supabase.com:5432/postgres';

async function run(client, label, sql) {
  try { await client.query(sql); console.log(`✅ ${label}`); }
  catch(e) { console.log(`❌ ${label}: ${e.message.substring(0, 100)}`); }
}

async function main() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('=== M113 — Fix functions and proceed ===\n');

  // Fix function - change auth_uid to auth_user_id
  await run(client, 'Fix f_obter_cliente_id_do_usuario', `
CREATE OR REPLACE FUNCTION public.f_obter_cliente_id_do_usuario()
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente_id UUID;
BEGIN
  SELECT cliente_id INTO v_cliente_id FROM public.usuarios_cliente
  WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_cliente_id IS NOT NULL THEN RETURN v_cliente_id; END IF;
  SELECT c.id INTO v_cliente_id FROM public.clientes c
  JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
  WHERE tu.auth_user_id = auth.uid() LIMIT 1;
  RETURN v_cliente_id;
END;
$$;`);

  // Fix f_usuario_pode_acessar_cliente 
  await run(client, 'Fix f_usuario_pode_acessar_cliente', `
CREATE OR REPLACE FUNCTION public.f_usuario_pode_acessar_cliente(p_cliente_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()
    AND raw_user_meta_data->>'papel' IN ('super_admin', 'admin')) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios_cliente
    WHERE auth_user_id = auth.uid() AND cliente_id = p_cliente_id) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.clientes c
    JOIN public.tenant_usuarios tu ON tu.tenant_id = c.tenant_id
    WHERE c.id = p_cliente_id AND tu.auth_user_id = auth.uid()) THEN RETURN true; END IF;
  RETURN false;
END;
$$;`);

  // Verify functions
  const fnCheck = await client.query(`
    SELECT proname, prosrc FROM pg_proc WHERE proname IN ('f_obter_cliente_id_do_usuario','f_usuario_pode_acessar_cliente')
  `);
  for (const fn of fnCheck.rows) {
    const hasAuthUid = fn.prosrc.includes('auth_uid');
    const hasAuthUserId = fn.prosrc.includes('auth_user_id');
    console.log(`  ${fn.proname}: auth_uid=${hasAuthUid}, auth_user_id=${hasAuthUserId}`);
  }

  // Verify RLS policies
  const policies = await client.query(`
    SELECT tablename, policyname FROM pg_policies
    WHERE policyname LIKE '%_own' OR policyname LIKE '%_portal' OR policyname LIKE '%_tms'
    ORDER BY tablename
  `);
  console.log(`\nNew RLS policies created: ${policies.rows.length}`);
  for (const p of policies.rows) {
    console.log(`  ${p.tablename}: ${p.policyname}`);
  }

  await client.end();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
