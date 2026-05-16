const WEBHOOK_URL = "http://localhost:5679/webhook/os-whatsapp";
const TELEFONE_TESTE = "5511912133010";
const MENSAGEM_TESTE = "Teste automático OS criada pelo TMS";

async function testarWebhookWhatsAppOS() {
  console.log("");
  console.log("=".repeat(60));
  console.log(" TESTE DE INTEGRAÇÃO WHATSAPP OS -> N8N");
  console.log("=".repeat(60));
  console.log("");
  console.log(` Webhook : ${WEBHOOK_URL}`);
  console.log(` Telefone: ${TELEFONE_TESTE}`);
  console.log(` Mensagem: ${MENSAGEM_TESTE}`);
  console.log("");

  const payload = {
    telefone: TELEFONE_TESTE,
    mensagem: MENSAGEM_TESTE,
  };

  console.log(" Payload enviado:");
  console.log(`   ${JSON.stringify(payload, null, 2)}`);
  console.log("");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const startTime = Date.now();

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text().catch(() => null);
    }

    console.log(` Status : ${response.status} ${response.statusText}`);
    console.log(` Tempo  : ${elapsed}ms`);
    console.log(` Resposta:`);
    console.log(`   ${JSON.stringify(responseBody, null, 2)}`);

    if (response.ok) {
      console.log("");
      console.log(" ✅ SUCESSO! Webhook WhatsApp OS respondeu OK.");
      console.log("");
      process.exit(0);
    } else {
      console.log("");
      console.log(` ❌ FALHA! Webhook retornou HTTP ${response.status}.`);
      console.log("");
      process.exit(1);
    }
  } catch (e) {
    console.log("");
    console.log(` ❌ ERRO DE CONEXÃO: ${e.message}`);
    console.log("");
    console.log(" Possíveis causas:");
    console.log("   1. n8n não está rodando em http://localhost:5679");
    console.log("   2. Webhook /webhook/os-whatsapp não existe no n8n");
    console.log("   3. Firewall bloqueando a porta 5679");
    console.log("");
    process.exit(1);
  }
}

testarWebhookWhatsAppOS();
