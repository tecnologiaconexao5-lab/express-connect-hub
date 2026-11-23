// ===================================================================
// _shared/nfseDps.ts
//
// Gerador do XML da DPS — Padrao Nacional NFS-e (XSD v1.01).
// Copia Edge-compatible de `src/services/fiscal/nfseEmissaoService.ts`
// (mesma estrutura/tags; sem dependencia de date-fns).
//
// MANTENHA EM SINCRONIA com o gerador do frontend.
// ===================================================================

export const NAMESPACE_DPS = "http://www.sped.fazenda.gov.br/nfse";
export const VERSAO_DPS = "1.01";

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
  /** Inscricao Municipal do tomador (opcional, TSInscMun ate 15 chars). */
  inscricaoMunicipal?: string | null;
}

export interface DpsServico {
  codigoTributacaoNacional: string;
  descricao: string;
  valorServico: number;
  aliquotaIss?: number | null;
  issRetido?: boolean | null;
  codigoMunicipioPrestacao?: string | null;
  /** Código NBS (Nomenclatura Brasileira de Serviços) — ex.: 1.0501.15.00. */
  codigoNbs?: string | null;
  /** Informacoes complementares / pedido de compra (serv/infoCompl/xInfComp). */
  informacoesComplementares?: string | null;
}

export interface DpsRetencoes {
  pis?: number | null;
  cofins?: number | null;
  csll?: number | null;
  irrf?: number | null;
  inss?: number | null;
}

export interface DpsTributosAproximados {
  tipo: "valor" | "percentual";
  valor: number;
}

export interface DpsPayload {
  competencia: string;
  dataCompetencia?: string | null;
  prestador: DpsPrestador;
  tomador: DpsTomador;
  servico: DpsServico;
  retencoes?: DpsRetencoes | null;
  exigibilidadeIss?: string | null;
  tributosAproximados?: DpsTributosAproximados | null;
  serie?: string | null;
  numero?: string | null;
  nfseId?: string | null;
  ordemServicoId?: string | null;
}

export interface FiscalCompanySettings {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  inscricaoMunicipal?: string | null;
  codigoIbge?: string | null;
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
  /** Situação no Simples Nacional: 1 Não Optante, 2 MEI, 3 ME/EPP. */
  opSimpNac?: string | null;
  /** Regime de apuração do SN (1/2/3) quando opSimpNac = 3. */
  regApTribSN?: string | null;
  ambienteFiscal?: string | null;
}

const VER_APLIC = "CONEXAO-TMS-1.01";
const REGEX_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function somenteDigitos(valor: string | null | undefined): string {
  return (valor || "").replace(/\D/g, "");
}

function escaparXml(valor: string | null | undefined): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatarValorMonetario(valor: number): string {
  return valor.toFixed(2);
}

function formatarAliquota(valor: number): string {
  // TSDec1V2: "0" | "5" | "5.00"
  return valor === 0 ? "0" : valor.toFixed(2);
}

function preencherZeros(valor: string, tamanho: number): string {
  return valor.padStart(tamanho, "0");
}

/** TSDateTimeUTC: AAAA-MM-DDThh:mm:ss-03:00 (America/Sao_Paulo). */
function agoraSaoPauloDps(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const pegar = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "00";

  return `${pegar("year")}-${pegar("month")}-${pegar("day")}T${
    pegar("hour")
  }:${pegar("minute")}:${pegar("second")}-03:00`;
}

function numeroDps(dps: DpsPayload): string {
  const informado = (dps.numero || "").replace(/\D/g, "").replace(/^0+/, "");
  if (informado) return informado.slice(0, 15);

  const doNfseId = (dps.nfseId || "").replace(/\D/g, "").slice(-9).replace(
    /^0+/,
    "",
  );
  if (doNfseId) return doNfseId;

  const stamp = String(Date.now()).slice(-9).replace(/^0+/, "");
  return stamp || "1";
}

function mapearOpSimpNac(empresa: FiscalCompanySettings): "1" | "2" | "3" {
  // Override explícito do emitente (Editar Emitente) tem prioridade.
  const explicito = String(empresa.opSimpNac ?? "").trim();
  if (explicito === "1" || explicito === "2" || explicito === "3") {
    return explicito;
  }
  const texto = `${empresa.crt ?? ""} ${empresa.regimeTributario ?? ""}`
    .toLowerCase();
  if (texto.includes("mei")) return "2";
  if (texto.includes("simples") || String(empresa.crt ?? "") === "1") return "3";
  return "1";
}

/**
 * Monta o XML da DPS (nao assina/transmite).
 * Lanca Error com as pendencias quando faltam dados obrigatorios.
 */
export function gerarXmlDpsNacional(
  dps: DpsPayload,
  empresa: FiscalCompanySettings,
): string {
  if (!empresa) throw new Error("Dados da empresa (matriz) nao informados.");
  if (!dps) throw new Error("Payload de DPS nao informado.");

  const erros: string[] = [];

  const cnpjPrestador = somenteDigitos(empresa.cnpj || dps.prestador?.cnpj);
  const razaoPrestador = (empresa.razaoSocial || dps.prestador?.razaoSocial || "")
    .trim();
  const cLocEmi = somenteDigitos(
    empresa.codigoIbgeEmissao || empresa.codigoIbge,
  );

  if (cnpjPrestador.length !== 14) {
    erros.push("CNPJ do prestador/matriz invalido (14 digitos).");
  }
  if (!razaoPrestador) erros.push("razaoSocial do prestador/matriz obrigatoria.");
  if (cLocEmi.length !== 7) {
    erros.push("codigoIbge da matriz obrigatorio (7 digitos) para cLocEmi.");
  }
  // IM é STRING (TSInscMun, até 15 chars) — preserva zeros à esquerda.
  const imPrestadorValidacao = somenteDigitos(
    empresa.inscricaoMunicipal || dps.prestador?.inscricaoMunicipal,
  );
  if (imPrestadorValidacao.length > 15) {
    erros.push("inscricaoMunicipal do prestador deve ter no maximo 15 digitos.");
  }

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

  const descricaoServico = (dps.servico?.descricao || "").trim();
  const valorServico = dps.servico?.valorServico;
  if (!descricaoServico) erros.push("servico.descricao obrigatoria (xDescServ).");
  if (typeof valorServico !== "number" || !(valorServico > 0)) {
    erros.push("servico.valorServico deve ser maior que zero.");
  }

  const digitosTrib = (dps.servico?.codigoTributacaoNacional || "").replace(
    /\D/g,
    "",
  );
  let cTribNac = "";
  let cTribMun = "";
  if (digitosTrib.length < 6) {
    erros.push("servico.codigoTributacaoNacional deve ter ao menos 6 digitos.");
  } else {
    cTribNac = digitosTrib.slice(0, 6);
    if (digitosTrib.length >= 9) cTribMun = digitosTrib.slice(6, 9);
  }

  const municipioPrestacao = somenteDigitos(
    dps.servico?.codigoMunicipioPrestacao || empresa.codigoIbge || cLocEmi,
  );
  if (municipioPrestacao.length !== 7) {
    erros.push("codigo do municipio de prestacao invalido (7 digitos).");
  }

  // NBS (opcional no XSD v1.01): TSCodNBS = 9 digitos (ex.: 1.0501.15.00 -> 105011500).
  const digitosNbs = somenteDigitos(dps.servico?.codigoNbs);
  if (digitosNbs && digitosNbs.length !== 9) {
    erros.push("servico.codigoNbs deve ter 9 digitos (padrao NBS 2.0).");
  }

  if (!REGEX_COMPETENCIA.test(dps.competencia || "")) {
    erros.push("competencia deve estar no formato AAAA-MM.");
  }
  const aliquota = Number(dps.servico?.aliquotaIss ?? 0);
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 9.99) {
    erros.push("aliquotaIss deve estar entre 0 e 9.99 (TSDec1V2).");
  }

  if (erros.length > 0) throw new Error("DPS invalida: " + erros.join(" | "));

  const serieValor = ((dps.serie || "1").replace(/\D/g, "") || "1").slice(0, 5);
  const nDPS = numeroDps(dps);
  const idDps = `DPS${cLocEmi}2${cnpjPrestador}${preencherZeros(serieValor, 5)}${
    preencherZeros(nDPS, 15)
  }`;
  if (!/^DPS[0-9]{42}$/.test(idDps)) {
    throw new Error("Nao foi possivel montar o Id da DPS (DPS + 42 digitos).");
  }

  const tpAmb = String(empresa.ambienteFiscal ?? "").toLowerCase()
      .startsWith("prod")
    ? "1"
    : "2";

  // E1235: o XSD de PRODUÇÃO não possui <finNFSe> em <infDPS>
  // (sequência esperada: tpEmit? -> cLocEmi). A tag permanece apenas
  // no layout de homologação/produção restrita.
  const blocoFinNFSe = tpAmb === "2" ? `\n    <finNFSe>0</finNFSe>` : "";
  const opSimpNac = mapearOpSimpNac(empresa);
  // E0166: para optante do Simples Nacional ME/EPP (opSimpNac = 3) o
  // <regApTribSN> é obrigatório. Valor lido do emitente (1/2/3); fallback 1.
  // Posição no XSD (TCRegTrib): opSimpNac, regApTribSN?, regEspTrib.
  const regApTribSNExplicito = String(empresa.regApTribSN ?? "").trim();
  const regApTribSN = opSimpNac === "3"
    ? (["1", "2", "3"].includes(regApTribSNExplicito) ? regApTribSNExplicito : "1")
    : null;
  const blocoRegApTribSN = regApTribSN
    ? `\n        <regApTribSN>${regApTribSN}</regApTribSN>`
    : "";
  const tpRetISSQN = dps.servico?.issRetido ? "2" : "1";
  // E0625: ME/EPP no Simples (regApTribSN = 1) SEM retenção do ISSQN não deve
  // informar <pAliq> — a alíquota é apurada pelo Simples Nacional.
  const blocoPAliq = (opSimpNac === "3" && regApTribSN === "1" &&
      tpRetISSQN === "1")
    ? ""
    : `\n          <pAliq>${formatarAliquota(aliquota)}</pAliq>`;
  // E0712: ME/EPP não pode informar <indTotTrib> em <totTrib> (choice do XSD).
  // Para o Simples, usa <pTotTribSN> (percentual aproximado do Simples Nacional).
  const tributosAproximados = dps.tributosAproximados;
  const tributoValor = Number(tributosAproximados?.valor ?? 0);
  const tributoTipo = tributosAproximados?.tipo === "valor" ? "valor" : "percentual";
  const blocoTotTrib = (function() {
    if (Number.isFinite(tributoValor) && tributoValor > 0) {
      if (tributoTipo === "valor") {
        return `\n          <vTotTrib>\n            <vTotTribFed>${formatarValorMonetario(tributoValor)}</vTotTribFed>\n            <vTotTribEst>0.00</vTotTribEst>\n            <vTotTribMun>0.00</vTotTribMun>\n          </vTotTrib>`;
      }
      if (opSimpNac === "3") {
        return `\n          <pTotTribSN>${formatarValorMonetario(tributoValor)}</pTotTribSN>`;
      }
      return `\n          <pTotTrib>\n            <pTotTribFed>${formatarValorMonetario(tributoValor)}</pTotTribFed>\n            <pTotTribEst>0.00</pTotTribEst>\n            <pTotTribMun>0.00</pTotTribMun>\n          </pTotTrib>`;
    }
    return opSimpNac === "3"
      ? `\n          <pTotTribSN>0.00</pTotTribSN>`
      : `\n          <indTotTrib>0</indTotTrib>`;
  })();
  const dataCompetencia = String(dps.dataCompetencia ?? "").trim();
  const dCompet = /^\d{4}-\d{2}-\d{2}$/.test(dataCompetencia)
    ? dataCompetencia
    : `${dps.competencia}-01`;

  // ---- Retencoes federais (opcionais: somente > 0 entram no XML) ----
  const reter = function(valor: unknown): number {
    const numero = Number(valor ?? 0);
    return Number.isFinite(numero) && numero > 0
      ? Number(numero.toFixed(2))
      : 0;
  };
  const retPis = reter(dps.retencoes?.pis);
  const retCofins = reter(dps.retencoes?.cofins);
  const retCsll = reter(dps.retencoes?.csll);
  const retIrrf = reter(dps.retencoes?.irrf);
  const retInss = reter(dps.retencoes?.inss);
  const blocoPiscofins = retPis > 0 || retCofins > 0
    ? `\n        <piscofins>\n          <CST>01</CST>${
      retPis > 0
        ? `\n          <vPis>${formatarValorMonetario(retPis)}</vPis>`
        : ""
    }${
      retCofins > 0
        ? `\n          <vCofins>${formatarValorMonetario(retCofins)}</vCofins>`
        : ""
    }\n        </piscofins>`
    : "";
  const blocoTribFed = blocoPiscofins || retInss > 0 || retIrrf > 0 || retCsll > 0
    ? `\n        <tribFed>${blocoPiscofins}${
      retInss > 0
        ? `\n          <vRetCP>${formatarValorMonetario(retInss)}</vRetCP>`
        : ""
    }${
      retIrrf > 0
        ? `\n          <vRetIRRF>${formatarValorMonetario(retIrrf)}</vRetIRRF>`
        : ""
    }${
      retCsll > 0
        ? `\n          <vRetCSLL>${formatarValorMonetario(retCsll)}</vRetCSLL>`
        : ""
    }\n        </tribFed>`
    : "";

  // ---- Exigibilidade do ISSQN (padrao: tributavel) ----
  const exigibilidade = String(dps.exigibilidadeIss ?? "tributavel").toLowerCase();
  const tribISSQN = exigibilidade.includes("imun")
    ? "2"
    : exigibilidade.includes("incid")
    ? "4"
    : "1";
  const blocoTpImunidade = tribISSQN === "2"
    ? `\n          <tpImunidade>0</tpImunidade>`
    : "";

  // ---- Informacoes complementares / PO (serv/infoCompl/xInfComp) ----
  const infoComplementar = String(
    dps.servico?.informacoesComplementares ?? "",
  ).trim().slice(0, 2000);
  const blocoInfoCompl = infoComplementar
    ? `\n      <infoCompl>\n        <xInfComp>${escaparXml(infoComplementar)}</xInfComp>\n      </infoCompl>`
    : "";

  // tpEmit = "1": emitente da DPS é o próprio prestador.
  // Regras Sefin: E0121 (não informar <xNome>) e E0122 (não informar <end>)
  // dentro de <prest> quando tpEmit = 1.
  const tpEmit: string = "1";

  const cep = somenteDigitos(empresa.cep);
  let blocoEndPrestador = "";
  if (
    tpEmit !== "1" &&
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

  // E0121: quando tpEmit = "1" o <xNome> do prestador não deve ser informado
  // (o nome é o próprio emitente da DPS).
  const blocoNomePrestador = tpEmit === "1"
    ? ""
    : `\n      <xNome>${escaparXml(razaoPrestador)}</xNome>`;

  // IM como STRING (TSInscMun, ate 15 chars): SOMENTE remove separadores.
  // Nunca converter para numero — preserva zeros à esquerda (ex.: 000000060458216).
  const inscricaoMunicipalPrestador = somenteDigitos(
    empresa.inscricaoMunicipal || dps.prestador?.inscricaoMunicipal,
  );
  const blocoImPrestador = inscricaoMunicipalPrestador
    ? `\n      <IM>${escaparXml(inscricaoMunicipalPrestador)}</IM>`
    : "";
  const blocoEmailPrestador = empresa.email?.trim()
    ? `\n      <email>${escaparXml(empresa.email.trim())}</email>`
    : "";
  const documentoTomador = cnpjTomador
    ? `<CNPJ>${cnpjTomador}</CNPJ>`
    : `<CPF>${cpfTomador}</CPF>`;
  const imTomador = somenteDigitos(dps.tomador?.inscricaoMunicipal).slice(0, 15);
  const blocoImTomador = imTomador
    ? `\n      <IM>${escaparXml(imTomador)}</IM>`
    : "";
  const blocoEmailTomador = dps.tomador?.email?.trim()
    ? `\n      <email>${escaparXml(dps.tomador.email.trim())}</email>`
    : "";
  const blocoCTribMun = cTribMun
    ? `\n        <cTribMun>${cTribMun}</cTribMun>`
    : "";
  const blocoCNbs = digitosNbs
    ? `\n        <cNBS>${digitosNbs}</cNBS>`
    : "";

  // E1235: no XSD de PRODUÇÃO (v1.01) a ordem de <cServ> é
  // cTribNac -> cTribMun? -> xDescServ -> cNBS? -> cIntContrib?.
  // No layout de homologação (RTC 20261020) o cNBS vem antes do xDescServ.
  const blocoCServOrdenado = tpAmb === "2"
    ? `${blocoCNbs}\n        <xDescServ>${escaparXml(descricaoServico)}</xDescServ>`
    : `\n        <xDescServ>${escaparXml(descricaoServico)}</xDescServ>${blocoCNbs}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="${NAMESPACE_DPS}" versao="${VERSAO_DPS}">
  <infDPS Id="${idDps}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${agoraSaoPauloDps()}</dhEmi>
    <verAplic>${VER_APLIC}</verAplic>
    <serie>${serieValor}</serie>
    <nDPS>${nDPS}</nDPS>
    <dCompet>${dCompet}</dCompet>
    <tpEmit>${tpEmit}</tpEmit>${blocoFinNFSe}
    <cLocEmi>${cLocEmi}</cLocEmi>
    <prest>
      <CNPJ>${cnpjPrestador}</CNPJ>${blocoImPrestador}${blocoNomePrestador}${blocoEndPrestador}${blocoEmailPrestador}
      <regTrib>
        <opSimpNac>${opSimpNac}</opSimpNac>${blocoRegApTribSN}
        <regEspTrib>0</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${documentoTomador}${blocoImTomador}
      <xNome>${escaparXml(nomeTomador)}</xNome>${blocoEmailTomador}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${municipioPrestacao}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${cTribNac}</cTribNac>${blocoCTribMun}${blocoCServOrdenado}
      </cServ>${blocoInfoCompl}
    </serv>
    <valores>
      <vServPrest>
        <vServ>${formatarValorMonetario(valorServico as number)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${tribISSQN}</tribISSQN>${blocoTpImunidade}
          <tpRetISSQN>${tpRetISSQN}</tpRetISSQN>${blocoPAliq}
        </tribMun>${blocoTribFed}
        <totTrib>${blocoTotTrib}
        </totTrib>
      </trib>
    </valores>
  </infDPS>
</DPS>`;
}
