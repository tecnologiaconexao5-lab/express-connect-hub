// ============================================================
// FIX-USABILIDADE-VEICULOS-E-DUPLO-TEMPLATE-WHATSAPP
// Dois templates de WhatsApp do motoboy + template do cliente:
//   • TEMPLATE 1 — RESUMO DA ROTA (privacidade: sem número da porta)
//   • TEMPLATE 2 — ORIENTAÇÃO DE EXECUÇÃO (OS completa, endereço completo)
//   • CLIENTE — link de rastreio em tempo real
//
// Usados pelo formulário desktop (OrdemServicoForm / OrdemServicoPreview)
// e pelo /os-mobile. Ícones dinâmicos por veículo.
// ============================================================

// ---------- Tipos (aceita payload desktop e /os-mobile) ----------
export interface PontoEnderecoMensagem {
  sequencia?: number;
  tipo?: string;
  nomeLocal?: string;
  logradouro?: string;
  numero?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  janelaInicio?: string;
  janelaFim?: string;
  janela_inicio?: string;
  janela_fim?: string;
  contato?: string;
  contatoNome?: string;
  recebedor?: string;
  recebedorPrevisto?: string;
  telefone?: string;
  telefoneContato?: string;
  contatoTelefone?: string;
  instrucoes?: string;
  observacoes?: string;
  observacaoPonto?: string;
  volumes?: number | string;
  [chave: string]: unknown;
}

export interface DadosMensagemMotoboy {
  numero?: string;
  numeroOS?: string;
  osNumero?: string;
  veiculoTipo?: string;
  veiculo?: string;
  tipoVeiculo?: string;
  prestador?: string;
  prestadorNome?: string;
  nomePrestador?: string;
  nomeMotorista?: string;
  avulsoNome?: string;
  custoPrestador?: number | string | null;
  statusFaturamento?: string;
  formaPagamento?: string;
  pagamentoPrestador?: string;
  distanciaKm?: number | string | null;
  km?: number | string | null;
  distanciaRota?: { distanciaKm?: number | string | null } | null;
  volumes?: number | string;
  observacoesGerais?: string | null;
  observacaoTorre?: string | null;
  instrucoesOperacionaisOS?: string | null;
  observacoes?: string | null;
  observacao?: string | null;
  enderecos?: PontoEnderecoMensagem[];
  [chave: string]: unknown;
}

const fmtValor = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0,00";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDistancia = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
};

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  "a vista": "À vista",
  avista: "À vista",
  "avista mesmo dia": "À vista mesmo dia",
  avista_mesmo_dia: "À vista mesmo dia",
  faturado: "A faturar",
  "a faturar": "A faturar",
  contrato: "Contrato",
  cortesia: "Cortesia",
  faturada: "Faturada",
  paga: "Paga",
  cancelado: "Cancelado",
};

const formaPagamento = (data: DadosMensagemMotoboy): string => {
  const bruto = String(
    data?.statusFaturamento || data?.formaPagamento || data?.pagamentoPrestador || "",
  ).trim();
  if (!bruto) return "À vista";
  return FORMA_PAGAMENTO_LABEL[bruto.toLowerCase()] || bruto;
};

const semAcento = (v: unknown): string =>
  String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// ---------- Ícone dinâmico por veículo ----------
export const iconeVeiculo = (data: DadosMensagemMotoboy): string => {
  const t = semAcento(data?.veiculoTipo || data?.veiculo || data?.tipoVeiculo || "");
  if (!t.trim()) return "🚚";
  if (t.includes("moto")) return "🏍️";
  if (t.includes("carro") || t.includes("passeio") || t.includes("automovel") || t === "car") {
    return "🚗";
  }
  if (t.includes("van") || t.includes("vuc") || t.includes("kombi")) return "🚚";
  return "🚚";
};

// ---------- Pontos da rota (aceita desktop e /os-mobile) ----------
const pontosOrdenados = (data: DadosMensagemMotoboy): PontoEnderecoMensagem[] => {
  const enderecos: PontoEnderecoMensagem[] = Array.isArray(data?.enderecos) ? data.enderecos : [];
  return [...enderecos].sort((a, b) => (a?.sequencia ?? 0) - (b?.sequencia ?? 0));
};

const ehColeta = (e: PontoEnderecoMensagem): boolean =>
  ["coleta", "retirada", "origem"].includes(String(e?.tipo || "").toLowerCase());
const ehEntrega = (e: PontoEnderecoMensagem): boolean =>
  ["entrega", "destino", "devolucao"].includes(String(e?.tipo || "").toLowerCase());

const pontoOrigem = (data: DadosMensagemMotoboy): PontoEnderecoMensagem => {
  const pts = pontosOrdenados(data);
  return pts.find(ehColeta) || pts[0] || {};
};

const pontoDestino = (data: DadosMensagemMotoboy): PontoEnderecoMensagem => {
  const pts = pontosOrdenados(data);
  return [...pts].reverse().find(ehEntrega) || pts[pts.length - 1] || {};
};

// ---------- PRIVACIDADE: somente a rua, SEM número da porta ----------
const ruaSemNumero = (e: PontoEnderecoMensagem): string => {
  const logradouro = String(e?.logradouro || "").trim();
  if (logradouro) return logradouro;
  // fallback: parte antes da primeira vírgula do endereço formatado
  const formatado = String(e?.endereco || "").trim();
  if (!formatado) return "—";
  const antesDaVirgula = formatado.split(",")[0].trim();
  return antesDaVirgula || "—";
};

const bairro = (e: PontoEnderecoMensagem): string => String(e?.bairro || "").trim() || "—";

const cepFormatado = (e: PontoEnderecoMensagem): string => {
  const digitos = String(e?.cep || "").replace(/\D/g, "");
  if (digitos.length === 8) return `${digitos.slice(0, 5)}-${digitos.slice(5)}`;
  return String(e?.cep || "").trim() || "—";
};

// Janela de horário — desktop usa janelaInicio/janelaFim,
// /os-mobile persiste janela_inicio/janela_fim (jsonb da OS).
const janela = (e: PontoEnderecoMensagem): string => {
  const inicio = String(e?.janelaInicio || e?.janela_inicio || "").trim();
  const fim = String(e?.janelaFim || e?.janela_fim || "").trim();
  if (inicio && fim) return `${inicio}–${fim}`;
  if (inicio) return inicio;
  if (fim) return fim;
  return "—";
};

// Link curto do Google Maps — SEM número da porta (privacidade).
// Formato obrigatório: https://maps.google.com/?q=Rua+Cidade
const linkMaps = (e: PontoEnderecoMensagem): string => {
  const consulta = [ruaSemNumero(e), String(e?.cidade || "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!consulta || consulta === "—") return "—";
  return `https://maps.google.com/?q=${consulta.replace(/\s+/g, "+")}`;
};

const distanciaKm = (data: DadosMensagemMotoboy): string => {
  const bruto = data?.distanciaRota?.distanciaKm ?? data?.distanciaKm ?? data?.km ?? null;
  return fmtDistancia(bruto);
};

const atencao = (data: DadosMensagemMotoboy): string => {
  const candidatos = [
    data?.observacoesGerais,
    data?.observacaoTorre,
    data?.instrucoesOperacionaisOS,
    data?.observacoes,
    data?.observacao,
  ];
  const texto = candidatos.map((v) => String(v ?? "").trim()).find((v) => v.length > 0);
  return texto || "—";
};

// ---------- Auxiliares do Template 2 (Orientação de Execução) ----------
const primeiroNaoVazio = (...valores: unknown[]): string => {
  for (const v of valores) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "—";
};

/** Endereço completo (com número) — usado na orientação privada ao motoboy. */
const enderecoCompleto = (e: PontoEnderecoMensagem): string => {
  const linha1 = [String(e?.logradouro || "").trim(), String(e?.numero || "").trim()]
    .filter(Boolean)
    .join(", ");
  const linha2 = [String(e?.bairro || "").trim(), [e?.cidade, e?.estado].filter(Boolean).join("/")]
    .filter(Boolean)
    .join(", ");
  const partes = [linha1 || String(e?.endereco || "").trim(), linha2, cepFormatado(e)]
    .filter((p) => p && p !== "—");
  return partes.join(" - ") || "—";
};

const nomeMotoboy = (data: DadosMensagemMotoboy): string =>
  primeiroNaoVazio(
    data?.nomeMotorista,
    data?.prestadorNome,
    data?.nomePrestador,
    data?.prestador,
    data?.avulsoNome,
  );

const contatoPonto = (e: PontoEnderecoMensagem): string =>
  primeiroNaoVazio(
    e?.contato,
    e?.contatoNome,
    e?.recebedor,
    e?.recebedorPrevisto,
    e?.nomeLocal,
  );

const telefonePonto = (e: PontoEnderecoMensagem): string =>
  primeiroNaoVazio(e?.telefone, e?.contatoTelefone, e?.telefoneContato);

const instrucoesPonto = (e: PontoEnderecoMensagem): string =>
  primeiroNaoVazio(e?.instrucoes, e?.observacoes, e?.observacaoPonto);

const volumesPonto = (e: PontoEnderecoMensagem, data: DadosMensagemMotoboy): string => {
  const v = e?.volumes ?? data?.volumes;
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return String(v);
  return primeiroNaoVazio(v);
};

// ============================================================
// TEMPLATE 1 — RESUMO DA ROTA (privacidade: sem número da porta)
// ============================================================
export const gerarMensagemWhatsAppMotoboy = (data: DadosMensagemMotoboy): string => {
  const origem = pontoOrigem(data);
  const destino = pontoDestino(data);

  return [
    "🟠 *CONEXÃO ⚡ EXPRESS* 🟣",
    `━━━━━━━━━━━━━━━━━${iconeVeiculo(data)}`,
    "",
    `${bairro(origem)} ━➤ ${bairro(destino)} | ${distanciaKm(data)} km`,
    "",
    `🟣 【 1 】 RET • ${ruaSemNumero(origem)} - CEP: ${cepFormatado(origem)}`,
    `⏰ ${janela(origem)}`,
    `🗺️ ${linkMaps(origem)}`,
    "",
    `🟠 【 2 】 ENT • ${ruaSemNumero(destino)} - CEP: ${cepFormatado(destino)}`,
    `⏰ ${janela(destino)}`,
    `🗺️ ${linkMaps(destino)}`,
    "",
    "━━━━━━━━━━━━━━━━━",
    `💰 R$ ${fmtValor(data?.custoPrestador)} | ${formaPagamento(data)}`,
    "",
    `⚠️ ATENÇÃO: ${atencao(data)}`,
  ].join("\n");
};

// ============================================================
// TEMPLATE 2 — ORIENTAÇÃO DE EXECUÇÃO (OS completa, privada ao motoboy)
// ============================================================
export const gerarMensagemOrientacaoExecucao = (data: DadosMensagemMotoboy): string => {
  const origem = pontoOrigem(data);
  const destino = pontoDestino(data);
  const numeroOS = primeiroNaoVazio(data?.numeroOS, data?.osNumero, data?.numero);

  return [
    "🟠 CONEXÃO ⚡ EXPRESS 🟣",
    "📋 ORIENTAÇÃO DE EXECUÇÃO",
    `OS nº ${numeroOS}`,
    "",
    `Olá, ${nomeMotoboy(data)}! Você foi selecionado para executar esta OS.`,
    "",
    `${iconeVeiculo(data)} VEÍCULO: ${primeiroNaoVazio(data?.veiculoTipo, data?.veiculo, data?.tipoVeiculo)}`,
    `💰 VALOR: R$ ${fmtValor(data?.custoPrestador)}`,
    `💳 PAGAMENTO: ${formaPagamento(data)}`,
    "",
    "━━━━━━━━━━━━━━━━━",
    "🟣 【 1 】 RETIRADA",
    "━━━━━━━━━━━━━━━━━",
    "",
    `📍 ENDEREÇO: ${enderecoCompleto(origem)}`,
    `🗺️ ${linkMaps(origem)}`,
    `⏰ JANELA: ${janela(origem)}`,
    `👤 PROCURAR: ${contatoPonto(origem)}`,
    `📞 TELEFONE: ${telefonePonto(origem)}`,
    `📦 RETIRAR: ${volumesPonto(origem, data)}`,
    `⚠️ ORIENTAÇÕES: ${instrucoesPonto(origem)}`,
    "",
    "━━━━━━━━━━━━━━━━━",
    "🟠 【 2 】 ENTREGA",
    "━━━━━━━━━━━━━━━━━",
    "",
    `📍 ENDEREÇO: ${enderecoCompleto(destino)}`,
    `🗺️ ${linkMaps(destino)}`,
    `⏰ JANELA: ${janela(destino)}`,
    `👤 PROCURAR: ${contatoPonto(destino)}`,
    `📞 TELEFONE: ${telefonePonto(destino)}`,
    `📦 ENTREGAR: ${volumesPonto(destino, data)}`,
    `⚠️ ORIENTAÇÕES: ${instrucoesPonto(destino)}`,
    "",
    "━━━━━━━━━━━━━━━━━",
    "📸 COMPROVAÇÃO",
    "Enviar o comprovante de entrega pelo WhatsApp após a conclusão.",
    "",
    "🤝 CONDUTA PROFISSIONAL",
    "Seja sempre educado e cordial, utilize trajes adequados à operação e mantenha uma postura profissional. Em caso de dúvida, dificuldade, atraso ou ocorrência, entre em contato com a Conexão Express imediatamente.",
    "",
    "🟠 CONEXÃO ⚡ EXPRESS 🟣",
  ].join("\n");
};

// ============================================================
// WHATSAPP DO CLIENTE / DESTINATÁRIO — link de rastreio
// ============================================================
export const URL_BASE_RASTREIO = "https://tms.conexaoexpress.com.br/rastreio";

export const gerarMensagemWhatsAppClienteRastreio = (data: {
  numeroOS?: string | null;
  osId?: string | null;
  idOS?: string | null;
}): string => {
  const id = String(data?.numeroOS || data?.osId || data?.idOS || "").trim() || "—";
  return (
    `Olá! 📦 Sua encomenda pela *Conexão Express* está a caminho. ` +
    `Acompanhe o status em tempo real através do link: ${URL_BASE_RASTREIO}/${id}`
  );
};

// Compatibilidade — MODELO 1 (divulgação) aponta para o RESUMO DA ROTA.
export const gerarMensagemOSGrupo = (data: DadosMensagemMotoboy): string =>
  gerarMensagemWhatsAppMotoboy(data);

export default gerarMensagemWhatsAppMotoboy;
