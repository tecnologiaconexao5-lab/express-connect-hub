export interface OSWhatsAppData {
  numero?: string;
  cliente?: string;
  origem?: string;
  destino?: string;
  prestador?: string;
  status?: string;
  placa?: string;
  data?: string;
  tipoOcorrencia?: string;
  descricaoOcorrencia?: string;
}

export function gerarMensagemOSCriada(data: OSWhatsAppData): string {
  return [
    "🚛 Conexão Express",
    "",
    "Sua Ordem de Serviço foi criada com sucesso.",
    "",
    `OS: ${data.numero || "—"}`,
    `Cliente: ${data.cliente || "—"}`,
    `Origem: ${data.origem || "—"}`,
    `Destino: ${data.destino || "—"}`,
    `Status: Criada`,
    "",
    "Em breve nossa equipe dará continuidade ao atendimento.",
  ].join("\n");
}

export function gerarMensagemOSAtualizada(data: OSWhatsAppData): string {
  return [
    "🔄 Conexão Express",
    "",
    "Sua Ordem de Serviço foi atualizada.",
    "",
    `OS: ${data.numero || "—"}`,
    `Cliente: ${data.cliente || "—"}`,
    `Origem: ${data.origem || "—"}`,
    `Destino: ${data.destino || "—"}`,
    `Status: ${data.status || "—"}`,
    "",
    "Acompanhe as atualizações pelo nosso canal de atendimento.",
  ].join("\n");
}

export function gerarMensagemPrestadorAcionado(data: OSWhatsAppData): string {
  return [
    "🚛 Conexão Express",
    "",
    "Um prestador foi acionado para sua Ordem de Serviço.",
    "",
    `OS: ${data.numero || "—"}`,
    `Cliente: ${data.cliente || "—"}`,
    `Transportador: ${data.prestador || "—"}`,
    `Placa: ${data.placa || "—"}`,
    `Origem: ${data.origem || "—"}`,
    `Destino: ${data.destino || "—"}`,
    "",
    "Em breve entraremos em contato para confirmar os detalhes.",
  ].join("\n");
}

export function gerarMensagemOSFinalizada(data: OSWhatsAppData): string {
  return [
    "✅ Conexão Express",
    "",
    "Sua Ordem de Serviço foi finalizada com sucesso.",
    "",
    `OS: ${data.numero || "—"}`,
    `Cliente: ${data.cliente || "—"}`,
    `Origem: ${data.origem || "—"}`,
    `Destino: ${data.destino || "—"}`,
    "",
    "Agradecemos pela confiança em nossos serviços.",
  ].join("\n");
}

export function gerarMensagemOcorrenciaOS(data: OSWhatsAppData): string {
  return [
    "⚠️ Conexão Express",
    "",
    "Registramos uma ocorrência em sua Ordem de Serviço.",
    "",
    `OS: ${data.numero || "—"}`,
    `Cliente: ${data.cliente || "—"}`,
    `Tipo: ${data.tipoOcorrencia || "Não informado"}`,
    `Descrição: ${data.descricaoOcorrencia || "Em análise"}`,
    `Origem: ${data.origem || "—"}`,
    `Destino: ${data.destino || "—"}`,
    "",
    "Nossa equipe já está tratando a ocorrência. Em breve retornaremos com atualizações.",
  ].join("\n");
}
