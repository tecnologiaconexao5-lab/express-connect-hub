/**
 * Teste de Validação - Cenários Reais
 */

const VEICULOS_POR_PESO_CUBAGEM = {
  moto: { pesoMin: 0, pesoMax: 40, cubagemMax: 0.08, label: "Moto" },
  carro_passeio: { pesoMin: 41, pesoMax: 120, cubagemMax: 0.3, label: "Carro de Passeio" },
  fiorino: { pesoMin: 121, pesoMax: 500, cubagemMax: 3, label: "Fiorino" },
  hr: { pesoMin: 121, pesoMax: 1800, cubagemMax: 10, label: "HR" },
  vuc: { pesoMin: 121, pesoMax: 2500, cubagemMax: 16, label: "VUC" },
  tres_quartos: { pesoMin: 121, pesoMax: 4000, cubagemMax: 20, label: "3/4" },
  toco: { pesoMin: 121, pesoMax: 8000, cubagemMax: 35, label: "Toco" },
  truck: { pesoMin: 121, pesoMax: 14000, cubagemMax: 50, label: "Truck" },
  carreta: { pesoMin: 121, pesoMax: 25000, cubagemMax: 80, label: "Carreta" },
  bitrem: { pesoMin: 121, pesoMax: 35000, cubagemMax: 110, label: "Bitrem" },
};

const TABELA_TESTE_VEICULOS_SP = {
  moto: {
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
  carro_passeio: {
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
  fiorino: {
    faixas: [
      { ateKm: 10, cliente: 120, prestador: 90 },
      { ateKm: 20, cliente: 160, prestador: 120 },
      { ateKm: 40, cliente: 230, prestador: 175 },
    ],
    excedenteCliente: 5.00,
    excedentePrestador: 4.00,
    kmBase: 40
  },
  hr: {
    faixas: [
      { ateKm: 10, cliente: 180, prestador: 140 },
      { ateKm: 20, cliente: 240, prestador: 190 },
      { ateKm: 40, cliente: 340, prestador: 270 },
    ],
    excedenteCliente: 7.00,
    excedentePrestador: 5.50,
    kmBase: 40
  },
  tres_quartos: {
    faixas: [
      { ateKm: 20, cliente: 420, prestador: 330 },
      { ateKm: 40, cliente: 600, prestador: 470 },
    ],
    excedenteCliente: 9.00,
    excedentePrestador: 7.00,
    kmBase: 40
  },
  truck: {
    faixas: [
      { ateKm: 20, cliente: 950, prestador: 760 },
      { ateKm: 40, cliente: 1350, prestador: 1080 },
    ],
    excedenteCliente: 16.00,
    excedentePrestador: 12.80,
    kmBase: 40
  },
  carreta: {
    faixas: [
      { ateKm: 20, cliente: 1500, prestador: 1200 },
      { ateKm: 40, cliente: 2100, prestador: 1680 },
    ],
    excedenteCliente: 22.00,
    excedentePrestador: 17.50,
    kmBase: 40
  },
};

function calcularCubagem(dados) {
  const volumes = dados.volumes || 1;
  const comprimento = dados.comprimento || 0;
  const largura = dados.largura || 0;
  const altura = dados.altura || 0;

  let cubagemTotal = dados.cubagem || 0;
  const temDimensoes = comprimento > 0 && largura > 0 && altura > 0;

  if (temDimensoes && cubagemTotal === 0) {
    const volumeUnitario = (comprimento / 100) * (largura / 100) * (altura / 100);
    cubagemTotal = volumeUnitario * volumes;
  }

  const volumeUnitario = volumes > 0 ? cubagemTotal / volumes : 0;
  const pesoPorVolume = volumes > 0 ? dados.peso / volumes : 0;

  return { cubagemTotal, volumeUnitario, pesoPorVolume };
}

function sugerirVeiculosPorCarga(dados) {
  const peso = dados.peso || 0;
  const cubagem = dados.cubagem || 0;

  const entradaOrdenada = Object.entries(VEICULOS_POR_PESO_CUBAGEM).sort(([, a], [, b]) => a.pesoMax - b.pesoMax);

  const primeiro = entradaOrdenada.find(([tipo, params]) => {
    const pesoNoRange = peso >= params.pesoMin && peso <= params.pesoMax;
    const cubagemOk = cubagem <= params.cubagemMax;
    return pesoNoRange && cubagemOk;
  });

  if (primeiro) {
    const [tipo, params] = primeiro;
    return [{ tipo, label: params.label, adequado: true, motivo: `Peso ${peso}kg no range` }];
  }

  return [{ tipo: 'carreta', label: 'Carreta', adequado: true, motivo: 'Veículo maior' }];
}

function calcularValorPorDistancia(distanciaKm, tipoVeiculo) {
  const tabela = TABELA_TESTE_VEICULOS_SP[tipoVeiculo];
  if (!tabela) return { valorCliente: 0, valorPrestador: 0 };

  const faixa = tabela.faixas.find(f => distanciaKm <= f.ateKm);

  if (faixa) {
    return {
      valorCliente: faixa.cliente,
      valorPrestador: faixa.prestador,
      margem: ((faixa.cliente - faixa.prestador) / faixa.cliente * 100).toFixed(1),
      tabela: 'TABELA_TESTE_VEICULOS_SP',
      faixa: `Até ${faixa.ateKm} km`
    };
  }

  const kmExcedente = distanciaKm - tabela.kmBase;
  const vCliente = tabela.faixas[tabela.faixas.length - 1].cliente + (kmExcedente * tabela.excedenteCliente);
  const vPrestador = tabela.faixas[tabela.faixas.length - 1].prestador + (kmExcedente * tabela.excedentePrestador);

  return {
    valorCliente: vCliente,
    valorPrestador: vPrestador,
    margem: ((vCliente - vPrestador) / vCliente * 100).toFixed(1),
    tabela: 'TABELA_TESTE_VEICULOS_SP',
    faixa: `Acima de ${tabela.kmBase} km`
  };
}

function verificarAlertasCubagem(dados, resultado) {
  const alertas = [];
  const volumes = dados.volumes || 0;
  const cubagem = resultado.cubagemTotal;

  if (cubagem > 50) alertas.push({ tipo: 'alerta', mensagem: `Cubagem muito alta (${cubagem.toFixed(2)}m³)` });
  if (volumes > 100) alertas.push({ tipo: 'aviso', mensagem: `Volumes altos (${volumes})` });

  return alertas;
}

console.log('='.repeat(60));
console.log('CENÁRIO A — MOTO (20kg, 1vol, 40x30x20)');
console.log('='.repeat(60));
const a = { peso: 20, volumes: 1, comprimento: 40, largura: 30, altura: 20 };
const calcA = calcularCubagem(a);
console.log('Cubagem Total:', calcA.cubagemTotal.toFixed(4), 'm³');
const sugA = sugerirVeiculosPorCarga({ ...a, cubagem: calcA.cubagemTotal });
console.log('Sugestão:', sugA[0]?.label, '| Adequado:', sugA[0]?.adequado);
console.log('');

console.log('='.repeat(60));
console.log('CENÁRIO B — CARRO PASSEIO (80kg, 2vol, 50x40x30)');
console.log('='.repeat(60));
const b = { peso: 80, volumes: 2, comprimento: 50, largura: 40, altura: 30 };
const calcB = calcularCubagem(b);
console.log('Cubagem Total:', calcB.cubagemTotal.toFixed(4), 'm³');
const sugB = sugerirVeiculosPorCarga({ ...b, cubagem: calcB.cubagemTotal });
console.log('Sugestão:', sugB[0]?.label, '| Adequado:', sugB[0]?.adequado);
console.log('');

console.log('='.repeat(60));
console.log('CENÁRIO C — CARGA GRANDE (40kg, 1000vol, 60x60x30)');
console.log('='.repeat(60));
const c = { peso: 40, volumes: 1000, comprimento: 60, largura: 60, altura: 30 };
const calcC = calcularCubagem(c);
console.log('Cubagem Total:', calcC.cubagemTotal.toFixed(2), 'm³');
const alertas = verificarAlertasCubagem(c, calcC);
console.log('Alertas:', alertas.map(a => a.mensagem).join(' | '));
const sugC = sugerirVeiculosPorCarga({ ...c, cubagem: calcC.cubagemTotal });
console.log('Sugestão:', sugC[0]?.label, '| Adequado:', sugC[0]?.adequado);
console.log('');

console.log('='.repeat(60));
console.log('CENÁRIO D1 — 15km MOTO');
console.log('='.repeat(60));
const d1 = calcularValorPorDistancia(15, 'moto');
console.log('Cliente:', d1.valorCliente, '| Prestador:', d1.valorPrestador);
console.log('Margem:', d1.margem + '%');
console.log('Tabela:', d1.tabela, '|', d1.faixa);
console.log('');

console.log('='.repeat(60));
console.log('CENÁRIO D2 — 40km HR');
console.log('='.repeat(60));
const d2 = calcularValorPorDistancia(40, 'hr');
console.log('Cliente:', d2.valorCliente, '| Prestador:', d2.valorPrestador);
console.log('Margem:', d2.margem + '%');
console.log('Tabela:', d2.tabela, '|', d2.faixa);
console.log('');

console.log('='.repeat(60));
console.log('CENÁRIO D3 — 50km TRUCK');
console.log('='.repeat(60));
const d3 = calcularValorPorDistancia(50, 'truck');
console.log('Cliente:', d3.valorCliente, '| Prestador:', d3.valorPrestador);
console.log('Margem:', d3.margem + '%');
console.log('Tabela:', d3.tabela, '|', d3.faixa);