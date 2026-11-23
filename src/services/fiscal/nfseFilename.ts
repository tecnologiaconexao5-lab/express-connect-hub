import type { FiscalNfse } from "@/types/fiscal";

const LIMITE_NOME_CLIENTE = 40;

function removerAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function textoOuVazio(valor: unknown): string {
  return valor == null ? "" : String(valor).trim();
}

/** Sanitiza um trecho para uso seguro em nome de arquivo (Windows/macOS). */
export function sanitizarNomeArquivo(valor: string, limite = 120): string {
  return removerAcentos(String(valor || ""))
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/[^A-Za-z0-9_.,$ -]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, limite)
    .replace(/^_+|_+$/g, "");
}

/** Data da nota em America/Sao_Paulo no formato DD-MM-AAAA. */
function formatarDataSP(valor?: string | null): string {
  const texto = String(valor || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");
    return `${dia}-${mes}-${ano}`;
  }
  const data = texto ? new Date(texto) : new Date();
  const segura = Number.isNaN(data.getTime()) ? new Date() : data;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(segura).replace(/\//g, "-");
}

export interface NomeArquivoNfseOpcoes {
  tomadorNome?: string | null;
  valor?: number | null;
  dataEmissao?: string | null;
}

/**
 * Nome padronizado: NFSe_<NUMERO>_<TOMADOR>_<DD-MM-AAAA>_R$<VALOR>
 * (extensão aplicada por `nomeArquivoNfse`).
 */
export function nomeBaseNfse(
  nfse: FiscalNfse,
  opcoes: NomeArquivoNfseOpcoes = {},
): string {
  const meta = (nfse.metadata || {}) as Record<string, unknown>;
  const tomador = (meta.tomador || {}) as Record<string, unknown>;
  const emissao = (meta.emissao || {}) as Record<string, unknown>;

  const numero = sanitizarNomeArquivo(textoOuVazio(nfse.numero) || "RASCUNHO", 24) || "RASCUNHO";

  const tomadorBruto = textoOuVazio(opcoes.tomadorNome) ||
    textoOuVazio(tomador.nome) ||
    textoOuVazio(tomador.razao_social) ||
    textoOuVazio(meta.cliente_nome) ||
    textoOuVazio(meta.tomador_nome) ||
    "TOMADOR";
  const tomadorSanitizado =
    (sanitizarNomeArquivo(tomadorBruto, LIMITE_NOME_CLIENTE) || "TOMADOR").toUpperCase();

  const data = formatarDataSP(
    textoOuVazio(opcoes.dataEmissao) ||
      textoOuVazio(nfse.data_emissao) ||
      textoOuVazio(emissao.data_emissao) ||
      textoOuVazio(meta.data_emissao) ||
      nfse.created_at,
  );

  const valorBruto = Number(
    opcoes.valor ?? meta.valor_liquido ?? meta.valor_servico ?? nfse.valor ?? 0,
  );
  const valor = Number.isFinite(valorBruto) ? Math.max(0, valorBruto) : 0;
  const valorFormatado = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `NFSe_${numero}_${tomadorSanitizado}_${data}_R$${valorFormatado}`;
}

/** Nome padronizado com extensão (`pdf` para DANFSe/modelo, `xml` para XML). */
export function nomeArquivoNfse(
  nfse: FiscalNfse,
  extensao: "pdf" | "xml" = "pdf",
  opcoes: NomeArquivoNfseOpcoes = {},
): string {
  const ext = String(extensao || "pdf").replace(/^\./, "").toLowerCase();
  return `${nomeBaseNfse(nfse, opcoes)}.${ext}`;
}
