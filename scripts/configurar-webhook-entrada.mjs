const EVOLUTION_API_URL = (process.env.VITE_EVOLUTION_API_URL || "http://localhost:8080").replace(/\/$/, "");
const EVOLUTION_API_KEY = process.env.VITE_EVOLUTION_API_KEY || "123456";
const INSTANCE_NAME = process.env.VITE_EVOLUTION_INSTANCE_NAME || process.env.VITE_EVOLUTION_INSTANCE || "tms";

const WEBHOOK_URL = process.env.WEBHOOK_DESTINO || "http://host.docker.internal:5679/webhook/whatsapp-entrada";

async function configurarWebhook() {
  console.log("");
  console.log("=".repeat(60));
  console.log(" CONFIGURAR WEBHOOK EVOLUTION API -> N8N");
  console.log("=".repeat(60));
  console.log("");
  console.log(` Evolution API : ${EVOLUTION_API_URL}`);
  console.log(` Instância     : ${INSTANCE_NAME}`);
  console.log(` Webhook destino : ${WEBHOOK_URL}`);
  console.log("");

  const url = `${EVOLUTION_API_URL}/webhook/set/${encodeURIComponent(INSTANCE_NAME)}`;

  const payload = {
    webhook: {
      enabled: true,
      url: WEBHOOK_URL,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "QRCODE_UPDATED"
      ]
    }
  };

  console.log(" Enviando configuração...");
  console.log(` POST ${url}`);
  console.log(` Payload: ${JSON.stringify(payload, null, 2)}`);
  console.log("");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = await response.text().catch(() => null);
    }

    console.log(` Status : ${response.status} ${response.statusText}`);

    if (response.ok) {
      console.log("");
      console.log(" ✅ Webhook configurado com sucesso!");
      console.log(`    Evolution API -> ${WEBHOOK_URL}`);
      console.log("");
      console.log(" Eventos habilitados:");
      console.log("   - MESSAGES_UPSERT");
      console.log("   - MESSAGES_UPDATE");
      console.log("   - CONNECTION_UPDATE");
      console.log("   - QRCODE_UPDATED");
      console.log("");
      process.exit(0);
    } else {
      console.log("");
      console.log(` ❌ Falha ao configurar webhook:`);
      console.log(`    ${JSON.stringify(data)}`);
      console.log("");
      process.exit(1);
    }
  } catch (e) {
    console.log("");
    console.log(` ❌ ERRO DE CONEXÃO: ${e.message}`);
    console.log("");
    console.log(" Possíveis causas:");
    console.log(`   1. Evolution API não está rodando em ${EVOLUTION_API_URL}`);
    console.log("   2. Instância não existe ou não está conectada");
    console.log("   3. API_KEY incorreta");
    console.log("   4. Firewall bloqueando a porta 8080");
    console.log("");
    process.exit(1);
  }
}

configurarWebhook();
