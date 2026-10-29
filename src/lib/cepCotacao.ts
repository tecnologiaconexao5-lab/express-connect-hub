// ============================================================
// COTACAO-EXPRESS — validação estrita de CEP (8 dígitos)
// O Mapbox pode devolver `postcode` PARCIAL (ex.: "06473" — só o
// prefixo de 5 dígitos da rua). CEP parcial NUNCA pode ser aceito
// como final: vira "" e o endereço é resgatado via busca reversa
// no ViaCEP (UF + cidade + logradouro). Nunca exibir CEP
// incompleto na UI do /cotacao-express.
// ============================================================

const somenteDigitos = (valor: string): string => valor.replace(/\D/g, "");

/**
 * Validação ESTRICTA de CEP: só devolve CEP formatado "00000-000"
 * quando há exatamente 8 dígitos numéricos — parciais (1–7 dígitos)
 * e vazios viram "".
 */
export const cepCompleto8 = (valor: string): string => {
  const d = somenteDigitos(valor);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : "";
};

/**
 * Remove um CEP parcial (ex.: "06473") de um texto como o place_name —
 * nunca exibir CEP incompleto na UI final. Só age em parciais reais
 * (5 a 7 dígitos) para não rasgar números de porta/qualquer texto.
 */
export function limparCepParcialDoTexto(texto: string, parcial: string): string {
  if (parcial.length < 5 || parcial.length >= 8) return texto;
  const esc = parcial.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto
    .replace(new RegExp(`(^|[^0-9])${esc}(?![0-9])`, "g"), "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^,\s*/, "")
    .replace(/,\s*$/, "")
    .trim();
}
