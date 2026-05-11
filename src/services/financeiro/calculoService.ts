/**
 * Serviço de Cálculo de Frete por Distância e Veículo
 * Tabela Teste SP - Valores fallback quando não houver tabela específica do cliente
 */

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

export interface FaixaTabela {
  ateKm: number;
  cliente: number;
  prestador: number;
}

export interface TabelaVeiculo {
  veiculo: string;
  faixas: FaixaTabela[];
  excedenteCliente: number;
  excedentePrestador: number;
  kmBase: number;
}

export const TABELA_TESTE_VEICULOS_SP: TabelaVeiculo[] = [
  {
    veiculo: "moto",
    faixas: [
      { ateKm: 6, cliente: 25, prestador: 20 },
      { ateKm: 10, cliente: 35, prestador: 28 },
      { ateKm: 15, cliente: 45, prestador: 36 },
      { ateKm: 20, cliente: 55, prestador: 44 },
    ],
    excedenteCliente: 2.50,
    excedentePrestador: 2.00,
    kmBase: 20
  },
  {
    veiculo: "carro_passeio",
    faixas: [
      { ateKm: 6, cliente: 45, prestador: 35 },
      { ateKm: 10, cliente: 60, prestador: 45 },
      { ateKm: 15, cliente: 75, prestador: 58 },
      { ateKm: 20, cliente: 90, prestador: 70 },
    ],
    excedenteCliente: 4.00,
    excedentePrestador: 3.20,
    kmBase: 20
  },
  {
    veiculo: "fiorino",
    faixas: [
      { ateKm: 10, cliente: 120, prestador: 90 },
      { ateKm: 20, cliente: 160, prestador: 120 },
      { ateKm: 40, cliente: 230, prestador: 175 },
    ],
    excedenteCliente: 5.00,
    excedentePrestador: 4.00,
    kmBase: 40
  },
  {
    veiculo: "hr",
    faixas: [
      { ateKm: 10, cliente: 180, prestador: 140 },
      { ateKm: 20, cliente: 240, prestador: 190 },
      { ateKm: 40, cliente: 340, prestador: 270 },
    ],
    excedenteCliente: 7.00,
    excedentePrestador: 5.50,
    kmBase: 40
  },
  {
    veiculo: "vuc",
    faixas: [
      { ateKm: 10, cliente: 180, prestador: 140 },
      { ateKm: 20, cliente: 240, prestador: 190 },
      { ateKm: 40, cliente: 340, prestador: 270 },
    ],
    excedenteCliente: 7.00,
    excedentePrestador: 5.50,
    kmBase: 40
  },
  {
    veiculo: "tres_quartos",
    faixas: [
      { ateKm: 20, cliente: 420, prestador: 330 },
      { ateKm: 40, cliente: 600, prestador: 470 },
    ],
    excedenteCliente: 9.00,
    excedentePrestador: 7.00,
    kmBase: 40
  },
  {
    veiculo: "toco",
    faixas: [
      { ateKm: 20, cliente: 650, prestador: 520 },
      { ateKm: 40, cliente: 920, prestador: 735 },
    ],
    excedenteCliente: 12.00,
    excedentePrestador: 9.50,
    kmBase: 40
  },
  {
    veiculo: "truck",
    faixas: [
      { ateKm: 20, cliente: 950, prestador: 760 },
      { ateKm: 40, cliente: 1350, prestador: 1080 },
    ],
    excedenteCliente: 16.00,
    excedentePrestador: 12.80,
    kmBase: 40
  },
  {
    veiculo: "carreta",
    faixas: [
      { ateKm: 20, cliente: 1500, prestador: 1200 },
      { ateKm: 40, cliente: 2100, prestador: 1680 },
    ],
    excedenteCliente: 22.00,
    excedentePrestador: 17.50,
    kmBase: 40
  },
];

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