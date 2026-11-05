import { supabase } from "@/lib/supabase";
import {
  fromOfertaRow,
  type OfertaPublica,
} from "@/modules/recrutamento/services/ofertasPublicasService";

export type ResultadoPreCadastros =
  | { ok: true; ofertas: OfertaPublica[] }
  | { ok: false; erro: string; backendIndisponivel: boolean };

function normalizar(valor: string): string {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function backendIndisponivel(erro: string, codigo?: string): boolean {
  const mensagem = normalizar(erro);
  return (
    codigo === "42P01" ||
    codigo === "PGRST205" ||
    codigo === "PGRST204" ||
    mensagem.includes("does not exist") ||
    mensagem.includes("could not find the table") ||
    mensagem.includes("schema cache")
  );
}

/**
 * Consulta a camada de serviços da gestão de pré-cadastros.
 * Busca `public.recrutamento_ofertas` ordenado pelos mais recentes.
 */
export async function listarPreCadastros(): Promise<ResultadoPreCadastros> {
  try {
    const { data, error } = await supabase
      .from("recrutamento_ofertas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      const erro = error.message || error.details || "Não foi possível consultar os pré-cadastros.";
      return { ok: false, erro, backendIndisponivel: backendIndisponivel(erro, error.code) };
    }

    return {
      ok: true,
      ofertas: (data ?? []).map((row) => fromOfertaRow(row as Record<string, unknown>)),
    };
  } catch (error) {
    const err = error as { message?: string; code?: string; details?: string };
    const erro = err?.message || "Não foi possível consultar os pré-cadastros.";
    return { ok: false, erro, backendIndisponivel: backendIndisponivel(erro, err?.code) };
  }
}

export interface CaracteristicasPreCadastro {
  categoriaAtuacao: string;
  marcaMoto: string;
  cilindrada: string;
  marcaRastreador: string;
  compartimento: string;
  buscaContrato: string;
  modalidadesAdicionais: string[];
  outras: string[];
}

export const CATEGORIA_ATUACAO_LABELS: Record<string, string> = {
  motoboy: "Motoboy",
  motorista_agregado: "Motorista Agregado",
  motorista: "Motorista",
  frotista: "Frotista / Dono de Veículo",
};

export const COMPARTIMENTO_LABELS: Record<string, string> = {
  bau: "Baú",
  mochila: "Mochila",
  bag: "Bag",
  sem: "Sem compartimento",
};

export const BUSCA_CONTRATO_LABELS: Record<string, string> = {
  fixo: "Contrato fixo",
  esporadico: "Entregas esporádicas",
  ambos: "Ambos",
};

export const VINCULO_VEICULO_LABELS: Record<string, string> = {
  proprio: "Próprio",
  agregado: "Agregado",
  terceiro: "Terceiro",
};

/** Extrai os valores prefixados do array `caracteristicas` sem perder os itens legados. */
export function extrairCaracteristicas(lista: string[]): CaracteristicasPreCadastro {
  const resultado: CaracteristicasPreCadastro = {
    categoriaAtuacao: "",
    marcaMoto: "",
    cilindrada: "",
    marcaRastreador: "",
    compartimento: "",
    buscaContrato: "",
    modalidadesAdicionais: [],
    outras: [],
  };

  for (const item of lista || []) {
    const texto = String(item || "").trim();
    if (!texto) continue;
    const indice = texto.indexOf(":");
    if (indice === -1) {
      resultado.outras.push(texto);
      continue;
    }
    const chave = texto.slice(0, indice).trim();
    const valor = texto.slice(indice + 1).trim();
    if (!valor) {
      resultado.outras.push(texto);
      continue;
    }
    switch (chave) {
      case "categoria_atuacao":
        resultado.categoriaAtuacao = valor;
        break;
      case "marca_moto":
        resultado.marcaMoto = valor;
        break;
      case "cilindrada":
        resultado.cilindrada = valor;
        break;
      case "marca_rastreador":
        resultado.marcaRastreador = valor;
        break;
      case "compartimento":
        resultado.compartimento = valor;
        break;
      case "busca_contrato":
        resultado.buscaContrato = valor;
        break;
      case "modalidade_adicional":
        resultado.modalidadesAdicionais.push(valor);
        break;
      default:
        resultado.outras.push(texto);
        break;
    }
  }

  return resultado;
}

export interface RespostaTriagem {
  chave: string;
  pergunta: string;
  resposta: string;
}

const PERGUNTAS_TRIAGEM: Record<string, string> = {
  "Local principal de carregamento":
    "Em qual operação/cliente você carrega principalmente hoje? (Nome da operação)",
  "Média de faturamento mensal atual": "Qual a sua média de faturamento mensal atual?",
  "Valor semanal": "Valor semanal",
  "Imprevisto/atraso na rota":
    "Quando ocorre um imprevisto ou atraso na rota, qual costuma ser a sua primeira atitude?",
  "O que mais valoriza na parceria": "O que mais valoriza numa parceria de entregas?",
  Operacao: "Com qual tipo de operação logística está mais acostumado?",
  Manutencao: "Como organiza a manutenção do seu veículo?",
  Carga: "Ao transportar uma carga frágil, qual o seu foco?",
  Comunicacao: "Se houver divergência na entrega com o cliente final, o que faz?",
  Tecnologia: "Como lida com aplicativos de rotas e entregas?",
  Disponibilidade: "Em semanas de alta demanda, você...",
  Consumo: "Qual a média de km por litro que o seu veículo costuma fazer?",
  Abastecimento: "Como costuma organizar o abastecimento para uma operação fixa?",
  Comprometimento:
    "Se assumir uma rota fixa, mas surgir uma entrega avulsa pagando mais no mesmo dia, o que você faz?",
  "Media de paradas": "Quantas entregas/paradas costuma fazer por dia em média?",
};

/**
 * Converte a string livre `observacoes` em pares pergunta/resposta legíveis.
 * Mantém textos livres do interessado separados para não se perderem.
 */
export function extrairTriagem(observacoes: string): {
  respostas: RespostaTriagem[];
  textoLivre: string;
} {
  const partes = String(observacoes || "")
    .split(/\s*\|\s*/)
    .map((parte) => parte.trim())
    .filter(Boolean);
  const respostas: RespostaTriagem[] = [];
  const livres: string[] = [];

  for (const parte of partes) {
    const indice = parte.indexOf(":");
    if (indice === -1) {
      livres.push(parte);
      continue;
    }
    const chave = parte.slice(0, indice).trim();
    const resposta = parte.slice(indice + 1).trim();
    const pergunta = PERGUNTAS_TRIAGEM[chave];
    if (pergunta && resposta) {
      respostas.push({ chave, pergunta, resposta });
    } else {
      livres.push(parte);
    }
  }

  return { respostas, textoLivre: livres.join(" | ") };
}

/** Rótulo amigável da categoria de atuação (com fallback para o tipo da oferta). */
export function rotuloCategoriaAtuacao(
  categoria: string,
  tipoOferta: string,
): string {
  if (categoria && CATEGORIA_ATUACAO_LABELS[categoria]) {
    return CATEGORIA_ATUACAO_LABELS[categoria];
  }
  if (tipoOferta === "motoboy") return "Motoboy";
  if (tipoOferta === "disponibilidade_veiculo") return "Frotista / Dono de Veículo";
  if (tipoOferta === "motorista_veiculo_proprio") return "Motorista Agregado";
  return "—";
}

/** Resumo de veículo com marca, modelo, ano e cilindrada para a tabela. */
export function resumoVeiculoPreCadastro(oferta: OfertaPublica): string {
  const extras = extrairCaracteristicas(oferta.caracteristicas);
  const partes = [
    extras.marcaMoto || "",
    oferta.veiculoModelo || "",
    oferta.veiculoAno !== null ? String(oferta.veiculoAno) : "",
  ].filter(Boolean);
  if (partes.length === 0) {
    return oferta.veiculoTipo || "—";
  }
  const base = partes.join(" ");
  return oferta.veiculoTipo && extras.marcaMoto ? base : `${oferta.veiculoTipo} ${base}`.trim();
}
