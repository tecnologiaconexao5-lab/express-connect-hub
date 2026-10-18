await (async () => {
  // Must be top-level to ensure env vars are set before module evaluation
  const mod = await import('../src/lib/supabase');
  const { supabase } = mod;

  // Authenticate
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'tamiris.castilho@conexaoexpress.com.br',
    password: process.env.PLAYWRIGHT_TAMIRIS_PASSWORD || 'Conexao@2026'
  });
  if (authErr || !auth?.session) {
    console.log('FALHA_AUTH:', authErr?.message);
    process.exit(1);
  }
  console.log('Autenticado como:', auth.user.email);
  console.log('Session access token set:', !!auth.session.access_token);

  // Now import and call the service using the authenticated supabase
  const { finalizarOrdemServico } = await import('../src/services/ordemServicoService');

  const OS_ID = '71e61468-af09-42e6-8d7e-e4624d9b1468';
  console.log('\n=== EXECUTANDO finalizarOrdemServico() OFICIAL ===');
  console.log('OS:', OS_ID);
  console.log();

  const resultado = await finalizarOrdemServico(OS_ID);
  console.log('RESULTADO:', JSON.stringify(resultado, null, 2));

  if (!resultado.success) {
    console.error('FALHA NA EXECUCAO:', resultado.erro);
    process.exit(1);
  }
  console.log('SUCESSO! OS finalizada.');
})();
