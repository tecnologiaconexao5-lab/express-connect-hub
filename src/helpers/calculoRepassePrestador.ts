/**
 * Motor centralizado de cálculo de repasse do prestador
 * Única fonte de verdade para todo cálculo financeiro de prestador
 */

export interface DadosCalculoRepasse {
  custo_prestador?: number;
  pedagio?: number;
  adicionais?: number;
  descontos?: number;
  reembolso?: number;
  bonus?: number;
  descontoManual?: number;
}

export interface ResultadoRepasse {
  valorBase: number;
  pedagio: number;
  adicionais: number;
  descontos: number;
  reembolso: number;
  bonus: number;
  descontoManual: number;
  totalCredito: number;
  totalDebito: number;
  totalLiquido: number;
  memoriaCalculo: string[];
}

const N = (v: unknown): number => {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export function calcularRepassePrestador(dados: DadosCalculoRepasse): ResultadoRepasse {
  const valorBase = N(dados.custo_prestador);
  const pedagio = N(dados.pedagio);
  const adicionais = N(dados.adicionais);
  const descontos = N(dados.descontos);
  const reembolso = N(dados.reembolso);
  const bonus = N(dados.bonus);
  const descontoManual = N(dados.descontoManual);

  const totalCredito = valorBase + pedagio + adicionais + reembolso + bonus;
  const totalDebito = descontos + descontoManual;
  const totalLiquido = totalCredito - totalDebito;

  const memoriaCalculo: string[] = [];
  memoriaCalculo.push(`Valor base (custo_prestador): ${valorBase}`);
  if (pedagio > 0) memoriaCalculo.push(`+ Pedágio: ${pedagio}`);
  if (adicionais > 0) memoriaCalculo.push(`+ Adicionais: ${adicionais}`);
  if (reembolso > 0) memoriaCalculo.push(`+ Reembolso (manual): ${reembolso}`);
  if (bonus > 0) memoriaCalculo.push(`+ Bônus (manual): ${bonus}`);
  memoriaCalculo.push(`= Total créditos: ${totalCredito}`);
  if (descontos > 0) memoriaCalculo.push(`- Descontos (OS): ${descontos}`);
  if (descontoManual > 0) memoriaCalculo.push(`- Desconto (manual): ${descontoManual}`);
  memoriaCalculo.push(`= Total débitos: ${totalDebito}`);
  memoriaCalculo.push(`= Valor líquido: ${totalLiquido}`);

  return {
    valorBase,
    pedagio,
    adicionais,
    descontos,
    reembolso,
    bonus,
    descontoManual,
    totalCredito,
    totalDebito,
    totalLiquido: Math.round(totalLiquido * 100) / 100,
    memoriaCalculo,
  };
}
