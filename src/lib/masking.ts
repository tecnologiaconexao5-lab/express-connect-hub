/**
 * REC-01 - Utilitarios de mascaramento de PII
 * CPF, CNPJ, telefone, email
 */

// Mascarar CPF: 12345678900 vira 123.***.***-00
// Mascarar CNPJ: 12345678000190 vira XX.XXX.XXX XXXX-XX
export function mascararCPF(documento: string | null | undefined): string {
  if (!documento) return "Não informado";
  const digits = documento.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.***.***/****-${digits.slice(12)}`;
  }
  return documento;
}

/**
 * Mascarar telefone: (11) 99999-1234 vira (11) 9****-1234
 */
export function mascararTelefone(telefone: string | null | undefined): string {
  if (!telefone) return "";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const ddd = digits.slice(0, 2);
    const primeiro = digits.slice(2, 3);
    const ultimos = digits.slice(-4);
    return `(${ddd}) ${primeiro}****-${ultimos}`;
  }
  if (digits.length > 4) {
    return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
  }
  return telefone;
}

/**
 * Mascarar email: joao@example.com vira j***@example.com
 */
export function mascararEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 1) return `*@${domain}`;
  return `${local[0]}***@${domain}`;
}

/**
 * Mascarar nome: Joao da Silva vira Joao d.***
 */
export function mascararNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const parts = nome.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] || "";
  return `${parts[0]} ${parts.slice(1).map(p => p[0] + ".").join(" ")}`;
}
