export function normalizeClienteNome(nome: string | null | undefined): string {
  if (!nome) return "";
  // TODO: Futura migration - A tabela tabelas_valores deve utilizar cliente_id (UUID)
  // em vez do nome do cliente em formato string. Isso evitará problemas de normalização,
  // letras maiúsculas/minúsculas e mudanças de razão social.
  return nome.trim().toUpperCase();
}
