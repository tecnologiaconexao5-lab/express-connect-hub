import {
  TABELA_TESTE_VEICULOS_SP,
  type TabelaVeiculo,
  type FaixaTabela,
} from "@/helpers/tabelaFretePadrao";

export interface ResultadoCalculo {
  valorCliente: number;
  valorPrestador: number;
  custoEstimado: number;
  lucroEstimado: number;
  margem: number;
  tabelaAplicada: string;
  faixaAplicada: string;
  kmExcedente: number;
  tipoVeiculoAplicado: string;
}

export type { TabelaVeiculo, FaixaTabela };

export { TABELA_TESTE_VEICULOS_SP };

const MAP_VEICULO: Record<string, string> = {
  "moto": "moto",
  "carro_passeio": "carro_passeio",
  "fiorino": "fiorino",
  "kangoo": "fiorino",
  "kombi": "fiorino",
  "van": "hr",
  "hr": "hr",
  "vuc": "vuc",
  "tres_quartos": "tres_quartos",
  "toco": "toco",
  "truck": "truck",
  "bitruck": "truck",
  "carreta": "carreta",
  "bitrem": "carreta",
};

function normalizaVeiculo(tipoVeiculo: string): string {
  return MAP_VEICULO[tipoVeiculo?.toLowerCase().trim()] || "moto";
}

export function calcularValorPorDistancia({
  distanciaKm,
  tipoVeiculo,
}: {
  distanciaKm: number;
  tipoVeiculo: string;
}): ResultadoCalculo {
  const veiculoKey = normalizaVeiculo(tipoVeiculo);
  
  const tabela = TABELA_TESTE_VEICULOS_SP.find(t => t.veiculo === veiculoKey);
  
  if (!tabela) {
    const fallbackMoto = TABELA_TESTE_VEICULOS_SP.find(t => t.veiculo === "moto");
    if (fallbackMoto) {
      return calcularValorPorDistancia({ distanciaKm, tipoVeiculo: "moto" });
    }
    return {
      valorCliente: 0,
      valorPrestador: 0,
      custoEstimado: 0,
      lucroEstimado: 0,
      margem: 0,
      tabelaAplicada: "NINGUEM",
      faixaAplicada: "Sem tabela",
      kmExcedente: 0,
      tipoVeiculoAplicado: tipoVeiculo
    };
  }

  const km = Math.max(0, distanciaKm);
  const faixa = tabela.faixas.find(f => km <= f.ateKm);
  
  if (faixa) {
    const lucro = faixa.cliente - faixa.prestador;
    return {
      valorCliente: faixa.cliente,
      valorPrestador: faixa.prestador,
      custoEstimado: faixa.prestador,
      lucroEstimado: lucro,
      margem: faixa.cliente > 0 ? (lucro / faixa.cliente) * 100 : 0,
      tabelaAplicada: "TABELA_TESTE_VEICULOS_SP",
      faixaAplicada: `Até ${faixa.ateKm} km`,
      kmExcedente: 0,
      tipoVeiculoAplicado: tipoVeiculo
    };
  }

  const kmExcedente = Math.max(0, km - tabela.kmBase);
  const vCliente = tabela.faixas[tabela.faixas.length - 1].cliente + (kmExcedente * tabela.excedenteCliente);
  const vPrestador = tabela.faixas[tabela.faixas.length - 1].prestador + (kmExcedente * tabela.excedentePrestador);
  const lucro = vCliente - vPrestador;

  return {
    valorCliente: vCliente,
    valorPrestador: vPrestador,
    custoEstimado: vPrestador,
    lucroEstimado: lucro,
    margem: vCliente > 0 ? (lucro / vCliente) * 100 : 0,
    tabelaAplicada: "TABELA_TESTE_VEICULOS_SP",
    faixaAplicada: `Acima de ${tabela.kmBase} km`,
    kmExcedente: kmExcedente,
    tipoVeiculoAplicado: tipoVeiculo
  };
}

export function getFaixaTabela(veiculo: string, km: number): string {
  const resultado = calcularValorPorDistancia({ distanciaKm: km, tipoVeiculo: veiculo });
  return resultado.faixaAplicada;
}