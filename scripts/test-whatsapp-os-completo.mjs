const WEBHOOK_URL = "http://localhost:5679/webhook/os-whatsapp";
const TELEFONE = "5511912133010";

function gerarPayload(tipo, dados) {
  const templates = {
    "OS CRIADA": [
      "🚛 Conexão Express",
      "",
      "Sua Ordem de Serviço foi criada com sucesso.",
      "",
      `OS: ${dados.numero}`,
      `Cliente: ${dados.cliente}`,
      `Origem: ${dados.origem}`,
      `Destino: ${dados.destino}`,
      "Status: Criada",
      "",
      "Em breve nossa equipe dará continuidade ao atendimento.",
    ].join("\n"),

    "OS ATUALIZADA": [
      "🔄 Conexão Express",
      "",
      "Sua Ordem de Serviço foi atualizada.",
      "",
      `OS: ${dados.numero}`,
      `Cliente: ${dados.cliente}`,
      `Origem: ${dados.origem}`,
      `Destino: ${dados.destino}`,
      `Status: ${dados.status}`,
      "",
      "Acompanhe as atualizações pelo nosso canal de atendimento.",
    ].join("\n"),

    "PRESTADOR ACIONADO": [
      "🚛 Conexão Express",
      "",
      "Um prestador foi acionado para sua Ordem de Serviço.",
      "",
      `OS: ${dados.numero}`,
      `Cliente: ${dados.cliente}`,
      `Transportador: ${dados.prestador}`,
      `Placa: ${dados.placa}`,
      `Origem: ${dados.origem}`,
      `Destino: ${dados.destino}`,
      "",
      "Em breve entraremos em contato para confirmar os detalhes.",
    ].join("\n"),

    "OS FINALIZADA": [
      "✅ Conexão Express",
      "",
      "Sua Ordem de Serviço foi finalizada com sucesso.",
      "",
      `OS: ${dados.numero}`,
      `Cliente: ${dados.cliente}`,
      `Origem: ${dados.origem}`,
      `Destino: ${dados.destino}`,
      "",
      "Agradecemos pela confiança em nossos serviços.",
    ].join("\n"),

    "OCORRÊNCIA": [
      "⚠️ Conexão Express",
      "",
      "Registramos uma ocorrência em sua Ordem de Serviço.",
      "",
      `OS: ${dados.numero}`,
      `Cliente: ${dados.cliente}`,
      `Tipo: ${dados.tipoOcorrencia}`,
      `Descrição: ${dados.descricao}`,
      `Origem: ${dados.origem}`,
      `Destino: ${dados.destino}`,
      "",
      "Nossa equipe já está tratando a ocorrência. Em breve retornaremos com atualizações.",
    ].join("\n"),
  };

  return {
    telefone: TELEFONE,
    mensagem: templates[tipo],
  };
}

async function testarTipo(seq, tipo, dados) {
  const payload = gerarPayload(tipo, dados);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  #${seq} — ${tipo}`);
  console.log(`${"=".repeat(60)}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const start = Date.now();

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - start;
    const body = await res.json().catch(() => null);

    const ok = res.ok ? "✅ OK" : "❌ FALHA";
    console.log(`  ${ok}  Status: ${res.status}  (${elapsed}ms)`);
    if (body) console.log(`  Resposta: ${JSON.stringify(body)}`);

    return res.ok;
  } catch (e) {
    console.log(`  ❌ ERRO: ${e.message}`);
    return false;
  }
}

const dadosBase = {
  numero: "OS-2025-0001",
  cliente: "Empresa Exemplo Ltda",
  origem: "Rua das Flores, 100 - Centro, São Paulo - SP",
  destino: "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
  status: "Em Andamento",
  prestador: "Transportadora Rápida Ltda",
  placa: "ABC-1D23",
  tipoOcorrencia: "Atraso na coleta",
  descricao: "Veículo quebrado, previsão de chegada em 2h.",
};

const testes = [
  { tipo: "OS CRIADA", dados: { ...dadosBase, status: "Criada" } },
  { tipo: "OS ATUALIZADA", dados: { ...dadosBase, status: "Em Rota" } },
  { tipo: "PRESTADOR ACIONADO", dados: dadosBase },
  { tipo: "OS FINALIZADA", dados: { ...dadosBase, status: "Finalizada" } },
  { tipo: "OCORRÊNCIA", dados: dadosBase },
];

console.log("");
console.log("*".repeat(60));
console.log(" TESTE COMPLETO WHATSAPP OS — 5 EVENTOS");
console.log("*".repeat(60));
console.log(` Webhook: ${WEBHOOK_URL}`);
console.log(` Telefone: ${TELEFONE}`);

let sucessos = 0;
let falhas = 0;

for (let i = 0; i < testes.length; i++) {
  const ok = await testarTipo(i + 1, testes[i].tipo, testes[i].dados);
  if (ok) sucessos++; else falhas++;
}

console.log("");
console.log("=".repeat(60));
console.log(` RESULTADO: ${sucessos} sucesso(s), ${falhas} falha(s)`);
console.log("=".repeat(60));
console.log("");

process.exit(falhas > 0 ? 1 : 0);
