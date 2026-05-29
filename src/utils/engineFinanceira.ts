export interface CalculoKM {
  rodados: number;
  franquia: number;
  excedente: number;
  valorKm: number;
  totalExcedente: number;
}

export interface CalculoEspera {
  minutos: number;
  tolerancia: number;
  excedente: number;
  valorHora: number;
  totalExcedente: number;
}

export interface EngineFinanceiraResult {
  valorBase: number;
  totalAdicionais: number;
  totalDescontos: number;
  total: number;
  cliente: {
    valorBase: number;
    adicionais: number;
    total: number;
    detalhes: {
      km: CalculoKM;
      espera: CalculoEspera;
    };
  };
  prestador: {
    valorBase: number;
    adicionais: number;
    descontos: number;
    total: number;
    detalhes: {
      km: {
        excedente: number;
        valorKm: number;
        totalExcedente: number;
      };
    };
  };
  margem: {
    valor: number;
    percentual: number;
  };
}

export interface EngineParams {
  tabelaValores: any | null;
  km: {
    inicial: number;
    final: number;
  };
  espera: {
    minutosTotais: number;
    tipoCobranca?: 'proporcional' | 'fracao' | 'bloco' | 'teto';
  };
  regrasOperacionais: {
    regraEspecialAtiva: boolean;
    horaSaida: number;
    clienteValido: boolean;
  };
  inputsManuais: {
    ajusteClienteValor: number;
    kmExcedentePrestadorValor: number;
  };
  financeiroPrestador: any;
  financeiroRealPrestador?: {
     tipo_pagamento: string;
     valor_diaria: number;
     valor_saida: number;
     fixo_mensal: number;
     franquia_km: number;
     valor_km: number;
  };
}

export function calcularFinanceiroEscala(params: EngineParams): EngineFinanceiraResult {
  const {
    tabelaValores,
    km,
    espera,
    regrasOperacionais,
    inputsManuais,
    financeiroPrestador,
    financeiroRealPrestador
  } = params;

  // Parâmetros da Tabela (Cliente)
  const diariaBase = tabelaValores?.valor_base || 0;
  const kmFranquia = tabelaValores?.km_franquia || 200;
  const valorKmCliente = tabelaValores?.valor_km_excedente || tabelaValores?.valor_km || 2.50;
  
  // Cálculo de KM (Cliente)
  const kmRodados = Math.max((km.final || 0) - (km.inicial || 0), 0);
  const kmExcedenteCliente = Math.max(kmRodados - kmFranquia, 0);
  const tabelaNaoConfigurada = !tabelaValores;
  const totalKmExcedenteCliente = tabelaNaoConfigurada ? 0 : (kmExcedenteCliente * valorKmCliente);

  // Cálculo de Espera (Cliente) - Fase 3B (Prioriza faixas, teto atingido)
  const esperaAtiva = tabelaValores?.adicionais?.espera?.ativo || false;
  const faixasEspera = tabelaValores?.adicionais?.espera?.faixas || [];
  let totalEsperaCliente = 0;
  let horasExcedentesEspera = 0;
  let esperaMinutosFree = tabelaValores?.adicionais?.espera?.minutosFree || 60;
  let esperaValorHora = tabelaValores?.adicionais?.espera?.valorHora || 0;

  if (esperaAtiva) {
    if (faixasEspera && faixasEspera.length > 0) {
       // Acha a faixa onde os minutos totais se encaixam (ordenadas)
       const faixaAtingida = [...faixasEspera]
         .sort((a: any, b: any) => b.inicio - a.inicio) // Pega a mais alta primeiro
         .find((f: any) => espera.minutosTotais >= f.inicio);
       
       if (faixaAtingida) {
          totalEsperaCliente = faixaAtingida.valor;
       }
    } else {
       // Regra antiga de fallback
       const minutosExcedentesEspera = Math.max((espera.minutosTotais || 0) - esperaMinutosFree, 0);
       horasExcedentesEspera = Math.ceil(minutosExcedentesEspera / 60);
       totalEsperaCliente = horasExcedentesEspera * esperaValorHora;
    }
  }

  // Regra Especial de Faturamento Base (Ex: DVL)
  let diariaCalculada = diariaBase;
  if (regrasOperacionais.regraEspecialAtiva && regrasOperacionais.clienteValido) {
    if (regrasOperacionais.horaSaida <= 11) {
      diariaCalculada = diariaBase;
    } else if (regrasOperacionais.horaSaida <= 14) {
      diariaCalculada = diariaBase * 1.50;
    } else if (regrasOperacionais.horaSaida <= 16) {
      diariaCalculada = diariaBase * 1.70;
    } else {
      diariaCalculada = diariaBase * 1.85;
    }
  }

  // Consolidação Faturamento Cliente
  const valorCliente = diariaCalculada;
  const adicionaisCliente = totalKmExcedenteCliente + totalEsperaCliente + (inputsManuais.ajusteClienteValor || 0);
  const totalCliente = valorCliente + adicionaisCliente;

  // Regras de Repasse Prestador (FASE 3B - Engine Financeira Real)
  let basePrestador = 0;
  let valorKmPrestadorFinal = 0;
  let kmExcedenteMotorista = 0;
  
  if (financeiroRealPrestador) {
    // Prestador possui financeiro cadastrado no banco
    if (financeiroRealPrestador.tipo_pagamento === 'diaria') {
       basePrestador = financeiroRealPrestador.valor_diaria;
    } else if (financeiroRealPrestador.tipo_pagamento === 'saida') {
       basePrestador = financeiroRealPrestador.valor_saida;
    } else if (financeiroRealPrestador.tipo_pagamento === 'fixo') {
       basePrestador = financeiroRealPrestador.fixo_mensal;
    } else {
       basePrestador = financeiroRealPrestador.valor_diaria || financeiroRealPrestador.valor_saida || 0;
    }

    const kmFranquiaPrestador = financeiroRealPrestador.franquia_km || 0;
    kmExcedenteMotorista = Math.max(kmRodados - kmFranquiaPrestador, 0);
    valorKmPrestadorFinal = financeiroRealPrestador.valor_km || 0;
    
  } else {
    // FALLBACK ANTIGO (se o prestador não tem regra própria, tenta a da tabela do cliente)
    const usarRegraTabela = tabelaValores && tabelaValores.tipo_repasse_prestador;
    
    if (usarRegraTabela) {
      if (tabelaValores.tipo_repasse_prestador === 'percentual') {
        basePrestador = totalCliente * ((tabelaValores.percentual_prestador || 0) / 100);
      } else {
        basePrestador = tabelaValores.valor_fixo_prestador || 0;
      }
    } else {
      // Fallback para input manual na UI caso não tenha tabela
      basePrestador = financeiroPrestador.valorTipo === 'fixo' && financeiroPrestador.valorFixo > 0 
        ? financeiroPrestador.valorFixo 
        : (financeiroPrestador.valorTipo === 'percentual' && financeiroPrestador.valorPercentual > 0 
            ? (financeiroPrestador.valorPercentual / 100) * diariaCalculada 
            : diariaCalculada);
    }
    kmExcedenteMotorista = kmExcedenteCliente;
    valorKmPrestadorFinal = inputsManuais.kmExcedentePrestadorValor || 0;
  }
  
  const totalKmExcedentePrestador = kmExcedenteMotorista * valorKmPrestadorFinal;

  const adicionaisPrestador = 
    totalKmExcedentePrestador + 
    (financeiroPrestador.combustivel || 0) +
    (financeiroPrestador.pedagio || 0) +
    ((financeiroPrestador.diariasAdicionais || 0) * (financeiroPrestador.valorDiaria || basePrestador)) +
    (financeiroPrestador.segundaSaida ? (financeiroPrestador.valorSegundaSaida || 0) : 0) +
    (financeiroPrestador.terceiraSaida ? (financeiroPrestador.valorTerceiraSaida || 0) : 0) +
    ((financeiroPrestador.saidasAdicionais || 0) * (financeiroPrestador.valorSaidaAdicional || 0)) +
    ((financeiroPrestador.ajudantes || 0) * (financeiroPrestador.valorAjudante || 0)) +
    (financeiroPrestador.valorReembolsoOutros || 0);

  const descontosPrestador = financeiroPrestador.desconto || 0;
  const totalPrestador = basePrestador + adicionaisPrestador - descontosPrestador;

  // Margem Operacional
  const margemReais = totalCliente - totalPrestador;
  const margemPercentual = totalCliente > 0 ? (margemReais / totalCliente) * 100 : 0;

  return {
    valorBase: basePrestador,
    totalAdicionais: adicionaisPrestador,
    totalDescontos: descontosPrestador,
    total: totalPrestador,
    cliente: {
      valorBase: valorCliente,
      adicionais: adicionaisCliente,
      total: totalCliente,
      detalhes: {
        km: {
          rodados: kmRodados,
          franquia: kmFranquia,
          excedente: kmExcedenteCliente,
          valorKm: valorKmCliente,
          totalExcedente: totalKmExcedenteCliente
        },
        espera: {
          minutos: espera.minutosTotais || 0,
          tolerancia: esperaMinutosFree,
          excedente: horasExcedentesEspera,
          valorHora: esperaValorHora,
          totalExcedente: totalEsperaCliente
        }
      }
    },
    prestador: {
      valorBase: basePrestador,
      adicionais: adicionaisPrestador,
      descontos: descontosPrestador,
      total: totalPrestador,
      detalhes: {
        km: {
          excedente: kmExcedenteMotorista,
          valorKm: valorKmPrestadorFinal,
          totalExcedente: totalKmExcedentePrestador
        }
      }
    },
    margem: {
      valor: margemReais,
      percentual: margemPercentual
    }
  };
}
