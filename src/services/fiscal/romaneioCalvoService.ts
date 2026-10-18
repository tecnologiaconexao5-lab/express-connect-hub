import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/lib/supabase";
import type { EnderecoRealEntrega, FiscalDocumentoVinculado } from "@/types/fiscal";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export interface RomaneioCalvoItem {
  numero_romaneio?: string | null;
  numero_nfe?: string | null;
  chave_nfe?: string | null;
  cnpj_destinatario?: string | null;
  nome_destinatario?: string | null;
  endereco_fiscal?: EnderecoRealEntrega | null;
  endereco_real_entrega?: EnderecoRealEntrega | null;
  municipio_entrega?: string | null;
  uf_entrega?: string | null;
  bairro_entrega?: string | null;
  cep_entrega?: string | null;
  peso?: string | null;
  caixas?: string | null;
  rateio?: string | null;
  valor_nota?: string | null;
  linha_original?: string;
  endereco_suspeito?: boolean;
  pendente_conferencia_endereco?: boolean;
  endereco_validacao_motivos?: string[];
}

export interface CruzamentoResultado {
  item: RomaneioCalvoItem;
  docVinculado: FiscalDocumentoVinculado | null;
  cruzou: boolean;
  motivo_falha?: string;
  endereco_ok?: boolean;
  endereco_pendente?: boolean;
  pronto_para_cte?: boolean;
}

export interface ProcessamentoRomaneioResult {
  total_itens: number;
  cruzaram: number;
  pendentes: number;
  enderecos_ok: number;
  enderecos_pendentes: number;
  prontos_para_cte: number;
  resultados: CruzamentoResultado[];
  debug?: {
    texto_extraido_caracteres: number;
    texto_previa: string;
    layout_detectado: string;
    nfs_detectadas: number;
    chaves_detectadas: number;
    itens_extraidos: number;
    erros: string[];
    avisos: string[];
    parser_usado?: string;
    linhas_reconstruidas?: { y: number; textoLinha: string }[];
    colunas_detectadas?: { nome: string; xMin: number; xMax: number }[];
  };
}

function limparCnpj(val: string): string {
  return val.replace(/\D/g, "");
}

function limparNumeroNfe(val: string): string {
  return val.replace(/\D/g, "");
}

function extrairEnderecoRealDoBloco(bloco: string): EnderecoRealEntrega | null {
  if (!bloco) return null;

  const cepMatch = bloco.match(/(\d{5}-?\d{3})/);
  const cep = cepMatch ? cepMatch[1] : null;

  const ufs = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";
  const ufMatch = bloco.match(new RegExp(`\\b(${ufs})\\b`, "gi"));
  const uf = ufMatch ? ufMatch[ufMatch.length - 1].toUpperCase() : null;

  const hasUfAfterSlash = bloco.match(/\/(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  const municipioMatch = hasUfAfterSlash
    ? bloco.match(/([^,\/]+?)\s*\/\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/)
    : bloco.match(/([^,\/]+?)\s*[-]\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s*$/i);

  let municipio = municipioMatch ? municipioMatch[1].trim() : null;

  if (!municipio && uf) {
    const muniMatch = bloco.match(/(?:municipio|Município|MUNICIPIO)[:\s]*([^\n,;]+)/i);
    if (muniMatch) municipio = muniMatch[1].trim();
  }

  const bairroMatch = bloco.match(/(?:bairro|Bairro|BAIRRO)[:\s]*([^\n,;]+)/i);
  const bairro = bairroMatch ? bairroMatch[1].trim() : null;

  const logradouroMatch = bloco.match(
    /(?:RUA|Rua|rua|AVENIDA|Avenida|avenida|AV\.?|Av\.?|ESTRADA|Estrada|RODOVIA|Rodovia|TRAVESSA|Travessa|PRACA|Praça)\s+([A-ZÀ-Ú][A-ZÀ-Ú\s\.]+?)(?:\s*,?\s*(?:\d+|S\/N|SN|s\/n))?/i
  );
  let logradouro = logradouroMatch ? logradouroMatch[0].trim() : null;

  if (!logradouro) {
    const primeiraLinha = bloco.split(/[\n\r]+/)[0]?.trim();
    if (primeiraLinha && /^[A-ZÀ-Ú]/.test(primeiraLinha) && primeiraLinha.length > 5) {
      logradouro = primeiraLinha;
    }
  }

  const numeroMatch = bloco.match(/(?:,?\s*(?:nº?|Nº?|Numero|numero|NUMERO|nro|Nro|NRO)\.?\s*)?(\d+)\s*(?:,|-|\s|$)/);
  const numero = numeroMatch ? numeroMatch[1] : null;

  if (!municipio && !logradouro && !cep && !bairro) return null;

  return {
    logradouro: logradouro || null,
    numero: numero || null,
    complemento: null,
    bairro: bairro || null,
    municipio: municipio || null,
    uf: uf || null,
    cep: cep || null,
    codigo_ibge: null,
  };
}

export function parseRomaneioCalvoFromText(texto: string): RomaneioCalvoItem[] {
  const itens: RomaneioCalvoItem[] = [];
  if (!texto || !texto.trim()) return itens;

  const linhas = texto.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let numeroRomaneioGlobal: string | null = null;
  let itemAtual: Partial<RomaneioCalvoItem> = {};
  let blocoAtual = "";
  let modoEnderecoReal = false;

  for (const linha of linhas) {
    const romaneioMatch = linha.match(/(?:ROMANEIO|Romaneio|romaneio)\s*(?:DE\s*(?:ENTREGA|Entrega|entrega|CARGA|Carga|carga))?\s*(?:N[º°]?|n[º°]?|Numero|numero|NUMERO)?\s*[:#]?\s*(\d+)/i);
    if (romaneioMatch && !numeroRomaneioGlobal) {
      numeroRomaneioGlobal = romaneioMatch[1];
    }

    const nfeMatch =
      linha.match(/(?:NF-?[eE]|NFE|Nota\s*Fiscal)\s*(?:N[º°]?|n[º°]?|Numero|numero|NUMERO)?\s*[:#]?\s*(\d+)/i) ||
      linha.match(/(?:N\.?F\.?|nf)\s*[:#]?\s*(\d{7})/i);
    if (nfeMatch) {
      if (blocoAtual && Object.keys(itemAtual).length > 0) {
        finalizarItem(itemAtual, blocoAtual, itens, numeroRomaneioGlobal);
      }
      itemAtual = { numero_nfe: nfeMatch[1] };
      blocoAtual = linha + "\n";
      modoEnderecoReal = false;
      continue;
    }

    // Detectar NF-e por numero de 7 digitos sem label (formato tabela)
    const nfNumeroSolto = linha.match(/^\s*(\d{7})\b/);
    if (nfNumeroSolto && !itemAtual.numero_nfe && !/romaneio|cnpj|data|pagina/i.test(linha)) {
      if (blocoAtual && Object.keys(itemAtual).length > 0) {
        finalizarItem(itemAtual, blocoAtual, itens, numeroRomaneioGlobal);
      }
      itemAtual = { numero_nfe: nfNumeroSolto[1] };
      blocoAtual = linha + "\n";
      modoEnderecoReal = false;
      continue;
    }

    const chaveMatch = linha.match(/(\d{44})/);
    if (chaveMatch && Object.keys(itemAtual).length > 0) {
      itemAtual.chave_nfe = chaveMatch[1];
    }

    const cnpjMatch = linha.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
    if (cnpjMatch && !itemAtual.cnpj_destinatario) {
      itemAtual.cnpj_destinatario = cnpjMatch[1];
    }

    if (/(?:DESTINAT[ÁA]RIO|Destinat[aá]rio|CLIENTE|Cliente|RAZ[ÃA]O\s*SOCIAL|Raz[aã]o\s*Social)/i.test(linha)) {
      const nomeMatch = linha.match(/(?:DESTINAT[ÁA]RIO|Destinat[aá]rio|CLIENTE|Cliente|RAZ[ÃA]O\s*SOCIAL|Raz[aã]o\s*Social)\s*[:#]?\s*(.+)/i);
      if (nomeMatch) {
        itemAtual.nome_destinatario = nomeMatch[1].trim();
      }
    }

    if (/(?:ENTREGA\s*REAL|Entrega\s*Real|ENDERE[ÇC]O\s*(?:DE\s*)?ENTREGA|Endere[cç]o\s*(?:de\s*)?Entrega|LOCAL\s*(?:DE\s*)?ENTREGA|Local\s*(?:de\s*)?Entrega)/i.test(linha)) {
      modoEnderecoReal = true;
      blocoAtual += linha + "\n";
      continue;
    }

    if (modoEnderecoReal && /^\s*$/.test(linha)) {
      modoEnderecoReal = false;
      blocoAtual += linha + "\n";
      continue;
    }

    if (modoEnderecoReal || /(?:FISCAL|Fiscal|FATURAMENTO|Faturamento)/i.test(linha)) {
      blocoAtual += linha + "\n";
      continue;
    }

    if (/(?:PESO|Peso|peso)\s*[:#]?\s*(\d+[.,]?\d*)\s*(?:KG|Kg|kg)?/i.test(linha)) {
      const pesoMatch = linha.match(/(\d+[.,]?\d*)\s*(?:KG|Kg|kg)?/i);
      if (pesoMatch) itemAtual.peso = pesoMatch[1];
    }

    if (/(?:CAIXAS|Caixas|caixas|VOLUMES|Volumes|volumes|EMBALAGENS|Embalagens|embalagens)\s*[:#]?\s*(\d+)/i.test(linha)) {
      const caixaMatch = linha.match(/(\d+)/);
      if (caixaMatch) itemAtual.caixas = caixaMatch[1];
    }

    if (/(?:RATEIO|Rateio|rateio|FRETE\s*(?:RATEADO|Rateado)|PESO\s*(?:RATEADO|Rateado))/i.test(linha)) {
      const rateioMatch = linha.match(/[:#]?\s*(.+)/);
      if (rateioMatch) itemAtual.rateio = rateioMatch[1].trim();
    }

    blocoAtual += linha + "\n";

    if (blocoAtual.length > 0) {
      itemAtual.linha_original = blocoAtual;
    }
  }

  if (blocoAtual && Object.keys(itemAtual).length > 0) {
    finalizarItem(itemAtual, blocoAtual, itens, numeroRomaneioGlobal);
  }

  return itens;
}

function parseRomaneioCalvoPorBlocos(texto: string): RomaneioCalvoItem[] {
  const itens: RomaneioCalvoItem[] = [];
  const textoLimpo = texto.replace(/\s+/g, " ").trim();
  if (!textoLimpo) return itens;

  // Encontrar todas as posicoes de NF-e (7 digitos)
  const nfeMatches = [...textoLimpo.matchAll(/\b(\d{7})\b/g)];
  if (nfeMatches.length === 0) return itens;

  // Encontrar numero do romaneio (6 digitos perto do inicio)
  let numeroRomaneio: string | null = null;
  const romaneioMatch = textoLimpo.match(/romaneio\s*(\d{6})/i) || textoLimpo.match(/\b(\d{6})\s+\d{7}\b/);
  if (romaneioMatch) numeroRomaneio = romaneioMatch[1];

  // Encontrar chaves de NF-e (44 digitos comecando com 35)
  const todasChaves = [...textoLimpo.matchAll(/\b(35\d{42})\b/g)].map((m) => m[1]);

  for (let i = 0; i < nfeMatches.length; i++) {
    const nfeNum = nfeMatches[i][1];
    const nfeIdx = nfeMatches[i].index!;

    // Determinar fim do bloco (proxima NF-e ou fim do texto)
    const proxIdx = i + 1 < nfeMatches.length ? nfeMatches[i + 1].index! : textoLimpo.length;
    let bloco = textoLimpo.substring(nfeIdx, proxIdx).trim();

    // Incluir contexto antes da NF-e (romaneio number)
    if (i === 0 && nfeIdx > 0) {
      const antes = textoLimpo.substring(0, nfeIdx).trim();
      const ultimaLinhaAntes = antes.split(/\s+/).slice(-3).join(" ");
      bloco = ultimaLinhaAntes + " " + bloco;
    }

    // Extrair chave do bloco
    const chaveMatch = bloco.match(/\b(35\d{42})\b/);
    const chaveNfe = chaveMatch ? chaveMatch[1] : (todasChaves.find((c) => c.includes(nfeNum)) || null);

    // Extrair CNPJ (14 digitos, formatado ou nao)
    const cnpjMatch = bloco.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || bloco.match(/\b(\d{14})\b/);
    const cnpj = cnpjMatch ? cnpjMatch[1] : null;

    // Extrair caixas, peso, valor — numeros decimais no inicio do bloco
    const numerosDecimais = [...bloco.matchAll(/(\d+[.,]\d+)/g)].map((m) => m[1].replace(",", "."));
    let caixas: string | null = null;
    let peso: string | null = null;
    let valorNota: string | null = null;
    let rateio: string | null = null;

    // Tentar extrair pela ordem: caixas (inteiro pequeno), peso, vl.nota, rateio
    const numerosInteiros = [...bloco.matchAll(/\b(\d{1,3})\b/g)].map((m) => parseInt(m[1]));
    if (numerosInteiros.length > 0) {
      // Primeiro numero inteiro pequeno perto do inicio = caixas
      const idxInicio = bloco.indexOf(nfeNum);
      const antesDaNfe = bloco.substring(0, idxInicio).trim();
      const caixasMatch = antesDaNfe.match(/\b(\d{1,3})\b/);
      if (caixasMatch) caixas = caixasMatch[1];
    }

    if (numerosDecimais.length >= 1) peso = numerosDecimais[0];
    if (numerosDecimais.length >= 2) valorNota = numerosDecimais[1];
    if (numerosDecimais.length >= 3) rateio = numerosDecimais[2];

    // Extrair endereco — procurar padroes de logradouro
    const enderecoReal = extrairEnderecoDoBlocoCorrido(bloco);
    const nomeDest = extrairNomeDestinatarioDoBloco(bloco);

    const item: RomaneioCalvoItem = {
      numero_romaneio: numeroRomaneio,
      numero_nfe: nfeNum,
      chave_nfe: chaveNfe,
      cnpj_destinatario: cnpj,
      nome_destinatario: nomeDest,
      endereco_real_entrega: enderecoReal,
      municipio_entrega: enderecoReal?.municipio || null,
      uf_entrega: enderecoReal?.uf || null,
      bairro_entrega: enderecoReal?.bairro || null,
      cep_entrega: enderecoReal?.cep || null,
      peso,
      caixas,
      rateio,
      linha_original: bloco.substring(0, 500),
    };

    itens.push(item);
  }

  return itens;
}

// Municipios conhecidos do layout Calvo (SP)
const MUNICIPIOS_CALVO = [
  "GUARULHOS", "JACAREI", "SANTA ISABEL", "SAO PAULO",
  "SAO BERNARDO DO CAMPO", "MOGI DAS CRUZES", "SUZANO",
  "ARUJA", "ITAQUAQUECETUBA", "POA", "FERRAZ DE VASCONCELOS",
  "CUBATAO", "SANTOS", "SAO VICENTE", "GUARUJA", "PRAIA GRANDE",
  "CAMPINAS", "JUNDIAI", "SOROCABA", "SAO JOSE DOS CAMPOS",
  "TAUBATE", "CAIEIRAS", "FRANCO DA ROCHA", "MAIRIPORA",
];

function montarEnderecoEntregaCalvo(linhasEntrega: string[]): {
  endereco: EnderecoRealEntrega | null;
  enderecoCompleto: string | null;
  nomeDestinatario: string | null;
} {
  if (!linhasEntrega || linhasEntrega.length === 0) {
    return { endereco: null, enderecoCompleto: null, nomeDestinatario: null };
  }

  let logradouroCompleto = "";
  let numero = "";
  let bairro = "";
  let municipio = "";
  let cep = "";
  const uf = "SP";

  // Linha 1: logradouro + numero
  if (linhasEntrega.length >= 1) {
    logradouroCompleto = linhasEntrega[0].trim();

    // Extrair numero do final da linha 1
    const numMatch = logradouroCompleto.match(/[,.\s]+(\d+|S\/N|SN|s\/n)\s*$/i);
    if (numMatch) {
      numero = numMatch[1].toUpperCase() === "S/N" || numMatch[1].toUpperCase() === "SN"
        ? "S/N"
        : numMatch[1];
      logradouroCompleto = logradouroCompleto.substring(0, numMatch.index).trim().replace(/[,.\s]+$/, "").trim();
    }
  }

  // Linha 2: bairro + municipio + CEP
  if (linhasEntrega.length >= 2) {
    const linha2 = linhasEntrega[1].trim();

    // Extrair CEP (ultimo numero de 8 digitos ou 5-3)
    const cepMatch = linha2.match(/\b(\d{5}-?\d{3})\b/);
    if (cepMatch) {
      cep = cepMatch[1].replace(/\D/g, "");
      // Verificar se o CEP tem 8 digitos, senao completar
      if (cep.length === 7) cep = cep; // manter como esta
    }

    // Remover CEP da linha para facilitar parse
    let restante = linha2.replace(/\b\d{5}-?\d{3}\b/, "").trim().replace(/\s+/g, " ");

    // Tentar encontrar municipio conhecido no restante
    municipio = "";
    bairro = "";

    // Ordenar municipios por tamanho decrescente (para match de compostos primeiro)
    const municipiosOrdenados = [...MUNICIPIOS_CALVO].sort((a, b) => b.length - a.length);

    for (const mun of municipiosOrdenados) {
      // Procurar municipio como palavra(s) no final do restante
      const regex = new RegExp(`\\b${mun.replace(/\s+/g, "\\s+")}\\s*$`, "i");
      const match = restante.match(regex);
      if (match) {
        municipio = mun;
        bairro = restante.substring(0, match.index).trim();
        break;
      }
    }

    // Fallback: se nao encontrou municipio conhecido, usar ultima(s) palavra(s)
    if (!municipio) {
      const palavras = restante.split(/\s+/);
      if (palavras.length >= 2) {
        // Assumir ultimas 2 palavras como municipio (comum: SAO PAULO, SANTA ISABEL)
        const ultimas2 = palavras.slice(-2).join(" ");
        const ultimas1 = palavras.slice(-1).join(" ");
        // Verificar qual match e mais provavel
        if (MUNICIPIOS_CALVO.some((m) => m.includes(ultimas2))) {
          municipio = ultimas2;
          bairro = palavras.slice(0, -2).join(" ");
        } else if (MUNICIPIOS_CALVO.some((m) => m.includes(ultimas1))) {
          municipio = ultimas1;
          bairro = palavras.slice(0, -1).join(" ");
        } else {
          municipio = ultimas1; // fallback: ultima palavra
          bairro = palavras.slice(0, -1).join(" ");
        }
      } else if (palavras.length === 1) {
        municipio = palavras[0];
        bairro = "";
      }
    }
  } else if (linhasEntrega.length === 1) {
    // So tem 1 linha: tentar extrair tudo dela (CEP e municipio do final)
    const linha1 = linhasEntrega[0].trim();
    const cepMatch = linha1.match(/\b(\d{5}-?\d{3})\b/);
    if (cepMatch) {
      cep = cepMatch[1].replace(/\D/g, "");
      const antesCep = linha1.substring(0, cepMatch.index).trim();
      // Tentar achar municipio
      for (const mun of MUNICIPIOS_CALVO.sort((a, b) => b.length - a.length)) {
        const regex = new RegExp(`\\b${mun.replace(/\s+/g, "\\s+")}\\s*$`, "i");
        const match = antesCep.match(regex);
        if (match) {
          municipio = mun;
          bairro = antesCep.substring(0, match.index).trim();
          break;
        }
      }
    }
  }

  // Normalizar: remover caracteres estranhos
  bairro = bairro.replace(/[-–—]\s*$/, "").trim();
  logradouroCompleto = logradouroCompleto.replace(/\s+/g, " ").trim();

  // Construir endereco completo formatado
  const partesEndereco = [
    logradouroCompleto,
    numero ? `, ${numero}` : "",
  ];
  if (bairro) partesEndereco.push(` - ${bairro}`);
  if (municipio) partesEndereco.push(` - ${municipio}/${uf}`);
  if (cep) partesEndereco.push(` - CEP ${cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`);
  const enderecoCompleto = partesEndereco.join("");

  // Validar: se nao tem logradouro nem municipio, retornar null
  if (!logradouroCompleto && !municipio && !cep) {
    return { endereco: null, enderecoCompleto: null, nomeDestinatario: null };
  }

  // Se logradouro muito curto e parece UF/CEP, marcar como invalido
  if (logradouroCompleto.length < 8 && cep) {
    // Provavelmente extraiu fragmento — usar fallback
  }

  // Detectar se o logradouro parece nome de empresa (tudo maiusculo, sem tipo de via)
  let nomeDest: string | null = null;
  if (logradouroCompleto && /^[A-ZÀ-Ú\s]{8,}$/.test(logradouroCompleto) &&
      !/^(AV|RUA|ALAMEDA|ESTRADA|RODOVIA|TRAVESSA|PRACA|PRAÇA|R\.|AV\.)/i.test(logradouroCompleto)) {
    // Parece nome de empresa, nao logradouro — mover para nomeDest
    nomeDest = logradouroCompleto;
    logradouroCompleto = "";
  }

  return {
    endereco: {
      logradouro: logradouroCompleto || null,
      numero: numero || null,
      complemento: null,
      bairro: bairro || null,
      municipio: municipio || null,
      uf: uf,
      cep: cep || null,
      codigo_ibge: null,
    },
    enderecoCompleto: enderecoCompleto || null,
    nomeDestinatario: nomeDest,
  };
}

export function parseEnderecoParaFormulario(enderecoTexto: string): {
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
} {
  const resultado = {
    logradouro: "",
    numero: "",
    bairro: "",
    municipio: "",
    uf: "SP",
    cep: "",
  };

  if (!enderecoTexto || enderecoTexto.trim().length < 10) return resultado;

  const texto = enderecoTexto.trim();

  // 1. Extrair CEP (ultimo numero de 8 digitos, com ou sem traco)
  const cepMatch = texto.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) {
    resultado.cep = cepMatch[1].replace(/\D/g, "");
  }

  // 2. Extrair UF (2 letras maiusculas, preferencialmente apos "/")
  const ufSlashMatch = texto.match(/\/([A-Z]{2})\b/i);
  if (ufSlashMatch) {
    resultado.uf = ufSlashMatch[1].toUpperCase();
  } else {
    // Buscar UF no final antes do CEP
    const ufCepMatch = texto.match(/\b([A-Z]{2})\s+\d{5}-?\d{3}\b/i);
    if (ufCepMatch) {
      resultado.uf = ufCepMatch[1].toUpperCase();
    }
  }

  // Se UF encontrada for invalida (tem lixo como "79€"), usar SP
  if (!/^[A-Z]{2}$/.test(resultado.uf)) {
    resultado.uf = "SP";
  }

  // 3. Extrair municipio (usando lista conhecida, buscando antes de /UF ou CEP)
  let restante = texto
    .replace(/\b\d{5}-?\d{3}\b/, "")   // remove CEP
    .replace(/CEP\s*/i, "")              // remove "CEP" label
    .replace(/\/[A-Z]{2}\b/i, "")        // remove /UF
    .trim()
    .replace(/\s+/g, " ");

  // Ordenar municipios por tamanho decrescente
  const municipiosOrdenados = [...MUNICIPIOS_CALVO].sort((a, b) => b.length - a.length);

  for (const mun of municipiosOrdenados) {
    const regex = new RegExp(`\\b${mun.replace(/\s+/g, "\\s+")}\\s*$`, "i");
    const match = restante.match(regex);
    if (match) {
      resultado.municipio = mun;
      restante = restante.substring(0, match.index).trim();
      break;
    }
  }

  // Fallback: se nao encontrou na lista, pegar ultimas palavras
  if (!resultado.municipio && restante) {
    const palavras = restante.split(/\s+/);
    // Tentar ultimas 2 palavras (municipios compostos)
    if (palavras.length >= 2) {
      const ult2 = palavras.slice(-2).join(" ");
      if (ult2.length >= 5) {
        resultado.municipio = ult2;
        restante = palavras.slice(0, -2).join(" ");
      } else {
        resultado.municipio = palavras[palavras.length - 1];
        restante = palavras.slice(0, -1).join(" ");
      }
    } else if (palavras.length === 1) {
      resultado.municipio = palavras[0];
      restante = "";
    }
  }

  // Municipio nao pode ser "SP"
  if (resultado.municipio.toUpperCase() === "SP") {
    resultado.municipio = "";
  }

  // 4. Extrair bairro do restante (apos remover municipio)
  resultado.bairro = restante.replace(/[,.\s]+$/, "").trim();

  // 5. Extrair logradouro e numero do bairro (se o bairro contiver o logradouro também)
  // Se o bairro tem virgula seguida de numero, provavelmente inclui o logradouro
  const bairroParts = resultado.bairro.split(/,\s*/);
  if (bairroParts.length >= 2) {
    // A primeira parte pode conter logradouro + numero
    const primeiraParte = bairroParts[0].trim();
    const numMatch = primeiraParte.match(/\s+(\d+|S\/N|SN|s\/n)\s*$/i);
    if (numMatch) {
      resultado.logradouro = primeiraParte.substring(0, numMatch.index).trim();
      resultado.numero = numMatch[1].toUpperCase() === "S/N" || numMatch[1].toUpperCase() === "SN"
        ? "S/N" : numMatch[1];
      resultado.bairro = bairroParts.slice(1).join(", ").trim();
    } else {
      // Sem numero claro, usar a primeira parte como logradouro
      resultado.logradouro = primeiraParte;
      resultado.bairro = bairroParts.slice(1).join(", ").trim();
    }
  } else {
    // So tem uma parte: tentar extrair numero do final
    const numMatch = resultado.bairro.match(/\s+(\d+|S\/N|SN|s\/n)\s*$/i);
    if (numMatch) {
      resultado.logradouro = resultado.bairro.substring(0, numMatch.index).trim();
      resultado.numero = numMatch[1].toUpperCase() === "S/N" || numMatch[1].toUpperCase() === "SN"
        ? "S/N" : numMatch[1];
      resultado.bairro = "";
    } else if (resultado.bairro.length > 3) {
      // Tudo e logradouro se parece com tipo de via
      if (/^(AV|RUA|ALAMEDA|ESTRADA|RODOVIA|TRAVESSA|PRACA|PRAÇA|R\.|AV\.)/i.test(resultado.bairro)) {
        resultado.logradouro = resultado.bairro;
        resultado.bairro = "";
      }
    }
  }

  // 6. Validacao e limpeza final
  resultado.logradouro = resultado.logradouro.replace(/\s+/g, " ").trim();
  resultado.bairro = resultado.bairro.replace(/\s+/g, " ").trim();
  resultado.municipio = resultado.municipio.replace(/\s+/g, " ").trim();

  // UF so 2 letras
  if (!/^[A-Z]{2}$/.test(resultado.uf)) resultado.uf = "SP";

  // Municipio nao pode ser igual a UF
  if (resultado.municipio.toUpperCase() === resultado.uf.toUpperCase() && resultado.municipio.length <= 2) {
    resultado.municipio = "";
  }

  // Se logradouro muito curto (< 5 chars), limpar
  if (resultado.logradouro.length < 5) resultado.logradouro = "";

  return resultado;
}

function extrairEnderecoDoBlocoCorrido(bloco: string): EnderecoRealEntrega | null {
  // Procurar por padroes de logradouro
  const padroesLogradouro = [
    /(?:AV\.?|AVENIDA|RUA|R\.|ALAMEDA|ESTRADA|ROD\.?|RODOVIA|TRAVESSA|PRACA|PRAÇA)\s+([A-ZÀ-Ú][A-ZÀ-Ú\s\.]+?)(?:\s*,?\s*\d+)?/gi,
  ];

  let logradouroCompleto: string | null = null;
  for (const padrao of padroesLogradouro) {
    const m = bloco.match(padrao);
    if (m) {
      // Pegar o ultimo match (provavelmente endereco de entrega)
      const todos = [...bloco.matchAll(new RegExp(padrao.source, "gi"))];
      if (todos.length > 0) {
        logradouroCompleto = todos[todos.length - 1][0].trim();
        break;
      }
    }
  }

  // UF: procurar por padrao "MUNICIPIO UF" ou "MUNICIPIO/UF" perto do final do endereco
  // Evitar UF solta que pode ser parte de nome de empresa (ex: "MARMORARIA RJ")
  const ufPadroes = [
    /\b([A-ZÀ-Ú][a-zà-ú]+)\s*[\/-]\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i,
    /(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s+(\d{5}-?\d{3})/i,
  ];
  let uf: string | null = null;
  let municipioAjustado: string | null = null;

  for (const padrao of ufPadroes) {
    const m = bloco.match(padrao);
    if (m) {
      if (m.length >= 3) { municipioAjustado = m[1]; uf = m[2].toUpperCase(); }
      else { uf = m[1].toUpperCase(); }
      break;
    }
  }

  // Fallback: ultima UF encontrada no bloco (menos confiavel), evitando UF em nome de empresa
  if (!uf) {
    const ufs = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";
    const todosUfMatches = [...bloco.matchAll(new RegExp(`[\\\\-\\\\s](${ufs})\\\\b`, "gi"))];

    // Filtrar: remover UFs que estao dentro de nomes de empresa (texto todo maiusculo antes da UF)
    const ufValidos = todosUfMatches.filter((m) => {
      const idxUf = m.index!;
      const antesUf30 = bloco.substring(Math.max(0, idxUf - 30), idxUf).trim();
      // Nome de empresa tipico: duas ou mais palavras em maiusculo consecutivas
      if (antesUf30.length > 6 && /^[A-ZÀ-Ú]{3,}\s+[A-ZÀ-Ú]{3,}$/.test(antesUf30.split(/\s+/).slice(-2).join(" "))) {
        return false;
      }
      return true;
    });

    if (ufValidos.length > 0) {
      uf = ufValidos[ufValidos.length - 1][1].toUpperCase();
    }
  }

  // Municipio: texto antes da UF
  let municipio: string | null = municipioAjustado;
  if (!municipio && uf && logradouroCompleto) {
    const idxUf = bloco.lastIndexOf(uf);
    const antesUf = bloco.substring(0, idxUf).trim();
    const palavrasAntesUf = antesUf.split(/\s+/);
    // Pegar a palavra ou palavras antes da UF que parecem ser municipio
    for (let j = palavrasAntesUf.length - 1; j >= 0; j--) {
      const p = palavrasAntesUf[j];
      if (p.length > 3 && /^[A-ZÀ-Ú]/.test(p) && !/\d/.test(p) && !/^(AV|RUA|ALAMEDA|ESTRADA)/i.test(p)) {
        municipio = p;
        // Tentar incluir palavra anterior se for composto
        if (j > 0 && palavrasAntesUf[j - 1].length > 3 && /^[A-Z]/.test(palavrasAntesUf[j - 1])) {
          municipio = palavrasAntesUf[j - 1] + " " + municipio;
        }
        break;
      }
    }
  }

  // CEP
  const cepMatch = bloco.match(/\b(\d{5}-?\d{3})\b/);
  const cep = cepMatch ? cepMatch[1] : null;

  if (!logradouroCompleto && !municipio && !uf && !cep) return null;

  // Extrair numero do logradouro
  let numero: string | null = null;
  if (logradouroCompleto) {
    const numMatch = logradouroCompleto.match(/(\d+)\s*$/);
    if (numMatch) numero = numMatch[1];
  }

  return {
    logradouro: logradouroCompleto || null,
    numero,
    complemento: null,
    bairro: null,
    municipio,
    uf,
    cep,
    codigo_ibge: null,
  };
}

function validarEnderecoRomaneio(endereco: EnderecoRealEntrega | null | undefined): { valido: boolean; suspeito: boolean; motivos: string[] } {
  const motivos: string[] = [];
  if (!endereco) return { valido: false, suspeito: true, motivos: ["Endereco ausente."] };

  const rua = (endereco.logradouro || "").trim();
  const num = (endereco.numero || "").trim();
  const cep = (endereco.cep || "").trim().replace(/\D/g, "");
  const muni = (endereco.municipio || "").trim();
  const uf = (endereco.uf || "").trim();
  const bairro = (endereco.bairro || "").trim();

  if (!rua) motivos.push("Logradouro ausente.");
  else if (rua.length < 8) motivos.push("Logradouro muito curto (possivelmente truncado).");
  else if (/^[A-Z]{2,4}\.\s+[A-Z]{2,4}\b/.test(rua)) motivos.push("Logradouro parece abreviado e truncado.");

  if (!num) motivos.push("Numero ausente.");
  if (!muni) motivos.push("Municipio ausente.");
  if (!uf) motivos.push("UF ausente.");
  if (!cep || cep.length < 8) motivos.push("CEP ausente ou incompleto.");
  if (!bairro) motivos.push("Bairro ausente.");

  // Detectar CEP quebrado: padrao " SP /79667017" — CEP sem traco, colado com barra
  if (cep.length >= 8 && /\/\d{7,8}$/.test(rua)) motivos.push("CEP parece colado no logradouro com barra (/79667017).");
  if (rua.length >= 8 && rua.length < 20 && !bairro && !muni) {
    motivos.push("Endereco truncado: logradouro curto, sem bairro, sem municipio.");
  }

  // Detectar padrao "AV. SA SP /79667017" (logradouro + UF + /CEP)
  if (/[A-Z]{2}\s*\/\d{7,8}$/i.test(rua) && !muni) {
    motivos.push("Endereco truncado com UF e CEP colados no logradouro.");
  }

  // Detectar padrao "SP/79900261" — apenas UF/CEP, sem endereco real
  if (/^[A-Z]{2}\s*\/\s*\d{5,8}$/i.test(rua.trim())) {
    motivos.push("Logradouro e apenas UF/CEP — endereco real nao extraido.");
  }

  // Detectar logradouro que e apenas UF + CEP (ex: "SP 79900261")
  if (/^[A-Z]{2}\s+\d{7,8}$/.test(rua.trim())) {
    motivos.push("Logradouro e apenas UF e CEP — endereco real nao extraido.");
  }

  // Se tem UF e CEP mas nao tem logradouro valido
  if (uf && cep && (!rua || rua.length < 5 || /^[A-Z]{2}$/.test(rua.trim()))) {
    motivos.push("UF e CEP presentes, mas logradouro ausente ou invalido.");
  }

  const suspeito = motivos.length > 0;
  const valido = motivos.length === 0;

  return { valido, suspeito, motivos };
}

function validarDestinoRomaneio(
  municipio: string | null | undefined,
  uf: string | null | undefined,
  layout: string = "calvo"
): { valido: boolean; suspeito: boolean; bloqueiaGeracao: boolean; motivos: string[] } {
  const motivos: string[] = [];
  const mun = (municipio || "").trim();
  const sigla = (uf || "").trim().toUpperCase();

  if (!mun) motivos.push("Municipio de entrega ausente.");
  else if (mun.length < 3) motivos.push("Municipio muito curto — possivelmente incorreto.");

  if (!sigla) motivos.push("UF de entrega ausente.");

  // Layout Calvo: opera dentro de SP
  if (layout === "calvo" && sigla && sigla !== "SP") {
    motivos.push(`UF "${sigla}" diferente de SP. Verificar se e entrega real. Se confirmado, avaliar MDF-e/manifesto e regra fiscal interestadual antes de emitir.`);
  }

  // Detectar UF dentro de nome de empresa (ex: "MARMORARIA RJ")
  if (sigla && mun && mun.toUpperCase() === sigla) {
    motivos.push(`Municipio "${mun}" parece ser sigla de UF. Provavelmente extraido de nome de empresa, nao de endereco.`);
  }

  const suspeito = motivos.length > 0;
  const bloqueiaGeracao = sigla !== "SP" || motivos.some((m) => m.includes("sigla de UF") || m.includes("muito curto"));

  return { valido: !suspeito, suspeito, bloqueiaGeracao, motivos };
}

function extrairNomeDestinatarioDoBloco(bloco: string): string | null {
  // Tentar encontrar nome de empresa/pessoa — texto em maiusculas entre numeros e endereco
  const linhas = bloco.split(/\s{2,}/).filter((l) => l.trim().length > 5);
  for (const linha of linhas) {
    const limpa = linha.trim();
    // Nome de empresa: varias palavras em maiusculo, sem ser endereco
    if (/^[A-ZÀ-Ú\s]{10,}$/.test(limpa) && !/^(AV|RUA|ALAMEDA|ESTRADA|RODOVIA|TRAVESSA|CNPJ|CPF|ROMANEIO)/i.test(limpa)) {
      return limpa;
    }
  }
  return null;
}

function finalizarItem(
  itemAtual: Partial<RomaneioCalvoItem>,
  blocoAtual: string,
  itens: RomaneioCalvoItem[],
  numeroRomaneioGlobal: string | null
) {
  const enderecos = parseEnderecosDoBloco(blocoAtual);

  const item: RomaneioCalvoItem = {
    numero_romaneio: itemAtual.numero_romaneio || numeroRomaneioGlobal,
    numero_nfe: itemAtual.numero_nfe || null,
    chave_nfe: itemAtual.chave_nfe || null,
    cnpj_destinatario: itemAtual.cnpj_destinatario || null,
    nome_destinatario: itemAtual.nome_destinatario || null,
    endereco_fiscal: enderecos.fiscal || null,
    endereco_real_entrega: enderecos.real || null,
    municipio_entrega: enderecos.real?.municipio || null,
    uf_entrega: enderecos.real?.uf || null,
    bairro_entrega: enderecos.real?.bairro || null,
    cep_entrega: enderecos.real?.cep || null,
    peso: itemAtual.peso || null,
    caixas: itemAtual.caixas || null,
    rateio: itemAtual.rateio || null,
    linha_original: blocoAtual,
  };

  itens.push(item);
}

function parseEnderecosDoBloco(bloco: string): { fiscal: EnderecoRealEntrega | null; real: EnderecoRealEntrega | null } {
  const linhas = bloco.split(/\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  let blocoFiscal = "";
  let blocoReal = "";
  let coletando = "";

  for (const linha of linhas) {
    if (/(?:FISCAL|Fiscal|fiscal|FATURAMENTO|Faturamento|faturamento)/i.test(linha)) {
      coletando = "fiscal";
      blocoFiscal += linha.replace(/(?:FISCAL|Fiscal|fiscal|FATURAMENTO|Faturamento|faturamento)\s*[:#]?\s*/i, "") + " ";
      continue;
    }

    if (/(?:ENTREGA|Entrega|entrega)\s*(?:REAL|Real|real)?/i.test(linha) && coletando === "fiscal") {
      coletando = "real";
      blocoReal += linha.replace(/(?:ENTREGA|Entrega|entrega)\s*(?:REAL|Real|real)?\s*[:#]?\s*/i, "").replace(/ENDERE[ÇC]O\s*(?:DE\s*)?ENTREGA\s*[:#]?\s*/i, "").replace(/Endere[cç]o\s*(?:de\s*)?Entrega\s*[:#]?\s*/i, "").replace(/LOCAL\s*(?:DE\s*)?ENTREGA\s*[:#]?\s*/i, "") + " ";
      continue;
    }

    if (/(?:ENTREGA|Entrega|entrega)\s*(?:REAL|Real|real)?(?!\s*FISCAL)/i.test(linha) && !coletando) {
      coletando = "real";
      blocoReal += linha.replace(/(?:ENTREGA|Entrega|entrega)\s*(?:REAL|Real|real)?\s*[:#]?\s*/i, "").replace(/ENDERE[ÇC]O\s*(?:DE\s*)?ENTREGA\s*[:#]?\s*/i, "").replace(/Endere[cç]o\s*(?:de\s*)?Entrega\s*[:#]?\s*/i, "").replace(/LOCAL\s*(?:DE\s*)?ENTREGA\s*[:#]?\s*/i, "") + " ";
      continue;
    }

    if (coletando === "fiscal") {
      blocoFiscal += linha + " ";
    } else if (coletando === "real") {
      blocoReal += linha + " ";
    }
  }

  const fiscal = extrairEnderecoRealDoBloco(blocoFiscal.trim());
  const real = extrairEnderecoRealDoBloco(blocoReal.trim());

  return { fiscal, real };
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textos: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str || "")
      .join(" ");
    textos.push(pageText);
  }

  return textos.join("\n");
}

interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  page: number;
}

interface LinhaReconstruida {
  y: number;
  page: number;
  items: PdfTextItem[];
  textoLinha: string;
}

interface ColunaDetectada {
  nome: string;
  xMin: number;
  xMax: number;
}

export async function extractTextFromPdfCoords(file: File): Promise<PdfTextItem[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const items: PdfTextItem[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      const tx = item.transform;
      const x = tx ? tx[4] : 0;
      const y = tx ? tx[5] : 0;
      const w = item.width || (tx ? Math.abs(tx[0]) : 0);
      const h = item.height || (tx ? Math.abs(tx[3]) : 0);
      const text = (item.str || "").trim();
      if (text) {
        items.push({ text, x, y, width: w, height: h, page: i });
      }
    }
  }

  return items;
}

function reconstruirLinhas(items: PdfTextItem[]): LinhaReconstruida[] {
  const Y_TOLERANCE = 3;
  const grupos: { y: number; items: PdfTextItem[] }[] = [];

  for (const item of items) {
    let matched = false;
    for (const grupo of grupos) {
      if (Math.abs(grupo.y - item.y) <= Y_TOLERANCE) {
        grupo.items.push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      grupos.push({ y: item.y, items: [item] });
    }
  }

  return grupos
    .map((g) => {
      g.items.sort((a, b) => a.x - b.x);
      return {
        y: Math.round(g.y * 100) / 100,
        page: g.items[0]?.page || 1,
        items: g.items,
        textoLinha: g.items.map((i) => i.text).join(" ").trim(),
      };
    })
    .sort((a, b) => b.y - a.y);
}

function detectarColunas(linhas: LinhaReconstruida[]): ColunaDetectada[] | null {
  const termosCabecalho = ["CNPJ", "N.F.", "Cxs", "Peso", "Vl.Nota", "Rateio", "Entrega", "I.E.", "N.", "F.", "Brt", "Nota", "Dif", "Gris", "Imp", "C\\Imp"];
  let cabecalhoIdx = -1;
  let maxMatches = 0;

  for (let i = 0; i < linhas.length; i++) {
    const txt = linhas[i].textoLinha;
    const matches = termosCabecalho.filter((t) => txt.includes(t)).length;
    if (matches >= 3 && matches > maxMatches) {
      cabecalhoIdx = i;
      maxMatches = matches;
    }
  }

  if (cabecalhoIdx < 0) return null;

  const cabItems = linhas[cabecalhoIdx].items;
  const cols: ColunaDetectada[] = [];

  for (let i = 0; i < cabItems.length; i++) {
    const xStart = cabItems[i].x;
    let xEnd: number;
    if (i + 1 < cabItems.length) {
      xEnd = cabItems[i + 1].x;
    } else {
      xEnd = xStart + 120;
    }
    cols.push({ nome: cabItems[i].text, xMin: xStart, xMax: xEnd });
  }

  // Merge colunas adjacentes que sao partes do mesmo rotulo (ex: "Vl." + "Nota" = "Vl.Nota")
  const merged: ColunaDetectada[] = [];
  for (let i = 0; i < cols.length; i++) {
    if (merged.length > 0) {
      const last = merged[merged.length - 1];
      const gap = cols[i].xMin - last.xMax;
      if (gap < 10 && last.nome.length < 8 && cols[i].nome.length < 8) {
        last.nome = last.nome + " " + cols[i].nome;
        last.xMax = cols[i].xMax;
        continue;
      }
    }
    merged.push(cols[i]);
  }

  return merged;
}

function encontrarColunaPorNome(colunas: ColunaDetectada[], nomes: string[]): ColunaDetectada | null {
  for (const col of colunas) {
    for (const nome of nomes) {
      if (col.nome.toUpperCase().includes(nome.toUpperCase())) return col;
    }
  }
  return null;
}

function encontrarFaixaEntrega(
  colunas: ColunaDetectada[] | null,
  linhas: LinhaReconstruida[],
  linhasComNfe: { linhaIdx: number; nfe: string }[]
): { xMin: number; xMax: number } {
  // Estrategia 1: coluna com nome "Entrega" no cabecalho
  if (colunas) {
    const entregaCol = encontrarColunaPorNome(colunas, ["Entrega", "ENTREGA"]);
    if (entregaCol) {
      return { xMin: entregaCol.xMin - 10, xMax: entregaCol.xMax + 15 };
    }
  }

  // Estrategia 2: coluna entre "Vl.Nota" e "Rateio" (layout Calvo padrao)
  if (colunas && colunas.length >= 3) {
    const sorted = [...colunas].sort((a, b) => a.xMin - b.xMin);
    const vlNotaCol = encontrarColunaPorNome(sorted, ["Vl.Nota", "Vl. Nota", "Nota"]);
    const rateioCol = encontrarColunaPorNome(sorted, ["Rateio"]);
    if (vlNotaCol && rateioCol) {
      return { xMin: vlNotaCol.xMax - 5, xMax: rateioCol.xMin + 5 };
    }
    const pesoCol = encontrarColunaPorNome(sorted, ["Peso", "Brt"]);
    if (pesoCol && rateioCol) {
      return { xMin: pesoCol.xMax - 5, xMax: rateioCol.xMin + 5 };
    }
  }

  // Estrategia 3: detectar pela posicao dos NF-es vs rateios nos dados
  if (linhasComNfe.length >= 2) {
    const nfeXs: number[] = [];
    const rateioXs: number[] = [];

    for (const { linhaIdx } of linhasComNfe) {
      if (linhaIdx >= linhas.length) continue;
      const linha = linhas[linhaIdx];

      for (const item of linha.items) {
        if (/^\d{7}$/.test(item.text)) {
          nfeXs.push(item.x);
        }
        // Rateio: numero decimal com virgula, geralmente o ultimo numero a direita
        if (/^\d+[.,]\d{2}$/.test(item.text)) {
          rateioXs.push(item.x);
        }
      }
    }

    if (nfeXs.length >= 2 && rateioXs.length >= 2) {
      const nfeMax = Math.max(...nfeXs);
      const rateioMin = Math.min(...rateioXs);
      // Entrega fica entre o bloco de dados (NF-e/Cxs/Peso/Vl.Nota) e Rateio
      const entregaMin = nfeMax + 30;
      const entregaMax = rateioMin - 5;
      if (entregaMax > entregaMin + 30) {
        return { xMin: entregaMin, xMax: entregaMax };
      }
    }
  }

  // Estrategia 4: analisar TODAS as linhas de dados — bucket com mais texto longo
  const xBuckets = new Map<number, number>(); // bucket -> total chars
  const BUCKET_SIZE = 50;

  for (const { linhaIdx } of linhasComNfe) {
    if (linhaIdx >= linhas.length) continue;
    // Tambem analisar a proxima linha (linha 2 do endereco)
    for (let offset = 0; offset <= 1; offset++) {
      const idx = linhaIdx + offset;
      if (idx >= linhas.length) continue;
      for (const item of linhas[idx].items) {
        if (item.text.length >= 4 && !/^\d+$/.test(item.text) && !/^\d{14,}$/.test(item.text)) {
          const bucket = Math.floor(item.x / BUCKET_SIZE) * BUCKET_SIZE;
          xBuckets.set(bucket, (xBuckets.get(bucket) || 0) + item.text.length);
        }
      }
    }
  }

  let bestBucket = -1;
  let bestChars = 0;
  for (const [bucket, chars] of xBuckets) {
    if (chars > bestChars) {
      bestChars = chars;
      bestBucket = bucket;
    }
  }

  if (bestBucket >= 0 && bestChars > 30) {
    return { xMin: bestBucket - 10, xMax: bestBucket + BUCKET_SIZE + 10 };
  }

  // Fallback generoso: lado direito da pagina A4
  return { xMin: 200, xMax: 600 };
}

function parseRomaneioCalvoPorCoordenadas(items: PdfTextItem[]): { itens: RomaneioCalvoItem[]; debug: { linhas_reconstruidas: { y: number; textoLinha: string }[]; colunas_detectadas: ColunaDetectada[] } } {
  const itens: RomaneioCalvoItem[] = [];
  const linhas = reconstruirLinhas(items);
  const debugLinhas: { y: number; textoLinha: string }[] = [];
  const debugColunas: ColunaDetectada[] = [];

  if (linhas.length === 0) {
    return { itens, debug: { linhas_reconstruidas: [], colunas_detectadas: [] } };
  }

  // Detectar colunas
  const colunas = detectarColunas(linhas);
  if (colunas) debugColunas.push(...colunas);

  let numeroRomaneio: string | null = null;
  const textoGlobal = linhas.map((l) => l.textoLinha).join(" ");
  const romaneioMatch = textoGlobal.match(/romaneio\s*(\d{6})/i);
  if (romaneioMatch) numeroRomaneio = romaneioMatch[1];

  // Fallback: buscar numero de 6 digitos no inicio
  if (!numeroRomaneio) {
    const rm = textoGlobal.match(/\b(\d{6})\b/);
    if (rm) numeroRomaneio = rm[1];
  }

  // Coletar todas as chaves (44 digitos comecando com 35)
  const todasChaves: { chave: string; linhaIdx: number }[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const chaves = linhas[i].textoLinha.match(/\b(35\d{42})\b/g);
    if (chaves) {
      for (const ch of chaves) {
        todasChaves.push({ chave: ch, linhaIdx: i });
      }
    }
  }

  // Identificar linhas que contem NF-e (7 digitos) - pular CEPs e outros numeros
  const linhasComNfe: { linhaIdx: number; nfe: string }[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const txt = linhas[i].textoLinha;
    const matches = txt.match(/\b(\d{7})\b/g);
    if (!matches) continue;

    for (const nfe of matches) {
      // Filtrar: nao considerar como NF-e se parece CEP (precedido por hifen, barra, ou UF)
      const idx = txt.indexOf(nfe);
      const contexto = txt.substring(Math.max(0, idx - 6), idx);
      if (/[\-\/][A-Z]{2}\s*$/.test(contexto)) continue; // CEP apos UF
      if (/^\d{5}-\d{3}$/.test(nfe)) continue;

      linhasComNfe.push({ linhaIdx: i, nfe });
    }
  }

  // Detectar faixa X da coluna Entrega (passa linhasComNfe para estrategia por dados)
  const faixaEntrega = encontrarFaixaEntrega(colunas, linhas, linhasComNfe);

  // Construir itens
  for (let n = 0; n < linhasComNfe.length; n++) {
    const { linhaIdx, nfe } = linhasComNfe[n];
    const linha = linhas[linhaIdx];
    const proxLinhaIdx = n + 1 < linhasComNfe.length ? linhasComNfe[n + 1].linhaIdx : linhas.length;

    // Coletar linhas da coluna de entrega: preservar cada linha Y separadamente
    const linhasEntrega: string[] = [];

    // Funcao auxiliar: filtrar itens que parecem endereco (nao numeros puros, nao chaves, nao CNPJ)
    const filtraEndereco = (items: PdfTextItem[]) =>
      items
        .filter((it) => {
          const t = it.text.trim();
          if (!t || t.length < 2) return false;
          if (/^\d{7,}$/.test(t)) return false;     // NF-e numbers, CEPs
          if (/^\d{2}\.\d{3}\.\d{3}\//.test(t)) return false; // CNPJ formatado
          if (/^\d{14}$/.test(t)) return false;      // CNPJ nao formatado
          if (/^[0-9.,]+$/.test(t) && t.length < 6) return false; // numeros pequenos (caixas, etc.)
          if (/^[A-Z]{2}$/.test(t) && items.length > 1) return false; // UF isolada (so tem contexto com mais itens)
          return true;
        })
        .map((ei) => ei.text).join(" ").trim();

    // Linha base (linha da NF-e) — logradouro + numero
    const baseItems = linha.items.filter(
      (it) => it.x >= faixaEntrega.xMin - 10 && it.x <= faixaEntrega.xMax + 10
    );
    const baseText = filtraEndereco(baseItems);
    if (baseText) linhasEntrega.push(baseText);

    // Proxima linha (linha 2) — bairro + municipio + CEP
    if (linhaIdx + 1 < proxLinhaIdx) {
      const nextItems = linhas[linhaIdx + 1].items.filter(
        (it) => it.x >= faixaEntrega.xMin - 10 && it.x <= faixaEntrega.xMax + 10
      );
      const nextText = filtraEndereco(nextItems);
      if (nextText && nextText.length > 3) linhasEntrega.push(nextText);
    }

    // Linhas adicionais se houver (ate a proxima NF-e)
    for (let j = linhaIdx + 2; j < proxLinhaIdx; j++) {
      const extraItems = linhas[j].items.filter(
        (it) => it.x >= faixaEntrega.xMin - 10 && it.x <= faixaEntrega.xMax + 10
      );
      const extraText = filtraEndereco(extraItems);
      if (extraText && extraText.length > 3) linhasEntrega.push(extraText);
    }

    // Extrair chave (na linha atual ou proximas)
    let chaveNfe: string | null = null;
    const chaveNaLinha = linha.textoLinha.match(/\b(35\d{42})\b/);
    if (chaveNaLinha) {
      chaveNfe = chaveNaLinha[1];
    } else {
      for (let j = linhaIdx + 1; j < Math.min(linhaIdx + 5, linhas.length); j++) {
        const ch = linhas[j].textoLinha.match(/\b(35\d{42})\b/);
        if (ch) { chaveNfe = ch[1]; break; }
      }
    }

    // Extrair CNPJ
    const cnpjMatch = linha.textoLinha.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/) || linha.textoLinha.match(/\b(\d{14})\b/);
    const cnpj = cnpjMatch ? cnpjMatch[1] : null;

    // Extrair dados numericos (caixas, peso, valor nota, rateio)
    const numeros = linha.textoLinha.match(/\b(\d+[.,]\d+|\d{1,3})\b/g) || [];
    let caixas: string | null = null;
    let peso: string | null = null;
    let valorNota: string | null = null;
    let rateio: string | null = null;

    const intNumbers = numeros.filter((n) => /^\d{1,3}$/.test(n)).map((n) => parseInt(n, 10));
    const decNumbers = numeros.filter((n) => /[.,]/.test(n));

    if (intNumbers.length > 0) {
      caixas = intNumbers[0].toString();
    }
    if (decNumbers.length >= 1) peso = decNumbers[0].replace(",", ".");
    if (decNumbers.length >= 2) valorNota = decNumbers[1].replace(",", ".");
    if (decNumbers.length >= 3) rateio = decNumbers[2].replace(",", ".");
    else if (decNumbers.length >= 2) rateio = decNumbers[decNumbers.length - 1].replace(",", ".");

    // Extrair endereco usando parser especifico para formato Calvo (2 linhas)
    let enderecoReal: EnderecoRealEntrega | null = null;
    let nomeDestinatario: string | null = null;

    if (linhasEntrega.length > 0) {
      const montado = montarEnderecoEntregaCalvo(linhasEntrega);
      enderecoReal = montado.endereco;
      nomeDestinatario = montado.nomeDestinatario || extrairNomeDestinatarioDoBloco(linha.textoLinha);
    }

    // Validar endereco extraido
    const validacao = validarEnderecoRomaneio(enderecoReal);
    const destino = validarDestinoRomaneio(enderecoReal?.municipio, enderecoReal?.uf, "calvo");

    const item: RomaneioCalvoItem = {
      numero_romaneio: numeroRomaneio,
      numero_nfe: nfe,
      chave_nfe: chaveNfe,
      cnpj_destinatario: cnpj,
      nome_destinatario: nomeDestinatario,
      endereco_real_entrega: enderecoReal,
      municipio_entrega: enderecoReal?.municipio || null,
      uf_entrega: enderecoReal?.uf || null,
      bairro_entrega: enderecoReal?.bairro || null,
      cep_entrega: enderecoReal?.cep || null,
      peso,
      caixas,
      rateio,
      valor_nota: valorNota,
      linha_original: linha.textoLinha,
      endereco_suspeito: validacao.suspeito,
      pendente_conferencia_endereco: validacao.suspeito || destino.suspeito,
      endereco_validacao_motivos: [...validacao.motivos, ...destino.motivos],
    };

    itens.push(item);
  }

  // Associar chaves nao encontradas aos itens pelo numero da NF-e
  for (const { chave } of todasChaves) {
    const nfNaChave = chave.substring(25, 34).replace(/^0+/, "");
    const item = itens.find((it) => it.numero_nfe === nfNaChave || chave.includes(it.numero_nfe || ""));
    if (item && !item.chave_nfe) item.chave_nfe = chave;
  }

  // Compilar debug
  for (const l of linhas) {
    debugLinhas.push({ y: l.y, textoLinha: l.textoLinha });
  }

  // Adicionar faixa X ao debug
  if (!colunas || colunas.length === 0) {
    debugColunas.push({ nome: `Entrega (faixa detectada: X ${Math.round(faixaEntrega.xMin)}-${Math.round(faixaEntrega.xMax)})`, xMin: faixaEntrega.xMin, xMax: faixaEntrega.xMax });
  }

  return { itens, debug: { linhas_reconstruidas: debugLinhas, colunas_detectadas: debugColunas } };
}

export async function cruzarRomaneioComXmlsCalvo(
  romaneioItens: RomaneioCalvoItem[]
): Promise<CruzamentoResultado[]> {
  const { data: docs } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("*")
    .in("tipo_documento", ["NFE", "nfe"])
    .order("created_at", { ascending: false })
    .limit(200);

  const documentosXml: FiscalDocumentoVinculado[] = (docs || []) as FiscalDocumentoVinculado[];

  const resultados: CruzamentoResultado[] = [];

  for (const item of romaneioItens) {
    let docEncontrado: FiscalDocumentoVinculado | null = null;
    let motivoFalha: string | undefined;

    if (item.chave_nfe) {
      const chaveLimpa = item.chave_nfe.trim();
      docEncontrado =
        documentosXml.find((d) => d.chave_acesso === chaveLimpa) || null;
    }

    if (!docEncontrado && item.numero_nfe && item.cnpj_destinatario) {
      const numeroLimpo = limparNumeroNfe(item.numero_nfe);
      const cnpjLimpo = limparCnpj(item.cnpj_destinatario);
      docEncontrado =
        documentosXml.find(
          (d) =>
            d.numero &&
            limparNumeroNfe(d.numero) === numeroLimpo &&
            d.destinatario_cnpj &&
            limparCnpj(d.destinatario_cnpj) === cnpjLimpo
        ) || null;
    }

    if (!docEncontrado && item.numero_nfe) {
      const numeroLimpo = limparNumeroNfe(item.numero_nfe);
      docEncontrado =
        documentosXml.find(
          (d) => d.numero && limparNumeroNfe(d.numero) === numeroLimpo
        ) || null;
    }

    if (!docEncontrado) {
      motivoFalha = item.chave_nfe
        ? `NF-e chave ${item.chave_nfe.substring(0, 10)}... nao encontrada entre XMLs importados`
        : `NF-e ${item.numero_nfe || "S/N"} nao encontrada entre XMLs importados`;
    }

    resultados.push({
      item,
      docVinculado: docEncontrado,
      cruzou: !!docEncontrado,
      motivo_falha: motivoFalha,
    });
  }

  return resultados;
}

function detectarDivergenciaEndereco(
  doc: FiscalDocumentoVinculado,
  enderecoReal: EnderecoRealEntrega
): boolean {
  const xmlEnd = doc.metadata?.endereco_fiscal_xml as EnderecoRealEntrega | undefined;
  if (!xmlEnd) return true;

  const campos: (keyof EnderecoRealEntrega)[] = ["logradouro", "numero", "bairro", "municipio", "uf", "cep"];
  return campos.some((campo) => {
    const valXml = (xmlEnd[campo] || "").toString().toLowerCase().trim();
    const valReal = (enderecoReal[campo] || "").toString().toLowerCase().trim();
    return valXml && valReal && valXml !== valReal;
  });
}

export async function aplicarCruzamentos(resultados: CruzamentoResultado[]): Promise<{
  atualizados: number;
  falhas: number;
}> {
  let atualizados = 0;
  let falhas = 0;

  for (const res of resultados) {
    if (!res.cruzou || !res.docVinculado) {
      falhas++;
      continue;
    }

    try {
      const metaAtual = res.docVinculado.metadata || {};
      const enderecoReal = res.item.endereco_real_entrega || null;

      // Validar endereco extraido antes de marcar como OK
      const validacao = enderecoReal ? validarEnderecoRomaneio(enderecoReal) : { valido: false, suspeito: true, motivos: ["Endereco ausente."] };
      const destino = validarDestinoRomaneio(enderecoReal?.municipio, enderecoReal?.uf, "calvo");
      const enderecoPrecisaConferencia = validacao.suspeito || destino.suspeito;

      const divergencia = enderecoReal ? detectarDivergenciaEndereco(res.docVinculado, enderecoReal) : false;

      // Construir endereco completo para observacao e display
      const enderecoCompleto = enderecoReal ? [
        enderecoReal.logradouro,
        enderecoReal.numero ? `, ${enderecoReal.numero}` : "",
        enderecoReal.bairro ? ` - ${enderecoReal.bairro}` : "",
        enderecoReal.municipio ? ` - ${enderecoReal.municipio}` : "",
        enderecoReal.uf ? `/${enderecoReal.uf}` : "",
        enderecoReal.cep ? ` - CEP ${enderecoReal.cep}` : "",
      ].join("").trim() || null : null;

      const novoMetadata = {
        ...metaAtual,
        endereco_real_entrega: enderecoReal ? {
          logradouro: enderecoReal.logradouro || null,
          numero: enderecoReal.numero || null,
          complemento: enderecoReal.complemento || null,
          bairro: enderecoReal.bairro || null,
          municipio: enderecoReal.municipio || null,
          uf: (enderecoReal.uf || "").toUpperCase() || null,
          cep: enderecoReal.cep || null,
          codigo_ibge: enderecoReal.codigo_ibge || null,
        } : metaAtual.endereco_real_entrega || null,
        fonte_endereco_entrega: enderecoReal ? "romaneio" : (metaAtual.fonte_endereco_entrega || "xml"),
        divergencia_endereco_xml_romaneio: divergencia,
        pendente_conferencia_endereco: enderecoPrecisaConferencia,
        endereco_validacao_motivos: [...validacao.motivos, ...destino.motivos],
        endereco_completo: enderecoCompleto,
        romaneio_numero: res.item.numero_romaneio || null,
        romaneio_rateio: res.item.rateio || null,
        romaneio_peso: res.item.peso || null,
        romaneio_caixas: res.item.caixas || null,
      };

      const { error } = await supabase
        .from("fiscal_documentos_vinculados")
        .update({ metadata: novoMetadata })
        .eq("id", res.docVinculado.id);

      if (error) {
        console.error(`[RomaneioCalvo] Erro ao atualizar doc ${res.docVinculado.id}:`, error);
        falhas++;
      } else {
        atualizados++;
      }

      // Atualizar o resultado com status de endereco
      res.endereco_ok = !enderecoPrecisaConferencia && !!enderecoReal;
      res.endereco_pendente = enderecoPrecisaConferencia;
      res.pronto_para_cte = res.cruzou && !enderecoPrecisaConferencia;
    } catch (err: any) {
      console.error(`[RomaneioCalvo] Erro ao processar doc ${res.docVinculado.id}:`, err);
      falhas++;
    }
  }

  return { atualizados, falhas };
}

export type RomaneioLayout = "calvo";

export async function processarUploadRomaneioPorLayout(
  file: File,
  layout: RomaneioLayout
): Promise<ProcessamentoRomaneioResult> {
  if (layout === "calvo") {
    return processarUploadRomaneio(file);
  }
  throw new Error(`Layout de romaneio "${layout}" ainda nao implementado.`);
}

export async function processarUploadRomaneio(
  file: File
): Promise<ProcessamentoRomaneioResult> {
  const texto = await extractTextFromPdf(file);

  const debug = {
    texto_extraido_caracteres: texto?.length || 0,
    texto_previa: (texto || "").substring(0, 2000),
    layout_detectado: "",
    nfs_detectadas: 0,
    chaves_detectadas: 0,
    itens_extraidos: 0,
    erros: [] as string[],
    avisos: [] as string[],
    parser_usado: "texto",
    linhas_reconstruidas: [] as { y: number; textoLinha: string }[],
    colunas_detectadas: [] as { nome: string; xMin: number; xMax: number }[],
  };

  if (!texto || !texto.trim()) {
    debug.erros.push("Nenhum texto extraido do PDF. O arquivo pode estar vazio ou ser uma imagem escaneada (sem texto selecionavel).");
    throw Object.assign(
      new Error("Nao foi possivel extrair texto do PDF. O arquivo pode estar vazio ou ser baseado em imagem."),
      { debug }
    );
  }

  if (texto.trim().length < 100) {
    debug.avisos.push(`Texto extraido muito curto (${texto.trim().length} caracteres). O PDF pode estar escaneado como imagem.`);
  }

  // Detectar layout
  if (/informa[cç][oõ]es\s*p\/?\s*gera[cç][aã]o\s*dos\s*crts/i.test(texto)) {
    debug.layout_detectado = "Calvo — Informacoes p/ Geracao dos CRTs";
  } else if (/romaneio\s*cnpj/i.test(texto)) {
    debug.layout_detectado = "Calvo — Romaneio CNPJ / I.E. / N.F.";
  } else if (/cxs?\s*peso\s*brt?\s*vl\.?\s*nota/i.test(texto)) {
    debug.layout_detectado = "Calvo — Cxs Peso Brt Vl.Nota";
  } else {
    debug.layout_detectado = "Layout nao reconhecido — parser generico ativo";
    debug.avisos.push("Layout do PDF nao corresponde aos padroes conhecidos da Calvo. O parser generico tentara extrair NF-es e enderecos.");
  }

  // Contar NF-es e chaves no texto
  const nfsTexto = texto.match(/\b(\d{7})\b/g) || [];
  const chavesTexto = texto.match(/\b(35\d{42})\b/g) || [];
  debug.nfs_detectadas = new Set(nfsTexto).size;
  debug.chaves_detectadas = chavesTexto.length;

  // PRIMARIO: parser por coordenadas (mais preciso para tabelas)
  let itens: RomaneioCalvoItem[] = [];
  let coordDebug: { linhas_reconstruidas: { y: number; textoLinha: string }[]; colunas_detectadas: ColunaDetectada[] } | null = null;

  try {
    const coords = await extractTextFromPdfCoords(file);
    const coordResult = parseRomaneioCalvoPorCoordenadas(coords);
    itens = coordResult.itens;
    coordDebug = coordResult.debug;
    debug.parser_usado = "coordenadas";
    debug.linhas_reconstruidas = coordResult.debug.linhas_reconstruidas;
    debug.colunas_detectadas = coordResult.debug.colunas_detectadas;

    if (itens.length > 0) {
      debug.avisos.push(`Parser por coordenadas: ${itens.length} itens extraidos, ${coordResult.debug.colunas_detectadas.length} colunas detectadas.`);
    }
  } catch (e: any) {
    debug.avisos.push(`Parser por coordenadas falhou: ${e.message}`);
  }

  // FALLBACK 1: parser por texto linha-a-linha
  if (itens.length === 0) {
    debug.avisos.push("Coordenadas nao extraiu itens. Tentando parser linha-a-linha...");
    debug.parser_usado = "texto_linhas";
    itens = parseRomaneioCalvoFromText(texto);
    if (itens.length > 0) {
      debug.avisos.push(`Parser linha-a-linha extraiu ${itens.length} itens.`);
    }
  }

  // FALLBACK 2: parser por blocos
  if (itens.length === 0 && debug.nfs_detectadas > 0) {
    debug.avisos.push("Tentando parser por blocos...");
    debug.parser_usado = "blocos";
    itens = parseRomaneioCalvoPorBlocos(texto);
    debug.itens_extraidos = itens.length;
    if (itens.length > 0) {
      debug.avisos.push(`Parser por blocos extraiu ${itens.length} itens (possivelmente parciais).`);
    }
  }

  debug.itens_extraidos = itens.length;

  if (itens.length === 0) {
    if (debug.nfs_detectadas > 0) {
      debug.erros.push(`${debug.nfs_detectadas} NF-es detectadas no texto (numeros de 7 digitos), mas o parser nao conseguiu estruturar os itens.`);
    }
    debug.erros.push(`Nao foi possivel identificar itens de romaneio no PDF "${file.name}". Texto extraido: ${texto.length} caracteres. Verifique se o PDF contem a tabela "Informacoes p/ Geracao dos CRTs".`);

    throw Object.assign(
      new Error(`Nao foi possivel identificar itens de romaneio no PDF "${file.name}". ${debug.nfs_detectadas > 0 ? `${debug.nfs_detectadas} NF-es detectadas no texto, mas o parser nao conseguiu estruturar os itens.` : "Nenhuma NF-e detectada."} Texto extraido: ${texto.length} caracteres.`),
      { debug }
    );
  }

  // Validar enderecos dos itens e enriquecer metadados
  for (const item of itens) {
    const validacao = validarEnderecoRomaneio(item.endereco_real_entrega || null);
    const destino = validarDestinoRomaneio(item.municipio_entrega, item.uf_entrega, "calvo");
    item.endereco_suspeito = validacao.suspeito;
    item.pendente_conferencia_endereco = validacao.suspeito || destino.suspeito;
    item.endereco_validacao_motivos = [...validacao.motivos, ...destino.motivos];
  }

  const resultados = await cruzarRomaneioComXmlsCalvo(itens);

  const { atualizados } = await aplicarCruzamentos(resultados);

  const cruzaram = resultados.filter((r) => r.cruzou).length;
  const pendentes = resultados.length - cruzaram;
  const enderecos_ok = resultados.filter((r) => r.endereco_ok).length;
  const enderecos_pendentes = resultados.filter((r) => r.endereco_pendente).length;
  const prontos_para_cte = resultados.filter((r) => r.pronto_para_cte).length;

  return {
    total_itens: itens.length,
    cruzaram,
    pendentes,
    enderecos_ok,
    enderecos_pendentes,
    prontos_para_cte,
    resultados,
    debug,
  };
}

export interface RomaneioCalvoDiagnosticoItem {
  numero_nfe: string | null;
  chave_nfe: string | null;
  cnpj_destinatario: string | null;
  nome_destinatario: string | null;
  caixas: string | null;
  peso: string | null;
  valor_nota: number | null;
  endereco_xml: string | null;
  endereco_pdf: string | null;
  municipio_entrega_pdf: string | null;
  uf_entrega_pdf: string | null;
  cep_entrega_pdf: string | null;
  xml_importado: boolean;
  xml_faltando: boolean;
  xml_fora_romaneio: boolean;
  cte_id: string | null;
  cte_numero: string | null;
  valor_rateado: number | null;
  status_cte: string | null;
  xml_cte_salvo: boolean;
  dacte_salvo: boolean;
  enviado_cliente: boolean;
  bloqueios: string[];
  proxima_acao: string;
}

export interface RomaneioCalvoDiagnostico {
  numero_romaneio: string;
  cliente: string | null;
  valor_total_frete: number | null;
  criterio_rateio: string | null;
  total_itens_pdf: number;
  total_xmls_cruzados: number;
  total_xmls_faltando: number;
  total_xmls_fora_romaneio: number;
  total_ctes_gerados: number;
  total_autorizados: number;
  total_rejeitados: number;
  total_processando: number;
  total_documentos_salvos: number;
  status_romaneio: string;
  proxima_acao: string;
  itens: RomaneioCalvoDiagnosticoItem[];
}

export async function diagnosticarRomaneioCalvo(numeroRomaneio: string): Promise<RomaneioCalvoDiagnostico | null> {
  const docs = await supabase
    .from("fiscal_documentos_vinculados")
    .select("*")
    .filter("metadata->>romaneio_numero", "eq", numeroRomaneio)
    .order("created_at", { ascending: true });

  const docsData = (docs.data || []) as any[];
  if (docsData.length === 0) return null;

  const ctes = await supabase
    .from("fiscal_ctes")
    .select("id, numero, status, valor, metadata, chave_acesso")
    .filter("metadata->rateio->>lote_id", "not.is", null)
    .limit(200);

  const ctesData = (ctes.data || []) as any[];

  const itensPdf = new Map<string, any>();
  for (const d of docsData) {
    const meta = d.metadata || {};
    const real = meta.endereco_real_entrega || {};
    const nfe = (d.numero || "").toString().trim();
    if (nfe) itensPdf.set(nfe, { doc: d, meta, real });
  }

  const itens: RomaneioCalvoDiagnosticoItem[] = [];
  let xmlsCruzados = 0, xmlsFaltando = 0, xmlsForaRomaneio = 0;
  let ctesGerados = 0, autorizados = 0, rejeitados = 0, processando = 0;
  let docsSalvos = 0;

  for (const [nfe, item] of itensPdf) {
    const bloqueios: string[] = [];
    let cteInfo: any = null;
    let valorRateado: number | null = null;
    let statusCte: string | null = null;
    let xmlSalvo = false, dacteSalvo = false, emailEnviado = false;

    if (item.doc) {
      xmlsCruzados++;
      const docCte = ctesData.find((c) => {
        const dv = c.metadata?.payload_focus?.documentos_vinculados || [];
        return dv.some((d: any) => d.chave_acesso === item.doc.chave_acesso || d.numero === nfe);
      });
      if (docCte) {
        cteInfo = docCte;
        ctesGerados++;
        statusCte = docCte.status;
        valorRateado = docCte.valor || null;
        if (statusCte === "autorizado") autorizados++;
        else if (statusCte === "rejeitado") rejeitados++;
        else if (statusCte === "processando") processando++;

        const docsSt = docCte.metadata?.documentos_storage || {};
        xmlSalvo = docsSt.xml?.salvo === true;
        dacteSalvo = docsSt.dacte?.salvo === true;
        if (xmlSalvo && dacteSalvo) docsSalvos++;

        emailEnviado = docCte.metadata?.email_cliente?.enviado === true;

        if (!xmlSalvo && statusCte === "autorizado") bloqueios.push("XML pendente");
        if (!dacteSalvo && statusCte === "autorizado") bloqueios.push("DACTE pendente");
      } else {
        bloqueios.push("CT-e nao gerado");
      }
      if (!item.doc.chave_acesso) bloqueios.push("Chave NF-e ausente");
    } else {
      xmlsFaltando++;
      bloqueios.push("XML nao importado");
    }

    const endXml = item.doc ? `${item.doc.municipio_destino || ""}/${item.doc.uf_destino || ""}` : null;
    const endPdf = item.real?.municipio
      ? [item.real.logradouro, item.real.numero ? `, ${item.real.numero}` : "", item.real.bairro ? `, ${item.real.bairro}` : ""].join("")
      : null;

    const divergencia = item.doc && item.real?.municipio && (item.doc.municipio_destino !== item.real.municipio);
    if (divergencia) bloqueios.push("Endereco divergente XML x PDF");

    const endValido = validarEnderecoRomaneio(item.real);
    if (endValido.suspeito) {
      bloqueios.push("Endereco real incompleto: " + endValido.motivos.join("; "));
    }

    const destinoVal = validarDestinoRomaneio(item.real?.municipio, item.real?.uf, "calvo");
    if (destinoVal.bloqueiaGeracao) {
      bloqueios.push("Destino suspeito: " + destinoVal.motivos.join("; "));
    }

    let proximaAcao = "pendente";
    if (!item.doc) proximaAcao = "importar_xml";
    else if (endValido.suspeito || destinoVal.bloqueiaGeracao) proximaAcao = "conferir_endereco";
    else if (!cteInfo) proximaAcao = "gerar_cte";
    else if (statusCte === "processando") proximaAcao = "consultar_focus";
    else if (statusCte === "autorizado" && (!xmlSalvo || !dacteSalvo)) proximaAcao = "baixar_documentos";
    else if (statusCte === "autorizado" && xmlSalvo && dacteSalvo) proximaAcao = "concluido";
    else if (statusCte === "rejeitado") proximaAcao = "corrigir_rejeicao";

    itens.push({
      numero_nfe: nfe,
      chave_nfe: item.doc?.chave_acesso || null,
      cnpj_destinatario: item.doc?.destinatario_cnpj || null,
      nome_destinatario: item.doc?.destinatario_nome || null,
      caixas: item.meta?.romaneio_caixas || null,
      peso: item.meta?.romaneio_peso || null,
      valor_nota: item.doc?.valor_total || null,
      endereco_xml: endXml,
      endereco_pdf: endPdf,
      municipio_entrega_pdf: item.real?.municipio || null,
      uf_entrega_pdf: item.real?.uf || null,
      cep_entrega_pdf: item.real?.cep || null,
      xml_importado: !!item.doc,
      xml_faltando: !item.doc,
      xml_fora_romaneio: false,
      cte_id: cteInfo?.id || null,
      cte_numero: cteInfo?.numero || null,
      valor_rateado: valorRateado,
      status_cte: statusCte,
      xml_cte_salvo: xmlSalvo,
      dacte_salvo: dacteSalvo,
      enviado_cliente: emailEnviado,
      bloqueios,
      proxima_acao: proximaAcao,
    });
  }

  let statusRomaneio = "importado";
  if (xmlsFaltando > 0) statusRomaneio = "com_pendencias";
  else if (ctesGerados === 0) statusRomaneio = "pronto_para_gerar_cte";
  else if (autorizados + rejeitados === 0 && processando > 0) statusRomaneio = "enviado_focus";
  else if (rejeitados > 0 && autorizados === 0 && processando === 0) statusRomaneio = "com_rejeicoes";
  else if (autorizados > 0 && docsSalvos < autorizados) statusRomaneio = "parcialmente_autorizado";
  else if (autorizados > 0 && docsSalvos === autorizados) statusRomaneio = "documentos_salvos";
  else if (ctesGerados > 0 && processando === 0 && autorizados === 0 && rejeitados === 0) statusRomaneio = "ctes_gerados";

  let proximaAcao = "importar_xmls_faltantes";
  if (xmlsFaltando === 0 && ctesGerados === 0) proximaAcao = "gerar_ctes";
  else if (processando > 0) proximaAcao = "consultar_focus";
  else if (autorizados > 0 && docsSalvos < autorizados) proximaAcao = "baixar_documentos";
  else if (rejeitados > 0 && autorizados === 0 && processando === 0) proximaAcao = "corrigir_rejeicoes";
  else if (autorizados > 0 && docsSalvos === autorizados) proximaAcao = "concluido";

  return {
    numero_romaneio: numeroRomaneio,
    cliente: "Calvo",
    valor_total_frete: null,
    criterio_rateio: null,
    total_itens_pdf: itensPdf.size,
    total_xmls_cruzados: xmlsCruzados,
    total_xmls_faltando: xmlsFaltando,
    total_xmls_fora_romaneio: xmlsForaRomaneio,
    total_ctes_gerados: ctesGerados,
    total_autorizados: autorizados,
    total_rejeitados: rejeitados,
    total_processando: processando,
    total_documentos_salvos: docsSalvos,
    status_romaneio: statusRomaneio,
    proxima_acao: proximaAcao,
    itens,
  };
}

export async function listarRomaneiosCalvo(): Promise<{ numero_romaneio: string; status: string; total_nfes: number; cliente: string; layout: string }[]> {
  const { data } = await supabase
    .from("fiscal_documentos_vinculados")
    .select("metadata")
    .not("metadata->>romaneio_numero", "is", null)
    .limit(100);

  if (!data) return [];

  const map = new Map<string, { status: string; total_nfes: number }>();
  for (const row of data) {
    const num = row.metadata?.romaneio_numero;
    if (!num) continue;
    if (!map.has(num)) map.set(num, { status: "importado", total_nfes: 0 });
    map.get(num)!.total_nfes++;
  }

  return Array.from(map.entries()).map(([numero_romaneio, v]) => ({
    numero_romaneio,
    status: v.status,
    total_nfes: v.total_nfes,
    cliente: "Calvo",
    layout: "calvo",
  }));
}
