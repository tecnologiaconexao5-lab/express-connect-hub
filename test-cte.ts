import { supabase } from './src/lib/supabase';
import { gerarRascunhoCte } from './src/services/fiscal/cteService';

async function run() {
  console.log("Iniciando teste de geração de CT-e Rascunho...");
  
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@teste.com',
    password: 'password123'
  });
  if (authErr) {
    console.error("Erro ao logar:", authErr.message);
  } else {
    console.log("Usuário de teste autenticado.");
  }
  
  // 1. Pegar uma OS real
  const { data: osList, error: osError } = await supabase
    .from('ordens_servico')
    .select('id, numero')
    .order('created_at', { ascending: false })
    .limit(1);

  if (osError || !osList || osList.length === 0) {
    console.error("Erro ao buscar OS:", osError);
    return;
  }

  const os = osList[0];
  console.log(`OS selecionada: ${os.numero} (ID: ${os.id})`);

  // 2. Gerar Rascunho
  console.log("Gerando rascunho...");
  const result = await gerarRascunhoCte(os.id);
  
  if (!result.success) {
    console.error("Falha ao gerar rascunho:", result.error);
    return;
  }

  const cteId = result.cte?.id;
  console.log(`CT-e criado com sucesso! ID: ${cteId}`);

  // 3. Buscar Evento
  const { data: events } = await supabase
    .from('fiscal_events')
    .select('id')
    .eq('documento_id', cteId)
    .limit(1);

  // 4. Buscar Log
  const { data: logs } = await supabase
    .from('fiscal_logs')
    .select('id')
    .eq('entidade_id', cteId)
    .limit(1);

  console.log("Validação de Registros:");
  console.log(`- fiscal_ctes ID:   ${cteId}`);
  console.log(`- fiscal_events ID: ${events && events.length > 0 ? events[0].id : 'NENHUM EVENTO'}`);
  console.log(`- fiscal_logs ID:   ${logs && logs.length > 0 ? logs[0].id : 'NENHUM LOG'}`);
  
  console.log("\nTeste concluído com sucesso.");
}

run();
