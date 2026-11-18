import { formatInTimeZone } from "date-fns-tz";
import { FUSO_BR } from "@/lib/formatDates";

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

/**
 * Dados da matriz (emitente) usados para montar o DPS.
 * Espelha os campos de `configuracoes_fiscais`.
 */
export interface FiscalCompanySettings {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  inscricaoMunicipal?: string | null;
  /** Codigo IBGE do municipio do emitente (7 digitos). */
  codigoIbge?: string | null;
  /** Codigo IBGE usado em cLocEmi (default: codigoIbge). */
  codigoIbgeEmissao?: string | null;
  uf?: string | null;
  cidade?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  email?: string | null;
  telefone?: string | null;
  regimeTributario?: string | null;
  crt?: string | null;
  ambienteFiscal?: string | null;
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

// ===================================================================
// DPS — PADRAO NACIONAL (SEFIN/ADN) — XSD v1.01
//
// Estrutura OFICIAL (DPS_v1.01.xsd):
//   <DPS versao="1.01">
//     <infDPS Id="DPS...">
//       <tpAmb/><dhEmi/><verAplic/><serie/><nDPS/><dCompet/><tpEmit/><cLocEmi/>
//       <prest>  → "Prestador"
//       <toma>   → "Tomador"
//       <serv>   → "Servico"
//       <valores>→ "Valores"
//     </infDPS>
//   </DPS>
//
// Observacao importante: `<GerarDpsEnvio>` NAO faz parte do XML da DPS —
// e o nome da operacao de envio na API do emissor. O documento validavel
// contra o XSD tem raiz `<DPS>` (namespace sped.fazenda.gov.br/nfse).
// ===================================================================

const NAMESPACE_DPS = "http://www.sped.fazenda.gov.br/nfse";
const VERSAO_DPS = "1.01";
const VER_APLIC = "CONEXAO-TMS-1.01"; // <= 20 chars (TSVerAplic)

function escaparXml(valor: string | null | undefined): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatarValorMonetario(valor: number): string {
  // TSDec15V2: aceita "0.00" e "1234.56"
  return valor.toFixed(2);
}

function formatarAliquota(valor: number): string {
  // TSDec1V2: "0" | "5" | "5.00" (1 digito + 2 casas)
  return valor === 0 ? "0" : valor.toFixed(2);
}

function preencherZeros(valor: string, tamanho: number): string {
  return valor.padStart(tamanho, "0");
}

function agoraSaoPauloDps(): string {
  // TSDateTimeUTC: AAAA-MM-DDThh:mm:ss-03:00
  return formatInTimeZone(new Date(), FUSO_BR, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function numeroDps(dps: DpsPayload): string {
  const informado = (dps.numero || "").replace(/\D/g, "").replace(/^0+/, "");
  if (informado) return informado.slice(0, 15);

  const doNfseId = (dps.nfseId || "").replace(/\D/g, "").slice(-9).replace(/^0+/, "");
  if (doNfseId) return doNfseId;

  const stamp = String(Date.now()).slice(-9).replace(/^0+/, "");
  return stamp || "1";
}

function mapearOpSimpNac(empresa: FiscalCompanySettings): "1" | "2" | "3" {
  const texto = `${empresa.crt ?? ""} ${empresa.regimeTributario ?? ""}`.toLowerCase();
  if (texto.includes("mei")) return "2"; // Optante - MEI
  if (texto.includes("simples") || String(empresa.crt ?? "") === "1") return "3"; // Optante - ME/EPP
  return "1"; // Nao optante
}

/**
 * Monta o XML da DPS no padrao do Sistema Nacional NFS-e (XSD v1.01).
 * Nao assina e nao transmite — apenas gera a string validavel.
 *
 * Lanca Error com as pendencias quando faltam dados obrigatorios.
 */
export function gerarXmlDpsNacional(
  dps: DpsPayload,
  empresa: FiscalCompanySettings,
): string {
  if (!empresa) throw new Error("Dados da empresa (matriz) nao informados.");
  if (!dps) throw new Error("Payload de DPS nao informado.");

  const erros: string[] = [];

  // ---- Prestador / matriz ----
  const cnpjPrestador = somenteDigitos(empresa.cnpj || dps.prestador?.cnpj);
  const razaoPrestador = (empresa.razaoSocial || dps.prestador?.razaoSocial || "").trim();
  const cLocEmi = somenteDigitos(empresa.codigoIbgeEmissao || empresa.codigoIbge);

  if (cnpjPrestador.length !== 14) {
    erros.push("CNPJ do prestador/matriz invalido (14 digitos).");
  }
  if (!razaoPrestador) {
    erros.push("razaoSocial do prestador/matriz obrigatoria.");
  }
  if (cLocEmi.length !== 7) {
    erros.push("codigoIbge da matriz obrigatorio (7 digitos) para cLocEmi.");
  }

  // ---- Tomador ----
  const nomeTomador = (dps.tomador?.nome || "").trim();
  const cnpjTomador = somenteDigitos(dps.tomador?.cnpj);
  const cpfTomador = somenteDigitos(dps.tomador?.cpf);
  if (!nomeTomador) erros.push("tomador.nome obrigatorio.");
  if (!cnpjTomador && !cpfTomador) {
    erros.push("tomador deve informar CNPJ ou CPF.");
  }
  if (cnpjTomador && cnpjTomador.length !== 14) {
    erros.push("CNPJ do tomador invalido (14 digitos).");
  }
  if (!cnpjTomador && cpfTomador && cpfTomador.length !== 11) {
    erros.push("CPF do tomador invalido (11 digitos).");
  }

  // ---- Servico ----
  const descricaoServico = (dps.servico?.descricao || "").trim();
  const valorServico = dps.servico?.valorServico;
  if (!descricaoServico) erros.push("servico.descricao obrigatoria (xDescServ).");
  if (typeof valorServico !== "number" || !(valorServico > 0)) {
    erros.push("servico.valorServico deve ser maior que zero.");
  }

  const digitosTrib = (dps.servico?.codigoTributacaoNacional || "").replace(/\D/g, "");
  let cTribNac = "";
  let cTribMun = "";
  if (digitosTrib.length < 6) {
    erros.push("servico.codigoTributacaoNacional deve ter ao menos 6 digitos.");
  } else {
    // "16.02.01.002" -> cTribNac "160201" + cTribMun "002"
    cTribNac = digitosTrib.slice(0, 6);
    if (digitosTrib.length >= 9) cTribMun = digitosTrib.slice(6, 9);
  }

  const municipioPrestacao = somenteDigitos(
    dps.servico?.codigoMunicipioPrestacao || empresa.codigoIbge || cLocEmi,
  );
  if (municipioPrestacao.length !== 7) {
    erros.push("codigo do municipio de prestacao invalido (7 digitos).");
  }

  // ---- Competencia / aliquota ----
  if (!REGEX_COMPETENCIA.test(dps.competencia || "")) {
    erros.push("competencia deve estar no formato AAAA-MM.");
  }
  const aliquota = Number(dps.servico?.aliquotaIss ?? 0);
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 9.99) {
    erros.push("aliquotaIss deve estar entre 0 e 9.99 (TSDec1V2).");
  }

  if (erros.length > 0) {
    throw new Error("DPS invalida: " + erros.join(" | "));
  }

  // ---- Identificadores ----
  const serieValor = ((dps.serie || "1").replace(/\D/g, "") || "1").slice(0, 5);
  const nDPS = numeroDps(dps);
  const idDps = `DPS${cLocEmi}2${cnpjPrestador}${preencherZeros(serieValor, 5)}${
    preencherZeros(nDPS, 15)
  }`;
  if (!/^DPS[0-9]{42}$/.test(idDps)) {
    throw new Error("Nao foi possivel montar o Id da DPS (DPS + 42 digitos).");
  }

  const tpAmb = String(empresa.ambienteFiscal ?? "").toLowerCase().startsWith("prod")
    ? "1"
    : "2";
  const opSimpNac = mapearOpSimpNac(empresa);
  const tpRetISSQN = dps.servico?.issRetido ? "2" : "1";
  const dCompet = `${dps.competencia}-01`;

  // ---- Endereco do prestador (opcional no XSD; exige endNac completo) ----
  const cep = somenteDigitos(empresa.cep);
  let blocoEndPrestador = "";
  if (
    cLocEmi.length === 7 &&
    cep.length === 8 &&
    empresa.logradouro &&
    empresa.numero &&
    empresa.bairro
  ) {
    blocoEndPrestador = `
      <end>
        <endNac>
          <cMun>${cLocEmi}</cMun>
          <CEP>${cep}</CEP>
        </endNac>
        <xLgr>${escaparXml(empresa.logradouro)}</xLgr>
        <nro>${escaparXml(empresa.numero)}</nro>${
      empresa.complemento
        ? `\n        <xCpl>${escaparXml(empresa.complemento)}</xCpl>`
        : ""
    }
        <xBairro>${escaparXml(empresa.bairro)}</xBairro>
      </end>`;
  }

  const blocoImPrestador = empresa.inscricaoMunicipal?.trim()
    ? `\n      <IM>${escaparXml(empresa.inscricaoMunicipal.trim())}</IM>`
    : "";
  const blocoEmailPrestador = empresa.email?.trim()
    ? `\n      <email>${escaparXml(empresa.email.trim())}</email>`
    : "";
  const documentoTomador = cnpjTomador
    ? `<CNPJ>${cnpjTomador}</CNPJ>`
    : `<CPF>${cpfTomador}</CPF>`;
  const blocoEmailTomador = dps.tomador?.email?.trim()
    ? `\n      <email>${escaparXml(dps.tomador.email.trim())}</email>`
    : "";
  const blocoCTribMun = cTribMun
    ? `\n        <cTribMun>${cTribMun}</cTribMun>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${NAMESPACE_DPS}" versao="${VERSAO_DPS}">
  <infDPS Id="${idDps}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${agoraSaoPauloDps()}</dhEmi>
    <verAplic>${VER_APLIC}</verAplic>
    <serie>${serieValor}</serie>
    <nDPS>${nDPS}</nDPS>
    <dCompet>${dCompet}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${cLocEmi}</cLocEmi>
    <prest>
      <CNPJ>${cnpjPrestador}</CNPJ>${blocoImPrestador}
      <xNome>${escaparXml(razaoPrestador)}</xNome>${blocoEndPrestador}${blocoEmailPrestador}
      <regTrib>
        <opSimpNac>${opSimpNac}</opSimpNac>
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${documentoTomador}
      <xNome>${escaparXml(nomeTomador)}</xNome>${blocoEmailTomador}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${municipioPrestacao}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${cTribNac}</cTribNac>${blocoCTribMun}
        <xDescServ>${escaparXml(descricaoServico)}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${formatarValorMonetario(valorServico as number)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>1</tribISSQN>
          <tpRetISSQN>${tpRetISSQN}</tpRetISSQN>
          <pAliq>${formatarAliquota(aliquota)}</pAliq>
        </tribMun>
        <totTrib>
          <indTotTrib>0</indTotTrib>
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}
