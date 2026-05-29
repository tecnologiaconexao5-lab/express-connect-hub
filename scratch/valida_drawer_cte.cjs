const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validarDrawer() {
  console.log("=== INICIANDO VALIDAÇÃO DO DRAWER CT-E ===");
  
  // 1. Pegar um CT-e real
  const { data: cte, error: cteError } = await supabase
    .from('fiscal_ctes')
    .select(`
      *,
      clientes ( nome_fantasia, razao_social ),
      ordens_servico ( numero ),
      filiais ( nome )
    `)
    .limit(1)
    .single();

  if (cteError || !cte) {
    console.log("Nenhum CT-e encontrado em fiscal_ctes. O Empty State será exibido na grid principal.");
    return;
  }

  console.log("\n1. CT-e SELECIONADO PARA TESTE:");
  console.log(`Nº: ${cte.numero || 'N/A'}`);
  console.log(`Chave: ${cte.chave_acesso || 'N/A'}`);
  console.log(`Status: ${cte.status}`);
  console.log(`Cliente: ${cte.clientes?.nome_fantasia || cte.clientes?.razao_social || 'N/A'}`);

  // 2. Verificar Eventos Fiscais
  console.log("\n2. CONSULTANDO fiscal_events...");
  const { data: events, error: evError } = await supabase
    .from('fiscal_events')
    .select('*')
    .eq('documento_tipo', 'CTE')
    .eq('documento_id', cte.id)
    .order('data_evento', { ascending: false });

  if (evError) console.error("Erro eventos:", evError);
  if (events && events.length > 0) {
    console.log(`Encontrados ${events.length} eventos:`);
    events.forEach(e => console.log(` - [${e.tipo_evento}] ${e.descricao} em ${e.data_evento}`));
  } else {
    console.log("-> 0 eventos encontrados. O Drawer exibirá o Empty State da Timeline (Nenhum evento registrado).");
  }

  // 3. Verificar Logs Fiscais
  console.log("\n3. CONSULTANDO fiscal_logs...");
  const { data: logs, error: logError } = await supabase
    .from('fiscal_logs')
    .select('*')
    .eq('entidade_tipo', 'CTE')
    .eq('entidade_id', cte.id)
    .order('created_at', { ascending: false });

  if (logError) console.error("Erro logs:", logError);
  if (logs && logs.length > 0) {
    console.log(`Encontrados ${logs.length} logs:`);
    logs.forEach(l => console.log(` - [${l.status_code}] ${l.acao}`));
  } else {
    console.log("-> 0 logs encontrados. O Drawer exibirá o Empty State da aba Logs (Nenhum log técnico encontrado).");
  }

  console.log("\n=== VALIDAÇÃO CONCLUÍDA ===");
}

validarDrawer();
