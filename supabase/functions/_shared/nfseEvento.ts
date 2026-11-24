// ===================================================================
// _shared/nfseEvento.ts
//
// Gerador do XML do pedido de registro de evento da NFS-e Nacional
// (pedRegEvento / TCPedRegEvt — XSD v1.01) e validacao do cancelamento
// (evento e101101).
//
// Estrutura oficial (XSD NFS-e Nacional, mesmo leiaute dos pacotes em vigor):
//   pedRegEvento[@versao=1.01]
//     infPedReg[@Id="PRE"+chave(50)+"101101"]
//       tpAmb, verAplic, dhEvento, CNPJAutor, chNFSe
//       e101101
//         xDesc ("Cancelamento de NFS-e"), cMotivo (1|2|9), xMotivo (15..255)
//     Signature (XMLDSig enveloped, inserida como irma de infPedReg)
//
// A assinatura e feita por `assinarEventoXml` (nfseXmlSign.ts) e a
// transmissao mTLS por `transmitirEventoParaSefin` (nfseSefin.ts).
// ===================================================================

export const NAMESPACE_NFSE = "http://www.sped.fazenda.gov.br/nfse";
export const VERSAO_EVENTO = "1.01";
export const VERSAO_APLICATIVO = "CONEXAO-TMS-1.01";

/** Codigo do evento de cancelamento pelo emitente (e101101). */
export const EVENTO_CANCELAMENTO = "101101";
/** Descricao fixa exigida pelo XSD para o evento e101101. */
export const DESCRICAO_EVENTO_CANCELAMENTO = "Cancelamento de NFS-e";

export const JUSTIFICATIVA_MIN = 15;
export const JUSTIFICATIVA_MAX = 255;

/** Motivos oficiais do cancelamento de NFS-e (TSCodJustCanc). */
export const MOTIVOS_CANCELAMENTO: Record<string, string> = {
  "1": "Erro na emissão",
  "2": "Serviço não prestado",
  "9": "Outros",
};

export function motivoCancelamentoValido(codigo: string): boolean {
  return Object.prototype.hasOwnProperty.call(MOTIVOS_CANCELAMENTO, codigo);
}

function escaparXml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function somenteDigitos(valor: unknown): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** Horario atual no fuso America/Sao_Paulo com offset fixo -03:00 (sem DST). */
export function agoraSaoPauloComOffset(base?: Date): string {
  const agora = base ?? new Date();
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const campo = function(tipo: string): string {
    return partes.find((parte) => parte.type === tipo)?.value ?? "";
  };
  return `${campo("year")}-${campo("month")}-${campo("day")}T${campo("hour")}:${
    campo("minute")
  }:${campo("second")}-03:00`;
}

export interface CancelamentoEventoPayload {
  /** Chave de acesso da NFS-e (50 digitos). */
  chaveAcesso: string;
  /** Ambiente da nota: "producao" (1) ou "homologacao" (2). */
  ambiente: string;
  /** CNPJ do autor (emitente/matriz). */
  cnpjAutor: string;
  /** Codigo do motivo: 1, 2 ou 9. */
  codigoMotivo: string;
  /** Justificativa (15 a 255 caracteres). */
  justificativa: string;
  /** dhEvento pronto (ISO com offset). Padrao: agora em America/Sao_Paulo. */
  dhEvento?: string;
  /** verAplic do pedido. Padrao: CONEXAO-TMS-1.01. */
  versaoAplicativo?: string;
}

export interface ResultadoValidacaoJustificativa {
  ok: boolean;
  texto: string;
  erro?: string;
}

/** Valida/normaliza a justificativa do cancelamento (15 a 255 caracteres). */
export function validarJustificativaCancelamento(
  valor: unknown,
): ResultadoValidacaoJustificativa {
  const texto = String(valor ?? "").trim();
  const tamanho = Array.from(texto).length;
  if (tamanho < JUSTIFICATIVA_MIN) {
    return {
      ok: false,
      texto,
      erro:
        `A justificativa deve ter no minimo ${JUSTIFICATIVA_MIN} caracteres.`,
    };
  }
  if (tamanho > JUSTIFICATIVA_MAX) {
    return {
      ok: false,
      texto,
      erro:
        `A justificativa deve ter no maximo ${JUSTIFICATIVA_MAX} caracteres.`,
    };
  }
  return { ok: true, texto };
}

/** Codigo de ambiente da NFS-e: 1 = producao, 2 = homologacao/prod. restrita. */
export function codigoAmbiente(ambiente: string): "1" | "2" {
  const valor = String(ambiente ?? "").trim().toLowerCase();
  return valor.startsWith("prod") || valor === "1" ? "1" : "2";
}

/**
 * Monta o XML do pedido de registro de evento de cancelamento (pedRegEvento).
 * Nao assina — apenas gera a arvore na ordem exata do XSD.
 */
export function gerarXmlPedRegEventoCancelamento(
  payload: CancelamentoEventoPayload,
): string {
  const chave = somenteDigitos(payload.chaveAcesso);
  if (!/^\d{50}$/.test(chave)) {
    throw new Error("Chave de acesso invalida (esperados 50 digitos).");
  }
  const cnpjAutor = somenteDigitos(payload.cnpjAutor);
  if (!/^\d{14}$/.test(cnpjAutor)) {
    throw new Error("CNPJ do autor invalido (esperados 14 digitos).");
  }
  const codigoMotivo = String(payload.codigoMotivo ?? "").trim();
  if (!motivoCancelamentoValido(codigoMotivo)) {
    throw new Error("Motivo do cancelamento invalido (use 1, 2 ou 9).");
  }
  const justificativa = validarJustificativaCancelamento(payload.justificativa);
  if (!justificativa.ok) {
    throw new Error(justificativa.erro || "Justificativa invalida.");
  }

  const idEvento = `PRE${chave}${EVENTO_CANCELAMENTO}`;
  const dhEvento = payload.dhEvento || agoraSaoPauloComOffset();
  const verAplic = String(payload.versaoAplicativo || VERSAO_APLICATIVO)
    .trim()
    .slice(0, 20) || VERSAO_APLICATIVO;

  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="${NAMESPACE_NFSE}" versao="${VERSAO_EVENTO}">` +
    `<infPedReg Id="${escaparXml(idEvento)}">` +
    `<tpAmb>${codigoAmbiente(payload.ambiente)}</tpAmb>` +
    `<verAplic>${escaparXml(verAplic)}</verAplic>` +
    `<dhEvento>${escaparXml(dhEvento)}</dhEvento>` +
    `<CNPJAutor>${escaparXml(cnpjAutor)}</CNPJAutor>` +
    `<chNFSe>${escaparXml(chave)}</chNFSe>` +
    `<e${EVENTO_CANCELAMENTO}>` +
    `<xDesc>${escaparXml(DESCRICAO_EVENTO_CANCELAMENTO)}</xDesc>` +
    `<cMotivo>${escaparXml(codigoMotivo)}</cMotivo>` +
    `<xMotivo>${escaparXml(justificativa.texto)}</xMotivo>` +
    `</e${EVENTO_CANCELAMENTO}>` +
    `</infPedReg>` +
    `</pedRegEvento>`;
}
