/**
 * nfseEmissaoService
 *
 * Dispatcher NEUTRO para a emissao de NFS-e no Padrao Nacional (SEFIN).
 * Paralelo ao focusService.ts, que permanece responsavel por CT-e/MDF-e.
 *
 * Nesta etapa apenas a ESTRUTURA esta definida: contrato do payload de DPS,
 * tipos de retorno e as funcoes exportadas do motor. O envio real sera
 * plugado na Edge Function neutra (EDGE_FUNCTION_NFSE) sem tocar em
 * CT-e/MDF-e nem exigir configuracao/token da Focus NFe.
 */

export const EDGE_FUNCTION_NFSE = "nfse-emissao";

export interface DpsPrestador {
  cnpj: string;
  inscricaoMunicipal?: string | null;
  razaoSocial?: string | null;
  municipioIbge?: string | null;
}

export interface DpsTomador {
  nome: string;
  cnpj?: string | null;
  cpf?: string | null;
  email?: string | null;
  municipioIbge?: string | null;
}

export interface DpsServico {
  codigoTributacaoNacional: string;
  descricao: string;
  valorServico: number;
  aliquotaIss?: number | null;
  issRetido?: boolean | null;
  codigoMunicipioPrestacao?: string | null;
}

export interface DpsPayload {
  /** Competencia da prestacao no formato AAAA-MM. */
  competencia: string;
  prestador: DpsPrestador;
  tomador: DpsTomador;
  servico: DpsServico;
  serie?: string | null;
  numero?: string | null;
  nfseId?: string | null;
  ordemServicoId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type NfseEmissaoStatus =
  | "nao_implementado"
  | "enviado"
  | "autorizado"
  | "rejeitado"
  | "erro";

export interface NfseEmissaoResult {
  ok: boolean;
  status: NfseEmissaoStatus;
  mensagem: string;
  nfseId?: string | null;
  protocolo?: string | null;
  chaveAcesso?: string | null;
  erro?: string | null;
  resposta?: unknown;
}

const MENSAGEM_MOTOR_NAO_CONECTADO =
  "Motor de emissao NFS-e (Padrao Nacional/SEFIN) ainda nao conectado. " +
  "A estrutura de DPS esta pronta; o envio sera habilitado em etapa propria, " +
  "sem dependencia da Focus NFe.";

const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function somenteDigitos(valor: string | null | undefined): string {
  return (valor || "").replace(/\D/g, "");
}

export function validarDps(dps: DpsPayload): string[] {
  const erros: string[] = [];

  if (!dps || typeof dps !== "object") {
    return ["Payload de DPS ausente ou invalido."];
  }

  if (!REGEX_COMPETENCIA.test(dps.competencia || "")) {
    erros.push("competencia deve estar no formato AAAA-MM.");
  }

  const cnpjPrestador = somenteDigitos(dps.prestador?.cnpj);
  if (cnpjPrestador.length !== 14) {
    erros.push("prestador.cnpj deve ter 14 digitos.");
  }

  if (!dps.tomador?.nome || !dps.tomador.nome.trim()) {
    erros.push("tomador.nome e obrigatorio.");
  }
  const cnpjTomador = somenteDigitos(dps.tomador?.cnpj);
  const cpfTomador = somenteDigitos(dps.tomador?.cpf);
  if (cnpjTomador.length === 0 && cpfTomador.length === 0) {
    erros.push("tomador deve informar cnpj ou cpf.");
  }

  if (!dps.servico?.codigoTributacaoNacional) {
    erros.push("servico.codigoTributacaoNacional e obrigatorio.");
  }
  if (typeof dps.servico?.valorServico !== "number" || dps.servico.valorServico <= 0) {
    erros.push("servico.valorServico deve ser maior que zero.");
  }

  return erros;
}

/**
 * Emite uma NFS-e via Padrao Nacional (SEFIN).
 * Contrato pronto; sem chamada de rede nesta etapa.
 */
export async function emitirNfsePadraoNacional(dps: DpsPayload): Promise<NfseEmissaoResult> {
  const erros = validarDps(dps);
  if (erros.length > 0) {
    return {
      ok: false,
      status: "erro",
      mensagem: "Payload de DPS invalido.",
      nfseId: dps?.nfseId ?? null,
      erro: erros.join(" | "),
    };
  }

  return {
    ok: false,
    status: "nao_implementado",
    mensagem: MENSAGEM_MOTOR_NAO_CONECTADO,
    nfseId: dps.nfseId ?? null,
    protocolo: null,
    chaveAcesso: null,
    erro: null,
  };
}

/**
 * Consulta o status de uma NFS-e no Padrao Nacional.
 * Contrato pronto; sem chamada de rede nesta etapa.
 */
export async function consultarNfsePadraoNacional(nfseId: string): Promise<NfseEmissaoResult> {
  if (!nfseId) {
    return {
      ok: false,
      status: "erro",
      mensagem: "Identificador da NFS-e nao informado.",
      nfseId: null,
      erro: "nfseId e obrigatorio.",
    };
  }

  return {
    ok: false,
    status: "nao_implementado",
    mensagem: `Consulta da NFS-e ${nfseId} ainda nao conectada ao Padrao Nacional.`,
    nfseId,
    protocolo: null,
    chaveAcesso: null,
    erro: null,
  };
}

/**
 * Cancela uma NFS-e no Padrao Nacional.
 * Contrato pronto; sem chamada de rede nesta etapa.
 */
export async function cancelarNfsePadraoNacional(
  nfseId: string,
  motivo: string
): Promise<NfseEmissaoResult> {
  if (!nfseId) {
    return {
      ok: false,
      status: "erro",
      mensagem: "Identificador da NFS-e nao informado.",
      nfseId: null,
      erro: "nfseId e obrigatorio.",
    };
  }
  if (!motivo || !motivo.trim()) {
    return {
      ok: false,
      status: "erro",
      mensagem: "Motivo do cancelamento obrigatorio.",
      nfseId,
      erro: "motivo e obrigatorio.",
    };
  }

  return {
    ok: false,
    status: "nao_implementado",
    mensagem: `Cancelamento da NFS-e ${nfseId} ainda nao conectado ao Padrao Nacional.`,
    nfseId,
    protocolo: null,
    chaveAcesso: null,
    erro: null,
  };
}
