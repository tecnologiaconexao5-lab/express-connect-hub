/**
 * Status do cadastro de cliente.
 *
 * A Cotação Express cria o cliente com `status = "pre-cadastro"` (nome +
 * WhatsApp apenas). O operador completa os dados e altera manualmente para
 * Ativo/Inativo na tela de detalhe do cliente.
 */
export type StatusClienteCodigo = "ativo" | "inativo" | "pre-cadastro";

export const STATUS_CLIENTE_PRE_CADASTRO: StatusClienteCodigo = "pre-cadastro";

export const STATUS_CLIENTE_OPCOES: Array<{ value: StatusClienteCodigo; label: string }> = [
  { value: "ativo", label: "Ativo" },
  { value: "inativo", label: "Inativo" },
  { value: "pre-cadastro", label: "Pré-cadastro" },
];

/** Normaliza o status do banco (que pode ter variações de caixa/acento). */
export function normalizarStatusCliente(valor?: string | null): StatusClienteCodigo {
  const s = String(valor || "").trim().toLowerCase();
  if (["pre-cadastro", "precadastro", "pré-cadastro", "pré cadastro"].includes(s)) {
    return STATUS_CLIENTE_PRE_CADASTRO;
  }
  if (s === "inativo" || s === "inactive") return "inativo";
  return "ativo";
}

export function rotuloStatusCliente(valor?: string | null): string {
  const codigo = normalizarStatusCliente(valor);
  return STATUS_CLIENTE_OPCOES.find((o) => o.value === codigo)?.label || "Ativo";
}

/**
 * Valores aceitos no filtro de busca de clientes da OS. Inclui o legado com
 * inicial maiúscula ("Ativo") além do padrão minúsculo e do pré-cadastro.
 */
export const STATUS_CLIENTES_SELECIONAVEIS = ["ativo", "Ativo", "pre-cadastro"];
