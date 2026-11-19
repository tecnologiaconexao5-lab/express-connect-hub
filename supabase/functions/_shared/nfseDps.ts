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
  competencia: string;
  prestador: DpsPrestador;
  tomador: DpsTomador;
  servico: DpsServico;
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
  const opSimpNac = mapearOpSimpNac(empresa);
  const tpRetISSQN = dps.servico?.issRetido ? "2" : "1";
  const dCompet = `${dps.competencia}-01`;

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
    <finNFSe>0</finNFSe>
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
