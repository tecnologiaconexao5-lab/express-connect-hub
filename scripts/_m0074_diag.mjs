import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uwrvzsjtpgaifkktpepn.supabase.co',
  process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs'
);

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr || !auth.session) { console.error('Auth failed:', authErr?.message); process.exit(1); }
  console.log('Auth OK, user:', auth.session.user.id);

  const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';

  // 1. Check RLS policies on ordens_servico via pg_policies
  // Use the raw SQL endpoint
  const sqlQuery = `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'ordens_servico' ORDER BY cmd, policyname`;
  
  const response = await fetch('https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/rpc/executar_sql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs',
      'Authorization': 'Bearer ' + auth.session.access_token
    },
    body: JSON.stringify({ sql_text: sqlQuery })
  });

  if (response.ok) {
    const policies = await response.json();
    console.log('\n=== RLS POLICIES ON ordens_servico ===');
    for (const p of policies) {
      console.log(`\n[${p.cmd}] ${p.policyname}`);
      console.log(`  permissive: ${p.permissive}`);
      console.log(`  roles: ${p.roles}`);
      console.log(`  qual: ${p.qual}`);
      if (p.with_check) console.log(`  with_check: ${p.with_check}`);
    }
  } else {
    console.log('RPC error:', response.status, await response.text().then(t => t.substring(0, 300)));
    
    // RPC not available — try direct check
    // Check if the issue is with the trigger or something else
    // Let's try to update using the rest API directly
    const updateResponse = await fetch(`https://uwrvzsjtpgaifkktpepn.supabase.co/rest/v1/ordens_servico?id=eq.${OS_ID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV3cnZ6c2p0cGdhaWZra3RwZXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Njk4NDMsImV4cCI6MjA5MjA0NTg0M30.0G0b-0FUs-5DxOziWD3clXbXXz0Fq2mx9-d0-V08TGs',
        'Authorization': 'Bearer ' + auth.session.access_token,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: 'finalizada', updated_at: new Date().toISOString() })
    });
    
    console.log('\nDirect REST PATCH status:', updateResponse.status);
    if (updateResponse.status === 200 || updateResponse.status === 204) {
      const data = updateResponse.status === 200 ? await updateResponse.json() : 'no content';
      console.log('Response:', JSON.stringify(data));
    } else {
      const errText = await updateResponse.text();
      console.log('Error:', errText.substring(0, 500));
    }
  }

  // 2. Check if there's a trigger blocking — try without trigger column
  console.log('\n=== Trying update bypass ===');
  
  // Try simpler column
  const { data: upd2, error: e2 } = await supabase
    .from('ordens_servico')
    .update({ observacoes: 'test_' + Date.now() })
    .eq('id', OS_ID)
    .select('id, observacoes');
  
  console.log('Update observacoes:', e2 ? 'ERR: ' + e2.message : 'RET: ' + JSON.stringify(upd2));
  
  // Try iserindo via raw SQL approach - use insert test
  const { data: insCheck, error: insErr } = await supabase
    .from('ordens_servico')
    .select('id')
    .eq('numero', 'TEST-IGNORE-DIAG');
  console.log('Check test OS:', insCheck, insErr?.message);
  
  // Check sample data from the OS to see all its fields
  const { data: osFull } = await supabase
    .from('ordens_servico')
    .select('*')
    .eq('id', OS_ID)
    .single();
  
  if (osFull) {
    console.log('\n=== Full OS record ===');
    for (const [k, v] of Object.entries(osFull)) {
      if (v !== null && v !== undefined) {
        const val = typeof v === 'string' ? (v.length > 80 ? v.substring(0, 80) + '...' : v) : JSON.stringify(v);
        console.log(`  ${k}: ${val}`);
      }
    }
  }
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
