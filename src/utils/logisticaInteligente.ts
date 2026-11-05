/**
 * GD-07 — Motor de match operacional e sinónimos logísticos.
 *
 * A busca deixa de ser um filtro passivo de substring e passa a pontuar a oferta
 * contra demanda (veículo, região, modalidade e texto livre), permitindo ordenar
 * quem tem maior aderência ao pedido.
 */

export interface OfertaMatchLike {
  nome?: string | null;
  protocolo?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpfCnpj?: string | null;
  cidade?: string | null;
  uf?: string | null;
  regioes?: string[] | null;
  modalidades?: string[] | null;
  veiculoTipo?: string | null;
  veiculoModelo?: string | null;
  carroceria?: string | null;
  caracteristicas?: string[] | null;
}

export interface ResultadoMatchOperacional {
  match: boolean;
  score: number;
  motivos: string[];
}

export function normalizarLogistica(valor: string | null | undefined): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Grupos de veículos equivalentes na operação. */
export const GRUPOS_VEICULOS: string[][] = [
  ["fiorino", "kangoo", "partner", "doblo", "furgao", "utilitario", "van"],
  ["vuc", "hr", "kia bongo", "bongo", "iveco daily", "daily", "3/4"],
  ["moto", "motoboy", "cg", "motocicleta"],
];

export function grupoVeiculo(termo: string): string[] | null {
  const alvo = normalizarLogistica(termo);
  if (!alvo) return null;
  return (
    GRUPOS_VEICULOS.find((grupo) =>
      grupo.some((item) => alvo.includes(item) || item.includes(alvo)),
    ) ?? null
  );
}

export function termosVeiculo(termo: string): string[] {
  const grupo = grupoVeiculo(termo);
  const alvo = normalizarLogistica(termo);
  return grupo ? [...grupo] : alvo ? [alvo] : [];
}

function camposVeiculo(oferta: OfertaMatchLike): string {
  return normalizarLogistica(
    [oferta.veiculoTipo, oferta.veiculoModelo, oferta.carroceria]
      .filter(Boolean)
      .join(" "),
  );
}

/** Verdadeiro quando o termo de veículo pertence ao mesmo grupo de equivalência. */
export function veiculoCorresponde(termo: string, oferta: OfertaMatchLike): boolean {
  const alvo = normalizarLogistica(termo);
  if (!alvo) return true;
  const campos = camposVeiculo(oferta);
  const termos = termosVeiculo(alvo);
  return termos.some((item) => campos.includes(item));
}

const MODALIDADE_SINONIMOS: Record<string, string> = {
  urgente: "urgente",
  urgencia: "urgente",
  esporadica: "esporadica",
  esporadico: "esporadica",
  esporadicas: "esporadica",
  esporadicos: "esporadica",
  fixa: "fixa",
  fixo: "fixa",
  fixos: "fixa",
  fixas: "fixa",
  contrato: "fixa",
  contratos: "fixa",
  recorrente: "recorrente",
  recorrentes: "recorrente",
  agregado: "agregado",
  cobertura: "cobertura",
};

const REGIAO_SINONIMOS: Array<{ chave: string; termos: string[] }> = [
  { chave: "abc paulista", termos: ["abc paulista", "abc", "grande sp", "sp"] },
  { chave: "zona sul", termos: ["zona sul", "sul", "grande sp", "sao paulo", "sp"] },
  { chave: "zona norte", termos: ["zona norte", "norte", "grande sp", "sao paulo", "sp"] },
  { chave: "zona leste", termos: ["zona leste", "leste", "grande sp", "sao paulo", "sp"] },
  { chave: "zona oeste", termos: ["zona oeste", "oeste", "grande sp", "sao paulo", "sp"] },
  { chave: "guarulhos", termos: ["guarulhos", "grande sp", "sp"] },
  { chave: "abc", termos: ["abc", "abc paulista", "grande sp", "sp"] },
  { chave: "campinas", termos: ["campinas", "interior sp", "sp"] },
  {
    chave: "sao paulo",
    termos: ["sao paulo", "grande sp", "abc paulista", "interior sp", "litoral sp", "sp"],
  },
  { chave: "rio de janeiro", termos: ["rio de janeiro", "rj"] },
  { chave: "belo horizonte", termos: ["belo horizonte", "mg"] },
  { chave: "curitiba", termos: ["curitiba", "pr"] },
  { chave: "porto alegre", termos: ["porto alegre", "rs"] },
  { chave: "salvador", termos: ["salvador", "ba"] },
  { chave: "recife", termos: ["recife", "pe"] },
  { chave: "fortaleza", termos: ["fortaleza", "ce"] },
];

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "para", "por", "com", "e", "o", "a", "os", "as",
  "em", "no", "na", "um", "uma", "que", "the", "of", "and",
]);

function camposRegiao(oferta: OfertaMatchLike): string {
  return normalizarLogistica(
    [...(oferta.regioes || []), oferta.cidade, oferta.uf].filter(Boolean).join(" "),
  );
}

function modalidadesOferta(oferta: OfertaMatchLike): Set<string> {
  const modalidades = new Set((oferta.modalidades || []).map((item) => normalizarLogistica(item)));
  for (const caracteristica of oferta.caracteristicas || []) {
    const texto = normalizarLogistica(caracteristica);
    if (texto.startsWith("modalidade_adicional:")) {
      modalidades.add(texto.slice("modalidade_adicional:".length));
    }
  }
  return modalidades;
}

function textoTerritorio(oferta: OfertaMatchLike): string {
  return normalizarLogistica(
    [
      oferta.nome,
      oferta.protocolo,
      oferta.email,
      oferta.telefone,
      (oferta.telefone || "").replace(/\D/g, ""),
      oferta.cpfCnpj,
      (oferta.cpfCnpj || "").replace(/\D/g, ""),
      oferta.cidade,
      oferta.uf,
      ...(oferta.regioes || []),
      ...(oferta.modalidades || []),
      oferta.veiculoTipo,
      oferta.veiculoModelo,
      oferta.carroceria,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

/**
 * Pontua a aderência da oferta à string digitada.
 * - Texto livre (nome, protocolo, telefone, e-mail, cidade, veículo) +1 por termo.
 * - Modalidade (urgente, fixo, esporádico, cobertura...) +3.
 * - Veículo por grupo de equivalência (Fiorino/Kangoo/Partner...) +3.
 * - Região (Guarulhos, Zona Sul, ABC, Grande SP...) +2.
 */
export function avaliarMatchOferta(
  oferta: OfertaMatchLike,
  busca: string,
): ResultadoMatchOperacional {
  const buscaNormalizada = normalizarLogistica(busca);
  if (!buscaNormalizada) return { match: true, score: 0, motivos: [] };

  const texto = textoTerritorio(oferta);
  const regiaoCampos = camposRegiao(oferta);
  const modalidades = modalidadesOferta(oferta);
  const veiculoCampos = camposVeiculo(oferta);

  const termos = buscaNormalizada
    .split(/\s+/)
    .map((termo) => termo.trim())
    .filter((termo) => (termo.length >= 3 || /^[a-z]{2}$/.test(termo)) && !STOPWORDS.has(termo));

  const motivos: string[] = [];
  const termosTexto = new Set<string>();
  const gruposVeiculo = new Set<string>();
  const modalidadesEncontradas = new Set<string>();

  for (const termo of termos) {
    if (termo.length >= 3 && texto.includes(termo)) {
      termosTexto.add(termo);
    }

    const modalidade = MODALIDADE_SINONIMOS[termo];
    if (modalidade && modalidades.has(modalidade)) {
      modalidadesEncontradas.add(modalidade);
    }

    const grupo = grupoVeiculo(termo);
    if (grupo && grupo.some((item) => veiculoCampos.includes(item))) {
      gruposVeiculo.add(grupo[0]);
    }

    const uf = normalizarLogistica(oferta.uf);
    if (termo.length === 2 && termo === uf) {
      termosTexto.add(termo);
    }
  }

  const regiao = REGIAO_SINONIMOS.find(({ chave }) => buscaNormalizada.includes(chave));
  const regiaoEncontrada = Boolean(
    regiao && regiao.termos.some((termo) => regiaoCampos.includes(termo)),
  );

  let score = 0;
  if (termosTexto.size > 0) {
    score += termosTexto.size;
    motivos.push(`texto:${[...termosTexto].join(",")}`);
  }
  if (modalidadesEncontradas.size > 0) {
    score += modalidadesEncontradas.size * 3;
    motivos.push(`modalidade:${[...modalidadesEncontradas].join(",")}`);
  }
  if (gruposVeiculo.size > 0) {
    score += gruposVeiculo.size * 3;
    motivos.push(`veiculo:${[...gruposVeiculo].join(",")}`);
  }
  if (regiaoEncontrada) {
    score += 2;
    motivos.push(`regiao:${regiao?.chave}`);
  }

  return { match: score > 0, score, motivos };
}
