export interface DadosComprovantePOD {
  osNumero: string;
  recebedor: string;
  documento?: string;
  local?: string;
  dataHora: string;
  observacao?: string;
}

const valorOuTraco = (valor?: string | null) => {
  const texto = (valor || "").trim();
  return texto || "—";
};

export const formatarDataHoraComprovante = (valor: string): string => {
  if (!valor) return "—";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export const gerarMensagemComprovantePOD = (dados: DadosComprovantePOD): string =>
  [
    "✅ *ENTREGA CONCLUÍDA - CONEXÃO EXPRESS*",
    `OS: ${valorOuTraco(dados.osNumero)}`,
    `Recebedor: ${valorOuTraco(dados.recebedor)}`,
    `Documento: ${valorOuTraco(dados.documento)}`,
    `Local: ${valorOuTraco(dados.local)}`,
    `Data/Hora: ${formatarDataHoraComprovante(dados.dataHora)}`,
    `Obs: ${valorOuTraco(dados.observacao)}`,
    "(Acesse a imagem do comprovante anexada abaixo)",
  ].join("\n");
