export type OrigemEnderecoHistorico = "cadastro" | "os";

export interface EnderecoHistoricoCliente {
  id: string;
  origem: OrigemEnderecoHistorico;
  nomeLocal?: string | null;
  tipoEndereco?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  referencia?: string | null;
  instrucoes?: string | null;
  contatoLocal?: string | null;
  telefoneLocal?: string | null;
  portaria?: string | null;
  doca?: string | null;
  procedimentoEntrada?: string | null;
  procedimentoSaida?: string | null;
  restricoes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  usos: number;
}

export const normalizarTextoEndereco = (valor?: string | null) =>
  (valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const chaveEndereco = (logradouro?: string | null, numero?: string | null) =>
  `${normalizarTextoEndereco(logradouro)}|${normalizarTextoEndereco(numero)}`;

const texto = (valor: unknown): string => {
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number" && Number.isFinite(valor)) return String(valor);
  return "";
};

const primeiroTexto = (...valores: unknown[]): string => {
  for (const valor of valores) {
    const encontrado = texto(valor);
    if (encontrado) return encontrado;
  }
  return "";
};

const numeroOuNulo = (valor: unknown): number | null => {
  if (valor === null || valor === undefined || valor === "") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const listaDeEnderecos = (valor: unknown): unknown[] => {
  if (Array.isArray(valor)) return valor;
  if (valor && typeof valor === "object") return [valor];
  if (typeof valor === "string") {
    try {
      const convertido = JSON.parse(valor);
      return Array.isArray(convertido) ? convertido : [];
    } catch {
      return [];
    }
  }
  return [];
};

const CAMPOS_PREENCHIVEIS: (keyof EnderecoHistoricoCliente)[] = [
  "nomeLocal",
  "tipoEndereco",
  "cep",
  "logradouro",
  "numero",
  "complemento",
  "bairro",
  "cidade",
  "uf",
  "referencia",
  "instrucoes",
  "contatoLocal",
  "telefoneLocal",
  "portaria",
  "doca",
  "procedimentoEntrada",
  "procedimentoSaida",
  "restricoes",
  "latitude",
  "longitude",
];

const preencherVazios = (destino: EnderecoHistoricoCliente, origem: EnderecoHistoricoCliente) => {
  const destinoGenerico = destino as unknown as Record<string, unknown>;
  const origemGenerica = origem as unknown as Record<string, unknown>;
  CAMPOS_PREENCHIVEIS.forEach((campo) => {
    const chave = campo as string;
    const valorAtual = destinoGenerico[chave];
    const valorNovo = origemGenerica[chave];
    const vazio = valorAtual === null || valorAtual === undefined || valorAtual === "";
    const temNovo = valorNovo !== null && valorNovo !== undefined && valorNovo !== "";
    if (vazio && temNovo) destinoGenerico[chave] = valorNovo;
  });
};

const enderecoDeCadastro = (linha: Record<string, unknown>): EnderecoHistoricoCliente => ({
  id: texto(linha.id),
  origem: "cadastro",
  nomeLocal: texto(linha.nome_local) || null,
  tipoEndereco: texto(linha.tipo_endereco) || null,
  cep: texto(linha.cep) || null,
  logradouro: texto(linha.logradouro) || null,
  numero: texto(linha.numero) || null,
  complemento: texto(linha.complemento) || null,
  bairro: texto(linha.bairro) || null,
  cidade: texto(linha.cidade) || null,
  uf: texto(linha.uf) || null,
  referencia: texto(linha.referencia) || null,
  instrucoes: texto(linha.instrucoes) || null,
  contatoLocal: texto(linha.contato_local) || null,
  telefoneLocal: texto(linha.telefone_local) || null,
  portaria: texto(linha.portaria) || null,
  doca: texto(linha.doca) || null,
  procedimentoEntrada: texto(linha.procedimento_entrada) || null,
  procedimentoSaida: texto(linha.procedimento_saida) || null,
  restricoes: texto(linha.restricoes) || null,
  latitude: numeroOuNulo(linha.latitude),
  longitude: numeroOuNulo(linha.longitude),
  usos: 0,
});

const enderecoDePontoOS = (ponto: Record<string, unknown>): EnderecoHistoricoCliente | null => {
  const logradouro = texto(ponto.logradouro);
  if (!logradouro) return null;

  return {
    id: "",
    origem: "os",
    nomeLocal: primeiroTexto(ponto.nome_local, ponto.nomeLocal) || null,
    tipoEndereco: primeiroTexto(ponto.tipo_parada, ponto.tipo) || null,
    cep: texto(ponto.cep) || null,
    logradouro,
    numero: texto(ponto.numero) || null,
    complemento: texto(ponto.complemento) || null,
    bairro: texto(ponto.bairro) || null,
    cidade: texto(ponto.cidade) || null,
    uf: primeiroTexto(ponto.estado, ponto.uf) || null,
    referencia: texto(ponto.referencia) || null,
    instrucoes:
      primeiroTexto(ponto.instrucoes, ponto.referencia, ponto.observacoes, ponto.observacao) || null,
    contatoLocal:
      primeiroTexto(
        ponto.contato_nome,
        ponto.contatoNome,
        ponto.procurar_por,
        ponto.contato,
        ponto.responsavel,
      ) || null,
    telefoneLocal:
      primeiroTexto(ponto.contato_telefone, ponto.contatoTelefone, ponto.telefone) || null,
    portaria: texto(ponto.portaria) || null,
    doca: texto(ponto.doca) || null,
    procedimentoEntrada:
      primeiroTexto(ponto.procedimento_entrada, ponto.procedimentoEntrada) || null,
    procedimentoSaida:
      primeiroTexto(ponto.procedimento_saida, ponto.procedimentoSaida) || null,
    restricoes:
      primeiroTexto(ponto.restricoes, ponto.outras_restricoes, ponto.outrasRestricoes) || null,
    latitude: numeroOuNulo(ponto.latitude),
    longitude: numeroOuNulo(ponto.longitude),
    usos: 1,
  };
};

export const montarHistoricoEnderecosCliente = (
  enderecosCadastro: Record<string, unknown>[],
  enderecosOS: unknown[],
): EnderecoHistoricoCliente[] => {
  const porChaveOS = new Map<string, EnderecoHistoricoCliente>();

  enderecosOS.forEach((registro) => {
    const pontos = listaDeEnderecos(
      registro && typeof registro === "object" && "enderecos" in registro
        ? (registro as Record<string, unknown>).enderecos
        : registro,
    );

    pontos.forEach((ponto) => {
      if (!ponto || typeof ponto !== "object" || Array.isArray(ponto)) return;
      const endereco = enderecoDePontoOS(ponto as Record<string, unknown>);
      if (!endereco) return;
      const chave = chaveEndereco(endereco.logradouro, endereco.numero);
      const existente = porChaveOS.get(chave);
      if (existente) {
        existente.usos += 1;
        preencherVazios(existente, endereco);
      } else {
        porChaveOS.set(chave, { ...endereco, id: `os-${chave}` });
      }
    });
  });

  const combinados = new Map<string, EnderecoHistoricoCliente>();

  enderecosCadastro.forEach((linha) => {
    const salvo = enderecoDeCadastro(linha);
    if (!salvo.logradouro) return;
    const chave = chaveEndereco(salvo.logradouro, salvo.numero);
    const doHistorico = porChaveOS.get(chave);
    const combinado: EnderecoHistoricoCliente = {
      ...salvo,
      usos: doHistorico?.usos || 0,
    };
    if (doHistorico) preencherVazios(combinado, doHistorico);
    combinados.set(chave, combinado);
  });

  porChaveOS.forEach((endereco, chave) => {
    if (!combinados.has(chave)) combinados.set(chave, endereco);
  });

  return [...combinados.values()]
    .sort((a, b) => {
      if (b.usos !== a.usos) return b.usos - a.usos;
      if (a.origem !== b.origem) return a.origem === "cadastro" ? -1 : 1;
      return normalizarTextoEndereco(a.logradouro).localeCompare(
        normalizarTextoEndereco(b.logradouro),
      );
    })
    .slice(0, 20);
};
