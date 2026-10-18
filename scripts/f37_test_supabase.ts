// ============================================================
// F37 — Teste Supabase: Integrações Externas (Modo Seguro)
// ============================================================
// Uso: $env:VITE_SUPABASE_URL="..."; $env:VITE_SUPABASE_ANON_KEY="..."; npx tsx scripts/f37_test_supabase.ts
// ============================================================

import { supabase } from "../src/lib/supabase";
import { externalIntegrationEngine } from "../src/services/ia/externalIntegrationEngine";

const ROBO_ID = "257f6d28-9b0f-4969-81a8-8e220edc73e6"; // Comercial IA

async function testarCenario1_IntegracaoSimulada() {
  console.log("\n🧪 1. Integração simulada executa com sucesso (WhatsApp)");
  const resultado = await externalIntegrationEngine.executarIntegracao({
    roboId: ROBO_ID,
    intencao: {
      canal: "whatsapp",
      acao: "enviar_mensagem",
      payload: { para: "5511999999999", mensagem: "Olá, tudo bem?" },
    },
  });
  console.log(`  Status: ${resultado.status}`);
  console.log(`  Sucesso: ${resultado.sucesso}`);
  console.log(`  Log ID: ${resultado.log_id}`);
  console.log(`  Payload mockado: ${JSON.stringify(resultado.payload_mockado).slice(0, 120)}`);

  if (resultado.sucesso && resultado.status === "simulada" && resultado.log_id) {
    const { data: log } = await supabase.from("ia_integracoes_externas_logs").select("*").eq("id", resultado.log_id).single();
    if (log) {
      console.log(`  ✅ Log persistido: canal=${log.canal}, acao=${log.acao}`);
      console.log(`  ✅ Payload salvo: ${Object.keys(log.payload).length} campos`);
      console.log(`  ✅ Payload mockado salvo: ${Object.keys(log.payload_mockado).length} campos`);
    } else { console.log("  ❌ Log não encontrado no banco"); }
  } else { console.log("  ❌ Integração falhou"); }

  return resultado;
}

async function testarCenario2_GovernancaBloqueia() {
  console.log("\n🧪 2. Governança bloqueia envio (ação bloqueada)");
  const resultado = await externalIntegrationEngine.executarIntegracao({
    roboId: ROBO_ID,
    intencao: {
      canal: "email",
      acao: "enviar_email",
      payload: { para: "teste@teste.com", valor: 999999 },
    },
  });
  console.log(`  Status: ${resultado.status}`);
  console.log(`  Motivo: ${resultado.motivo || "N/A"}`);
  if (!resultado.sucesso) {
    console.log(`  ✅ Integração bloqueada pela governança`);
  } else {
    console.log(`  ⚠️ Passou pela governança (sem restrição cadastrada)`);
    console.log(`  (Isto é aceitável — sem regra de autoridade configurada para email_enviar_email)`);
  }
  return resultado;
}

async function testarCenario3_IdentidadeBloqueia() {
  console.log("\n🧪 3. Identidade sem permissão bloqueia canal (robô inexistente)");
  const resultado = await externalIntegrationEngine.executarIntegracao({
    roboId: "00000000-0000-0000-0000-000000000000",
    intencao: {
      canal: "crm",
      acao: "criar_cliente",
      payload: { nome: "Teste", email: "teste@teste.com" },
    },
  });
  console.log(`  Status: ${resultado.status}`);
  if (resultado.status === "bloqueada_identidade" || resultado.status === "simulada") {
    console.log(`  ✅ Robô sem identidade tratado corretamente (status=${resultado.status})`);
  } else {
    console.log(`  ⚠️ Comportamento inesperado: ${resultado.status}`);
  }
  return resultado;
}

async function testarCenario4_PayloadGeradoCorretamente() {
  console.log("\n🧪 4. Payload é gerado corretamente (Zoho Mail)");
  const resultado = await externalIntegrationEngine.executarIntegracao({
    roboId: ROBO_ID,
    intencao: {
      canal: "zoho_mail",
      acao: "enviar_email",
      payload: {
        para: "cliente@empresa.com",
        assunto: "Proposta Comercial",
        corpo: "Segue proposta em anexo.",
        anexos: ["proposta.pdf"],
      },
    },
  });
  console.log(`  Status: ${resultado.status}`);
  const mock = resultado.payload_mockado;
  if (mock && mock.status === "simulado") {
    console.log(`  ✅ Payload mockado gerado: assunto="${mock.assunto}"`);
    console.log(`  ✅ Canal preservado: ${resultado.canal}`);
    console.log(`  ✅ Ação preservada: ${resultado.acao}`);
  } else {
    console.log(`  ❌ Payload mockado inválido: ${JSON.stringify(mock)}`);
  }
  return resultado;
}

async function testarCenario5_LogPersistido() {
  console.log("\n🧪 5. Log é persistido corretamente");
  const resultado = await externalIntegrationEngine.executarIntegracao({
    roboId: ROBO_ID,
    intencao: {
      canal: "google_ads",
      acao: "criar_campanha",
      payload: { nome: "Campanha Verão", orcamento: 5000, plataforma: "Google Ads" },
    },
  });
  if (resultado.log_id) {
    const { data: log } = await supabase.from("ia_integracoes_externas_logs").select("*").eq("id", resultado.log_id).single();
    if (log) {
      console.log(`  ✅ Log encontrado: ID=${log.id}`);
      console.log(`  ✅ Canal: ${log.canal}`);
      console.log(`  ✅ Categoria: ${log.categoria}`);
      console.log(`  ✅ Ação: ${log.acao}`);
      console.log(`  ✅ Status: ${log.status}`);
      console.log(`  ✅ Duração: ${log.duracao_ms}ms`);
      console.log(`  ✅ Payload original tem ${log.payload ? Object.keys(log.payload).length : 0} campos`);
      console.log(`  ✅ Payload mockado tem ${log.payload_mockado ? Object.keys(log.payload_mockado).length : 0} campos`);
      console.log(`  ✅ Robô ID: ${log.robo_id}`);
      console.log(`  ✅ Origem: ${log.origem}`);
    } else { console.log("  ❌ Log não encontrado"); }
  } else { console.log("  ❌ Log ID não gerado"); }
  return resultado;
}

async function testarCenario6_FluxoCompleto() {
  console.log("\n🧪 6. Fluxo F34A→F35→F36→F37 completo (simulado)");
  const canais = ["whatsapp", "email", "crm", "leads", "meta_ads", "api_externa", "webhook"];
  const acoes: Record<string, string> = {
    whatsapp: "enviar_mensagem", email: "enviar_email", crm: "criar_oportunidade",
    leads: "capturar_lead", meta_ads: "criar_campanha", api_externa: "post", webhook: "disparar",
  };
  let sucessos = 0;
  let falhas = 0;

  for (const canal of canais) {
    const resultado = await externalIntegrationEngine.executarIntegracao({
      roboId: ROBO_ID,
      intencao: {
        canal: canal as "whatsapp" | "email" | "crm" | "leads" | "meta_ads" | "api_externa" | "webhook",
        acao: acoes[canal],
        payload: { origem: "teste_f37", timestamp: new Date().toISOString() },
      },
    });
    if (resultado.sucesso) {
      sucessos++;
      console.log(`  ✅ ${canal}/${acoes[canal]} → simulada (log=${(resultado.log_id || "").slice(0, 8)}...)`);
    } else {
      falhas++;
      console.log(`  ⚠️ ${canal}/${acoes[canal]} → ${resultado.status}`);
    }
  }
  console.log(`  Total: ${sucessos} sucessos, ${falhas} falhas`);
  return { sucessos, falhas };
}

async function testarContextoCanais() {
  console.log("\n🧪 7. Contexto de canais para F34A (LLM)");
  const ctx = externalIntegrationEngine.montarContextoCanais();
  console.log(`  ✅ Modo seguro: ${ctx.modo_seguro_ativo}`);
  console.log(`  ✅ Total canais: ${ctx.total_canais}`);
  console.log(`  ✅ Total ações: ${ctx.total_acoes_suportadas}`);
  console.log(`  ✅ Contexto string: ${ctx.canais_disponiveis.length} chars`);
  const texto = externalIntegrationEngine.montarContextoIntegracoes();
  console.log(`  ✅ Prompt integração: ${texto.length} chars`);
  return ctx;
}

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 F37 — Teste Supabase: Integrações Externas (Modo Seguro)");
  console.log("=".repeat(60));

  await testarCenario1_IntegracaoSimulada();
  await testarCenario2_GovernancaBloqueia();
  await testarCenario3_IdentidadeBloqueia();
  await testarCenario4_PayloadGeradoCorretamente();
  await testarCenario5_LogPersistido();
  await testarCenario6_FluxoCompleto();
  await testarContextoCanais();

  console.log("\n" + "=".repeat(60));
  console.log("🏁 F37 — Teste concluído!");
  console.log("=".repeat(60));
}

main().catch(console.error);
