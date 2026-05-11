export interface DadosCarga {
  peso?: number;
  volumes?: number;
  comprimento?: number;
  largura?: number;
  altura?: number;
  cubagem?: number;
  tipo?: "Seca" | "Refrigerada" | "Congelada" | "Mista" | "";
}

export interface ResultadoCubagem {
  cubagemTotal: number;
  volumeUnitario: number;
  pesoPorVolume: number;
  tipoCarga: "Seca" | "Refrigerada" | "Congelada" | "Mista";
  cubagemManual: boolean;
}

export interface SugestaoVeiculo {
  tipo: string;
  label: string;
  motivo: string;
 kgNecessario: number;
  m3Necessario: number;
  dimensoesMinimas: string;
  adequado: boolean;
  refrigerado: boolean;
}

const VEICULOS_POR_PESO_CUBAGEM: Record<string, {
  pesoMax: number;
  pesoMin: number;
  cubagemMax: number;
  label: string;
  refrigerado?: boolean;
}> = {
  moto: { pesoMin: 0, pesoMax: 40, cubagemMax: 0.08, label: "Moto" },
  carro_passeio: { pesoMin: 41, pesoMax: 120, cubagemMax: 0.3, label: "Carro de Passeio" },
  fiorino: { pesoMin: 121, pesoMax: 500, cubagemMax: 3, label: "Fiorino" },
  kangoo: { pesoMin: 121, pesoMax: 700, cubagemMax: 4, label: "Kangoo" },
  kombi: { pesoMin: 121, pesoMax: 1000, cubagemMax: 5, label: "Kombi" },
  van: { pesoMin: 121, pesoMax: 1500, cubagemMax: 8, label: "Van" },
  hr: { pesoMin: 121, pesoMax: 1800, cubagemMax: 10, label: "HR" },
  vuc: { pesoMin: 121, pesoMax: 2500, cubagemMax: 16, label: "VUC" },
  tres_quartos: { pesoMin: 121, pesoMax: 4000, cubagemMax: 20, label: "3/4" },
  toco: { pesoMin: 121, pesoMax: 8000, cubagemMax: 35, label: "Toco" },
  truck: { pesoMin: 121, pesoMax: 14000, cubagemMax: 50, label: "Truck" },
  bitruck: { pesoMin: 121, pesoMax: 18000, cubagemMax: 65, label: "Bitruck" },
  carreta: { pesoMin: 121, pesoMax: 25000, cubagemMax: 80, label: "Carreta" },
  bitrem: { pesoMin: 121, pesoMax: 35000, cubagemMax: 110, label: "Bitrem" },
};

export interface AlertaCubagem {
  tipo: "erro" | "aviso" | "alerta";
  mensagem: string;
}

export function verificarAlertasCubagem(dados: DadosCarga, resultado: ResultadoCubagem): AlertaCubagem[] {
  const alertas: AlertaCubagem[] = [];
  const volumes = dados.volumes || 0;
  const peso = dados.peso || 0;
  const cubagem = resultado.cubagemTotal;

  if (cubagem > 50) {
    alertas.push({
      tipo: "alerta",
      mensagem: `Cubagem muito alta (${cubagem.toFixed(2)}m³). Conteúdo correto?`
    });
  }

  if (volumes > 100) {
    alertas.push({
      tipo: "aviso",
      mensagem: `Quantidade de volumes alta (${volumes}). Confirme o preenchimento.`
    });
  }

  const pesoPorVolume = volumes > 0 ? peso / volumes : 0;
  if (volumes > 10 && pesoPorVolume < 0.5) {
    alertas.push({
      tipo: "aviso",
      mensagem: `Peso por volume muito baixo (${pesoPorVolume.toFixed(2)}kg). Verifique.`
    });
  }

  return alertas;
}

const VEICULOS_REFRIGERADOS: string[] = ["van", "hr", "vuc", "tres_quartos", "toco", "truck", "bitruck", "carreta", "bitrem"];

export function calcularCubagem(dados: DadosCarga): ResultadoCubagem {
  const volumes = dados.volumes || 1;
  const peso = dados.peso || 0;
  const comprimento = dados.comprimento || 0;
  const largura = dados.largura || 0;
  const altura = dados.altura || 0;

  let cubagemTotal = dados.cubagem || 0;
  let cubagemManual = false;

  const temDimensoes = comprimento > 0 && largura > 0 && altura > 0;
  
  if (temDimensoes && cubagemTotal === 0) {
    const volumeUnitario = (comprimento / 100) * (largura / 100) * (altura / 100);
    cubagemTotal = volumeUnitario * volumes;
  } else if (cubagemTotal > 0 && !temDimensoes) {
    cubagemManual = true;
  }

  const volumeUnitario = volumes > 0 ? cubagemTotal / volumes : 0;
  const pesoPorVolume = volumes > 0 ? peso / volumes : 0;

  let tipoCarga: "Seca" | "Refrigerada" | "Congelada" | "Mista" = "Seca";
  if (dados.tipo === "Refrigerada") tipoCarga = "Refrigerada";
  else if (dados.tipo === "Congelada") tipoCarga = "Congelada";
  else if (dados.tipo === "Mista") tipoCarga = "Mista";

  return {
    cubagemTotal,
    volumeUnitario,
    pesoPorVolume,
    tipoCarga,
    cubagemManual
  };
}

export function sugerirVeiculosPorCarga(dados: DadosCarga): SugestaoVeiculo[] {
  const peso = dados.peso || 0;
  const cubagem = dados.cubagem || 0;
  const comp = dados.comprimento || 0;
  const larg = dados.largura || 0;
  const alt = dados.altura || 0;
  const tipoCarga = dados.tipo || "";

  const cargaRefrigerada = tipoCarga === "Refrigerada" || tipoCarga === "Congelada" || tipoCarga === "Mista";
  const precisaRefrigeracao = cargaRefrigerada;

  const sugestoes: SugestaoVeiculo[] = [];

  const entradaOrdenada = Object.entries(VEICULOS_POR_PESO_CUBAGEM).sort(([, a], [, b]) => {
    if (a.pesoMax !== b.pesoMax) return a.pesoMax - b.pesoMax;
    return a.cubagemMax - b.cubagemMax;
  });

  const primeiroVeiculoIdeal = entradaOrdenada.find(([tipo, params]) => {
    const ehRefrigerado = VEICULOS_REFRIGERADOS.includes(tipo);
    if (precisaRefrigeracao && !ehRefrigerado) return false;
    
    const pesoNoRange = peso >= params.pesoMin && peso <= params.pesoMax;
    const cubagemOk = cubagem <= params.cubagemMax;
    
    return pesoNoRange && cubagemOk;
  });

  if (primeiroVeiculoIdeal) {
    const [tipo, params] = primeiroVeiculoIdeal;
    const ehRefrigerado = VEICULOS_REFRIGERADOS.includes(tipo);
    
    sugestoes.push({
      tipo,
      label: params.label,
      motivo: cargaRefrigerada ? "Veículo refrigerado compatível" : `Sugerido por peso (${peso}kg)`,
      kgNecessario: peso,
      m3Necessario: cubagem,
      dimensoesMinimas: comp > 0 ? `${comp}x${larg}x${alt}cm` : "N/A",
      adequado: true,
      refrigerado: ehRefrigerado
    });
  }

  for (const [tipo, params] of entradaOrdenada) {
    if (sugestoes.length >= 5) break;
    
    const sugestaoExistente = sugestoes.find(s => s.tipo === tipo);
    if (sugestaoExistente) continue;

    const ehRefrigerado = VEICULOS_REFRIGERADOS.includes(tipo);
    
    if (precisaRefrigeracao && !ehRefrigerado) {
      continue;
    }

    const pesoOk = peso >= params.pesoMin && peso <= params.pesoMax;
    const cubagemOk = cubagem <= params.cubagemMax;

    let compOk = true, largOk = true, altOk = true;
    if (comp > 0) compOk = comp <= (params.pesoMax > 500 ? params.cubagemMax * 50 : 100);
    if (larg > 0) largOk = larg <= (params.pesoMax > 500 ? params.cubagemMax * 30 : 80);
    if (alt > 0) altOk = alt <= (params.pesoMax > 500 ? params.cubagemMax * 30 : 80);

    const adequado = pesoOk && cubagemOk && compOk && largOk && altOk;

    let motivo = "";
    if (!pesoOk && peso < params.pesoMin) {
      motivo = `Peso abaixo do mínimo ${params.pesoMin}kg`;
    } else if (!pesoOk && peso > params.pesoMax) {
      motivo = `Peso ${peso}kg excede limite de ${params.pesoMax}kg`;
    } else if (!cubagemOk) {
      motivo = `Cubagem ${cubagem.toFixed(2)}m³ excede limite de ${params.cubagemMax}m³`;
    } else {
      if (precisaRefrigeracao) {
        motivo = "Veículo com câmara frigorífica";
      } else {
        motivo = `Capacidade para ${params.pesoMax}kg e ${params.cubagemMax}m³`;
      }
    }

    sugestoes.push({
      tipo,
      label: params.label,
      motivo,
      kgNecessario: peso,
      m3Necessario: cubagem,
      dimensoesMinimas: comp > 0 ? `${comp}x${larg}x${alt}cm` : "N/A",
      adequado,
      refrigerado: ehRefrigerado
    });
  }

  const adequados = sugestoes.filter(s => s.adequado);
  const outros = sugestoes.filter(s => !s.adequado);

  return [...adequados, ...outros].slice(0, 5);
}

export function gerarSugestaoComMotivo(sugestoes: SugestaoVeiculo[]): { tipo: string; motivo: string } | null {
  if (sugestoes.length === 0 || !sugestoes[0].adequado) return null;
  
  const utama = sugestoes[0];
  return {
    tipo: utama.tipo,
    motivo: utama.motivo
  };
}

export function getTermicoVeiculo(tipoVeiculo: string, tipoCarga: string): string {
  if (tipoCarga === "Refrigerada" || tipoCarga === "Congelada" || tipoCarga === "Mista") {
    if (tipoVeiculo === "van" || tipoVeiculo === "hr" || tipoVeiculo === "vuc") {
      return tipoCarga === "Congelada" ? "congelado" : "refrigerado";
    }
  }
  return "seco";
}