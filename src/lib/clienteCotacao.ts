/**
 * Identificação de clientes originados pela Cotação Express.
 *
 * A cotação pública cria um pré-cadastro (`clientes.status = 'pre-cadastro'`)
 * e marca o orçamento/OS com o id da cotação (`pedido_interno`/`carga.origem_cotacao`).
 * Este helper reúne essas evidências para exibir o badge "Cliente Cotação"
 * nas listagens, sem depender de uma única coluna.
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClienteCotacaoInput {
  /** `carga.origem_cotacao` da OS (id da cotação) ou marcador equivalente. */
  origemCotacao?: unknown;
  /** Id da cotação em `pedido_interno` do orçamento. */
  pedidoInterno?: string | null;
  /** Observações gerais (contêm "Cotação web" / "ID da cotação" nos fluxos antigos). */
  observacoes?: string | null;
  /** `clientes.status` — `pre-cadastro` identifica cliente sem cadastro completo. */
  clienteStatus?: string | null;
  /** `clientes.origem_comercial` — gravada como "Cotação Express". */
  clienteOrigemComercial?: string | null;
}

export function clienteVeioDeCotacao(input: ClienteCotacaoInput): boolean {
  if (input.origemCotacao !== undefined && input.origemCotacao !== null && input.origemCotacao !== "") {
    return true;
  }

  const pedido = (input.pedidoInterno || "").trim();
  if (pedido && UUID_REGEX.test(pedido)) return true;

  const obs = (input.observacoes || "").toLowerCase();
  if (obs.includes("cotação web") || obs.includes("cotacao web") || obs.includes("id da cotação")) {
    return true;
  }

  const status = (input.clienteStatus || "").trim().toLowerCase();
  const origem = (input.clienteOrigemComercial || "").trim().toLowerCase();
  return status === "pre-cadastro" || origem.includes("cotação") || origem.includes("cotacao");
}
