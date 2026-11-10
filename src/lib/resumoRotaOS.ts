// ============================================================
// RESUMO DE ROTA DA OS — "BairroOrigem-SIGLA ➡️ BairroDestino-SIGLA"
//
// Usado na lista de OS, nas solicitações e no Dashboard. Substitui a
// exibição estática "São Paulo - Matriz" por um resumo derivado do
// itinerário real (ordens_servico.enderecos).
// ============================================================

export interface EnderecoResumoRota {
  tipo?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  /** Alguns mapeadores usam `estado` em vez de `uf`. */
  estado?: string | null;
  endereco?: string | null;
  logradouro?: string | null;
}

/** Siglas de cidade usadas pela operação (fallback: iniciais). */
const SIGLAS_CIDADE: Record<string, string> = {
  "sao paulo": "SAO",
  guarulhos: "GRU",
  "sao bernardo do campo": "SBC",
  "santo andre": "SAN",
  "sao caetano do sul": "SCS",
  "sao jose dos campos": "SJC",
  osasco: "OSA",
  diadema: "DIA",
  maua: "MAU",
  suzano: "SUZ",
  barueri: "BAR",
  carapicuiba: "CAR",
  cotia: "COT",
  "taboao da serra": "TAB",
  "mogi das cruzes": "MOJ",
  jundiai: "JUN",
  campinas: "CAM",
  sorocaba: "SOR",
  santos: "STS",
  "ribeirao preto": "RPR",
  americana: "AME",
  limeira: "LIM",
  piracicaba: "PIR",
  itaquaquecetuba: "ITQ",
  "ferraz de vasconcelos": "FVA",
  "embu das artes": "EMB",
  "itapevi": "ITA",
  "poa": "POA",
};

const IGNORADOS = new Set(["de", "da", "do", "das", "dos", "e"]);

const CEP_OU_NUMERO = /^(\d{5}-?\d{3}|\d+)$/;

const capitalizar = (valor: string): string =>
  valor
    .toLowerCase()
    .split(/\s+/)
    .map((palavra, indice) => {
      if (indice > 0 && IGNORADOS.has(palavra)) return palavra;
      return palavra.replace(/^\p{L}/u, (letra) => letra.toUpperCase());
    })
    .join(" ");

/**
 * Deriva bairro/cidade/UF do texto do endereço quando a OS não trouxe os
 * campos separados (caso das OS criadas pela Cotação Express, cujo jsonb
 * nasce com bairro/cidade vazios).
 *
 * Aceita os formatos:
 *   "Av. Sumaré, Vila Madalena, São Paulo - SP, 05435-000"
 *   "Rua X, 100, Jardim Ângela, São Paulo - SP"
 *   "Rua Y - Centro, Guarulhos - SP"
 */
export function derivarBairroCidade(enderecoTexto?: string | null): {
  bairro: string;
  cidade: string;
  uf: string;
} {
  const texto = String(enderecoTexto || "").trim();
  if (!texto) return { bairro: "", cidade: "", uf: "" };

  const partes = texto
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  let cidade = "";
  let uf = "";
  let idxCidade = -1;

  for (let i = partes.length - 1; i >= 0; i--) {
    const m = partes[i].match(/^(.+?)\s*[-–]\s*([A-Za-z]{2})$/);
    if (m) {
      cidade = m[1].trim();
      uf = m[2].toUpperCase();
      idxCidade = i;
      break;
    }
  }

  let bairro = "";
  if (idxCidade > 0) {
    for (let j = idxCidade - 1; j >= 0; j--) {
      const parte = partes[j];
      if (CEP_OU_NUMERO.test(parte.replace(/\s/g, ""))) {
        if (/^\d{5}-?\d{3}$/.test(parte.replace(/\s/g, ""))) continue; // CEP
        continue; // número de porta
      }
      // a primeira parte normalmente é a via (rua/avenida)
      if (j === 0) break;
      bairro = parte;
      break;
    }
  }

  // "Rua Y - Centro" → usa o trecho após o hífen como bairro
  if (!bairro && idxCidade > 0) {
    const m = partes[0].match(/[-–]\s*(.+)$/);
    if (m) bairro = m[1].trim();
  }

  return {
    bairro: bairro ? capitalizar(bairro) : "",
    cidade: cidade ? capitalizar(cidade) : "",
    uf,
  };
}

/** Remove acentos e normaliza para comparação (ex.: "São Bernardo" → "sao bernardo"). */
export const normalizarCidade = (valor?: string | null): string =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Sigla curta da cidade (3 letras). Usa a tabela da operação e, quando não
 * houver entrada, deriva das iniciais das palavras significativas
 * ("São Bernardo do Campo" → SBC), completando com letras da 1ª palavra
 * quando necessário ("São Paulo" → SAO).
 */
export function siglaCidade(cidade?: string | null, uf?: string | null): string {
  const chave = normalizarCidade(cidade);
  if (!chave) return String(uf || "").toUpperCase().slice(0, 3);
  const direta = SIGLAS_CIDADE[chave];
  if (direta) return direta;

  const palavras = chave.split(" ").filter((p) => p && !IGNORADOS.has(p));
  const iniciais = palavras.map((p) => p[0]).join("");
  if (iniciais.length >= 3) return iniciais.slice(0, 3).toUpperCase();

  const primeira = palavras[0] || chave.replace(/\s/g, "");
  const completar = primeira.slice(1).replace(/[^a-z]/g, "");
  return (iniciais + completar).slice(0, 3).toUpperCase() || String(uf || "").toUpperCase();
}

/**
 * Município + sigla a partir de um endereço estruturado: "São Caetano do Sul (SCS)".
 * Usado no cabeçalho do WhatsApp e no alerta da rede (nunca o bairro).
 */
export function municipioComSigla(endereco?: EnderecoResumoRota | null): string {
  if (!endereco) return "";
  let cidade = String(endereco.cidade || "").trim();
  let uf = String(endereco.uf || endereco.estado || "").trim();
  if (!cidade) {
    const derivado = derivarBairroCidade(endereco.endereco || endereco.logradouro || "");
    cidade = derivado.cidade;
    if (!uf) uf = derivado.uf;
  }
  const fallback = String(endereco.endereco || endereco.logradouro || "").trim();
  if (!cidade) return fallback;
  const sigla = siglaCidade(cidade, uf);
  return sigla ? `${cidade} (${sigla})` : cidade;
}

/**
 * Município + sigla a partir de texto livre ("Bairro, Cidade - UF").
 * Usado quando só existe `origem`/`destino` textual (cards da Rede).
 */
export function municipioComSiglaDeTexto(texto?: string | null): string {
  const bruto = String(texto || "").trim();
  if (!bruto) return "";
  const derivado = derivarBairroCidade(bruto);
  const cidade = derivado.cidade || bruto.replace(/\s*[-–]\s*[A-Za-z]{2}$/, "").trim();
  if (!cidade) return bruto;
  const sigla = siglaCidade(cidade, derivado.uf);
  return sigla ? `${cidade} (${sigla})` : cidade;
}

/** "Bairro-SIGLA" (ou apenas "SIGLA" quando o bairro não veio no endereço). */
export function rotuloPontoRota(endereco?: EnderecoResumoRota | null): string {
  if (!endereco) return "";
  let bairro = String(endereco.bairro || "").trim();
  let cidade = String(endereco.cidade || "").trim();
  let uf = String(endereco.uf || endereco.estado || "").trim();

  // OS da Cotação Express nascem com bairro/cidade vazios — deriva do texto.
  if (!bairro || !cidade) {
    const derivado = derivarBairroCidade(
      endereco.endereco || endereco.logradouro || "",
    );
    if (!bairro) bairro = derivado.bairro;
    if (!cidade) cidade = derivado.cidade;
    if (!uf) uf = derivado.uf;
  }

  const sigla = siglaCidade(cidade, uf);
  if (!sigla) return bairro;
  return bairro ? `${bairro}-${sigla}` : sigla;
}

/**
 * Rótulo detalhado (coluna Rota): "Bairro Cidade" — mostra o bairro E a
 * cidade de cada ponta. Fallback para "Bairro UF" ou o texto do endereço.
 */
export function rotuloPontoRotaDetalhado(endereco?: EnderecoResumoRota | null): string {
  if (!endereco) return "";
  let bairro = String(endereco.bairro || "").trim();
  let cidade = String(endereco.cidade || "").trim();
  let uf = String(endereco.uf || endereco.estado || "").trim();

  if (!bairro || !cidade) {
    const derivado = derivarBairroCidade(endereco.endereco || endereco.logradouro || "");
    if (!bairro) bairro = derivado.bairro;
    if (!cidade) cidade = derivado.cidade;
    if (!uf) uf = derivado.uf;
  }

  if (bairro && cidade) return `${bairro} ${cidade}`;
  if (bairro) return uf ? `${bairro} ${uf}` : bairro;
  if (cidade) return uf ? `${cidade}-${uf}` : cidade;
  return uf || String(endereco.endereco || endereco.logradouro || "").trim();
}

/** Igual a `resumoRotaOS`, mas com bairro + cidade nas duas pontas. */
export function resumoRotaOSDetalhado(enderecos?: EnderecoResumoRota[] | null): ResumoRota {
  const lista = (Array.isArray(enderecos) ? enderecos : []).filter(
    (e) => e && (String(e.endereco || "").trim() || String(e.bairro || "").trim() || String(e.cidade || "").trim()),
  );
  if (lista.length === 0) return { texto: "", multiplos: false, paradas: 0 };

  const origem = rotuloPontoRotaDetalhado(lista[0]);
  if (lista.length === 1) return { texto: origem, multiplos: false, paradas: 1 };

  if (lista.length === 2) {
    const destino = rotuloPontoRotaDetalhado(lista[lista.length - 1]);
    return { texto: `${origem} ➡️ ${destino}`, multiplos: false, paradas: 2 };
  }

  return {
    texto: `${origem} ➡️ Múltiplos destinos (${lista.length} paradas)`,
    multiplos: true,
    paradas: lista.length,
  };
}

/** Atalho detalhado com fallback (coluna Rota da lista de OS). */
export function resumoRotaOSTextoDetalhado(
  enderecos?: EnderecoResumoRota[] | null,
  fallback = "",
): string {
  return resumoRotaOSDetalhado(enderecos).texto || fallback;
}

export interface ResumoRota {
  /** Texto pronto para exibição ("" quando não há paradas). */
  texto: string;
  /** true quando há mais de 2 paradas (múltiplos destinos). */
  multiplos: boolean;
  /** Quantidade de paradas consideradas. */
  paradas: number;
}

/**
 * Resumo da rota a partir do itinerário da OS:
 *   2 paradas  → "Pimentas-GRU ➡️ Demarchi-SBC"
 *   3+ paradas → "Pimentas-GRU ➡️ Múltiplos destinos (4 paradas)"
 */
export function resumoRotaOS(enderecos?: EnderecoResumoRota[] | null): ResumoRota {
  const lista = (Array.isArray(enderecos) ? enderecos : []).filter(
    (e) => e && (String(e.endereco || "").trim() || String(e.bairro || "").trim() || String(e.cidade || "").trim()),
  );
  if (lista.length === 0) return { texto: "", multiplos: false, paradas: 0 };

  const origem = rotuloPontoRota(lista[0]);
  if (lista.length === 1) return { texto: origem, multiplos: false, paradas: 1 };

  if (lista.length === 2) {
    const destino = rotuloPontoRota(lista[lista.length - 1]);
    return { texto: `${origem} ➡️ ${destino}`, multiplos: false, paradas: 2 };
  }

  return {
    texto: `${origem} ➡️ Múltiplos destinos (${lista.length} paradas)`,
    multiplos: true,
    paradas: lista.length,
  };
}

/** Atalho: texto do resumo ou `fallback` (ex.: unidade antiga) quando não há rota. */
export function resumoRotaOSTexto(
  enderecos?: EnderecoResumoRota[] | null,
  fallback = "",
): string {
  return resumoRotaOS(enderecos).texto || fallback;
}
