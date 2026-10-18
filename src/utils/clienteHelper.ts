export function normalizeClienteNome(nome: string | null | undefined): string {
  if (!nome) return "";
  return nome.trim().toUpperCase();
}

export function normalizarTextoComparacao(valor: string | null | undefined): string {
  if (!valor) return "";
  return String(valor)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}
