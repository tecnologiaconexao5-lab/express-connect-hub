const WEBHOOK_URL = "http://localhost:5679/webhook/whatsapp-entrada";
const TELEFONE_TESTE = "5511912133010";
const NOME_TESTE = "Diego Balbino";
const MENSAGEM_TESTE = "Olá, gostaria de um orçamento para coleta hoje";

function gerarPayloadEvolution(evento) {
  return {
    event: "messages.upsert",
    instance: "tms",
    data: {
      key: {
        remoteJid: `${evento.telefone}@s.whatsapp.net`,
        fromMe: false,
        id: "ABCDEF1234567890"
      },
      pushName: evento.nome,
      message: {
        conversation: evento.mensagem
      },
      messageType: "conversation",
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  };
}

async function testarWebhookWhatsAppEntrada() {
  console.log("");
  console.log("=".repeat(60));
  console.log(" TESTE WHATSAPP ENTRADA -> N8N (PREPARAÇÃO IA)");
  console.log("=".repeat(60));
  console.log("");
  console.log(` Webhook  : ${WEBHOOK_URL}`);
  console.log(` Telefone : ${TELEFONE_TESTE}`);
  console.log(` Nome     : ${NOME_TESTE}`);
  console.log(` Mensagem : ${MENSAGEM_TESTE}`);
  console.log("");

  const payloadEvolution = gerarPayloadEvolution({
    telefone: TELEFONE_TESTE,
    nome: NOME_TESTE,
    mensagem: MENSAGEM_TESTE
  });

  console.log(" Payload Evolution API enviado:");
  console.log(`   ${JSON.stringify(payloadEvolution, null, 2)}`);
  console.log("");

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const startTime = Date.now();

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadEvolution),
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    let responseBody = null;
    try {
      responseBody = await response.json();
    } catch {
      responseBody = await response.text().catch(() => null);
    }

    console.log(` Status  : ${response.status} ${response.statusText}`);
    console.log(` Tempo   : ${elapsed}ms`);
    console.log(` Resposta:`);
    console.log(`   ${JSON.stringify(responseBody, null, 2)}`);

    if (response.ok) {
      console.log("");
      console.log(" ✅ SUCESSO! Webhook WhatsApp Entrada respondeu OK.");
      console.log("");

      if (responseBody?.recebido) {
        console.log(" Dados normalizados pelo n8n:");
        console.log(`   telefone     : ${responseBody.recebido.telefone}`);
        console.log(`   nome         : ${responseBody.recebido.nome}`);
        console.log(`   mensagem     : ${responseBody.recebido.mensagem}`);
        console.log(`   tipoMensagem : ${responseBody.recebido.tipoMensagem}`);
        console.log(`   horario      : ${responseBody.recebido.horario}`);
        console.log("");
      }

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
    console.log("   2. Workflow 'TMS WhatsApp Entrada IA' não está ativo");
    console.log("   3. Webhook /webhook/whatsapp-entrada não existe no n8n");
    console.log("   4. Firewall bloqueando a porta 5679");
    console.log("");
    process.exit(1);
  }
}

testarWebhookWhatsAppEntrada();
