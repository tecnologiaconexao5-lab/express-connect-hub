/**
 * Formatação de exibição para cadastros (somente apresentação, não altera dados).
 * - CPF/CNPJ: 000.000.000-00 / 00.000.000/0000-00
 * - Telefone: (00) 0000-0000 / (00) 00000-0000 (remove DDI 55)
 */
export function somenteDigitos(valor?: string | null): string {
  return String(valor ?? "").replace(/\D/g, "");
}

export function formatarCpfCnpj(valor?: string | null): string {
  const digitos = somenteDigitos(valor);
  if (digitos.length === 14) {
    return `${digitos.slice(0, 2)}.${digitos.slice(2, 5)}.${digitos.slice(5, 8)}/${digitos.slice(8, 12)}-${digitos.slice(12)}`;
  }
  if (digitos.length === 11) {
    return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
  }
  return valor ? String(valor).trim() : "";
}

export function formatarTelefone(valor?: string | null): string {
  let digitos = somenteDigitos(valor);
  if (!digitos) return "";
  if ((digitos.length === 13 || digitos.length === 12) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  if (digitos.length === 11) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
  }
  if (digitos.length === 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return valor ? String(valor).trim() : "";
}

/** Capitalização única para badges de status (Ativo, Inativo, Pré-cadastro...). */
export function capitalizarStatus(valor?: string | null): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  const minusculo = texto.toLowerCase();
  if (["pre-cadastro", "precadastro", "pré-cadastro", "pré cadastro"].includes(minusculo)) {
    return "Pré-cadastro";
  }
  return minusculo.charAt(0).toUpperCase() + minusculo.slice(1);
}
