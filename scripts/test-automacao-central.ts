// Script de Teste - Central de Automação TMS
// Executar com: npx tsx scripts/test-automacao-central.ts

const WEBHOOK_URL = process.env.VITE_N8N_WEBHOOK_OS || "http://localhost:5678/webhook/os-whatsapp";

const eventoTeste = {
  setor: "operacional",
  tipoEvento: "OS_SAIU_PARA_ENTREGA",
  origemSistema: "TMS_CONEXAO_EXPRESS",
  dataEvento: new Date().toISOString(),
  entidadeId: "teste-001",
  osId: "teste-os-001",
  telefoneCliente: "5511999999999",
  dados: {
    cliente: "Cliente Teste",
    origem: "Guarulhos - SP",
    destino: "São Paulo - SP",
    previsao: "Hoje até 17h",
    status: "saiu_para_entrega"
  }
};

async function testarAutomacaoCentral() {
  console.log("=".repeat(60));
  console.log("TESTE - CENTRAL DE AUTOMAÇÃO TMS");
  console.log("=".repeat(60));
  console.log(`\nWebhook URL: ${WEBHOOK_URL}`);
  console.log(`\nEvento a ser enviado:`);
  console.log(JSON.stringify(eventoTeste, null, 2));
  console.log("\n" + "-".repeat(60));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    console.log("\nEnviando evento para o n8n...");

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventoTeste)
    });

    clearTimeout(timeoutId);

    console.log(`\nStatus da resposta: ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log("\n✅ SUCESSO - Evento teste enviado para o n8n!");
      console.log("\nVerifique no painel do n8n se o webhook foi recebido.");
    } else {
      const errorText = await response.text().catch(() => "Sem detalhes do erro");
      console.log(`\n❌ FALHA - HTTP ${response.status}`);
      console.log(`Detalhes: ${errorText}`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.log(`\n❌ ERRO DE CONEXÃO: ${msg}`);
    console.log("\nVerifique se:");
    console.log("  1. O n8n está rodando em http://localhost:5678");
    console.log("  2. O webhook 'os-whatsapp' está configurado no n8n");
    console.log("  3. A variável VITE_N8N_WEBHOOK_OS está no .env");
  }

  console.log("\n" + "=".repeat(60));
  console.log("FIM DO TESTE");
  console.log("=".repeat(60));
}

testarAutomacaoCentral();